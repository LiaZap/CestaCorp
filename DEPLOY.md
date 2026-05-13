# Deploy Cestacorp no EasyPanel

## 1. Pré-requisitos

- EasyPanel já instalado num VPS (Ubuntu 22.04 recomendado)
- Domínio apontando pro IP do servidor (ex: `cestacorp.suaempresa.com.br`)
- Acesso SSH ao servidor

## 2. Arquitetura

```
┌─ EasyPanel ─────────────────────────────┐
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐  │
│  │   app    │→ │ postgres │  │ mongo │  │
│  │ (Next14) │  │   :5432  │  │:27017 │  │
│  │  :3000   │  └──────────┘  └───────┘  │
│  └────┬─────┘                           │
└───────┼─────────────────────────────────┘
        │
     ┌──┴──┐
     │ SSL │ ← Traefik do EasyPanel (Let's Encrypt automático)
     └─────┘
        │
     cestacorp.suaempresa.com.br
```

## 3. Passo a passo

### 3.1. Criar projeto no EasyPanel
Login no EasyPanel → **Create Project** → nome: `cestacorp`

### 3.2. Subir Postgres
1. Dentro do projeto → **+ Service** → **App: Postgres**
2. Nome: `postgres` · Versão: `16` · User: `cestacorp`
3. Password: gerar forte (anote, vai pra `DATABASE_URL`)
4. Database: `cestacorp`
5. **Create** e aguarde ficar verde

### 3.3. Subir MongoDB
1. **+ Service** → **App: MongoDB**
2. Nome: `mongo` · Versão: `7` · **Create**

### 3.4. Subir a aplicação
1. **+ Service** → **App**
2. Nome: `app`
3. Source: **Git** (aponte pro repo) OU **Docker Image**
4. Se Git:
   - Repository: URL do Git
   - Branch: `main`
   - Build method: **Dockerfile**
5. **Environment Variables** — copie do `.env.production.example` e preencha.

   Críticas:
   ```
   NODE_ENV=production
   NEXTAUTH_URL=https://cestacorp.suaempresa.com.br
   NEXTAUTH_SECRET=<gerar com: openssl rand -base64 32>
   DATABASE_URL=postgresql://cestacorp:<PG_PWD>@cestacorp_postgres:5432/cestacorp?schema=public
   MONGODB_URI=mongodb://cestacorp_mongo:27017/cestacorp
   NIBO_TOKEN=<token real>
   DIGISAC_TOKEN=<token real>
   SMTP_HOST=...
   ```
   Dentro da rede do EasyPanel, o host de cada service vira `<projeto>_<service>` (ex: `cestacorp_postgres`).

6. **Domains** → adicione `cestacorp.suaempresa.com.br` com HTTPS (Let's Encrypt automático)
7. **Port**: `3000`
8. **Deploy**

### 3.5. Rodar migrations e seed

Depois do primeiro build, no console do service `app`:

```bash
# Aplica o schema no Postgres
npx prisma db push

# Popula dados de demonstração (opcional)
npx tsx prisma/seed.ts
```

### 3.5.1. Congelar regra de juros nas cobranças legadas

**Importante** — Patrick (09/05): mudança de regra é prospectiva. Cobranças
sincronizadas do NIBO antes desta feature precisam capturar a regra atual:

```bash
# Idempotente — pode rodar várias vezes sem efeito colateral
npx tsx scripts/popular-snapshot-cobrancas.ts
```

Esperado: `Populados agora: <N>` (todas as cobranças que estavam sem snapshot).
Próximas execuções mostram `Populados agora: 0`.

**Como funciona daí pra frente:**
- Cobranças NOVAS (sync NIBO) já nascem com snapshot da regra vigente
- Quando admin mudar a regra em `/configuracoes/cobranca`, só vale pras NOVAS
- Cobranças antigas ficam congeladas com a regra do dia em que entraram

Alternativa via UI: `/configuracoes/cobranca` → "Congelar regra agora" (só ADMIN).

### 3.6. Criar usuário admin

Se não rodou seed:

```bash
node -e "
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const hash = await bcrypt.hash('SenhaForte@2026', 10);
  await p.user.create({
    data: { email: 'admin@cestacorp.com.br', name: 'Admin', password: hash, role: 'ADMIN' }
  });
  console.log('ok');
  await p.\$disconnect();
})();
"
```

## 4. Cron agendado

EasyPanel → `app` → **Schedules**:

| Nome              | Cron          | Command |
|-------------------|---------------|---------|
| Régua diária      | `0 9 * * *`   | `curl -H "x-cron-secret: $NEXTAUTH_SECRET" http://localhost:3000/api/cron/regua` |
| Aniversários      | `0 9 * * *`   | `curl -H "x-cron-secret: $NEXTAUTH_SECRET" http://localhost:3000/api/cron/aniversarios` |
| Health self-check | `*/5 * * * *` | `curl -f http://localhost:3000/api/health` |

## 5. Webhooks externos

- NIBO: `https://cestacorp.suaempresa.com.br/api/webhooks/nibo` (header `x-nibo-signature`)
- Digisac: `https://cestacorp.suaempresa.com.br/api/webhooks/digisac` (header `x-digisac-signature`)

Gere segredos com `openssl rand -hex 32` e coloque tanto no painel do parceiro quanto em `NIBO_WEBHOOK_SECRET` / `DIGISAC_WEBHOOK_SECRET`.

## 6. Backup

EasyPanel → Postgres service → **Backups** → configurar S3/local daily.

Para Mongo:
```bash
mongodump --uri=$MONGODB_URI --archive=/backups/mongo-$(date +%F).gz --gzip
```

## 7. Smoke test pós-deploy

```bash
curl https://cestacorp.suaempresa.com.br/api/health
# Esperado: {"ok":true,"checks":{"postgres":"ok","mongo":"ok",...}}
```

Depois no navegador:
1. Abrir `/login` → entrar com admin
2. Dashboard carrega com KPIs
3. `/configuracoes` → integrações aparecem como "configurado"

## 8. Troubleshooting

| Sintoma | Causa provável | Fix |
|---------|---------------|-----|
| 502 no domínio | App ainda buildando | Aguardar 2-3 min |
| `Prisma: DB connection refused` | `DATABASE_URL` com host errado | Usar `<projeto>_postgres` |
| Login 401 volta pra tela | `NEXTAUTH_URL` errado | Setar exatamente o domínio final com `https://` |
| Cron não dispara | Secret não bate | `x-cron-secret` = exatamente `NEXTAUTH_SECRET` |
| WhatsApp não envia | Token Digisac errado | Verificar no Digisac → API |
