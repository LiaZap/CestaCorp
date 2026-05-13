# 🗺️ Roadmap Cestacorp — Análise Sênior & Plano de Evolução

> Documento escrito com olhar de dev sênior: o que falta pra cada tela ficar **nível produção**, comparação com concorrentes do mercado e diferenciais para posicionar o sistema.

---

## 📊 1. Análise por módulo — gaps atuais

### 1.1 Dashboard
**Hoje:** 6 KPIs + 5 gráficos (cobranças 6m · régua 30d · funil forms · top atrasos · classificação) + próximas cobranças 7d.

**Faltando para produção:**
- [ ] **Comparativos mês a mês** — cada KPI com variação ("R$ 62k · ↑ 12% vs. mês anterior")
- [ ] **Filtros temporais** (7d / 30d / 90d / custom) no topo
- [ ] **Exportar dashboard em PDF** para relatório executivo
- [ ] **Widget configurável** — drag-and-drop das cards, cada usuário vê o que importa
- [ ] **Sparklines dentro dos KPIs** — microlinha de tendência
- [ ] **Alertas inteligentes** no topo: "3 cobranças atrasadas há mais de 30 dias", "Reajuste do cliente X vence hoje"
- [ ] **Metas** — definir meta de recebimento do mês e mostrar barra de progresso
- [ ] **DRE simplificada** do mês (faturamento × despesas × lucro)

### 1.2 Clientes
**Hoje:** listagem com busca · CRUD · importador V106 · página de detalhe rica (timeline, KPIs, contratos, cobranças, sócios, tags, convite portal).

**Faltando:**
- [ ] **Paginação real** na lista (hoje carrega 100 de uma vez) + virtualização para > 500 clientes
- [ ] **Filtros avançados**: status + classificação + responsável + tributação + mês aniversário + tags (múltiplos)
- [ ] **Ordenação** por cada coluna (clicar no header)
- [ ] **Bulk actions**: selecionar N clientes → aplicar tag, exportar, mudar responsável, mensagem em lote
- [ ] **Importação CSV genérica** (não só V106)
- [ ] **Histórico de alterações** — quem mudou o quê (audit log)
- [ ] **Anexos**: upload de docs (contrato social, RG, cartão CNPJ) direto no cadastro + S3/MinIO
- [ ] **Validação CPF/CNPJ em tempo real** + busca automática na Receita (usando BrasilAPI)
- [ ] **Integração CEP** (ViaCEP) para autopreencher endereço
- [ ] **Campos customizados** por cliente — flexibilidade para adicionar info específica
- [ ] **Vincular socio a cliente** via CPF (mesmo sócio em múltiplas empresas)
- [ ] **Importar sócio de outro cliente** para evitar duplicidade
- [ ] **Exportar cadastro completo** (PDF ficha do cliente)
- [ ] **Merge de duplicados** — detecta CNPJ repetido e sugere juntar

### 1.3 Contratos
**Hoje:** listagem, templates .docx com placeholders, geração 1-clique, geração em lote, download PDF (via LibreOffice).

**Faltando:**
- [ ] **Editor visual de template** — WYSIWYG em vez de editar .docx no Word
- [ ] **Versionamento de templates** — manter histórico de versões, saber qual template gerou cada contrato
- [ ] **Aditivos contratuais** — gerar apenas a parte modificada, referenciando o contrato pai
- [ ] **Assinatura digital integrada** — ClickSign, DocuSign, ou Gov.br (diferencial enorme)
- [ ] **Campos dinâmicos no template** — não só do Cliente, mas custom (ex: "dia da reunião", "escopo específico")
- [ ] **Preview do contrato antes de gerar** — renderiza no navegador
- [ ] **Numeração automática configurável** (CTR-2026-0001)
- [ ] **Encerramento de contrato** com data + motivo + substituto
- [ ] **Contratos com renovação automática** anual
- [ ] **Relatório de contratos vencendo** (tempo determinado)

### 1.4 Agenda (Obrigações Fiscais)
**Hoje:** calendário mensal com navegação, 8 obrigações padrão pré-cadastradas, eventos materializados automaticamente, detalhe do evento, conclusão manual.

