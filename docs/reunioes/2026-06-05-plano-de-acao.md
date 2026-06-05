# Plano de Ação — Reunião Cestacorp 05/06/2026 (15:38–17:27)

**Participantes:** Patrick Dartora, Paulo Vitor, Douglas Costa
**Foco:** Devolutiva das melhorias + alinhamento de próximos passos com base no uso real do Patrick.

---

## 1. Itens RESOLVIDOS ao vivo (não precisa fazer nada)

### ✅ Webhook Autentique configurado em produção
- **URL cadastrada no painel:** `https://cestacorp.bahflash.tech/api/webhooks/autentique`
- **Eventos marcados:** `document.signed`, `document.update`, `document.delete`, `cliente.update`, `cliente.delete`
- **Eventos NÃO marcados:** `document.finish` (finaliza automático)
- **Patrick colou o token/secret no painel da Autentique:** `01KTCMJFM399A7D5287VT6QQJ5`
- ⚠️ **Ação pendente:** confirmar com Patrick se esse valor é o **secret do webhook** (HMAC) ou **token de API**. Se for secret, precisa ser colado em `AUTENTIQUE_WEBHOOK_SECRET` no EasyPanel também. Verificar em `/configuracoes/webhooks` se aparece como "OK" depois do primeiro evento.

### ✅ Google Workspace SMTP configurado
- Patrick criou app password no Google: https://myaccount.google.com/apppasswords
- Nome do app: `V106`
- Senha de 16 caracteres copiada
- Patrick (16:47): *"isso ficou perfeito, era isso mesmo que a gente sabe"*
- ⚠️ **Confirmar:** as envs `SMTP_HOST/PORT/USER/PASS/FROM` foram coladas no EasyPanel? Senão, o sistema ainda não consegue mandar email — fechar #17 só depois de testar.

### ✅ Portal do cliente testado funcionando
- Patrick acessou `/configuracoes/portal-cliente`
- Gerou link de "renovar acesso" da Cestacorp
- Abriu o link, criou senha (≥8 chars), entrou no portal
- Viu boletos, formulários, contratos, "meus dados"
- **Confirmou que a tela criada ontem (commit 8304d28) resolveu o problema de demonstrar sem SMTP.**

---

## 2. Decisões importantes da reunião

### Decisão A — Cliente com múltiplos serviços = um único CNPJ + PLANOS

**Contexto:** Patrick (15:39) trouxe que dentro da Cestacorp existem **2 macroprodutos**:
1. Contabilidade (responsabilidade fiscal/folha/contábil)
2. Gestão de consultório (gestão de agenda/cobrança/contratos)

Algumas empresas consomem só um, outras consomem os dois. Hoje na planilha V-106 a mesma empresa aparece em **duas linhas** porque é contada como dois clientes pra fins de classificação/rentabilidade. Mas:
- É **um CNPJ só**
- No NIBO chega como **um faturamento único** (soma dos dois)
- Cliente pode **cancelar só um dos dois** e continuar com o outro

**Decisão final (Paulo + Patrick):**
> Modelar como **PLANOS/SERVIÇOS** dentro do mesmo Cliente. Cliente único no banco, com lista de "contratos ativos" (cada um sendo um plano). Cancelamento independente, com rastreabilidade de "cancelou plano X em DD/MM, continuou com plano Y".

### Decisão B — Renomeador Universal: NF primeiro, depois generaliza

**Contexto:** Patrick (16:53) propôs: em vez de "renomeador só de NF", fazer um motor **universal** que aceita qualquer tipo de documento (NF, IR, comprovantes…), o usuário seleciona o tipo, e o motor sabe quais campos extrair pra cada um.

**Decisão final (Patrick 16:58):**
> *"Se não for nesse momento, é melhor a gente começar com a nota fiscal. Esse é hoje o gargalo de renomear nota fiscal."*

✅ Mantém renomeador de NF como está hoje.
🔜 Douglas (16:58): *"Deixa pra nós aqui que a gente já volta com esse tema de casa pra analisar algo mais padronizado."*

### Decisão C — Notificações automáticas: NADA enviado até validação completa

