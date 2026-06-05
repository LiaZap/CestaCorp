"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileSignature,
  Copy,
  MessageCircle,
  Download,
  Paperclip,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Send,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type Assinante = {
  nome: string;
  email: string;
  status?: string;
  link?: string;
  assinouEm?: string;
  assinadoEm?: string;
};

type Anexo = { id: string; anexoId: string; nome: string; ordem: number };

type Props = {
  contratoId: string;
  status: string;
  assinaturaStatus: string;
  assinaturaProvider: string | null;
  assinaturaUrl: string | null;
  assinaturaEnviadoEm: string | null;
  assinaturaAssinadoEm: string | null;
  assinantes: Assinante[];
  temDocx: boolean;
  temPdf: boolean;
  clausulaComplementar: string;
  whatsappNumero: string | null;
  anexos: Anexo[];
};

const STATUS_ASSIN: Record<string, { label: string; cls: string }> = {
  NAO_ENVIADO: { label: "Não enviado", cls: "bg-slate-100 text-slate-700" },
  AGUARDANDO: { label: "Aguardando assinatura", cls: "bg-amber-100 text-amber-800" },
  ASSINADO: { label: "Assinado", cls: "bg-emerald-100 text-emerald-800" },
  RECUSADO: { label: "Recusado", cls: "bg-red-100 text-red-800" },
  EXPIRADO: { label: "Expirado", cls: "bg-red-100 text-red-800" },
};