**Faltando:**
- [ ] **Visão semanal** e **diária** (não só mensal)
- [ ] **Timeline do responsável** — "Minha agenda" (só o que é meu)
- [ ] **Sincronização Google Calendar / Outlook**
- [ ] **Checklist por evento** — passos para concluir (baixar guia, conferir valor, enviar cliente, confirmar pagamento)
- [ ] **Anexo de comprovante** ao concluir (guia paga)
- [ ] **Lembrete automático do evento** para o cliente (WhatsApp) + para o responsável interno
- [ ] **Feriados nacionais/estaduais** integrados (não agenda em feriado)
- [ ] **Obrigação recorrente customizada** — "toda última sexta", "todo dia 15 útil"
- [ ] **Comentários em cada evento** (equipe discute)
- [ ] **Métricas**: tempo médio pra concluir, % no prazo, backlog

### 1.5 Régua de Cobrança ⭐ (módulo principal)
**Hoje:** dashboard com 4 KPIs + volume 14d + heatmap · lista de réguas · criar/editar com preview WhatsApp ao vivo · timeline dos passos · simulador · envio em lote (agora/agendado) · biblioteca de 15 templates · detalhe de execução com chat WhatsApp.

**Faltando:**
- [ ] **A/B testing de templates** — 2 variações, sistema mede qual converte mais
- [ ] **Segmentação por régua** — régua diferente pra Simples vs Presumido, VIP vs Bronze
- [ ] **Resposta do cliente fecha o ciclo** — se cliente responde "paguei" ou envia comprovante, cria tarefa pro financeiro conferir
- [ ] **IA para sugerir melhor horário** por cliente (quando historicamente ele responde)
- [ ] **Escalada automática para humano** — após X tentativas sem resposta, cria task de ligação
- [ ] **Métricas de conversão por passo** — "passo 3 converte 42%, passo 4 só 12% → tire o 4"
- [ ] **Cancelamento em massa de pendentes** quando cliente negocia
- [ ] **Horário comercial respeitado** por padrão (nada de WhatsApp domingo às 23h)
- [ ] **Envio individual** pela página do cliente ("enviar lembrete agora")
- [ ] **Rate limiting** — não mandar mais de N msgs/minuto pra não spamar a API Digisac

### 1.6 Reajustes
**Hoje:** lista propostas do mês com IPCA/IGPM/INPC do BCB, aplicar individual.

**Faltando:**
- [ ] **Comunicar cliente automaticamente** ao aplicar reajuste (WhatsApp + e-mail com carta oficial)
- [ ] **Carta de reajuste em PDF** gerada automaticamente (docx template específico)
- [ ] **Histórico de reajustes** por cliente (gráfico de evolução do honorário)
- [ ] **Simulador de impacto** — "se aplicar 5% em todos, +R$ X no faturamento mensal"
- [ ] **Aplicar em lote** por classificação ou responsável
- [ ] **Cláusula contratual** — permitir que o sistema leia do contrato o % máximo de reajuste
- [ ] **Diferença por índice** — mostrar simulação com 3 índices lado a lado
- [ ] **Antecipar ou pular reajuste** — permissão de admin

### 1.7 Formulários Públicos
**Hoje:** 8 formulários dinâmicos (Abertura/Alteração Empresa e MEI, Sócios, Carnê Leão, eSocial, GPS), inbox operacional, aplicar ao cadastro, importar Google Forms.

**Faltando:**
- [ ] **Upload real de arquivos** (S3/MinIO) — hoje só salva o nome
- [ ] **Validação em tempo real** dos campos (CPF/CNPJ válido, CEP, email)
- [ ] **Autopreenchimento** via CNPJ (BrasilAPI) e CEP (ViaCEP)
- [ ] **Salvamento parcial** — cliente pode começar hoje e terminar amanhã (link mágico)
- [ ] **Multi-step wizard** (implementei e reverti, mas vale para forms longos)
- [ ] **Editor visual de formulários** — arrastar e soltar campos, condicionais visuais
- [ ] **Campos calculados** — ex: "capital social por sócio = total / nº sócios"
- [ ] **Formulários versionados** — mudar o form não quebra respostas antigas
- [ ] **Analytics**: taxa de abandono, tempo médio por campo, onde desiste
- [ ] **reCAPTCHA** / honeypot para evitar spam
- [ ] **Branded forms** — cliente final vê logo + cores customizadas por escritório
- [ ] **Auto-aplicar** — configurar para mapeamento 100% automático em forms simples

