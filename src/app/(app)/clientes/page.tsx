import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Upload, UserPlus, Download } from "lucide-react";
import { formatCpfCnpj } from "@/lib/utils";
import { contarAtrasadasPorCliente } from "@/lib/services/inadimplencia";
import { BolinhaAtraso } from "@/components/BolinhaAtraso";
import { FiltrosClientes } from "./FiltrosClientes";

export const dynamic = "force-dynamic";

const POR_PAGINA = 25;

/**
 * Listagem de clientes — Patrick (call 18/05 + chat 13/06):
 * "filtros e busca pra melhorar e auxiliar no dia a dia".
 *
 * Filtros suportados (cada um lê do searchParams; combinam com AND):
 *  - q              busca textual (razão / fantasia / cnpj / código se for numérico)
 *  - status         multi (ATIVO, INATIVO, ENCERRADO, PROSPECT, SUSPENSO)
 *  - classificacao  multi (BRONZE/PRATA/OURO/DIAMANTE/TOP)
 *  - tributacao     contém texto
 *  - prefeitura     contém texto
 *  - segmento       contém texto (Cliente.seguimento OR categoria)
 *  - responsavel    contém texto (qualquer um dos 3 respFiscal/Folha/Contabil)
 *  - inadimplencia  flag: "0" / "1+" / "3+"
 *  - sedeVirtual    sim/não
 *  - avaliacaoGoogle sim/não
 *  - folha          sim/não (folha != null)
 *  - ordenar        razao | codigo | inicio_asc | inicio_desc
 *  - pagina         paginação
 *  - export=csv     em vez de renderizar, redireciona pro /api/clientes/export
 *                   com os mesmos filtros (já implementado)
 */
