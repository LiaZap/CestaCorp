import Link from "next/link";
import { auth } from "@/lib/auth";
import { connectMongo } from "@/lib/db/mongo";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { FormResponseModel } from "@/models/FormResponse";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardList, ArrowRight, History } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortalFormularios() {
  const session = await auth();
  const u = session!.user as any;

  await connectMongo();
  const [disponiveis, meusEnvios] = await Promise.all([
    FormDefinitionModel.find({ active: true }).sort({ title: 1 }).lean(),
    FormResponseModel.find({ clienteId: u.clienteId }).sort({ createdAt: -1 }).limit(30).lean(),
  ]);

  const titulo: Record<string, string> = Object.fromEntries(
    disponiveis.map((f: any) => [f.slug, f.title])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <ClipboardList className="h-7 w-7" /> Formulários
        </h1>
        <p className="text-muted-foreground">Solicite serviços ou atualize informações</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Disponíveis</CardTitle>
          <CardDescription>Clique para preencher</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {disponiveis.map((f: any) => (
              <Link
                key={f.slug}
                href={`/forms/${f.slug}`}
                className="border rounded-md p-4 hover:border-primary hover:shadow transition flex items-start justify-between gap-2"
              >
                <div>
                  <p className="font-medium">{f.title}</p>
                  {f.description && <p className="text-xs text-muted-foreground mt-1">{f.description}</p>}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Seus envios recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {meusEnvios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Você ainda não enviou nenhum formulário.</p>
          ) : (
            <ul className="divide-y">
              {meusEnvios.map((f: any) => (
                <li key={String(f._id)} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{titulo[f.formSlug] ?? f.formSlug}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(f.createdAt)}</p>
                  </div>
                  <span className="status-badge status-aberto text-[10px]">{f.status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