### 1.8 Tags
**Hoje:** lista com contadores, sincronização Digisac (com modo demo/fallback).

**Faltando:**
- [ ] **Aplicar tag em lote** via seleção de clientes
- [ ] **Regras automáticas** — "todo cliente que ficar 7d em atraso ganha tag INADIMPLENTE"
- [ ] **Textos por tag** (já tem model `TagTexto`) — quando tal tag é aplicada, envia tal mensagem
- [ ] **Remover tag automaticamente** quando condição deixa de ser verdade
- [ ] **Tag calculada** — ex: "pago em dia 3 meses seguidos" → "BOM PAGADOR"

### 1.9 Relatórios
**Hoje:** hub com 4 sub-relatórios (tags, clientes, cobranças, régua) + export CSV de clientes e tags.

**Faltando:**
- [ ] **Report builder** — usuário monta relatório custom (colunas, filtros, agrupamento)
- [ ] **Exportar PDF** com cabeçalho/rodapé da Cestacorp
- [ ] **Agendar envio** periódico do relatório por e-mail (ex: "segundas 8h, mando DRE pro gestor")
- [ ] **Relatório DRE mensal**
- [ ] **Relatório de produtividade da equipe** (quantos atendimentos, quantos fechados)
- [ ] **Relatório de indicações** — quem mais indica clientes pra Cestacorp
- [ ] **Relatório de SLA** — tempo médio pra responder formulário, pra resolver atendimento

### 1.10 Notificações
**Hoje:** sino com polling 60s, inbox completo, 6 tipos de evento disparando.

**Faltando:**
- [ ] **WebSocket / SSE** em vez de polling (sem refresh de 60s, é "ao vivo")
- [ ] **Preferências por usuário** — qual tipo de notificação quer receber (marquinha verde/vermelha)
- [ ] **Mute por período** — "não perturbar das 19h às 8h"
- [ ] **Push notification no navegador** (service worker)
- [ ] **Notificação para mobile** via PWA

### 1.11 Configurações
**Hoje:** listagem de usuários, status das integrações, rotinas agendadas, conta atual.

**Faltando:**
- [ ] **CRUD de usuários** (criar, editar, resetar senha, desativar)
- [ ] **Papéis customizáveis** — ADMIN, GESTOR, OPERADOR hoje só cosméticos; falta RBAC real
- [ ] **Configurar integrações** via UI (salvar tokens no banco, não só env)
- [ ] **Configurar SMTP** via UI
- [ ] **Log de auditoria** — quem fez o que
- [ ] **Configurações de marca** — logo, cores, e-mail remetente, nome do escritório (multi-tenant ready)
- [ ] **Configurações globais da régua** — horário comercial, dias úteis, rate limit
- [ ] **Backup/Restore** — botão "baixar dump" do banco
- [ ] **2FA** (TOTP) para admins

### 1.12 Portal do Cliente
**Hoje:** login + primeiro acesso com token + reset senha + dashboard + boletos + contratos (com PDF) + formulários + meus dados.

**Faltando:**
- [ ] **Dashboard mais rico** — gráfico de evolução de pagamentos, próximas obrigações do cliente
- [ ] **Chat direto com a equipe** — mini-chat que cria ticket interno
- [ ] **Guias fiscais** pra baixar (DAS, DARF, GPS, etc)
- [ ] **Notas fiscais** recebidas e emitidas
- [ ] **Upload de documentos** pelo cliente (ex: "segue NF de abril")
- [ ] **Certidões** — cliente baixa certidão negativa sem pedir
- [ ] **Dashboard financeiro simplificado** — quanto ele fatura/paga no escritório
- [ ] **Indicar amigo** — programa de indicação com benefício
- [ ] **Multi-usuário por cliente** — hoje 1 e-mail; permitir múltiplos (contador, financeiro, sócio)
- [ ] **Customização visual** pela Cestacorp — cada cliente vê marca branca
- [ ] **App mobile nativo** (Capacitor envelopa o Next, vira app)

