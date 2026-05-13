# Backlog pós-reunião Patrick (24/04/2026, 10:01)

Gerado a partir da transcrição completa. Cada item tem timestamp da fala original.

## Reação geral
> "Tá muito top, sem palavras, não tava esperando isso aqui" — Patrick (11:08)

MVP aprovado. Patrick vai testar, mandar a V-106 atualizada e a planilha do Marlon (mapeamento de tags).

Documentos compartilhados na reunião:
- V-106: https://docs.google.com/spreadsheets/d/1Zk8bGCSAZwGRsh3NIZ72mQlo-yBZibDG/edit
- Patrick deu acesso de leitura para `contato@batec`

---

## 📊 Status de entrega (atualizado 09/05/2026)

| Sprint | Itens | Entregue |
|---|---|---|
| Sprint 1 — pré-validação | 8 | ✅ 8/8 |
| Sprint 2 — pós-feedback | 9 | ✅ 9/9 |
| Sprint 3 — refinamentos | 8 | ✅ 8/8 |
| Sprint 4 — editor formulários | 1 | ✅ 1/1 |
| **Total backlog inicial** | **26** | **✅ 26/26 (100%)** |
| Pós-call áudio: valor atualizado + snapshot prospectivo | 1 | ✅ |
| Pós-diagnose: factory + guard rail arquitetural | 1 | ✅ |

**Pendentes (sem decisão Patrick):**
- H3 do diagnose: ambiguidade `>` vs `>=` na carência (precisa ler contrato Cestacorp)

**Roadmap futuro (sem prazo):**
- IA conversacional sobre dados do cliente
- Atendimento WhatsApp dentro do sistema (substitui Hublx)
- Integração com bureau de protesto
- Conexão Gov.br do cliente (bloqueado por LGPD)

---

## 1. CONTRATOS (alta prioridade — dor real hoje)

### 1.1. Geração em lote LGPD [10:17] — CRÍTICO
**Contexto:** Os contratos foram refeitos com cláusulas LGPD. A maioria dos clientes ainda está com versão antiga. Hoje gera 1 a 1, manualmente.
**Pedido:** "selecionar todos que eu quero gerar e ele já gera nesse novo formato"
**Ação:** Já existe `/contratos/lote` — validar fluxo, garantir que aceita templates LGPD novos.

### 1.2. Anexos em contratos [10:15]
**Contexto:** Alguns clientes têm contrato + anexo (cláusula adicional, regra especial).
**Pedido:** "menos esse anexo, esse que tem o anexo, então pensar como vai conseguir"
**Ação:**
- Adicionar campo `anexos: ContratoAnexo[]` no `ContratoTemplate`
- UI para escolher quais anexos aplicar a cada cliente na geração em lote
- Anexos são templates separados (LGPD, NDA, regra fiscal especial)

### 1.3. Cláusulas complementares por cliente [10:15]
**Contexto:** "Comercial deu desconto específico pra esse cliente, precisa entrar no contrato"
**Ação:**
- Campo `clausulasComplementares: string` (markdown/HTML) por cliente
- Aparece como bloco extra no template
- Editável na hora da geração ou na ficha do cliente

### 1.4. Vigência do valor [10:17] — IMPORTANTE
**Contexto:** Cliente pegou contrato 3 anos atrás. Valor de hoje (atualizado via reajuste no NIBO) é diferente.
**Pedido:** "Quando coloca o valor, é o atual ou o do início do contrato?"
**Ação:**
- Variável `{contrato.valorAtual}` busca do NIBO (recorrência atual)
- Variável `{contrato.valorOriginal}` mantém o do contrato
- Default: `valorAtual` (é o que ele quer pra LGPD em lote)

### 1.5. Integração Authentique [10:18] — NOVO REQUISITO
**Contexto:** "Vai gerar tudo aqui e vai me mandar por PDF? Ou vai conectar e enviar pelo Authentique?"
**Pedido:** Após gerar, opções:
- (a) Baixar PDF
- (b) Salvar pasta do cadastro do cliente
- (c) **Enviar via Authentique** (assinatura digital)
- (d) Mandar via WhatsApp e/ou email
**Ação:** Implementar `src/lib/services/authentique.ts` (substitui ou complementa ClickSign).
Docs: https://www.autentique.com.br/api

---

## 2. CADASTRO DE CLIENTES (alta — bloqueia onboarding)

### 2.1. Pré-cadastro comercial [11:18-22] — NOVO FLUXO
**Contexto crítico:** Existe etapa que NÃO está no sistema:
1. Comercial fecha venda → cria pré-cadastro mínimo (sócio, email, telefone, regime, segmento, valor honorário, categorias)
2. **Não tem CNPJ ainda** (empresa em constituição)
3. Comercial cria grupo WhatsApp + manda formulários
4. Cliente preenche formulário de sócio + formulário de empresa
5. Empresa abre na Receita → recebe CNPJ
6. Cadastro vira cliente completo

