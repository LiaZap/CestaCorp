import Link from "next/link";
import {
  Upload, Receipt, MessageSquareWarning, CalendarPlus,
  UserPlus, FileSignature, ArrowRight,
} from "lucide-react";

const ACTIONS = [
  {
    href: "/notas-fiscais/importar",
    icon: Receipt,
    label: "Importar XML",
    desc: "NF-e em lote",
    bg: "bg-gradient-to-br from-cestacorp-blue to-cestacorp-blueDark",
    iconBg: "bg-white/20",
  },
  {
    href: "/clientes/novo",
    icon: UserPlus,
    label: "Novo cliente",
    desc: "Cadastrar empresa",
    bg: "bg-gradient-to-br from-emerald-500 to-emerald-700",
    iconBg: "bg-white/20",
  },
  {
    href: "/regua-cobranca/lote",
    icon: MessageSquareWarning,
    label: "Disparar régua",
    desc: "Cobrança em massa",
    bg: "bg-gradient-to-br from-amber-500 to-orange-600",
    iconBg: "bg-white/20",
  },
  {
    href: "/agenda/nova",
    icon: CalendarPlus,
    label: "Agendar evento",
    desc: "Nova obrigação",
    bg: "bg-gradient-to-br from-violet-500 to-purple-700",
    iconBg: "bg-white/20",
  },
  {
    href: "/contratos/lote",
    icon: FileSignature,
    label: "Gerar contratos",
    desc: "Em lote",
    bg: "bg-gradient-to-br from-rose-500 to-pink-700",
    iconBg: "bg-white/20",
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={
            "group relative overflow-hidden rounded-xl p-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg " +
            a.bg
          }
        >
          <div className="flex items-start justify-between mb-6">
            <div className={"h-9 w-9 rounded-lg flex items-center justify-center " + a.iconBg}>
              <a.icon className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">{a.label}</p>
            <p className="text-[11px] opacity-80">{a.desc}</p>
          </div>
          <div className="absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-white/10 blur-xl pointer-events-none" />
        </Link>
      ))}
    </div>
  );
}