---

## 🎯 2. Transversal (afetam todo o sistema)

### 2.1 Segurança
- [ ] **Rate limiting** em todas APIs públicas (Upstash, Redis)
- [ ] **2FA** obrigatório para admin
- [ ] **Audit log** genérico em todas ações sensíveis (quem fez, quando, de qual IP)
- [ ] **Encriptar tokens NIBO/DIGISAC** no banco (AES, não .env)
- [ ] **RBAC real** — middleware checando permissão por rota/ação
- [ ] **CSP headers** no Next config
- [ ] **Rotação automática de logs** e retenção configurável
- [ ] **LGPD compliance**: termo ao fazer login, direito ao esquecimento, export de dados

### 2.2 Performance
- [ ] **Paginação server-side** em todas as listas
- [ ] **Virtualização** (react-window) em listas > 100 itens
- [ ] **Cache de queries pesadas** (Redis) — dashboard KPIs, heatmap
- [ ] **Lazy loading de gráficos** (Recharts) via dynamic import
- [ ] **Image optimization** — já usa Next/Image mas faltam srcset pra mobile
- [ ] **Database indexes** revisados (hoje alguns campos usados em WHERE sem index)
- [ ] **Connection pool** Prisma configurado (PgBouncer em produção)
- [ ] **Background jobs** com BullMQ em vez de rodar dentro da request

### 2.3 Observabilidade
- [ ] **Sentry** (ou Axiom) para erros em produção
- [ ] **PostHog / Umami** — analytics de uso
- [ ] **Health check endpoint** (`/api/health`)
- [ ] **Status page** pública (opcional, mas profissional)
- [ ] **Métricas**: Grafana + Prometheus ou OpenTelemetry

### 2.4 DX (Developer Experience)
- [ ] **Testes automatizados** — Playwright E2E nas rotas críticas + Vitest unit
- [ ] **CI/CD** — GitHub Actions rodando lint + build + test
- [ ] **Commitlint + Husky** — padronizar mensagens de commit
- [ ] **Storybook** para componentes (Avatar, WhatsAppChat, CalendarioMensal…)
- [ ] **CHANGELOG.md** auto-gerado por semantic-release

### 2.5 Acessibilidade & Mobile
- [ ] **Navegação por teclado** em 100% das páginas (testar com Tab)
- [ ] **ARIA labels** nos botões icon-only
- [ ] **Contraste AA+** — algumas cores secundárias estão na borda
- [ ] **Menu mobile drawer** (hoje o sidebar some abaixo de lg)
- [ ] **Bottom tab bar** mobile para área interna
- [ ] **PWA manifest** — instalar como app no celular
- [ ] **Service worker** com offline-first para portal do cliente
- [ ] **Dark mode** — variáveis CSS já prontas, falta o toggle

### 2.6 I18n / Moeda / Timezone
- [ ] Hoje tudo em pt-BR + R$ + TZ São Paulo hardcoded. Se for vender pra outros escritórios considerar i18n básico.

---

## 🏆 3. Benchmark — como o mercado resolve

| Sistema | Pontos fortes | Pontos fracos | O que "roubar" |
|---|---|---|---|
| **Contabilizei** | App mobile excelente, onboarding self-service, forte em MEI, muita automação fiscal | Pouco flexível para escritórios, foco no cliente final | Onboarding guiado + tour · app leve de cobrança · geração automática de DAS |
| **Conta Azul** | Conciliação bancária automática · integração NFe/boletos · UX polida · app mobile | Mais focado em PME que em contador · preço alto | Conciliação bancária via Open Finance · dashboard de fluxo de caixa · marketplace de apps |
| **Nibo** | O que já integramos — bom financeiro, conciliação · reporting forte | Interface antiga · mobile fraco | Workflow de aprovação · categorização por regras |
| **Domínio (Thomson Reuters)** | Robusto, consolidado, cobre 100% das obrigações · módulos inteiros de ECD/ECF/SPED | Desktop, pesado, complexo, caro | Módulos fiscais profundos (ECD, ECF, SPED) como próximos passos |
| **Alterdata** | Forte em escritório tradicional · offline-first | Desktop legado | Robustez operacional · controles financeiros |
| **Omie** | ERP leve + módulo contábil · API aberta · apps plug-and-play | Foco PME, não contador | Marketplace/apps de terceiros |
| **QuickBooks** (global) | IA para categorização de despesas · relatórios incríveis · app nativo de 1ª linha | Não atende obrigações BR | Insights automáticos com IA |

