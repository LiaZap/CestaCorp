"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Calculator, AlertCircle, Check, Snowflake } from "lucide-react";

type Form = {
  jurosPctAoDia: number;
  multaPct: number;
  carenciaDias: number;
  jurosCompostos: boolean;
  ativo: boolean;
};

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ConfigCobrancaForm({ initial }: { initial: Form }) {
  const [f, setF] = useState<Form>(initial);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  // Simulador ao vivo
  const [simBruto, setSimBruto] = useState(1000);
  const [simDias, setSimDias] = useState(10);

  const diasJuros = Math.max(0, simDias - f.carenciaDias);
  const multa = simDias > f.carenciaDias ? simBruto * (f.multaPct / 100) : 0;
  const juros = f.jurosCompostos
    ? (simBruto + multa) * (Math.pow(1 + f.jurosPctAoDia / 100, diasJuros) - 1)
    : simBruto * (f.jurosPctAoDia / 100) * diasJuros;
  const total = simBruto + multa + juros;

  async function salvar() {
    setLoading(true); setErro(null); setSucesso(false);
    try {
      const r = await fetch("/api/config-cobranca", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(f),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(typeof j.error === "string" ? j.error : "erro");
        return;
      }
      setSucesso(true);
      setTimeout(() => setSucesso(false), 3000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Regra de juros e multa</CardTitle>
          <CardDescription>
            Aplicada automaticamente a toda cobrança em atraso, exibida no detalhe e usada nos
            placeholders <code>{"{cobranca.valorAtualizado}"}</code> da régua.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Juros (% ao dia)</Label>
              <Input
                type="number" step="0.01" min="0" max="100"
                value={f.jurosPctAoDia}
                onChange={(e) => setF({ ...f, jurosPctAoDia: Number(e.target.value) })}
              />
              <p className="text-[10px] text-muted-foreground">
                Padrão Cestacorp: <b>1.00</b>
              </p>
            </div>
            <div className="space-y-1">
              <Label>Multa (% fixa)</Label>
              <Input
                type="number" step="0.01" min="0" max="100"
                value={f.multaPct}
                onChange={(e) => setF({ ...f, multaPct: Number(e.target.value) })}
              />
              <p className="text-[10px] text-muted-foreground">
                Padrão Cestacorp: <b>2.00</b>
              </p>
            </div>
            <div className="space-y-1">
              <Label>Carência (dias corridos)</Label>
              <Input
                type="number" min="0" max="90"
                value={f.carenciaDias}
                onChange={(e) => setF({ ...f, carenciaDias: Number(e.target.value) })}
              />
              <p className="text-[10px] text-muted-foreground">
                Padrão Cestacorp: <b>3</b> · sáb/dom contam
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.jurosCompostos}
              onChange={(e) => setF({ ...f, jurosCompostos: e.target.checked })}
            />
            <span>
              Juros compostos
              <span className="text-xs text-muted-foreground ml-2">
                (padrão Cestacorp = simples; só ative se tiver decisão jurídica)
              </span>
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.ativo}
              onChange={(e) => setF({ ...f, ativo: e.target.checked })}
            />
            Regra ativa (se desligada, sistema mostra só valor bruto)
          </label>

          {erro && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {erro}
            </div>
          )}

          {sucesso && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 flex items-start gap-2">
              <Check className="h-4 w-4 mt-0.5 shrink-0" /> Configuração salva. Já vale pra próximas cobranças exibidas.
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={salvar} disabled={loading}>
              <Save className="h-4 w-4" /> {loading ? "Salvando…" : "Salvar regra"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <PopularSnapshotsCard />

      <Card className="border-cestacorp-blue/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" /> Simulador ao vivo
          </CardTitle>
          <CardDescription>
            Ajuste valor e dias pra ver como ficaria com a regra acima.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Valor bruto (R$)</Label>
              <Input
                type="number" step="0.01" min="0"
                value={simBruto}
                onChange={(e) => setSimBruto(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1">
              <Label>Dias em atraso</Label>
              <Input
                type="number" min="0"
                value={simDias}
                onChange={(e) => setSimDias(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 border p-4 space-y-2">
            <div className="grid grid-cols-2 text-sm gap-y-1.5">
              <span className="text-muted-foreground">Bruto:</span>
              <span className="text-right tabular-nums font-medium">{fmtMoney(simBruto)}</span>

              <span className="text-muted-foreground">
                Multa ({f.multaPct}%):
              </span>
              <span className="text-right tabular-nums font-medium text-amber-700">
                {multa > 0 ? "+ " : ""}{fmtMoney(multa)}
              </span>

              <span className="text-muted-foreground">
                Juros ({f.jurosPctAoDia}% × {diasJuros}d):
              </span>
              <span className="text-right tabular-nums font-medium text-amber-700">
                {juros > 0 ? "+ " : ""}{fmtMoney(juros)}
              </span>

              <span className="border-t pt-2 mt-1 font-semibold">Valor atualizado:</span>
              <span className="border-t pt-2 mt-1 text-right tabular-nums font-bold text-cestacorp-blue text-lg">
                {fmtMoney(total)}
              </span>
            </div>
            {simDias > 0 && simDias <= f.carenciaDias && (
              <p className="text-xs text-emerald-700 italic">
                Dentro da carência ({f.carenciaDias} dias) — não cobra juros nem multa.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Card admin: popula snapshot em cobranças legadas (Patrick 09/05).
 * One-shot idempotente — roda 1x ao adotar a feature, ou se aparecerem cobranças órfãs.
 */
function PopularSnapshotsCard() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function executar() {
    if (!confirm(
      "Vou aplicar a regra atual em todas as cobranças que ainda não têm snapshot. " +
      "Cobranças que já têm regra própria (snapshot) não são alteradas. " +
      "Isso preserva o comportamento prospectivo: regras futuras só valem pra cobranças novas. Continuar?"
    )) return;

    setLoading(true); setErro(null); setResultado(null);
    try {
      const r = await fetch("/api/cobrancas/popular-snapshots", { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setErro(typeof j.error === "string" ? j.error : "erro");
        return;
      }
      setResultado(j);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Snowflake className="h-4 w-4" /> Congelar regra atual em cobranças legadas
        </CardTitle>
        <CardDescription>
          Aplica a regra atual em cobranças que ainda não têm snapshot (criadas antes desta feature).
          Após isso, qualquer mudança futura na regra só afeta cobranças novas. <b>Idempotente</b> —
          pode rodar várias vezes sem efeito colateral.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {resultado && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
            <p className="font-semibold flex items-center gap-1"><Check className="h-4 w-4" /> Concluído</p>
            <p className="text-xs mt-1">
              Total no banco: <b>{resultado.total}</b> · Já tinham snapshot: <b>{resultado.jaTinhamSnapshot}</b> ·
              {" "}Populadas agora: <b>{resultado.populados}</b>
            </p>
          </div>
        )}
        {erro && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {erro}
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={executar} disabled={loading}>
            <Snowflake className="h-4 w-4" /> {loading ? "Aplicando…" : "Congelar regra agora"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
