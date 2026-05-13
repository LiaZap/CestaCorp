import { Check, CheckCheck } from "lucide-react";
import { Avatar } from "./Avatar";

export type ChatMessage = {
  id: string;
  text: string;
  direcao: "OUT" | "IN";
  status?: "ENVIANDO" | "ENVIADO" | "ENTREGUE" | "LIDA" | "ERRO" | "RECEBIDO";
  createdAt: Date | string;
  channel?: "WHATSAPP" | "EMAIL" | "SMS";
};

const STATUS_ICON: Record<string, { icon: any; className: string }> = {
  ENVIADO: { icon: Check, className: "text-slate-400" },
  ENTREGUE: { icon: CheckCheck, className: "text-slate-400" },
  LIDA: { icon: CheckCheck, className: "text-[#53bdeb]" },
  ENVIANDO: { icon: Check, className: "text-slate-300 animate-pulse" },
  ERRO: { icon: Check, className: "text-red-400" },
};

function formatHora(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDiaLabel(d: Date): string {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
  const dia = new Date(d); dia.setHours(0, 0, 0, 0);
  if (dia.getTime() === hoje.getTime()) return "HOJE";
  if (dia.getTime() === ontem.getTime()) return "ONTEM";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function agruparPorDia(msgs: ChatMessage[]) {
  const grupos: { dia: string; msgs: ChatMessage[] }[] = [];
  const sorted = [...msgs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const m of sorted) {
    const dia = formatDiaLabel(new Date(m.createdAt));
    const last = grupos[grupos.length - 1];
    if (last && last.dia === dia) last.msgs.push(m);
    else grupos.push({ dia, msgs: [m] });
  }
  return grupos;
}

export function WhatsAppChat({
  clienteNome,
  clienteTelefone,
  messages,
  title = "Conversa WhatsApp",
}: {
  clienteNome: string;
  clienteTelefone?: string;
  messages: ChatMessage[];
  title?: string;
}) {
  const grupos = agruparPorDia(messages);

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200 bg-[#efeae2] w-full max-w-md mx-auto lg:mx-0">
      {/* Header */}
      <div className="bg-[#008069] text-white px-4 py-3 flex items-center gap-3">
        <Avatar name={clienteNome} size="md" status="online" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{clienteNome}</p>
          <p className="text-xs opacity-80 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
            {clienteTelefone ?? "online agora"}
          </p>
        </div>
      </div>

      {/* Pattern bg */}
      <div
        className="p-3 min-h-[200px] max-h-[480px] overflow-y-auto space-y-2"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cg fill='%23000' fill-opacity='0.03'%3E%3Cpath d='M16 4l2 5 5 1-4 4 1 5-4-2-4 2 1-5-4-4 5-1z'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {messages.length === 0 && (
          <p className="text-center text-xs text-slate-500 bg-white/80 rounded-full px-3 py-1 w-fit mx-auto mt-16">
            Sem mensagens ainda
          </p>
        )}
        {grupos.map((g, gi) => (
          <div key={gi} className="space-y-1.5">
            <p className="text-[10px] text-center text-slate-500 bg-white/85 rounded-full px-3 py-0.5 w-fit mx-auto my-2 font-medium">
              {g.dia}
            </p>
            {g.msgs.map((m) => {
              const isOut = m.direcao === "OUT";
              const s = m.status ?? (isOut ? "ENVIADO" : "RECEBIDO");
              const Icon = STATUS_ICON[s]?.icon;
              return (
                <div key={m.id} className={isOut ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      "relative max-w-[85%] rounded-lg px-3 py-2 shadow-sm " +
                      (isOut ? "bg-[#d9fdd3] rounded-tr-none" : "bg-white rounded-tl-none")
                    }
                  >
                    <p className="text-[13px] text-slate-900 whitespace-pre-wrap break-words leading-relaxed">
                      {m.text}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-slate-500">{formatHora(new Date(m.createdAt))}</span>
                      {isOut && Icon && <Icon className={"h-3 w-3 " + (STATUS_ICON[s]?.className ?? "")} />}
                    </div>
                    {/* cauda */}
                    <div
                      className={
                        "absolute top-0 w-0 h-0 border-t-0 border-b-[8px] border-b-transparent " +
                        (isOut
                          ? "-right-1.5 border-r-0 border-l-[8px] border-l-[#d9fdd3]"
                          : "-left-1.5 border-l-0 border-r-[8px] border-r-white")
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="bg-white px-3 py-2 text-[10px] text-slate-400 text-center border-t">
        {messages.length} mensagem{messages.length !== 1 ? "s" : ""} · integração DIGISAC
      </div>
    </div>
  );
}
