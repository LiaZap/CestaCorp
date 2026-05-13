/**
 * IA de melhor horário por cliente.
 * Analisa histórico de mensagens enviadas e lidas/respondidas pra recomendar
 * quando mandar para ESTE cliente específico ter mais chance de leitura.
 *
 * Heurística simples (não precisa de ML):
 *   1. Últimas 30 mensagens enviadas para o cliente
 *   2. Pontua horas que tiveram LIDA ou RECEBIDO (cliente respondeu)
 *   3. Retorna top 3 slots com score
 *   4. Se não houver histórico suficiente, usa heatmap global
 */

import { connectMongo } from "@/lib/db/mongo";
import { MessageLogModel } from "@/models/MessageLog";

export interface Slot {
  diaSemana: number; // 0=dom, 6=sáb
  hora: number;      // 0-23
  score: number;     // quanto maior, melhor
  amostras: number;
  conversoes: number; // LIDA ou resposta recebida
}

const DIAS_LABEL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export async function getMelhorHorarioPorCliente(clienteId: string): Promise<{
  recomendados: Slot[];
  temDadosSuficientes: boolean;
  total: number;
  explicacao: string;
}> {
  await connectMongo();
  const logs = await MessageLogModel.find({
    clienteId,
    canal: "WHATSAPP",
  })
    .sort({ createdAt: -1 })
    .limit(60)
    .lean();

  const enviadas = logs.filter((l: any) => l.direcao === "OUT");
  if (enviadas.length < 3) {
    return {
      recomendados: [],
      temDadosSuficientes: false,
      total: enviadas.length,
      explicacao: "Poucas mensagens enviadas. Vai usar janela padrão 09h-11h terça-quarta.",
    };
  }

  // Monta mapa (dia, hora) => stats
  const slots = new Map<string, Slot>();

  for (const m of enviadas as any[]) {
    const d = new Date(m.createdAt);
    const diaSemana = d.getDay();
    const hora = d.getHours();
    const key = `${diaSemana}-${hora}`;

    if (!slots.has(key)) {
      slots.set(key, { diaSemana, hora, score: 0, amostras: 0, conversoes: 0 });
    }
    const slot = slots.get(key)!;
    slot.amostras++;
    if (m.status === "LIDA" || m.status === "ENTREGUE") slot.score += 2;
    if (m.status === "LIDA") slot.conversoes++;
  }

  // Procura respostas do cliente (direcao IN) e pontua os slots das mensagens enviadas antes
  const respostas = logs.filter((l: any) => l.direcao === "IN");
  for (const resp of respostas as any[]) {
    const respDate = new Date(resp.createdAt);
    // Encontra última mensagem enviada ANTES desta resposta (proxy para "gerou engajamento")
    const anterior = enviadas.find((e: any) => new Date(e.createdAt) < respDate);
    if (!anterior) continue;
    const d = new Date((anterior as any).createdAt);
    const key = `${d.getDay()}-${d.getHours()}`;
    if (slots.has(key)) {
      const slot = slots.get(key)!;
      slot.score += 5;
      slot.conversoes++;
    }
  }

  const recomendados = Array.from(slots.values())
    .sort((a, b) => b.score - a.score || b.amostras - a.amostras)
    .slice(0, 3);

  const top = recomendados[0];
  const explicacao = top
    ? `Melhor chance de leitura: ${DIAS_LABEL[top.diaSemana]} às ${top.hora}h (${top.conversoes} conversões em ${top.amostras} tentativas).`
    : "Sem padrão claro ainda — mande quando fizer sentido comercialmente.";

  return {
    recomendados,
    temDadosSuficientes: true,
    total: enviadas.length,
    explicacao,
  };
}

export function slotLabel(s: Slot): string {
  return `${DIAS_LABEL[s.diaSemana]} ${s.hora}h`;
}
