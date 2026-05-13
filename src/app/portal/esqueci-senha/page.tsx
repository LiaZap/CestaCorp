"use client";
import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/portal/auth/esqueci-senha", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setOk(true);
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-cestacorp-blue">Redefinir senha</CardTitle>
          <CardDescription>Enviaremos um link para seu e-mail.</CardDescription>
        </CardHeader>
        <CardContent>
          {ok ? (
            <div className="rounded-md bg-blue-50 p-4 text-sm">
              <p>Se o e-mail estiver cadastrado, você receberá instruções em instantes.</p>
              <p className="mt-2"><Link href="/portal/login" className="text-primary hover:underline">Voltar ao login</Link></p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1">
                <Label>E-mail cadastrado</Label>
                <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando…" : "Enviar link de redefinição"}
              </Button>
              <p className="text-sm text-center">
                <Link href="/portal/login" className="text-muted-foreground hover:text-primary">Voltar</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
