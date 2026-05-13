import Link from "next/link";
import { connectMongo } from "@/lib/db/mongo";
import { FormResponseModel } from "@/models/FormResponse";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { Inbox, ExternalLink, ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  RECEBIDO: "status-pendente",
  EM_ANALISE: "status-aberto",
  APLICADO: "status-pago",
  REJEITADO: "status-erro",
};

export default async function FormulariosInbox({ searchParams }: { searchParams: { status?: string; slug?: string } }) {
  await connectMongo();

  const filter: any = {};
  if (searchParams.status) filter.status = searchParams.status;
  if (searchParams.slug) filter.formSlug = searchParams.slug;

  const [respostas, forms, counts] = await Promise.all([
    FormResponseModel.find(filter).sort({ createdAt: -1 }).limit(100).lean(),
    FormDefinitionModel.find({ active: true }).select("slug title").lean(),
    FormResponseModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  const countMap = Object.fromEntries(counts.map((c: any) => [c._id, c.count]));
  const formTitles = Object.fromEntries(forms.map((f: any) => [f.slug, f.title]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
            <Inbox className="h-7 w-7" /> Formulários respondidos
          </h1>
          <p className="text-muted-foreground">Todas as respostas que entram pelos formulários públicos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild>
            <Link href="/formularios/definitions">
              <ClipboardList className="h-4 w-4" /> Gerenciar formulários
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/formularios/importar-google">
              <Inbox className="h-4 w-4" /> Importar Google Forms
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/forms" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Ver formulários públicos
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {["RECEBIDO", "EM_ANALISE", "APLICADO", "REJEITADO"].map((s) => (
          <Card key={s}><CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">{s}</p>
            <p className="text-2xl font-bold">{countMap[s] ?? 0}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Link href="/formularios" className={`status-badge ${!searchParams.slug ? "bg-primary text-white" : "status-aberto"}`}>Todos</Link>
        {forms.map((f: any) => (
          <Link key={f.slug} href={`/formularios?slug=${f.slug}`}
            className={`status-badge ${searchParams.slug === f.slug ? "bg-primary text-white" : "status-aberto"}`}>
            {f.title}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{respostas.length} respostas</CardTitle>
          <CardDescription>Clique para ver detalhes e aplicar ao cadastro</CardDescription>
        </CardHeader>
        <CardContent>
          {respostas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma resposta.</p>
          ) : (
            <ul className="divide-y">
              {respostas.map((r: any) => (
                <li key={String(r._id)}>
                  <Link href={`/formularios/${r._id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-muted/50 -mx-2 px-2 rounded">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.autor?.nome || "Sem nome"} <span className="text-muted-foreground">· {r.autor?.email}</span></p>
                      <p className="text-xs text-muted-foreground">
                        {formTitles[r.formSlug] || r.formSlug} · {formatDateTime(r.createdAt)}
                      </p>
                    </div>
                    <span className={"status-badge " + (STATUS_STYLE[r.status] || "status-aberto")}>
                      {r.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
