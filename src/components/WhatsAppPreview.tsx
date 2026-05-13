"use client";
import { Check, CheckCheck } from "lucide-react";
import { renderTemplate } from "@/lib/services/templating";

type SampleData = {
  cliente: { razaoSocial: string; nomeFantasia?: string; cpfCnpj: string };
  cobranca: {
    descricao: string;
    valor: number;
    vencimento: Date;
    linhaDigitavel?: string;
    urlBoleto?: string;
    pixCopiaCola?: string;
  };
};

const DEFAULT_SAMPLE: SampleData = {
  cliente: { razaoSocial: "TechNova Soluções em TI LTDA", nomeFantasia: "TechNova", cpfCnpj: "34.567.890/0001-12" },
  cobranca: {
    descricao: "Honorários abril/2026",
    valor: 1850,
    vencimento: (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d; })(),
    linhaDigitavel: "34191.79001 01043.510047 91020.150008 1 92230000018500",
    urlBoleto: "https://cestacorp.com.br/b/demo",
    pixCopiaCola: "00020126580014br.gov.bcb.pix...",
  },
};

export function WhatsAppPreview({
  template,
  canal = "WHATSAPP",
  sample = DEFAULT_SAMPLE,
  label,
}: {
  template: string;
  canal?: "WHATSAPP" | "EMAIL" | "SMS";
  sample?: SampleData;
  label?: string;
}) {
  const rendered = renderTemplate(template, { ...sample, hoje: new Date() });
  const horario = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (canal === "EMAIL") {
    return (
      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <div className="bg-slate-100 px-4 py-2 text-xs text-slate-600 border-b">
          {label && <p className="font-semibold mb-1">{label}</p>}
          <p><b>Para:</b> {sample.cliente.razaoSocial.toLowerCase().replace(/[^a-z]/g, "")}@email.com</p>
          <p><b>Assunto:</b> Cestacorp — Lembrete de cobrança</p>
        </div>
        <div className="p-4 text-sm whitespace-pre-wrap font-sans text-slate-800">
          {rendered || <span className="text-slate-400 italic">digite o template acima…</span>}
        </div>
      </div>
    );
  }

  // WhatsApp visual
  return (
    <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200 bg-[#efeae2] max-w-sm mx-auto">
      {/* Header WhatsApp */}
      <div className="bg-[#008069] text-white px-4 py-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-base font-bold">
          {sample.cliente.razaoSocial.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{sample.cliente.nomeFantasia ?? sample.cliente.razaoSocial}</p>
          <p className="text-xs opacity-80">online agora</p>
        </div>
      </div>

      {/* Background com pattern */}
      <div
        className="p-4 min-h-[180px] relative"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cg fill='%23000' fill-opacity='0.03'%3E%3Cpath d='M16 4l2 5 5 1-4 4 1 5-4-2-4 2 1-5-4-4 5-1z'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {label && (
          <p className="text-[10px] text-center text-slate-500 bg-white/80 rounded-full px-2 py-0.5 w-fit mx-auto mb-3">
            {label}
          </p>
        )}

        {/* Balão da mensagem */}
        <div className="flex justify-end">
          <div className="relative bg-[#d9fdd3] rounded-lg rounded-tr-none px-3 py-2 max-w-[85%] shadow-sm">
            <p className="text-sm text-slate-900 whitespace-pre-wrap break-words leading-relaxed">
              {rendered || <span className="text-slate-400 italic">digite o template acima…</span>}
            </p>
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-[10px] text-slate-500">{horario}</span>
              <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
            </div>
            {/* Cauda do balão */}
            <div className="absolute -right-1.5 top-0 w-0 h-0 border-t-0 border-r-0 border-b-[8px] border-l-[8px] border-b-transparent border-l-[#d9fdd3]" />
          </div>
        </div>
      </div>

      {/* Footer fake */}
      <div className="bg-white px-3 py-2 text-[10px] text-slate-400 text-center border-t">
        Preview · dados do cliente <b>{sample.cliente.nomeFantasia ?? "Exemplo"}</b>
      </div>
    </div>
  );
}