**Douglas (16:51):** *"a gente assegura bem antes de ativar... até a gente tiver com sistema 100% validado ali do teu lado."*

✅ Sistema continua em modo "demo/dry-run" — agenda, régua, obrigações criam registros mas **nenhum envio real pra cliente**. Botão de "ativar produção" no futuro.

### Decisão D — Formulários: comercial DEVE fazer pré-cadastro antes

**Patrick (17:10–17:12) estabeleceu o fluxo correto:**

1. **Comercial fecha venda** → cria PreCadastro com mínimo de dados (nome, CPF/email/tel, tipo de serviço)
2. **Controles internos** chama o cliente, pede pra preencher formulário (link)
3. **Cliente preenche formulário** → resposta chega no sistema
4. **Equipe associa a resposta** ao PreCadastro existente (ou Cliente fixo se for recorrente)
5. **Cadastro é atualizado** com os dados do formulário

**Exceções:**
- Carnê-Leão = só CPF, pessoa física (nunca CNPJ)
- Abertura de empresa = PreCadastro (não vira Cliente fixo até processo terminar)
- Sócio sendo cadastrado em formulário = associa ao Cliente PJ existente

### Decisão E — Obrigações: foco é WHATSAPP com antecedência, não calendário

**Patrick (16:04–16:05) esclareceu** o que ele entende como utilidade do módulo de Obrigações:

- ❌ NÃO é só criar registro tipo "DAS vence dia 20"
- ✅ É: lembrete vai com antecedência configurável (ex: dia 15) via **WhatsApp**
- ✅ É: pode opcionalmente criar evento no **calendário do cliente** (Outlook/Google)
- ✅ O "36 eventos" que Patrick viu = 36 clientes vinculados àquele lembrete (não 36 disparos pro mesmo cliente)

---

## 3. Bugs identificados na demo

### 🐛 BUG-1 (P0): Botão "Aplicar ao cadastro" no formulário não funciona
- **Onde:** Tela de formulários respondidos → resposta individual
- **O que acontece:** botão azul "Aplicar ao cadastro" aparece, Patrick clicou várias vezes, nada aconteceu
- **Esperado:** clicar deveria criar Cliente novo OU associar a Cliente/PreCadastro existente
- **Investigar:** `src/app/(app)/formularios/respostas/[id]/` — provavelmente handler está com console.log e nunca submeteu

### 🐛 BUG-2 (P1): Formulário criou Cliente novo em vez de associar como sócio
- **Cenário:** Patrick preencheu formulário "Dados de Sócio" usando o nome dele, sem antes fazer pré-cadastro do cliente Cestacorp
- **O que aconteceu:** Sistema criou um **novo cliente "Patrick"** em vez de adicionar como sócio da Cestacorp
- **Causa:** sistema não tem como saber pra qual cliente associar — fluxo do BUG-1 deveria resolver isso (modal "vincular a cliente existente")

### 🐛 BUG-3 (P2): Lista de clientes não tem ação rápida pra excluir
- **Patrick (17:18):** *"como é que eu excluo esse cliente?"*
- **Resposta atual:** já existe soft-delete em `/configuracoes/lixeira` (com janela de 30 dias) — mas falta visibilidade
- **Ação:** adicionar ícone de lixeira na ficha do cliente (`/clientes/[id]`) com confirmação Radix Dialog, redirecionando para a lixeira pra reverter

