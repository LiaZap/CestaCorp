/**
 * Integração Autentique — assinatura digital de documentos.
 *
 * API GraphQL v2: https://api.autentique.com.br/v2/graphql
 * Docs:           https://docs.autentique.com.br
 *
 * Modos:
 *   - Produção:  AUTENTIQUE_TOKEN configurado e AUTENTIQUE_SANDBOX=false
 *   - Sandbox:   AUTENTIQUE_TOKEN configurado e AUTENTIQUE_SANDBOX=true
 *   - Mock:      AUTENTIQUE_TOKEN ausente — gera ID fake, útil pra dev
 *
 * Operações cobertas:
 *   - createDocument(arquivo PDF + signatários) → upload de PDF e envio
 *   - getDocument(id)                            → status atual
 *   - listDocuments({ folder, limit })           → busca por pasta
 *   - resendSignatures(documentId, signerEmails) → reenviar email de assinatura
 *   - deleteDocument(id)                          → deletar
 *
 * O upload usa multipart/form-data porque a API GraphQL aceita arquivo via
 * extensão "graphql-multipart-request-spec".
 */

const ENDPOINT = "https://api.autentique.com.br/v2/graphql";
const SANDBOX_ENDPOINT = "https://api.autentique.com.br/v2/graphql"; // mesmo endpoint, comportamento é definido pelo token "sandbox"

export interface AutentiqueConfig {
  enabled: boolean;
  mock: boolean;
  token: string;
  endpoint: string;
}

export function getAutentiqueConfig(): AutentiqueConfig {
  const token = process.env.AUTENTIQUE_TOKEN ?? "";
  const sandbox = process.env.AUTENTIQUE_SANDBOX === "true";
  return {
    enabled: Boolean(token),
    mock: !token,
    token,
    endpoint: sandbox ? SANDBOX_ENDPOINT : ENDPOINT,
  };
}

export interface AutentiqueSigner {
  email: string;
  name?: string;
  /**
   * Ação na assinatura. Default "SIGN".
   * Outros valores aceitos: "APPROVE", "RECOGNIZE", "WITNESS", "ENDORSE", "ACKNOWLEDGE", "RECEIPT"
   */
  action?: "SIGN" | "APPROVE" | "RECOGNIZE" | "WITNESS" | "ACKNOWLEDGE" | "RECEIPT";
  /**
   * Sócio também pode preencher "positions" (onde no doc) — não usado por padrão.
   */
}

export interface AutentiqueCreateInput {
  /** Nome do documento na Autentique. Aparece pro signatário no email. */
  name: string;
  /** Buffer ou Uint8Array do PDF. */
  pdf: Buffer | Uint8Array;
  /** Nome do arquivo (com .pdf) que aparece pro signatário. */
  filename: string;
  /** Lista de signatários. Cada um recebe email com link único. */
  signers: AutentiqueSigner[];
  /** Pasta na Autentique pra organizar (cria se não existir). Opcional. */
  folder?: string;
  /** Mensagem custom na assinatura. Opcional. */
  message?: string;
}

export interface AutentiqueDocument {
  id: string;
  name: string;
  refusable: boolean;
  sortable: boolean;
  created_at: string;
  signatures: {
    public_id: string;
    name: string;
    email: string;
    created_at: string;
    action: { name: string };
    link: { short_link: string } | null;
    user?: {
      id: string;
      email: string;
      name: string;
    };
    viewed?: { created_at: string } | null;
    signed?: { created_at: string } | null;
    rejected?: { created_at: string } | null;
  }[];
  files?: {
    original?: string;
    signed?: string;
    pades?: string;
  };
}

class AutentiqueError extends Error {
  status?: number;
  graphqlErrors?: any[];
  constructor(message: string, opts?: { status?: number; graphqlErrors?: any[] }) {
    super(message);
    this.name = "AutentiqueError";
    this.status = opts?.status;
    this.graphqlErrors = opts?.graphqlErrors;
  }
}

/**
 * Faz uma request GraphQL simples (sem upload de arquivo).
 */
async function gql(query: string, variables: Record<string, any> = {}): Promise<any> {
  const cfg = getAutentiqueConfig();
  if (!cfg.enabled) throw new AutentiqueError("AUTENTIQUE_TOKEN não configurado");

  const r = await fetch(cfg.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new AutentiqueError(`Autentique HTTP ${r.status}`, {
      status: r.status,
      graphqlErrors: [{ raw: txt.slice(0, 500) }],
    });
  }

  const j: any = await r.json();
  if (j.errors?.length) {
    const msg = j.errors.map((e: any) => e.message).join("; ");
    throw new AutentiqueError(`Autentique GraphQL: ${msg}`, { graphqlErrors: j.errors });
  }
  return j.data;
}

/**
 * Cria um documento na Autentique enviando o PDF.
 * Usa multipart/form-data conforme spec graphql-multipart-request-spec.
 */
