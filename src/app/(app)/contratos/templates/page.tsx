import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, FileText, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await prisma.contratoTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { contratos: true } } },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue">Templates de Contrato</h1>
          <p className="text-muted-foreground">
            Faça upload de arquivos .docx com placeholders entre chaves (ex.: <code>{'{razaoSocial}'}</code>).
          </p>
        </div>
        <Button asChild>
          <Link href="/contratos/templates/novo">
            <Plus className="h-4 w-4" /> Novo template
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Placeholders disponíveis</CardTitle>
          <CardDescription>Use essas variáveis dentro do arquivo .docx</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm font-mono">
            {[
              "{razaoSocial}", "{nomeFantasia}", "{cnpj}", "{endereco}",
              "{socios}", "{email}", "{telefone}", "{mesAniversario}",
              "{indiceReajuste}", "{dataAssinatura}",
            ].map((p) => (
              <span key={p} className="bg-muted px-2 py-1 rounded">{p}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{templates.length} templates</CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum template cadastrado.</p>
          ) : (
            <ul className="divide-y">
              {templates.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-cestacorp-green mt-0.5" />
                    <div>
                      <p className="font-medium">{t.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.tipo} · {t._count.contratos} contratos gerados · {formatDate(t.createdAt)}
                      </p>
                    </div>
                  </div>
                  <form action={`/api/contratos/templates/${t.id}`} method="post">
                    <input type="hidden" name="_method" value="DELETE" />
                    <Button type="submit" variant="ghost" size="icon" aria-label="Remover template">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
