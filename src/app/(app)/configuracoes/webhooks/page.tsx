import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Webhook, CheckCircle2, AlertTriangle, XCircle, Copy } from "lucide-react";
import { WebhooksHealthClient } from "./WebhooksHealthClient";

export const dynamic = "force-dynamic";

export default async function WebhooksHealthPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user?.role !== "ADMIN" && session.user?.role !== "GESTOR") {
    redirect("/configuracoes");
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/configuracoes"
        className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Configurações
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <Webhook className="h-7 w-7" /> Saúde dos Webhooks
        </h1>
        <p className="text-muted-foreground">
          Confirma que os 3 webhooks externos (NIBO, Digisac, Autentique) estão
          configurados, recebendo eventos e com secret válido. Use depois de
          rotacionar secrets ou trocar URL no EasyPanel.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como ler os status</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1.5">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span><strong>OK:</strong> secret configurado e evento recebido nas últimas 24h.</span>
          </p>
          <p className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>
              <strong>Atenção:</strong> secret configurado mas nenhum evento recente — pode estar normal
              (sem atividade) ou plataforma externa esqueceu da URL.
            </span>
          </p>
          <p className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <span>
              <strong>Erro:</strong> secret faltando no EasyPanel — o endpoint está bloqueado (503)
              e qualquer evento real está sendo recusado.
            </span>
          </p>
        </CardContent>
      </Card>

      <WebhooksHealthClient />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Testar manualmente</CardTitle>
          <CardDescription>
            No painel da plataforma externa, use o botão "Enviar webhook de teste".
            Resposta esperada quando tudo está OK: HTTP 200. Se vier 401, a assinatura
            do secret está errada (provavelmente desincronizou EasyPanel × plataforma).
            Se vier 503, o secret está faltando no EasyPanel.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
