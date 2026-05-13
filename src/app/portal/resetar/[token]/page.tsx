"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetarSenha({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) return setErro("Senha deve ter pelo menos 8 caracteres.");
    if (senha !== conf) return setErro("Senhas não conferem.");
    setLoading(true);
    const res = await fetch("/api/portal/auth/resetar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: params.token, senha }),
    });
    setLoading(false);
    const json = await res.json();
    if (res.ok) router.push("/portal/login?reset=1");
    else setErro(json.error || "Erro ao redefinir");
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader><CardTitle>Defina sua nova senha</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <Label>Nova senha</Label>
              <Input required type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Confirmar senha</Label>
              <Input required type="password" value={conf} onChange={(e) => setConf(e.target.value)} />
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Salvando…" : "Salvar nova senha"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
