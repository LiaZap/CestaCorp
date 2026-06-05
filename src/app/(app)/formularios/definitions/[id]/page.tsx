import Link from "next/link";
import { notFound } from "next/navigation";
import { connectMongo } from "@/lib/db/mongo";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { FormBuilder } from "../FormBuilder";

export const dynamic = "force-dynamic";

export default async function EditarFormularioPage({
  params,
}: {
  params: { id: string };
}) {
  await connectMongo();
  const def = await FormDefinitionModel.findById(params.id).lean<any>();
  if (!def) notFound();

  return (
    <div className="space-y-6">
      <Link href="/formularios/definitions" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Formulários
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <ClipboardList className="h-7 w-7" /> Editar: {def.title}
        </h1>
        <p className="text-muted-foreground">
          Edite campos, adicione validações e veja em tempo real. As respostas existentes são preservadas.
        </p>
      </div>

      <FormBuilder
        initial={{
          id: String(def._id),
          slug: def.slug,
          title: def.title,
          description: def.description ?? "",
          category: def.category,
          fields: def.fields,
          active: def.active ?? true,
          notifyEmails: def.notifyEmails ?? [],
          versao: def.versao ?? 1,
        }}
      />
    </div>
  );
}