**Ação:**
- Botão **"Pré-cadastro comercial"** separado de "Novo cliente"
- Schema novo: `PreCadastro` (status: PENDENTE | EM_ABERTURA | VIROU_CLIENTE | DESISTIU)
- Filtro/aba específica em `/clientes` pra ver pré-cadastros
- Botão **"Virar empresa"** quando CNPJ chegar — converte PreCadastro → Cliente, importa dados dos formulários

### 2.2. Código sequencial auto-gerado [11:15]
**Pedido:** Ao criar cliente, sistema sugere próximo código (já existe `codigo: Int? @unique` no schema)
**Ação:** API `/api/clientes/proximo-codigo` retorna max(codigo) + 1; UI pré-preenche.

### 2.3. Múltiplos sócios + responsáveis [11:13]
**Contexto:** Cliente = Empresa, 1+ sócios.
**Pedido:**
- Cadastrar todos os sócios (já tem `Socio[]` no schema)
- Marcar **qual sócio assina contrato** (campo `assinante: boolean` no Socio)
- Responsável fiscal, responsável folha (separados)
**Ação:**
- Adicionar `assinante` no Socio
- Mapear sócios no PerfilCliente UI (selecionar quem assina)

### 2.4. Consultar CNPJ na Receita [11:25]
**Pedido:** Botão "pesquisar" no cadastro — preenche endereço, razão social, sócios, atividades direto da BrasilAPI/ReceitaWS
**Ação:** Service `consultarCnpj(cnpj)` com fallback BrasilAPI → ReceitaWS

---

## 3. WHATSAPP / GRUPOS (média — depende do Digisac)

### 3.1. Cliente = Grupo, não número individual [10:12] — IMPORTANTE
**Contexto:** Cestacorp NÃO fala com sócio individual. Fala com o grupo do WhatsApp do cliente.
**Pedido:** Cadastro do cliente tem que apontar pro **grupo**, não pro telefone do sócio.
**Ação:**
- Adicionar `whatsappGrupoId: String?` no Cliente
- Quando conectar Digisac, listar grupos disponíveis e mapear
- Régua de cobrança envia pro grupo, não pro telefone do sócio

### 3.2. Atendimento integrado [10:13] — FUTURO
**Contexto:** Cestacorp tem sistema de atendimento separado.
**Pedido:** Trazer atendimento pra dentro do sistema Cestacorp (substituir).
**Ação:** Inbox unificada via Digisac webhook. Já existe esqueleto em `/api/webhooks/digisac` — expandir.

---

## 4. AGENDA / OBRIGAÇÕES (alta — diferencial percebido)

### 4.1. Tags inteligentes por característica fiscal [10:25-26] — CRÍTICO
**Contexto:** Tags ouro/prata/bronze não bastam.
**Pedido:** Tags compostas e automáticas:
- **Regime tributário:** Simples Nacional (anexo 1-5), Lucro Presumido, Lucro Real, Carnê-Leão, MEI, Doméstico
- **Folha de pagamento:** SIM/NÃO
- **Pró-labore:** SIM/NÃO
- **Funcionário CLT:** SIM/NÃO
- **Segmento:** Tecnologia, Advocacia, Indústria, Comércio, Saúde, etc.
- **Município:** Porto Alegre, Canoas, etc. (tributos municipais)

**Ação:**
- Hoje já existe `Tag[]` mas não estruturada por categoria
- Criar `TagCategoria` enum (REGIME, FOLHA, SEGMENTO, MUNICIPIO, OURO_PRATA_BRONZE)
- UI de filtro avançado em /clientes, /agenda, /regua-cobranca/lote

### 4.2. Auto-tag por preenchimento de formulário [10:43-44] — IMPORTANTE
**Contexto:** Marlon tem planilha que mapeia: "tem folha?" → tag, "tem funcionário?" → tag
**Pedido:** Quando cliente preenche formulário, sistema já tagga automaticamente
**Ação:**
- Já existe `RegraTag` no schema → expandir UI em `/tags/regras`
- Patrick vai mandar a planilha do Marlon

### 4.3. Avisos no dia do vencimento, segmentados por tag [10:24-26]
**Pedido:**
- DAS dia 20 → só clientes Simples Nacional
- INSS dia 20 → só clientes com folha
- FGTS dia 20 → só com funcionário
- IRPF abril → só pessoa física

**Ação:**
- Cada `Obrigacao` tem campo `tagsRequeridas: Tag[]`
- Engine só dispara para clientes que têm TODAS as tags requeridas

---

## 5. NF-E / XML (média — depende de LGPD)

