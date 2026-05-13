# Cestacorp — Sistema Interno

Plataforma única que substitui a planilha V106, automatiza contratos, tags e reajustes, e executa uma **régua de cobrança integrada NIBO + DIGISAC**.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend / SSR | Next.js 14 (App Router) + TypeScript + Tailwind |
| Banco estruturado | PostgreSQL (Prisma) |
| Banco flexível (formulários/logs) | MongoDB (Mongoose) |
| Autenticação | NextAuth Credentials (só equipe Cestacorp nesta v1) |
| Integrações | NIBO (financeiro) · DIGISAC/Hublx (WhatsApp) |
| Deploy | EasyPanel (Docker) |

## Estrutura

```
Cestacorp/
├── Dockerfile / docker-compose.yml     # deploy EasyPanel
├── prisma/
│   ├── schema.prisma                   # Cliente, Contrato, Cobranca, ReguaCobranca…
│   └── seed.ts                         # admin + 8 formulários + régua padrão
├── src/
│   ├── app/
│   │   ├── (app)/                      # área autenticada
│   │   │   ├── dashboard/
│   │   │   ├── clientes/               # CRUD + importador V106
│   │   │   ├── contratos/              # geração 1-clique
│   │   │   ├── regua-cobranca/         # módulo mais complexo
│   │   │   ├── formularios/
│   │   │   └── tags/                   # sincroniza com Digisac
│   │   ├── forms/                      # formulários PÚBLICOS (clientes preenchem)
│   │   │   └── [slug]/
│   │   ├── login/
│   │   └── api/
│   │       ├── auth/[...nextauth]/
│   │       ├── cron/regua/             # roda a régua diariamente
│   │       ├── webhooks/nibo/          # pagamentos
│   │       ├── webhooks/digisac/       # status de mensagens
│   │       ├── reguas/
│   │       ├── clientes/importar/
│   │       ├── forms/[slug]/responses/
│   │       ├── contratos/gerar/
│   │       └── tags/sincronizar/
│   ├── components/                     # UI (shadcn-style) + Logo Cestacorp
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── db/{prisma,mongo}.ts
│   │   └── services/
│   │       ├── nibo.ts                 # boletos, contas a receber
│   │       ├── digisac.ts              # envio WhatsApp + tags
│   │       ├── regua-cobranca.ts       # ENGINE (sincroniza → agenda → envia)
│   │       ├── templating.ts           # {cliente.razaoSocial} {cobranca.valor|money}
│   │       └── contrato-generator.ts   # docx → PDF
│   └── models/                         # Mongoose (FormDefinition / FormResponse / MessageLog)
└── scripts/
    └── cron-regua.ts                   # roda a régua via CLI
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```bash
DATABASE_URL=postgresql://cestacorp:cestacorp@postgres:5432/cestacorp?schema=public
MONGODB_URI=mongodb://mongo:27017/cestacorp
NEXTAUTH_URL=https://seu-dominio
NEXTAUTH_SECRET=<openssl rand -base64 32>
NIBO_API_URL=https://api.nibo.com.br/empresas/v1
NIBO_TOKEN=<rotacione após setup>
DIGISAC_API_URL=https://cestacorp.hublx.app/api/v1
DIGISAC_TOKEN=<rotacione após setup>
DIGISAC_SERVICE_ID=<id do canal WhatsApp, se houver múltiplos>
TZ=America/Sao_Paulo
```

> ⚠️ Os tokens foram compartilhados em texto aberto no onboarding — **rotacione** no NIBO e no Digisac após subir o ambiente.

## Rodar local

```bash
npm install
docker compose up -d postgres mongo      # sobe bancos
npm run prisma:migrate                   # cria schema
npm run seed                             # admin + forms + régua padrão
npm run dev                              # http://localhost:3000
```

Login padrão: `admin@cestacorp.com.br` / `Cestacorp@2026` (troque depois).

## Deploy no EasyPanel

1. **Criar projeto**: `cestacorp`
2. **Serviços**:
   - **Postgres 16** (nome `postgres`, user/pass/DB = `cestacorp`)
   - **MongoDB 7** (nome `mongo`)
   - **App** (deploy via Git + Dockerfile ou Docker image)
3. Preencher as variáveis do `.env.example` no painel de **Environment**.
4. Após o primeiro deploy, rodar no container:
   ```bash
   npm run prisma:deploy && npm run seed
   ```
5. Configurar **cron diário** do EasyPanel chamando:
   ```
   POST https://<seu-dominio>/api/cron/regua
   Header: x-cron-secret: <mesmo NEXTAUTH_SECRET>
   ```
   Sugestão: 09:00 America/Sao_Paulo.
6. Configurar webhooks no NIBO e no Digisac:
   - NIBO → `POST /api/webhooks/nibo` (eventos de pagamento)
   - Digisac → `POST /api/webhooks/digisac` (status de mensagem + respostas)

## Módulos implementados (MVP das 5 prioridades do BAH-808)

| # | Módulo | Status |
|---|---|---|
| 1 | **Migração da V106** | ✅ aba CLIENTES (importador `/clientes/importar`) |
| 2 | **Automação de Contratos** | ✅ templates docx + gerador 1-clique |
| 3 | **Tags Hublx / Digisac** | ✅ sincronização automática |
| 4 | **Reajuste automático** | ✅ campo no Cliente + Contrato (`mesAniversario` + `indiceReajuste`) |
| 5 | **Formulários inteligentes** | ✅ 8 formulários dinâmicos autoalimentando cadastro |

**Extra (mais complexo):** Régua de Cobrança NIBO + DIGISAC
- Sincroniza cobranças em aberto do NIBO a cada rodada
- Para cada cobrança, agenda passos (`-3d`, `0d`, `+1d`, `+7d`…) no horário certo
- Dispara WhatsApp via Digisac com template renderizado (placeholders como `{cliente.razaoSocial}` e `{cobranca.valor|money}`)
- Cancela passos futuros se cobrança for paga (via sync ou webhook)
- Log completo em MongoDB

## Próximos passos sugeridos

- [ ] Página de **detalhe do cliente** (timeline, contratos, cobranças, formulários respondidos)
- [ ] **Cálculo automático de reajuste** (job mensal que gera proposta de novo valor baseado em IPCA/IGPM da data de aniversário)
- [ ] Tela visual para editar **templates de contrato** (upload de .docx + preview)
- [ ] **Conversor .docx → PDF** (LibreOffice headless container ou API externa)
- [ ] E-mail como canal adicional na régua (SMTP/Resend)
- [ ] **Login para clientes** (v2) para acompanhar honorários e abrir chamados