export function ContratoDetalheClient(props: Props) {
  const router = useRouter();
  const [clausula, setClausula] = useState(props.clausulaComplementar);
  const [salvandoClausula, setSalvandoClausula] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [enviandoWa, setEnviandoWa] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [copiando, setCopiando] = useState<string | null>(null);
  const [removendoAnexo, setRemovendoAnexo] = useState<string | null>(null);
  const [destinatariosSelecionados, setDestinatariosSelecionados] = useState<Set<string>>(
    new Set(props.assinantes.map((a) => a.email)),
  );

  const badge = STATUS_ASSIN[props.assinaturaStatus] ?? STATUS_ASSIN.NAO_ENVIADO;

  function toggleDestinatario(email: string) {
    const next = new Set(destinatariosSelecionados);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    setDestinatariosSelecionados(next);
  }

  async function copiarLink(emailOuTexto: string, link: string) {
    setCopiando(emailOuTexto);
    setErro(null);
    try {
      // Pede o link pro backend (gera novo se necessário)
      const r = await fetch(`/api/contratos/${props.contratoId}/copiar-link`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: emailOuTexto || null }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(j.error || "falha ao obter link");
        return;
      }
      const url = j.url || link;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setOk(`Link copiado${emailOuTexto ? ` (${emailOuTexto})` : ""}`);
      } else {
        prompt("Copie o link:", url);
      }
    } catch (e: any) {
      setErro(String(e?.message ?? e));
    } finally {
      setCopiando(null);
      setTimeout(() => setOk(null), 3000);
    }
  }

  async function enviarWhatsApp() {
    setEnviandoWa(true);
    setErro(null);
    setOk(null);
    try {
      const r = await fetch(`/api/contratos/${props.contratoId}/enviar-whatsapp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          destinatarios: Array.from(destinatariosSelecionados),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(j.error || "falha ao enviar via WhatsApp");
        return;
      }
      setOk(`WhatsApp enviado pra ${j.enviados ?? 0} destinatário(s)`);
      router.refresh();
    } catch (e: any) {
      setErro(String(e?.message ?? e));
    } finally {
      setEnviandoWa(false);
      setTimeout(() => setOk(null), 4000);
    }
  }

  async function reenviarAssinatura() {
    if (!confirm("Reenviar contrato pra assinatura? Um novo documento será criado no provider.")) return;
    setReenviando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/contratos/${props.contratoId}/enviar-assinatura`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signers: props.assinantes.map((a) => ({ nome: a.nome, email: a.email })),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(j.error || "falha ao reenviar");
        return;
      }
      setOk("Contrato reenviado pra assinatura");
      router.refresh();
    } catch (e: any) {
      setErro(String(e?.message ?? e));
    } finally {
      setReenviando(false);
      setTimeout(() => setOk(null), 4000);
    }
  }

  async function salvarClausula() {
    setSalvandoClausula(true);
    setErro(null);
    try {
      const r = await fetch(`/api/contratos/${props.contratoId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clausulaComplementar: clausula }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(j.error || "falha ao salvar");
        return;
      }
      setOk("Cláusula complementar atualizada");
      router.refresh();
    } catch (e: any) {
      setErro(String(e?.message ?? e));
    } finally {
      setSalvandoClausula(false);
      setTimeout(() => setOk(null), 3000);
    }
  }

  async function cancelarContrato() {
    if (!confirm("Cancelar este contrato? Ele será marcado como CANCELADO (soft-delete) e não aparecerá mais nas listagens padrão.")) return;
    setCancelando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/contratos/${props.contratoId}`, {
        method: "DELETE",
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(j.error || "falha ao cancelar");
        return;
      }
      router.push("/contratos");
    } catch (e: any) {
      setErro(String(e?.message ?? e));
    } finally {
      setCancelando(false);
    }
  }

  async function removerAnexo(vinculoId: string) {
    if (!confirm("Remover este anexo do contrato?")) return;
    setRemovendoAnexo(vinculoId);
    setErro(null);
    try {
      const r = await fetch(`/api/contratos/${props.contratoId}/anexos/${vinculoId}`, {
        method: "DELETE",
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(j.error || "falha ao remover anexo");
        return;
      }
      setOk("Anexo removido");
      router.refresh();
    } catch (e: any) {
      setErro(String(e?.message ?? e));
    } finally {
      setRemovendoAnexo(null);
      setTimeout(() => setOk(null), 3000);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {erro && (
        <div className="lg:col-span-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {erro}
          <button onClick={() => setErro(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {ok && (
        <div className="lg:col-span-2 rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> {ok}
        </div>
      )}

      {/* ===== Assinatura ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSignature className="h-4 w-4" /> Assinatura digital
          </CardTitle>
          <CardDescription>
            Provider: {props.assinaturaProvider ?? "—"} ·{" "}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
              {badge.label}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            {props.assinaturaEnviadoEm && (
              <p>Enviado em {formatDateTime(props.assinaturaEnviadoEm)}</p>
            )}
            {props.assinaturaAssinadoEm && (
              <p>Assinado em {formatDateTime(props.assinaturaAssinadoEm)}</p>
            )}
          </div>

          {props.assinantes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum assinante registrado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {props.assinantes.map((a, i) => (
                <li
                  key={`${a.email}-${i}`}
                  className="flex items-center gap-2 p-2 rounded border border-slate-200 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={destinatariosSelecionados.has(a.email)}
                    onChange={() => toggleDestinatario(a.email)}
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{a.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.email}
                      {a.status && <span className="ml-2">· {a.status}</span>}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copiarLink(a.email, a.link ?? props.assinaturaUrl ?? "")}
                    disabled={copiando === a.email}
                  >
                    {copiando === a.email ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}{" "}
                    Copiar link
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              onClick={() => copiarLink("", props.assinaturaUrl ?? "")}
              disabled={!props.assinaturaUrl || copiando === ""}
            >
              {copiando === "" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
              Copiar link geral
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={enviarWhatsApp}
              disabled={enviandoWa || destinatariosSelecionados.size === 0 || !props.whatsappNumero}
              title={!props.whatsappNumero ? "Cliente sem telefone WhatsApp cadastrado" : ""}
            >
              {enviandoWa ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <MessageCircle className="h-3 w-3" />
              )}{" "}
              Reenviar via WhatsApp
            </Button>
            <Button
              size="sm"
              onClick={reenviarAssinatura}
              disabled={reenviando || props.assinantes.length === 0}
            >
              {reenviando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}{" "}
              Reenviar pra assinatura
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== Arquivo ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" /> Arquivo
          </CardTitle>
          <CardDescription>Baixe a versão Word ou PDF do contrato</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" disabled={!props.temDocx}>
              <a href={`/api/contratos/${props.contratoId}/pdf?format=docx`} download>
                <Download className="h-3 w-3" /> Baixar .docx
              </a>
            </Button>
            <Button asChild size="sm" disabled={!props.temPdf && !props.temDocx}>
              <a href={`/api/contratos/${props.contratoId}/pdf`} target="_blank" rel="noopener">
                <Download className="h-3 w-3" /> Baixar .pdf
              </a>
            </Button>
          </div>
          {!props.temPdf && props.temDocx && (
            <p className="text-xs text-amber-700">
              PDF ainda não gerado — a primeira visualização vai converter na hora.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ===== Anexos ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-4 w-4" /> Anexos ({props.anexos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {props.anexos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum anexo vinculado.</p>
          ) : (
            <ul className="space-y-1">
              {props.anexos.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted text-sm"
                >
                  <span>
                    <span className="text-xs text-muted-foreground font-mono mr-2">#{a.ordem}</span>
                    {a.nome}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removerAnexo(a.id)}
                    disabled={removendoAnexo === a.id}
                    className="text-red-600 hover:text-red-700"
                  >
                    {removendoAnexo === a.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ===== Cláusula complementar ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cláusula complementar</CardTitle>
          <CardDescription>
            Texto extra negociado pelo comercial — substitui o placeholder na próxima geração.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            className="w-full min-h-32 rounded-md border bg-background p-2 text-sm"
            value={clausula}
            onChange={(e) => setClausula(e.target.value)}
            placeholder="Ex: Desconto de 20% no primeiro trimestre. Forma de pagamento via PIX."
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={salvarClausula} disabled={salvandoClausula}>
              {salvandoClausula ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Salvar cláusula
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== Cancelar (full-width) ===== */}
      <div className="lg:col-span-2 flex justify-end border-t pt-4">
        <Button
          variant="outline"
          onClick={cancelarContrato}
          disabled={cancelando || props.status === "CANCELADO"}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          {cancelando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}{" "}
          Cancelar contrato
        </Button>
      </div>
    </div>
  );
}
