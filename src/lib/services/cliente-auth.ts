/**
 * Autenticação do Portal do Cliente.
 * Independente do NextAuth de equipe; usa bcrypt e cookies via NextAuth Credentials.
 * Fluxo:
 *   1. Equipe convida (gera token) → cliente recebe e-mail com link /portal/primeiro-acesso/[token]
 *   2. Cliente define senha → token é invalidado → pode fazer login normalmente
 *   3. Esqueci senha → envia outro token (tokenReset) válido por 2 horas
 */

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { addDays, addHours } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { enviarEmail } from "./email";

export const PORTAL_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

function gerarToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ==============================
// Convite (equipe chama)
// ==============================
export async function convidarClienteAcesso(params: {
  clienteId: string;
  email: string;
  nome: string;
}): Promise<{ acessoId: string; token: string; jaExistia: boolean }> {
  const token = gerarToken();
  const expira = addDays(new Date(), 7);

  const existente = await prisma.clienteAcesso.findFirst({
    where: { clienteId: params.clienteId, email: params.email.toLowerCase() },
  });

  let acesso;
  if (existente) {
    acesso = await prisma.clienteAcesso.update({
      where: { id: existente.id },
      data: { nome: params.nome, tokenConvite: token, tokenConviteExpira: expira, ativo: true },
    });
  } else {
    acesso = await prisma.clienteAcesso.create({
      data: {
        clienteId: params.clienteId,
        email: params.email.toLowerCase(),
        nome: params.nome,
        tokenConvite: token,
        tokenConviteExpira: expira,
      },
    });
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: params.clienteId },
    select: { razaoSocial: true },
  });

  const link = `${PORTAL_URL}/portal/primeiro-acesso/${token}`;
  await enviarEmail({
    to: params.email,
    subject: `Seu acesso ao portal Cestacorp — ${cliente?.razaoSocial ?? ""}`,
    html: `
      <p>Olá ${params.nome},</p>
      <p>A Cestacorp liberou seu acesso ao portal do cliente.</p>
      <p>Clique no link abaixo para criar sua senha (válido por 7 dias):</p>
      <p><a href="${link}" style="display:inline-block;background:#1E3A8A;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">Ativar meu acesso</a></p>
      <p>Ou copie este link: ${link}</p>
      <hr>
      <p style="color:#666;font-size:12px">Se você não esperava este e-mail, pode ignorar.</p>
    `,
    text: `Seu acesso ao portal Cestacorp: ${link}`,
  });

  return { acessoId: acesso.id, token, jaExistia: Boolean(existente) };
}

// ==============================
// Ativação (cliente define senha)
// ==============================
export async function ativarAcessoComToken(token: string, senha: string) {
  const acesso = await prisma.clienteAcesso.findUnique({ where: { tokenConvite: token } });
  if (!acesso) throw new Error("Token inválido");
  if (!acesso.tokenConviteExpira || acesso.tokenConviteExpira < new Date()) {
    throw new Error("Token expirado");
  }
  if (senha.length < 8) throw new Error("Senha deve ter pelo menos 8 caracteres");

  const hash = await bcrypt.hash(senha, 10);
  await prisma.clienteAcesso.update({
    where: { id: acesso.id },
    data: {
      password: hash,
      tokenConvite: null,
      tokenConviteExpira: null,
    },
  });
  return acesso.clienteId;
}

// ==============================
// Login
// ==============================
export async function autenticarCliente(email: string, senha: string) {
  const acesso = await prisma.clienteAcesso.findUnique({
    where: { email: email.toLowerCase() },
    include: { cliente: { select: { id: true, razaoSocial: true, status: true } } },
  });
  if (!acesso || !acesso.ativo || !acesso.password) return null;
  const ok = await bcrypt.compare(senha, acesso.password);
  if (!ok) return null;
  if (acesso.cliente.status === "ENCERRADO") return null;

  await prisma.clienteAcesso.update({
    where: { id: acesso.id },
    data: { ultimoAcesso: new Date() },
  });

  return {
    id: acesso.id,
    clienteId: acesso.clienteId,
    email: acesso.email,
    nome: acesso.nome,
    clienteRazaoSocial: acesso.cliente.razaoSocial,
  };
}

// ==============================
// Esqueci senha
// ==============================
export async function solicitarReset(email: string) {
  const acesso = await prisma.clienteAcesso.findUnique({ where: { email: email.toLowerCase() } });
  if (!acesso) return; // não revela se o e-mail existe

  const token = gerarToken();
  await prisma.clienteAcesso.update({
    where: { id: acesso.id },
    data: { tokenReset: token, tokenResetExpira: addHours(new Date(), 2) },
  });

  const link = `${PORTAL_URL}/portal/resetar/${token}`;
  await enviarEmail({
    to: acesso.email,
    subject: "Redefinição de senha — Portal Cestacorp",
    html: `<p>Clique para redefinir sua senha (válido por 2h): <a href="${link}">${link}</a></p>`,
    text: `Redefinir senha: ${link}`,
  });
}

export async function resetarSenhaComToken(token: string, senha: string) {
  const acesso = await prisma.clienteAcesso.findUnique({ where: { tokenReset: token } });
  if (!acesso) throw new Error("Token inválido");
  if (!acesso.tokenResetExpira || acesso.tokenResetExpira < new Date()) {
    throw new Error("Token expirado");
  }
  if (senha.length < 8) throw new Error("Senha deve ter pelo menos 8 caracteres");

  const hash = await bcrypt.hash(senha, 10);
  await prisma.clienteAcesso.update({
    where: { id: acesso.id },
    data: { password: hash, tokenReset: null, tokenResetExpira: null },
  });
}
