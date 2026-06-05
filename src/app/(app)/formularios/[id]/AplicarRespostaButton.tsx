"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, UserPlus, UserCheck, FileText, ExternalLink, X, Send, CheckCircle2 } from "lucide-react";

interface ClienteResultado {
  id: string;
  codigo: number | null;
  razaoSocial: string;
  cpfCnpj: string;
  status: string;
  tipoPessoa: string;
}
interface PreCadastroResultado {
  id: string;
  codigo: number | null;
  nomeContato: string;
  nomeEmpresaPretendido: string | null;
  emailContato: string;
  cpfContato: string | null;
  status: string;
}

type Modo = "criar" | "vincular-cliente" | "vincular-precadastro" | "criar-precadastro";

interface Props {
  respostaId: string;
  tituloResposta: string;
}

export function AplicarRespostaButton({ respostaId, tituloResposta }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<Modo>("vincular-cliente");
  const [busca, setBusca] = useState("");
  const [clientes, setClientes] = useState<ClienteResultado[]>([]);
  const [preCadastros, setPreCadastros] = useState<PreCadastroResultado[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null);
  const [preCadastroSelecionado, setPreCadastroSelecionado] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (!aberto || busca.length < 2) {
      setClientes([]); setPreCadastros([]);
      return;
    }
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await fetch(`/api/admin/buscar-vinculo?q=${encodeURIComponent(busca)}`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          setClientes(j.clientes);
          setPreCadastros(j.preCadastros);
        }
      } finally {
        setBuscando(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [busca, aberto]);

  async function aplicar() {
    setAplicando(true);
    try {
      const body: any = { modo };
      if (modo === "vincular-cliente") {
        if (!clienteSelecionado) { toast.error("Selecione um cliente"); setAplicando(false); return; }
        body.clienteId = clienteSelecionado;
      } else if (modo === "vincular-precadastro") {
        if (!preCadastroSelecionado) { toast.error("Selecione um pré-cadastro"); setAplicando(false); return; }
        body.preCadastroId = preCadastroSelecionado;
      }
      const r = await fetch(`/api/forms/responses/${respostaId}/aplicar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        toast.error(j.error ?? "Falha ao aplicar");
        return;
      }
      toast.success("Resposta aplicada");
      router.push(j.next ?? "/formularios");
      router.refresh();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message ?? err}`);
    } finally {
      setAplicando(false);
    }
  }

  if (!aberto) {
    return (
      <Button onClick={() => setAberto(true)}>
        <Send className="h-4 w-4" /> Aplicar ao cadastro
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>Aplicar resposta ao cadastro</CardTitle>
            <CardDescription>{tituloResposta}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setAberto(false)} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 4 modos */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Como aplicar?</p>
            <div className="grid grid-cols-1 gap-2">
              <ModoRadio
                checked={modo === "vincular-cliente"}
                onSelect={() => setModo("vincular-cliente")}
                icon={UserCheck}
                titulo="Vincular a cliente existente"
                descricao="Procurar cliente já cadastrado e adicionar respostas/sócios a ele. Não cria duplicata."
                recomendado
              />
              <ModoRadio
                checked={modo === "vincular-precadastro"}
                onSelect={() => setModo("vincular-precadastro")}
                icon={FileText}
                titulo="Vincular a pré-cadastro existente"
                descricao="Resposta de cliente que ainda está em processo de abertura. Procura pré-cadastro feito pelo comercial."
              />
              <ModoRadio
                checked={modo === "criar-precadastro"}
                onSelect={() => setModo("criar-precadastro")}
                icon={UserPlus}
                titulo="Criar pré-cadastro novo"
                descricao="Só quando o comercial esqueceu de criar antes de mandar o formulário."
              />
              <ModoRadio
                checked={modo === "criar"}
                onSelect={() => setModo("criar")}
                icon={UserPlus}
                titulo="Criar cliente novo (pessoa física)"
                descricao="Usar pra Carnê-Leão / IR / cliente avulso com CPF/CNPJ no formulário. Vira PROSPECT no Postgres."
              />
            </div>
          </div>

          {/* Busca quando vincular */}
          {(modo === "vincular-cliente" || modo === "vincular-precadastro") && (
            <div className="space-y-2 border-t pt-4">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder={modo === "vincular-cliente"
                    ? "Buscar por código, CNPJ, razão social…"
                    : "Buscar por código, CPF, nome do contato, empresa…"}
                  className="pl-9"
                  autoFocus
                />
              </div>
              {busca.length < 2 ? (
                <p className="text-xs text-muted-foreground">Digite ao menos 2 caracteres pra buscar.</p>
              ) : buscando ? (
                <p className="text-xs text-muted-foreground">Buscando…</p>
              ) : modo === "vincular-cliente" ? (
                clientes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
                ) : (
                  <ul className="max-h-60 overflow-y-auto divide-y border rounded">
                    {clientes.map((c) => (
                      <li
                        key={c.id}
                        onClick={() => setClienteSelecionado(c.id)}
                        className={`px-3 py-2 cursor-pointer hover:bg-muted/50 text-sm ${clienteSelecionado === c.id ? "bg-cestacorp-blue/10" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          {clienteSelecionado === c.id && <CheckCircle2 className="h-4 w-4 text-cestacorp-blue shrink-0" />}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {c.codigo != null && <span className="font-mono text-xs text-muted-foreground">#{c.codigo}</span>}
                              <span className="font-medium">{c.razaoSocial}</span>
                              <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{c.cpfCnpj}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ) : preCadastros.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum pré-cadastro encontrado.</p>
              ) : (
                <ul className="max-h-60 overflow-y-auto divide-y border rounded">
                  {preCadastros.map((p) => (
                    <li
                      key={p.id}
                      onClick={() => setPreCadastroSelecionado(p.id)}
                      className={`px-3 py-2 cursor-pointer hover:bg-muted/50 text-sm ${preCadastroSelecionado === p.id ? "bg-cestacorp-blue/10" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        {preCadastroSelecionado === p.id && <CheckCircle2 className="h-4 w-4 text-cestacorp-blue shrink-0" />}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {p.codigo != null && <span className="font-mono text-xs text-muted-foreground">#{p.codigo}</span>}
                            <span className="font-medium">{p.nomeContato}</span>
                            <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {p.nomeEmpresaPretendido && `${p.nomeEmpresaPretendido} · `}
                            {p.emailContato}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={aplicar} disabled={aplicando}>
              <Send className="h-4 w-4" /> {aplicando ? "Aplicando…" : "Aplicar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ModoRadio({
  checked, onSelect, icon: Icon, titulo, descricao, recomendado,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: any;
  titulo: string;
  descricao: string;
  recomendado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`border rounded-lg p-3 text-left transition flex items-start gap-3 hover:bg-muted/40 ${checked ? "border-cestacorp-blue bg-cestacorp-blue/5 ring-2 ring-cestacorp-blue/30" : ""}`}
    >
      <div className={`h-4 w-4 rounded-full border-2 mt-0.5 shrink-0 ${checked ? "border-cestacorp-blue bg-cestacorp-blue" : "border-muted-foreground"}`} />
      <Icon className="h-5 w-5 text-cestacorp-blue mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{titulo}</span>
          {recomendado && <Badge variant="default" className="text-[9px] bg-emerald-600">recomendado</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{descricao}</p>
      </div>
    </button>
  );
}
