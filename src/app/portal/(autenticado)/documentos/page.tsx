import Link from "next/link";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, FileCog, Receipt, Archive, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { listarDocumentosDoCliente, type DocumentoPortal, type TipoDocumento } from "@/lib/services/portal-documentos";

export const dynamic = "force-dynamic";

const TIPO_VIS: Record<TipoDocumento, { label: string; icon: any; cor: string }> = {
  "contrato":    { label: "Contrato",     icon: FileCog, cor: "bg-blue-100 text-blue-800" },
  "nota-fiscal": { label: "Nota Fiscal",  icon: Receipt, cor: "bg-amber-100 text-amber-800" },
  "upload":      { label: "Documento",    icon: FileText, cor: "bg-emerald-100 text-emerald-800" },
};

function tamanhoFmt(b?: number): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function PortalDocumentosPage({
  searchParams,
}: {
  searchParams: { tipo?: string; q?: string; ano?: string };
}) {
  const session = await auth();
  const u = session!.user as any;

  const tipo = (searchParams.tipo ?? "todos") as TipoDocumento | "todos";
  const q = searchParams.q?.trim();
  const ano = searchParams.ano ? Number(searchParams.ano) : undefined;

  const desde = ano ? new Date(ano, 0, 1) : undefined;
  const ate = ano ? new Date(ano, 11, 31, 23, 59, 59) : undefined;

  const documentos = await listarDocumentosDoCliente(u.clienteId, {
    tipo: tipo === "todos" ? "todos" : tipo,
    busca: q,
    desde, ate,
  });

  // Por tipo (KPIs)
  const totais = {
    contrato:    documentos.filter((d) => d.tipo === "contrato").length,
    "nota-fiscal": documentos.filter((d) => d.tipo === "nota-fiscal").length,
    upload:      documentos.filter((d) => d.tipo === "upload").length,
  };

  // Anos disponíveis pra filtro
  const anosSet = new Set(documentos.map((d) => d.dataReferencia.getFullYear()));
  const anosDisponiveis = [...anosSet].sort((a, b) => b - a);

  function fazerLink(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    if (tipo !== "todos") sp.set("tipo", tipo);
    if (q) sp.set("q", q);
    if (ano) sp.set("ano", String(ano));
    for (const [k, v] of Object.entries(params)) {
      if (v == null) sp.delete(k);
      else sp.set(k, v);
    }
    const s = sp.toString();
    return `/portal/documentos${s ? `?${s}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <FileText className="h-7 w-7" /> Documentos
        </h1>
        <p className="text-muted-foreground">Contratos, notas fiscais e outros arquivos relacionados ao seu cadastro</p>
      </div>

      {/* KPIs por tipo (clicáveis pra filtrar) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href={fazerLink({ tipo: undefined })}>
          <Card className={`hover:border-cestacorp-blue/40 transition ${tipo === "todos" ? "border-cestacorp-blue" : ""}`}>
            <CardContent className="pt-4">
              <p className="text-xs uppercase text-muted-foreground">Todos</p>
              <p className="text-2xl font-bold">{documentos.length}</p>
            </CardContent>
          </Card>
        </Link>
        {(["contrato", "nota-fiscal", "upload"] as TipoDocumento[]).map((t) => {
          const v = TIPO_VIS[t];
          const Icon = v.icon;
          return (
            <Link key={t} href={fazerLink({ tipo: t })}>
              <Card className={`hover:border-cestacorp-blue/40 transition ${tipo === t ? "border-cestacorp-blue" : ""}`}>
                <CardContent className="pt-4">
                  <p className="text-xs uppercase text-muted-foreground flex items-center gap-1">
                    <Icon className="h-3 w-3" /> {v.label}
                  </p>
                  <p className="text-2xl font-bold">{totais[t]}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form className="flex gap-2 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground block mb-1">Buscar por título</label>
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Ex.: contrato, NF, comprovante…"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <input type="hidden" name="tipo" value={tipo} />
            <input type="hidden" name="ano" value={ano ?? ""} />
            <Button type="submit" size="sm">Buscar</Button>
            {(q || tipo !== "todos" || ano) && (
              <Button asChild type="button" size="sm" variant="ghost">
                <Link href="/portal/documentos">Limpar</Link>
              </Button>
            )}
          </form>

          {anosDisponiveis.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Ano:</span>
              <Link
                href={fazerLink({ ano: undefined })}
                className={`px-2 py-1 rounded-full ${!ano ? "bg-cestacorp-blue text-white" : "bg-muted hover:bg-muted/70"}`}
              >
                Todos
              </Link>
              {anosDisponiveis.map((a) => (
                <Link
                  key={a}
                  href={fazerLink({ ano: String(a) })}
                  className={`px-2 py-1 rounded-full ${ano === a ? "bg-cestacorp-blue text-white" : "bg-muted hover:bg-muted/70"}`}
                >
                  {a}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botão baixar tudo (ZIP) */}
      {documentos.length > 0 && (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <a
              href={`/api/portal/documentos/zip?${new URLSearchParams({
                ...(tipo !== "todos" ? { tipo } : {}),
                ...(q ? { q } : {}),
                ...(ano ? { ano: String(ano) } : {}),
              })}`}
            >
              <Archive className="h-3 w-3" /> Baixar tudo em ZIP ({documentos.length})
            </a>
          </Button>
        </div>
      )}

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{documentos.length} documento{documentos.length !== 1 ? "s" : ""}</CardTitle>
          <CardDescription>Ordenados pelo mais recente</CardDescription>
        </CardHeader>
        <CardContent>
          {documentos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum documento {tipo !== "todos" || q || ano ? "com esses filtros" : "ainda"}.
            </p>
          ) : (
            <ul className="divide-y">
              {documentos.map((d) => {
                const vis = TIPO_VIS[d.tipo];
                const Icon = vis.icon;
                return (
                  <li key={d.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${vis.cor}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{d.titulo}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.subtitulo}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(d.dataReferencia)}
                          {d.sizeBytes ? ` · ${tamanhoFmt(d.sizeBytes)}` : ""}
                        </p>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <a href={d.downloadUrl} download>
                        <Download className="h-3 w-3" /> Baixar
                      </a>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
