import axios, { AxiosInstance } from "axios";

/**
 * Integração com DIGISAC / HUBLX.
 * Base URL do tenant Cestacorp: https://cestacorp.hublx.app/api/v1
 * Autenticação: Bearer token (configurado em DIGISAC_TOKEN).
 *
 * Usos:
 *  - enviar mensagens de WhatsApp (régua de cobrança, notificações)
 *  - criar/atualizar contatos
 *  - listar/atribuir tags (para relatórios e segmentações)
 *  - receber webhooks de mensagens recebidas
 */

const baseURL = process.env.DIGISAC_API_URL || "https://cestacorp.hublx.app/api/v1";
const token = process.env.DIGISAC_TOKEN || "";
const defaultServiceId = process.env.DIGISAC_SERVICE_ID || "";

let client: AxiosInstance | null = null;
function http() {
  if (!client) {
    client = axios.create({
      baseURL,
      timeout: 20_000,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }
  return client;
}

// ---- Tipos ----
export interface DigisacContact {
  id: string;
  name: string;
  number: string;    // E.164 ou formato esperado pela API
  email?: string;
  tags?: Array<{ id: string; name: string }>;
}

export interface EnviarMensagemParams {
  contactId?: string;
  number?: string;      // se não houver contactId, enviamos por número
  text: string;
  serviceId?: string;   // canal/serviço WhatsApp (se houver múltiplos)
  userId?: string;      // atendente (opcional)
  origin?: "bot" | "user";
}

// ---- Contatos ----
export async function listarContatos(params?: { term?: string; page?: number; limit?: number }) {
  const { data } = await http().get("/contacts", { params });
  return data as { data: DigisacContact[]; total: number };
}

export async function obterContato(id: string) {
  const { data } = await http().get<DigisacContact>(`/contacts/${id}`);
  return data;
}

export async function upsertContato(payload: {
  name: string;
  number: string;
  email?: string;
  tags?: string[];
}) {
  const { data } = await http().post<DigisacContact>("/contacts", payload);
  return data;
}

// ---- Tags ----
export async function listarTags() {
  const { data } = await http().get("/tags");
  return data as { data: Array<{ id: string; name: string }> };
}

export async function atribuirTag(contactId: string, tagId: string) {
  const { data } = await http().post(`/contacts/${contactId}/tags/${tagId}`);
  return data;
}

export async function removerTag(contactId: string, tagId: string) {
  const { data } = await http().delete(`/contacts/${contactId}/tags/${tagId}`);
  return data;
}

// ---- Envio de mensagem ----
export async function enviarMensagem(params: EnviarMensagemParams) {
  const payload = {
    text: params.text,
    contactId: params.contactId,
    number: params.number,
    serviceId: params.serviceId || defaultServiceId || undefined,
    userId: params.userId,
    origin: params.origin || "bot",
  };
  const { data } = await http().post("/messages", payload);
  return data as { id: string; status?: string };
}

export async function enviarArquivo(params: {
  contactId?: string;
  number?: string;
  fileUrl: string;
  caption?: string;
  serviceId?: string;
}) {
  const { data } = await http().post("/messages", {
    contactId: params.contactId,
    number: params.number,
    file: { url: params.fileUrl },
    text: params.caption,
    serviceId: params.serviceId || defaultServiceId || undefined,
  });
  return data as { id: string };
}

// ---- Webhook util ----
export function extrairEventoWebhook(body: any): {
  tipo: "message" | "status" | "unknown";
  payload: any;
} {
  if (body?.event === "message.created" || body?.type === "message") {
    return { tipo: "message", payload: body };
  }
  if (body?.event?.startsWith?.("message.status")) {
    return { tipo: "status", payload: body };
  }
  return { tipo: "unknown", payload: body };
}
