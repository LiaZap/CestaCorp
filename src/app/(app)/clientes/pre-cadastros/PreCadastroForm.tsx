"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Save } from "lucide-react";
import { isCpfValido, soDigitos } from "@/lib/security/documento";

type Form = {
  id?: string;
  codigo?: number | null;
  nomeContato: string;
  emailContato: string;
  telefoneContato?: string;
  cpfContato?: string;
  nomeEmpresaPretendido?: string;
  regimePretendido?: string;
  segmento?: string;
  categoria?: string;
  responsavelComercial?: string;
  honorarioContabil?: number | null;
  honorarioFolha?: number | null;
  honorarioFiscal?: number | null;
  observacoes?: string;
  temFolha?: boolean;
  temFuncionario?: boolean;
  temProlabore?: boolean;
};

export function PreCadastroForm({ defaults }: { defaults?: Form }) {
  const router = useRouter();
  const isEdit = Boolean(defaults?.id);

  const [f, setF] = useState<Form>(defaults ?? {
    nomeContato: "",
    emailContato: "",
    temProlabore: true,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cpfErro, setCpfErro] = useState<string | null>(null);

  // CPF do contato é opcional, mas se preenchido tem que ser válido (#82).
  function validarCpfSePreenchido(): boolean {
    const limpo = soDigitos(f.cpfContato ?? "");
    if (!limpo) { setCpfErro(null); return true; }
    if (limpo.length !== 11 || !isCpfValido(limpo)) {
      setCpfErro("CPF inválido");
      return false;
    }
    setCpfErro(null);
    return true;
  }

  // Próximo código sugerido
  useEffect(() => {
    if (isEdit || f.codigo) return;
    fetch("/api/clientes/proximo-codigo")
      .then((r) => r.json())
      .then((j) => j.proximo && setF((s) => ({ ...s, codigo: j.proximo })))
      .catch(() => {});
  }, [isEdit, f.codigo]);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validarCpfSePreenchido()) {
      setErro("Corrija o CPF antes de salvar");
      return;
    }
    setLoading(true); setErro(null);
    try {
      const url = isEdit ? `/api/pre-cadastros/${f.id}` : "/api/pre-cadastros";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(f),
      });
      const j = await res.json();
      if (!res.ok) {
        setErro(typeof j.error === "string" ? j.error : "erro ao salvar");
        return;
      }
      router.push(`/clientes/pre-cadastros/${j.id ?? f.id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Contato comercial</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Código</Label>
            <Input
              type="number"
              value={f.codigo ?? ""}
              onChange={(e) => set("codigo", e.target.value ? Number(e.target.value) : null)}
              placeholder="auto"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Nome do contato *</Label>
            <Input required value={f.nomeContato} onChange={(e) => set("nomeContato", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>E-mail *</Label>
            <Input required type="email" value={f.emailContato} onChange={(e) => set("emailContato", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Telefone</Label>
            <Input value={f.telefoneContato ?? ""} onChange={(e) => set("telefoneContato", e.target.value)} placeholder="(51) 99999-9999" />
          </div>
          <div className="space-y-1">
            <Label>CPF</Label>
            <Input
              value={f.cpfContato ?? ""}
              onChange={(e) => { set("cpfContato", e.target.value); if (cpfErro) setCpfErro(null); }}
              onBlur={validarCpfSePreenchido}
              placeholder="000.000.000-00"
              aria-invalid={Boolean(cpfErro)}
            />
            {cpfErro && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {cpfErro}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Empresa em constituição</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Nome pretendido</Label>
            <Input value={f.nomeEmpresaPretendido ?? ""} onChange={(e) => set("nomeEmpresaPretendido", e.target.value)} placeholder="ex: TechNova" />
          </div>
          <div className="space-y-1">
            <Label>Regime tributário pretendido</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={f.regimePretendido ?? ""}
              onChange={(e) => set("regimePretendido", e.target.value || undefined)}
            >
              <option value="">—</option>
              <option value="Simples Nacional">Simples Nacional</option>
              <option value="Simples Nacional Fator R">Simples Nacional Fator R</option>
              <option value="Lucro Presumido">Lucro Presumido</option>
              <option value="Lucro Real">Lucro Real</option>
              <option value="MEI">MEI</option>
              <option value="Carnê-Leão">Carnê-Leão</option>
              <option value="Doméstico">Doméstico</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Segmento</Label>
            <Input value={f.segmento ?? ""} onChange={(e) => set("segmento", e.target.value)} placeholder="ex: Tecnologia" />
          </div>
          <div className="space-y-1">
            <Label>Categoria</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={f.categoria ?? ""}
              onChange={(e) => set("categoria", e.target.value || undefined)}
            >
              <option value="">—</option>
              <option value="Contabilidade">Contabilidade</option>
              <option value="MEI Padrão">MEI Padrão</option>
              <option value="MEI Básico">MEI Básico</option>
              <option value="Carnê Leão">Carnê Leão</option>
              <option value="Pessoa Física">Pessoa Física</option>
              <option value="Esocial Doméstico">Esocial Doméstico</option>
              <option value="Administração Condominial">Administração Condominial</option>
              <option value="Imposto de Renda">Imposto de Renda</option>
              <option value="Projetos Culturais">Projetos Culturais</option>
              <option value="BPO Financeiro">BPO Financeiro</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Operação</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.temProlabore ?? false} onChange={(e) => set("temProlabore", e.target.checked)} />
            Terá pró-labore
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.temFolha ?? false} onChange={(e) => set("temFolha", e.target.checked)} />
            Terá folha de pagamento
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.temFuncionario ?? false} onChange={(e) => set("temFuncionario", e.target.checked)} />
            Terá funcionário CLT
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Comercial e honorários</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Responsável comercial</Label>
            <Input value={f.responsavelComercial ?? ""} onChange={(e) => set("responsavelComercial", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Honorário contábil (R$)</Label>
            <Input
              type="number" step="0.01"
              value={f.honorarioContabil ?? ""}
              onChange={(e) => set("honorarioContabil", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div className="space-y-1">
            <Label>Honorário folha (R$)</Label>
            <Input
              type="number" step="0.01"
              value={f.honorarioFolha ?? ""}
              onChange={(e) => set("honorarioFolha", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div className="space-y-1">
            <Label>Honorário fiscal (R$)</Label>
            <Input
              type="number" step="0.01"
              value={f.honorarioFiscal ?? ""}
              onChange={(e) => set("honorarioFiscal", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Observações</Label>
            <textarea
              className="w-full min-h-24 rounded-md border bg-background p-3 text-sm"
              value={f.observacoes ?? ""}
              onChange={(e) => set("observacoes", e.target.value)}
              placeholder="Detalhes do que foi acordado, descontos, exceções…"
            />
          </div>
        </CardContent>
      </Card>

      {erro && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {erro}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          <Save className="h-4 w-4" /> {loading ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar pré-cadastro"}
        </Button>
      </div>
    </form>
  );
}
