import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Building2, User, Phone, Mail, Briefcase, Calendar } from "lucide-react";
import { formatDateTime, formatMoney, formatCpfCnpj } from "@/lib/utils";
import { VirarEmpresaButton } from "./VirarEmpresaButton";
import { EnviarFormularioCard } from "./EnviarFormularioCard";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  EM_ABERTURA: { label: "Em abertura", cls: "bg-blue-100 text-blue-800" },
  VIROU_CLIENTE: { label: "Virou cliente", cls: "bg-emerald-100 text-emerald-800" },
  DESISTIU: { label: "Desistiu", cls: "bg-red-100 text-red-800" },
};

export default async function DetalhePreCadastroPage({
  params,
}: {
  params: { id: string };
}) {
  const pre = await prisma.preCadastro.findUnique({
    where: { id: params.id },
    include: { cliente: { select: { id: true, codigo: true, razaoSocial: true } } },
  });
  if (!pre) notFound();

  const badge = STATUS_BADGE[pre.status];
  const jaVirou = pre.status === "VIROU_CLIENTE" && pre.clienteId;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/clientes/pre-cadastros"
        className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Pré-cadastros
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
            <Building2 className="h-7 w-7" />
            {pre.nomeEmpresaPretendido ?? pre.nomeContato}
          </h1>
          <p className="text-muted-foreground">
            Código <b>#{pre.codigo}</b> ·{" "}
            {badge && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                {badge.label}
              </span>
            )}
          </p>
        </div>
        {!jaVirou && <VirarEmpresaButton preCadastroId={pre.id} sugerido={pre.nomeEmpresaPretendido ?? ""} />}
        {jaVirou && pre.cliente && (
          <Link
            href={`/clientes/${pre.cliente.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium"
          >
            <Building2 className="h-4 w-4" />
            Ver cliente #{pre.cliente.codigo} — {pre.cliente.razaoSocial}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> Contato
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><b>{pre.nomeContato}</b></p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3 w-3" /> {pre.emailContato}
            </p>
            {pre.telefoneContato && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3 w-3" /> {pre.telefoneContato}
              </p>
            )}
            {pre.cpfContato && (
              <p className="text-muted-foreground font-mono text-xs">CPF: {pre.cpfContato}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4" /> Empresa em constituição
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {pre.nomeEmpresaPretendido && (
              <p>
                <span className="text-muted-foreground">Nome pretendido:</span>{" "}
                <b>{pre.nomeEmpresaPretendido}</b>
              </p>
            )}
            {pre.cnpj && (
              <p>
                <span className="text-muted-foreground">CNPJ:</span>{" "}
                <span className="font-mono">{formatCpfCnpj(pre.cnpj)}</span>
              </p>
            )}
            {pre.regimePretendido && (
              <p>
                <span className="text-muted-foreground">Regime:</span> {pre.regimePretendido}
              </p>
            )}
            {pre.segmento && (
              <p>
                <span className="text-muted-foreground">Segmento:</span> {pre.segmento}
              </p>
            )}
            {pre.categoria && (
              <p>
                <span className="text-muted-foreground">Categoria:</span> {pre.categoria}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {!jaVirou && (
        <EnviarFormularioCard
          preCadastroId={pre.id}
          nomeContato={pre.nomeContato}
          emailContato={pre.emailContato}
          telefoneContato={pre.telefoneContato}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Honorários acordados</CardTitle>
          <CardDescription>Valores combinados pelo comercial</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Contábil</p>
            <p className="text-lg font-bold">
              {pre.honorarioContabil ? formatMoney(Number(pre.honorarioContabil)) : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Folha</p>
            <p className="text-lg font-bold">
              {pre.honorarioFolha ? formatMoney(Number(pre.honorarioFolha)) : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Fiscal</p>
            <p className="text-lg font-bold">
              {pre.honorarioFiscal ? formatMoney(Number(pre.honorarioFiscal)) : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operação</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>{pre.temProlabore ? "✓" : "✗"} Pró-labore</p>
          <p>{pre.temFolha ? "✓" : "✗"} Folha de pagamento</p>
          <p>{pre.temFuncionario ? "✓" : "✗"} Funcionário CLT</p>
          {pre.responsavelComercial && (
            <p className="text-muted-foreground mt-2">Comercial: {pre.responsavelComercial}</p>
          )}
        </CardContent>
      </Card>

      {pre.observacoes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{pre.observacoes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Histórico
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>Criado em {formatDateTime(pre.createdAt)}</p>
          <p>Última atualização em {formatDateTime(pre.updatedAt)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
