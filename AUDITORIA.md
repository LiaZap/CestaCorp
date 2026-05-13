# 🔍 Auditoria Sênior Multi-Agente — Cestacorp

> Revisão feita por **8 agentes em paralelo**, cada um auditando uma fatia do sistema. Abaixo os achados críticos, organizados por severidade. Tudo verificado contra o código real em `src/`.

---

## 🚨 BLOQUEADORES (crítico — fazer antes de qualquer cliente pagante)

### 1. Autorização por escopo inexistente nas APIs (Segurança)
**O problema que dói mais.** Hoje qualquer usuário logado consegue puxar dados de qualquer cliente.

| Arquivo | Linha | Risco |
|---|---|---|
| `src/app/api/clientes/[id]/route.ts` | 27–32 | Valida sessão mas **não** valida se `session.user.clienteId === params.id`. Cliente B vê dados do A. |
| `src/app/api/portal/contratos/[id]/download/route.ts` | 16 | Checa cliente por `session.user.clienteId` mas `params.id` é contratoId — path traversal |
| `src/app/api/reguas/enviar-ad-hoc/route.ts` | 23–35 | Busca cliente por id sem validar propriedade — cliente A envia WhatsApp por B |
| `src/app/api/search/clientes/route.ts` | 12–24 | Retorna lista global sem filtro por `session.user.tipo` |
| `src/app/api/reajustes/propostas/route.ts` | 18+ | POST aplica reajuste sem validar permissão — qualquer logado altera honorário |
| `src/lib/services/notifications.ts` | 27–35 | `$or: [{ userId: null }, { userId }]` expõe broadcasts globais |

**Violação LGPD direta.** Fix: helper `assertOwnership(session, resourceType, resourceId)` chamado em cada API, e RBAC real (enum `UserRole` já existe mas é decorativo).

### 2. Tokens de integração em `.env` plaintext
**Arquivo:** `.env` linhas 9–12.  
`NIBO_TOKEN` e `DIGISAC_TOKEN` são credenciais com acesso total a financeiro e WhatsApp. Hoje ficam em `.env` comitável. Qualquer dev ou container comprometido extrai e:
- Lista/modifica contas a receber no Nibo
- Dispara WhatsApp em massa no Digisac com identidade da Cestacorp
- Reajusta clientes no Nibo

**Fix:** migrar para secrets do EasyPanel/AWS Secrets Manager + criptografia no banco se forem editáveis via UI.

### 3. Webhooks públicos sem verificação HMAC
**Arquivos:** `/api/webhooks/nibo/route.ts` e `/api/webhooks/digisac/route.ts`, liberados em `auth.config.ts:46`.  
`src/lib/services/nibo.ts:110–113` tem `verificarAssinaturaWebhook()` que retorna `true` sempre.

Atacante envia POST falso marcando cobrança como **PAGA** → sistema cancela régua + para de cobrar. Fraude evidente.

**Fix:** HMAC SHA256 com segredo compartilhado, rejeitar requests sem header ou com assinatura inválida.

### 4. EnvioAgendado (lote agendado) nunca é consumido
**Arquivo:** `src/models/EnvioAgendado.ts`. Schema completo com status `AGENDADO/EM_EXECUCAO/CONCLUIDO`.

**Problema:** `rodarReguaDiaria()` em `regua-cobranca.ts:327` **nunca** consulta essa coleção. O botão "Agendar para data futura" cria o documento, mas ele fica eternamente pendente. **A feature é fake.**

**Fix:** adicionar no cron uma etapa `processarAgendamentosPendentes()` que busca `EnvioAgendado` com `agendadoPara <= agora` e status `AGENDADO`, processa, marca `CONCLUIDO`.

### 5. Validação de CPF/CNPJ inexistente
**Arquivos:**
- `src/app/api/forms/responses/[id]/aplicar/route.ts:36–41` — remove não-numéricos, não valida dígitos
- `src/app/api/clientes/importar/route.ts` — regex cega, aceita `000.000.000-00`

