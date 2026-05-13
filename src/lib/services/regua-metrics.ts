import { prisma } from "@/lib/db/prisma";
import { subDays, format } from "date-fns";

export async function getReguaMetrics(reguaId?: string) {
  const filtroRegua = reguaId ? { reguaId } : {};

  const [statusAgg, total, passos30d, conversao] = await Promise.all([
    prisma.execucaoRegua.groupBy({
      by: ["status"],
      where: { ...filtroRegua },
      _count: true,
    }),
    prisma.execucaoRegua.count({ where: filtroRegua }),
    prisma.execucaoRegua.count({
      where: { ...filtroRegua, createdAt: { gte: subDays(new Date(), 30) } },
    }),
    // conversão = cobranças que foram PAGAS após o cliente receber ao menos 1 mensagem
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(DISTINCT e."cobrancaId")::bigint as c
      FROM execucoes_regua e
      JOIN cobrancas c ON c.id = e."cobrancaId"
      WHERE e.status = 'ENVIADO' AND c.status = 'PAGO'
      ${reguaId ? prisma.$queryRaw`AND e."reguaId" = ${reguaId}` : prisma.$queryRaw``}
    `.catch(() => [{ c: BigInt(0) }]),
  ]);

  const byStatus = Object.fromEntries(statusAgg.map((s) => [s.status, s._count]));
  const enviados = byStatus.ENVIADO ?? 0;
  const erros = byStatus.ERRO ?? 0;
  const pendentes = byStatus.PENDENTE ?? 0;
  const pulados = byStatus.PULADO ?? 0;

  const taxaEntrega = total > 0 ? Math.round((enviados / (enviados + erros || 1)) * 100) : 0;
  const taxaConversao = enviados > 0 ? Math.round((Number(conversao[0]?.c ?? 0) / enviados) * 100) : 0;

  // Volume por dia (últimos 14)
  const desde = subDays(new Date(), 14);
  const diario = await prisma.execucaoRegua.findMany({
    where: { ...filtroRegua, enviadoEm: { gte: desde }, status: "ENVIADO" },
    select: { enviadoEm: true },
  });
  const buckets = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = subDays(new Date(), 13 - i);
    buckets.set(format(d, "yyyy-MM-dd"), 0);
  }
  for (const e of diario) {
    if (!e.enviadoEm) continue;
    const k = format(e.enviadoEm, "yyyy-MM-dd");
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const serie = Array.from(buckets.entries()).map(([dia, v]) => ({
    dia: format(new Date(dia), "dd/MM"),
    enviados: v,
  }));

  // Melhor horário (só conta enviados com sucesso)
  const porHora = await prisma.$queryRaw<{ hora: number; q: bigint }[]>`
    SELECT EXTRACT(HOUR FROM "enviadoEm")::int as hora, COUNT(*)::bigint as q
    FROM execucoes_regua
    WHERE status = 'ENVIADO' AND "enviadoEm" IS NOT NULL
    GROUP BY hora ORDER BY q DESC LIMIT 1
  `.catch(() => []);

  const melhorHorario = porHora[0] ? `${porHora[0].hora}h` : "—";

  return {
    total,
    enviados,
    erros,
    pendentes,
    pulados,
    taxaEntrega,
    taxaConversao,
    cobrancasConvertidas: Number(conversao[0]?.c ?? 0),
    passos30d,
    serie,
    melhorHorario,
  };
}

export async function getHeatmapEnvios() {
  // Pega todas as execuções enviadas nos últimos 90 dias
  const linhas = await prisma.$queryRaw<{ dow: number; hora: number; q: bigint }[]>`
    SELECT
      EXTRACT(DOW FROM "enviadoEm")::int as dow,
      EXTRACT(HOUR FROM "enviadoEm")::int as hora,
      COUNT(*)::bigint as q
    FROM execucoes_regua
    WHERE status = 'ENVIADO' AND "enviadoEm" IS NOT NULL
      AND "enviadoEm" >= NOW() - INTERVAL '90 days'
    GROUP BY dow, hora
  `.catch(() => []);

  // Matriz 7 × 24 (domingo=0 a sábado=6)
  const matriz: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let max = 0;
  for (const l of linhas) {
    const v = Number(l.q);
    matriz[l.dow][l.hora] = v;
    if (v > max) max = v;
  }
  return { matriz, max };
}

export async function getPassoStats(reguaId: string) {
  const passos = await prisma.reguaPasso.findMany({
    where: { reguaId },
    orderBy: { ordem: "asc" },
    include: {
      execucoes: { select: { status: true } },
    },
  });
  return passos.map((p) => {
    const byStatus = p.execucoes.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      id: p.id,
      nome: p.nome,
      offsetDias: p.offsetDias,
      canal: p.canal as "WHATSAPP" | "EMAIL" | "SMS",
      horarioEnvio: p.horarioEnvio ?? undefined,
      templateMsg: p.templateMsg,
      stats: {
        enviado: byStatus.ENVIADO ?? 0,
        erro: byStatus.ERRO ?? 0,
        pendente: byStatus.PENDENTE ?? 0,
        pulado: byStatus.PULADO ?? 0,
      },
    };
  });
}