### 3.1 Onde o Cestacorp já supera
- **Régua de cobrança WhatsApp** com timeline visual + preview ao vivo → nenhum concorrente nacional tem isso desse jeito
- **Simulador com cliente real** + envio individual → único
- **Biblioteca de templates contábeis** prontos → outros têm genéricos, não pensados em contabilidade
- **Portal do cliente enxuto e moderno** → a maioria dos concorrentes entrega portal parecendo de 2012

### 3.2 Onde precisamos alcançar
- **Conciliação bancária** automática (Open Finance / OFX) — Conta Azul e Nibo são muito fortes
- **Emissão de NFS-e** integrada — Contabilizei, Conta Azul
- **Certificado digital A1/A3** gerenciado no sistema
- **Integração gov.br** para procurações e acesso à Receita
- **App mobile nativo** — diferencial de Contabilizei e Conta Azul

---

## 💎 4. Diferenciais estratégicos — posicionamento único

Estas são ideias que **nenhum concorrente tem bem feito** e que podem virar a marca registrada do Cestacorp:

### 4.1 🤖 IA aplicada à contabilidade
- **Categorização automática** de lançamentos (Claude/GPT lê descrição → classifica)
- **Resumo inteligente do mês** para o cliente no portal ("Este mês você faturou R$ X, pagou Y em impostos, abaixo da média")
- **Detecção de anomalias** — "faturamento de abril caiu 40% sem explicação, verificar"
- **Assistente no WhatsApp** — cliente pergunta "qual meu DAS desse mês?" e o bot responde
- **Sugestão de resposta** em conversas do WhatsApp com o cliente
- **OCR de documentos** — cliente manda foto da nota, sistema extrai valor/data/CNPJ e cria lançamento

### 4.2 🔄 WhatsApp First
- **Todo fluxo** pode começar no WhatsApp: cliente envia CNPJ pelo zap → bot envia link de formulário de abertura pré-preenchido
- **Cliente envia comprovante por foto** → sistema reconcilia cobrança automaticamente
- **Atalhos de comando** no WhatsApp ("/boleto", "/das abril", "/certidao")
- **Status de obrigações** atualizado direto no WhatsApp

### 4.3 📱 Portal do cliente com cara de app moderno
- **Home do cliente estilo fintech** — saldo pendente, próximos eventos, ações rápidas grandes
- **Notificações push** no browser + mobile
- **"Stories" de novidades** — escritório publica dica do mês, cliente vê no topo

### 4.4 🎓 Educação financeira embutida
- **Artigos contextuais** — quando cliente abre cobrança de DAS, tem "O que é DAS?" ao lado
- **Webinars gratuitos** integrados ao portal
- **Simuladores** (Simples × Presumido, pró-labore ótimo, etc)

### 4.5 🤝 Programa de parceria
- **Indicação com crédito** — cliente indica amigo, ganha % nas honorárias
- **Dashboard do parceiro** mostrando indicações, status, comissões

### 4.6 🔒 Open Finance + assinatura digital
- **Plugar conta bancária via Open Finance** → conciliação 100% automática
- **Assinatura digital via gov.br** (sem precisar comprar certificado) integrada no fluxo de contratos

### 4.7 🏢 Multi-escritório (SaaS)
- Arquitetura já é próxima disso. Dá pra virar plataforma:
- Cada escritório contábil usa como se fosse dele (**white label**)
- Monetização B2B SaaS por contador em vez de projeto único

### 4.8 📊 Business Intelligence para o cliente
- **Comparativo com benchmarks** do setor do cliente ("seu restaurante fatura 15% abaixo da média do bairro")
- **Projeção de impostos** para os próximos 3 meses
- **Simulador "e se"** — "e se eu contratar mais 1 funcionário? quanto custa?"

---

## 🗓️ 5. Plano de ação priorizado

