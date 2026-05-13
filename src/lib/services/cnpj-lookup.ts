/**
 * Consulta de CNPJ na BrasilAPI (gratuita, sem token).
 * Fallback: ReceitaWS (também gratuita, com rate limit).
 *
 * Docs:
 *   - BrasilAPI: https://brasilapi.com.br/docs#tag/CNPJ
 *   - ReceitaWS: https://receitaws.com.br/api
 *
 * Resposta normalizada para o que precisamos no cadastro do cliente.
 */

export interface CnpjData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  dataAbertura?: string;          // ISO
  capitalSocial?: number;
  naturezaJuridica?: string;
  porte?: string;
  situacao?: string;              // ATIVA, BAIXADA, etc.
  cnaePrincipal?: { codigo: string; descricao: string };
  cnaesSecundarios?: { codigo: string; descricao: string }[];
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cep?: string;
    municipio?: string;
    uf?: string;
  };
  email?: string;
  telefone?: string;
  socios?: { nome: string; qualificacao?: string; cpfCnpj?: string }[];
  _fonte: "brasilapi" | "receitaws";
  _consultaEm: string;
}

function soDigitos(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

async function consultarBrasilApi(cnpjLimpo: string): Promise<CnpjData | null> {
  const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`;
  const r = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) {
    if (r.status === 404) return null;
    throw new Error(`BrasilAPI ${r.status}`);
  }
  const d: any = await r.json();

  return {
    cnpj: d.cnpj,
    razaoSocial: d.razao_social ?? "",
    nomeFantasia: d.nome_fantasia || undefined,
    dataAbertura: d.data_inicio_atividade,
    capitalSocial: d.capital_social ? Number(d.capital_social) : undefined,
    naturezaJuridica: d.natureza_juridica,
    porte: d.porte,
    situacao: d.descricao_situacao_cadastral,
    cnaePrincipal: d.cnae_fiscal
      ? { codigo: String(d.cnae_fiscal), descricao: d.cnae_fiscal_descricao ?? "" }
      : undefined,
    cnaesSecundarios: (d.cnaes_secundarios ?? []).map((c: any) => ({
      codigo: String(c.codigo),
      descricao: c.descricao ?? "",
    })),
    endereco: {
      logradouro: d.logradouro,
      numero: d.numero,
      complemento: d.complemento,
      bairro: d.bairro,
      cep: d.cep,
      municipio: d.municipio,
      uf: d.uf,
    },
    email: d.email,
    telefone: d.ddd_telefone_1,
    socios: (d.qsa ?? []).map((s: any) => ({
      nome: s.nome_socio,
      qualificacao: s.qualificacao_socio,
      cpfCnpj: s.cnpj_cpf_do_socio,
    })),
    _fonte: "brasilapi",
    _consultaEm: new Date().toISOString(),
  };
}

async function consultarReceitaWs(cnpjLimpo: string): Promise<CnpjData | null> {
  const url = `https://receitaws.com.br/v1/cnpj/${cnpjLimpo}`;
  const r = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) {
    if (r.status === 404) return null;
    throw new Error(`ReceitaWS ${r.status}`);
  }
  const d: any = await r.json();
  if (d.status === "ERROR") return null;

  return {
    cnpj: d.cnpj?.replace(/\D/g, ""),
    razaoSocial: d.nome ?? "",
    nomeFantasia: d.fantasia || undefined,
    dataAbertura: d.abertura ? d.abertura.split("/").reverse().join("-") : undefined,
    capitalSocial: d.capital_social ? Number(String(d.capital_social).replace(",", ".")) : undefined,
    naturezaJuridica: d.natureza_juridica,
    porte: d.porte,
    situacao: d.situacao,
    cnaePrincipal: d.atividade_principal?.[0]
      ? {
          codigo: String(d.atividade_principal[0].code).replace(/\D/g, ""),
          descricao: d.atividade_principal[0].text,
        }
      : undefined,
    cnaesSecundarios: (d.atividades_secundarias ?? []).map((c: any) => ({
      codigo: String(c.code).replace(/\D/g, ""),
      descricao: c.text,
    })),
    endereco: {
      logradouro: d.logradouro,
      numero: d.numero,
      complemento: d.complemento,
      bairro: d.bairro,
      cep: d.cep,
      municipio: d.municipio,
      uf: d.uf,
    },
    email: d.email,
    telefone: d.telefone,
    socios: (d.qsa ?? []).map((s: any) => ({
      nome: s.nome,
      qualificacao: s.qual,
    })),
    _fonte: "receitaws",
    _consultaEm: new Date().toISOString(),
  };
}

/**
 * Consulta com fallback: BrasilAPI primeiro, ReceitaWS se falhar.
 */
export async function consultarCnpj(cnpj: string): Promise<CnpjData> {
  const limpo = soDigitos(cnpj);
  if (limpo.length !== 14) throw new Error("CNPJ deve ter 14 dígitos");

  try {
    const r = await consultarBrasilApi(limpo);
    if (r) return r;
    throw new Error("CNPJ não encontrado na BrasilAPI");
  } catch (err: any) {
    // Fallback ReceitaWS
    try {
      const r = await consultarReceitaWs(limpo);
      if (r) return r;
      throw new Error("CNPJ não encontrado");
    } catch (err2: any) {
      throw new Error(
        `Consulta falhou: BrasilAPI=${String(err?.message ?? err)}, ReceitaWS=${String(err2?.message ?? err2)}`
      );
    }
  }
}
