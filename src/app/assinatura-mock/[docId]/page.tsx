import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { FileSignature, CheckCircle2, ShieldCheck } from "lucide-react";
import { formatarDocumento } from "@/lib/security/documento";

export const dynamic = "force-dynamic";

async function assinar(formData: FormData) {
  "use server";
  const contratoId = String(formData.get("contratoId"));
  await prisma.contrato.update({
    where: { id: contratoId },
    data: {
      assinaturaStatus: "ASSINADO",
      assinaturaAssinadoEm: new Date(),
      status: "ASSINADO",
      dataAssinatura: new Date(),
    },
  });
}

export default async function AssinaturaMockPage({
  params, searchParams,
}: { params: { docId: string }; searchParams: { contrato?: string } }) {
  const contratoId = searchParams.contrato;
  const contrato = contratoId
    ? await prisma.contrato.findUnique({ where: { id: contratoId }, include: { cliente: true } })
    : null;

  if (!contrato) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md"><CardContent className="pt-6">Documento não encontrado.</CardContent></Card>
      </div>
    );
  }

  const assinantes = Array.isArray(contrato.assinaturaAssinantes) ? (contrato.assinaturaAssinantes as any[]) : [];

  return (
    <div className="min-h-screen cesta-mesh py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Logo size="md" />
          <span className="text-xs text-muted-foreground bg-white px-3 py-1 rounded-full border">modo simulado</span>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cestacorp-blue to-cestacorp-green text-white mb-3">
              <FileSignature className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Assinatura do contrato</CardTitle>
            <CardDescription>
              Cliente: <b>{contrato.cliente.razaoSocial}</b> · Contrato nº {contrato.numero ?? contrato.id.slice(0, 8)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {contrato.assinaturaStatus === "ASSINADO" ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-5 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
                <p className="font-semibold text-emerald-800">Contrato assinado!</p>
                <p className="text-sm text-emerald-700">
                  A equipe Cestacorp foi notificada. Você receberá o PDF final por e-mail.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
                  <p className="font-semibold mb-1">Contrato de Prestação de Serviços Contábeis</p>
                  <p className="text-xs">
                    Objeto: prestação de serviços contábeis, fiscais e tributários conforme legislação vigente.
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-muted-foreground tracking-wider mb-2">Assinantes</p>
                  <ul className="space-y-1.5 text-sm">
                    {assinantes.map((s, i) => (
                      <li key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium">{s.nome}</p>
                          <p className="text-xs text-muted-foreground">{s.email}{s.cpf && <> · {formatarDocumento(s.cpf)}</>}</p>
                        </div>
                        <span className="status-badge status-pendente text-[10px]">AGUARDANDO</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 border rounded p-3">
                  <ShieldCheck className="h-4 w-4 text-cestacorp-green shrink-0" />
                  Ao clicar em <b>Assinar</b>, você concorda com os termos do contrato. O documento será validado
                  conforme Lei 14.063/2020 (assinatura eletrônica).
                </div>

                <form action={assinar}>
                  <input type="hidden" name="contratoId" value={contrato.id} />
                  <Button type="submit" size="lg" className="w-full bg-gradient-to-r from-cestacorp-blue to-cestacorp-green hover:opacity-90">
                    <FileSignature className="h-4 w-4" /> Assinar eletronicamente
                  </Button>
                </form>

                <p className="text-xs text-center text-muted-foreground pt-2">
                  Em produção essa tela é do <b>Autentique</b> ou <b>ClickSign</b>. Esta é uma versão simulada.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