### Sprint 1 — Fechamento do MVP (próximas 2 semanas após demo)
Objetivo: estabilizar e deixar pronto para primeiro cliente real.

- [ ] CRUD de usuários da equipe (configurações)
- [ ] Upload real de arquivos (S3/MinIO) nos formulários
- [ ] Validação CPF/CNPJ via BrasilAPI + autopreenchimento
- [ ] ViaCEP em todos campos de endereço
- [ ] Filtros avançados + paginação server-side no /clientes
- [ ] Bulk actions em clientes (aplicar tag, mudar responsável)
- [ ] Rate limiting nas APIs (Upstash free)
- [ ] Audit log genérico
- [ ] Sentry configurado
- [ ] Dark mode toggle
- [ ] Menu mobile drawer (hoje sidebar some)
- [ ] Testes E2E básicos (Playwright: login, criar cliente, rodar régua)

### Sprint 2 — Diferenciação começa
Objetivo: feature que ninguém tem.

- [ ] **Assinatura digital** integrada (Gov.br / ClickSign)
- [ ] Comunicação automática de reajuste (carta PDF + WhatsApp)
- [ ] Régua com A/B test de template
- [ ] IA para sugestão de resposta em conversas Digisac
- [ ] Webhook de comprovante Digisac → identificar pagamento automaticamente
- [ ] Conciliação bancária manual (upload OFX → bate com cobranças)
- [ ] Checklist por evento da agenda
- [ ] Export PDF de relatórios com marca Cestacorp

### Sprint 3 — Portal cliente premium
Objetivo: portal vira razão de o cliente ficar.

- [ ] Dashboard rico do cliente (gráficos próprios)
- [ ] Chat com a equipe (ticket)
- [ ] Upload de documentos pelo cliente
- [ ] Guias fiscais disponíveis
- [ ] Certidões sob demanda
- [ ] PWA (instalar como app)
- [ ] Multi-usuário por cliente

### Sprint 4 — Plataforma SaaS
Objetivo: abrir para outros escritórios usarem.

- [ ] Arquitetura multi-tenant (tenant_id em tudo)
- [ ] Onboarding self-service de novo escritório
- [ ] White label (logo, cores, domínio próprio)
- [ ] Billing de plano (Stripe)
- [ ] Admin global (operar múltiplos tenants)

### Sprint 5 — IA Aplicada
Objetivo: se torna o "QuickBooks Brasil com IA".

- [ ] OCR de nota fiscal via foto (cliente tira foto → sistema extrai)
- [ ] Categorização automática de lançamentos
- [ ] Resumo mensal inteligente
- [ ] Detecção de anomalias
- [ ] Bot WhatsApp "Clarice" — atende dúvidas simples do cliente

---

## 💰 6. Critérios de "pronto para venda"

Para cobrar R$ 500+/mês por escritório contábil, o sistema precisa ter:

- [x] Cadastro de clientes sólido
- [x] Régua de cobrança automatizada
- [x] Integração WhatsApp
- [x] Portal do cliente
- [x] Formulários dinâmicos
- [ ] **Upload de arquivos** real (S3)
- [ ] **Assinatura digital** (gov.br ou ClickSign)
- [ ] **Conciliação bancária**
- [ ] **Emissão de NFS-e** ou integração com quem emite
- [ ] **App mobile** (mesmo que PWA)
- [ ] **Segurança básica**: 2FA, audit log, rate limit
- [ ] **Backup automatizado**
- [ ] **Suporte self-service** (FAQ, chat, base de conhecimento)

---

## 📝 Conclusão

O Cestacorp hoje já é **melhor que a maioria dos sistemas para escritórios contábeis brasileiros em UX moderna**. A régua de cobrança, o portal do cliente e os formulários inteligentes são diferenciais reais.

**Para virar produto comercial sério**, o caminho crítico é:
1. Fechar MVP (Sprint 1) — 2 semanas
2. Diferenciação (Sprint 2) — 1 mês
3. Portal premium (Sprint 3) — 1 mês
4. Multi-tenant SaaS (Sprint 4) — 2 meses

Com esse caminho, em ~5 meses a Cestacorp tem um **SaaS vendável para outros escritórios contábeis** como white label — podendo virar uma segunda linha de receita além dos honorários dos clientes atuais.
