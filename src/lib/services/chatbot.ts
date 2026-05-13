/**
 * Chatbot WhatsApp básico (acionado via webhook Digisac).
 *
 * Detecta intenções na mensagem do cliente e responde automaticamente com
 * informação relevante. Quando não entende, encaminha pra atendente humana.
 *
 * Intenções suportadas:
 *   - /boleto | "boleto" | "segunda via" → manda link da próxima cobrança
 *   - /das | "das" → status do DAS do mês
 *   - /certidao | "certidão negativa" → orienta como baixar
 *   - /financeiro → resumo de pendências
 *   - /humano | "atendente" → marca como AGUARDANDO ATENDIMENTO
 *   - oi, olá, bom dia → saudação com menu
 */

import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/utils";

export interface IntentResult {
  matched: boolean;
  intent?: string;
  resposta?: string;
  escalar?: boolean;
}

function normalizar(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const INTENTS: { id: string; padroes: RegExp[] }[] = [
  { id: "saudacao", padroes: [/^(oi|ola|bom dia|boa tarde|boa noite|hey|eae)\b/, /^\?\s*menu/] },
  { id: "boleto", padroes: [/boleto|segunda via|2a via|pagar|qual o valor/] },
  { id: "das", padroes: [/\bdas\b|simples nacional|guia do mes/] },
  { id: "certidao", padroes: [/certidao|cnd|negativa|cpf ok/] },
  { id: "financeiro", padroes: [/financeiro|pendencia|devo|atrasad/] },
  { id: "humano", padroes: [/atendente|humano|falar com alguem|nao e isso|n e isso/] },
  { id: "agradecimento", padroes: [/obrigad|valeu|muito bom|show/] },
];

function detectarIntencao(msg: string): string | null {
  const n = normalizar(msg);
  for (const i of INTENTS) for (const p of i.padroes) if (p.test(n)) return i.id;
  return null;
}

const MENU = `Olá! 👋 Sou o bot da Cestacorp.
Posso te ajudar rapidamente com:

📄 *boleto* — 2ª via e valor
🧾 *das* — guia do Simples do mês
📋 *certidão* — certidão negativa
💰 *financeiro* — suas pendências
👤 *atendente* — falar com humano

É só responder com uma dessas palavras!`;

export async function responderCliente(params: {
  clienteId?: string | null;
  telefone?: string;
  texto: string;
}): Promise<IntentResult> {
  const intent = detectarIntencao(params.texto);
  if (!intent) return { matched: false };

  // Resolve cliente — pelo clienteId explícito ou pelo telefone (phone match)
  let cliente: any = null;
  if (params.clienteId) {
    cliente = await prisma.cliente.findUnique({
      where: { id: params.clienteId },
      include: {
        cobrancas: {
          where: { status: { in: ["ABERTO", "ATRASADO"] } },
          orderBy: { vencimento: "asc" },
        },
      },
    });
  } else if (params.telefone) {
    const tel = await prisma.contatoTelefone.findFirst({
      where: { numero: params.telefone },
      include: {
        cliente: {
          include: {
            cobrancas: {
              where: { status: { in: ["ABERTO", "ATRASADO"] } },
              orderBy: { vencimento: "asc" },
            },
          },
        },
      },
    });
    cliente = tel?.cliente;
  }

  const primeiroNome = (cliente?.nomeFantasia ?? cliente?.razaoSocial ?? "").split(" ")[0];
  const saud = primeiroNome ? `, ${primeiroNome}` : "";

  switch (intent) {
    case "saudacao":
      return { matched: true, intent, resposta: MENU };

    case "boleto": {
      if (!cliente) return { matched: true, intent, resposta: "Para te mostrar boletos, preciso identificar seu cadastro. Vou chamar o atendente!", escalar: true };
      const cob = cliente.cobrancas?.[0];
      if (!cob) return { matched: true, intent, resposta: `Não tem boleto em aberto${saud}! 🎉 Você está em dia com a Cestacorp.` };
      const venc = cob.vencimento.toLocaleDateString("pt-BR");
      const partes = [
        `Olá${saud}! Seu próximo boleto:`,
        `📄 ${cob.descricao ?? "Honorários"}`,
        `💰 ${formatMoney(Number(cob.valor))}`,
        `📅 Vence ${venc}`,
      ];
      if (cob.pixCopiaCola) partes.push(`\n🔑 *PIX copia-e-cola*:\n${cob.pixCopiaCola}`);
      if (cob.urlBoleto) partes.push(`\n🔗 Boleto: ${cob.urlBoleto}`);
      return { matched: true, intent, resposta: partes.join("\n") };
    }

    case "das": {
      if (!cliente) return { matched: true, intent, resposta: "Para consultar seu DAS, preciso identificar seu cadastro. Chamarei o atendente.", escalar: true };
      const simples = String(cliente.tributacao ?? "").toLowerCase().includes("simples");
      if (!simples) return { matched: true, intent, resposta: `Sua empresa não está no Simples Nacional${saud}. Quer falar sobre tributação? Chamarei o atendente.`, escalar: true };
      return { matched: true, intent, resposta: `${saud ? "Olá" + saud : "Olá"}! O DAS do Simples vence dia 20. Nossa equipe gera e te envia até 5 dias antes. Precisa de 2ª via urgente? Digite *atendente*.` };
    }

    case "certidao":
      return {
        matched: true, intent,
        resposta: `Para baixar sua Certidão Negativa de Débitos${saud}:\n\n1. Acesse https://solucoes.receita.fazenda.gov.br/servicos/certidaointernet\n2. Informe seu CNPJ\n3. Baixe a certidão válida por 180 dias\n\nSe tiver pendência, nosso time resolve. Responda *atendente*.`,
      };

    case "financeiro": {
      if (!cliente) return { matched: true, intent, resposta: "Para ver suas pendências, preciso identificar seu cadastro. Chamando atendente!", escalar: true };
      const total = (cliente.cobrancas ?? []).reduce((a: number, c: any) => a + Number(c.valor), 0);
      if (total === 0) return { matched: true, intent, resposta: `Tudo em dia${saud}! 💚 Zero pendências na Cestacorp.` };
      return { matched: true, intent, resposta: `Você tem ${cliente.cobrancas.length} cobrança(s) em aberto totalizando *${formatMoney(total)}*.\n\nDigite *boleto* para a 2ª via ou *atendente* para negociar.` };
    }

    case "humano":
      return { matched: true, intent, resposta: "Encaminhando para um atendente… 👤\nEm breve alguém da Cestacorp vai te responder por aqui.", escalar: true };

    case "agradecimento":
      return { matched: true, intent, resposta: "Precisando é só chamar! 💙💚" };

    default:
      return { matched: false };
  }
}
