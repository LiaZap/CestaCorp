import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Avatar } from "@/components/Avatar";
import { formatCpfCnpj, formatDate, formatMoney } from "@/lib/utils";
import {
  ArrowLeft, Phone, Mail, MessageSquare, CreditCard, FileText, Edit, AlertCircle, CheckCircle2, Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Mobile detail simplificado (#57) — foco em: identidade, contato rápido,
 * cobranças recentes, link pra versão desktop completa.
 */
export default async function MobileClienteDetalhe({ params }: { params: { id: string } }) {
  const cliente = await prisma.cliente.findUnique({
    where: { id: params.id },
    include: {
      telefones: true,
      emails: true,
      cobrancas: {
        orderBy: { vencimento: "desc" },
        take: 6,
        include: { honorario: { select: { competencia: true } } },
      },
      _count: { select: { contratos: true, cobrancas: true } },
    },
  });
  if (!cliente) notFound();

  const telPrincipal =
    cliente.telefones.find((t) => t.principal)?.numero ?? cliente.telefones[0]?.numero ?? null;
  const emailPrincipal =
    cliente.emails.find((e) => e.principal)?.email ?? cliente.emails[0]?.email ?? null;

  const valorAberto = cliente.cobrancas
    .filter((c) => c.status === "ABERTO" || c.status === "ATRASADO")
    .reduce((acc, c) => acc + Number(c.valor), 0);

  return (
    <>
      <Link href="/m/clientes" className="text-xs text-muted-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Clientes
      </Link>

      <section className="flex items-center gap-3 mt-2">
        <Avatar name={cliente.nomeFantasia ?? cliente.razaoSocial} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold truncate">{cliente.nomeFantasia ?? cliente.razaoSocial}</h1>
          <p className="text-xs text-muted-foreground font-mono">{formatCpfCnpj(cliente.cpfCnpj)}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={"status-badge text-[10px] " + (cliente.status === "ATIVO" ? "status-ativo" : "status-aberto")}>
              {cliente.status}
            </span>
            {cliente.classificacao && (
              <span className="text-[10px] text-muted-foreground">{cliente.classificacao}</span>
            )}
          </div>
        </div>
      </section>

      {/* Ações rápidas: telefone, whatsapp, email */}
      <section className="grid grid-cols-4 gap-2">
        <QuickContact href={telPrincipal ? `tel:${telPrincipal}` : undefined} icon={Phone} label="Ligar" color="bg-blue-100 text-blue-700" />
        <QuickContact
          href={telPrincipal ? `https://wa.me/${telPrincipal.replace(/\D/g, "")}` : undefined}
          icon={MessageSquare}
          label="WhatsApp"
          color="bg-emerald-100 text-emerald-700"
        />
        <QuickContact href={emailPrincipal ? `mailto:${emailPrincipal}` : undefined} icon={Mail} label="E-mail" color="bg-violet-100 text-violet-700" />
        <QuickContact href={`/clientes/${cliente.id}`} icon={Edit} label="Editar" color="bg-amber-100 text-amber-700" />
      </section>

      {/* Resumo financeiro */}
      <section className="rounded-2xl bg-white border p-4 space-y-1">
        <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Em aberto</p>
        <p className="text-2xl font-bold text-cestacorp-blue">{formatMoney(valorAberto)}</p>
        <div className="flex gap-4 text-xs text-muted-foreground pt-1">
          <span>{cliente._count.cobrancas} cobranças</span>
          <span>{cliente._count.contratos} contratos</span>
        </div>
      </section>

      {/* Cobranças recentes */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cobranças recentes</h2>
          <Link href="/m/cobrancas" className="text-xs text-cestacorp-blue hover:underline">ver todas</Link>
        </div>
        {cliente.cobrancas.length === 0 ? (
          <div className="rounded-xl bg-white border p-6 text-center text-sm text-muted-foreground">
            Sem cobranças registradas.
          </div>
        ) : (
          <ul className="space-y-2">
            {cliente.cobrancas.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/m/cobrancas/${c.id}`}
                  className="flex items-center gap-3 rounded-xl bg-white border p-3 active:scale-[0.99] transition"
                >
                  <div className={
                    "h-9 w-9 rounded-full flex items-center justify-center shrink-0 " +
                    (c.status === "PAGO"
                      ? "bg-emerald-100 text-emerald-700"
                      : c.status === "ATRASADO"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700")
                  }>
                    {c.status === "PAGO" ? <CheckCircle2 className="h-4 w-4" /> :
                      c.status === "ATRASADO" ? <AlertCircle className="h-4 w-4" /> :
                        <Clock className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.descricao ?? "Honorário"}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.status === "PAGO" ? `Pago em ${formatDate(c.dataPagamento)}` : `Vence ${formatDate(c.vencimento)}`}
                    </p>
                  </div>
                  <p className="text-sm font-bold whitespace-nowrap">{formatMoney(Number(c.valor))}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href={`/clientes/${cliente.id}`}
        className="block text-center text-sm text-cestacorp-blue underline py-3"
      >
        Ver ficha completa no desktop
      </Link>
    </>
  );
}

function QuickContact({
  href, icon: Icon, label, color,
}: { href?: string; icon: any; label: string; color: string }) {
  const inner = (
    <>
      <div className={"h-10 w-10 rounded-full flex items-center justify-center " + color}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <span className="text-[11px] font-medium text-center">{label}</span>
    </>
  );
  if (!href) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl bg-white border p-3 opacity-50">
        {inner}
      </div>
    );
  }
  return (
    <Link href={href} className="flex flex-col items-center gap-1 rounded-xl bg-white border p-3 active:scale-[0.96] transition">
      {inner}
    </Link>
  );
}
