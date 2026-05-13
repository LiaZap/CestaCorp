import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/utils";
import { CreditCard } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PortalCobrancas() {
  const session = await auth();
  const u = session!.user as any;

  const [abertas, pagas] = await Promise.all([
    prisma.cobranca.findMany({
      where: { clienteId: u.clienteId, status: { in: ["ABERTO", "ATRASADO"] } },
      orderBy: { vencimento: "asc" },
    }),
    prisma.cobranca.findMany({
      where: { clienteId: u.clienteId, status: "PAGO" },
      orderBy: { dataPagamento: "desc" },
      take: 24,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <CreditCard className="h-7 w-7" /> Meus boletos
        </h1>
        <p className="text-muted-foreground">Boletos emitidos pela Cestacorp</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Em aberto ({abertas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {abertas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum boleto em aberto. 🎉</p>
          ) : (
            <ul className="divide-y">
              {abertas.map((c) => (
                <li key={c.id}>
                  <Link href={`/portal/cobrancas/${c.id}`} className="flex items-center justify-between py-3 hover:bg-muted/50 -mx-2 px-2 rounded">
                    <div>
                      <p className="font-medium">{c.descricao ?? "Honorários"}</p>
                      <p className="text-xs text-muted-foreground">Vence {formatDate(c.vencimento)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatMoney(Number(c.valor))}</p>
                      <span className={"status-badge text-[10px] " + (c.status === "ATRASADO" ? "status-atraso" : "status-pendente")}>
                        {c.status}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos pagamentos ({pagas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pagas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem histórico.</p>
          ) : (
            <ul className="divide-y">
              {pagas.map((c) => (
                <li key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{c.descricao ?? "Honorários"}</p>
                    <p className="text-xs text-muted-foreground">Pago em {formatDate(c.dataPagamento)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatMoney(Number(c.valor))}</p>
                    <span className="status-badge status-pago text-[10px]">PAGO</span>
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
