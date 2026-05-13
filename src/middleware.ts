import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Instância Edge-compatible (sem providers que usam Node APIs)
const { auth } = NextAuth(authConfig);

/**
 * Regex para detectar user-agent mobile.
 * Se um mobile bate em /dashboard direto, redireciona pra /m.
 * Cookie "force-desktop=1" pula o redirect.
 */
const MOBILE_UA = /android|iphone|ipad|ipod|iemobile|blackberry|mobile/i;

const ROTAS_COM_REDIRECT_MOBILE = new Set([
  "/dashboard", "/clientes", "/cobrancas", "/regua-cobranca", "/agenda",
]);

export default auth((req) => {
  const ua = req.headers.get("user-agent") ?? "";
  const forceDesktop = req.cookies.get("force-desktop")?.value === "1";

  if (!forceDesktop && MOBILE_UA.test(ua)) {
    const { pathname } = req.nextUrl;
    const shouldRedirect = pathname === "/dashboard" ||
      [...ROTAS_COM_REDIRECT_MOBILE].some((p) => pathname === p);
    if (shouldRedirect) {
      const url = req.nextUrl.clone();
      url.pathname = "/m";
      return NextResponse.redirect(url);
    }
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico|gif)$).*)"],
};
