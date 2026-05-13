"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/Avatar";
import {
  UserPlus, KeyRound, CheckCircle2, XCircle, Mail, Copy, Pencil, Phone,
  Briefcase, Shield, Search, X,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type User = {
  id: string; nome: string; email: string; role: string; active: boolean;
  cargo?: string | null; telefone?: string | null;
  createdAt: string;
};

type NovoForm = {
  nome: string; email: string; role: string; senha: string;
  cargo: string; telefone: string;
};

type EdicaoForm = {
  id: string; nome: string; email: string; role: string;
  cargo: string; telefone: string; active: boolean;
};

export function UsersClient({ usuarios, currentUserId }: { usuarios: User[]; currentUserId: string }) {
  const [lista, setLista] = useState(usuarios);
  const [filtro, setFiltro] = useState("");
  const [filtroRole, setFiltroRole] = useState<string>("TODOS");
  const [novoAberto, setNovoAberto] = useState(false);
  const [edicao, setEdicao] = useState<EdicaoForm | null>(null);
  const [form, setForm] = useState<NovoForm>({
    nome: "", email: "", role: "OPERADOR", senha: "",
    cargo: "", telefone: "",
  });
  const [savedSenha, setSavedSenha] = useState<string | null>(null);
  const [resetSenha, setResetSenha] = useState<{ userId: string; senha: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErro(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nome: form.nome, email: form.email, role: form.role,
        senha: form.senha || undefined,
        cargo: form.cargo || undefined,
        telefone: form.telefone || undefined,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setErro(json?.error || "erro ao criar"); return; }
    setLista((l) => [
      {
        id: json.user.id, nome: form.nome, email: form.email, role: form.role,
        active: true, cargo: form.cargo, telefone: form.telefone,
        createdAt: new Date().toISOString(),
      },
      ...l,
    ]);
    setSavedSenha(json.senhaInicial ?? null);
    setForm({ nome: "", email: "", role: "OPERADOR", senha: "", cargo: "", telefone: "" });
    setNovoAberto(false);
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!edicao) return;
    setLoading(true); setErro(null);
    const res = await fetch(`/api/users/${edicao.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nome: edicao.nome,
        email: edicao.email,
        role: edicao.role,
        cargo: edicao.cargo || null,
        telefone: edicao.telefone || null,
        active: edicao.active,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setErro(json?.error || "erro ao salvar"); return; }
    setLista((l) => l.map((u) => u.id === edicao.id ? {
      ...u, nome: edicao.nome, email: edicao.email, role: edicao.role,
      cargo: edicao.cargo, telefone: edicao.telefone, active: edicao.active,
    } : u));
    setEdicao(null);
  }

  async function toggleAtivo(id: string, active: boolean) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    if (res.ok) setLista((l) => l.map((u) => u.id === id ? { ...u, active: !active } : u));
  }

  async function resetar(id: string) {
    if (!confirm("Gerar nova senha aleatória? O usuário precisará da senha nova pra logar.")) return;
    const res = await fetch(`/api/users/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reset-senha" }),
    });
    const json = await res.json();
    if (res.ok && json.senha) setResetSenha({ userId: id, senha: json.senha });
  }

  function copiar(s: string) { navigator.clipboard.writeText(s); }

  const listaFiltrada = lista.filter((u) => {
    if (filtroRole !== "TODOS" && u.role !== filtroRole) return false;
    if (!filtro) return true;
    const f = filtro.toLowerCase();
    return u.nome.toLowerCase().includes(f) ||
      u.email.toLowerCase().includes(f) ||
      (u.cargo?.toLowerCase().includes(f) ?? false);
  });

  const stats = {
    total: lista.length,
    ativos: lista.filter((u) => u.active).length,
    admins: lista.filter((u) => u.role === "ADMIN").length,
  };

  return (
    <>
      {/* Mini dashboard */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ativos</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.ativos}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Administradores</p>
          <p className="text-2xl font-bold text-cestacorp-blue">{stats.admins}</p>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou cargo…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filtroRole}
          onChange={(e) => setFiltroRole(e.target.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="TODOS">Todos os papéis</option>
          <option value="ADMIN">Administrador</option>
          <option value="GESTOR">Gestor</option>
          <option value="OPERADOR">Operador</option>
        </select>
        <Button onClick={() => setNovoAberto((v) => !v)}>
          <UserPlus className="h-4 w-4" /> Novo funcionário
        </Button>
      </div>

      {savedSenha && (
        <div className="rounded-lg border-2 border-emerald-400 bg-emerald-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-emerald-900">
            <CheckCircle2 className="inline h-4 w-4 mr-1" /> Funcionário criado. Senha inicial (anote, não mostraremos novamente):
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white px-3 py-2 rounded border font-mono text-sm">{savedSenha}</code>
            <Button size="sm" variant="outline" onClick={() => copiar(savedSenha)}><Copy className="h-3 w-3" /> Copiar</Button>
            <Button size="sm" variant="ghost" onClick={() => setSavedSenha(null)}>OK</Button>
          </div>
        </div>
      )}

      {novoAberto && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Novo funcionário</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setNovoAberto(false)}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={criar} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome completo *</Label>
                <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>E-mail *</Label>
                <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Cargo</Label>
                <Input
                  value={form.cargo}
                  onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                  placeholder="ex.: Contador Sênior"
                />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  placeholder="(51) 99999-9999"
                />
              </div>
              <div className="space-y-1">
                <Label>Papel (permissões) *</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="OPERADOR">Operador — acesso ao dia a dia</option>
                  <option value="GESTOR">Gestor — relatórios e configurações</option>
                  <option value="ADMIN">Administrador — acesso total</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Senha inicial (opcional)</Label>
                <Input
                  type="password"
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  placeholder="Deixe vazio pra gerar automática"
                />
              </div>
              {erro && <p className="text-sm text-destructive md:col-span-2">{erro}</p>}
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setNovoAberto(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Criando…" : "Criar funcionário"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {edicao && (
        <Card className="border-cestacorp-blue/40">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Editando funcionário
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setEdicao(null)}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={salvarEdicao} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input required value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>E-mail *</Label>
                <Input required type="email" value={edicao.email} onChange={(e) => setEdicao({ ...edicao, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Cargo</Label>
                <Input value={edicao.cargo} onChange={(e) => setEdicao({ ...edicao, cargo: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={edicao.telefone} onChange={(e) => setEdicao({ ...edicao, telefone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Papel</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={edicao.role}
                  onChange={(e) => setEdicao({ ...edicao, role: e.target.value })}
                  disabled={edicao.id === currentUserId}
                >
                  <option value="OPERADOR">Operador</option>
                  <option value="GESTOR">Gestor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
                {edicao.id === currentUserId && (
                  <p className="text-[11px] text-muted-foreground">Você não pode alterar seu próprio papel.</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <label className="flex items-center gap-2 h-10 text-sm">
                  <input
                    type="checkbox"
                    checked={edicao.active}
                    onChange={(e) => setEdicao({ ...edicao, active: e.target.checked })}
                    disabled={edicao.id === currentUserId}
                  />
                  Ativo (pode fazer login)
                </label>
              </div>
              {erro && <p className="text-sm text-destructive md:col-span-2">{erro}</p>}
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setEdicao(null)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando…" : "Salvar alterações"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {listaFiltrada.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum funcionário com esse filtro.</p>
          ) : (
            <ul className="divide-y">
              {listaFiltrada.map((u) => {
                const eu = u.id === currentUserId;
                const showResetOverlay = resetSenha?.userId === u.id;
                return (
                  <li key={u.id} className="py-4 flex items-start gap-4 flex-wrap">
                    <Avatar name={u.nome} size="md" status={u.active ? "online" : "offline"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{u.nome}</p>
                        {eu && <span className="text-[10px] bg-cestacorp-blue/10 text-cestacorp-blue px-2 py-0.5 rounded-full font-medium">você</span>}
                        <span className={
                          "text-[10px] px-2 py-0.5 rounded-full font-medium " +
                          (u.role === "ADMIN" ? "bg-red-100 text-red-700"
                            : u.role === "GESTOR" ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-700")
                        }>
                          {u.role === "ADMIN" ? "Admin" : u.role === "GESTOR" ? "Gestor" : "Operador"}
                        </span>
                        {!u.active && <span className="status-badge status-erro text-[10px]">inativo</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {u.email}</span>
                        {u.cargo && <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" /> {u.cargo}</span>}
                        {u.telefone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {u.telefone}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Desde {formatDateTime(u.createdAt)}
                      </p>
                      {showResetOverlay && (
                        <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-xs">
                          <KeyRound className="h-3 w-3" /> Nova senha:
                          <code className="font-mono bg-white px-2 py-0.5 rounded">{resetSenha!.senha}</code>
                          <button onClick={() => copiar(resetSenha!.senha)} className="text-amber-700 hover:underline">copiar</button>
                          <button onClick={() => setResetSenha(null)} className="text-amber-700 hover:underline ml-auto">ok</button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEdicao({
                          id: u.id, nome: u.nome, email: u.email, role: u.role,
                          cargo: u.cargo ?? "", telefone: u.telefone ?? "", active: u.active,
                        })}
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => resetar(u.id)}>
                        <KeyRound className="h-3 w-3" /> Resetar senha
                      </Button>
                      <Button
                        variant={u.active ? "ghost" : "secondary"}
                        size="sm"
                        onClick={() => toggleAtivo(u.id, u.active)}
                        disabled={eu}
                      >
                        {u.active ? <><XCircle className="h-3 w-3 text-destructive" /> Desativar</>
                          : <><CheckCircle2 className="h-3 w-3 text-cestacorp-green" /> Reativar</>}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
