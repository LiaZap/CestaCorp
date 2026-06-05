/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // typescript: { ignoreBuildErrors: false } — tipos estruturalmente corretos desde o sprint de hardening
  experimental: {
    serverComponentsExternalPackages: ["mongoose", "docxtemplater", "pizzip"],
    // Habilita src/instrumentation.ts pra rodar no boot do servidor (Next 14.x).
    // Em Next 15+ isso já vem ligado por default — pode remover depois do upgrade.
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
