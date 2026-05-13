"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Library, X, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export type TemplateEntry = {
  id: string;
  categoria: "Cobrança" | "Relacionamento" | "Obrigações" | "Documentos" | "Onboarding";
  titulo: string;
  descricao: string;
  texto: string;
  tags?: string[];
};

export const TEMPLATES_BIBLIOTECA: TemplateEntry[] = [
  // ——— Cobrança ———
  {
    id: "cb-antes-3d",
    categoria: "Cobrança",
    titulo: "Lembrete 3 dias antes",
    descricao: "Mensagem amigável antes do vencimento",
    tags: ["WhatsApp", "pré-vencimento"],
    texto: `Olá {cliente.razaoSocial}! 👋

Passando para lembrar: seu boleto de {cobranca.descricao} vence em {cobranca.vencimento|date}, no valor de {cobranca.valor|money}.

Para adiantar, o PIX copia-e-cola é:
{cobranca.pixCopiaCola}

Qualquer dúvida estamos por aqui 💙
Equipe Cestacorp`,
  },
  {
    id: "cb-dia",
    categoria: "Cobrança",
    titulo: "No dia do vencimento",
    descricao: "Aviso no dia, tom neutro",
    tags: ["WhatsApp", "D-0"],
    texto: `Bom dia, {cliente.razaoSocial}! ☀️

Só para avisar que seu boleto de {cobranca.valor|money} vence HOJE ({cobranca.vencimento|date}).

Boleto em PDF: {cobranca.urlBoleto}
PIX: {cobranca.pixCopiaCola}

Obrigado pela parceria 🙏`,
  },
  {
    id: "cb-1d-atraso",
    categoria: "Cobrança",
    titulo: "1 dia em atraso",
    descricao: "Tom cordial, assume que pode ter esquecido",
    tags: ["WhatsApp", "leve"],
    texto: `{cliente.razaoSocial}, tudo bem?

Notamos que o boleto de {cobranca.valor|money} venceu ontem ({cobranca.vencimento|date}) e ainda consta em aberto no sistema.

Se você já pagou, por favor desconsidere esta mensagem 🙂
Se precisar de uma 2ª via ou renegociação, fala com a gente!`,
  },
  {
    id: "cb-7d-atraso",
    categoria: "Cobrança",
    titulo: "7 dias em atraso",
    descricao: "Tom mais firme, convite para conversar",
    tags: ["WhatsApp", "firme"],
    texto: `Olá {cliente.razaoSocial},

Estou entrando em contato porque o boleto de {cobranca.valor|money} venceu em {cobranca.vencimento|date} e está com 7 dias de atraso.

Precisamos regularizar essa pendência. Me responde esta mensagem para conversarmos sobre as opções de pagamento.

Equipe Cestacorp 💙💚`,
  },
  {
    id: "cb-obrigado",
    categoria: "Cobrança",
    titulo: "Obrigado pelo pagamento",
    descricao: "Confirmação após pagamento recebido",
    tags: ["WhatsApp", "pós-pagto"],
    texto: `Ebaaa! 🎉

{cliente.razaoSocial}, confirmamos o recebimento do seu pagamento de {cobranca.valor|money} referente a {cobranca.descricao}.

Muito obrigado pela parceria, é um prazer ter vocês! 💙

Equipe Cestacorp`,
  },
  {
    id: "cb-atualizado",
    categoria: "Cobrança",
    titulo: "Cobrança atualizada (juros + multa)",
    descricao: "Mostra valor bruto e atualizado com multa e juros",
    tags: ["WhatsApp", "atualizado"],
    texto: `Olá {cliente.razaoSocial}, tudo bem?

Identificamos que o boleto de {cobranca.descricao} está com {cobranca.diasAtraso} dia(s) de atraso.

💰 Valor bruto: {cobranca.valor|money}
➕ Multa + juros: {cobranca.multa|money} + {cobranca.juros|money}
✅ *Valor atualizado hoje: {cobranca.valorAtualizado|money}*

Pix copia-e-cola: {cobranca.pixCopiaCola}
Boleto: {cobranca.urlBoleto}

Qualquer dúvida, fala com a gente!`,
  },

  // ——— Relacionamento ———
  {
    id: "rel-aniversario",
    categoria: "Relacionamento",
    titulo: "Parabéns aniversariante",
    descricao: "Mensagem de aniversário",
    tags: ["WhatsApp", "relacionamento"],
    texto: `Olá {cliente.razaoSocial}! 🎉🎂

A equipe Cestacorp quer desejar um Feliz Aniversário cheio de sucesso, saúde e ótimos negócios!

Obrigado por confiar na gente para cuidar da parte contábil. Conte conosco sempre! 💙💚`,
  },
  {
    id: "rel-fim-ano",
    categoria: "Relacionamento",
    titulo: "Mensagem fim de ano",
    descricao: "Boas festas e retrospectiva",
    tags: ["WhatsApp", "fim-de-ano"],
    texto: `{cliente.razaoSocial}, que ano! 🎄✨

Obrigado por nos escolher mais um ano para cuidar da sua empresa. Desejamos um Feliz Natal e que 2027 traga muitos negócios fechados para vocês.

A Cestacorp estará em recesso de {{ data_inicio }} a {{ data_fim }}. Qualquer emergência: (51) 9xxxx-xxxx

Abraços, equipe toda 🎁`,
  },

  // ——— Obrigações ———
  {
    id: "obg-das-prox",
    categoria: "Obrigações",
    titulo: "DAS vencendo em 3 dias",
    descricao: "Aviso do Simples Nacional",
    tags: ["WhatsApp", "fiscal"],
    texto: `{cliente.razaoSocial}, lembrete importante! ⚠️

O DAS do Simples Nacional vence em 3 dias (dia 20).

A guia já está disponível no nosso sistema. Se quiser, enviamos agora por aqui.

Qualquer dúvida, a {{ resp_fiscal }} está à disposição 🙂`,
  },
  {
    id: "obg-defis",
    categoria: "Obrigações",
    titulo: "DEFIS — documentação",
    descricao: "Solicitar dados para declaração anual do SN",
    tags: ["WhatsApp", "anual"],
    texto: `Olá {cliente.razaoSocial}!

Chegou o período da DEFIS (Declaração de Informações Socioeconômicas e Fiscais) — o prazo vai até 31/03.

Precisamos que vocês nos enviem:
• Balanço de encerramento
• Número de funcionários em 31/12
• Ganhos de capital se houver

Qualquer dúvida, respondam aqui! 📑`,
  },
  {
    id: "obg-dirf",
    categoria: "Obrigações",
    titulo: "DIRF — coleta",
    descricao: "Solicitar informações para DIRF",
    tags: ["WhatsApp", "anual"],
    texto: `{cliente.razaoSocial},

Estamos preparando a DIRF 2026 (prazo até 28/02). Preciso dos seguintes dados de 2025:
• Rendimentos pagos a PF/PJ com retenção
• CPFs/CNPJs dos beneficiários
• Comprovantes de IRRF

Podem enviar por aqui mesmo ou por e-mail 📧`,
  },

  // ——— Documentos ———
  {
    id: "doc-solicitar",
    categoria: "Documentos",
    titulo: "Solicitar documentação pendente",
    descricao: "Quando falta documento para rodar competência",
    tags: ["WhatsApp", "documentos"],
    texto: `Olá {cliente.razaoSocial},

Para fechar a competência, ainda estão pendentes os seguintes documentos:
• Notas fiscais de serviço do mês
• Extrato bancário
• Comprovantes de despesas

Pode nos enviar até {{ prazo }}? Assim conseguimos entregar tudo no prazo 📂`,
  },
  {
    id: "doc-atualiza-cadastro",
    categoria: "Documentos",
    titulo: "Atualizar dados cadastrais",
    descricao: "Pedido de atualização de endereço/telefone",
    tags: ["WhatsApp", "cadastral"],
    texto: `{cliente.razaoSocial}, tudo bem?

Estamos atualizando nosso cadastro e percebemos que algumas informações podem estar desatualizadas. Pode confirmar pra gente:

• Endereço completo
• E-mail principal
• Telefone de contato
• Nome do responsável financeiro

Obrigado! Isso garante que nada se perca ✅`,
  },

  // ——— Onboarding ———
  {
    id: "on-bemvindo",
    categoria: "Onboarding",
    titulo: "Boas-vindas novo cliente",
    descricao: "Primeira mensagem pós-assinatura de contrato",
    tags: ["WhatsApp", "primeiro-contato"],
    texto: `Seja muito bem-vindo(a) à Cestacorp, {cliente.razaoSocial}! 🎉

Estamos muito felizes de ter você com a gente.

Seu responsável contábil é a {{ resp_ctb }} e qualquer demanda fiscal você fala com o(a) {{ resp_fiscal }}.

Nos próximos dias vamos te mandar o acesso ao portal com todos os seus boletos, contratos e formulários em um só lugar.

Qualquer dúvida, fala por aqui 💙💚`,
  },
  {
    id: "on-portal",
    categoria: "Onboarding",
    titulo: "Acesso ao portal liberado",
    descricao: "Após criar acesso no portal do cliente",
    tags: ["WhatsApp", "portal"],
    texto: `{cliente.razaoSocial}, liberamos seu acesso ao portal Cestacorp! 🔓

Lá você consegue ver:
• Todos os seus boletos (pagos e a pagar)
• Contratos e 2ª via
• Preencher formulários em minutos

Acessa por: https://cestacorp.com.br/portal
Seu e-mail de acesso já foi cadastrado. Basta clicar em "esqueci minha senha" e criar a sua.

Qualquer dúvida estamos aqui! 💙`,
  },
  {
    id: "on-reuniao-trimestral",
    categoria: "Onboarding",
    titulo: "Convite reunião trimestral",
    descricao: "Agendar alinhamento com o cliente",
    tags: ["WhatsApp", "reunião"],
    texto: `Olá {cliente.razaoSocial}!

Chegou o momento da nossa reunião trimestral 📊

Nela vamos revisar:
• Resultados do trimestre
• Tributos e obrigações próximas
• Planejamento para o próximo ciclo

Que tal algum dia da próxima semana? Pode me dizer 2 opções de horário que fica melhor para você?`,
  },
];

