import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Módulo de Notas Fiscais está em revisão (#12 — desativar NF-e).
 * A página completa fica acessível pela URL pra quem testar manualmente,
 * mas o item do sidebar foi removido em src/components/Sidebar.tsx e
 * src/components/sidebar-items.ts.
 *
 * A listagem antiga (com totais por tipo + tabela de notas) está preservada
 * nos commits anteriores — basta restaurar este arquivo via git pra retomar.
 */
export default function NotasFiscaisPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2 mt-2">
          <FileText className="h-7 w-7" /> Notas Fiscais
        </h1>
        <p className="text-muted-foreground">Importação e consulta de NF-e dos clientes</p>
      </div>

      <Card className="border-amber-300 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <AlertCircle className="h-5 w-5" /> Módulo em revisão
          </CardTitle>
          <CardDescription className="text-amber-800">
            O módulo de Notas Fiscais está temporariamente desativado enquanto a equipe revisa o parser
            de XML e a vinculação com clientes. Volta em breve.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-amber-900">
          <p>
            Se precisa importar uma nota agora pra um caso urgente, fale com o time técnico — temos um
            script CLI manual.
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard">Voltar pro dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
