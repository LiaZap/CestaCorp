/**
 * Seed de demonstração — popula o sistema com dados realistas.
 * Idempotente: limpa tabelas transacionais e recria do zero.
 *
 * Uso:
 *   npm run seed:demo
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { PrismaClient } from "@prisma/client";
import { addDays, subDays, subMonths, startOfMonth } from "date-fns";

const prisma = new PrismaClient();

// ============================================================
// Dados fixos do mock
// ============================================================
const EMPRESAS = [
  { razao: "Luciano Fraga Biachi LTDA", fantasia: "Fraga Biachi", cnpj: "07.784.052/0001-45", trib: "Lucro Presumido - Serviço" },
  { razao: "Construtora Porto Alegre ME", fantasia: "PoA Constrói", cnpj: "12.345.678/0001-90", trib: "Simples Nacional" },
  { razao: "Farmácia Boa Saúde LTDA", fantasia: "Boa Saúde", cnpj: "23.456.789/0001-01", trib: "Simples Nacional" },
  { razao: "TechNova Soluções em TI LTDA", fantasia: "TechNova", cnpj: "34.567.890/0001-12", trib: "Lucro Presumido - Serviço" },
  { razao: "Padaria do Bairro ME", fantasia: "Padaria do Bairro", cnpj: "45.678.901/0001-23", trib: "Simples Nacional" },
  { razao: "Advocacia Silva & Associados SS", fantasia: "Silva Advogados", cnpj: "56.789.012/0001-34", trib: "Lucro Presumido - Serviço" },
  { razao: "Clínica Vida Saudável LTDA", fantasia: "Vida Saudável", cnpj: "67.890.123/0001-45", trib: "Lucro Presumido - Serviço" },
  { razao: "Auto Peças Garra ME", fantasia: "Garra Auto Peças", cnpj: "78.901.234/0001-56", trib: "Simples Nacional" },
  { razao: "Restaurante Sabor Gaúcho LTDA", fantasia: "Sabor Gaúcho", cnpj: "89.012.345/0001-67", trib: "Simples Nacional" },
  { razao: "Mercado Central Sul LTDA", fantasia: "Central Sul", cnpj: "90.123.456/0001-78", trib: "Lucro Presumido - Comércio" },
  { razao: "Academia Força Total ME", fantasia: "Força Total", cnpj: "11.234.567/0001-89", trib: "Simples Nacional" },
  { razao: "Salão Beleza Pura LTDA", fantasia: "Beleza Pura", cnpj: "22.345.678/0001-90", trib: "Simples Nacional" },
  { razao: "Distribuidora Sul Bebidas LTDA", fantasia: "Sul Bebidas", cnpj: "33.456.789/0001-01", trib: "Lucro Presumido - Comércio" },
  { razao: "Escola Recanto Criança ME", fantasia: "Recanto Criança", cnpj: "44.567.890/0001-12", trib: "Simples Nacional" },
  { razao: "Pet Shop Amigo Fiel LTDA", fantasia: "Amigo Fiel", cnpj: "55.678.901/0001-23", trib: "Simples Nacional" },
  { razao: "Contabilidade & Consultoria Norte LTDA", fantasia: "Norte Contábil", cnpj: "66.789.012/0001-34", trib: "Lucro Presumido - Serviço" },
  { razao: "Imobiliária Lar Doce Lar ME", fantasia: "Lar Doce Lar", cnpj: "77.890.123/0001-45", trib: "Simples Nacional" },
  { razao: "Transportadora Expresso RS LTDA", fantasia: "Expresso RS", cnpj: "88.901.234/0001-56", trib: "Lucro Presumido - Serviço" },
  { razao: "Confeitaria Doce Tentação ME", fantasia: "Doce Tentação", cnpj: "99.012.345/0001-67", trib: "Simples Nacional" },
  { razao: "Estúdio Fotografia Luz & Arte ME", fantasia: "Luz & Arte", cnpj: "10.123.456/0001-78", trib: "Simples Nacional" },
  { razao: "Oficina Mecânica Motor Forte LTDA", fantasia: "Motor Forte", cnpj: "21.234.567/0001-89", trib: "Simples Nacional" },
  { razao: "Floricultura Jardim Encantado ME", fantasia: "Jardim Encantado", cnpj: "32.345.678/0001-90", trib: "Simples Nacional" },
  { razao: "Consultório Odontológico Sorriso LTDA", fantasia: "Sorriso Clínica", cnpj: "43.456.789/0001-01", trib: "Lucro Presumido - Serviço" },
];

const PESSOAS_FISICAS = [
  { nome: "Maria Regina Oliveira", cpf: "675.398.900-53", profissao: "Doméstica" },
  { nome: "João Pedro Santos", cpf: "123.456.789-01", profissao: "Autônomo" },
];

const PRIMEIROS_NOMES = ["Carlos", "Maria", "João", "Ana", "Paulo", "Juliana", "Roberto", "Patrícia", "Marcos", "Fernanda", "André", "Camila", "Lucas", "Beatriz"];
const SOBRENOMES = ["Silva", "Santos", "Oliveira", "Souza", "Pereira", "Costa", "Ferreira", "Rodrigues", "Almeida", "Lima", "Gomes", "Martins"];
const RESP_FISCAL = ["NEUCIR", "CAMILA", "RUBENS"];
const RESP_FOLHA = ["KADYNE", "RUBENS"];
const RESP_CTB = ["CAMILA", "NEUCIR"];
const CLASSIF = ["BRONZE", "PRATA", "OURO", "TOP"] as const;
const MESES_PT = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function rand<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randMoney(min: number, max: number) { return Math.round((Math.random() * (max - min) + min) * 100) / 100; }
function nomeFake() { return `${rand(PRIMEIROS_NOMES)} ${rand(SOBRENOMES)} ${rand(SOBRENOMES)}`; }
function cpfFake() {
  const n = () => String(randInt(0, 9));
  return `${n()}${n()}${n()}.${n()}${n()}${n()}.${n()}${n()}${n()}-${n()}${n()}`;
}
function telefoneFake() {
  return `+555199${String(randInt(10000, 99999))}${String(randInt(1000, 9999))}`.slice(0, 14);
}

// ============================================================
// Limpeza
// ============================================================
async function limpar() {
  console.log("[demo] limpando dados existentes…");
  await prisma.execucaoRegua.deleteMany({});
  await prisma.eventoAgenda.deleteMany({});
  await prisma.cobranca.deleteMany({});
  await prisma.honorario.deleteMany({});
  await prisma.contrato.deleteMany({});
  await prisma.clienteObservacao.deleteMany({});
  await prisma.clienteTag.deleteMany({});
  await prisma.socio.deleteMany({});
  await prisma.contatoEmail.deleteMany({});
  await prisma.contatoTelefone.deleteMany({});
  await prisma.clienteAcesso.deleteMany({});
  await prisma.cliente.deleteMany({});
  await prisma.tagTexto.deleteMany({});
  await prisma.tag.deleteMany({});
  await prisma.contratoTemplate.deleteMany({});
}

// ============================================================
// Populadores
// ============================================================
async function criarTags() {
  console.log("[demo] criando tags…");
  const tags = [
    { nome: "VIP", slug: "vip", cor: "#F59E0B" },
    { nome: "Inadimplente", slug: "inadimplente", cor: "#EF4444" },
    { nome: "Novo cliente", slug: "novo-cliente", cor: "#84CC16" },
    { nome: "Em negociação", slug: "em-negociacao", cor: "#3B82F6" },
    { nome: "Aniversariante", slug: "aniversariante", cor: "#EC4899" },
    { nome: "Reajuste pendente", slug: "reajuste-pendente", cor: "#8B5CF6" },
    { nome: "Simples Nacional", slug: "simples-nacional", cor: "#10B981" },
    { nome: "Lucro Presumido", slug: "lucro-presumido", cor: "#6366F1" },
    { nome: "MEI", slug: "mei", cor: "#06B6D4" },
  ];
  for (const t of tags) {
    await prisma.tag.create({ data: { ...t, origem: "interno" } });
  }
  return prisma.tag.findMany();
}

async function criarTemplatesContrato() {
  console.log("[demo] criando templates de contrato…");
  await prisma.contratoTemplate.createMany({
    data: [
      { nome: "Contrato Prestação Serviços Contábeis", tipo: "PRESTACAO_SERVICOS", arquivoDocx: "/templates/prestacao-servicos.docx", ativo: true },
      { nome: "Contrato Carnê Leão", tipo: "CARNE_LEAO", arquivoDocx: "/templates/carne-leao.docx", ativo: true },
      { nome: "Contrato eSocial Doméstico", tipo: "ESOCIAL_DOMESTICO", arquivoDocx: "/templates/esocial-domestico.docx", ativo: true },
    ],
  });
}

async function criarClientes(tagsMap: Record<string, string>) {
  console.log("[demo] criando clientes…");
  const clientes: any[] = [];
  let codigo = 1;
  for (const e of EMPRESAS) {
    const classif = rand(CLASSIF);
    const temReajuste = Math.random() > 0.2;
    const status = Math.random() > 0.15 ? "ATIVO" : Math.random() > 0.5 ? "PROSPECT" : "INATIVO";
    const inicio = subMonths(new Date(), randInt(1, 72));

    const cliente = await prisma.cliente.create({
      data: {
        codigo: codigo++,
        razaoSocial: e.razao,
        nomeFantasia: e.fantasia,
        cpfCnpj: e.cnpj,
        tipoPessoa: "JURIDICA",
        classificacao: classif,
        rentabilidade: rand(["BAIXO", "MÉDIO", "ALTO"]),
        risco: rand(["BAIXO", "MÉDIO", "ALTO"]),
        tributacao: e.trib,
        faturamento: "Fat Interno / NF pelo Cliente via Sistema",
        prefeitura: "Porto Alegre/RS",
        vendaCartao: Math.random() > 0.5,
        fluxoFiscal: "NEUCIR",
        respFiscal: rand(RESP_FISCAL),
        folha: rand(["Básica", "Intermediária", "N/A"]),
        respFolha: rand(RESP_FOLHA),
        contabil: "Sim",
        respContabil: rand(RESP_CTB),
        status: status as any,
        inicio,
        chaveInicio: `${String(inicio.getMonth() + 1).padStart(2, "0")}_${inicio.getFullYear()}`,
        meioCaptacao: rand(["Indicação", "Google", "Instagram", "Parceria"]),
        indicacao: rand(["PARCEIRO A", "CLIENTE B", "GOOGLE", "—"]),
        mesAniversarioReajuste: temReajuste ? randInt(1, 12) : null,
        indiceReajuste: rand(["IPCA", "IGPM", "INPC", "IPCA", "IPCA"]) as any,
        ultimoReajuste: temReajuste ? subMonths(new Date(), randInt(1, 11)) : null,
        emails: {
          create: [
            { email: `contato@${e.fantasia.toLowerCase().replace(/[^a-z]/g, "")}.com.br`, principal: true, tipo: "financeiro" },
            { email: `fiscal@${e.fantasia.toLowerCase().replace(/[^a-z]/g, "")}.com.br`, tipo: "fiscal" },
          ],
        },
        telefones: {
          create: [
            { numero: telefoneFake(), principal: true, whatsapp: true, tipo: "celular" },
          ],
        },
      },
    });

    // sócios
    const qtdSocios = randInt(1, 3);
    for (let i = 0; i < qtdSocios; i++) {
      await prisma.socio.create({
        data: {
          clienteId: cliente.id,
          nome: nomeFake(),
          cpf: cpfFake(),
          email: `socio${i}@${e.fantasia.toLowerCase().replace(/[^a-z]/g, "")}.com.br`,
          telefone: telefoneFake(),
          profissao: rand(["Empresário(a)", "Administrador(a)", "Diretor(a)", "Sócio(a) Administrador(a)"]),
          estadoCivil: rand(["Solteiro(a)", "Casado(a)", "Divorciado(a)"]),
          quotas: randMoney(5000, 50000),
          representanteLegal: i === 0,
        },
      });
    }

    // tags aleatórias
    const tagsDoCliente = new Set<string>();
    if (e.trib.includes("Simples")) tagsDoCliente.add("simples-nacional");
    if (e.trib.includes("Presumido")) tagsDoCliente.add("lucro-presumido");
    if (classif === "TOP" || classif === "OURO") tagsDoCliente.add("vip");
    if (Math.random() > 0.7) tagsDoCliente.add("aniversariante");
    if (Math.random() > 0.8) tagsDoCliente.add("reajuste-pendente");
    if (status === "PROSPECT") tagsDoCliente.add("novo-cliente");

    for (const slug of tagsDoCliente) {
      const tagId = tagsMap[slug];
      if (tagId) {
        await prisma.clienteTag.create({ data: { clienteId: cliente.id, tagId } });
      }
    }

    // observações
    if (Math.random() > 0.5) {
      await prisma.clienteObservacao.create({
        data: {
          clienteId: cliente.id,
          autor: "Administrador",
          conteudo: rand([
            "Cliente prefere atendimento pela manhã.",
            "Está negociando reajuste para o próximo aniversário.",
            "Enviou documentação pendente da DEFIS.",
            "Quer receber as guias por e-mail também.",
            "Agendar reunião trimestral em julho.",
            "Solicitou parcelamento do último boleto.",
          ]),
        },
      });
    }

    clientes.push(cliente);
  }

  // pessoa física (carnê leão)
  for (const p of PESSOAS_FISICAS) {
    const cliente = await prisma.cliente.create({
      data: {
        codigo: codigo++,
        razaoSocial: p.nome,
        cpfCnpj: p.cpf,
        tipoPessoa: "FISICA",
        classificacao: "BRONZE",
        status: "ATIVO",
        tributacao: "Carnê Leão",
        inicio: subMonths(new Date(), 24),
        emails: { create: [{ email: `${p.nome.toLowerCase().split(" ")[0]}@email.com`, principal: true }] },
        telefones: { create: [{ numero: telefoneFake(), principal: true, whatsapp: true }] },
      },
    });
    clientes.push(cliente);
  }

  return clientes;
}

async function criarContratosECobrancas(clientes: any[], templates: any[]) {
  console.log("[demo] criando contratos, honorários e cobranças…");
  const tpl = templates[0];

  for (const cliente of clientes) {
    if (cliente.status !== "ATIVO") continue;
    const valorHonorarios = randMoney(500, 2500);

    // Contrato
    const contrato = await prisma.contrato.create({
      data: {
        clienteId: cliente.id,
        numero: `CTR-${String(cliente.codigo).padStart(4, "0")}-2026`,
        tipo: "PRESTACAO_SERVICOS",
        status: "ASSINADO",
        templateId: tpl.id,
        dataAssinatura: cliente.inicio,
        dataVigenciaInicio: cliente.inicio,
        diaVencimento: 10,
        valorHonorarios,
        adicionalAnual: valorHonorarios * 1.2,
        indiceReajuste: cliente.indiceReajuste ?? "IPCA",
        mesAniversario: cliente.mesAniversarioReajuste,
        objeto: "Prestação de serviços contábeis, fiscais e tributários.",
        docxPath: "/uploads/contratos/demo.docx",
      },
    });

    // 6 meses de cobranças via factory (snapshot capturado automaticamente).
    const { criarCobranca } = await import("../src/lib/services/cobranca-factory");

    for (let m = -5; m <= 1; m++) {
      const venc = new Date();
      venc.setMonth(venc.getMonth() + m);
      venc.setDate(10);

      let status: "PAGO" | "ABERTO" | "ATRASADO" = "PAGO";
      let dataPagamento: Date | null = null;
      const diasParaVencer = Math.floor((venc.getTime() - Date.now()) / 86400000);

      if (diasParaVencer > 5) {
        status = "ABERTO";
      } else if (diasParaVencer < -5) {
        if (Math.random() > 0.1) { status = "PAGO"; dataPagamento = addDays(venc, randInt(-3, 2)); }
        else { status = "ATRASADO"; }
      } else {
        if (Math.random() > 0.4) { status = "PAGO"; dataPagamento = addDays(venc, randInt(-2, 1)); }
        else if (diasParaVencer < 0) status = "ATRASADO";
        else status = "ABERTO";
      }

      const valor = m === -5 ? valorHonorarios * 1.2 : valorHonorarios; // 13ª no mês mais antigo

      await criarCobranca({
        clienteId: cliente.id,
        niboDebitId: `nibo-${cliente.id}-${m}`,
        descricao: `Honorários ${MESES_PT[venc.getMonth()]}/${venc.getFullYear()}`,
        valor,
        vencimento: venc,
        dataPagamento,
        status,
        linhaDigitavel: "34191.79001 01043.510047 91020.150008 1 92230000015000",
        urlBoleto: `https://example.com/boleto/${cliente.id}-${m}.pdf`,
        pixCopiaCola: "00020126580014br.gov.bcb.pix0136example@cestacorp.com.br",
      }, { fonte: "seed-demo" });
    }
  }
}

async function criarExecucoesRegua(clientes: any[]) {
  console.log("[demo] criando execuções da régua…");
  const regua = await prisma.reguaCobranca.findFirst({ include: { passos: true } });
  if (!regua) return;

  const cobrancas = await prisma.cobranca.findMany({
    where: { status: { in: ["ATRASADO", "ABERTO"] } },
    take: 60,
  });

  for (const c of cobrancas) {
    for (const passo of regua.passos) {
      const agendadoPara = addDays(c.vencimento, passo.offsetDias);
      const [h, m] = (passo.horarioEnvio ?? "09:00").split(":").map(Number);
      agendadoPara.setHours(h, m, 0, 0);

      let status: any = "PENDENTE";
      let enviadoEm: Date | null = null;
      let erro: string | null = null;

      if (agendadoPara < new Date()) {
        const rnd = Math.random();
        if (rnd < 0.85) {
          status = "ENVIADO";
          enviadoEm = addDays(agendadoPara, 0);
          enviadoEm.setMinutes(enviadoEm.getMinutes() + randInt(0, 30));
        } else if (rnd < 0.95) {
          status = "ERRO";
          erro = rand(["Número não está no WhatsApp", "Falha de rede", "Cliente sem telefone cadastrado"]);
        } else {
          status = "PULADO";
          erro = "Cobrança paga antes do envio";
        }
      }

      const msg = passo.templateMsg
        .replace(/\{cliente\.razaoSocial\}/g, "CLIENTE_NAME")
        .replace(/\{cobranca\.valor[^}]*\}/g, `R$ ${c.valor}`)
        .replace(/\{cobranca\.vencimento[^}]*\}/g, c.vencimento.toLocaleDateString("pt-BR"));

      await prisma.execucaoRegua.create({
        data: {
          reguaId: regua.id,
          passoId: passo.id,
          clienteId: c.clienteId,
          cobrancaId: c.id,
          agendadoPara,
          enviadoEm,
          status,
          erro,
          mensagemFinal: status === "ENVIADO" ? msg : null,
          digisacMessageId: status === "ENVIADO" ? `msg-demo-${c.id}-${passo.id}` : null,
        },
      });
    }
  }
}

async function criarAcessosPortal(clientes: any[]) {
  console.log("[demo] criando acessos do portal…");
  const hash = await bcrypt.hash("Cliente@2026", 10);
  const escolhidos = clientes.filter((c) => c.status === "ATIVO").slice(0, 5);
  for (const c of escolhidos) {
    const email = `portal.${c.nomeFantasia?.toLowerCase().replace(/[^a-z]/g, "") ?? c.id.slice(0, 4)}@demo.com.br`;
    await prisma.clienteAcesso.create({
      data: {
        clienteId: c.id,
        email,
        nome: `Responsável ${c.nomeFantasia ?? c.razaoSocial}`.slice(0, 60),
        password: hash,
        ativo: true,
        ultimoAcesso: Math.random() > 0.3 ? subDays(new Date(), randInt(0, 15)) : null,
      },
    });
  }
  console.log(`   → todos usam senha: Cliente@2026`);
  console.log(`   → exemplo de e-mail: portal.<fantasia>@demo.com.br`);
}

async function materializarAgenda() {
  console.log("[demo] materializando eventos da agenda (90 dias)…");
  // importa dinamicamente para evitar bundlar no topo
  const { materializaEventos } = await import("../src/lib/services/agenda");
  const r = await materializaEventos(90);
  console.log(`   → ${r.criados} eventos criados`);
}

// ============================================================
// Mongo: formulários respondidos + notificações + logs
// ============================================================
async function popularMongo(clientes: any[]) {
  console.log("[demo] populando MongoDB (forms + notificações + logs)…");
  await mongoose.connect(process.env.MONGODB_URI!);
  const { FormResponseModel } = await import("../src/models/FormResponse");
  const { MessageLogModel } = await import("../src/models/MessageLog");
  const { NotificationModel } = await import("../src/models/Notification");

  await FormResponseModel.deleteMany({});
  await MessageLogModel.deleteMany({});
  await NotificationModel.deleteMany({});

  // Formulários respondidos
  const slugs = ["abertura-empresa", "alteracao-empresa", "socios", "carne-leao", "abertura-mei"];
  const statuses = ["RECEBIDO", "RECEBIDO", "EM_ANALISE", "APLICADO", "APLICADO"];
  const autores = [
    { nome: "José Martins Souza", email: "jose.martins@email.com", telefone: "+5551999887766" },
    { nome: "Patrícia Oliveira Lima", email: "patricia.ol@email.com", telefone: "+5551988776655" },
    { nome: "Marcos Paulo Silva", email: "marcos.ps@email.com", telefone: "+5551977665544" },
    { nome: "Beatriz Santos Costa", email: "beatriz.sc@email.com", telefone: "+5551966554433" },
    { nome: "André Ferreira Gomes", email: "andre.fg@email.com", telefone: "+5551955443322" },
    { nome: "Juliana Pereira Rocha", email: "juliana.pr@email.com", telefone: "+5551944332211" },
    { nome: "Roberto Carlos Lima", email: "rc.lima@email.com", telefone: "+5551933221100" },
  ];

  for (let i = 0; i < 18; i++) {
    const slug = rand(slugs);
    const autor = rand(autores);
    const status = rand(statuses);
    const clienteId = status === "APLICADO" ? rand(clientes).id : undefined;
    await FormResponseModel.create({
      formSlug: slug,
      autor,
      answers: {
        razaoSocial1: "Empresa Exemplo LTDA",
        nomeFantasia: "Exemplo",
        email: autor.email,
        celular: autor.telefone,
        qtdSocios: randInt(1, 3),
        capitalSocial: randMoney(1000, 50000),
        atividades: "Prestação de serviços diversos.",
      },
      status,
      clienteId,
      createdAt: subDays(new Date(), randInt(0, 45)),
      origem: "form-publico",
    });
  }

  // Notificações
  for (let i = 0; i < 12; i++) {
    const tipo = rand(["FORM_RECEBIDO", "COBRANCA_ATRASADA", "COBRANCA_PAGA", "REGUA_ERRO", "CLIENTE_PROSPECT"]);
    const titulos: Record<string, string> = {
      FORM_RECEBIDO: "Novo formulário: Abertura de Empresa",
      COBRANCA_ATRASADA: "3 cobranças em atraso hoje",
      COBRANCA_PAGA: "Pagamento recebido: TechNova",
      REGUA_ERRO: "Falha na régua: Padaria do Bairro",
      CLIENTE_PROSPECT: "Novo prospect: Escola Recanto",
    };
    await NotificationModel.create({
      tipo,
      titulo: titulos[tipo],
      descricao: "Evento gerado automaticamente pelo sistema.",
      priority: tipo === "COBRANCA_ATRASADA" || tipo === "REGUA_ERRO" ? "HIGH" : "NORMAL",
      lidaPor: Math.random() > 0.5 ? ["admin"] : [],
      createdAt: subDays(new Date(), randInt(0, 10)),
    });
  }

  // MessageLog
  for (let i = 0; i < 30; i++) {
    const c = rand(clientes);
    await MessageLogModel.create({
      canal: rand(["WHATSAPP", "EMAIL"]),
      direcao: rand(["OUT", "OUT", "OUT", "IN"]),
      clienteId: c.id,
      para: telefoneFake(),
      conteudo: rand([
        "Olá, seu boleto vence amanhã.",
        "Obrigado pelo pagamento!",
        "Boleto enviado por e-mail também.",
        "Cliente respondeu: pode parcelar?",
      ]),
      provider: "digisac",
      status: rand(["ENVIADO", "ENTREGUE", "LIDA"]),
      createdAt: subDays(new Date(), randInt(0, 30)),
    });
  }

  await mongoose.disconnect();
}

// ============================================================
// Main
// ============================================================
(async () => {
  try {
    console.time("[demo] total");
    await limpar();
    const tags = await criarTags();
    const tagsMap = Object.fromEntries(tags.map((t) => [t.slug, t.id]));
    await criarTemplatesContrato();
    const templates = await prisma.contratoTemplate.findMany();
    const clientes = await criarClientes(tagsMap);
    console.log(`   → ${clientes.length} clientes criados`);
    await criarContratosECobrancas(clientes, templates);
    await criarExecucoesRegua(clientes);
    await criarAcessosPortal(clientes);
    await materializarAgenda();
    await popularMongo(clientes);

    console.log("\n========================================");
    console.log("  SEED DEMO CONCLUÍDO!");
    console.log("========================================");
    console.log("  Login admin (equipe):");
    console.log("    admin@cestacorp.com.br / Cestacorp@2026");
    console.log("  Portal cliente (qualquer dos 5 criados):");
    console.log("    email: portal.<fantasia>@demo.com.br");
    console.log("    senha: Cliente@2026");
    console.log("========================================\n");
    console.timeEnd("[demo] total");
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
