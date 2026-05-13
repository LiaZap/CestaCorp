"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, Pencil, Trash2, Cake, FileSignature, Crown, X, Save } from "lucide-react";
import { formatDate } from "@/lib/utils";

type Socio = {
  id: string;
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  profissao: string | null;
  estadoCivil: string | null;
  quotas: any;  // Decimal
  representanteLegal: boolean;
  assinante: boolean;
  dataNascimento: string | null;
};

type FormSocio = {
  id?: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  profissao: string;
  estadoCivil: string;
  quotas: string;
  representanteLegal: boolean;
  assinante: boolean;
  dataNascimento: string;
};

const VAZIO: FormSocio = {
  nome: "", cpf: "", email: "", telefone: "", profissao: "", estadoCivil: "",
  quotas: "", representanteLegal: false, assinante: false, dataNascimento: "",
};

export function SociosCard({ clienteId, socios }: { clienteId: string; socios: Socio[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<FormSocio | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function abrirNovo() {
    setEditando({ ...VAZIO });
    setErro(null);
  }

  function abrirEdicao(s: Socio) {
    setEditando({
      id: s.id,
      nome: s.nome,
      cpf: s.cpf,
      email: s.email ?? "",
      telefone: s.telefone ?? "",
      profissao: s.profissao ?? "",
      estadoCivil: s.estadoCivil ?? "",
      quotas: s.quotas ? String(s.quotas) : "",
      representanteLegal: s.representanteLegal,
      assinante: s.assinante,
      dataNascimento: s.dataNascimento ? s.dataNascimento.slice(0, 10) : "",
    });
    setErro(null);
  }

  async function salvar() {
    if (!editando) return;
    setLoading(true); setErro(null);
    try {
      const body = {
        nome: editando.nome,
        cpf: editando.cpf,
        email: editando.email || undefined,
        telefone: editando.telefone || null,
        profissao: editando.profissao || null,
        estadoCivil: editando.estadoCivil || null,
        quotas: editando.quotas ? Number(editando.quotas) : null,
        representanteLegal: editando.representanteLegal,
        assinante: editando.assinante,
        dataNascimento: editando.dataNascimento || null,
      };
      const url = editando.id ? `/api/socios/${editando.id}` : `/api/clientes/${clienteId}/socios`;
      const method = editando.id ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(typeof j.error === "string" ? j.error : "erro ao salvar");
        return;
      }
      setEditando(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remover(id: string) {
    if (!confirm("Remover este sócio?")) return;
    const r = await fetch(`/api/socios/${id}`, { method: "DELETE" });
    if (r.ok) router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" /> Sócios ({socios.length})
          </CardTitle>
          <CardDescription>Quem aparece nos contratos · marque quem assina</CardDescription>
        </div>
        <Button onClick={abrirNovo} size="sm">
          <Plus className="h-3 w-3" /> Novo sócio
        </Button>
      </CardHeader>
      <CardContent>
        {socios.length === 0 && !editando ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum sócio cadastrado. Clique em "Novo sócio" pra adicionar.
          </p>
        ) : (
          <ul className="divide-y">
            {socios.map((s) => (
              <li key={s.id} className="py-3 flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-cestacorp-blue/10 text-cestacorp-blue flex items-center justify-center font-bold text-sm shrink-0">
                  {s.nome.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{s.nome}</p>
                    {s.representanteLegal && (
                      <span title="Representante legal" className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                        <Crown className="h-3 w-3" /> Representante
                      </span>
                    )}
                    {s.assinante && (
                      <span title="Assina contratos" className="inline-flex items-center gap-1 text-[10px] bg-cestacorp-blue/10 text-cestacorp-blue px-2 py-0.5 rounded-full font-medium">
                        <FileSignature className="h-3 w-3" /> Assinante
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{s.cpf}</p>
                  {s.email && (
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  )}
                  <div className="flex gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                    {s.telefone && <span>{s.telefone}</span>}
                    {s.profissao && <span>{s.profissao}</span>}
                    {s.dataNascimento && (
                      <span className="inline-flex items-center gap-1">
                        <Cake className="h-3 w-3" />
                        {formatDate(s.dataNascimento)}
                      </span>
                    )}
                    {s.quotas && <span>{Number(s.quotas).toLocaleString("pt-BR")} quotas</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => abrirEdicao(s)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remover(s.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {editando && (
          <div className="mt-4 border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{editando.id ? "Editar sócio" : "Novo sócio"}</h4>
              <Button variant="ghost" size="icon" onClick={() => setEditando(null)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input value={editando.nome} onChange={(e) => setEditando({ ...editando!, nome: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>CPF *</Label>
                <Input value={editando.cpf} onChange={(e) => setEditando({ ...editando!, cpf: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input type="email" value={editando.email} onChange={(e) => setEditando({ ...editando!, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={editando.telefone} onChange={(e) => setEditando({ ...editando!, telefone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Profissão</Label>
                <Input value={editando.profissao} onChange={(e) => setEditando({ ...editando!, profissao: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Estado civil</Label>
                <Input value={editando.estadoCivil} onChange={(e) => setEditando({ ...editando!, estadoCivil: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Data de nascimento</Label>
                <Input
                  type="date"
                  value={editando.dataNascimento}
                  onChange={(e) => setEditando({ ...editando!, dataNascimento: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Quotas</Label>
                <Input
                  type="number" step="0.01"
                  value={editando.quotas}
                  onChange={(e) => setEditando({ ...editando!, quotas: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editando.representanteLegal}
                  onChange={(e) => setEditando({ ...editando!, representanteLegal: e.target.checked })}
                />
                Representante legal
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editando.assinante}
                  onChange={(e) => setEditando({ ...editando!, assinante: e.target.checked })}
                />
                <span>
                  Assina contratos
                  <span className="text-xs text-muted-foreground ml-2">— se marcado, este sócio recebe o link de assinatura via Autentique</span>
                </span>
              </label>
            </div>

            {erro && (
              <p className="text-sm text-destructive">{erro}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button onClick={salvar} disabled={loading || !editando.nome || !editando.cpf}>
                <Save className="h-4 w-4" /> {loading ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
