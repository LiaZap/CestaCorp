"use client";
import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(sp.get("erro"));
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErro(null);
    const res = await signIn("cliente", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setErro("E-mail ou senha inválidos.");
    else router.push("/portal");
  }

  return (
    <div className="max-w-md mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-cestacorp-blue">Acesse sua conta</CardTitle>
          <CardDescription>Portal do cliente Cestacorp</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Senha</Label>
              <Input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>

          {/* Login social removido — Cestacorp prefere fluxo direto e-mail/senha pra evitar erros de procuração/certificado. */}

          <p className="text-center text-sm text-muted-foreground mt-4">
            <Link href="/portal/esqueci-senha" className="hover:text-primary">Esqueci minha senha</Link>
          </p>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground mt-4">
        Ainda não tem acesso? Entre em contato com a Cestacorp.
      </p>
    </div>
  );
}

export default function PortalLogin() {
  return (
    <Suspense fallback={<p className="text-center py-10 text-muted-foreground">Carregando…</p>}>
      <Inner />
    </Suspense>
  );
}
