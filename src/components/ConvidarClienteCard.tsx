"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, CheckCircle2, Clock, Mail } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type Acesso = {
  id: string;
  email: string;
  nome: string;
  ativo: boolean;
  ultimoAcesso?: string | null;
  tokenConvite?: string | null;
  tokenConviteExpira?: string | null;
  createdAt: string;
};

export function ConvidarClienteCard({ clienteId, emailSugerido }: { clienteId: string; emailSugerido?: string }) {
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [email, setEmail] = useState(emailSugerido ?? "");
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function carregar() {
    const r = await fetch(`/api/clientes/${clienteId}/convite`);
    if (r.ok) setAcessos(await r.json());
  }
  useEffect(() => { carregar(); }, [clienteId]);

  async function convidar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setMsg(null);
    const res = await fetch(`/api/clientes/${clienteId}/convite`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, nome }),
    });
    setEnviando(false);
    if (res.ok) {
      setMsg("Convite enviado por e-mail.");
      setEmail(""); setNome("");
      carregar();
    } else {
      setMsg("Falha ao enviar.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Portal do cliente</CardTitle>
        <CardDescription>Convide o cliente a acessar /portal — recebe e-mail com link de 1º acesso válido por 7 dias</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={convidar} className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>E-mail</Label>
            <div className="flex gap-2">
              <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" disabled={enviando || !email || !nome}>
                <Mail className="h-4 w-4" /> Convidar
              </Button>
            </div>
          </div>
        </form>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

        {acessos.length > 0 && (
          <ul className="divide-y pt-2 border-t text-sm">
            {acessos.map((a) => {
              const pendente = Boolean(a.tokenConvite);
              return (
                <li key={a.id} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{a.nome}</p>
                    <p className="text-xs text-muted-foreground">{a.email}</p>
                  </div>
                  <div className="text-right text-xs">
                    {pendente ? (
                      <span className="status-badge status-pendente"><Clock className="h-3 w-3 mr-1" /> Aguardando ativação</span>
                    ) : (
                      <span className="status-badge status-pago">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Ativo
                      </span>
                    )}
                    {a.ultimoAcesso && (
                      <p className="text-muted-foreground mt-0.5">Último acesso: {formatDateTime(a.ultimoAcesso)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
