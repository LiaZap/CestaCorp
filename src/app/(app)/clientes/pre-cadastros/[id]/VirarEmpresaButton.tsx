"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, AlertCircle, Search, X, CheckCircle2 } from "lucide-react";

export function VirarEmpresaButton({
  preCadastroId,
  sugerido,
}: {
  preCadastroId: string;
  sugerido: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState(sugerido ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [consultando, setConsultando] = useState(false);

  async function consultarReceita() {
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) {
      setErro("Digite o CNPJ completo");
      return;
    }
    setConsultando(true); setErro(null);
    try {
      const r = await fetch(`/api/clientes/consultar-cnpj?cnpj=${cnpjLimpo}`);
      const j = await r.json();
      if (!r.ok) {
        setErro(j.error || "Falha na consulta");
        return;
      }
      setRazaoSocial(j.razaoSocial ?? "");
      if (j.nomeFantasia && !nomeFantasia) setNomeFantasia(j.nomeFantasia);
    } finally {
      setConsultando(false);
    }
  }

  async function virar() {
    setLoading(true); setErro(null);
    try {
      const r = await fetch(`/api/pre-cadastros/${preCadastroId}/virar-cliente`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cnpj, razaoSocial, nomeFantasia: nomeFantasia || undefined }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(j.error || "Erro ao virar empresa");
        return;
      }
      router.push(`/clientes/${j.clienteId}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!aberto) {
    return (
      <Button onClick={() => setAberto(true)} size="lg">
        <Building2 className="h-4 w-4" /> Virar empresa
      </Button>
    );
  }

  return (
    <div className="bg-white rounded-lg border-2 border-cestacorp-blue/30 p-5 w-full max-w-md space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-cestacorp-blue flex items-center gap-2">
          <Building2 className="h-5 w-5" /> Empresa abriu na Receita?
        </h3>
        <Button variant="ghost" size="icon" onClick={() => setAberto(false)} aria-label="Fechar diálogo">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Vou criar o cliente preservando o código sequencial e importando os dados deste pré-cadastro
        (sócio, contato, e-mail, regime, etc.).
      </p>

      <div className="space-y-1">
        <Label>CNPJ</Label>
        <div className="flex gap-2">
          <Input
            required
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
          />
          <Button
            type="button"
            variant="outline"
            onClick={consultarReceita}
            disabled={consultando}
          >
            <Search className="h-4 w-4" />
            {consultando ? "…" : "Consultar"}
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Razão social</Label>
        <Input
          required
          value={razaoSocial}
          onChange={(e) => setRazaoSocial(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label>Nome fantasia (opcional)</Label>
        <Input
          value={nomeFantasia}
          onChange={(e) => setNomeFantasia(e.target.value)}
        />
      </div>

      {erro && (
        <div className="rounded-md bg-red-50 border border-red-200 p-2 text-xs text-red-800 flex items-start gap-1">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" /> {erro}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
        <Button onClick={virar} disabled={loading || !cnpj || !razaoSocial}>
          <CheckCircle2 className="h-4 w-4" /> {loading ? "Criando…" : "Confirmar e criar cliente"}
        </Button>
      </div>
    </div>
  );
}
