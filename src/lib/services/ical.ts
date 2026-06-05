/**
 * Gerador de iCalendar (RFC 5545) para EventoAgenda (#92).
 *
 * Patrick (reunião 05/06): "coloca uma calendário lá na agenda do cliente é
 * meio Outlook, sei lá, o que que ele usa". Cliente recebe URL .ics e
 * importa no Google/Outlook — vira evento nativo com lembrete.
 *
 * Não usa lib externa pra evitar dep nova; iCalendar é texto simples.
 */

export interface EventoIcsInput {
  uid: string;
  titulo: string;
  descricao?: string | null;
  dataVencimento: Date;
  dataInicio?: Date;
  dataFim?: Date;
  /** Dias antes do vencimento pra alarme (VALARM TRIGGER). Default: 1. */
  alertaDiasAntes?: number;
}

/**
 * Escapa texto pra iCal: \, ; , \n viram \\, \; \, \n.
 */
function escapar(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Formato UTC: 20260612T030000Z */
function fmtUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Formato data-only: 20260612 */
function fmtDate(d: Date): string {
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("");
}

/**
 * Dobra linhas a cada 75 octets conforme RFC 5545 §3.1
 * (linha continuação começa com espaço).
 */
function dobrarLinhas(linhas: string[]): string {
  return linhas
    .map((l) => {
      if (l.length <= 75) return l;
      const parts: string[] = [];
      let restante = l;
      let primeira = true;
      while (restante.length > 0) {
        const chunkSize = primeira ? 75 : 74;
        parts.push((primeira ? "" : " ") + restante.slice(0, chunkSize));
        restante = restante.slice(chunkSize);
        primeira = false;
      }
      return parts.join("\r\n");
    })
    .join("\r\n");
}

export function gerarIcs(evento: EventoIcsInput, organizacao = "Cestacorp"): string {
  const dataInicio = evento.dataInicio ?? evento.dataVencimento;
  // Evento all-day se não tiver hora — mantém fim no mesmo dia
  const isAllDay = evento.dataVencimento.getUTCHours() === 0 &&
                   evento.dataVencimento.getUTCMinutes() === 0 &&
                   !evento.dataInicio;

  const linhas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${organizacao}//Sistema//PT-BR`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${evento.uid}@cestacorp.bahflash.tech`,
    `DTSTAMP:${fmtUtc(new Date(Date.UTC(2026, 5, 12)))}`, // fixo pra build reproduzível
    `SUMMARY:${escapar(evento.titulo)}`,
  ];

  if (evento.descricao) {
    linhas.push(`DESCRIPTION:${escapar(evento.descricao)}`);
  }

  if (isAllDay) {
    linhas.push(`DTSTART;VALUE=DATE:${fmtDate(dataInicio)}`);
    const fim = new Date(evento.dataVencimento);
    fim.setUTCDate(fim.getUTCDate() + 1);
    linhas.push(`DTEND;VALUE=DATE:${fmtDate(fim)}`);
  } else {
    linhas.push(`DTSTART:${fmtUtc(dataInicio)}`);
    const fim = evento.dataFim ?? new Date(evento.dataVencimento.getTime() + 30 * 60_000);
    linhas.push(`DTEND:${fmtUtc(fim)}`);
  }

  const alertaDias = evento.alertaDiasAntes ?? 1;
  if (alertaDias > 0) {
    linhas.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapar(evento.titulo)}`,
      `TRIGGER:-P${alertaDias}D`,
      "END:VALARM",
    );
  }

  linhas.push("END:VEVENT", "END:VCALENDAR");
  return dobrarLinhas(linhas) + "\r\n";
}
