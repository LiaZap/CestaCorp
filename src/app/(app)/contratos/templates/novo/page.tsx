"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NovoTemplatePage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("PRESTACAO_SERVICOS");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    setLoading(true); setErro(null);
    const form = new FormData();
    form.append("nome", nome);
    form.append("tipo", tipo);
    form.append("file", arquivo);
    const res = await fetch("/api/contratos/templates", { method: "POST", body: form });
    setLoading(false);
    if (res.ok) router.push("/contratos/templates");
    else setErro((await res.json()).error || "Falha ao criar");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-cestacorp-blue mb-6">Novo template</h1>
      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardDescription>
            Faça upload do arquivo .docx. Os placeholders ficam entre chaves, ex.: <code>{'{razaoSocial}'}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do template</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Ex.: Contrato de Prestação de Serviços — Pessoa Jurídica" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                <option value="PRESTACAO_SERVICOS">Prestação de Serviços</option>
                <option value="CARNE_LEAO">Carnê Leão</option>
                <option value="ESOCIAL_DOMESTICO">eSocial Doméstico</option>
                <option value="ABERTURA_EMPRESA">Abertura de Empresa</option>
                <option value="ABERTURA_MEI">Abertura de MEI</option>
                <option value="OUTROS">Outros</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Arquivo .docx</Label>
              <input
                type="file"
                accept=".docx"
                required
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-4 file:py-2 file:font-medium"
              />
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit" disabled={loading}>{loading ? "Enviando…" : "Criar template"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
