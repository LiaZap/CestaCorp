import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { assertOwnership, AuthorizationError } from "@/lib/security/ownership";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Download, Paperclip } from "lucide-react";
import { formatDate, formatDateTime, formatMoney, formatCpfCnpj } from "@/lib/utils";
import { ContratoDetalheClient } from "./ContratoDetalheClient";

export const dynamic = "force-dynamic";

export default async function ContratoDetalhePage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return notFound();
  try {
    await assertOwnership(session, "contrato", params.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return notFound();
    throw err;
  }

  const contrato = await prisma.contrato.findUnique({
    where: { id: params.id },
    include: {
      cliente: {
        select: {
          id: true,
          codigo: true,
          razaoSocial: true,
          nomeFantasia: true,
          cpfCnpj: true,
          telefones: { where: { whatsapp: true }, take: 1 },
        },
      },
      anexos: { include: { anexo: true }, orderBy: { ordem: "asc" } },
      honorarios: { orderBy: { vencimento: "asc" }, take: 12 },
      template: { select: { id: true, nome: true, versao: true } },
    },
  });
  if (!contrato || contrato.deletedAt) return notFound();

  // últimos eventos de auditoria deste contrato
  const audits = await prisma.auditLog.findMany({
    where: { resource: "contrato", resourceId: params.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const assinantes = Array.isArray(contrato.assinaturaAssinantes)
    ? (contrato.assinaturaAssinantes as any[])
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link
            href="/contratos"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar
          </Link>
          <h1 className="text-3xl font-bold text-cestacorp-blue mt-1">
            Contrato {contrato.numero ?? contrato.id.slice(0, 8)}
          </h1>
          <p className="text-muted-foreground">
            <Link
              href={`/clientes/${contrato.cliente.id}`}
              className="hover:underline"
            >
              #{contrato.cliente.codigo ?? "—"} · {contrato.cliente.razaoSocial}
            </Link>
            <span className="ml-2 font-mono text-xs">
              {formatCpfCnpj(contrato.cliente.cpfCnpj)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="status-badge status-aberto">{contrato.status}</span>
          <span className="text-xs text-muted-foreground">
            {contrato.tipo} · valor {formatMoney(Number(contrato.valorHonorarios))}
          </span>
        </div>
      </div>

      <ContratoDetalheClient
        contratoId={contrato.id}
        status={contrato.status}
        assinaturaStatus={contrato.assinaturaStatus}
        assinaturaProvider={contrato.assinaturaProvider}
        assinaturaUrl={contrato.assinaturaUrl}
        assinaturaEnviadoEm={contrato.assinaturaEnviadoEm?.toISOString() ?? null}
        assinaturaAssinadoEm={contrato.assinaturaAssinadoEm?.toISOString() ?? null}
        assinantes={assinantes}
        temDocx={!!contrato.docxPath}
        temPdf={!!contrato.pdfPath}
        clausulaComplementar={contrato.clausulaComplementar ?? ""}
        whatsappNumero={contrato.cliente.telefones[0]?.numero ?? null}
        anexos={contrato.anexos.map((a) => ({
          id: a.id,
          anexoId: a.anexoId,
          nome: a.anexo.nome,
          ordem: a.ordem,
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Honorários vinculados ({contrato.honorarios.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {contrato.honorarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum honorário ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Competência</th>
                  <th className="py-2 pr-3">Vencimento</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {contrato.honorarios.map((h) => (
                  <tr key={h.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs">{h.competencia}</td>
                    <td className="py-2 pr-3">{formatDate(h.vencimento)}</td>
                    <td className="py-2 pr-3">{formatMoney(Number(h.valor))}</td>
                    <td className="py-2 pr-3">
                      <span className="text-xs">{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atividade recente</CardTitle>
          <CardDescription>Auditoria das últimas ações neste contrato</CardDescription>
        </CardHeader>
        <CardContent>
          {audits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {audits.map((a) => (
                <li key={a.id} className="flex gap-3 border-b last:border-0 py-2">
                  <span className="text-xs text-muted-foreground font-mono shrink-0 w-32">
                    {formatDateTime(a.createdAt)}
                  </span>
                  <span className="font-medium">{a.action}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.actorEmail ?? a.actorId}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
