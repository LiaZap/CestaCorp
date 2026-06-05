import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/security/roles";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { LixeiraActions } from "./LixeiraActions";

export const dynamic = "force-dynamic";

/**
 * Lixeira (#59) — somente ADMIN. Lista soft-deleted dos principais modelos
 * permite restaurar (zera deletedAt) ou apagar definitivo (DELETE no raw).
 */
export default async function LixeiraPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!isAdmin(session)) redirect("/configuracoes");

  // Usa prismaRaw pra ignorar o filtro deletedAt:null da extension
  const [clientes, contratos, cobrancas, eventos] = await Promise.all([
    prisma.cliente.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      take: 50,
      select: { id: true, razaoSocial: true, cpfCnpj: true, deletedAt: true },
    }),
    prisma.contrato.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      take: 50,
      select: { id: true, numero: true, deletedAt: true, cliente: { select: { razaoSocial: true } } },
    }),
    prisma.cobranca.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      take: 50,
      select: { id: true, descricao: true, valor: true, vencimento: true, deletedAt: true, cliente: { select: { razaoSocial: true } } },
    }),
    prisma.eventoAgenda.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      take: 50,
      select: { id: true, titulo: true, dataVencimento: true, deletedAt: true },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <Trash2 className="h-7 w-7" aria-hidden="true" />
          Lixeira
        </h1>
        <p className="text-muted-foreground">
          Registros excluídos via soft-delete. Restaure ou apague definitivamente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes excluídos · {clientes.length}</CardTitle>
          <CardDescription>Restaurar reaparece na listagem.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Razão social</th>
                <th className="py-2 pr-3">Documento</th>
                <th className="py-2 pr-3">Excluído em</th>
                <th className="py-2 pr-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{c.razaoSocial}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{c.cpfCnpj}</td>
                  <td className="py-2 pr-3">{formatDate(c.deletedAt)}</td>
                  <td className="py-2 pr-3 text-right">
                    <LixeiraActions modelo="cliente" id={c.id} />
                  </td>
                </tr>
              ))}
              {clientes.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Vazio.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contratos excluídos · {contratos.length}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Número</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Excluído em</th>
                <th className="py-2 pr-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{c.numero ?? c.id.slice(0, 8)}</td>
                  <td className="py-2 pr-3">{c.cliente?.razaoSocial ?? "—"}</td>
                  <td className="py-2 pr-3">{formatDate(c.deletedAt)}</td>
                  <td className="py-2 pr-3 text-right">
                    <LixeiraActions modelo="contrato" id={c.id} />
                  </td>
                </tr>
              ))}
              {contratos.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Vazio.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cobranças excluídas · {cobrancas.length}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Descrição</th>
                <th className="py-2 pr-3">Vencimento</th>
                <th className="py-2 pr-3">Excluído em</th>
                <th className="py-2 pr-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {cobrancas.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{c.cliente?.razaoSocial ?? "—"}</td>
                  <td className="py-2 pr-3">{c.descricao ?? "—"}</td>
                  <td className="py-2 pr-3">{formatDate(c.vencimento)}</td>
                  <td className="py-2 pr-3">{formatDate(c.deletedAt)}</td>
                  <td className="py-2 pr-3 text-right">
                    <LixeiraActions modelo="cobranca" id={c.id} />
                  </td>
                </tr>
              ))}
              {cobrancas.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Vazio.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos da agenda excluídos · {eventos.length}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Título</th>
                <th className="py-2 pr-3">Vencimento</th>
                <th className="py-2 pr-3">Excluído em</th>
                <th className="py-2 pr-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{e.titulo}</td>
                  <td className="py-2 pr-3">{formatDate(e.dataVencimento)}</td>
                  <td className="py-2 pr-3">{formatDate(e.deletedAt)}</td>
                  <td className="py-2 pr-3 text-right">
                    <LixeiraActions modelo="evento" id={e.id} />
                  </td>
                </tr>
              ))}
              {eventos.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Vazio.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
