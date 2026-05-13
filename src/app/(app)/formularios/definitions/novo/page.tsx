import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { FormBuilder } from "../FormBuilder";

export default function NovoFormularioPage() {
  return (
    <div className="space-y-6">
      <Link href="/formularios/definitions" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Formulários
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <ClipboardList className="h-7 w-7" /> Novo formulário
        </h1>
        <p className="text-muted-foreground">
          Construa o formulário visualmente. O preview à direita mostra como o cliente vai ver.
        </p>
      </div>

      <FormBuilder />
    </div>
  );
}
