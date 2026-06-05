/**
 * Shared menu items used by desktop Sidebar and mobile Sheet drawer.
 * Centralized so both stay in sync (#56).
 */
import {
  LayoutDashboard, Users, FileText, MessageSquareWarning, ClipboardList,
  Tag, Settings, BarChart3, TrendingUp, Calendar, CreditCard,
  Bell, FileBox, Receipt, type LucideIcon,
} from "lucide-react";

export type SidebarBadgeKey = "agenda" | "regua" | "reajustes";

export type SidebarBadges = Partial<Record<SidebarBadgeKey, number>>;

export type SidebarItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  badgeKey?: SidebarBadgeKey;
};

export type SidebarGroup = {
  id: string;
  title: string;
  items: SidebarItem[];
};

/**
 * 5 grupos com separadores: Operação / Automação / Cadastros / Análise / Sistema (#63)
 */
export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    id: "operacao",
    title: "Operação",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/cobrancas", icon: CreditCard, label: "Cobranças" },
      { href: "/agenda", icon: Calendar, label: "Agenda", badgeKey: "agenda" },
      { href: "/notificacoes", icon: Bell, label: "Notificações" },
    ],
  },
  {
    id: "automacao",
    title: "Automação",
    items: [
      { href: "/regua-cobranca", icon: MessageSquareWarning, label: "Régua de Cobrança", badgeKey: "regua" },
      { href: "/reajustes", icon: TrendingUp, label: "Reajustes", badgeKey: "reajustes" },
    ],
  },
  {
    id: "cadastros",
    title: "Cadastros",
    items: [
      { href: "/clientes", icon: Users, label: "Clientes" },
      { href: "/contratos", icon: FileText, label: "Contratos" },
      // Patrick (13/06): adaptamos a aba de NF pra renomeador de PDFs via OCR.
      // Importação XML continua em revisão, mas a ferramenta volta a ser útil.
      { href: "/notas-fiscais", icon: Receipt, label: "Notas Fiscais" },
      { href: "/formularios", icon: ClipboardList, label: "Formulários" },
      { href: "/tags", icon: Tag, label: "Tags" },
    ],
  },
  {
    id: "analise",
    title: "Análise",
    items: [
      { href: "/relatorios", icon: BarChart3, label: "Relatórios" },
    ],
  },
  {
    id: "sistema",
    title: "Sistema",
    items: [
      { href: "/configuracoes", icon: Settings, label: "Configurações" },
    ],
  },
];

/** Lista linear flat — útil para mobile (Sheet/Tab Mais) */
export const SIDEBAR_ITEMS: SidebarItem[] = SIDEBAR_GROUPS.flatMap((g) => g.items);
