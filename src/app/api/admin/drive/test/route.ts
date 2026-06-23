import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertAdmin, AuthorizationError } from "@/lib/security/ownership";
import { driveConfigurado, uploadParaDrive } from "@/lib/services/drive";

/**
 * Sanity check do Google Drive (#15). Faz upload de um arquivo .txt
 * minimalista na pasta configurada (subpasta "_sistema-teste").
 *
 * Mostra na UI /configuracoes/integracao-drive se a service account
 * está configurada, com acesso à pasta, e quanto tempo o upload leva.
 *
 * Sem mutar nada do banco — só testa o caminho de upload.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertAdmin(session); }
  catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  if (!driveConfigurado()) {
    return NextResponse.json({
      ok: false,
      configurado: false,
      hint: "Configure GOOGLE_SERVICE_ACCOUNT_JSON e GOOGLE_DRIVE_FOLDER_ID no EasyPanel.",
    }, { status: 412 });
  }

  const inicio = Date.now();
  const conteudo = `Teste de upload Cestacorp\nData: ${new Date().toISOString()}\nUser: ${(session.user as any).email}\n`;

  try {
    const r = await uploadParaDrive({
      buffer: Buffer.from(conteudo, "utf8"),
      filename: `teste-${Date.now()}.txt`,
      mime: "text/plain",
      subfolderName: "_sistema-teste",
    });
    return NextResponse.json({
      ok: true,
      configurado: true,
      duracaoMs: Date.now() - inicio,
      arquivo: r,
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      configurado: true,
      duracaoMs: Date.now() - inicio,
      error: String(err?.message ?? err).slice(0, 500),
      hint: "Confirme que a pasta foi compartilhada com o email da service account como Editor.",
    }, { status: 500 });
  }
}

export async function GET() {
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const folder = process.env.GOOGLE_DRIVE_FOLDER_ID;
  let serviceAccountEmail: string | null = null;
  try {
    if (sa) {
      const parsed = JSON.parse(sa);
      serviceAccountEmail = parsed.client_email ?? null;
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    configurado: driveConfigurado(),
    folderId: folder ?? null,
    serviceAccountEmail,
    pasta: folder ? `https://drive.google.com/drive/folders/${folder}` : null,
  });
}
