"use client";
import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WhatsAppPreview } from "@/components/WhatsAppPreview";
import { formatMoney, formatDate } from "@/lib/utils";
import { Search, Send, CheckCircle2, AlertCircle, Phone, Filter, Clock, Calendar } from "lucide-react";
import { TemplateLibrary } from "@/components/TemplateLibrary";
import { PlaceholderPicker } from "@/components/PlaceholderPicker";

type Item = {
  cobrancaId: string;
  clienteId: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cpfCnpj: string;
  classificacao: string | null;
  telefone?: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: string;
  diasAtraso: number;
  pix?: string | null;
  boleto?: string | null;
};

type ResultLinha = { cobrancaId: string; ok: boolean; erro?: string };

const TEMPLATE_PADRAO = `Olá {cliente.razaoSocial}, tudo bem?

Passando aqui para lembrar do seu boleto:
📄 {cobranca.descricao}
💰 {cobranca.valor|money}
📅 Vencimento: {cobranca.vencimento|date}

Qualquer dúvida, estamos à disposição.
Equipe Cestacorp 💙💚`;

export function LoteClient({ itens }: { itens: Item[] }) {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "ATRASADO" | "ABERTO">("ATRASADO");
  const [filtroClass, setFiltroClass] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState(TEMPLATE_PADRAO);
  const templateRef = useRef<HTMLTextAreaElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultados, setResultados] = useState<ResultLinha[]>([]);
  const [modo, setModo] = useState<"agora" | "agendar">("agora");
  const [quando, setQuando] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  });
  const [agendado, setAgendado] = useState<{ id: string; quando: string } | null>(null);

  const visiveis = useMemo(() => {
    const q = busca.toLowerCase();
    return itens.filter((i) => {
      if (filtroStatus !== "TODOS" && i.status !== filtroStatus) return false;
      if (filtroClass && i.classificacao !== filtroClass) return false;
      if (!i.telefone) return false; // só quem tem WhatsApp
      if (!q) return true;
      return i.razaoSocial.toLowerCase().includes(q) ||
        i.nomeFantasia?.toLowerCase().includes(q) ||
        i.cpfCnpj.includes(busca);
    });
  }, [itens, busca, filtroStatus, filtroClass]);

  const totais = useMemo(() => {
    const selecoes = visiveis.filter((i) => selecionados.has(i.cobrancaId));
    return {
      qtd: selecoes.length,
      valor: selecoes.reduce((acc, i) => acc + i.valor, 0),
    };
  }, [visiveis, selecionados]);

  function toggle(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll() {
    if (selecionados.size === visiveis.length) setSelecionados(new Set());
    else setSelecionados(new Set(visiveis.map((i) => i.cobrancaId)));
  }

  async function agendar() {
    if (selecionados.size === 0 || !template.trim()) return;
    const ids = Array.from(selecionados);
    const alvos = visiveis.filter((i) => ids.includes(i.cobrancaId));
    const res = await fetch("/api/reguas/agendar-lote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        titulo: `Lote ${alvos.length} clientes`,
        agendadoPara: new Date(quando).toISOString(),
        template,
        canal: "WHATSAPP",
        alvos: alvos.map((a) => ({
          clienteId: a.clienteId,
          cobrancaId: a.cobrancaId,
          razaoSocial: a.razaoSocial,
          telefone: a.telefone,
        })),
      }),
    });
    const json = await res.json();
    if (res.ok) setAgendado({ id: json.id, quando });
  }

  async function executar() {
    if (selecionados.size === 0 || !template.trim()) return;
    if (modo === "agendar") { await agendar(); return; }

    setEnviando(true);
    setResultados([]);
    setProgresso(0);

    const ids = Array.from(selecionados);
    const alvos = visiveis.filter((i) => ids.includes(i.cobrancaId));

    for (let i = 0; i < alvos.length; i++) {
      const item = alvos[i];
      try {
        const res = await fetch("/api/reguas/enviar-ad-hoc", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            clienteId: item.clienteId,
            cobrancaId: item.cobrancaId,
            template,
          }),
        });
        const json = await res.json();
        setResultados((r) => [...r, { cobrancaId: item.cobrancaId, ok: res.ok, erro: res.ok ? undefined : (json.error ?? "erro") }]);
      } catch (err: any) {
        setResultados((r) => [...r, { cobrancaId: item.cobrancaId, ok: false, erro: String(err?.message ?? err) }]);
      }
      setProgresso(Math.round(((i + 1) / alvos.length) * 100));
    }
    setEnviando(false);
  }

  const sucessos = resultados.filter((r) => r.ok).length;
  const falhas = resultados.filter((r) => !r.ok).length;

  const sample = visiveis.find((i) => selecionados.has(i.cobrancaId)) ?? visiveis[0];
  const sampleData = sample
    ? {
        cliente: { razaoSocial: sample.razaoSocial, nomeFantasia: sample.nomeFantasia ?? undefined, cpfCnpj: sample.cpfCnpj },
        cobranca: {
          descricao: sample.descricao,
          valor: sample.valor,
          vencimento: new Date(sample.vencimento),
          pixCopiaCola: sample.pix ?? undefined,
          urlBoleto: sample.boleto ?? undefined,
        },
      }
    : undefined;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>1. Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    className="h-10 w-full rounded-md border bg-white pl-10 pr-3 text-sm"
                    placeholder="Buscar cliente…"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>
                <select
                  className="h-10 rounded-md border bg-white px-3 text-sm"
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value as any)}
                >
                  <option value="ATRASADO">Apenas atrasados</option>
                  <option value="ABERTO">Apenas em aberto</option>
                  <option value="TODOS">Todos</option>
                </select>
                <select
                  className="h-10 rounded-md border bg-white px-3 text-sm"
                  value={filtroClass}
                  onChange={(e) => setFiltroClass(e.target.value)}
                >
                  <option value="">Todas classificações</option>
                  <option value="BRONZE">Bronze</option>
                  <option value="PRATA">Prata</option>
                  <option value="OURO">Ouro</option>
                  <option value="TOP">Top</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>2. Selecione os destinatários</CardTitle>
                <CardDescription>
                  {visiveis.length} disponíveis · {totais.qtd} selecionados · {formatMoney(totais.valor)} em risco
                </CardDescription>
              </div>
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={visiveis.length > 0 && selecionados.size === visiveis.length}
                  onChange={toggleAll}
                />
                Todos
              </label>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b z-10">
                    <tr>
                      <th className="p-2 w-8"></th>
                      <th className="p-2 text-left">Cliente</th>
                      <th className="p-2 text-left">Cobrança</th>
                      <th className="p-2 text-right">Valor</th>
                      <th className="p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map((i) => {
                      const checked = selecionados.has(i.cobrancaId);
                      return (
                        <tr
                          key={i.cobrancaId}
                          className={"border-b last:border-0 cursor-pointer " + (checked ? "bg-cestacorp-blue/5" : "hover:bg-muted/50")}
                          onClick={() => toggle(i.cobrancaId)}
                        >
                          <td className="p-2"><input type="checkbox" checked={checked} onChange={() => toggle(i.cobrancaId)} /></td>
                          <td className="p-2">
                            <p className="font-medium">{i.nomeFantasia ?? i.razaoSocial}</p>
                            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {i.telefone}
                              {i.classificacao && <span className="ml-2 status-badge status-aberto text-[9px]">{i.classificacao}</span>}
                            </p>
                          </td>
                          <td className="p-2 text-xs">
                            <p>{i.descricao}</p>
                            <p className="text-muted-foreground">
                              venc. {formatDate(i.vencimento)}
                              {i.diasAtraso > 0 && <span className="text-red-600 ml-1">({i.diasAtraso}d atraso)</span>}
                            </p>
                          </td>
                          <td className="p-2 text-right font-medium">{formatMoney(i.valor)}</td>
                          <td className="p-2">
                            <span className={"status-badge text-[10px] " + (i.status === "ATRASADO" ? "status-atraso" : "status-aberto")}>
                              {i.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {visiveis.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                        Nenhuma cobrança nos filtros atuais.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>3. Template da mensagem</CardTitle>
                <CardDescription>
                  Clique nos chips abaixo para inserir placeholders no cursor — o sistema substitui pelo dado real de cada cobrança no envio.
                </CardDescription>
              </div>
              <TemplateLibrary onUse={setTemplate} />
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                ref={templateRef}
                className="w-full min-h-40 rounded-md border bg-white p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cestacorp-blue/30"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
              <PlaceholderPicker
                textareaRef={templateRef}
                value={template}
                onChange={setTemplate}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Quando enviar?</CardTitle>
              <CardDescription>Disparar agora ou agendar para data/hora específica</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModo("agora")}
                  className={"rounded-md border p-3 text-sm transition text-left " + (modo === "agora" ? "border-cestacorp-blue bg-cestacorp-blue/5 ring-2 ring-cestacorp-blue/30" : "hover:bg-slate-50")}
                >
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    <span className="font-semibold">Enviar agora</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Dispara imediatamente</p>
                </button>
                <button
                  type="button"
                  onClick={() => setModo("agendar")}
                  className={"rounded-md border p-3 text-sm transition text-left " + (modo === "agendar" ? "border-cestacorp-blue bg-cestacorp-blue/5 ring-2 ring-cestacorp-blue/30" : "hover:bg-slate-50")}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="font-semibold">Agendar</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Dispara em data/hora futura</p>
                </button>
              </div>
              {modo === "agendar" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data e hora do envio</label>
                  <input
                    type="datetime-local"
                    className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                    value={quando}
                    onChange={(e) => setQuando(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Será disparado em {new Date(quando).toLocaleString("pt-BR")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna direita: preview */}
        <div className="space-y-4">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>Como o WhatsApp vai aparecer {sample ? <>para <b>{sample.nomeFantasia ?? sample.razaoSocial}</b></> : null}</CardDescription>
            </CardHeader>
            <CardContent>
              {sampleData ? (
                <WhatsAppPreview template={template} sample={sampleData} label="Mensagem em lote" />
              ) : (
                <p className="text-sm text-muted-foreground">Selecione ao menos um cliente.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Execução */}
      <Card className="sticky bottom-4 shadow-2xl border-cestacorp-blue/40 bg-white/95 backdrop-blur">
        <CardContent className="py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm">
            <p className="font-semibold">
              {totais.qtd} cliente{totais.qtd !== 1 ? "s" : ""} selecionado{totais.qtd !== 1 ? "s" : ""}
              {totais.qtd > 0 && <> · {formatMoney(totais.valor)} em risco</>}
            </p>
            {enviando && (
              <div className="mt-2 w-72 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cestacorp-blue to-cestacorp-green transition-all" style={{ width: `${progresso}%` }} />
              </div>
            )}
            {resultados.length > 0 && !enviando && (
              <div className="mt-2 flex gap-3 text-xs">
                <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> {sucessos} enviadas</span>
                {falhas > 0 && <span className="inline-flex items-center gap-1 text-red-700"><AlertCircle className="h-3 w-3" /> {falhas} falhas</span>}
              </div>
            )}
            {agendado && (
              <div className="mt-2 flex gap-2 text-xs text-cestacorp-blue bg-cestacorp-blue/10 rounded-md px-3 py-2">
                <Calendar className="h-4 w-4" />
                Agendamento criado para <b>{new Date(agendado.quando).toLocaleString("pt-BR")}</b>
              </div>
            )}
          </div>

          <Button
            size="lg"
            onClick={executar}
            disabled={totais.qtd === 0 || !template.trim() || enviando}
            className="bg-gradient-to-r from-cestacorp-blue to-indigo-700 hover:from-indigo-800 hover:to-indigo-900"
          >
            {modo === "agora" ? <Send className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
            {enviando ? `Enviando ${progresso}%…`
              : modo === "agora"
                ? `Enviar para ${totais.qtd} cliente${totais.qtd !== 1 ? "s" : ""}`
                : `Agendar para ${totais.qtd} cliente${totais.qtd !== 1 ? "s" : ""}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
