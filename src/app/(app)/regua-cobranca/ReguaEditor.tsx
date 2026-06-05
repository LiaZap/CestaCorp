"use client";
import { useState, useRef, createRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Eye } from "lucide-react";
import { WhatsAppPreview } from "@/components/WhatsAppPreview";
import { TemplateLibrary } from "@/components/TemplateLibrary";
import { PlaceholderPicker } from "@/components/PlaceholderPicker";

export type PassoInput = {
  id?: string;
  nome: string;
  offsetDias: number;
  canal: "WHATSAPP" | "EMAIL" | "SMS";
  templateMsg: string;
  horarioEnvio: string;
  soDiasUteis: boolean;
};

export type ReguaInput = {
  id?: string;
  nome: string;
  descricao?: string;
  ativa: boolean;
  passos: PassoInput[];
};

export const PASSOS_PADRAO: PassoInput[] = [
  { nome: "Lembrete 3 dias antes", offsetDias: -3, canal: "WHATSAPP", horarioEnvio: "09:00", soDiasUteis: true,
    templateMsg: "Olá {cliente.razaoSocial}, aqui é da Cestacorp. 👋\nLembrete: seu boleto de {cobranca.descricao} vence em {cobranca.vencimento|date} no valor de {cobranca.valor|money}.\nPix/linha: {cobranca.linhaDigitavel}\nQualquer dúvida estamos à disposição." },
  { nome: "No dia do vencimento", offsetDias: 0, canal: "WHATSAPP", horarioEnvio: "09:00", soDiasUteis: false,
    templateMsg: "Bom dia, {cliente.razaoSocial}! O boleto de {cobranca.valor|money} vence HOJE ({cobranca.vencimento|date}).\nBoleto: {cobranca.urlBoleto}" },
  { nome: "1 dia em atraso", offsetDias: 1, canal: "WHATSAPP", horarioEnvio: "10:00", soDiasUteis: true,
    templateMsg: "{cliente.razaoSocial}, identificamos que o boleto de {cobranca.descricao} venceu em {cobranca.vencimento|date} e ainda consta em aberto.\n\n💰 Valor atualizado hoje: *{cobranca.valorAtualizado|money}*\n   (bruto {cobranca.valor|money} + multa/juros · {cobranca.diasAtraso} dia)\n\nPix copia-cola: {cobranca.pixCopiaCola}\nBoleto: {cobranca.urlBoleto}\n\nSe já pagou, por favor desconsidere." },
  { nome: "7 dias em atraso", offsetDias: 7, canal: "WHATSAPP", horarioEnvio: "10:00", soDiasUteis: true,
    templateMsg: "Olá {cliente.razaoSocial}, o boleto de {cobranca.descricao} está com {cobranca.diasAtraso} dias de atraso.\n\n💰 Valor bruto: {cobranca.valor|money}\n➕ Multa + juros: {cobranca.multa|money} + {cobranca.juros|money}\n✅ *Valor atualizado hoje: {cobranca.valorAtualizado|money}*\n\nPix copia-cola: {cobranca.pixCopiaCola}\nBoleto: {cobranca.urlBoleto}\n\nPrecisamos regularizar — responda esta mensagem para conversarmos." },
];