**Risco:** fraude, clientes duplicados com CNPJ malformado, base poluída.

**Fix:** biblioteca `cpf-cnpj-validator` (2 linhas) em todos os pontos de entrada.

### 6. Condição de corrida na geração de execuções da régua
**Arquivo:** `src/lib/services/regua-cobranca.ts:123–150`. Loop faz `find` e depois `create` sem transação nem constraint UNIQUE. Dois cron rodando (EasyPanel retry ou dev + prod) criam execuções duplicadas → cliente recebe mensagem 2x.

**Fix:**
1. Adicionar `@@unique([reguaId, passoId, cobrancaId, clienteId])` no Prisma
2. Envolver em `prisma.$transaction`

### 7. Idempotência de reenvio quebra auditoria
**Arquivo:** `src/app/api/reguas/execucoes/[id]/reenviar/route.ts:19`  
`data: { status: "PENDENTE", enviadoEm: null, erro: null }` — apaga histórico da primeira tentativa. Impossível auditar múltiplas tentativas.

**Fix:** criar campo `tentativas: Json[]` com `{ enviadoEm, status, erro }[]` ao invés de sobrescrever.

---

## 🔴 ALTA PRIORIDADE (antes de 1ª apresentação séria)

### Segurança
- [ ] **Rate limiting** em `/api/portal/auth/*` (brute force contra senhas de clientes). Upstash free já resolve.
- [ ] **Revogação de tokens** — `tokenConvite` e `tokenReset` em `cliente-auth.ts` não viram inválidos após 1º uso, podem ser reutilizados até expirar.
- [ ] **Validação Zod server-side** em formulários públicos. `FormRenderer.tsx:41` envia sem validar tipos no servidor.
- [ ] **2FA TOTP** para admins da equipe (~6h de trabalho).
- [ ] **CSRF** em formulários públicos — hoje aceitam POST de qualquer origem.

### Régua de Cobrança (módulo core)
- [ ] **Sem horário comercial** — pode disparar WhatsApp domingo 23h. Adicionar `respeitarJanelaComercial(date)` antes de agendar.
- [ ] **Sem retry exponencial** — falha transiente de Digisac vai direto para ERRO sem retry. Implementar 3 tentativas (60s, 300s, 900s).
- [ ] **Webhook de pagamento Nibo ignorado em tempo real** — sync só roda 1×/dia via cron; cliente que paga às 14h recebe cobrança no próximo dia.
- [ ] **Sem rate limiting na API Digisac** — se dispara 1000 msgs em loop, Digisac devolve 429. Adicionar debounce 500ms entre sends.
- [ ] **Duplo envio** — entre "enviou no Digisac" e "update no BD" pode haver crash, usuário recebe mensagem 2x. Usar `$transaction` ou idempotency key.

### Módulo Clientes
- [ ] `take: 100` hardcoded em `clientes/page.tsx:24` sem paginação server-side
- [ ] **Dashboard sem cache** — 8 queries pesadas a cada visita, sem Redis. Cache simples `Map+TTL` já reduz 70%.
- [ ] **Sem audit log** em edições (`/api/clientes/[id]` PUT) — quem mudou valor de honorário? Nunca saberemos.
- [ ] **Importador engole erros** silenciosamente (`catch(e) { ignorados++ }` em `importar/route.ts:86`). Precisa retornar qual linha falhou e por quê.
- [ ] **Transação da edição incompleta** — `[id]/route.ts:62–84` atualiza email/telefone em queries separadas dentro da transação, se `emailPrincipal` vier vazio não limpa os antigos.

### Contratos
- [ ] **Numeração automática inexistente** — usa `c.id.slice(0, 8)`. Faltam `CTR-2026-0001` sequenciais.
- [ ] **Sem versionamento de template** — se editar template depois, contratos antigos ficam órfãos. Adicionar `templateVersion: string` na tabela.
- [ ] **Batch sem transação** — `BatchContratoForm.tsx:61–81` falha no #50/100 e não faz rollback dos 49 já criados.
- [ ] **Fallback silencioso PDF→.docx** — header `X-PDF-Fallback` mas usuário não sabe que baixou docx esperando PDF.

