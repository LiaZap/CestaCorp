-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'GESTOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('FISICA', 'JURIDICA', 'MEI');

-- CreateEnum
CREATE TYPE "Classificacao" AS ENUM ('BRONZE', 'PRATA', 'OURO', 'TOP');

-- CreateEnum
CREATE TYPE "StatusCliente" AS ENUM ('ATIVO', 'INATIVO', 'ENCERRADO', 'PROSPECT', 'SUSPENSO');

-- CreateEnum
CREATE TYPE "IndiceReajuste" AS ENUM ('IPCA', 'IGPM', 'INPC', 'FIXO');

-- CreateEnum
CREATE TYPE "StatusContrato" AS ENUM ('RASCUNHO', 'EMITIDO', 'ASSINADO', 'ENCERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusHonorario" AS ENUM ('ABERTO', 'PAGO', 'ATRASADO', 'CANCELADO', 'RENEGOCIADO');

-- CreateEnum
CREATE TYPE "StatusCobranca" AS ENUM ('ABERTO', 'PAGO', 'ATRASADO', 'CANCELADO', 'PARCIAL');

-- CreateEnum
CREATE TYPE "CanalEnvio" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "StatusExecucao" AS ENUM ('PENDENTE', 'ENVIADO', 'ERRO', 'CANCELADO', 'PULADO');

-- CreateEnum
CREATE TYPE "TipoObrigacao" AS ENUM ('DAS', 'DEFIS', 'DIRF', 'IRPF', 'ECF', 'ECD', 'FGTS', 'ESOCIAL', 'DCTF', 'SPED_FISCAL', 'SPED_CONTRIBUICOES', 'REAJUSTE', 'REUNIAO', 'CERTIFICADO_DIGITAL', 'OUTROS');

-- CreateEnum
CREATE TYPE "Recorrencia" AS ENUM ('MENSAL', 'ANUAL', 'TRIMESTRAL', 'SEMESTRAL', 'UNICA');

-- CreateEnum
CREATE TYPE "StatusEvento" AS ENUM ('PENDENTE', 'CONCLUIDO', 'ATRASADO', 'ISENTO', 'CANCELADO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERADOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "codigo" INTEGER,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cpfCnpj" TEXT NOT NULL,
    "tipoPessoa" "TipoPessoa" NOT NULL DEFAULT 'JURIDICA',
    "classificacao" "Classificacao",
    "rentabilidade" TEXT,
    "risco" TEXT,
    "tributacao" TEXT,
    "avaliacaoGoogle" BOOLEAN NOT NULL DEFAULT false,
    "faturamento" TEXT,
    "prefeitura" TEXT,
    "vendaCartao" BOOLEAN NOT NULL DEFAULT false,
    "fluxoFiscal" TEXT,
    "respFiscal" TEXT,
    "folha" TEXT,
    "respFolha" TEXT,
    "contabil" TEXT,
    "respContabil" TEXT,
    "status" "StatusCliente" NOT NULL DEFAULT 'ATIVO',
    "inicio" TIMESTAMP(3),
    "chaveInicio" TEXT,
    "meioCaptacao" TEXT,
    "indicacao" TEXT,
    "amigo" TEXT,
    "mesAniversarioReajuste" INTEGER,
    "indiceReajuste" "IndiceReajuste" DEFAULT 'IPCA',
    "ultimoReajuste" TIMESTAMP(3),
    "endereco" JSONB,
    "niboCustomerId" TEXT,
    "digisacContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_emails" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "tipo" TEXT,

    CONSTRAINT "cliente_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_telefones" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "tipo" TEXT,

    CONSTRAINT "cliente_telefones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socios" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "profissao" TEXT,
    "naturalidade" TEXT,
    "estadoCivil" TEXT,
    "regimeBens" TEXT,
    "pis" TEXT,
    "quotas" DECIMAL(14,2),
    "representanteLegal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "socios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cor" TEXT DEFAULT '#84CC16',
    "descricao" TEXT,
    "origem" TEXT,
    "externoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_tags" (
    "clienteId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_tags_pkey" PRIMARY KEY ("clienteId","tagId")
);

-- CreateTable
CREATE TABLE "tag_textos" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "canal" TEXT,

    CONSTRAINT "tag_textos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "numero" TEXT,
    "tipo" TEXT NOT NULL,
    "status" "StatusContrato" NOT NULL DEFAULT 'RASCUNHO',
    "dataAssinatura" TIMESTAMP(3),
    "dataVigenciaInicio" TIMESTAMP(3),
    "dataVigenciaFim" TIMESTAMP(3),
    "diaVencimento" INTEGER,
    "valorHonorarios" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adicionalAnual" DECIMAL(14,2),
    "indiceReajuste" "IndiceReajuste" NOT NULL DEFAULT 'IPCA',
    "mesAniversario" INTEGER,
    "objeto" TEXT,
    "pdfPath" TEXT,
    "docxPath" TEXT,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_templates" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "arquivoDocx" TEXT NOT NULL,
    "placeholders" JSONB,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "honorarios" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "contratoId" TEXT,
    "competencia" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "status" "StatusHonorario" NOT NULL DEFAULT 'ABERTO',
    "niboScheduleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "honorarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobrancas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "honorarioId" TEXT,
    "niboDebitId" TEXT,
    "descricao" TEXT,
    "valor" DECIMAL(14,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "dataPagamento" TIMESTAMP(3),
    "linhaDigitavel" TEXT,
    "urlBoleto" TEXT,
    "pixCopiaCola" TEXT,
    "status" "StatusCobranca" NOT NULL DEFAULT 'ABERTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cobrancas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reguas_cobranca" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reguas_cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regua_passos" (
    "id" TEXT NOT NULL,
    "reguaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "offsetDias" INTEGER NOT NULL,
    "canal" "CanalEnvio" NOT NULL,
    "templateMsg" TEXT NOT NULL,
    "horarioEnvio" TEXT DEFAULT '09:00',
    "soDiasUteis" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "regua_passos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execucoes_regua" (
    "id" TEXT NOT NULL,
    "reguaId" TEXT NOT NULL,
    "passoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "cobrancaId" TEXT,
    "status" "StatusExecucao" NOT NULL DEFAULT 'PENDENTE',
    "agendadoPara" TIMESTAMP(3) NOT NULL,
    "enviadoEm" TIMESTAMP(3),
    "erro" TEXT,
    "mensagemFinal" TEXT,
    "digisacMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execucoes_regua_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_observacoes" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_observacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obrigacoes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoObrigacao" NOT NULL,
    "descricao" TEXT,
    "recorrencia" "Recorrencia" NOT NULL DEFAULT 'MENSAL',
    "diaVencimento" INTEGER,
    "mesVencimento" INTEGER,
    "diaVencimentoAnual" INTEGER,
    "dataUnica" TIMESTAMP(3),
    "antecedenciaDias" INTEGER NOT NULL DEFAULT 7,
    "global" BOOLEAN NOT NULL DEFAULT true,
    "clienteId" TEXT,
    "categoriaCliente" "Classificacao",
    "tributacaoFiltro" TEXT,
    "responsavel" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obrigacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_agenda" (
    "id" TEXT NOT NULL,
    "obrigacaoId" TEXT,
    "clienteId" TEXT,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "status" "StatusEvento" NOT NULL DEFAULT 'PENDENTE',
    "concluidoEm" TIMESTAMP(3),
    "concluidoPor" TEXT,
    "responsavel" TEXT,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventos_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_codigo_key" ON "clientes"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cpfCnpj_key" ON "clientes"("cpfCnpj");

-- CreateIndex
CREATE INDEX "clientes_razaoSocial_idx" ON "clientes"("razaoSocial");

-- CreateIndex
CREATE INDEX "clientes_status_idx" ON "clientes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tags_nome_key" ON "tags"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_numero_key" ON "contratos"("numero");

-- CreateIndex
CREATE INDEX "contratos_clienteId_idx" ON "contratos"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "contrato_templates_nome_key" ON "contrato_templates"("nome");

-- CreateIndex
CREATE INDEX "honorarios_status_vencimento_idx" ON "honorarios"("status", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "honorarios_clienteId_competencia_key" ON "honorarios"("clienteId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "cobrancas_niboDebitId_key" ON "cobrancas"("niboDebitId");

-- CreateIndex
CREATE INDEX "cobrancas_status_vencimento_idx" ON "cobrancas"("status", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "regua_passos_reguaId_ordem_key" ON "regua_passos"("reguaId", "ordem");

-- CreateIndex
CREATE INDEX "execucoes_regua_status_agendadoPara_idx" ON "execucoes_regua"("status", "agendadoPara");

-- CreateIndex
CREATE INDEX "obrigacoes_ativa_recorrencia_idx" ON "obrigacoes"("ativa", "recorrencia");

-- CreateIndex
CREATE INDEX "eventos_agenda_dataVencimento_status_idx" ON "eventos_agenda"("dataVencimento", "status");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_agenda_obrigacaoId_clienteId_dataVencimento_key" ON "eventos_agenda"("obrigacaoId", "clienteId", "dataVencimento");

-- AddForeignKey
ALTER TABLE "cliente_emails" ADD CONSTRAINT "cliente_emails_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_telefones" ADD CONSTRAINT "cliente_telefones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "socios" ADD CONSTRAINT "socios_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_tags" ADD CONSTRAINT "cliente_tags_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_tags" ADD CONSTRAINT "cliente_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_textos" ADD CONSTRAINT "tag_textos_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "contrato_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_honorarioId_fkey" FOREIGN KEY ("honorarioId") REFERENCES "honorarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regua_passos" ADD CONSTRAINT "regua_passos_reguaId_fkey" FOREIGN KEY ("reguaId") REFERENCES "reguas_cobranca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucoes_regua" ADD CONSTRAINT "execucoes_regua_reguaId_fkey" FOREIGN KEY ("reguaId") REFERENCES "reguas_cobranca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucoes_regua" ADD CONSTRAINT "execucoes_regua_passoId_fkey" FOREIGN KEY ("passoId") REFERENCES "regua_passos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucoes_regua" ADD CONSTRAINT "execucoes_regua_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucoes_regua" ADD CONSTRAINT "execucoes_regua_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "cobrancas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_observacoes" ADD CONSTRAINT "cliente_observacoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obrigacoes" ADD CONSTRAINT "obrigacoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_agenda" ADD CONSTRAINT "eventos_agenda_obrigacaoId_fkey" FOREIGN KEY ("obrigacaoId") REFERENCES "obrigacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_agenda" ADD CONSTRAINT "eventos_agenda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
