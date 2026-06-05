import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";
import { enviarEmail } from "@/lib/services/email";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const PreCadastroSchema = z.object({
  codigo: z.number().int().positive().optional().nullable(),
  nomeContato: z.string().min(2),
  emailContato: z.string().email(),
  telefoneContato: z.string().optional(),
  cpfContato: z.string().optional(),
  nomeEmpresaPretendido: z.string().optional(),
  cnpj: z.string().optional(),
  regimePretendido: z.string().optional(),
  segmento: z.string().optional(),
  categoria: z.string().optional(),
  responsavelComercial: z.string().optional(),
  honorarioContabil: z.number().nonnegative().optional().nullable(),
  honorarioFolha: z.number().nonnegative().optional().nullable(),
  honorarioFiscal: z.number().nonnegative().optional().nullable(),
  observacoes: z.string().optional(),
  temFolha: z.boolean().optional(),
  temFuncionario: z.boolean().optional(),
  temProlabore: z.boolean().optional(),
});

/** GET /api/pre-cadastros — lista com filtros */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  const where: any = {};
  if (status && status !== "TODOS") where.status = status;
  if (q) {
    where.OR = [
      { nomeContato: { contains: q, mode: "insensitive" } },
      { emailContato: { contains: q, mode: "insensitive" } },
      { nomeEmpresaPretendido: { contains: q, mode: "insensitive" } },
      { cnpj: { contains: q.replace(/\D/g, "") } },
    ];
  }

  const lista = await prisma.preCadastro.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(lista);
}

/** POST /api/pre-cadastros — cria pré-cadastro */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = PreCadastroSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  // Reserva próximo código (igual ao Cliente, evita colisão)
  let codigo = d.codigo ?? null;
  if (!codigo) {
    const [maxCli, maxPre] = await Promise.all([
      prisma.cliente.aggregate({ _max: { codigo: true } }),
      prisma.preCadastro.aggregate({ _max: { codigo: true } }),
    ]);
    const max = Math.max(maxCli._max.codigo ?? 0, maxPre._max.codigo ?? 0);
    codigo = max + 1;
  }

  // Checa colisão
  const colideCli = await prisma.cliente.findUnique({ where: { codigo }, select: { id: true } });
  const colidePre = await prisma.preCadastro.findUnique({ where: { codigo }, select: { id: true } });
  if (colideCli || colidePre) {
    return NextResponse.json({ error: `código ${codigo} já está em uso` }, { status: 409 });
  }

  const pre = await prisma.preCadastro.create({
    data: {
      codigo,
      nomeContato: d.nomeContato,
      emailContato: d.emailContato.toLowerCase(),
      telefoneContato: d.telefoneContato || null,
      cpfContato: d.cpfContato || null,
      nomeEmpresaPretendido: d.nomeEmpresaPretendido || null,
      cnpj: d.cnpj?.replace(/\D/g, "") || null,
      regimePretendido: d.regimePretendido || null,
      segmento: d.segmento || null,
      categoria: d.categoria || null,
      responsavelComercial: d.responsavelComercial || null,
      honorarioContabil: d.honorarioContabil ?? null,
      honorarioFolha: d.honorarioFolha ?? null,
      honorarioFiscal: d.honorarioFiscal ?? null,
      observacoes: d.observacoes || null,
      temFolha: d.temFolha ?? false,
      temFuncionario: d.temFuncionario ?? false,
      temProlabore: d.temProlabore ?? true,
      criadoPor: session.user.id,
      status: "PENDENTE",
    },
  });

  await audit({
    session,
    action: "pre-cadastro.create",
    resource: "pre_cadastro",
    resourceId: pre.id,
    after: pre,
    request: req,
  });

  // E-mail de boas-vindas com link do formulário de abertura (#79).
  // Não falha o request se o envio quebrar — só loga. A operação pode
  // reenviar manualmente depois.
  const baseUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  if (baseUrl && pre.emailContato) {
    const link = `${baseUrl}/forms/abertura-empresa?pre=${pre.id}`;
    try {
      await enviarEmail({
        to: pre.emailContato,
        subject: "Bem-vindo à Cestacorp — próximo passo",
        html: `
          <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
            <h2 style="color:#1F4FC4">Olá, ${pre.nomeContato}!</h2>
            <p>Obrigado por confiar na Cestacorp pra abertura da sua empresa.</p>
            <p>O próximo passo é preencher nosso formulário com os dados necessários:</p>
            <p style="margin:24px 0">
              <a href="${link}"
                 style="background:#1F4FC4;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
                Abrir formulário
              </a>
            </p>
            <p style="font-size:13px;color:#64748b">
              Se o botão não funcionar, copie e cole este link no navegador:<br>
              <span style="word-break:break-all">${link}</span>
            </p>
            <p style="font-size:13px;color:#64748b;margin-top:24px">
              Qualquer dúvida, é só responder este e-mail.<br>
              <b>Equipe Cestacorp</b>
            </p>
          </div>
        `,
        text: `Olá, ${pre.nomeContato}!\n\nObrigado por confiar na Cestacorp. Pra dar o próximo passo, preencha o formulário em:\n${link}\n\nQualquer dúvida, é só responder este e-mail.\n\nEquipe Cestacorp`,
      });
    } catch (err) {
      logger.warn("pre-cadastro.welcome-email.falhou", { preId: pre.id, err: String(err) });
    }
  }

  return NextResponse.json({ id: pre.id, codigo: pre.codigo }, { status: 201 });
}
