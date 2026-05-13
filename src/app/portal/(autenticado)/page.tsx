import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongo";
import { FormResponseModel } from "@/models/FormResponse";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/utils";
import { CreditCard, AlertCircle, FileText, ClipboardList, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PortalHome() {
  const session = await auth();
  const u = session!.user as any;

  const [cobrancasAbertas, proximas, valorAberto, contratosAtivos] = await Promise.all([
    prisma.cobranca.count({
      where: { clienteId: u.clienteId, status: { in: ["ABERTO", "ATRASADO"] } },
    }),
    prisma.cobranca.findMany({
      where: { clienteId: u.clienteId, status: { in: ["ABERTO", "ATRASADO"] } },
      orderBy: { vencimento: "asc" },
      take: 5,
    }),
    prisma.cobranca.aggregate({
      _sum: { valor: true },
      where: { clienteId: u.clienteId, status: { in: ["ABERTO", "ATRASADO"] } },
    }),
    prisma.contrato.count({
      where: { clienteId: u.clienteId, status: { in: ["EMITIDO", "ASSINADO"] } },
    }),
  ]);

  await connectMongo();
  const formsPublicos = await FormDefinitionModel.find({ active: true }).select("slug title category").lean();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue">Olá, {u.name.split(" ")[0]}!</h1>
        <p className="text-muted-foreground">Aqui está um resumo da sua conta com a Cestacorp.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Em aberto</CardTitle>
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(Number(valorAberto._sum.valor ?? 0))}</p>
            <p className="text-xs text-muted-foreground">{cobrancasAbertas} cobrança(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Contratos ativos</CardTitle>
            <FileText className="h-5 w-5 text-cestacorp-green" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{contratosAtivos}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Formulários</CardTitle>
            <ClipboardList className="h-5 w-5 text-cestacorp-blue" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formsPublicos.length}</p>
            <p className="text-xs text-muted-foreground">disponíveis para preencher</p>
          </CardContent>
        </Card>
      </div>

      {/* Próximos boletos */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Próximos boletos</CardTitle>
            <CardDescription>Os 5 mais próximos do vencimento</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/portal/cobrancas">Ver todos <ArrowRight className="h-3 w-3" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {proximas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tudo em dia por aqui 🎉</p>
          ) : (
            <ul className="divide-y">
              {proximas.map((c) => (
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

      {/* Atalhos de formulários */}
      <Card>
        <CardHeader>
          <CardTitle>Formulários disponíveis</CardTitle>
          <CardDescription>Solicite serviços e alterações preenchendo os formulários</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {formsPublicos.map((f: any) => (
              <Link
                key={f.slug}
                href={`/forms/${f.slug}`}
                className="border rounded-md p-3 hover:border-primary hover:bg-primary/5 transition"
              >
                <p className="font-medium">{f.title}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
