/**
 * Geração de carta de reajuste em PDF + envio automático para o cliente
 * (WhatsApp + e-mail quando aplicar reajuste).
 *
 * A carta é um HTML simples renderizado como PDF (via puppeteer não;
 * aqui uso HTML e o próprio navegador/LibreOffice converte se precisar).
 * Para simplificar na Cestacorp, gera HTML formatado e anexa no WhatsApp
 * como link; ou envia o texto formatado direto na mensagem.
 */
import { prisma } from "@/lib/db/prisma";
import { enviarMensagem, upsertContato } from "./digisac";
import { enviarEmail } from "./email";
import { connectMongo } from "@/lib/db/mongo";
import { MessageLogModel } from "@/models/MessageLog";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface Proposta {
  clienteId: string;
  razaoSocial: string;
  indice: string;
  percentual: number;
  valorAtual: number;
  valorProposto: number;
  mesAniversario: number;
  contratoId?: string;
}

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function money(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function gerarCartaHtml(p: Proposta, cliente: { razaoSocial: string; cpfCnpj: string }): string {
  const hoje = new Date();
  const mesExtenso = MESES[p.mesAniversario - 1];
  const aumento = p.valorProposto - p.valorAtual;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Carta de Reajuste ${p.razaoSocial}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 40px auto; padding: 40px; color: #1f2937; line-height: 1.6; }
  header { border-bottom: 3px solid #1E3A8A; padding-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
  .marca { font-size: 22px; font-weight: 800; color: #1E3A8A; }
  .marca span { color: #84CC16; }
  h1 { color: #1E3A8A; font-size: 20px; margin-top: 32px; }
  .destaque { background: #EFF6FF; border-left: 4px solid #1E3A8A; padding: 14px 18px; margin: 20px 0; border-radius: 4px; }
  .destaque b { color: #1E3A8A; }
  table { width: 100%; border-collapse: collapse; margin: 18px 0; }
  td, th { padding: 10px 14px; border: 1px solid #E5E7EB; text-align: left; }
  th { background: #F1F5F9; font-weight: 600; }
  .valor { font-family: monospace; font-size: 16px; }
  .novo { color: #065F46; font-weight: 700; }
  footer { margin-top: 44px; border-top: 1px solid #E5E7EB; padding-top: 16px; font-size: 12px; color: #6B7280; }
  .assinatura { margin-top: 56px; padding-top: 14px; border-top: 1px solid #999; width: 300px; text-align: center; }
</style>
</head>
<body>
  <header>
    <div class="marca">cesta<span>corp.</span></div>
    <div style="font-size: 12px; color: #6B7280;">Porto Alegre, ${hoje.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
  </header>

  <p style="margin-top: 32px;">
    Prezado(a) cliente <b>${cliente.razaoSocial}</b>,<br>
    CNPJ/CPF: <code>${cliente.cpfCnpj}</code>
  </p>

  <h1>Comunicado de reajuste contratual — ${mesExtenso}/${hoje.getFullYear()}</h1>

  <p>
    Conforme cláusula contratual, informamos o reajuste anual do valor dos honorários
    de prestação de serviços contábeis, com vigência a partir desta data. O índice
    utilizado foi o <b>${p.indice}</b>, acumulado nos últimos 12 meses.
  </p>

  <div class="destaque">
    <p style="margin:0;"><b>Índice aplicado:</b> ${p.indice} · <b>${p.percentual.toFixed(2)}%</b> (acumulado 12 meses)</p>
  </div>

  <table>
    <tr><th>Descrição</th><th style="width: 180px; text-align: right;">Valor</th></tr>
    <tr><td>Valor de honorários anterior</td><td class="valor" style="text-align: right;">${money(p.valorAtual)}</td></tr>
    <tr><td>Reajuste aplicado (${p.percentual.toFixed(2)}%)</td><td class="valor" style="text-align: right; color: #B45309;">+ ${money(aumento)}</td></tr>
    <tr><td><b>Novo valor de honorários</b></td><td class="valor novo" style="text-align: right;">${money(p.valorProposto)}</td></tr>
  </table>

  <p>
    Este reajuste é essencial para manter a qualidade, a continuidade e o aprimoramento
    contínuo dos serviços que prestamos à ${cliente.razaoSocial}, acompanhando a evolução
    dos custos operacionais, encargos e infraestrutura.
  </p>

  <p>
    Permanecemos à disposição para eventuais dúvidas ou esclarecimentos. Agradecemos
    imensamente pela parceria e confiança depositadas na Cestacorp.
  </p>

  <div class="assinatura">
    Cestacorp Contabilidade<br>
    <small>equipe responsável</small>
  </div>

  <footer>
    Cestacorp — Porto Alegre/RS · cestacorp.com.br · Este documento foi gerado automaticamente.
  </footer>
</body>
</html>`;
}

/**
 * Salva a carta em /uploads/cartas/ com hash no nome e retorna caminho.
 */
export async function salvarCartaHtml(p: Proposta, cliente: { razaoSocial: string; cpfCnpj: string }): Promise<string> {
  const html = gerarCartaHtml(p, cliente);
  const id = crypto.createHash("sha256").update(p.clienteId + p.percentual + p.valorProposto).digest("hex").slice(0, 16);
  const dir = path.join(process.cwd(), "uploads", "cartas");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `carta-reajuste-${id}.html`);
  fs.writeFileSync(file, html, "utf-8");
  return file;
}

/**
 * Envia a comunicação de reajuste para o cliente (WhatsApp + e-mail).
 */
export async function comunicarReajuste(p: Proposta): Promise<{
  whatsapp: boolean;
  email: boolean;
  arquivo: string;
}> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: p.clienteId },
    include: {
      telefones: { where: { whatsapp: true }, take: 1 },
      emails: { where: { principal: true }, take: 1 },
    },
  });
  if (!cliente) throw new Error("cliente não encontrado");

  const arquivo = await salvarCartaHtml(p, cliente);
  const mesExtenso = MESES[p.mesAniversario - 1];

  const mensagem = `Olá ${cliente.razaoSocial}! 📢

Comunicado oficial da Cestacorp — reajuste contratual ${mesExtenso}/${new Date().getFullYear()}:

📊 Índice aplicado: ${p.indice} (${p.percentual.toFixed(2)}%)
💰 Valor anterior: ${money(p.valorAtual)}
💚 *Novo valor: ${money(p.valorProposto)}*

Carta oficial completa foi enviada por e-mail. Permanecemos à disposição para qualquer dúvida.

Agradecemos pela parceria e confiança! 💙💚
Equipe Cestacorp`;

  const htmlEmail = gerarCartaHtml(p, { razaoSocial: cliente.razaoSocial, cpfCnpj: cliente.cpfCnpj });
  await connectMongo();

  // WhatsApp
  let whatsappOk = false;
  const tel = cliente.telefones[0];
  if (tel) {
    try {
      let contactId = cliente.digisacContactId;
      if (!contactId) {
        const c = await upsertContato({ name: cliente.razaoSocial, number: tel.numero });
        contactId = c.id;
        await prisma.cliente.update({ where: { id: cliente.id }, data: { digisacContactId: contactId } });
      }
      const envio = await enviarMensagem({ contactId, number: tel.numero, text: mensagem });
      await MessageLogModel.create({
        canal: "WHATSAPP",
        direcao: "OUT",
        clienteId: cliente.id,
        para: tel.numero,
        conteudo: mensagem,
        provider: "digisac",
        providerMessageId: envio.id,
        status: "ENVIADO",
      });
      whatsappOk = true;
    } catch {}
  }

  // E-mail
  let emailOk = false;
  const email = cliente.emails[0]?.email;
  if (email) {
    try {
      await enviarEmail({
        to: email,
        subject: `Comunicado oficial de reajuste — ${cliente.razaoSocial}`,
        html: htmlEmail,
        text: mensagem,
      });
      await MessageLogModel.create({
        canal: "EMAIL",
        direcao: "OUT",
        clienteId: cliente.id,
        para: email,
        assunto: `Comunicado oficial de reajuste`,
        conteudo: mensagem,
        provider: "smtp",
        providerMessageId: `carta-${Date.now()}`,
        status: "ENVIADO",
      });
      emailOk = true;
    } catch {}
  }

  return { whatsapp: whatsappOk, email: emailOk, arquivo };
}
