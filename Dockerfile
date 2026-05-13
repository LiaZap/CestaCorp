# =========================================
# Cestacorp — Dockerfile multi-stage
# Destino: EasyPanel (Docker-based deploy)
# =========================================

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Imagem do runtime precisa de libreoffice para converter .docx → PDF
# (instalado só no stage "runner" abaixo para manter o builder leve)

# --- deps ---
FROM base AS deps
COPY package.json package-lock.json* ./
# `npm install` em vez de `npm ci` porque o lock é gerado no Windows
# (sem optional deps Linux-only como @emnapi/*). `--include=optional`
# garante que dependências de plataforma sejam puxadas no Linux.
RUN npm install --no-audit --no-fund --include=optional

# --- builder ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# --- runner ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# LibreOffice + fontes (para converter .docx em PDF)
RUN apk add --no-cache libreoffice ttf-dejavu ttf-liberation fontconfig

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
