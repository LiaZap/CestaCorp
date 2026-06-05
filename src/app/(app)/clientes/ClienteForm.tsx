"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, CheckCircle2, AlertCircle, Sparkles, Building2 } from "lucide-react";
import { isDocumentoValido, soDigitos } from "@/lib/security/documento";

type ClienteFormInput = {
  id?: string;
  codigo?: number | null;
  razaoSocial: string;
  nomeFantasia?: string;
  cpfCnpj: string;
  tipoPessoa?: "FISICA" | "JURIDICA" | "MEI";
  classificacao?: "BRONZE" | "PRATA" | "OURO" | "TOP" | "DIAMANTE" | null;
  status?: "ATIVO" | "INATIVO" | "ENCERRADO" | "PROSPECT" | "SUSPENSO";
  mesAniversarioReajuste?: number | null;
  indiceReajuste?: "IPCA" | "IGPM" | "INPC" | "FIXO" | "CUSTOM" | null;
  respFiscal?: string;
  respFolha?: string;
  respContabil?: string;
  tributacao?: string;
  prefeitura?: string;
  dataConstituicao?: string;
  whatsappGrupoId?: string;
  whatsappGrupoNome?: string;
  emailPrincipal?: string;
  telefonePrincipal?: string;
  niboCustomerId?: string;
  digisacContactId?: string;
};