### 🐛 BUG-4 (P2): Busca principal não mostra código do cliente
- **Douglas (16:51):** *"ah ter o código aqui no filtro, né, pra já aparecer o código do cliente"*
- **Onde:** `/clientes` campo de busca — quando busca por nome aparece só razão social, falta o código (#)
- **Ajuste rápido:** mostrar `#123 — RAZÃO SOCIAL` no dropdown de sugestão

---

## 4. Features novas decididas

### 🆕 FEAT-1 (P0): Modelo "Plano/Serviço" por cliente

**Schema mudança:**
```prisma
model PlanoCliente {
  id              String          @id @default(cuid())
  clienteId       String
  servicoId       String          // FK CatalogoServico
  status          StatusPlano     // ATIVO | SUSPENSO | CANCELADO
  dataInicio      DateTime
  dataCancelamento DateTime?
  motivoCancelamento String?      @db.Text
  valorMensal     Decimal         @db.Decimal(14, 2)
  contratoId      String?         // FK Contrato
  observacao      String?         @db.Text
  cliente         Cliente         @relation(...)
  servico         CatalogoServico @relation(...)
  contrato        Contrato?       @relation(...)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

enum StatusPlano {
  ATIVO
  SUSPENSO
  CANCELADO
}
```

**UI:**
- Na ficha do cliente, novo card **"Planos contratados"** mostrando:
  - Linha por plano: Contabilidade R$ 600/mês — ativo desde 01/03/2024
  - Linha por plano: Gestão de Agenda R$ 200/mês — cancelado em 15/05/2025 (motivo)
  - Botão "Adicionar plano"
  - Botão "Cancelar plano" em cada linha (com motivo + data efetiva)

**NIBO:**
- Reajuste agora opera POR plano (não mais por cliente inteiro)
- Sync NIBO continua somando todos os planos ATIVOS do cliente (faturamento único)

**Migração:**
- Importador V-106 cria 1 PlanoCliente por linha onde o cliente aparece (usar coluna `seguimento`/`categoria` pra identificar qual serviço)
- Reajustes históricos migram pra `PlanoCliente.reajustes` (drop `Cliente.honorarioInicial`)

### 🆕 FEAT-2 (P0): Botão "Vincular resposta a cliente existente"

**Onde:** `/formularios/respostas/[id]`

**UI proposta:**
```
[Resposta de formulário "Dados de Sócio" — Marieli Santos]

┌─ Cadastrar como ─────────────────────────────┐
│  ○ Vincular a cliente existente              │
│    [🔍 Buscar cliente por código/CNPJ/nome]  │
│                                              │
│  ○ Vincular a pré-cadastro existente         │
│    [🔍 Buscar pré-cadastro]                  │
│                                              │
│  ○ Criar cliente novo (pessoa física)        │
│    Use só para Carnê-Leão / IR sem CNPJ      │
│                                              │
│  ○ Criar pré-cadastro novo                   │
│    Use só se comercial esqueceu de criar     │
│                                              │
│  [Aplicar]                                   │
└──────────────────────────────────────────────┘
```

**Backend:**
- POST `/api/formularios/respostas/[id]/vincular` com `{ tipo, alvoId }` ou `{ criarNovo: "cliente" | "precadastro" }`
- Audita ação (LGPD)
- Marca resposta como `APLICADO`

### 🆕 FEAT-3 (P1): Editor visual de formulários

**Patrick (17:17):** *"eu preciso incluir mais informações"* (em formulários existentes)

**Hoje:** Patrick consegue criar formulário novo, mas não consegue editar os que já existem (campos fixos no código).

**Pedido:**
- Editor visual em `/formularios/definitions/[id]/editar`
- Drag-and-drop de campos (texto, número, e-mail, seleção, data, upload)
- Cada campo: label, placeholder, obrigatório, regex de validação
- Botão "Duplicar formulário" pra usar como base
- Versionar (não quebrar respostas antigas — campos novos ficam vazios no histórico)

**Patrick vai mandar:**
- Estrutura dos formulários atuais (abertura empresa, dados de sócio, etc.) com campos que ele quer
- Lista de tipos de formulário a serem cadastrados

### 🆕 FEAT-4 (P1): Refazer fluxo de Obrigações → Lembrete antecedente

**Patrick (16:04):** o modelo atual confunde porque parece criar "tarefa" da equipe, quando na verdade ele quer:

**Fluxo desejado:**
1. Cadastrar uma obrigação com:
   - Nome: "DAS - Simples Nacional"
   - Vencimento: dia 20 de todo mês
   - **Antecedência do lembrete:** 5 dias antes (configurável por obrigação)
   - **Canais:** WhatsApp + email + agenda iCal
   - **Tags requeridas:** `simples-nacional`
   - **Tags excluídas:** `inativo`

2. Sistema gera automaticamente para CADA cliente que bate nas tags:
   - **Dia 15:** dispara mensagem via Digisac (texto da TagTexto vinculada)
   - **Dia 15:** envia evento .ics para email do cliente (opcional, se ele tiver marcado preferência)
   - **Dia 20:** marca como "vencido" se cliente não acusou recebimento

3. Lista de "36 eventos" hoje = mostra os 36 clientes com aquela obrigação no mês, não 36 disparos pra um único cliente

**Mudança no schema (já existe maior parte):**
- `Obrigacao.antecedenciaDias` já existe ✅
- Adicionar `Obrigacao.canais: String[]` = `["whatsapp", "email", "ics"]`
- Adicionar `Obrigacao.tagTextoId?` apontando pra mensagem padrão

**UI:**
- Reescrever explicação na tela de obrigações pra deixar claro: "Lembrete antecipado pro cliente, não tarefa da equipe"
- Cabeçalho da listagem: "36 clientes serão notificados em 15/06" (em vez de "36 eventos")

### 🆕 FEAT-5 (P2): Centralizar TODOS os documentos do cliente no portal

**Patrick (17:25):** *"Centralizar de repente os documentos do cliente aqui... pode colocar em vez de contrato no geral 'Documentos'"*

**Mudança:**
- Item de menu `/portal/contratos` vira `/portal/documentos`
- Suporta: contratos, comprovantes enviados pelo cliente, IR, NF, atas, certidões, qualquer upload
- Filtro por tipo + busca por nome + período
- Cliente consegue baixar tudo em ZIP (portabilidade LGPD Art. 18 V já implementado, agora aplicado ao portal)

### 🆕 FEAT-6 (P3): Renomeador Universal (depois que NF estiver estabilizado)

**Douglas vai analisar fora da reunião** e voltar com proposta. Plano técnico:

- Tabela `TipoDocumento` com `slug`, `nome`, `camposExtrair[]`, `padraoNome`
- Tela de renomeação ganha select "Tipo de documento" antes do upload
- IA recebe `tipoDocumento` no prompt e foca nos campos certos
- Padrão de nome também por tipo (ex.: IR = `CPF AAAA-AAAA RECIBO IR.pdf`)

---

## 5. Pendências do PATRICK (bloqueios)

| # | Item | Status |
|---|---|---|
| P1 | Compartilhar pasta Drive com equipe + mandar link | 🟡 começou em 16:38 — confirmar se enviou |
| P2 | Confirmar valor do `AUTENTIQUE_WEBHOOK_SECRET` (se o `01KTCMJFM399A7D5287VT6QQJ5` é o secret ou só token) | 🔴 não confirmado |
| P3 | Confirmar que envs SMTP_* estão no EasyPanel + redeploy feito | 🟡 app password gerado, falta colar no EasyPanel |
| P4 | Mandar estrutura dos formulários atuais (campos faltantes) | 🔴 vai mandar |
| P5 | Mandar planilha de "regras Marlon" (RegraTag) (#19) | 🔴 sem prazo |
| P6 | Mandar tabela de mensagens de obrigação (#18) | 🔴 sem prazo |
| P7 | Mandar número WhatsApp Digisac + token (#7) | 🔴 sem prazo |
| P8 | Criar documento próprio com feedback/ideias (Patrick 17:26) | 🔴 Patrick vai criar |

---

## 6. Ordem de implementação sugerida (sprint começando 06/06/2026)

### Semana 1 (06–12/06) — Desbloquear demos e corrigir bugs
1. ✅ **BUG-1** Aplicar ao cadastro não funciona (1 dia)
2. ✅ **FEAT-2** Vincular resposta a cliente/pré-cadastro existente (2 dias)
3. ✅ **BUG-3** Botão excluir cliente visível na ficha (0,5 dia)
4. ✅ **BUG-4** Código do cliente no campo de busca (0,5 dia)
5. ✅ **FEAT-4** Refazer texto das telas de obrigações (1 dia)

### Semana 2 (13–19/06) — Estruturar modelo de Planos
6. ✅ **FEAT-1** Migração Prisma: `PlanoCliente` (2 dias)
7. ✅ Importador V-106 atualizado pra criar planos (1 dia)
8. ✅ Card "Planos contratados" na ficha do cliente (1 dia)
9. ✅ Refazer sync NIBO pra somar planos ativos (1 dia)

### Semana 3 (20–26/06) — Editor de formulários
10. ✅ **FEAT-3** Editor visual (UI drag-and-drop) (3 dias)
11. ✅ Versionamento de formulários (1 dia)
12. ✅ Cadastro dos 5 formulários que Patrick mandar (1 dia)

### Semana 4 (27/06–03/07) — Portal + obrigações
13. ✅ **FEAT-5** Documentos centralizados no portal (2 dias)
14. ✅ **FEAT-4** Canais de envio + iCal por obrigação (2 dias)
15. ✅ Texto explicativo no módulo Obrigações (1 dia)

### Semana 5+ — Backlog
- **FEAT-6** Renomeador Universal (aguarda análise do Douglas)
- IA Tier 2 (pacote comercial — resumo executivo mensal, score de inadimplência, etc.)

---

## 7. Tasks a criar no tracker

| ID novo | Título | P |
|---|---|---|
| #88 | BUG: Botão "Aplicar ao cadastro" formulário não faz nada | P0 |
| #89 | FEAT: Vincular resposta de formulário a cliente/pré-cadastro existente (modal busca) | P0 |
| #90 | UX: Ícone excluir cliente visível na ficha (redirecionar pra Lixeira) | P1 |
| #91 | UX: Mostrar código do cliente no campo de busca principal | P2 |
| #92 | FEAT: Modelo PlanoCliente — cliente único com N planos canceláveis | P0 |
| #93 | FEAT: Editor visual de formulários (drag-and-drop) | P1 |
| #94 | FEAT: Refazer fluxo de Obrigações — lembrete antecipado (WhatsApp + iCal) | P1 |
| #95 | FEAT: Portal cliente — centralizar TODOS documentos (não só contratos) | P2 |
| #96 | FEAT: Renomeador Universal (analisar com Douglas antes) | P3 |

---

## 8. Quotes importantes da reunião (pra referência futura)

> **Patrick (15:39) sobre múltiplos serviços:**
> *"Dentro da ação a gente tem dois grandes macroprodutos: a gente faz responsabilidade e a gente faz gestão de consultório. Então a gente conta ela como dois clientes, ela é um cliente de contabilidade e ela é um cliente de gestão de agenda. Ela pode rescindir o contrato de gestão de agenda e continuar com a contabilidade ou vice-versa."*

> **Paulo (15:59) sobre a solução:**
> *"A gente consegue colocar como se fosse plano, sabe, dentro do sistema. Então você tem um plano de agenda, tem um plano de contabilidade... ele consegue ter um ou dois, em vez de criar dois clientes pra isso, enche o banco. A gente consegue colocar planos."*

> **Patrick (16:04) sobre obrigações:**
> *"A guia do DAS vence no dia 20, a minha operação não vai mandar no dia 20, ela manda no dia 15 pro cliente."*

> **Patrick (16:05) sobre canais:**
> *"A ideia principal era avisar eles dentro do WhatsApp."*

> **Patrick (16:58) decidindo simplicidade:**
> *"Se não for nesse momento, é melhor a gente começar com a nota fiscal. Esse é hoje o gargalo de renomear nota fiscal."*

> **Patrick (17:09) sobre fluxo de pré-cadastro:**
> *"Tu vai precisar vincular a um cliente. Exemplo: o cliente fechou, o Paulo fechou a admissão da doméstica dele lá. Mas antes disso o comercial deveria ter feito o pré-cadastro do Paulo."*

> **Patrick (17:25) sobre portal evoluindo:**
> *"Centralizar de repente os documentos do cliente aqui... pode colocar em vez de contrato no geral 'Documentos'."*

---

**Documento gerado a partir da transcrição completa de 569 linhas (15:38 → 17:27).**
**Próxima reunião:** semana que vem (Douglas vai mandar tema de IA Universal e roadmap).
