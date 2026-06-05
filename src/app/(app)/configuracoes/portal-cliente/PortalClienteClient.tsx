"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2, Clock, UserPlus, RefreshCw, Copy, Search, ExternalLink, X } from "lucide-react";

interface Acesso {
  id: string;
  email: string;
  nome: string;
  ativo: boolean;
  ultimoAcesso: string | null;
  temSenha: boolean;
  conviteAtivo: boolean;
  conviteExpiraEm: string | null;
  createdAt: string;
}

interface ClienteRow {
  id: string;
  codigo: number | null;
  razaoSocial: string;
  nomeFantasia: string | null;
  status: string;
  acessos: Acesso[];
}

interface Totais {
  totalClientes: number;
  comAcessoAtivo: number;
  comConvitePendente: number;
  semAcesso: number;
}

function tempoRelativo(iso: string | null): string {
  if (!iso) return "nunca";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  const meses = Math.floor(d / 30);
  return `há ${meses}m`;
}

export function PortalClienteClient() {
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [totais, setTotais] = useState<Totais | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "COM_ACESSO" | "SEM_ACESSO">("TODOS");
  const [loading, setLoading] = useState(false);
  const [modalCliente, setModalCliente] = useState<ClienteRow | null>(null);
  const [modalEmail, setModalEmail] = useState("");
  const [modalNome, setModalNome] = useState("");
  const [modalLink, setModalLink] = useState<string | null>(null);
  const [modalGerando, setModalGerando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busca) params.set("q", busca);
      if (filtroStatus !== "TODOS") params.set("status", filtroStatus);
      const r = await fetch(`/api/admin/portal-cliente?${params}`, { cache: "no-store" });
      if (!r.ok) throw new Error("Falha ao carregar");
      const j = await r.json();
      setClientes(j.clientes);
      setTotais(j.totais);
    } catch (err: any) {
      toast.error(`Erro: ${err.message ?? err}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);
  useEffect(() => {
    const timer = setTimeout(() => carregar(), 250);
    return () => clearTimeout(timer);
  }, [busca, filtroStatus]);

  function abrirModal(cliente: ClienteRow) {
    setModalCliente(cliente);
    // Se já tem acesso, pré-preenche com o último
    if (cliente.acessos.length > 0) {
      setModalEmail(cliente.acessos[0].email);
      setModalNome(cliente.acessos[0].nome);
    } else {
      setModalEmail("");
      setModalNome("");
    }
    setModalLink(null);
  }

  function fecharModal() {
    setModalCliente(null);
    setModalEmail("");
    setModalNome("");
    setModalLink(null);
  }

  async function gerarLink() {
    if (!modalCliente) return;
    if (!modalEmail.includes("@") || modalNome.length < 2) {
      toast.error("Preencha e-mail válido e nome");
      return;
    }
    setModalGerando(true);
    try {
      const r = await fetch(`/api/clientes/${modalCliente.id}/convite/link`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: modalEmail, nome: modalNome }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        toast.error(`Erro: ${j.error ?? "falha"}`);
        return;
      }
      setModalLink(j.link);
      toast.success(j.jaExistia ? "Convite renovado — link novo gerado" : "Convite criado");
      carregar();
    } catch (err: any) {
      toast.error(`Falha: ${err.message ?? err}`);
    } finally {
      setModalGerando(false);
    }
  }

  function copiarLink() {
    if (!modalLink) return;
    navigator.clipboard.writeText(modalLink);
    toast.success("Link copiado");
  }

  function statusBadge(c: ClienteRow) {
    const ativo = c.acessos.find((a) => a.temSenha && a.ativo);
    if (ativo) return <Badge variant="default" className="bg-emerald-600 text-white">acesso ativo</Badge>;
    const pendente = c.acessos.find((a) => a.conviteAtivo);
    if (pendente) return <Badge variant="secondary" className="bg-amber-100 text-amber-800">convite pendente</Badge>;
    return <Badge variant="outline">sem acesso</Badge>;
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      {totais && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Total de clientes</div>
              <div className="text-2xl font-bold">{totais.totalClientes}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Acesso ativo</div>
              <div className="text-2xl font-bold text-emerald-700">{totais.comAcessoAtivo}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-amber-700 flex items-center gap-1"><Clock className="h-3 w-3" /> Convite pendente</div>
              <div className="text-2xl font-bold text-amber-700">{totais.comConvitePendente}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Sem acesso</div>
              <div className="text-2xl font-bold text-muted-foreground">{totais.semAcesso}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código, razão social, CNPJ, e-mail…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {[
            { k: "TODOS", l: "Todos" },
            { k: "COM_ACESSO", l: "Com acesso" },
            { k: "SEM_ACESSO", l: "Sem acesso" },
          ].map((f) => (
            <Button
              key={f.k}
              variant={filtroStatus === f.k ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroStatus(f.k as any)}
            >
              {f.l}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading} aria-label="Recarregar lista">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Lista */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 px-3 w-14">#</th>
                <th className="py-2 px-3">Cliente</th>
                <th className="py-2 px-3">Status do acesso</th>
                <th className="py-2 px-3">Último login</th>
                <th className="py-2 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => {
                const ultimo = c.acessos
                  .map((a) => a.ultimoAcesso)
                  .filter(Boolean)
                  .sort()
                  .reverse()[0] ?? null;
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3 font-mono text-xs">{c.codigo ?? "—"}</td>
                    <td className="py-2 px-3">
                      <div className="font-medium">{c.razaoSocial}</div>
                      {c.nomeFantasia && c.nomeFantasia !== c.razaoSocial && (
                        <div className="text-xs text-muted-foreground">{c.nomeFantasia}</div>
                      )}
                      {c.acessos.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {c.acessos[0].email}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3">{statusBadge(c)}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">
                      {tempoRelativo(ultimo)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Button
                        size="sm"
                        variant={c.acessos.length > 0 ? "outline" : "default"}
                        onClick={() => abrirModal(c)}
                      >
                        {c.acessos.length > 0 ? <RefreshCw className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                        {c.acessos.length > 0 ? "Renovar" : "Gerar link"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {clientes.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modal */}
      {modalCliente && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={fecharModal}
        >
          <Card className="max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg">
                  {modalCliente.acessos.length > 0 ? "Renovar acesso" : "Criar acesso"}
                </CardTitle>
                <CardDescription>{modalCliente.razaoSocial}</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={fecharModal} aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {!modalLink ? (
                <>
                  <div>
                    <label className="text-sm font-medium block mb-1">Nome do contato</label>
                    <Input
                      value={modalNome}
                      onChange={(e) => setModalNome(e.target.value)}
                      placeholder="Ex: João Silva"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">E-mail do contato</label>
                    <Input
                      type="email"
                      value={modalEmail}
                      onChange={(e) => setModalEmail(e.target.value)}
                      placeholder="contato@empresa.com.br"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Identifica o acesso. Não vamos mandar email — só gerar o link.
                    </p>
                  </div>
                  <Button onClick={gerarLink} disabled={modalGerando} className="w-full">
                    {modalGerando ? "Gerando…" : modalCliente.acessos.length > 0 ? "Renovar e gerar novo link" : "Gerar link de primeiro acesso"}
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-sm text-emerald-700 bg-emerald-50 rounded p-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Link gerado. Válido por 7 dias.
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Link de primeiro acesso (cola no WhatsApp do cliente)</label>
                    <div className="flex items-center gap-2 bg-muted rounded px-3 py-2 text-xs font-mono break-all">
                      <span className="flex-1">{modalLink}</span>
                      <Button variant="ghost" size="icon" onClick={copiarLink} aria-label="Copiar link">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={copiarLink} className="flex-1">
                      <Copy className="h-4 w-4" /> Copiar link
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <a href={modalLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" /> Abrir
                      </a>
                    </Button>
                  </div>
                  <Button variant="ghost" onClick={fecharModal} className="w-full">Fechar</Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
