/** @type {import('next').NextConfig} */

// Security headers (auditoria seg #48).
// CSP estrito mas permite unsafe-inline/eval — Next.js 14 ainda usa inline scripts
// em produção pra streaming SSR. Em Next 15+ dá pra apertar isso.
const SECURITY_HEADERS = [
  // HSTS só em prod — evita travar dev sem HTTPS
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.nibo.com.br https://api.autentique.com.br https://api.digisac.app https://www.autentique.com.br",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    // Antes era wildcard `**` — auditoria seg #30 (SSRF via Next/Image proxy).
    remotePatterns: [
      { protocol: "https", hostname: "cestacorp.com.br" },
      { protocol: "https", hostname: "cestacorp.bahflash.tech" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "www.gravatar.com" },
      { protocol: "https", hostname: "secure.gravatar.com" },
      { protocol: "https", hostname: "www.autentique.com.br" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  experimental: {
    serverComponentsExternalPackages: ["mongoose", "docxtemplater", "pizzip"],
    // Habilita src/instrumentation.ts pra rodar no boot do servidor (Next 14.x).
    // Em Next 15+ isso já vem ligado por default — pode remover depois do upgrade.
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
