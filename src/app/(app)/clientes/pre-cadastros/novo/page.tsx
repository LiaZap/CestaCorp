import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { PreCadastroForm } from "../PreCadastroForm";

export default function NovoPreCadastroPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/clientes/pre-cadastros" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Pré-cadastros
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <UserPlus className="h-7 w-7" /> Novo pré-cadastro
        </h1>
        <p className="text-muted-foreground">
          Comercial fechou venda. A empresa ainda não tem CNPJ — registre o que sabe agora,
          o resto preenchemos quando a Receita aprovar.
        </p>
      </div>

      <PreCadastroForm />
    </div>
  );
}
