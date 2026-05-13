import { notFound } from "next/navigation";
import Link from "next/link";
import { connectMongo } from "@/lib/db/mongo";
import { FormResponseModel } from "@/models/FormResponse";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FormResponseDetail({ params }: { params: { id: string } }) {
  await connectMongo();
  const resposta: any = await FormResponseModel.findById(params.id).lean();
  if (!resposta) notFound();
  const form: any = await FormDefinitionModel.findOne({ slug: resposta.formSlug }).lean();

  let clienteLink = null;
  if (resposta.clienteId) {
    const c = await prisma.cliente.findUnique({ where: { id: resposta.clienteId }, select: { id: true, razaoSocial: true } });
    if (c) clienteLink = c;
  }

  const fields: any[] = form?.fields ?? [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/formularios" className="text-sm text-muted-foreground hover:text-primary">← Voltar</Link>
        <h1 className="text-3xl font-bold text-cestacorp-blue mt-2">
          {form?.title || resposta.formSlug}
        </h1>
        <p className="text-muted-foreground">
          Enviado em {formatDateTime(resposta.createdAt)} · {resposta.autor?.nome} · {resposta.autor?.email}
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row justify-between items-center">
          <CardTitle>Respostas</CardTitle>
          <span className="status-badge status-pendente">{resposta.status}</span>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.length === 0 ? (
            // formulário desconhecido — mostra JSON
            <pre className="bg-muted p-4 rounded-md text-xs overflow-auto">
              {JSON.stringify(resposta.answers, null, 2)}
            </pre>
          ) : (
            fields.filter((f) => f.type !== "section").map((f) => {
              const val = resposta.answers?.[f.key];
              return (
                <div key={f.key} className="grid grid-cols-1 md:grid-cols-3 gap-2 py-2 border-b last:border-0">
                  <dt className="text-sm text-muted-foreground">{f.label}</dt>
                  <dd className="text-sm md:col-span-2">{val ? String(val) : <span className="text-muted-foreground">—</span>}</dd>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ações</CardTitle></CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          {clienteLink ? (
            <Button asChild variant="outline">
              <Link href={`/clientes/${clienteLink.id}`}>Ver cliente: {clienteLink.razaoSocial}</Link>
            </Button>
          ) : (
            <form action={`/api/forms/responses/${resposta._id}/aplicar`} method="post">
              <Button type="submit">Aplicar ao cadastro (criar/atualizar cliente)</Button>
            </form>
          )}
          <form action={`/api/forms/responses/${resposta._id}/status`} method="post">
            <input type="hidden" name="status" value="EM_ANALISE" />
            <Button type="submit" variant="outline">Marcar em análise</Button>
          </form>
          <form action={`/api/forms/responses/${resposta._id}/status`} method="post">
            <input type="hidden" name="status" value="REJEITADO" />
            <Button type="submit" variant="destructive">Rejeitar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
