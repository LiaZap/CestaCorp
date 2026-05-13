import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortalContratos() {
  const session = await auth();
  const u = session!.user as any;

  const contratos = await prisma.contrato.findMany({
    where: { clienteId: u.clienteId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <FileText className="h-7 w-7" /> Contratos
        </h1>
        <p className="text-muted-foreground">Seus contratos com a Cestacorp</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {contratos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum contrato ainda.</p>
          ) : (
            <ul className="divide-y">
              {contratos.map((c) => (
                <li key={c.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">{c.numero ?? c.tipo}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(c.createdAt)} · {c.indiceReajuste}
                      {Number(c.valorHonorarios) > 0 ? ` · ${formatMoney(Number(c.valorHonorarios))}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="status-badge status-aberto text-[10px]">{c.status}</span>
                    {c.docxPath && (
                      <Button asChild size="sm" variant="outline">
                        <a href={`/api/portal/contratos/${c.id}/download`} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3 w-3" /> PDF
                        </a>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