### Agenda
- [ ] **Recorrência TRIMESTRAL quebrada** — `agenda.ts:59–67`: loop usa `m += 3` dentro de array e não incrementa ano, gera só 4 datas max.
- [ ] **Deduplicação manual frágil** — upsert por `obrigacaoId + clienteId + dataVencimento`; se N-N cria duplicatas.

### Notificações
- [ ] **Polling 60s** em `NotificationBell.tsx:43` — em produção com N usuários fica pesado. WebSocket/SSE.
- [ ] **API `/api/notifications/[id]/read` sem auth check** visível.

---

## 🟠 MÉDIA PRIORIDADE (polish pro SaaS pagar)

### UX/Mobile
- [ ] **Sidebar desaparece** abaixo de `lg` sem substituto. **Crítico**: sem menu alternativo no mobile. Fazer drawer hamburguer ou bottom tab bar.
- [ ] Todas as **tabelas** (`clientes`, `contratos`, `agenda/obrigacoes`, relatórios…) usam `overflow-x-auto`. Em mobile vira scroll horizontal puro — devem virar **cards** ou lista quando `< 768px`.
- [ ] **HeatmapHorarios** força `min-w-[640px]` — inútil em mobile.
- [ ] **Empty states genéricos** em 7 lugares ("Nada aqui"). Transformar em ilustração + CTA.
- [ ] **Sem skeletons** — toda navegação tem tela branca por ~1s antes de renderizar.
- [ ] **Dark mode infraestrutura pronta mas sem toggle**. 2–3h de trabalho.
- [ ] **ARIA labels ausentes** nos botões icon-only (NotificationBell, Avatar). Acessibilidade básica.

### Portal do Cliente
- [ ] Dashboard do portal é simples demais — faltam gráficos próprios do cliente.
- [ ] Sem upload de documentos (cliente mandar NF pelo portal).
- [ ] Sem chat/ticket com equipe.
- [ ] **Paginação em formulários respondidos** — se 1000, carrega todos.

### Formulários públicos
- [ ] **Upload real de arquivos** — hoje só guarda o nome. Sem S3/MinIO, feature incompleta.
- [ ] **Sem CAPTCHA / honeypot** — spam.
- [ ] **Sem limite de tamanho** no upload (`importar-google/route.ts:12–22`) — DoS via arquivo gigante.
- [ ] **Validação tipo real** (CPF/CNPJ/CEP/email) só no cliente.
- [ ] **Sem salvamento parcial** — se fecha aba, perde tudo.
- [ ] **Sem BrasilAPI + ViaCEP** pra autopreenchimento.

### Observabilidade
- [ ] **Zero logging estruturado**. Em produção, se cron falhar, ninguém sabe.
- [ ] **Sem Sentry**. Erros de produção só aparecem no log do container.
- [ ] **Sem health check endpoint** (`/api/health`) — EasyPanel não sabe se app travou.
- [ ] **Sem init system** no Dockerfile — se Node trava, container não reinicia sozinho.

### Performance
- [ ] **Índices faltando** em `schema.prisma`:
  - `Cobranca(clienteId, status)` — combinado
  - `Honorario(clienteId, status)` — combinado
  - `ClienteAcesso.email` já tem (`@unique` dá index), mas `lower(email)` útil para case-insensitive
- [ ] **N+1 óbvio** no importador V106 — um findUnique + create/update por linha.

### DX / Testes
- [ ] **Zero testes**. Suite mínima (Playwright):
  - `auth.test`: cliente A não consegue ver dados do B
  - `regua.test`: geração não duplica, idempotência
  - `webhooks.test`: NIBO/Digisac rejeitam assinatura inválida
- [ ] **Sem CI/CD**. GitHub Actions mínimo: lint + build + migrate test.
- [ ] **Sem Storybook** para isolar componentes visuais.

---

## 🟢 BAIXA (nice to have)