export function ClienteForm({ defaults }: { defaults?: ClienteFormInput }) {
  const router = useRouter();
  const isEdit = Boolean(defaults?.id);

  const [f, setF] = useState<ClienteFormInput>(
    defaults ?? {
      razaoSocial: "",
      cpfCnpj: "",
      tipoPessoa: "JURIDICA",
      status: "ATIVO",
      indiceReajuste: "IPCA",
    }
  );
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [consultaErro, setConsultaErro] = useState<string | null>(null);
  const [consultaSucesso, setConsultaSucesso] = useState<string | null>(null);
  const [docErro, setDocErro] = useState<string | null>(null);

  // Valida CPF/CNPJ no onBlur — usa o algoritmo oficial em lib/security/documento.
  // No edit não revalida (#82) porque o campo é disabled.
  function validarDoc(): boolean {
    const limpo = soDigitos(f.cpfCnpj ?? "");
    if (!limpo) { setDocErro("Informe CPF ou CNPJ"); return false; }
    if (limpo.length !== 11 && limpo.length !== 14) {
      setDocErro("CPF deve ter 11 dígitos · CNPJ deve ter 14");
      return false;
    }
    if (!isDocumentoValido(limpo)) {
      setDocErro(limpo.length === 11 ? "CPF inválido (dígitos verificadores)" : "CNPJ inválido (dígitos verificadores)");
      return false;
    }
    setDocErro(null);
    return true;
  }

  // Pega próximo código quando é cadastro novo
  useEffect(() => {
    if (isEdit) return;
    if (f.codigo) return;
    fetch("/api/clientes/proximo-codigo")
      .then((r) => r.json())
      .then((j) => {
        if (j.proximo) setF((s) => ({ ...s, codigo: j.proximo }));
      })
      .catch(() => {});
  }, [isEdit, f.codigo]);

  function set<K extends keyof ClienteFormInput>(k: K, v: ClienteFormInput[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function consultarCnpj() {
    const cnpjLimpo = (f.cpfCnpj ?? "").replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) {
      setConsultaErro("Digite um CNPJ completo (14 dígitos)");
      return;
    }
    setConsultando(true);
    setConsultaErro(null);
    setConsultaSucesso(null);
    try {
      const r = await fetch(`/api/clientes/consultar-cnpj?cnpj=${cnpjLimpo}`);
      const j = await r.json();
      if (!r.ok) {
        setConsultaErro(j.error || "Falha na consulta");
        return;
      }

      // Preenche os campos com os dados da Receita
      setF((s) => ({
        ...s,
        razaoSocial: s.razaoSocial || j.razaoSocial,
        nomeFantasia: s.nomeFantasia || j.nomeFantasia || "",
        emailPrincipal: s.emailPrincipal || (j.email ?? ""),
        telefonePrincipal: s.telefonePrincipal || (j.telefone ?? ""),
        prefeitura: s.prefeitura || (j.endereco?.municipio ? `${j.endereco.municipio}/${j.endereco.uf}` : ""),
        dataConstituicao: s.dataConstituicao || (j.dataAbertura ?? ""),
      }));

      setConsultaSucesso(
        `${j.razaoSocial} · ${j.situacao ?? ""} · fonte: ${j._fonte}`
      );
    } catch (err: any) {
      setConsultaErro(String(err?.message ?? err).slice(0, 200));
    } finally {
      setConsultando(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Bloqueia envio se o documento for inválido (#82). No edit pula porque o campo é disabled.
    if (!isEdit && !validarDoc()) {
      setErro("Corrija o CPF/CNPJ antes de salvar");
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(f.id ? `/api/clientes/${f.id}` : "/api/clientes", {
        method: f.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(f),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErro(typeof json.error === "string" ? json.error : JSON.stringify(json.error));
        return;
      }
      const json = await res.json();
      router.push(`/clientes/${json.id ?? f.id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Dados principais</CardTitle>
          {!isEdit && (
            <CardDescription>
              Dica: digite o CNPJ e clique em <b>Consultar Receita</b> para preencher
              automaticamente razão social, endereço e mais.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Código sequencial</Label>
            <Input
              type="number"
              value={f.codigo ?? ""}
              onChange={(e) => set("codigo", e.target.value ? Number(e.target.value) : null)}
              placeholder="auto"
            />
            <p className="text-[10px] text-muted-foreground">
              Próximo disponível é sugerido. Pode editar se precisar.
            </p>
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label>CPF/CNPJ *</Label>
            <div className="flex gap-2">
              <Input
                required
                value={f.cpfCnpj}
                onChange={(e) => { set("cpfCnpj", e.target.value); if (docErro) setDocErro(null); }}
                onBlur={() => { if (!isEdit && f.cpfCnpj) validarDoc(); }}
                placeholder="00.000.000/0000-00"
                disabled={isEdit}
                aria-invalid={Boolean(docErro)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={consultarCnpj}
                disabled={consultando || isEdit}
                title="Consulta dados públicos do CNPJ na Receita"
              >
                <Search className="h-4 w-4" />
                {consultando ? "Consultando…" : "Consultar Receita"}
              </Button>
            </div>
            {docErro && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {docErro}
              </p>
            )}
            {consultaErro && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {consultaErro}
              </p>
            )}
            {consultaSucesso && (
              <p className="text-xs text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Dados preenchidos: {consultaSucesso}
              </p>
            )}
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label>Razão social *</Label>
            <Input required value={f.razaoSocial} onChange={(e) => set("razaoSocial", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Tipo</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={f.tipoPessoa}
              onChange={(e) => set("tipoPessoa", e.target.value as any)}
            >
              <option value="JURIDICA">Pessoa Jurídica</option>
              <option value="FISICA">Pessoa Física</option>
              <option value="MEI">MEI</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label>Nome fantasia</Label>
            <Input value={f.nomeFantasia ?? ""} onChange={(e) => set("nomeFantasia", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Status</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={f.status}
              onChange={(e) => set("status", e.target.value as any)}
            >
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
              <option value="PROSPECT">Prospect</option>
              <option value="SUSPENSO">Suspenso</option>
              <option value="ENCERRADO">Encerrado</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label>Classificação</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={f.classificacao ?? ""}
              onChange={(e) => set("classificacao", (e.target.value || null) as any)}
            >
              <option value="">—</option>
              <option value="BRONZE">Bronze</option>
              <option value="PRATA">Prata</option>
              <option value="OURO">Ouro</option>
              <option value="TOP">Top</option>
              <option value="DIAMANTE">Diamante</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label>Tributação</Label>
            <Input
              value={f.tributacao ?? ""}
              onChange={(e) => set("tributacao", e.target.value)}
              placeholder="Simples Nacional, Lucro Presumido…"
            />
          </div>

          <div className="space-y-1">
            <Label>Prefeitura</Label>
            <Input
              value={f.prefeitura ?? ""}
              onChange={(e) => set("prefeitura", e.target.value)}
              placeholder="Porto Alegre/RS"
            />
          </div>

          <div className="space-y-1">
            <Label>Data de constituição</Label>
            <Input
              type="date"
              value={f.dataConstituicao ? f.dataConstituicao.slice(0, 10) : ""}
              onChange={(e) => set("dataConstituicao", e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">Aniversário da empresa</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contato e WhatsApp</CardTitle>
          <CardDescription>
            Cestacorp se comunica via grupo WhatsApp do cliente. Configure o ID do grupo após conectar o Digisac.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>E-mail principal</Label>
            <Input
              type="email"
              value={f.emailPrincipal ?? ""}
              onChange={(e) => set("emailPrincipal", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Telefone</Label>
            <Input
              value={f.telefonePrincipal ?? ""}
              onChange={(e) => set("telefonePrincipal", e.target.value)}
              placeholder="(51) 99999-9999"
            />
          </div>
          <div className="space-y-1">
            <Label>Nome do grupo WhatsApp</Label>
            <Input
              value={f.whatsappGrupoNome ?? ""}
              onChange={(e) => set("whatsappGrupoNome", e.target.value)}
              placeholder="ex: TechNova - Cestacorp"
            />
          </div>
          <div className="space-y-1">
            <Label>ID do grupo (Digisac)</Label>
            <Input
              value={f.whatsappGrupoId ?? ""}
              onChange={(e) => set("whatsappGrupoId", e.target.value)}
              placeholder="auto-vincula via Digisac"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Responsáveis e reajuste</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Resp. fiscal</Label>
            <Input value={f.respFiscal ?? ""} onChange={(e) => set("respFiscal", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Resp. folha</Label>
            <Input value={f.respFolha ?? ""} onChange={(e) => set("respFolha", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Resp. contábil</Label>
            <Input value={f.respContabil ?? ""} onChange={(e) => set("respContabil", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Mês aniversário do contrato</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={f.mesAniversarioReajuste ?? ""}
              onChange={(e) => set("mesAniversarioReajuste", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">—</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m - 1]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Índice de reajuste</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={f.indiceReajuste ?? "IPCA"}
              onChange={(e) => set("indiceReajuste", e.target.value as any)}
            >
              <option value="IPCA">IPCA</option>
              <option value="IGPM">IGP-M</option>
              <option value="INPC">INPC</option>
              <option value="FIXO">Fixo (sem índice)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrações externas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>NIBO Customer ID</Label>
            <Input
              value={f.niboCustomerId ?? ""}
              onChange={(e) => set("niboCustomerId", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Digisac Contact ID</Label>
            <Input
              value={f.digisacContactId ?? ""}
              onChange={(e) => set("digisacContactId", e.target.value)}
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
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar cliente"}
        </Button>
      </div>
    </form>
  );
}