export function ReguaEditor({ initial, onSaved }: { initial?: ReguaInput; onSaved?: () => void }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [r, setR] = useState<ReguaInput>(initial ?? {
    nome: "Régua Padrão Cestacorp",
    descricao: "",
    ativa: true,
    passos: PASSOS_PADRAO,
  });
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // refs para cada textarea de passo (para inserção no cursor)
  const textareaRefs = useRef<Record<number, React.RefObject<HTMLTextAreaElement>>>({});
  function getRef(idx: number) {
    if (!textareaRefs.current[idx]) {
      textareaRefs.current[idx] = createRef<HTMLTextAreaElement>();
    }
    return textareaRefs.current[idx];
  }

  function updatePasso(idx: number, patch: Partial<PassoInput>) {
    setR((s) => ({ ...s, passos: s.passos.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));
  }
  function addPasso() {
    setR((s) => ({
      ...s,
      passos: [...s.passos, { nome: "Novo passo", offsetDias: 0, canal: "WHATSAPP", templateMsg: "", horarioEnvio: "09:00", soDiasUteis: true }],
    }));
  }
  function removerPasso(idx: number) {
    setR((s) => ({ ...s, passos: s.passos.filter((_, i) => i !== idx) }));
  }

  async function salvar() {
    setSalvando(true); setErro(null);
    const res = await fetch(isEdit ? `/api/reguas/${r.id}` : "/api/reguas", {
      method: isEdit ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(r),
    });
    setSalvando(false);
    if (!res.ok) { setErro("Erro ao salvar"); return; }
    onSaved?.();
    router.push("/regua-cobranca");
    router.refresh();
  }

  async function excluir() {
    if (!isEdit) return;
    if (!confirm("Excluir esta régua? Execuções já geradas serão preservadas como histórico.")) return;
    setRemovendo(true);
    const res = await fetch(`/api/reguas/${r.id}`, { method: "DELETE" });
    setRemovendo(false);
    if (res.ok) {
      router.push("/regua-cobranca");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader><CardTitle>Informações gerais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={r.nome} onChange={(e) => setR({ ...r, nome: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={r.descricao ?? ""} onChange={(e) => setR({ ...r, descricao: e.target.value })} placeholder="Opcional" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={r.ativa} onChange={(e) => setR({ ...r, ativa: e.target.checked })} />
            Régua ativa (quando pausada, nenhum passo novo é agendado)
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Passos</CardTitle>
          <CardDescription>
            Cada passo vira uma mensagem automática. Use os botões abaixo de cada template para
            inserir placeholders (ex.: nome do cliente, valor, vencimento) com 1 clique.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {r.passos.map((p, idx) => (
            <div key={idx} className="border rounded-md p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Passo {idx + 1}</h3>
                <Button variant="ghost" size="icon" onClick={() => removerPasso(idx)} aria-label={`Remover passo ${idx + 1}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <Label>Nome</Label>
                  <Input value={p.nome} onChange={(e) => updatePasso(idx, { nome: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Offset (dias)</Label>
                  <Input type="number" value={p.offsetDias} onChange={(e) => updatePasso(idx, { offsetDias: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label>Canal</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={p.canal}
                    onChange={(e) => updatePasso(idx, { canal: e.target.value as any })}
                  >
                    <option value="WHATSAPP">WhatsApp (Digisac)</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="SMS">SMS</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Horário</Label>
                  <Input value={p.horarioEnvio} onChange={(e) => updatePasso(idx, { horarioEnvio: e.target.value })} placeholder="09:00" />
                </div>
                <div className="space-y-1 flex items-end gap-2">
                  <input
                    id={`du-${idx}`}
                    type="checkbox"
                    checked={p.soDiasUteis}
                    onChange={(e) => updatePasso(idx, { soDiasUteis: e.target.checked })}
                  />
                  <Label htmlFor={`du-${idx}`} className="mb-2">Só dias úteis</Label>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Template da mensagem</Label>
                    <TemplateLibrary onUse={(texto) => updatePasso(idx, { templateMsg: texto })} />
                  </div>
                  <textarea
                    ref={getRef(idx)}
                    className="w-full min-h-40 rounded-md border bg-background p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cestacorp-blue/30"
                    value={p.templateMsg}
                    onChange={(e) => updatePasso(idx, { templateMsg: e.target.value })}
                    placeholder="Escreva a mensagem. Clique nos botões abaixo para inserir placeholders."
                  />
                  <PlaceholderPicker
                    textareaRef={getRef(idx)}
                    value={p.templateMsg}
                    onChange={(novo) => updatePasso(idx, { templateMsg: novo })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2">
                    <Eye className="h-3 w-3" />
                    Preview ao vivo
                    <span className="text-[10px] text-muted-foreground font-normal">
                      (como o cliente vai ver)
                    </span>
                  </Label>
                  <WhatsAppPreview
                    template={p.templateMsg}
                    canal={p.canal}
                    label={`Passo ${idx + 1} · ${p.offsetDias === 0 ? "no dia" : p.offsetDias > 0 ? `${p.offsetDias}d após` : `${Math.abs(p.offsetDias)}d antes`} do vencimento`}
                  />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={addPasso}>
            <Plus className="h-4 w-4" /> Adicionar passo
          </Button>
        </CardContent>
      </Card>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="flex justify-between items-center gap-2">
        <div>
          {isEdit && (
            <Button variant="destructive" onClick={excluir} disabled={removendo}>
              <Trash2 className="h-4 w-4" /> {removendo ? "Excluindo…" : "Excluir régua"}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.back()}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}