- Dashboard: comparativos mês a mês, sparklines nos KPIs, export PDF, widgets drag-drop.
- Tags: regras automáticas (auto-aplicar "INADIMPLENTE" aos 7d de atraso).
- Reajuste: comunicação automática do reajuste ao cliente (carta PDF + WhatsApp).
- Relatórios: report builder, export PDF com marca, agendamento de envio.
- Configurações: CRUD de usuários, backup botão, SMTP via UI.

---

## 🏆 Benchmark do mercado brasileiro (2026)

### Concorrentes diretos & preços

| Sistema | Preço | Força | Fraqueza | WhatsApp |
|---|---|---|---|---|
| **Domínio** (TR) | R$ 400–1.200 | Fiscal/folha/SPED completo | UX 2000, desktop pesado, caro | Não nativo |
| **Alterdata** | R$ 300–900 | Modular, preço | Instabilidade crônica, suporte fraco (RA 6.9) | IA limitada (FAQ) |
| **Nibo** | R$ 150–500 | Régua de obrigações, UX decente | Sem fiscal/folha próprios | Via Zapier/Pluga |
| **Conta Azul** | R$ 129–600 (cliente PME) | UX top do legado, bancos | É ERP da PME, não do escritório | Integrações externas |
| **Omie** | R$ 97–600 | ERP + comando WhatsApp nativo | UI carregada, SPED fraco | **Sim, nativo (voz/texto)** |
| Contabilizei | R$ 195–239/mês p/ PME | Self-service digital | Reclamações de cobrança retroativa | Não |
| Questor/Gestta/Contmatic | Cotação | Regionais tradicionais | UX datada | Gestta tem plugin |

### Lacunas claras do mercado
1. **WhatsApp como hub central** de operação — Omie chega perto, mas ninguém integra régua + envio de docs + aprovação de contrato + suporte tudo por lá. **Cestacorp está na direção certa.**
2. **Onboarding self-service + UX moderna** — Domínio/Alterdata/Questor têm implantação paga de R$ 2k–10k. Não existe o "Stripe/Notion da contabilidade".
3. **IA que lê XML/PDF e classifica plano de contas** — só tem chatbot FAQ. Espaço aberto para IA que aprende com correção do contador.

### Features que TODOS os grandes têm e o Cestacorp ainda NÃO:
- Certificado digital A1/A3 gerenciado
- SPED (ECD, ECF, EFD) — módulo inteiro
- Folha de pagamento
- Emissão de NFe/NFS-e (ou integração)
- Open Finance (Pluggy/Belvo)
- App mobile nativo
- Importação automática de XML (SIEG/Arquivei)
- Integração gov.br / Receita / Simples Nacional / PGDAS-D

---

## 💎 Diferenciais Cestacorp (já tem ou perto de ter)

1. **Régua WhatsApp integrada NIBO+DIGISAC com timeline visual + preview ao vivo** — ninguém no Brasil faz desse jeito
2. **Simulador com cliente real** e envio em lote agendado
3. **Biblioteca de 15 templates contábeis prontos**
4. **Portal do cliente moderno** (concorrência tem portal de 2012)
5. **Command palette ⌘K** + busca global — nenhum concorrente contábil
6. **Formulários dinâmicos com mapping automático ao cadastro**
7. **Heatmap "melhor horário para cobrar"** — inteligência de dados

Posicionamento: **"O Notion/Stripe da contabilidade brasileira"** — UX moderna, WhatsApp nativo, self-service, preço mid-market.

---

## 💰 Preço sugerido (SaaS white label)

| Tier | Preço | Público | Inclui |
|---|---|---|---|
| **Starter** | R$ 249/mês | Até 20 clientes · 2 usuários | Régua WhatsApp, agenda, portal, dashboard |
| **Pro** | R$ 599/mês | Até 100 clientes · 10 usuários | + Assinatura digital, Open Finance, app mobile, IA categorização, API NFS-e |
| **Enterprise** | R$ 1.490 + R$ 8/cliente extra | Ilimitado | + SSO, white-label, SLA, multi-filial, gerente dedicado |

