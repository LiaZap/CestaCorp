import type { NextAuthConfig } from "next-auth";

/**
 * Config leve (Edge-compatible) do NextAuth.
 * O middleware usa só isso — sem bcrypt, sem node:crypto, sem Prisma.
 * Os providers (com Node APIs) são adicionados em `auth.ts`.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // EasyPanel/Traefik atrás de proxy reverso — NextAuth v5 exige trustHost: true
  // pra aceitar o Host header do cliente. Sem isso retorna /api/auth/error.
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.tipo = (user as any).tipo;
        token.role = (user as any).role;
        token.clienteId = (user as any).clienteId;
        token.clienteRazaoSocial = (user as any).clienteRazaoSocial;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).tipo = token.tipo;
        (session.user as any).role = token.role;
        (session.user as any).clienteId = token.clienteId;
        (session.user as any).clienteRazaoSocial = token.clienteRazaoSocial;
      }
      return session;
    },
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;
      const tipo = (auth?.user as any)?.tipo;

      const isPublic =
        pathname === "/" ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/portal/login") ||
        pathname.startsWith("/portal/primeiro-acesso") ||
        pathname.startsWith("/portal/esqueci-senha") ||
        pathname.startsWith("/portal/resetar") ||
        pathname.startsWith("/forms") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/webhooks") ||
        pathname.startsWith("/api/cron") ||
        pathname.startsWith("/api/public") ||
        pathname.startsWith("/api/portal/auth") ||
        // Submissão de formulário público não requer login
        (pathname.startsWith("/api/forms/") && pathname.endsWith("/responses"));
      if (isPublic) return true;

      // Área do portal: não logado → /portal/login (não /login da equipe)
      if (pathname.startsWith("/portal") || pathname.startsWith("/api/portal")) {
        if (tipo === "cliente" || tipo === "equipe") return true;
        return Response.redirect(new URL("/portal/login", request.url));
      }

      return tipo === "equipe";
    },
  },
} satisfies NextAuthConfig;
