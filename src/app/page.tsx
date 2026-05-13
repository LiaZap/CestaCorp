import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Rota raiz: esta é uma ferramenta interna da Cestacorp, não um site institucional
 * (o site da empresa é cestacorp.com.br). Então não faz sentido ter landing page.
 *
 * - Se já estiver logado como equipe → manda pro /dashboard
 * - Se já estiver logado como cliente → manda pro /portal
 * - Senão → cai direto no /login
 */
export default async function RootRedirect() {
  const session = await auth();
  const tipo = (session?.user as any)?.tipo;

  if (tipo === "equipe") redirect("/dashboard");
  if (tipo === "cliente") redirect("/portal");
  redirect("/login");
}
