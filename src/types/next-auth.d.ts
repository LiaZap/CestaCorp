import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: "ADMIN" | "GESTOR" | "OPERADOR";
      tipo?: "equipe" | "cliente";
      clienteId?: string;
      clienteRazaoSocial?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role?: "ADMIN" | "GESTOR" | "OPERADOR";
    tipo?: "equipe" | "cliente";
    clienteId?: string;
    clienteRazaoSocial?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "ADMIN" | "GESTOR" | "OPERADOR";
    tipo?: "equipe" | "cliente";
    clienteId?: string;
    clienteRazaoSocial?: string;
  }
}
