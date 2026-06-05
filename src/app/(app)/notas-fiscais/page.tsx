import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft, AlertCircle, FileSignature, ArrowRight } from "lucide-react";

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

      {/* Patrick (13/06): "podemos adaptar pra renomear PDFs de notas fiscais?" */}
      <Card className="border-cestacorp-blue/30 bg-gradient-to-br from-cestacorp-blue/5 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-cestacorp-blue">
            <FileSignature className="h-5 w-5" /> Renomear PDFs em lote
          </CardTitle>
          <CardDescription>
            Sobe vários PDFs de NF, sistema identifica o tomador + data via OCR e devolve um ZIP
            renomeado pra <code>NOME COMPLETO DO TOMADOR DDMMAAAA.pdf</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/notas-fiscais/renomear">
              <FileSignature className="h-4 w-4" /> Renomear lote de PDFs
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-amber-300 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <AlertCircle className="h-5 w-5" /> Importação XML em revisão
          </CardTitle>
          <CardDescription className="text-amber-800">
            A importação de XML (NF-e) está temporariamente desativada enquanto a equipe revisa o parser
            pra NFS-e dos clientes. Volta em breve.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-amber-900">
          <p>
            Se precisa importar uma nota agora pra um caso urgente, fale com o time técnico — temos um
            script CLI manual.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