export function TemplateLibrary({ onUse }: { onUse: (texto: string) => void }) {
  const [open, setOpen] = useState(false);
  const [categoria, setCategoria] = useState<TemplateEntry["categoria"] | "Todas">("Todas");
  const [busca, setBusca] = useState("");

  const categorias = Array.from(new Set(TEMPLATES_BIBLIOTECA.map((t) => t.categoria)));

  const filtrados = TEMPLATES_BIBLIOTECA.filter((t) => {
    if (categoria !== "Todas" && t.categoria !== categoria) return false;
    const q = busca.toLowerCase();
    if (!q) return true;
    return (
      t.titulo.toLowerCase().includes(q) ||
      t.descricao.toLowerCase().includes(q) ||
      t.tags?.some((tag) => tag.toLowerCase().includes(q)) ||
      t.texto.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Library className="h-4 w-4" />
        Biblioteca de templates
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-end" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md bg-white shadow-2xl flex flex-col animate-[wizardIn_200ms_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-cestacorp-blue flex items-center gap-2">
                  <Library className="h-5 w-5" /> Biblioteca de templates
                </h3>
                <p className="text-xs text-muted-foreground">{TEMPLATES_BIBLIOTECA.length} mensagens prontas para uso</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 border-b space-y-2">
              <input
                className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                placeholder="Buscar template…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setCategoria("Todas")}
                  className={cn(
                    "text-xs px-3 py-1 rounded-full border",
                    categoria === "Todas" ? "bg-cestacorp-blue text-white border-cestacorp-blue" : "hover:bg-slate-50"
                  )}
                >
                  Todas
                </button>
                {categorias.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoria(c)}
                    className={cn(
                      "text-xs px-3 py-1 rounded-full border",
                      categoria === c ? "bg-cestacorp-blue text-white border-cestacorp-blue" : "hover:bg-slate-50"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filtrados.map((t) => (
                <div key={t.id} className="rounded-lg border bg-white hover:border-cestacorp-blue/40 transition p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{t.titulo}</p>
                      <p className="text-xs text-muted-foreground">{t.descricao}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => { onUse(t.texto); setOpen(false); }}
                    >
                      <Copy className="h-3 w-3" /> Usar
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground bg-slate-50 rounded p-2 line-clamp-3 whitespace-pre-wrap">
                    {t.texto}
                  </p>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="status-badge text-[10px] bg-cestacorp-blue/10 text-cestacorp-blue">{t.categoria}</span>
                    {t.tags?.map((tag) => (
                      <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
              {filtrados.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum template encontrado.
                </p>
              )}
            </div>

            <div className="p-3 border-t bg-slate-50/50 text-xs text-muted-foreground text-center">
              💡 Edite o texto após colar para personalizar ainda mais
            </div>
          </div>
        </div>
      )}
    </>
  );
}
