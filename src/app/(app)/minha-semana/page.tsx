import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { formatDate, formatMoney, formatDateTime } from "@/lib/utils";
import {
  CalendarCheck, Users, AlertCircle, ClipboardList, Clock, MessageSquare, FileText,
} from "lucide-react";
import { addDays, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";

export const dynamic = "force-dynamic";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function MinhaSemanaPage() {
  const session = await auth();
  const me = (session?.user?.name ?? "").trim();
  const meUpper = me.toUpperCase();

  // Sem nome no perfil os filtros por "responsável contém me" virariam
  // "responsável contém ''" — match em TODO mundo. Bloqueia logo e manda
  // completar o perfil (#82).
  if (!me) {
    return (
      <div className="space-y-6 max-w-2xl">
        <EmptyState
          icon={Users}
          title="Complete seu perfil"
          description="Sem seu nome cadastrado não dá pra filtrar os clientes/obrigações sob sua responsabilidade. Edite o perfil e tente de novo."
          cta={{ href: "/perfil", label: "Completar perfil" }}
        />
      </div>
    );
  }

  // Filtros: clientes onde eu sou responsável, eventos da agenda que são meus,
  // execuções da régua recentes dos meus clientes.
  const hoje = startOfDay(new Date());
  const fimSemana = endOfDay(addDays(hoje, 6));

  const [meusClientes, eventosSemana, execucoesHoje, formsPendentes, cobrancasAtraso] = await Promise.all([
    prisma.cliente.findMany({
      where: {
        status: "ATIVO",
        OR: [
          { respFiscal: { contains: me, mode: "insensitive" } },
          { respFolha: { contains: me, mode: "insensitive" } },
          { respContabil: { contains: me, mode: "insensitive" } },
        ],
      },
      select: {
        id: true, razaoSocial: true, nomeFantasia: true,
        respFiscal: true, respFolha: true, respContabil: true,
        _count: { select: { cobrancas: { where: { status: { in: ["ABERTO", "ATRASADO"] } } } } },
      },
      orderBy: { razaoSocial: "asc" },
    }),
    prisma.eventoAgenda.findMany({
      where: {
        dataVencimento: { gte: hoje, lte: fimSemana },
        OR: [
          { responsavel: { contains: me, mode: "insensitive" } },
          { status: "ATRASADO" },
        ],
      },
      orderBy: { dataVencimento: "asc" },
      include: {
        obrigacao: { select: { tipo: true } },
        cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      },
    }),
    prisma.execucaoRegua.findMany({
      where: {
        enviadoEm: { gte: hoje, lte: endOfDay(hoje) },
        status: "ENVIADO",
      },
      take: 10,
      orderBy: { enviadoEm: "desc" },
      include: {
        cliente: { select: { razaoSocial: true, nomeFantasia: true, respFiscal: true, respFolha: true, respContabil: true } },
        passo: { select: { nome: true, canal: true } },
      },
    }),
    // Formulários recebidos pra aplicar
    (async () => {
      const { connectMongo } = await import("@/lib/db/mongo");
      const { FormResponseModel } = await import("@/models/FormResponse");
      await connectMongo();
      return FormResponseModel.find({ status: "RECEBIDO" }).sort({ createdAt: -1 }).limit(10).lean();
    })(),
    prisma.cobranca.findMany({
      where: {
        status: "ATRASADO",
        cliente: {
          OR: [
            { respFiscal: { contains: me, mode: "insensitive" } },
            { respContabil: { contains: me, mode: "insensitive" } },
          ],
        },
      },
      orderBy: { vencimento: "asc" },
      take: 10,
      include: { cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } } },
    }),
  ]);

  // Filtra execuções hoje pelos meus clientes
  const minhasExecucoes = execucoesHoje.filter((e) => {
    const c: any = e.cliente;
    return (
      (c.respFiscal && c.respFiscal.toUpperCase().includes(meUpper)) ||
      (c.respFolha && c.respFolha.toUpperCase().includes(meUpper)) ||
      (c.respContabil && c.respContabil.toUpperCase().includes(meUpper))
    );
  });

  // Agrupa eventos por dia
  const eventosPorDia = new Map<string, typeof eventosSemana>();
  for (const e of eventosSemana) {
    const k = e.dataVencimento.toISOString().slice(0, 10);
    if (!eventosPorDia.has(k)) eventosPorDia.set(k, []);
    eventosPorDia.get(k)!.push(e);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4 flex-wrap">
        <Avatar name={me || "U"} size="lg" status="online" />
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue">
            Minha semana
          </h1>
          <p className="text-muted-foreground">
            {me} · visão filtrada dos clientes e obrigações sob sua responsabilidade
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-muted-foreground">Meus clientes</p>
            <Users className="h-4 w-4 text-cestacorp-blue" />
          </div>
          <p className="text-2xl font-bold mt-1">{meusClientes.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-muted-foreground">Eventos/semana</p>
            <CalendarCheck className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold mt-1">{eventosSemana.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-muted-foreground">Atrasados</p>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold mt-1 text-red-600">{cobrancasAtraso.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-muted-foreground">Forms pendentes</p>
            <ClipboardList className="h-4 w-4 text-violet-600" />
          </div>
          <p className="text-2xl font-bold mt-1">{formsPendentes.length}</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Agenda da semana */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5" /> Agenda dos próximos 7 dias
            </CardTitle>
            <CardDescription>Obrigações suas + atrasadas no geral</CardDescription>
          </CardHeader>
          <CardContent>
            {eventosSemana.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="Nada pra esta semana 🎉" description="Você está em dia com suas obrigações." />
            ) : (
              <div className="space-y-3">
                {Array.from(eventosPorDia.entries()).map(([dia, items]) => {
                  const dt = new Date(dia);
                  return (
                    <div key={dia}>
                      <div className="flex items-baseline gap-2 mb-1.5">
                        <span className={
                          "text-sm font-bold " + (dt.getTime() === hoje.getTime() ? "text-cestacorp-blue" : "text-muted-foreground")
                        }>
                          {dt.getTime() === hoje.getTime() ? "HOJE" : DIAS[dt.getDay()].toUpperCase()} {dt.getDate()}/{dt.getMonth() + 1}
                        </span>
                        <span className="text-xs text-muted-foreground">· {items.length} item(s)</span>
                      </div>
                      <ul className="space-y-1 pl-4 border-l-2 border-slate-200">
                        {items.map((e) => (
                          <li key={e.id}>
                            <Link href={`/agenda/${e.id}`} className="block py-1.5 hover:bg-muted rounded -ml-2 pl-2">
                              <div className="flex items-center gap-2 text-sm">
                                <span className={
                                  "h-1.5 w-1.5 rounded-full " +
                                  (e.status === "ATRASADO" ? "bg-red-500" : "bg-amber-500")
                                } />
                                {e.obrigacao?.tipo && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{e.obrigacao.tipo}</span>}
                                <span className="font-medium truncate">{e.titulo}</span>
                                {e.cliente && <span className="text-xs text-muted-foreground truncate">· {e.cliente.nomeFantasia ?? e.cliente.razaoSocial}</span>}
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Forms pendentes pra revisar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" /> Formulários pra aplicar
            </CardTitle>
            <CardDescription>Respostas RECEBIDO aguardando ação</CardDescription>
          </CardHeader>
          <CardContent>
            {formsPendentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inbox limpa 🎉</p>
            ) : (
              <ul className="space-y-2">
                {formsPendentes.map((f: any) => (
                  <li key={String(f._id)}>
                    <Link href={`/formularios/${f._id}`} className="block p-2 hover:bg-muted rounded">
                      <p className="text-sm font-medium truncate">{f.autor?.nome ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{f.formSlug} · {formatDateTime(f.createdAt)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cobranças atrasadas dos meus clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" /> Cobranças atrasadas dos meus clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cobrancasAtraso.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma cobrança atrasada dos seus clientes.</p>
          ) : (
            <ul className="divide-y">
              {cobrancasAtraso.map((c) => {
                const atraso = Math.floor((Date.now() - c.vencimento.getTime()) / 86400000);
                return (
                  <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/cobrancas/${c.id}`} className="font-medium hover:underline">
                        {c.cliente.nomeFantasia ?? c.cliente.razaoSocial}
                      </Link>
                      <p className="text-xs text-muted-foreground">{c.descricao} · venc. {formatDate(c.vencimento)} · {atraso}d atraso</p>
                    </div>
                    <p className="font-bold text-red-600 whitespace-nowrap">{formatMoney(Number(c.valor))}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Meus clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Meus clientes</CardTitle>
          <CardDescription>Você aparece como responsável (fiscal/folha/contábil)</CardDescription>
        </CardHeader>
        <CardContent>
          {meusClientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Você não está como responsável em nenhum cliente ainda.</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {meusClientes.map((c) => (
                <li key={c.id}>
                  <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 rounded-md border p-2 hover:bg-muted">
                    <Avatar name={c.nomeFantasia ?? c.razaoSocial} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.nomeFantasia ?? c.razaoSocial}</p>
                      <p className="text-xs text-muted-foreground">
                        {[c.respFiscal && `fiscal: ${c.respFiscal}`, c.respFolha && `folha: ${c.respFolha}`, c.respContabil && `ctb: ${c.respContabil}`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {c._count.cobrancas > 0 && (
                      <span className="status-badge status-atraso text-[10px] shrink-0">{c._count.cobrancas}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {minhasExecucoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Mensagens enviadas hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {minhasExecucoes.map((e) => (
                <li key={e.id} className="py-2">
                  <Link href={`/regua-cobranca/execucao/${e.id}`} className="hover:text-primary">
                    <b>{e.cliente.nomeFantasia ?? e.cliente.razaoSocial}</b> · {e.passo.nome} · {formatDateTime(e.enviadoEm)}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
