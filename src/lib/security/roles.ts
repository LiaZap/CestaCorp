/**
 * Permissões granulares por role.
 *
 * Hierarquia (call 18/05 com Patrick):
 *   - ADMIN: tudo (gerenciar usuários, regras fiscais, valores agregados)
 *   - GESTOR: edita regras fiscais, vê valores agregados, NÃO gerencia usuários
 *   - FINANCEIRO: vê valores agregados (top inadimplentes, projeção financeira)
 *   - OPERACIONAL (alias OPERADOR): SEM valores monetários no dashboard
 *
 * Esta camada é declarativa — UI usa <RestrictedKpi> e rotas usam asserts.
 */
import type { SessionLike } from "./ownership";

export type Role = "ADMIN" | "GESTOR" | "FINANCEIRO" | "OPERADOR";

function getRole(session: SessionLike): Role | null {
  if (!session?.user) return null;
  if (session.user.tipo !== "equipe") return null;
  const r = session.user.role as Role | undefined;
  if (!r) return null;
  return r;
}

export function isAdmin(session: SessionLike): boolean {
  return getRole(session) === "ADMIN";
}
export function isGestor(session: SessionLike): boolean {
  return getRole(session) === "GESTOR";
}
export function isFinanceiro(session: SessionLike): boolean {
  return getRole(session) === "FINANCEIRO";
}
export function isOperacional(session: SessionLike): boolean {
  return getRole(session) === "OPERADOR";
}

/**
 * Quem pode ver valores agregados (R$ em aberto, atrasados, projeções).
 * Operacional NÃO vê. Cestacorp 18/05: "operação não enxerga inadimplência".
 */
export function podeVerValoresAgregados(session: SessionLike): boolean {
  const r = getRole(session);
  return r === "ADMIN" || r === "GESTOR" || r === "FINANCEIRO";
}

/**
 * Quem pode gerenciar usuários/equipe (criar, editar role, desativar).
 * Só ADMIN.
 */
export function podeGerenciarUsuarios(session: SessionLike): boolean {
  return isAdmin(session);
}

/**
 * Quem pode editar regras fiscais e classificação de cliente.
 * GESTOR + ADMIN (financeiro só lê valores; operacional executa tarefa).
 */
export function podeEditarRegrasFiscais(session: SessionLike): boolean {
  const r = getRole(session);
  return r === "ADMIN" || r === "GESTOR";
}

/**
 * Tipo de dashboard que o usuário enxerga por padrão (sem override).
 */
export function dashboardPadraoPara(session: SessionLike): "ADMIN" | "GESTOR" | "FINANCEIRO" | "OPERACIONAL" {
  const r = getRole(session);
  if (r === "ADMIN") return "ADMIN";
  if (r === "GESTOR") return "GESTOR";
  if (r === "FINANCEIRO") return "FINANCEIRO";
  return "OPERACIONAL";
}

export class PermissionError extends Error {
  status = 403 as const;
  constructor(public message: string) { super(message); }
}

export function assertPodeEditarRegrasFiscais(session: SessionLike): void {
  if (!podeEditarRegrasFiscais(session)) {
    throw new PermissionError("ação restrita a GESTOR/ADMIN");
  }
}
export function assertPodeGerenciarUsuarios(session: SessionLike): void {
  if (!podeGerenciarUsuarios(session)) {
    throw new PermissionError("ação restrita a ADMIN");
  }
}
export function assertPodeVerValores(session: SessionLike): void {
  if (!podeVerValoresAgregados(session)) {
    throw new PermissionError("ação restrita a roles com permissão financeira");
  }
}
