import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cestacorp — Sistema Interno",
  description: "Plataforma Cestacorp: clientes, contratos, régua de cobrança e formulários.",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "256x256", type: "image/png" },
    ],
    shortcut: "/favicon-32.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Tema claro fixo — sistema interno corporativo, não acompanhamos dark mode do SO
  return (
    <html lang="pt-BR" className="light" style={{ colorScheme: "light" }}>
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