Add-ons: Certificado A1 R$ 180/ano · SMS/WhatsApp R$ 0,12/msg · Folha R$ 5/funcionário/mês.

---

## 🗓️ Plano de Ação Consolidado

### Sprint 1 — Segurança (1 semana, bloqueadores)
1. Helper `assertOwnership(session, type, id)` nas APIs → aplicar em `/api/clientes/[id]`, `/api/portal/**`, `/api/reguas/enviar-ad-hoc`, `/api/reajustes/*`
2. HMAC SHA256 nos webhooks `/api/webhooks/nibo` e `/digisac`
3. Validação CPF/CNPJ (biblioteca `cpf-cnpj-validator`) em todos os pontos de entrada
4. Constraint UNIQUE + transação na geração de execuções da régua
5. Consumer de `EnvioAgendado` dentro de `rodarReguaDiaria()`
6. Idempotência de reenvio com histórico de `tentativas`
7. Mover tokens NIBO/DIGISAC para secrets do EasyPanel

### Sprint 2 — Operação confiável (1 semana)
1. Rate limiting (Upstash) em `/api/portal/auth/*` + Digisac
2. Retry exponencial Digisac (3 tentativas)
3. Horário comercial na régua
4. Webhook de pagamento Nibo cancelando execuções pendentes em tempo real
5. Audit log genérico (migration + helper `audit(actor, action, resource, diff)`)
6. Validação Zod server-side em todos os forms públicos
7. Revogação one-shot dos tokens de convite/reset

### Sprint 3 — UX mobile e polish (1 semana)
1. Drawer hamburguer mobile (Sidebar)
2. Tabelas → cards em `< 768px`
3. Empty states ilustrados + skeletons
4. Dark mode toggle
5. ARIA labels em todos botões icon-only
6. Paginação server-side real em clientes e forms

### Sprint 4 — Diferenciação (2 semanas)
1. **Assinatura digital integrada** (ClickSign/gov.br) em contratos
2. **OCR + IA** para documentos enviados pelo cliente
3. **A/B test** de templates na régua
4. **IA sugere melhor horário** por cliente baseado em histórico
5. **Bot WhatsApp** respondendo dúvidas básicas no portal
6. Upload real de arquivos (S3/MinIO) nos forms

### Sprint 5 — Plataforma SaaS (2 semanas)
1. Multi-tenant (`tenant_id` em tudo)
2. White label (logo/cores por tenant)
3. Onboarding self-service
4. Billing Stripe
5. App mobile (PWA + Capacitor)

### Sprint 6 — Observabilidade + testes (1 semana)
1. Sentry
2. Health check
3. Logging estruturado (Pino/Winston)
4. Testes Playwright: `auth.owns`, `regua.no-duplicates`, `webhooks.hmac`
5. GitHub Actions (lint + build + test)
6. Storybook dos componentes centrais

**Total:** ~8 semanas para sair de "demo" para "SaaS vendável a R$ 599/mês".

---

## 📋 Resumo executivo

| Dimensão | Nota atual | Potencial em 8 semanas |
|---|---|---|
| UX / Visual | 9/10 | 9/10 (já é diferencial) |
| Funcionalidade MVP | 8/10 | 9/10 |
| Segurança | 3/10 🚨 | 8/10 |
| Performance | 5/10 | 8/10 |
| Observabilidade | 1/10 | 7/10 |
| Mobile / A11y | 4/10 | 8/10 |
| Testes | 0/10 | 6/10 (E2E críticos) |
| **Pronto para venda** | ❌ | ✅ R$ 599/mês tier Pro |

O sistema **é mais bonito e moderno que os concorrentes estabelecidos**. O que trava a venda é **segurança** (autorização por escopo + tokens em plaintext) e **confiabilidade operacional** (régua com duplicatas possíveis, sem retry, sem HMAC). Resolver a Sprint 1 já libera apresentar para cliente real.
