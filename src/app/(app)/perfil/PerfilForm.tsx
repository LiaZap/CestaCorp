"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/Avatar";
import { Check, Save } from "lucide-react";

type Initial = {
  name: string;
  email: string;
  cargo: string;
  telefone: string;
  avatarUrl: string;
};

export function PerfilForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setErro(null); setSucesso(false);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: f.name.trim(),
        email: f.email.trim().toLowerCase(),
        cargo: f.cargo.trim() || null,
        telefone: f.telefone.trim() || null,
        avatarUrl: f.avatarUrl.trim() || null,
      }),
    });
    setSalvando(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(j?.error ?? "erro ao salvar");
      return;
    }
    setSucesso(true);
    router.refresh();
    setTimeout(() => setSucesso(false), 3000);
  }

  const mudou =
    f.name !== initial.name ||
    f.email !== initial.email ||
    f.cargo !== initial.cargo ||
    f.telefone !== initial.telefone ||
    f.avatarUrl !== initial.avatarUrl;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados pessoais</CardTitle>
        <CardDescription>Essas informações aparecem no topo do sistema e nas mensagens que você envia</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="space-y-4">
          <div className="flex items-center gap-4 pb-2">
            {f.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.avatarUrl} alt={f.name} className="h-16 w-16 rounded-full object-cover border" />
            ) : (
              <Avatar name={f.name || "?"} size="lg" />
            )}
            <div className="flex-1 space-y-1">
              <Label>URL do avatar (opcional)</Label>
              <Input
                value={f.avatarUrl}
                onChange={(e) => setF({ ...f, avatarUrl: e.target.value })}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">Se vazio, mostramos as iniciais do nome em gradiente.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nome completo *</Label>
              <Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>E-mail *</Label>
              <Input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              <p className="text-[11px] text-muted-foreground">Ao trocar, use o novo no próximo login.</p>
            </div>
            <div className="space-y-1">
              <Label>Cargo</Label>
              <Input
                value={f.cargo}
                onChange={(e) => setF({ ...f, cargo: e.target.value })}
                placeholder="ex.: Contadora Sênior"
              />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input
                value={f.telefone}
                onChange={(e) => setF({ ...f, telefone: e.target.value })}
                placeholder="(51) 99999-9999"
              />
            </div>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}
          {sucesso && (
            <p className="text-sm text-emerald-700 flex items-center gap-1">
              <Check className="h-4 w-4" /> Perfil atualizado
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={!mudou || salvando}>
              <Save className="h-4 w-4" /> {salvando ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
