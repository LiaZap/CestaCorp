import Link from "next/link";
import { connectMongo } from "@/lib/db/mongo";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FormsIndex() {
  await connectMongo();
  const forms = await FormDefinitionModel.find({ active: true }).sort({ category: 1, title: 1 }).lean();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue">Formulários Cestacorp</h1>
        <p className="text-muted-foreground">Escolha o formulário que precisa preencher.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {forms.map((f: any) => (
          <Link key={f.slug} href={`/forms/${f.slug}`}>
            <Card className="hover:shadow-lg transition cursor-pointer bg-white/80 backdrop-blur">
              <CardHeader className="flex-row gap-3 items-start">
                <FileText className="h-6 w-6 text-cestacorp-green mt-1" />
                <div>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                  <CardDescription>{f.description || f.category}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
        {forms.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2">
            Nenhum formulário publicado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
