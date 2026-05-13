import Link from "next/link";
import { connectMongo } from "@/lib/db/mongo";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardList, Plus, ExternalLink, Pencil, Eye } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CATEGORIAS: Record<string, string> = {
  "abertura-empresa": "Abertura de empresa",
  "alteracao-empresa": "Alteração de empresa",
  "abertura-mei": "Abertura MEI",
  "alteracao-mei": "Alteração MEI",
  "socios": "Sócios",
  "carne-leao": "Carnê-Leão",
  "esocial-domestico": "eSocial Doméstico",
  "gps-avulsa": "GPS Avulsa",
  "outros": "Outros",
};

export default async function FormDefinitionsPage() {
  await connectMongo();
  const forms = await FormDefinitionModel.find().sort({ category: 1, title: 1 }).lean();

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/formularios" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Inbox de respostas
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
            <ClipboardList className="h-7 w-7" /> Formulários públicos
          </h1>
          <p className="text-muted-foreground">
            Gerencie os formulários que clientes preenchem. Crie, edite campos e visualize antes de publicar.
          </p>
        </div>
        <Button asChild>
          <Link href="/formularios/definitions/novo">
            <Plus className="h-4 w-4" /> Novo formulário
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{forms.length} formulário{forms.length !== 1 ? "s" : ""}</CardTitle>
          <CardDescription>
            Cada formulário tem um link público <code>/forms/[slug]</code> que pode ser compartilhado por WhatsApp/email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forms.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum formulário cadastrado. Crie o primeiro para começar a coletar dados de clientes.
            </p>
          ) : (
            <ul className="divide-y">
              {forms.map((f: any) => (
                <li key={String(f._id)} className="py-3 flex items-start gap-3 flex-wrap">
                  <div className="h-10 w-10 rounded-md bg-cestacorp-blue/10 text-cestacorp-blue flex items-center justify-center shrink-0">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{f.title}</p>
                      <span className="text-[10px] bg-cestacorp-blue/10 text-cestacorp-blue px-2 py-0.5 rounded-full">
                        {CATEGORIAS[f.category] ?? f.category}
                      </span>
                      {!f.active && <span className="status-badge status-erro text-[10px]">inativo</span>}
                    </div>
                    {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      <code className="font-mono">/forms/{f.slug}</code> ·
                      {" "}{f.fields.length} campo{f.fields.length !== 1 ? "s" : ""} ·
                      {" "}atualizado {formatDateTime(f.updatedAt)}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/forms/${f.slug}`} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-3 w-3" /> Visualizar
                      </Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href={`/formularios/definitions/${String(f._id)}`}>
                        <Pencil className="h-3 w-3" /> Editar
                      </Link>
                    </Button>
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
