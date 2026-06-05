"use client";

/**
 * Selector de visão de dashboard (call 18/05).
 * ADMIN pode trocar entre as visões Operacional / Financeiro / Gestor.
 * Outros roles veem só sua visão padrão.
 */
import { useRouter, useSearchParams } from "next/navigation";

const OPCOES = [
  { value: "GESTOR", label: "Visão Gestor" },
  { value: "FINANCEIRO", label: "Visão Financeiro" },
  { value: "OPERACIONAL", label: "Visão Operacional" },
] as const;

type Visao = (typeof OPCOES)[number]["value"];

interface Props {
  atual: Visao;
}

export function DashboardSelector({ atual }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(v: string) {
    const sp = new URLSearchParams(params?.toString() ?? "");
    sp.set("visao", v);
    router.push(`/dashboard?${sp.toString()}`);
  }

  return (
    <select
      aria-label="Selecionar visão do dashboard"
      value={atual}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 rounded-md border bg-background px-3 text-sm"
    >
      {OPCOES.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
