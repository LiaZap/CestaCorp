"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NovaObrigacaoPage() {
  const router = useRouter();
  const [f, setF] = useState<any>({
    nome: "",
    tipo: "DAS",
    descricao: "",
    recorrencia: "MENSAL",
    diaVencimento: 20,
    mesVencimento: 3,
    diaVencimentoAnual: 31,
    antecedenciaDias: 7,
    global: true,
    categoriaCliente: "",
    tributacaoFiltro: "",
    responsavel: "",
    ativa: true,
  });
  const [salvando, setSalvando] = useState(false);

  function up(k: string, v: any) { setF((s: any) => ({ ...s, [k]: v })); }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const body = { ...f, categoriaCliente: f.categoriaCliente || null, tributacaoFiltro: f.tributacaoFiltro || null };
    const res = await fetch("/api/agenda/obrigacoes", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    setSalvando(false);
    if (res.ok) router.push("/agenda/obrigacoes");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold text-cestacorp-blue">Nova obrigação</h1>
      <form onSubmit={salvar}>
        <Card>
          <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.tipo} onChange={(e) => up("tipo", e.target.value)}>
                  {["DAS","DEFIS","DIRF","IRPF","ECF","ECD","FGTS","ESOCIAL","DCTF","SPED_FISCAL","SPED_CONTRIBUICOES","REAJUSTE","REUNIAO","CERTIFICADO_DIGITAL","OUTROS"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Recorrência</Label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.recorrencia} onChange={(e) => up("recorrencia", e.target.value)}>
                  <option value="MENSAL">Mensal</option>
                  <option value="ANUAL">Anual</option>
                  <option value="TRIMESTRAL">Trimestral</option>
                  <option value="SEMESTRAL">Semestral</option>
                  <option value="UNICA">Única</option>
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Nome</Label>
                <Input required value={f.nome} onChange={(e) => up("nome", e.target.value)} placeholder="Ex.: DAS - Simples Nacional" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Descrição</Label>
                <textarea className="w-full min-h-20 rounded-md border bg-background p-3 text-sm" value={f.descricao} onChange={(e) => up("descricao", e.target.value)} />
              </div>

              {f.recorrencia === "MENSAL" || f.recorrencia === "TRIMESTRAL" ? (
                <div className="space-y-1">
                  <Label>Dia do vencimento</Label>
                  <Input type="number" min={1} max={31} value={f.diaVencimento} onChange={(e) => up("diaVencimento", Number(e.target.value))} />
                </div>
              ) : null}

              {f.recorrencia === "ANUAL" && (
                <>
                  <div className="space-y-1">
                    <Label>Mês</Label>
                    <Input type="number" min={1} max={12} value={f.mesVencimento} onChange={(e) => up("mesVencimento", Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Dia</Label>
                    <Input type="number" min={1} max={31} value={f.diaVencimentoAnual} onChange={(e) => up("diaVencimentoAnual", Number(e.target.value))} />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <Label>Antecedência da notificação (dias)</Label>
                <Input type="number" min={0} max={60} value={f.antecedenciaDias} onChange={(e) => up("antecedenciaDias", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Responsável</Label>
                <Input value={f.responsavel} onChange={(e) => up("responsavel", e.target.value)} placeholder="Nome do responsável" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader><CardTitle>Alcance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.global} onChange={(e) => up("global", e.target.checked)} />
              Aplicar a TODOS os clientes ativos
            </label>

            {f.global && (
              <>
                <div className="space-y-1">
                  <Label>Filtrar por classificação (opcional)</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.categoriaCliente} onChange={(e) => up("categoriaCliente", e.target.value)}>
                    <option value="">Todas</option>
                    <option value="BRONZE">Bronze</option>
                    <option value="PRATA">Prata</option>
                    <option value="OURO">Ouro</option>
                    <option value="TOP">Top</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Filtrar por tributação contém (opcional)</Label>
                  <Input value={f.tributacaoFiltro} onChange={(e) => up("tributacaoFiltro", e.target.value)} placeholder="Ex.: Simples, Presumido" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" type="button" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
        </div>
      </form>
    </div>
  );
}
