import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { prisma } from "@/lib/db/prisma";

/**
 * Gera contrato .docx a partir de template + dados do cliente.
 *
 * Placeholders suportados:
 *   {razaoSocial} {cnpj} {endereco} {socios} {sociosAssinantes}
 *   {valorHonorariosAtual}  ← buscado do NIBO/Honorario, vigente NESTE momento
 *   {valorHonorariosOriginal}  ← valor histórico do contrato anterior
 *   {dataAssinatura} {mesAniversario} {indiceReajuste} {objeto}
 *   {clausulaComplementar}  ← inserida na hora da geração (negociada pelo comercial)
 *   {anexos}  ← lista de nomes dos anexos vinculados
 *
 * Anexos são adicionados ao FIM do documento — o template precisa ter um placeholder
 * `{anexos_conteudo}` ou similar, ou então o gerador concatena os .docx (limitação:
 * Docxtemplater não suporta merge nativo, então por ora colocamos só os NOMES).
 */
export interface GerarContratoOpts {
  clienteId: string;
  templateId: string;
  outputDir?: string;
  /** Cláusula extra negociada pelo comercial */
  clausulaComplementar?: string;
  /** IDs dos anexos a vincular. Default: anexos auto-aplicáveis pelas tags do cliente. */
  anexoIds?: string[];
  /** Sobrescreve valor padrão buscado do NIBO/Honorario */
  valorHonorariosOverride?: number;
  /** Marca contrato como EMITIDO ao invés de RASCUNHO */
  emitir?: boolean;
}

