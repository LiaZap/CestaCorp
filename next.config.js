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
  },
};

module.exports = nextConfig;
