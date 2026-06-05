import { RenomearLoteClient } from "./RenomearLoteClient";
import Link from "next/link";
import { ArrowLeft, FileSignature } from "lucide-react";

export const dynamic = "force-dynamic";

export default function RenomearNotasPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/notas-fiscais" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Notas Fiscais
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <FileSignature className="h-7 w-7" /> Renomear PDFs de Nota Fiscal
        </h1>
        <p className="text-muted-foreground">
          Sobe um lote de PDFs, identifica o tomador + data de emissão via OCR
          e devolve um <code>.zip</code> com os arquivos renomeados pra{" "}
          <code className="font-mono text-sm">NOME COMPLETO DO TOMADOR DDMMAAAA.pdf</code>.
        </p>
      </div>

      <RenomearLoteClient />
    </div>
  );
}
