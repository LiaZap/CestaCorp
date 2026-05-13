import { ReguaEditor } from "../ReguaEditor";

export default function NovaReguaPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-cestacorp-blue">Nova Régua de Cobrança</h1>
      <p className="text-muted-foreground">Configure passos relativos ao vencimento. Negativo = antes, positivo = depois.</p>
      <ReguaEditor />
    </div>
  );
}
