"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WhatsAppPreview } from "@/components/WhatsAppPreview";
import { Send, Phone, AlertCircle, CheckCircle2, Search } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/utils";

type Passo = {
  id: string;
  nome: string;
  offsetDias: number;
  canal: "WHATSAPP" | "EMAIL" | "SMS";
  horarioEnvio: string;
  templateMsg: string;
};
type Regua = { id: string; nome: string; passos: Passo[] };
type Cliente = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cpfCnpj: string;
  telefone?: string;
  cobranca: {
    descricao: string;
    valor: number;
    vencimento: string;
    linhaDigitavel?: string;
    urlBoleto?: string;
    pixCopiaCola?: string;
  } | null;
};

export function SimuladorClient({
  reguas, clientes, reguaIdInicial, clienteIdInicial,
}: {
  reguas: Regua[]; clientes: Cliente[];
  reguaIdInicial?: string; clienteIdInicial?: string;
}) {
  const [reguaId, setReguaId] = useState(reguaIdInicial ?? reguas[0]?.id ?? "");
  const [clienteId, setClienteId] = useState(clienteIdInicial ?? "");
  const [busca, setBusca] = useState("");
  const [enviandoIdx, setEnviandoIdx] = useState<number | null>(null);
  const [statusPasso, setStatusPasso] = useState<Record<number, "ok" | "erro" | null>>({});

  const regua = reguas.find((r) => r.id === reguaId);
  const cliente = clientes.find((c) => c.id === clienteId);

  const clientesFiltrados = useMemo(() => {
    const q = busca.toLowerCase();
    if (!q) return clientes.slice(0, 20);
    return clientes
      .filter((c) =>
        c.razaoSocial.toLowerCase().includes(q) ||
        c.nomeFantasia?.toLowerCase().includes(q) ||
        c.cpfCnpj.includes(busca)
      )
      .slice(0, 20);
  }, [clientes, busca]);

  const sample = cliente && cliente.cobranca
    ? {
        cliente: {
          razaoSocial: cliente.razaoSocial,
          nomeFantasia: cliente.nomeFantasia ?? undefined,
          cpfCnpj: cliente.cpfCnpj,
        },
        cobranca: {
          descricao: cliente.cobranca.descricao,
          valor: cliente.cobranca.valor,
          vencimento: new Date(cliente.cobranca.vencimento),
          linhaDigitavel: cliente.cobranca.linhaDigitavel,
          urlBoleto: cliente.cobranca.urlBoleto,
          pixCopiaCola: cliente.cobranca.pixCopiaCola,
        },
      }
    : undefined;

  async function enviarPasso(idx: number) {
    if (!regua || !cliente) return;
    const passo = regua.passos[idx];
    setEnviandoIdx(idx);
    const res = await fetch("/api/reguas/simular-envio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clienteId: cliente.id, passoId: passo.id }),
    });
    setEnviandoIdx(null);
    setStatusPasso((p) => ({ ...p, [idx]: res.ok ? "ok" : "erro" }));
    setTimeout(() => setStatusPasso((p) => ({ ...p, [idx]: null })), 4000);
  }

  return (
    <div className="space-y-6">
      {/* Seleção */}
      <Card>
        <CardHeader>
          <CardTitle>1. Escolha régua e cliente</CardTitle>
          <CardDescription>
            Selecione o cliente — a próxima cobrança em aberto é usada como base para renderizar todos os passos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Régua</label>
              <select
                className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                value={reguaId}
                onChange={(e) => setReguaId(e.target.value)}
              >
                {reguas.map((r) => <option key={r.id} value={r.id}>{r.nome} — {r.passos.length} passos</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buscar cliente</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  className="h-10 w-full rounded-md border bg-white pl-10 pr-3 text-sm"
                  placeholder="Razão social, fantasia ou CNPJ…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto border rounded-md p-2 bg-slate-50">
            {clientesFiltrados.map((c) => {
              const selecionado = c.id === clienteId;
              return (
                <button
                  key={c.id}
                  onClick={() => setClienteId(c.id)}
                  className={
                    "text-left rounded-md border bg-white p-3 text-sm transition " +
                    (selecionado
                      ? "border-cestacorp-blue bg-cestacorp-blue/5 ring-2 ring-cestacorp-blue/30"
                      : "hover:border-cestacorp-blue/40")
                  }
                >
                  <p className="font-semibold truncate">{c.nomeFantasia ?? c.razaoSocial}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.razaoSocial}</p>
                  {c.cobranca ? (
                    <p className="text-xs mt-1 inline-flex items-center gap-1 text-amber-700">
                      <AlertCircle className="h-3 w-3" />
                      {formatMoney(c.cobranca.valor)} venc. {formatDate(c.cobranca.vencimento)}
                    </p>
                  ) : (
                    <p className="text-xs mt-1 text-muted-foreground">sem cobrança em aberto</p>
                  )}
                </button>
              );
            })}
            {clientesFiltrados.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full text-center py-4">
                Nenhum cliente encontrado.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Previews */}
      {cliente && regua && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>2. Como cada passo vai chegar para {cliente.nomeFantasia ?? cliente.razaoSocial}</CardTitle>
              <CardDescription>
                {cliente.cobranca
                  ? <>Base: <b>{cliente.cobranca.descricao}</b> · {formatMoney(cliente.cobranca.valor)} · venc. {formatDate(cliente.cobranca.vencimento)}</>
                  : <span className="text-amber-700">Cliente sem cobrança em aberto — mensagens renderizadas com valores de exemplo.</span>}
                {cliente.telefone && <span className="ml-2 inline-flex items-center gap-1 text-emerald-700"><Phone className="h-3 w-3" /> {cliente.telefone}</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!sample ? (
                <p className="text-sm text-muted-foreground">Não há cobrança em aberto para simular.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {regua.passos.map((p, idx) => (
                    <div key={p.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Passo {idx + 1} · {p.offsetDias === 0 ? "no dia" : p.offsetDias > 0 ? `+${p.offsetDias}d` : `${p.offsetDias}d`}
                          </p>
                          <p className="text-sm font-semibold">{p.nome}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => enviarPasso(idx)}
                          disabled={enviandoIdx === idx || !cliente.telefone}
                          title={!cliente.telefone ? "Cliente sem telefone" : "Enviar este passo agora"}
                        >
                          {enviandoIdx === idx ? (
                            <>Enviando…</>
                          ) : statusPasso[idx] === "ok" ? (
                            <><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Enviado</>
                          ) : statusPasso[idx] === "erro" ? (
                            <><AlertCircle className="h-3 w-3 text-red-600" /> Falha</>
                          ) : (
                            <><Send className="h-3 w-3" /> Enviar este</>
                          )}
                        </Button>
                      </div>
                      <WhatsAppPreview template={p.templateMsg} canal={p.canal} sample={sample} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground text-center">
            💡 Estes envios <b>não entram</b> na régua automática — são disparos manuais marcados como <code>origem: simulacao</code> nos logs.
          </div>
        </>
      )}
    </div>
  );
}
