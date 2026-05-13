"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, KeyRound, Check } from "lucide-react";

function avaliarForca(senha: string): { pct: number; label: string; color: string } {
  if (!senha) return { pct: 0, label: "—", color: "bg-slate-200" };
  let score = 0;
  if (senha.length >= 8) score++;
  if (senha.length >= 12) score++;
  if (/[A-Z]/.test(senha)) score++;
  if (/[a-z]/.test(senha)) score++;
  if (/[0-9]/.test(senha)) score++;
  if (/[^A-Za-z0-9]/.test(senha)) score++;

  if (score <= 2) return { pct: 25, label: "fraca", color: "bg-red-500" };
  if (score <= 4) return { pct: 55, label: "média", color: "bg-amber-500" };
  if (score <= 5) return { pct: 80, label: "boa", color: "bg-emerald-500" };
  return { pct: 100, label: "forte", color: "bg-emerald-600" };
}

export function TrocarSenhaForm() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [novaConf, setNovaConf] = useState("");
  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const forca = avaliarForca(nova);
  const naoBatem = nova && novaConf && nova !== novaConf;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (nova !== novaConf) return;
    setSalvando(true); setErro(null); setSucesso(false);
    const res = await fetch("/api/me/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ senhaAtual: atual, senhaNova: nova }),
    });
    setSalvando(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(j?.error ?? "erro");
      return;
    }
    setSucesso(true);
    setAtual(""); setNova(""); setNovaConf("");
    setTimeout(() => setSucesso(false), 4000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" /> Trocar senha
        </CardTitle>
        <CardDescription>
          Mínimo 8 caracteres, com maiúscula, minúscula e número
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4 max-w-md">
          <div className="space-y-1">
            <Label>Senha atual</Label>
            <div className="relative">
              <Input
                required
                type={showAtual ? "text" : "password"}
                value={atual}
                onChange={(e) => setAtual(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowAtual((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showAtual ? "Esconder" : "Mostrar"}
              >
                {showAtual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Nova senha</Label>
            <div className="relative">
              <Input
                required
                type={showNova ? "text" : "password"}
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowNova((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showNova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {nova && (
              <div className="space-y-1 mt-1">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${forca.color} transition-all`} style={{ width: `${forca.pct}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Força: <span className="font-semibold">{forca.label}</span>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Confirmar nova senha</Label>
            <Input
              required
              type={showNova ? "text" : "password"}
              value={novaConf}
              onChange={(e) => setNovaConf(e.target.value)}
            />
            {naoBatem && <p className="text-xs text-destructive">As senhas não conferem.</p>}
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}
          {sucesso && (
            <p className="text-sm text-emerald-700 flex items-center gap-1">
              <Check className="h-4 w-4" /> Senha atualizada com sucesso
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={salvando || !atual || !nova || nova !== novaConf || nova.length < 8}>
              {salvando ? "Salvando…" : "Atualizar senha"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
