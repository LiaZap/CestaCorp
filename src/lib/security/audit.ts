/**
 * Audit log — quem fez o quê, quando, no quê.
 * Aplicar em ações sensíveis: edição de cliente, aplicação de reajuste,
 * geração de contrato, reenvio de execução, marcação de pagamento manual.
 */
import { prisma } from "@/lib/db/prisma";
import type { NextRequest } from "next/server";

import type { Session as NextAuthSession } from "next-auth";
type Session = NextAuthSession | null;

export interface AuditParams {
  session: Session;
  action: string;              // "cliente.update", "reajuste.aplicar", "cobranca.marcar-paga"…
  resource: string;            // "cliente" | "contrato" | "execucao_regua" | ...
  resourceId?: string;
  before?: any;
  after?: any;
  request?: NextRequest | null;
}

function getIp(req?: NextRequest | null): string | null {
  if (!req) return null;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export async function audit(params: AuditParams): Promise<void> {
  const { session, action, resource, resourceId, before, after, request } = params;
  const actor = session?.user;
  if (!actor?.id) {
    // Ações do sistema (cron, webhooks) podem vir sem sessão
    await prisma.auditLog.create({
      data: {
        actorId: "system",
        actorType: "system",
        action,
        resource,
        resourceId,
        before: before ? (before as any) : undefined,
        after: after ? (after as any) : undefined,
        ip: getIp(request),
        userAgent: request?.headers.get("user-agent") ?? null,
      },
    }).catch((e) => console.error("[audit] falha ao gravar log:", e));
    return;
  }

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorType: actor.tipo ?? "equipe",
      actorEmail: actor.email ?? null,
      action,
      resource,
      resourceId,
      before: before ? (before as any) : undefined,
      after: after ? (after as any) : undefined,
      ip: getIp(request),
      userAgent: request?.headers.get("user-agent") ?? null,
    },
  }).catch((e) => console.error("[audit] falha ao gravar log:", e));
}

/**
 * Helper para expurgo: remove logs mais antigos que N dias.
 * Rodar via cron mensal.
 */
export async function expurgarAuditAntigos(diasRetencao = 365) {
  const corte = new Date(Date.now() - diasRetencao * 86400000);
  const r = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: corte } } });
  return r.count;
}