export async function gerarContratoDocx(args: GerarContratoOpts): Promise<{
  docxPath: string;
  contratoId: string;
  valorUsado: number;
  anexosVinculados: string[];
}> {
  const template = await prisma.contratoTemplate.findUnique({ where: { id: args.templateId } });
  if (!template) throw new Error("Template não encontrado");

  const cliente = await prisma.cliente.findUnique({
    where: { id: args.clienteId },
    include: {
      socios: true,
      emails: true,
      telefones: true,
      tags: { include: { tag: true } },
    },
  });
  if (!cliente) throw new Error("Cliente não encontrado");

  // ===== valor atual (NIBO/Honorario) vs valor original =====
  let valorAtual = args.valorHonorariosOverride ?? 0;
  if (!args.valorHonorariosOverride) {
    // Pega último Honorario ativo deste cliente (representa o valor atual do contrato)
    const honAtual = await prisma.honorario.findFirst({
      where: { clienteId: cliente.id, status: { not: "CANCELADO" } },
      orderBy: { vencimento: "desc" },
    });
    if (honAtual) valorAtual = Number(honAtual.valor);
  }

  // Valor do contrato original (mais antigo)
  const honOriginal = await prisma.honorario.findFirst({
    where: { clienteId: cliente.id },
    orderBy: { vencimento: "asc" },
  });
  const valorOriginal = honOriginal ? Number(honOriginal.valor) : valorAtual;

  // ===== sócios =====
  const todosSocios = cliente.socios
    .map((s) => `${s.nome} (CPF ${s.cpf})`)
    .join("; ");
  const sociosAssinantesArr = cliente.socios
    .filter((s) => s.assinante)
    .map((s) => `${s.nome} (CPF ${s.cpf})`);
  const sociosAssinantes = sociosAssinantesArr.length > 0
    ? sociosAssinantesArr.join("; ")
    : todosSocios;

  // ===== resolver anexos =====
  const slugsCliente = cliente.tags.map((ct) => ct.tag.slug);
  let anexosFinais: string[] = args.anexoIds ?? [];

  if (!args.anexoIds) {
    // Se não passou explicitamente, busca anexos auto-aplicáveis pelas tags
    const auto = await prisma.contratoAnexo.findMany({
      where: {
        ativo: true,
        autoAplicarTags: { hasSome: slugsCliente },
      },
      orderBy: { ordem: "asc" },
    });
    anexosFinais = auto.map((a) => a.id);
  }

  const anexos = anexosFinais.length > 0
    ? await prisma.contratoAnexo.findMany({
        where: { id: { in: anexosFinais } },
        orderBy: { ordem: "asc" },
      })
    : [];
  const anexosNomes = anexos.map((a) => a.nome).join("; ");

  // ===== render template =====
  const content = fs.readFileSync(template.arquivoDocx, "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  // Endereço pro mail merge (#27): se temos os campos estruturados, monta
  // string formatada padrão pra placeholder único {endereco}. Mantém compat
  // com `cliente.endereco` Json legado vindo da V106. Também expõe os campos
  // separados em {enderecoLogradouro} etc. pra templates que querem detalhar.
  const c = cliente as any;
  const partesEndereco: string[] = [];
  if (c.enderecoLogradouro) {
    let l = String(c.enderecoLogradouro);
    if (c.enderecoNumero) l += `, ${c.enderecoNumero}`;
    if (c.enderecoComplemento) l += ` — ${c.enderecoComplemento}`;
    partesEndereco.push(l);
  }
  if (c.enderecoBairro) partesEndereco.push(String(c.enderecoBairro));
  if (c.enderecoMunicipio || c.enderecoUf) {
    partesEndereco.push(
      [c.enderecoMunicipio, c.enderecoUf].filter(Boolean).join("/")
    );
  }
  if (c.enderecoCep) partesEndereco.push(`CEP ${c.enderecoCep}`);
  const enderecoFormatado = partesEndereco.length > 0
    ? partesEndereco.join(" · ")
    : (typeof cliente.endereco === "string" ? cliente.endereco : "");

  doc.render({
    razaoSocial: cliente.razaoSocial,
    nomeFantasia: cliente.nomeFantasia ?? "",
    cnpj: cliente.cpfCnpj,
    endereco: enderecoFormatado,
    enderecoLogradouro: c.enderecoLogradouro ?? "",
    enderecoNumero: c.enderecoNumero ?? "",
    enderecoComplemento: c.enderecoComplemento ?? "",
    enderecoBairro: c.enderecoBairro ?? "",
    enderecoMunicipio: c.enderecoMunicipio ?? "",
    enderecoUf: c.enderecoUf ?? "",
    enderecoCep: c.enderecoCep ?? "",
    socios: todosSocios,
    sociosAssinantes,
    email: cliente.emails[0]?.email ?? "",
    telefone: cliente.telefones[0]?.numero ?? "",
    mesAniversario: cliente.mesAniversarioReajuste ?? "",
    indiceReajuste: cliente.indiceReajuste ?? "IPCA",
    dataAssinatura: new Date().toLocaleDateString("pt-BR"),

    // Valores (compat retroativo com {valorHonorarios})
    valorHonorarios: formatMoney(valorAtual),
    valorHonorariosAtual: formatMoney(valorAtual),
    valorHonorariosOriginal: formatMoney(valorOriginal),

    // Cláusula extra
    clausulaComplementar: args.clausulaComplementar ?? "",

    // Anexos (lista de nomes, plug-in de mail merge real fica pra fase 2)
    anexos: anexosNomes,
  });

  const buf = doc.getZip().generate({ type: "nodebuffer" });
  const outputDir = args.outputDir || path.join(process.cwd(), "uploads", "contratos");
  fs.mkdirSync(outputDir, { recursive: true });
  const fileName = `contrato-${cliente.cpfCnpj.replace(/\D/g, "")}-${Date.now()}.docx`;
  const fullPath = path.join(outputDir, fileName);
  fs.writeFileSync(fullPath, buf);

  const contrato = await prisma.contrato.create({
    data: {
      clienteId: cliente.id,
      templateId: template.id,
      tipo: template.tipo,
      status: args.emitir ? "EMITIDO" : "RASCUNHO",
      mesAniversario: cliente.mesAniversarioReajuste ?? undefined,
      indiceReajuste: cliente.indiceReajuste ?? "IPCA",
      docxPath: fullPath,
      valorHonorarios: valorAtual,
      clausulaComplementar: args.clausulaComplementar ?? null,
      anexos: {
        create: anexos.map((a, i) => ({ anexoId: a.id, ordem: i })),
      },
    },
  });

  return {
    docxPath: fullPath,
    contratoId: contrato.id,
    valorUsado: valorAtual,
    anexosVinculados: anexos.map((a) => a.nome),
  };
}

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Geração em LOTE — para o caso "atualizar todos contratos pra LGPD".
 * Patrick (24/04/2026): "preciso selecionar todos que eu quero gerar e ele já gera no novo formato".
 *
 * Idempotente: se um cliente já tem contrato vigente do template alvo, pula (a menos que `forçar` = true).
 */
export async function gerarContratosEmLote(opts: {
  templateId: string;
  clienteIds: string[];
  forcar?: boolean;        // gera mesmo que cliente já tenha contrato deste template
  emitir?: boolean;        // marca como EMITIDO em vez de RASCUNHO
  clausulaPorCliente?: Record<string, string>; // cláusula complementar por cliente (opcional)
}): Promise<{
  total: number;
  gerados: number;
  pulados: number;
  erros: number;
  resultados: { clienteId: string; ok: boolean; contratoId?: string; valor?: number; anexos?: string[]; motivo?: string }[];
}> {
  const resultados: any[] = [];
  let gerados = 0, pulados = 0, erros = 0;

  for (const clienteId of opts.clienteIds) {
    try {
      // Verifica se já existe contrato vigente deste template (idempotência)
      if (!opts.forcar) {
        const existente = await prisma.contrato.findFirst({
          where: {
            clienteId,
            templateId: opts.templateId,
            status: { in: ["EMITIDO", "ASSINADO"] },
          },
        });
        if (existente) {
          pulados++;
          resultados.push({
            clienteId, ok: true, contratoId: existente.id,
            motivo: "já tem contrato deste template",
          });
          continue;
        }
      }

      const r = await gerarContratoDocx({
        clienteId,
        templateId: opts.templateId,
        emitir: opts.emitir ?? true,
        clausulaComplementar: opts.clausulaPorCliente?.[clienteId],
      });
      gerados++;
      resultados.push({
        clienteId, ok: true,
        contratoId: r.contratoId,
        valor: r.valorUsado,
        anexos: r.anexosVinculados,
      });
    } catch (err: any) {
      erros++;
      resultados.push({
        clienteId, ok: false,
        motivo: String(err?.message ?? err).slice(0, 200),
      });
    }
  }

  return { total: opts.clienteIds.length, gerados, pulados, erros, resultados };
}
