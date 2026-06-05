import { notFound } from "next/navigation";
import { connectMongo } from "@/lib/db/mongo";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormRenderer } from "./FormRenderer";

export const dynamic = "force-dynamic";

export default async function FormPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { pre?: string };
}) {
  await connectMongo();
  const form = await FormDefinitionModel.findOne({ slug: params.slug, active: true }).lean<any>();
  if (!form) notFound();

  // ?pre=<id> chega quando o link veio do e-mail de boas-vindas do pré-cadastro (#79).
  const preCadastroId = searchParams.pre?.trim() || undefined;

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-white/85 backdrop-blur shadow-lg">
        <CardHeader>
          <CardTitle className="text-cestacorp-blue">{form.title}</CardTitle>
          {form.description && <CardDescription>{form.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <FormRenderer slug={form.slug} fields={form.fields} preCadastroId={preCadastroId} />
        </CardContent>
      </Card>
    </div>
  );
}
