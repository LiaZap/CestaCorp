import { ClienteForm } from "../ClienteForm";

export default function NovoClientePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-cestacorp-blue">Novo cliente</h1>
      <p className="text-muted-foreground">Cadastro manual. Dados complementares podem vir depois via formulários públicos.</p>
      <ClienteForm />
    </div>
  );
}
