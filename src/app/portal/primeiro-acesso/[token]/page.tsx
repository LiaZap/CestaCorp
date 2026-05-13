"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PrimeiroAcesso({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) return setErro("Senha deve ter pelo menos 8 caracteres.");
    if (senha !== confirmar) return setErro("Senhas não conferem.");
    setLoading(true);
    const res = await fetch("/api/portal/auth/ativar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: params.token, senha }),
    });
    const json = await res.json();
    setLoading(false);
    if (res.ok) {
      setOk(true);
      setTimeout(() => router.push("/portal/login"), 2000);
    } else {
      setErro(json.error || "Erro ao ativar acesso");
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-cestacorp-blue">Crie sua senha</CardTitle>
          <CardDescription>Primeiro acesso ao portal Cestacorp</CardDescription>
        </CardHeader>
        <CardContent>
          {ok ? (
            <div className="rounded-md bg-green-50 p-4 text-center">
              <p className="font-medium text-green-800">Senha criada com sucesso! 🎉</p>
              <p className="text-sm text-green-700 mt-1">Redirecionando para o login…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1">
                <Label>Nova senha (mínimo 8 caracteres)</Label>
                <Input required type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Confirmar senha</Label>
                <Input required type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
              </div>
              {erro && <p className="text-sm text-destructive">{erro}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Criando…" : "Criar senha e acessar"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
