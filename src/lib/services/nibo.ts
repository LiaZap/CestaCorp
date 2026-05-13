import axios, { AxiosInstance } from "axios";

/**
 * Integração com NIBO — sistema financeiro.
 * Docs: https://api.nibo.com.br/docs (base URL pode variar por tenant).
 *
 * Autenticação: header `apitoken` com o token da conta.
 * Principais usos na Cestacorp:
 *  - listar contas a receber / boletos / faturas de clientes
 *  - consultar status de pagamento (para a régua de cobrança)
 *  - criar/atualizar cliente (customer) no NIBO
 *
 * Se algum endpoint diferir da sua conta, ajustar em um único lugar (este arquivo).
 */

const baseURL = process.env.NIBO_API_URL || "https://api.nibo.com.br/empresas/v1";
const token = process.env.NIBO_TOKEN || "";

let client: AxiosInstance | null = null;
function http() {
  if (!client) {
    client = axios.create({
      baseURL,
      timeout: 20_000,
      headers: {
        apitoken: token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }
  return client;
}

// ---- Tipos mínimos usados na régua ----
export interface NiboCustomer {
  id: string;
  name: string;
  document: { number: string; type: "CPF" | "CNPJ" };
  email?: string;
  phone?: string;
}

export interface NiboReceivable {
  id: string;               // guid NIBO
  stakeholderId: string;    // cliente
  description: string;
  value: number;
  dueDate: string;          // ISO date
  isPaid: boolean;
  paymentDate?: string;
  accrualDate?: string;
  reference?: string;
  billetUrl?: string;
  digitableLine?: string;
  pixCopyPaste?: string;
  categories?: Array<{ categoryId: string; value: number }>;
}

// ---- Clientes ----
export async function listarClientesNibo(params?: { search?: string; pageSize?: number }) {
  const { data } = await http().get("/customers", { params });
  return data as { items: NiboCustomer[]; count: number };
}

export async function obterClienteNibo(id: string) {
  const { data } = await http().get<NiboCustomer>(`/customers/${id}`);
  return data;
}

// ---- Contas a receber (boletos/cobranças) ----
export async function listarContasReceber(params?: {
  startDate?: string;   // YYYY-MM-DD
  endDate?: string;
  isPaid?: boolean;
  stakeholderId?: string; // filtra por cliente
  pageSize?: number;
}) {
  const { data } = await http().get("/schedules/credit", { params });
  return data as { items: NiboReceivable[]; count: number };
}

export async function obterContaReceber(id: string) {
  const { data } = await http().get<NiboReceivable>(`/schedules/credit/${id}`);
  return data;
}

export async function criarContaReceber(payload: {
  stakeholderId: string;
  description: string;
  value: number;
  dueDate: string;
  accrualDate?: string;
  reference?: string;
}) {
  const { data } = await http().post("/schedules/credit", payload);
  return data as NiboReceivable;
}

// ---- Helpers úteis para a régua ----
export async function listarVencendoHoje(iso: string) {
  return listarContasReceber({ startDate: iso, endDate: iso, isPaid: false });
}

export async function listarVencidosAteHoje(hojeIso: string, desdeIso: string) {
  return listarContasReceber({ startDate: desdeIso, endDate: hojeIso, isPaid: false });
}

// ---- Webhook (recebimento de pagamentos) ----
export function verificarAssinaturaWebhook(_rawBody: string, _signature: string) {
  // NIBO pode enviar assinatura HMAC; implementar quando configurar webhook na conta.
  return true;
}
