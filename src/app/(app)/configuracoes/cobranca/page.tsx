import Link from "next/link";
import { ArrowLeft, Calculator } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { ConfigCobrancaForm } from "./ConfigCobrancaForm";

export const dynamic = "force-dynamic";

export default async function ConfigCobrancaPage() {
  const cfg = await prisma.configCobranca.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/configuracoes" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Configurações
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <Calculator className="h-7 w-7" /> Juros e multa de atraso
        </h1>
        <p className="text-muted-foreground">
          Regra padrão Cestacorp: <b>1% juros/dia + 2% multa</b> após carência de <b>3 dias corridos</b>
          (sáb/dom contam). Confirmado por Patrick em 09/05/2026.
        </p>
      </div>

      <ConfigCobrancaForm
        initial={{
          jurosPctAoDia: Number(cfg.jurosPctAoDia),
          multaPct: Number(cfg.multaPct),
          carenciaDias: cfg.carenciaDias,
          jurosCompostos: cfg.jurosCompostos,
          ativo: cfg.ativo,
        }}
      />
    </div>
  );
}