### 5.1. Conexão Gov.br do cliente — BLOQUEADO POR LGPD [10:21-22]
**Contexto:** Ideal seria puxar XMLs do gov.br do cliente. Patrick: "a gente não tem por conta de LGPD"
**Caminho atual da Cestacorp:** procuração ou certificado digital do cliente
**Ação:**
- Não implementar agora
- Documentar como limitação e seguir com **upload manual em lote**

### 5.2. Upload em massa de XMLs [10:22]
**Pedido:** "Eu teria que pegar o banco de todos os XML jogar aqui dentro"
**Ação:** Já funciona em `/notas-fiscais/importar` (60 arquivos / 10 min). **Aumentar limite para 500 arquivos** e adicionar progress bar real (chunks de 20).

---

## 6. PORTAL DO CLIENTE

### 6.1. REMOVER login Gov.br [11:01] — RÁPIDO
**Contexto:** Cliente esquece senha gov.br, dá problema.
**Ação:**
- Esconder botão "Entrar com Gov.br" do `/portal/login`
- Manter o código (caso volte a precisar)

### 6.2. Documentos do cliente no portal [11:04]
**Pedido:** Cliente vê não só boletos, mas também:
- Guias de imposto pra pagar
- Certidões emitidas
- Documentos enviados pela Cestacorp
**Ação:**
- Aba **"Meus documentos"** no portal
- Upload pela equipe (já tem em `/uploads`) → categoriza por cliente + tipo
- Cliente baixa do portal

### 6.3. Botão de exclusão LGPD [11:03]
**Pedido:** Cliente solicita exclusão dos próprios dados (LGPD)
**Ação:**
- Botão "Solicitar exclusão de dados" no portal
- Email pra equipe + log auditado
- NÃO apaga automaticamente — gera ticket pra revisão

---

## 7. RELATÓRIOS (média)

### 7.1. Relatório mensal de movimentação [10:50] — REUNIÃO MENSAL
**Contexto:** Patrick faz reunião dia 4 com equipe usando esse relatório.
**Pedido:**
- Quantos clientes entraram no mês, por regime
- Quantos saíram no mês, com motivo (rescisão pelo cliente, encerramento)
- Lista nominal

**Ação:** Nova rota `/relatorios/movimentacao` com filtro mês/ano + export PDF.

### 7.2. Histórico anual [10:53]
**Pedido:** Faturamento por segmento, clientes por categoria, evolução por ano
**Ação:** `/relatorios/historico` com gráficos year-over-year.

### 7.3. IA conversacional [10:46] — ROADMAP
**Pedido:** Perguntar via chat: "quantos clientes ativos em Porto Alegre são Simples Nacional?"
**Ação:** Já mapeado por Douglas como segunda fase. Usar Claude API com tool use sobre o banco.

---

## 8. RÉGUA DE COBRANÇA

### 8.1. Anotação para futuro: integração protesto [10:31]
**Status:** Roadmap futuro, não agora.

### 8.2. Aniversário do sócio + da empresa [10:32-33]
**Pedido:**
- Mensagem aniversário sócio → vem do formulário
- Mensagem aniversário empresa → data de constituição
**Ação:**
- Cron diário verifica `aniversarioSocio === hoje` e `dataConstituicao.mesDia === hoje`
- Templates já existem na biblioteca

---

## 9. INTEGRAÇÕES PRIORITÁRIAS

### 9.1. Authentique API [10:18] — PRIORIDADE 1
- Doc: https://docs.autentique.com.br
- Substitui ou complementa ClickSign
- Já temos esqueleto em `src/lib/services/assinatura.ts`

### 9.2. V-106 Google Sheets [acesso compartilhado]
- Patrick: "está compartilhada como leitor pra `contato@batec`"
- Importar todas as abas (não só CLIENTES) para mapear:
  - Tarefas/checklist do Marlon (gerar tags)
  - Histórico de aquisições/rescisões
  - Indicadores qualitativos

---

## 10. DETALHES MENORES

| # | Item | Local | Esforço |
|---|------|-------|---------|
| 10.1 | Filtro de período no dashboard (7/14/30/90/custom) | `/dashboard` | 30min |
| 10.2 | Mais variáveis nas tags (tag específica do cliente) | `/regua-cobranca` | 1h |
| 10.3 | Reajuste com índices customizados pelo usuário | `/configuracoes/reajustes` | 2h |
| 10.4 | Pix Copia-e-Cola e linha digitável puxando do NIBO | nfe/cobranca | 1h |
| 10.5 | Direito de cliente fora WhatsApp marcar como inválido | régua | 30min |
| 10.6 | Calendário separado por tag (Simples vs Presumido) | `/configuracoes` ICS | 2h |
| 10.7 | Editar formulários (remover senha do gov, etc) | `/formularios/[id]/editar` | 2h |
