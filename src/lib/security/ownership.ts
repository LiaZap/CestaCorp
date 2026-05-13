/**
 * Helper de autorização por escopo.
 * Garante que um usuário só acesse recursos que pertencem a ele.
 *
 * Regras:
 *   - Equipe (User) com role ADMIN ou GESTOR → acessa tudo
 *   - Equipe OPERADOR → acessa tudo do escritório (mas podemos apertar por responsável)
 *   - Cliente (portal) → só acessa recursos do próprio clienteId
 */

import { prisma } from "@/lib/db/prisma";

import type { Session as NextAuthSession } from "next-auth";
export type SessionLike = NextAuthSession | null;

export type ResourceType =
  | "cliente"
  | "cobranca"
  | "contrato"
  | "execucao_regua"
  | "form_response"
  | "notificacao";

export class AuthorizationError extends Error {
  status = 403 as const;
  constructor(public message: string) { super(message); }
}

export function isEquipe(session: SessionLike): boolean {
  return session?.user?.tipo === "equipe";
}

export function isCliente(session: SessionLike): boolean {
  return session?.user?.tipo === "cliente";
}

export function isAdmin(session: SessionLike): boolean {
  return isEquipe(session) && session?.user?.role === "ADMIN";
}

/**
 * Verifica se o usuário pode acessar o recurso.
 * - Equipe sempre pode (ADMIN/GESTOR/OPERADOR — controle mais fino virá depois)
 * - Cliente só acessa recursos do próprio clienteId
 * Lança AuthorizationError se não tiver permissão.
 */
export async function assertOwnership(
  session: SessionLike,
  resource: ResourceType,
  resourceId: string
): Promise<void> {
  if (!session?.user) throw new AuthorizationError("não autenticado");

  // Equipe acessa tudo (por enquanto — RBAC granular é outro sprint)
  if (isEquipe(session)) return;

  // Cliente → resolver o clienteId do recurso
  if (!isCliente(session)) throw new AuthorizationError("tipo de sessão inválido");

  const clienteIdSessao = session.user.clienteId;
  if (!clienteIdSessao) throw new AuthorizationError("sessão de cliente sem clienteId");

  let clienteDoRecurso: string | null = null;

  switch (resource) {
    case "cliente":
      clienteDoRecurso = resourceId;
      break;
    case "cobranca": {
      const c = await prisma.cobranca.findUnique({ where: { id: resourceId }, select: { clienteId: true } });
      clienteDoRecurso = c?.clienteId ?? null;
      break;
    }
    case "contrato": {
      const c = await prisma.contrato.findUnique({ where: { id: resourceId }, select: { clienteId: true } });
      clienteDoRecurso = c?.clienteId ?? null;
      break;
    }
    case "execucao_regua": {
      const e = await prisma.execucaoRegua.findUnique({ where: { id: resourceId }, select: { clienteId: true } });
      clienteDoRecurso = e?.clienteId ?? null;
      break;
    }
    case "form_response": {
      // FormResponse vive no Mongo, não precisa validar aqui (cliente não acessa inbox)
      throw new AuthorizationError("cliente não acessa respostas de formulário de outros");
    }
    case "notificacao":
      // Notificações do cliente ainda não implementadas; por ora, cliente não acessa
      throw new AuthorizationError("cliente não acessa notificações internas");
    default:
      throw new AuthorizationError(`tipo de recurso desconhecido: ${resource}`);
  }

  if (!clienteDoRecurso) throw new AuthorizationError("recurso não encontrado");
  if (clienteDoRecurso !== clienteIdSessao) {
    throw new AuthorizationError("recurso pertence a outro cliente");
  }
}

/**
 * Só equipe pode (para rotas administrativas: reajustes, tags, configurações).
 */
export function assertEquipe(session: SessionLike): void {
  if (!isEquipe(session)) throw new AuthorizationError("ação restrita à equipe Cestacorp");
}

/**
 * Só admin (para ações sensíveis: apagar cliente, editar permissões).
 */
export function assertAdmin(session: SessionLike): void {
  if (!isAdmin(session)) throw new AuthorizationError("ação restrita a administradores");
}
