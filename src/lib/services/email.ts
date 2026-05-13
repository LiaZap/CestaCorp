/**
 * Serviço de e-mail.
 * Implementação pluggable: usa SMTP (nodemailer) em produção OU placeholder em dev.
 * Propositalmente escrito para rodar SEM dependência nova até o setup:
 *   - Se SMTP_HOST estiver definido, envia via nodemailer dinâmico.
 *   - Senão, loga e marca como "simulado" (útil em dev).
 */

export interface SendEmailParams {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export async function enviarEmail(params: SendEmailParams): Promise<{ id: string; simulated?: boolean }> {
  const host = process.env.SMTP_HOST;
  const from = params.from || process.env.SMTP_FROM || "no-reply@cestacorp.com.br";

  if (!host) {
    console.warn("[email] SMTP_HOST não configurado — simulando envio para", params.to);
    return { id: `sim-${Date.now()}`, simulated: true };
  }

  // import dinâmico para não quebrar o build se nodemailer não estiver instalado
  const { default: nodemailer } = await import("nodemailer").catch(() => ({ default: null as any }));
  if (!nodemailer) {
    console.warn("[email] nodemailer não instalado — simulando envio");
    return { id: `sim-${Date.now()}`, simulated: true };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  const info = await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  return { id: String(info.messageId) };
}
