import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongo";
import { FormResponseModel } from "@/models/FormResponse";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCpfCnpj, formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { Mail, Phone, FileText, AlertCircle, MessageSquare, ClipboardList, Pencil, TrendingUp, Activity } from "lucide-react";
import { getTimeline } from "@/lib/services/cliente-timeline";
import { ClienteTimeline } from "@/components/ClienteTimeline";
import { ConvidarClienteCard } from "@/components/ConvidarClienteCard";
import { SociosCard } from "./SociosCard";
import { calcularValorAtualizadoLote } from "@/lib/services/valor-atualizado";

export const dynamic = "force-dynamic";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default async function ClienteDetalhePage({ params }: { params: { id: string } }) {
  const cliente = await prisma.cliente.findUnique({
    where: { id: params.id },
    include: {
      emails: true,
      telefones: true,
      socios: true,
      contratos: { orderBy: { createdAt: "desc" } },
      cobrancas: { orderBy: { vencimento: "desc" }, take: 20 },
      tags: { include: { tag: true } },
      observacoes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!cliente) notFound();

  await connectMongo();
  const forms = await FormResponseModel.find({ clienteId: cliente.id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const execucoes = await prisma.execucaoRegua.findMany({
    where: { clienteId: cliente.id },
    orderBy: { agendadoPara: "desc" },
    take: 10,
    include: { passo: true },
  });

  const timeline = await getTimeline(cliente.id, 60);

  const valorAberto = cliente.cobrancas
    .filter((c) => c.status !== "PAGO" && c.status !== "CANCELADO")
    .reduce((acc, c) => acc + Number(c.valor), 0);

  // Calcula valor atualizado das cobranças NÃO pagas (em lote, 1 query de config).
  // Cada cobrança usa o seu snapshot (regra do dia em que entrou); legadas caem na config global.
  const cobrancasParaCalcular = cliente.cobrancas
    .filter((c) => c.status !== "PAGO" && c.status !== "CANCELADO")
    .map((c) => ({
      id: c.id,
      valor: Number(c.valor),
      vencimento: c.vencimento,
      regraJurosSnapshot: (c as any).regraJurosSnapshot,
    }));
  const atualizacoesMap = await calcularValorAtualizadoLote(cobrancasParaCalcular);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/clientes" className="hover:text-primary">Clientes</Link>
            <span>/</span>
            <span>{cliente.codigo ? `#${cliente.codigo}` : cliente.id.slice(0, 8)}</span>
          </div>
          <h1 className="text-3xl font-bold text-cestacorp-blue">{cliente.razaoSocial}</h1>
          {cliente.nomeFantasia && <p className="text-muted-foreground">{cliente.nomeFantasia}</p>}
          <div className="flex items-center gap-3 flex-wrap pt-1">
            <span className="font-mono text-sm">{formatCpfCnpj(cliente.cpfCnpj)}</span>
            <span className={"status-badge " + (cliente.status === "ATIVO" ? "status-ativo" : "status-aberto")}>
              {cliente.status}
            </span>
            {cliente.classificacao && (
              <span className="status-badge bg-amber-100 text-amber-700">{cliente.classificacao}</span>
            )}
            {cliente.tags.map((ct) => (
              <span key={ct.tag.id} className="status-badge" style={{ background: (ct.tag.cor ?? "#84CC16") + "22", color: ct.tag.cor ?? "#4D7C0F" }}>
                {ct.tag.nome}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/clientes/${cliente.id}/editar`}>
              <Pencil className="h-4 w-4" /> Editar
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/contratos/novo?clienteId=${cliente.id}`}>
              <FileText className="h-4 w-4" /> Gerar contrato
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Contratos</p>
          <p className="text-2xl font-bold">{cliente.contratos.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Cobranças abertas</p>
          <p className="text-2xl font-bold">{cliente.cobrancas.filter(c => c.status !== "PAGO" && c.status !== "CANCELADO").length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Em aberto</p>
          <p className="text-2xl font-bold text-red-600">{formatMoney(valorAberto)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Aniversário contrato</p>
          <p className="text-2xl font-bold">
            {cliente.mesAniversarioReajuste ? MESES[cliente.mesAniversarioReajuste - 1] : "—"}
          </p>
        </CardContent></Card>
      </div>

      {/* Convite para o Portal do Cliente */}
      <ConvidarClienteCard
        clienteId={cliente.id}
        emailSugerido={cliente.emails.find((e) => e.principal)?.email ?? cliente.emails[0]?.email}
      />

      {/* Timeline unificada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Timeline
          </CardTitle>
          <CardDescription>
            Tudo que aconteceu com esse cliente — contratos, cobranças, mensagens, formulários e observações
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClienteTimeline eventos={timeline} clienteId={cliente.id} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contratos */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Contratos</CardTitle>
                <CardDescription>Gerados automaticamente a partir de templates</CardDescription>
              </div>
              <Button size="sm" asChild variant="outline">
                <Link href={`/contratos/novo?clienteId=${cliente.id}`}>Novo</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {cliente.contratos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum contrato gerado.</p>
              ) : (
                <ul className="divide-y">
                  {cliente.contratos.map((c) => (
                    <li key={c.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{c.numero ?? c.tipo}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(c.createdAt)} · {formatMoney(Number(c.valorHonorarios))} · {c.indiceReajuste}
                        </p>
                      </div>
                      <span className="status-badge status-aberto">{c.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Cobranças */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Cobranças recentes</CardTitle>
              <CardDescription>Sincronizadas do NIBO</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {cliente.cobrancas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem cobranças cadastradas.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3">Descrição</th>
                      <th className="py-2 pr-3">Vencimento</th>
                      <th className="py-2 pr-3 text-right">Bruto</th>
                      <th className="py-2 pr-3 text-right">Atualizado hoje</th>
                      <th className="py-2 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cliente.cobrancas.map((c) => {
                      const atualiz = atualizacoesMap.get(c.id);
                      return (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-2 pr-3">
                            <Link href={`/cobrancas/${c.id}`} className="hover:underline">
                              {c.descricao ?? "—"}
                            </Link>
                          </td>
                          <td className="py-2 pr-3">{formatDate(c.vencimento)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(Number(c.valor))}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {atualiz?.emAtraso ? (
                              <span title={`Bruto + ${formatMoney(atualiz.multa)} multa + ${formatMoney(atualiz.juros)} juros (${atualiz.diasAtraso}d)`}>
                                <span className="font-semibold text-amber-700">{formatMoney(atualiz.total)}</span>
                                <span className="text-[10px] text-amber-600 block leading-none">
                                  +{formatMoney(atualiz.total - atualiz.bruto)}
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            <span className={"status-badge " + (c.status === "PAGO" ? "status-pago" : c.status === "ATRASADO" ? "status-atraso" : "status-aberto")}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Régua */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Mensagens da régua</CardTitle>
            </CardHeader>
            <CardContent>
              {execucoes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma execução ainda.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {execucoes.map((e) => (
                    <li key={e.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{e.passo.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(e.agendadoPara)} · {e.passo.canal}
                        </p>
                      </div>
                      <span className={"status-badge " + (e.status === "ENVIADO" ? "status-pago" : e.status === "ERRO" ? "status-erro" : "status-pendente")}>
                        {e.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Formulários */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Formulários respondidos</CardTitle>
            </CardHeader>
            <CardContent>
              {forms.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma resposta vinculada.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {forms.map((f: any) => (
                    <li key={String(f._id)} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{f.formSlug}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(f.createdAt)} · por {f.autor?.nome || "—"}
                        </p>
                      </div>
                      <span className="status-badge status-aberto">{f.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Contatos</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {cliente.emails.map((e) => (
                <div key={e.id} className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p>{e.email}</p>
                    {e.tipo && <p className="text-xs text-muted-foreground">{e.tipo}</p>}
                  </div>
                </div>
              ))}
              {cliente.telefones.map((t) => (
                <div key={t.id} className="flex items-start gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p>{t.numero}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.whatsapp && "WhatsApp"} {t.principal && "· principal"} {t.tipo && `· ${t.tipo}`}
                    </p>
                  </div>
                </div>
              ))}
              {cliente.emails.length + cliente.telefones.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem contatos cadastrados.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Reajuste</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mês aniversário</span>
                <span className="font-medium">{cliente.mesAniversarioReajuste ? MESES[cliente.mesAniversarioReajuste - 1] : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Índice</span>
                <span className="font-medium">{cliente.indiceReajuste ?? "IPCA"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Último reajuste</span>
                <span className="font-medium">{formatDate(cliente.ultimoReajuste)}</span>
              </div>
              <form action={`/api/clientes/${cliente.id}/reajuste/simular`} method="post" className="pt-2">
                <Button type="submit" size="sm" variant="outline" className="w-full">
                  <TrendingUp className="h-4 w-4" /> Simular reajuste
                </Button>
              </form>
            </CardContent>
          </Card>

          <SociosCard
            clienteId={cliente.id}
            socios={cliente.socios.map((s) => ({
              id: s.id,
              nome: s.nome,
              cpf: s.cpf,
              email: s.email,
              telefone: s.telefone,
              profissao: s.profissao,
              estadoCivil: s.estadoCivil,
              quotas: s.quotas,
              representanteLegal: s.representanteLegal,
              assinante: s.assinante,
              dataNascimento: s.dataNascimento ? s.dataNascimento.toISOString() : null,
            }))}
          />

          <Card>
            <CardHeader><CardTitle>Responsáveis</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Fiscal</span><span>{cliente.respFiscal || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Folha</span><span>{cliente.respFolha || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Contábil</span><span>{cliente.respContabil || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tributação</span><span>{cliente.tributacao || "—"}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Observações</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {cliente.observacoes.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma observação.</p>
              ) : (
                cliente.observacoes.slice(0, 5).map((o) => (
                  <div key={o.id} className="border-b last:border-0 pb-2">
                    <p>{o.conteudo}</p>
                    <p className="text-xs text-muted-foreground">{o.autor} · {formatDateTime(o.createdAt)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
