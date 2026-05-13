/**
 * Seed:
 *  - cria usuário admin (email/senha via env ou default)
 *  - cria definições dos 8 formulários a partir dos Google Forms originais
 *  - cria régua padrão Cestacorp (4 passos)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import mongoose from "mongoose";
import { FormDefinitionModel } from "../src/models/FormDefinition";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@cestacorp.com.br";
const ADMIN_PASS = process.env.SEED_ADMIN_PASSWORD || "Cestacorp@2026";

async function seedUser() {
  const hash = await bcrypt.hash(ADMIN_PASS, 10);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: { email: ADMIN_EMAIL, name: "Administrador", password: hash, role: "ADMIN" },
  });
  console.log(`[seed] admin: ${ADMIN_EMAIL} / ${ADMIN_PASS}`);
}

async function seedObrigacoes() {
  const padrao = [
    { nome: "DAS - Simples Nacional", tipo: "DAS", recorrencia: "MENSAL", diaVencimento: 20, tributacaoFiltro: "Simples", responsavel: "RESP. FISCAL", antecedenciaDias: 5, descricao: "Guia mensal do Simples Nacional" },
    { nome: "FGTS", tipo: "FGTS", recorrencia: "MENSAL", diaVencimento: 7, responsavel: "RESP. FOLHA", antecedenciaDias: 3 },
    { nome: "eSocial", tipo: "ESOCIAL", recorrencia: "MENSAL", diaVencimento: 15, responsavel: "RESP. FOLHA", antecedenciaDias: 3 },
    { nome: "DCTFWeb", tipo: "DCTF", recorrencia: "MENSAL", diaVencimento: 15, responsavel: "RESP. FISCAL", antecedenciaDias: 5 },
    { nome: "DEFIS - Simples Nacional", tipo: "DEFIS", recorrencia: "ANUAL", mesVencimento: 3, diaVencimentoAnual: 31, tributacaoFiltro: "Simples", responsavel: "RESP. CTB", antecedenciaDias: 15 },
    { nome: "DIRF", tipo: "DIRF", recorrencia: "ANUAL", mesVencimento: 2, diaVencimentoAnual: 28, responsavel: "RESP. CTB", antecedenciaDias: 15 },
    { nome: "IRPF", tipo: "IRPF", recorrencia: "ANUAL", mesVencimento: 5, diaVencimentoAnual: 31, global: false, antecedenciaDias: 30 },
    { nome: "ECF", tipo: "ECF", recorrencia: "ANUAL", mesVencimento: 7, diaVencimentoAnual: 31, tributacaoFiltro: "Presumido", responsavel: "RESP. CTB", antecedenciaDias: 20 },
  ];

  for (const o of padrao) {
    const ja = await prisma.obrigacao.findFirst({ where: { nome: o.nome } });
    if (ja) continue;
    await prisma.obrigacao.create({ data: { ...o, global: o.global ?? true } as any });
    console.log(`[seed] obrigação: ${o.nome}`);
  }
}

async function seedRegua() {
  const jaExiste = await prisma.reguaCobranca.findFirst({ where: { nome: "Régua Padrão Cestacorp" } });
  if (jaExiste) return;
  await prisma.reguaCobranca.create({
    data: {
      nome: "Régua Padrão Cestacorp",
      descricao: "Lembrete 3 dias antes, no dia, 1 e 7 dias após vencimento.",
      ativa: true,
      passos: {
        create: [
          { ordem: 1, nome: "Lembrete 3 dias antes", offsetDias: -3, canal: "WHATSAPP", horarioEnvio: "09:00", soDiasUteis: true,
            templateMsg: "Olá {cliente.razaoSocial}! 👋 Lembrete: boleto de {cobranca.valor|money} vence em {cobranca.vencimento|date}. Pix/linha: {cobranca.linhaDigitavel}" },
          { ordem: 2, nome: "No dia", offsetDias: 0, canal: "WHATSAPP", horarioEnvio: "09:00", soDiasUteis: false,
            templateMsg: "Bom dia, {cliente.razaoSocial}! O boleto de {cobranca.valor|money} vence HOJE. Link: {cobranca.urlBoleto}" },
          { ordem: 3, nome: "1 dia de atraso", offsetDias: 1, canal: "WHATSAPP", horarioEnvio: "10:00", soDiasUteis: true,
            templateMsg: "{cliente.razaoSocial}, seu boleto de {cobranca.valor|money} venceu em {cobranca.vencimento|date} e ainda consta em aberto. Qualquer dúvida estamos à disposição." },
          { ordem: 4, nome: "7 dias de atraso", offsetDias: 7, canal: "WHATSAPP", horarioEnvio: "10:00", soDiasUteis: true,
            templateMsg: "Olá {cliente.razaoSocial}, o boleto de {cobranca.valor|money} está com 7 dias de atraso. Precisamos regularizar — responda para conversarmos." },
        ],
      },
    },
  });
  console.log("[seed] régua padrão criada");
}

async function seedForms() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const forms = [
    {
      slug: "abertura-empresa",
      title: "Abertura de Empresa",
      category: "abertura-empresa",
      description: "Dados necessários para abertura da sua empresa na Cestacorp.",
      fields: [
        { key: "razaoSocial1", label: "Razão social — 1ª opção", type: "text", required: true, mapping: { entity: "cliente", field: "razaoSocial" } },
        { key: "razaoSocial2", label: "Razão social — 2ª opção", type: "text", required: false },
        { key: "nomeFantasia", label: "Nome fantasia", type: "text", mapping: { entity: "cliente", field: "nomeFantasia" } },
        { key: "email", label: "E-mail da empresa", type: "email", required: true },
        { key: "celular", label: "Celular da empresa", type: "phone", required: true },
        { key: "telefone", label: "Telefone da empresa", type: "phone" },
        { key: "naturezaJuridica", label: "Natureza jurídica", type: "select", required: true,
          options: [
            { label: "LTDA", value: "LTDA" },
            { label: "Sociedade Limitada Unipessoal (SLU)", value: "SLU" },
            { label: "EIRELI", value: "EIRELI" },
            { label: "MEI", value: "MEI" },
            { label: "Outros", value: "OUTROS" },
          ] },
        { key: "qtdSocios", label: "Quantos sócios?", type: "number", required: true, mapping: { entity: "cliente", field: "qtdSocios" } },
        { key: "capitalSocial", label: "Capital Social (R$)", type: "money", required: true },
        { key: "atividades", label: "Atividades da empresa", type: "textarea", required: true },
        { key: "maquininhaCartao", label: "Trabalhará com maquininha de cartão?", type: "select",
          options: [{ label: "Sim", value: "sim" }, { label: "Não", value: "nao" }] },
        { key: "formaPagamentoHonorarios", label: "Forma de pagamento dos honorários", type: "select",
          options: [
            { label: "Boleto mensal", value: "boleto" },
            { label: "PIX", value: "pix" },
            { label: "Débito em conta", value: "debito" },
          ] },
        { key: "enderecoTipo", label: "Endereço da empresa", type: "select", required: true,
          options: [
            { label: "Sede Virtual Cestacorp", value: "sede-virtual" },
            { label: "Residencial", value: "residencial" },
            { label: "Comercial", value: "comercial" },
          ] },
        { key: "consentimento", label: "Concordo com o tratamento dos meus dados pessoais", type: "checkbox", required: true },
      ],
    },
    {
      slug: "alteracao-empresa",
      title: "Alteração de Empresa",
      category: "alteracao-empresa",
      description: "Solicite alterações contratuais da sua empresa.",
      fields: [
        { key: "nomeEmpresa", label: "Nome da Empresa", type: "text", required: true },
        { key: "cnpj", label: "CNPJ", type: "cnpj", required: true, mapping: { entity: "cliente", field: "cpfCnpj" } },
        { key: "quemPreencheu", label: "Nome de quem preenche", type: "text", required: true },
        { key: "emailPreenchedor", label: "E-mail de quem preenche", type: "email", required: true },
        { key: "alteracaoEndereco", label: "Alterar endereço?", type: "select",
          options: [{ label: "Sim", value: "sim" }, { label: "Não", value: "nao" }] },
        { key: "novoEndereco", label: "Novo endereço completo", type: "text", showIf: { field: "alteracaoEndereco", equals: "sim" } },
        { key: "novoCep", label: "Novo CEP", type: "text", showIf: { field: "alteracaoEndereco", equals: "sim" } },
        { key: "alteracaoCapital", label: "Alterar Capital Social?", type: "select",
          options: [{ label: "Sim", value: "sim" }, { label: "Não", value: "nao" }] },
        { key: "novoCapital", label: "Novo Capital Social (R$)", type: "money", showIf: { field: "alteracaoCapital", equals: "sim" } },
        { key: "alteracaoRazaoSocial", label: "Alterar Razão Social?", type: "select",
          options: [{ label: "Sim", value: "sim" }, { label: "Não", value: "nao" }] },
        { key: "novaRazao1", label: "Nova razão — 1ª opção", type: "text", showIf: { field: "alteracaoRazaoSocial", equals: "sim" } },
        { key: "consentimento", label: "Concordo com o tratamento dos meus dados", type: "checkbox", required: true },
      ],
    },
    {
      slug: "abertura-mei",
      title: "Abertura MEI",
      category: "abertura-mei",
      description: "Abra seu MEI com a Cestacorp.",
      fields: [
        { key: "nome", label: "Nome", type: "text", required: true },
        { key: "cpf", label: "CPF", type: "cpf", required: true, mapping: { entity: "cliente", field: "cpfCnpj" } },
        { key: "rg", label: "RG", type: "text", required: true },
        { key: "dataNascimento", label: "Data de nascimento", type: "date", required: true },
        { key: "nomeMae", label: "Nome da mãe", type: "text", required: true },
        { key: "tituloEleitor", label: "Número Título de Eleitor", type: "text" },
        { key: "enderecoEmpresa", label: "Endereço da empresa", type: "textarea", required: true },
        { key: "cepEmpresa", label: "CEP do endereço da empresa", type: "text", required: true },
        { key: "telefoneCelular", label: "Telefone celular do sócio", type: "phone", required: true },
        { key: "cnaePrincipal", label: "CNAE Principal", type: "text", required: true },
        { key: "cnaesSecundarios", label: "CNAEs Secundários (até 14)", type: "textarea" },
        { key: "capitalSocial", label: "Capital Social (R$)", type: "money", required: true },
        { key: "emailCnpj", label: "E-mail para o CNPJ", type: "email", required: true },
        { key: "senhaGov", label: "Senha gov.br (para acesso)", type: "text" },
        { key: "formaAtuacao", label: "Forma de atuação", type: "text", required: true },
        { key: "formaPagamentoHonorarios", label: "Forma de pagamento dos honorários", type: "select",
          options: [{ label: "Boleto", value: "boleto" }, { label: "PIX", value: "pix" }] },
      ],
    },
    {
      slug: "alteracao-mei",
      title: "Alteração MEI",
      category: "alteracao-mei",
      description: "Solicite alterações no seu MEI.",
      fields: [
        { key: "razaoSocial", label: "Razão Social", type: "text", required: true },
        { key: "cnpj", label: "CNPJ", type: "cnpj", required: true },
        { key: "cpf", label: "CPF", type: "cpf", required: true },
        { key: "senhaGov", label: "Senha gov.br", type: "text", required: true },
        { key: "telefoneCelular", label: "Telefone celular", type: "phone", required: true },
        { key: "alterarNomeFantasia", label: "Alterar nome fantasia?", type: "select",
          options: [{ label: "Sim", value: "sim" }, { label: "Não", value: "nao" }] },
        { key: "novoNomeFantasia", label: "Novo nome fantasia", type: "text", showIf: { field: "alterarNomeFantasia", equals: "sim" } },
        { key: "alterarEndereco", label: "Alterar endereço?", type: "select",
          options: [{ label: "Sim", value: "sim" }, { label: "Não", value: "nao" }] },
        { key: "novoEndereco", label: "Novo endereço", type: "text", showIf: { field: "alterarEndereco", equals: "sim" } },
        { key: "alterarCapital", label: "Alterar capital social?", type: "select",
          options: [{ label: "Sim", value: "sim" }, { label: "Não", value: "nao" }] },
        { key: "novoCapital", label: "Novo capital social (R$)", type: "money", showIf: { field: "alterarCapital", equals: "sim" } },
      ],
    },
    {
      slug: "socios",
      title: "Dados dos Sócios",
      category: "socios",
      description: "Envie os dados dos sócios da empresa.",
      fields: [
        { key: "nome", label: "Nome completo", type: "text", required: true, mapping: { entity: "socio", field: "nome" } },
        { key: "telefone", label: "Telefone", type: "phone", required: true },
        { key: "emailPessoal", label: "E-mail pessoal", type: "email", required: true },
        { key: "emailEmpresa", label: "E-mail para receber guias da empresa", type: "email" },
        { key: "nomeEmpresa", label: "Nome da empresa", type: "text", required: true },
        { key: "senhaGov", label: "Senha gov.br", type: "text" },
        { key: "profissao", label: "Profissão", type: "text", required: true, mapping: { entity: "socio", field: "profissao" } },
        { key: "naturalidade", label: "Naturalidade", type: "text" },
        { key: "pis", label: "Número do PIS", type: "text" },
        { key: "estadoCivil", label: "Estado civil", type: "select", required: true,
          options: [
            { label: "Solteiro(a)", value: "solteiro" },
            { label: "Casado(a)", value: "casado" },
            { label: "Divorciado(a)", value: "divorciado" },
            { label: "Viúvo(a)", value: "viuvo" },
            { label: "União estável", value: "uniao-estavel" },
          ] },
        { key: "regimeBens", label: "Regime de bens", type: "select",
          showIf: { field: "estadoCivil", equals: "casado" },
          options: [
            { label: "Comunhão parcial de bens", value: "parcial" },
            { label: "Comunhão universal de bens", value: "universal" },
            { label: "Separação de bens", value: "separacao" },
          ] },
        { key: "outroVinculoInss", label: "Possui outro vínculo com recolhimento INSS?", type: "select",
          options: [{ label: "Sim", value: "sim" }, { label: "Não", value: "nao" }] },
        { key: "funcionarioPublico", label: "É funcionário público?", type: "select",
          options: [{ label: "Sim", value: "sim" }, { label: "Não", value: "nao" }] },
        { key: "diaVencimento", label: "Melhor dia do mês para vencimento do boleto", type: "number", required: true },
        { key: "cpf", label: "CPF", type: "cpf", required: true, mapping: { entity: "socio", field: "cpf" } },
        { key: "consentimento", label: "Concordo com o tratamento dos meus dados", type: "checkbox", required: true },
      ],
    },
    {
      slug: "carne-leao",
      title: "Formulário Carnê Leão",
      category: "carne-leao",
      fields: [
        { key: "nome", label: "Nome completo", type: "text", required: true },
        { key: "cpf", label: "CPF", type: "cpf", required: true },
        { key: "rg", label: "Número RG", type: "text" },
        { key: "naturalidade", label: "Naturalidade", type: "text" },
        { key: "estadoCivil", label: "Estado civil", type: "text" },
        { key: "pis", label: "NIT/PIS/PASEP", type: "text" },
        { key: "dependentes", label: "Possui dependentes?", type: "select",
          options: [{ label: "Sim", value: "sim" }, { label: "Não", value: "nao" }] },
        { key: "qtdDependentes", label: "Quantos?", type: "number", showIf: { field: "dependentes", equals: "sim" } },
        { key: "telefone", label: "Telefone", type: "phone", required: true },
        { key: "endereco", label: "Endereço completo", type: "text", required: true },
        { key: "cep", label: "CEP", type: "text", required: true },
        { key: "profissao", label: "Profissão", type: "text", required: true },
        { key: "diaVencimento", label: "Melhor dia para vencimento do boleto", type: "number", required: true },
        { key: "mesInicio", label: "A partir de qual mês/ano a Cestacorp será responsável?", type: "text", required: true },
        { key: "mesFim", label: "Qual último mês? (ou INDETERMINADO)", type: "text" },
      ],
    },
    {
      slug: "esocial-domestico",
      title: "eSocial Doméstico — Admissão",
      category: "esocial-domestico",
      fields: [
        { key: "section-empregador", label: "EMPREGADOR", type: "section" },
        { key: "nomeEmpregador", label: "Nome do empregador", type: "text", required: true },
        { key: "cpfEmpregador", label: "CPF do empregador", type: "cpf", required: true },
        { key: "telefoneEmpregador", label: "Telefone do empregador", type: "phone", required: true },
        { key: "emailEmpregador", label: "E-mail do empregador", type: "email", required: true },
        { key: "section-empregado", label: "EMPREGADO(A) DOMÉSTICO(A)", type: "section" },
        { key: "nomeDomestica", label: "Nome da doméstica(o)", type: "text", required: true },
        { key: "cpfDomestica", label: "CPF da doméstica(o)", type: "cpf", required: true },
        { key: "dataNascimento", label: "Data de nascimento", type: "date", required: true },
        { key: "naturalidade", label: "Naturalidade (cidade)", type: "text" },
        { key: "nit", label: "NIT/PIS/PASEP", type: "text", required: true },
        { key: "ctps", label: "Número CTPS", type: "text", required: true },
        { key: "racaCor", label: "Raça/cor", type: "select",
          options: ["Branca", "Preta", "Parda", "Amarela", "Indígena"].map(v => ({ label: v, value: v.toLowerCase() })) },
        { key: "estadoCivil", label: "Estado civil", type: "text" },
        { key: "enderecoCompleto", label: "Endereço completo", type: "textarea", required: true },
        { key: "telefoneCelular", label: "Telefone celular", type: "phone", required: true },
        { key: "section-contrato", label: "CONTRATO DE TRABALHO", type: "section" },
        { key: "dataAdmissao", label: "Data de admissão", type: "date", required: true },
        { key: "cargo", label: "Cargo / função", type: "text", required: true },
        { key: "salario", label: "Salário (R$)", type: "money", required: true },
        { key: "jornada", label: "Jornada de trabalho", type: "text", required: true },
        { key: "horario", label: "Horário (ex.: das 8:00 às 12:00 e das 13:00 às 17:00)", type: "textarea", required: true },
        { key: "valeTransporte", label: "Vale transporte (descrever)", type: "textarea" },
      ],
    },
    {
      slug: "gps-avulsa",
      title: "Folha — Solicitação GPS Avulsa",
      category: "gps-avulsa",
      fields: [
        { key: "nome", label: "Nome completo", type: "text", required: true },
        { key: "dataNascimento", label: "Data de nascimento", type: "date", required: true },
        { key: "rg", label: "Número RG", type: "text", required: true },
        { key: "orgaoExpedidor", label: "Órgão expedidor", type: "text", required: true },
        { key: "ufRg", label: "UF do RG", type: "text", required: true },
        { key: "dataEmissaoRg", label: "Data de emissão do RG", type: "date", required: true },
        { key: "cpf", label: "CPF", type: "cpf", required: true },
        { key: "pis", label: "PIS", type: "text", required: true },
        { key: "inicioContribuicao", label: "Início contribuição", type: "date", required: true },
        { key: "categoria", label: "Categoria", type: "text", required: true },
        { key: "remuneracao", label: "Valor da remuneração (R$)", type: "money", required: true },
        { key: "cep", label: "CEP do endereço", type: "text", required: true },
        { key: "endereco", label: "Endereço completo (com nº)", type: "textarea", required: true },
        { key: "naturalidade", label: "Naturalidade", type: "text", required: true },
        { key: "nomePai", label: "Nome completo do pai", type: "text" },
        { key: "nomeMae", label: "Nome completo da mãe", type: "text", required: true },
        { key: "sexo", label: "Sexo", type: "select", required: true,
          options: [{ label: "Feminino", value: "F" }, { label: "Masculino", value: "M" }] },
      ],
    },
  ];

  for (const f of forms) {
    await FormDefinitionModel.updateOne({ slug: f.slug }, { $set: f }, { upsert: true });
    console.log(`[seed] form: ${f.slug}`);
  }

  await mongoose.disconnect();
}

(async () => {
  try {
    await seedUser();
    await seedObrigacoes();
    await seedRegua();
    await seedForms();
    console.log("[seed] ok");
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