export async function createDocument(input: AutentiqueCreateInput): Promise<AutentiqueDocument> {
  const cfg = getAutentiqueConfig();
  if (cfg.mock) {
    // mock pra dev sem token
    return {
      id: `mock-${Date.now()}`,
      name: input.name,
      refusable: true,
      sortable: false,
      created_at: new Date().toISOString(),
      signatures: input.signers.map((s, i) => ({
        public_id: `sig-${i}`,
        name: s.name ?? s.email,
        email: s.email,
        created_at: new Date().toISOString(),
        action: { name: s.action ?? "SIGN" },
        link: { short_link: `https://autentique.test/mock/sig-${i}` },
      })),
    };
  }

  const query = `
    mutation CreateDocumentMutation(
      $document: DocumentInput!,
      $signers: [SignerInput!]!,
      $file: Upload!
    ) {
      createDocument(document: $document, signers: $signers, file: $file) {
        id
        name
        refusable
        sortable
        created_at
        signatures {
          public_id
          name
          email
          created_at
          action { name }
          link { short_link }
        }
      }
    }
  `;

  const variables = {
    document: {
      name: input.name,
      ...(input.message ? { message: input.message } : {}),
      ...(input.folder ? { folder: input.folder } : {}),
    },
    signers: input.signers.map((s) => ({
      email: s.email,
      action: s.action ?? "SIGN",
      ...(s.name ? { name: s.name } : {}),
    })),
    file: null,
  };

  // Spec: graphql-multipart-request-spec
  const operations = JSON.stringify({ query, variables });
  const map = JSON.stringify({ "0": ["variables.file"] });

  const form = new FormData();
  form.append("operations", operations);
  form.append("map", map);

  const blob = new Blob([new Uint8Array(input.pdf)], { type: "application/pdf" });
  form.append("0", blob, input.filename);

  const r = await fetch(cfg.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      // NÃO setar Content-Type — o fetch adiciona boundary automaticamente pra FormData
    },
    body: form,
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new AutentiqueError(`Autentique HTTP ${r.status} ao criar documento`, {
      status: r.status,
      graphqlErrors: [{ raw: txt.slice(0, 500) }],
    });
  }

  const j: any = await r.json();
  if (j.errors?.length) {
    const msg = j.errors.map((e: any) => e.message).join("; ");
    throw new AutentiqueError(`Autentique GraphQL: ${msg}`, { graphqlErrors: j.errors });
  }

  return j.data.createDocument;
}

/**
 * Busca status de um documento pelo ID.
 */
export async function getDocument(id: string): Promise<AutentiqueDocument | null> {
  const cfg = getAutentiqueConfig();
  if (cfg.mock) {
    return null;
  }
  const data = await gql(
    `
    query GetDocument($id: UUID!) {
      document(id: $id) {
        id
        name
        refusable
        sortable
        created_at
        signatures {
          public_id
          name
          email
          created_at
          action { name }
          link { short_link }
          viewed { created_at }
          signed { created_at }
          rejected { created_at }
        }
        files {
          original
          signed
          pades
        }
      }
    }
  `,
    { id }
  );
  return data.document;
}

/**
 * Lista documentos por pasta (ou todos se não passar folder).
 */
export async function listDocuments(opts?: { folder?: string; limit?: number; page?: number }) {
  const cfg = getAutentiqueConfig();
  if (cfg.mock) return [];
  const data = await gql(
    `
    query ListDocuments($limit: Int!, $page: Int!) {
      documents(limit: $limit, page: $page) {
        data {
          id
          name
          created_at
          signatures {
            email
            signed { created_at }
            rejected { created_at }
          }
        }
      }
    }
  `,
    { limit: opts?.limit ?? 50, page: opts?.page ?? 1 }
  );
  return data.documents.data;
}

/**
 * Reenvia email de assinatura para signatários específicos.
 */
export async function resendSignatures(documentId: string, signerEmails: string[]): Promise<boolean> {
  const cfg = getAutentiqueConfig();
  if (cfg.mock) return true;
  const data = await gql(
    `
    mutation ResendSignatures($id: UUID!, $emails: [String!]!) {
      resendSignatures(public_ids_or_emails: $emails, document_id: $id)
    }
  `,
    { id: documentId, emails: signerEmails }
  );
  return Boolean(data.resendSignatures);
}

/**
 * Deleta um documento (cuidado — remove da Autentique).
 */
export async function deleteDocument(id: string): Promise<boolean> {
  const cfg = getAutentiqueConfig();
  if (cfg.mock) return true;
  const data = await gql(
    `
    mutation DeleteDocument($id: UUID!) {
      deleteDocument(id: $id)
    }
  `,
    { id }
  );
  return Boolean(data.deleteDocument);
}

/**
 * Resumo derivado: status agregado do documento.
 * - "pendente": ninguém assinou ainda
 * - "parcial":  alguém assinou, falta gente
 * - "assinado": todos assinaram
 * - "rejeitado": pelo menos 1 rejeitou
 */
export function calcularStatus(doc: AutentiqueDocument): "pendente" | "parcial" | "assinado" | "rejeitado" {
  const sigs = doc.signatures ?? [];
  if (sigs.some((s) => s.rejected)) return "rejeitado";
  if (sigs.length === 0) return "pendente";
  const assinados = sigs.filter((s) => s.signed).length;
  if (assinados === 0) return "pendente";
  if (assinados < sigs.length) return "parcial";
  return "assinado";
}
