import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { autenticarCliente } from "@/lib/services/cliente-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "equipe",
      name: "equipe",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) return null;

        // Bloqueio após N falhas
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
          // incrementa contador de falhas, bloqueia em 5 falhas por 15min
          const falhas = (user.loginFailures ?? 0) + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              loginFailures: falhas,
              lockedUntil: falhas >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
            },
          });
          return null;
        }

        // Sucesso: zera falhas e marca último login
        await prisma.user.update({
          where: { id: user.id },
          data: {
            loginFailures: 0,
            lockedUntil: null,
            ultimoLogin: new Date(),
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tipo: "equipe",
        } as any;
      },
    }),
    Credentials({
      id: "cliente",
      name: "cliente",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "");
        const password = String(credentials?.password ?? "");
        const acesso = await autenticarCliente(email, password);
        if (!acesso) return null;
        return {
          id: acesso.id,
          email: acesso.email,
          name: acesso.nome,
          clienteId: acesso.clienteId,
          clienteRazaoSocial: acesso.clienteRazaoSocial,
          tipo: "cliente",
        } as any;
      },
    }),
  ],
});
