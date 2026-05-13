/**
 * Parser de XML de NF-e (layout oficial SEFAZ — modelo 55/NFe e 65/NFCe).
 *
 * Usa fast-xml-parser (parser XML de verdade, não regex), então aceita:
 *   - XMLs com ou sem namespace (xmlns)
 *   - NFe individual (<NFe>) e notas dentro de procNFe (<nfeProc><NFe>...)
 *   - Tags em qualquer ordem, CDATA, comentários, aspas simples/duplas
 */

import { XMLParser } from "fast-xml-parser";

export interface NFeParsed {
  chave: string;
  numero: string;
  serie?: string;
  modelo?: string;
  tipo: "entrada" | "saida";
  dataEmissao: Date;
  dataSaida?: Date;
  emitente: { cnpj: string; nome: string };
  destinatario?: { cnpjCpf?: string; nome?: string };
  valores: {
    total: number;
    produtos?: number;
    frete?: number;
    desconto?: number;
    icms?: number;
    ipi?: number;
    pis?: number;
    cofins?: number;
  };
  naturezaOp?: string;
  cfop?: string;
  itens: {
    ordem: number;
    codigo?: string;
    descricao: string;
    cfop?: string;
    ncm?: string;
    quantidade: number;
    unidade?: string;
    valorUnit: number;
    valorTotal: number;
    valorIcms?: number;
  }[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseAttributeValue: false,
  parseTagValue: false,
  ignoreDeclaration: true,
  removeNSPrefix: true,
});

function num(v: any): number {
  if (v === undefined || v === null || v === "") return 0;
  const s = String(v).replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v?: string): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function findInfNFe(root: any): any {
  const paths = [
    root?.nfeProc?.NFe?.infNFe,
    root?.NFe?.infNFe,
    root?.infNFe,
    root?.nfeProc?.infNFe,
  ];
  for (const p of paths) if (p) return p;
  function busca(obj: any): any {
    if (!obj || typeof obj !== "object") return null;
    if (obj.infNFe) return obj.infNFe;
    for (const k of Object.keys(obj)) {
      const r = busca(obj[k]);
      if (r) return r;
    }
    return null;
  }
  return busca(root);
}

export function parseNFe(xmlRaw: string | Buffer): NFeParsed {
  const xml = typeof xmlRaw === "string" ? xmlRaw : xmlRaw.toString("utf-8");
  const root = parser.parse(xml);

  const infNFe = findInfNFe(root);
  if (!infNFe) throw new Error("XML não parece ser uma NF-e válida (infNFe não encontrado)");

  let chave: string | undefined;
  const idAttr = infNFe["@_Id"] as string | undefined;
  if (idAttr) {
    const m = idAttr.match(/NFe(\d{44})/);
    if (m) chave = m[1];
  }
  if (!chave) {
    const chFromProt =
      root?.nfeProc?.protNFe?.infProt?.chNFe ??
      root?.protNFe?.infProt?.chNFe;
    if (chFromProt) chave = String(chFromProt);
  }
  if (!chave || chave.length !== 44) {
    throw new Error("Chave de acesso da NF-e não encontrada ou inválida");
  }

  const ide = infNFe.ide ?? {};
  const emit = infNFe.emit ?? {};
  const dest = infNFe.dest ?? null;
  const total = infNFe.total ?? {};
  const icmsTot = total.ICMSTot ?? {};

  const numero = String(ide.nNF ?? "");
  const serie = ide.serie ? String(ide.serie) : undefined;
  const modelo = ide.mod ? String(ide.mod) : undefined;
  const tpNF = String(ide.tpNF ?? "");
  const naturezaOp = ide.natOp ? String(ide.natOp) : undefined;
  const dhEmi = ide.dhEmi ?? ide.dEmi;
  const dhSaiEnt = ide.dhSaiEnt ?? ide.dSaiEnt;

  const emitenteCnpj = String(emit.CNPJ ?? emit.CPF ?? "");
  const emitenteNome = String(emit.xNome ?? emit.xFant ?? "");
  if (!emitenteCnpj) throw new Error("CNPJ/CPF do emitente não encontrado");
  if (!emitenteNome) throw new Error("Nome do emitente não encontrado");

  const destCnpjCpf = dest ? (dest.CNPJ ?? dest.CPF ?? dest.idEstrangeiro) : undefined;
  const destNome = dest?.xNome ? String(dest.xNome) : undefined;

  const detArr = toArray(infNFe.det);
  const itens = detArr.map((det: any, idx: number) => {
    const prod = det.prod ?? {};
    const imposto = det.imposto ?? {};
    const icms = imposto.ICMS ?? {};
    const icmsValor = (Object.values(icms)[0] as any) ?? {};

    const nItem = Number(det["@_nItem"] ?? idx + 1);
    return {
      ordem: nItem,
      codigo: prod.cProd ? String(prod.cProd) : undefined,
      descricao: String(prod.xProd ?? "(sem descrição)"),
      cfop: prod.CFOP ? String(prod.CFOP) : undefined,
      ncm: prod.NCM ? String(prod.NCM) : undefined,
      quantidade: num(prod.qCom),
      unidade: prod.uCom ? String(prod.uCom) : undefined,
      valorUnit: num(prod.vUnCom),
      valorTotal: num(prod.vProd),
      valorIcms: num(icmsValor.vICMS),
    };
  });

  const primeiroCfop = itens[0]?.cfop;

  return {
    chave,
    numero,
    serie,
    modelo,
    tipo: tpNF === "1" ? "saida" : "entrada",
    dataEmissao: parseDate(dhEmi) ?? new Date(),
    dataSaida: parseDate(dhSaiEnt),
    emitente: { cnpj: emitenteCnpj, nome: emitenteNome },
    destinatario: destCnpjCpf ? { cnpjCpf: String(destCnpjCpf), nome: destNome } : undefined,
    valores: {
      total: num(icmsTot.vNF),
      produtos: num(icmsTot.vProd),
      frete: num(icmsTot.vFrete),
      desconto: num(icmsTot.vDesc),
      icms: num(icmsTot.vICMS),
      ipi: num(icmsTot.vIPI),
      pis: num(icmsTot.vPIS),
      cofins: num(icmsTot.vCOFINS),
    },
    naturezaOp,
    cfop: primeiroCfop,
    itens,
  };
}