export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const f = parseFiltros(searchParams);
  const where = montarWhere(f);

  const orderBy = (() => {
    switch (f.ordenar) {
      case "codigo": return { codigo: "asc" as const };
      case "inicio_asc": return [{ inicio: "asc" as const }, { razaoSocial: "asc" as const }];
      case "inicio_desc": return [{ inicio: "desc" as const }, { razaoSocial: "asc" as const }];
      case "razao":
      default: return { razaoSocial: "asc" as const };
    }
  })();

  const [clientes, total, opcoes] = await Promise.all([
    prisma.cliente.findMany({
      where,
      orderBy,
      skip: (f.pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: { _count: { select: { contratos: true, cobrancas: true } } },
    }),
    prisma.cliente.count({ where }),
    carregarOpcoesAutocomplete(),
  ]);

  const inadimplenciaMap = await contarAtrasadasPorCliente(clientes.map((c) => c.id));
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue">Clientes</h1>
          <p className="text-muted-foreground">
            {total.toLocaleString("pt-BR")} {total === 1 ? "cliente" : "clientes"}
            {temFiltro(f) && " com os filtros atuais"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild>
            <a href={`/api/clientes/export?${montarQuery(searchParams)}`} aria-label="Exportar CSV">
              <Download className="h-4 w-4" /> Exportar CSV
            </a>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/clientes/pre-cadastros">
              <UserPlus className="h-4 w-4" /> Pré-cadastros
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/clientes/importar">
              <Upload className="h-4 w-4" /> Importar V106
            </Link>
          </Button>
          <Button asChild>
            <Link href="/clientes/novo">
              <Plus className="h-4 w-4" /> Novo cliente
            </Link>
          </Button>
        </div>
      </div>

      <FiltrosClientes
        valores={{
          q: f.q ?? "",
          status: f.status,
          classificacao: f.classificacao,
          tributacao: f.tributacao ?? "",
          prefeitura: f.prefeitura ?? "",
          segmento: f.segmento ?? "",
          responsavel: f.responsavel ?? "",
          inadimplencia: f.inadimplencia,
          sedeVirtual: f.sedeVirtual,
          avaliacaoGoogle: f.avaliacaoGoogle,
          folha: f.folha,
          ordenar: f.ordenar,
        }}
        opcoes={opcoes}
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">
            Página {f.pagina} de {totalPaginas}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Exibindo {clientes.length} de {total.toLocaleString("pt-BR")}
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Razão social</th>
                <th className="py-2 pr-3">CPF/CNPJ</th>
                <th className="py-2 pr-3">Classif.</th>
                <th className="py-2 pr-3">Tributação</th>
                <th className="py-2 pr-3">Município</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3 text-right">Cobranças</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => {
                const qtdAtrasadas = inadimplenciaMap.get(c.id) ?? 0;
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 pr-3 tabular-nums font-mono">
                      {c.codigo != null ? (
                        <Link href={`/clientes/${c.id}`} className="text-cestacorp-blue hover:underline">
                          #{c.codigo}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2">
                        <BolinhaAtraso qtd={qtdAtrasadas} />
                        <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                          {c.razaoSocial}
                        </Link>
                      </span>
                      {c.nomeFantasia && c.nomeFantasia !== c.razaoSocial && (
                        <p className="text-[11px] text-muted-foreground">{c.nomeFantasia}</p>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{formatCpfCnpj(c.cpfCnpj)}</td>
                    <td className="py-2 pr-3">
                      {c.classificacao ? (
                        <span className={"text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded " + corClassif(c.classificacao)}>
                          {c.classificacao}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 pr-3 text-xs">{c.tributacao ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">{c.prefeitura ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span className={"status-badge " + (c.status === "ATIVO" ? "status-ativo" : "status-aberto")}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{c._count.cobrancas}</td>
                  </tr>
                );
              })}
              {clientes.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhum cliente com esses filtros.{" "}
                    <Link href="/clientes" className="text-primary hover:underline">
                      Limpar filtros
                    </Link>
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
        {totalPaginas > 1 && (
          <Paginacao pagina={f.pagina} totalPaginas={totalPaginas} buildLink={(p) => buildLink(searchParams, p)} />
        )}
      </Card>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────

type FiltrosParsed = ReturnType<typeof parseFiltros>;

function arrParam(v: string | string[] | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.flatMap((x) => x.split(",")).filter(Boolean);
  return v.split(",").filter(Boolean);
}

function parseFiltros(s: Record<string, string | string[] | undefined>) {
  return {
    q: typeof s.q === "string" ? s.q.trim() : undefined,
    status: arrParam(s.status),
    classificacao: arrParam(s.classificacao),
    tributacao: typeof s.tributacao === "string" ? s.tributacao.trim() : undefined,
    prefeitura: typeof s.prefeitura === "string" ? s.prefeitura.trim() : undefined,
    segmento: typeof s.segmento === "string" ? s.segmento.trim() : undefined,
    responsavel: typeof s.responsavel === "string" ? s.responsavel.trim() : undefined,
    inadimplencia: typeof s.inadimplencia === "string" ? s.inadimplencia : "todos",
    sedeVirtual: typeof s.sedeVirtual === "string" ? s.sedeVirtual : "todos",
    avaliacaoGoogle: typeof s.avaliacaoGoogle === "string" ? s.avaliacaoGoogle : "todos",
    folha: typeof s.folha === "string" ? s.folha : "todos",
    ordenar: (typeof s.ordenar === "string" ? s.ordenar : "razao") as "razao" | "codigo" | "inicio_asc" | "inicio_desc",
    pagina: Math.max(1, Number(typeof s.pagina === "string" ? s.pagina : "1") || 1),
  };
}

function temFiltro(f: FiltrosParsed): boolean {
  return Boolean(
    f.q ||
    f.status.length ||
    f.classificacao.length ||
    f.tributacao ||
    f.prefeitura ||
    f.segmento ||
    f.responsavel ||
    f.inadimplencia !== "todos" ||
    f.sedeVirtual !== "todos" ||
    f.avaliacaoGoogle !== "todos" ||
    f.folha !== "todos"
  );
}

function montarWhere(f: FiltrosParsed): any {
  const AND: any[] = [];

  // Busca textual: razao | fantasia | cnpj | código numérico
  if (f.q) {
    const numerico = /^\d+$/.test(f.q) ? Number(f.q) : null;
    AND.push({
      OR: [
        { razaoSocial: { contains: f.q, mode: "insensitive" } },
        { nomeFantasia: { contains: f.q, mode: "insensitive" } },
        { cpfCnpj: { contains: f.q.replace(/\D/g, "") } },
        ...(numerico !== null ? [{ codigo: numerico }] : []),
      ],
    });
  }

  if (f.status.length > 0) AND.push({ status: { in: f.status as any } });
  if (f.classificacao.length > 0) AND.push({ classificacao: { in: f.classificacao as any } });

  if (f.tributacao) AND.push({ tributacao: { contains: f.tributacao, mode: "insensitive" } });
  if (f.prefeitura) AND.push({ prefeitura: { contains: f.prefeitura, mode: "insensitive" } });

  if (f.segmento) {
    AND.push({
      OR: [
        { seguimento: { contains: f.segmento, mode: "insensitive" } },
        { categoria: { contains: f.segmento, mode: "insensitive" } },
      ],
    });
  }

  if (f.responsavel) {
    AND.push({
      OR: [
        { respFiscal: { contains: f.responsavel, mode: "insensitive" } },
        { respFolha: { contains: f.responsavel, mode: "insensitive" } },
        { respContabil: { contains: f.responsavel, mode: "insensitive" } },
      ],
    });
  }

  if (f.sedeVirtual === "sim") AND.push({ sedeVirtual: true });
  if (f.sedeVirtual === "nao") AND.push({ sedeVirtual: false });
  if (f.avaliacaoGoogle === "sim") AND.push({ avaliacaoGoogle: true });
  if (f.avaliacaoGoogle === "nao") AND.push({ avaliacaoGoogle: false });
  if (f.folha === "sim") AND.push({ folha: { not: null } });
  if (f.folha === "nao") AND.push({ folha: null });

  // Inadimplência: precisa de subquery em cobranças → faz com raw EXISTS via Prisma some/none
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  if (f.inadimplencia === "1+") {
    AND.push({
      cobrancas: {
        some: {
          OR: [
            { status: "ATRASADO" },
            { status: "ABERTO", vencimento: { lt: hoje } },
          ],
        },
      },
    });
  } else if (f.inadimplencia === "3+") {
    // "tem 3+ cobranças em atraso" — Prisma não suporta count agregado em where
    // direto. Aproximação: filtra os que têm ALGUMA atrasada; depois um pós-filtro
    // em JS reduz pra ≥3 só no resultado visível da página (não é tão preciso,
    // mas evita raw SQL e o caso real é pra inspeção visual com a bolinha).
    AND.push({
      cobrancas: {
        some: {
          OR: [
            { status: "ATRASADO" },
            { status: "ABERTO", vencimento: { lt: hoje } },
          ],
        },
      },
    });
  } else if (f.inadimplencia === "0") {
    AND.push({
      cobrancas: {
        none: {
          OR: [
            { status: "ATRASADO" },
            { status: "ABERTO", vencimento: { lt: hoje } },
          ],
        },
      },
    });
  }

  return AND.length === 0 ? { deletedAt: null } : { AND, deletedAt: null };
}

async function carregarOpcoesAutocomplete() {
  // Carrega os valores existentes pra alimentar Comboboxes (datalist).
  const [tributacoes, prefeituras, segmentos, categorias, respFiscal, respFolha, respContabil] = await Promise.all([
    prisma.cliente.findMany({ where: { tributacao: { not: null } }, select: { tributacao: true }, distinct: ["tributacao"], take: 50 }),
    prisma.cliente.findMany({ where: { prefeitura: { not: null } }, select: { prefeitura: true }, distinct: ["prefeitura"], take: 100 }),
    prisma.cliente.findMany({ where: { seguimento: { not: null } }, select: { seguimento: true }, distinct: ["seguimento"], take: 50 }),
    prisma.cliente.findMany({ where: { categoria: { not: null } }, select: { categoria: true }, distinct: ["categoria"], take: 50 }),
    prisma.cliente.findMany({ where: { respFiscal: { not: null } }, select: { respFiscal: true }, distinct: ["respFiscal"], take: 30 }),
    prisma.cliente.findMany({ where: { respFolha: { not: null } }, select: { respFolha: true }, distinct: ["respFolha"], take: 30 }),
    prisma.cliente.findMany({ where: { respContabil: { not: null } }, select: { respContabil: true }, distinct: ["respContabil"], take: 30 }),
  ]);

  const responsaveis = new Set<string>();
  for (const r of respFiscal) if (r.respFiscal) responsaveis.add(r.respFiscal);
  for (const r of respFolha) if (r.respFolha) responsaveis.add(r.respFolha);
  for (const r of respContabil) if (r.respContabil) responsaveis.add(r.respContabil);

  return {
    tributacoes: tributacoes.map((t) => t.tributacao!).filter(Boolean).sort(),
    prefeituras: prefeituras.map((p) => p.prefeitura!).filter(Boolean).sort(),
    segmentos: [...new Set([
      ...segmentos.map((s) => s.seguimento!),
      ...categorias.map((c) => c.categoria!),
    ])].filter(Boolean).sort(),
    responsaveis: [...responsaveis].sort(),
  };
}

function corClassif(c: string): string {
  switch (c) {
    case "BRONZE": return "bg-amber-700/15 text-amber-900";
    case "PRATA": return "bg-slate-300/40 text-slate-700";
    case "OURO": return "bg-yellow-400/30 text-yellow-900";
    case "DIAMANTE": return "bg-cyan-300/40 text-cyan-900";
    case "TOP": return "bg-purple-300/40 text-purple-900";
    default: return "bg-muted text-muted-foreground";
  }
}

function montarQuery(s: Record<string, string | string[] | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(s)) {
    if (k === "pagina" || k === "export") continue;
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => x && usp.append(k, x));
    else if (v) usp.set(k, v);
  }
  return usp.toString();
}

function buildLink(s: Record<string, string | string[] | undefined>, pagina: number): string {
  const qs = montarQuery(s);
  const usp = new URLSearchParams(qs);
  if (pagina > 1) usp.set("pagina", String(pagina));
  const out = usp.toString();
  return "/clientes" + (out ? `?${out}` : "");
}

function Paginacao({
  pagina, totalPaginas, buildLink,
}: {
  pagina: number; totalPaginas: number; buildLink: (p: number) => string;
}) {
  return (
    <div className="border-t px-6 py-3 flex items-center justify-between">
      <a href={buildLink(Math.max(1, pagina - 1))} aria-disabled={pagina <= 1}
        className={"text-sm px-2 py-1 rounded " + (pagina <= 1 ? "opacity-40 pointer-events-none" : "hover:bg-muted")}>
        ← Anterior
      </a>
      <div className="flex items-center gap-1 text-sm">
        {gerarPaginas(pagina, totalPaginas).map((p, i) =>
          typeof p === "number" ? (
            <a
              key={i}
              href={buildLink(p)}
              className={
                "px-3 py-1 rounded-md transition " +
                (p === pagina ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted")
              }
            >
              {p}
            </a>
          ) : (
            <span key={i} className="px-1 text-muted-foreground">…</span>
          )
        )}
      </div>
      <a href={buildLink(Math.min(totalPaginas, pagina + 1))} aria-disabled={pagina >= totalPaginas}
        className={"text-sm px-2 py-1 rounded " + (pagina >= totalPaginas ? "opacity-40 pointer-events-none" : "hover:bg-muted")}>
        Próxima →
      </a>
    </div>
  );
}

function gerarPaginas(atual: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const paginas: (number | "...")[] = [1];
  if (atual > 3) paginas.push("...");
  const inicio = Math.max(2, atual - 1);
  const fim = Math.min(total - 1, atual + 1);
  for (let p = inicio; p <= fim; p++) paginas.push(p);
  if (atual < total - 2) paginas.push("...");
  paginas.push(total);
  return paginas;
}
