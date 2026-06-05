import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, UserCircle2 } from "lucide-react";
import { PortalClienteClient } from "./PortalClienteClient";

export const dynamic = "force-dynamic";

export default async function PortalClientePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session.user as any)?.role;
  if (role !== "ADMIN" && role !== "GESTOR" && role !== "EQUIPE") {
    redirect("/configuracoes");
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <Link
        href="/configuracoes"
        className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Configurações
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <UserCircle2 className="h-7 w-7" /> Portal do Cliente — Acessos
        </h1>
        <p className="text-muted-foreground">
          Gere ou renove convites de acesso ao portal do cliente.
          Funciona <strong>sem depender do SMTP</strong> — o link aparece na tela
          pra você copiar e mandar pelo WhatsApp.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como usar</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1.5 text-muted-foreground">
          <p>• <strong>Verde</strong> = cliente com acesso ativo (já criou senha)</p>
          <p>• <strong>Amarelo</strong> = convite pendente (link ativo, cliente ainda não criou senha)</p>
          <p>• <strong>Cinza</strong> = sem nenhum acesso ainda</p>
          <p>
            • Clique em <em>Gerar link</em> em qualquer cliente — o link aparece em popup
            com botão Copiar. Cola no WhatsApp e manda pro contato dele.
          </p>
          <p>• Link vale 7 dias. Depois disso, gere de novo.</p>
        </CardContent>
      </Card>

      <PortalClienteClient />
    </div>
  );
}