export async function importarNFe(
  xmlRaw: string | Buffer,
  opts: { userId?: string; xmlPath?: string }
): Promise<{ criado: boolean; notaId: string; chave: string; clienteVinculado: boolean }> {
  const { prisma } = await import("@/lib/db/prisma");
  const parsed = parseNFe(xmlRaw);

  const existente = await prisma.notaFiscal.findUnique({ where: { chave: parsed.chave } });
  if (existente) {
    return {
      criado: false,
      notaId: existente.id,
      chave: parsed.chave,
      clienteVinculado: Boolean(existente.clienteId),
    };
  }

  const cpfCnpjs = [parsed.emitente.cnpj, parsed.destinatario?.cnpjCpf].filter(Boolean) as string[];
  const limpos = cpfCnpjs.map((d) => d.replace(/\D/g, ""));
  const clientes = await prisma.cliente.findMany({
    where: { cpfCnpj: { in: [...cpfCnpjs, ...limpos] } },
    select: { id: true, cpfCnpj: true },
  });
  const cliente = clientes[0];

  const nota = await prisma.notaFiscal.create({
    data: {
      chave: parsed.chave,
      numero: parsed.numero,
      serie: parsed.serie,
      modelo: parsed.modelo,
      tipo: parsed.tipo,
      dataEmissao: parsed.dataEmissao,
      dataSaida: parsed.dataSaida,
      emitenteCnpj: parsed.emitente.cnpj,
      emitenteNome: parsed.emitente.nome,
      destCnpjCpf: parsed.destinatario?.cnpjCpf,
      destNome: parsed.destinatario?.nome,
      valorTotal: parsed.valores.total,
      valorProdutos: parsed.valores.produtos,
      valorFrete: parsed.valores.frete,
      valorDesconto: parsed.valores.desconto,
      valorIcms: parsed.valores.icms,
      valorIpi: parsed.valores.ipi,
      valorPis: parsed.valores.pis,
      valorCofins: parsed.valores.cofins,
      naturezaOp: parsed.naturezaOp,
      cfop: parsed.cfop,
      xmlPath: opts.xmlPath,
      importadoPor: opts.userId,
      clienteId: cliente?.id,
      itens: {
        createMany: {
          data: parsed.itens.map((i) => ({
            ordem: i.ordem,
            codigo: i.codigo,
            descricao: i.descricao,
            cfop: i.cfop,
            ncm: i.ncm,
            quantidade: i.quantidade,
            unidade: i.unidade,
            valorUnit: i.valorUnit,
            valorTotal: i.valorTotal,
            valorIcms: i.valorIcms,
          })),
        },
      },
    },
  });

  return {
    criado: true,
    notaId: nota.id,
    chave: parsed.chave,
    clienteVinculado: Boolean(cliente),
  };
}
