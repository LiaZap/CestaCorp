import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, Info, Tag as TagIcon, Filter } from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORIAS = [
  { key: "TODAS", label: "Todas", icon: TagIcon },
  { key: "REGIME", label: "Regime", color: "bg-blue-100 text-blue-700" },
  { key: "FOLHA", label: "Folha", color: "bg-emerald-100 text-emerald-700" },
  { key: "HONORARIO", label: "Honorário", color: "bg-amber-100 text-amber-700" },
  { key: "MUNICIPIO", label: "Município", color: "bg-sky-100 text-sky-700" },
  { key: "SERVICO", label: "Serviço", color: "bg-purple-100 text-purple-700" },
  { key: "SEGMENTO", label: "Segmento", color: "bg-pink-100 text-pink-700" },
  { key: "CLASSIFICACAO", label: "Classificação", color: "bg-yellow-100 text-yellow-700" },
  { key: "OPERACIONAL", label: "Operacional", color: "bg-slate-100 text-slate-700" },
  { key: "GERAL", label: "Geral", color: "bg-gray-100 text-gray-700" },
];

function badgeCategoria(cat: string) {
  const c = CATEGORIAS.find((x) => x.key === cat);
  return c?.color ?? "bg-gray-100 text-gray-700";
}

export default async function TagsPage({
  searchParams,
}: {
  searchParams: { synced?: string; novas?: string; atualizadas?: string; modo?: string; categoria?: string; q?: string };
}) {
  const where: any = {};
  if (searchParams.categoria && searchParams.categoria !== "TODAS") {
    where.categoria = searchParams.categoria;
  }
  if (searchParams.q) {
    where.nome = { contains: searchParams.q, mode: "insensitive" };
  }

  const tags = await prisma.tag.findMany({
    where,
    orderBy: [{ categoria: "asc" }, { nome: "asc" }],
    include: { _count: { select: { clientes: true, textos: true } } },
  });

  // Contadores por categoria
  const counts = await prisma.tag.groupBy({
    by: ["categoria"],
    _count: true,
  });
  const totalPorCategoria: Record<string, number> = {};
  for (const c of counts) totalPorCategoria[c.categoria] = c._count;
  const total = tags.length;

  const syncedFeedback = searchParams.synced === "1";
  const novas = Number(searchParams.novas ?? 0);
  const atualizadas = Number(searchParams.atualizadas ?? 0);
  const modo = searchParams.modo;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
            <TagIcon className="h-7 w-7" /> Tags
          </h1>
          <p className="text-muted-foreground">
            Categorizadas para filtrar agenda, régua e relatórios. Tags importadas da V-106 do Marlon.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/tags/regras">
              <Filter className="h-4 w-4" /> Regras automáticas
            </Link>
          </Button>
          <form action="/api/tags/sincronizar" method="post">
            <Button type="submit">
              <RefreshCw className="h-4 w-4" /> Sincronizar Digisac
            </Button>
          </form>
        </div>
      </div>

      {syncedFeedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-800">Sincronização concluída</p>
            <p className="text-emerald-700">
              {novas} tag(s) importada(s) · {atualizadas} atualizada(s).
              {(modo === "demo" || modo === "fallback") && (
                <span className="inline-flex items-center gap-1 ml-2 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-xs">
                  <Info className="h-3 w-3" />
                  {modo === "demo" ? "modo demo" : "API indisponível — usou demo"}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Filtro por categoria */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIAS.map((c) => {
          const ativo = (searchParams.categoria ?? "TODAS") === c.key;
          const qtd = c.key === "TODAS" ? Object.values(totalPorCategoria).reduce((a, b) => a + b, 0) : (totalPorCategoria[c.key] ?? 0);
          return (
            <Link
              key={c.key}
              href={`/tags?categoria=${c.key}${searchParams.q ? `&q=${searchParams.q}` : ""}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                ativo
                  ? "bg-cestacorp-blue text-white shadow"
                  : c.color ?? "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {c.label}
              <span className={ativo ? "bg-white/25 px-1.5 rounded-full" : "bg-white/60 px-1.5 rounded-full"}>
                {qtd}
              </span>
            </Link>
          );
        })}
      </div>

      <form className="flex gap-2 max-w-md">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Buscar tag por nome…"
          className="flex-1 h-10 rounded-md border bg-background px-3 text-sm"
        />
        {searchParams.categoria && searchParams.categoria !== "TODAS" && (
          <input type="hidden" name="categoria" value={searchParams.categoria} />
        )}
        <Button variant="secondary" type="submit">Buscar</Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>{total} tag{total !== 1 ? "s" : ""}</CardTitle>
          <CardDescription>
            Cada tag pode ter múltiplos textos automáticos para uso em campanhas WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Tag</th>
                <th className="py-2 pr-3">Categoria</th>
                <th className="py-2 pr-3">Origem</th>
                <th className="py-2 pr-3 text-right">Clientes</th>
                <th className="py-2 pr-3 text-right">Textos</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: t.cor ?? "#84CC16" }} />
                      <b className="truncate">{t.nome}</b>
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${badgeCategoria(t.categoria)}`}>
                      {CATEGORIAS.find((c) => c.key === t.categoria)?.label ?? t.categoria}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="text-xs text-muted-foreground">{t.origem ?? "interno"}</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{t._count.clientes}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{t._count.textos}</td>
                </tr>
              ))}
              {tags.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhuma tag {searchParams.categoria && searchParams.categoria !== "TODAS" ? `na categoria ${searchParams.categoria}` : ""}.
                    {!searchParams.categoria && (
                      <>
                        {" "}Importe a V-106 em <Link className="text-primary hover:underline" href="/clientes/importar">/clientes/importar</Link> ou
                        sincronize com o Digisac.
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
