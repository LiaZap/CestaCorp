"use client";

/**
 * Helper de formulário que junta Label + input + dica + erro em um único
 * componente acessível por construção (#60).
 *
 * Resolve 3 problemas que apareceram repetidos em ~15 forms:
 *  - Label sem htmlFor / input sem id (screen reader lê "edit, edit, edit",
 *    autofill do navegador não funciona)
 *  - Mensagem de erro fora de aria-describedby
 *  - Indicação "obrigatório" inconsistente (* só visual, sem `required`/aria)
 *
 * USO:
 *   <Field label="CPF/CNPJ" required hint="00.000.000/0000-00" error={erro}>
 *     {(id) => <Input id={id} value={x} onChange={...} />}
 *   </Field>
 *
 * Atalhos pra casos comuns:
 *   <FieldText label="Nome" value={x} onChange={setX} required />
 *   <FieldSelect label="Status" value={x} onChange={setX} options={[...]}/>
 *
 * Pra forms onde queremos manter Input solto + datalist (autocomplete),
 * basta passar children como função de render.
 */

import { useId, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  /** id manual — se omitido, geramos um único via useId(). */
  htmlId?: string;
  /** Renderiza o input. Recebe o id gerado pra colar no input/select. */
  children: (id: string, describedBy?: string) => ReactNode;
}

export function Field({ label, required, hint, error, className, htmlId, children }: FieldProps) {
  const autoId = useId();
  const id = htmlId ?? `f-${autoId.replace(/:/g, "")}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id}>
        {label}{required && <span className="text-destructive ml-0.5" aria-hidden>*</span>}
        {required && <span className="sr-only"> (obrigatório)</span>}
      </Label>
      {children(id, describedBy)}
      {hint && !error && (
        <p id={hintId} className="text-[10px] text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive flex items-center gap-1" role="alert">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Atalhos (FieldText / FieldSelect / FieldTextarea)
// ─────────────────────────────────────────────────────────────────────

interface FieldTextProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "onChange" | "value"> {
  label: string;
  value: string | number | undefined | null;
  onChange: (v: string) => void;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  htmlId?: string;
}

export function FieldText({
  label, value, onChange, hint, error, required, className, htmlId,
  ...rest
}: FieldTextProps) {
  return (
    <Field label={label} required={required} hint={hint} error={error} className={className} htmlId={htmlId}>
      {(id, describedBy) => (
        <Input
          {...rest}
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
        />
      )}
    </Field>
  );
}

interface FieldSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "onChange" | "value"> {
  label: string;
  value: string | undefined | null;
  onChange: (v: string) => void;
  options: Array<[string, string]> | Array<{ value: string; label: string }>;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  emptyLabel?: string;
  className?: string;
  htmlId?: string;
}

export function FieldSelect({
  label, value, onChange, options, hint, error, required, emptyLabel,
  className, htmlId, ...rest
}: FieldSelectProps) {
  const opts: Array<{ value: string; label: string }> = options.map((o) =>
    Array.isArray(o) ? { value: o[0], label: o[1] } : o
  );

  return (
    <Field label={label} required={required} hint={hint} error={error} className={className} htmlId={htmlId}>
      {(id, describedBy) => (
        <select
          {...rest}
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-10 w-full rounded-md border bg-background px-3 text-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          {emptyLabel != null && <option value="">{emptyLabel}</option>}
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </Field>
  );
}

interface FieldTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "onChange" | "value"> {
  label: string;
  value: string | undefined | null;
  onChange: (v: string) => void;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  htmlId?: string;
}

export function FieldTextarea({
  label, value, onChange, hint, error, required, className, htmlId,
  ...rest
}: FieldTextareaProps) {
  return (
    <Field label={label} required={required} hint={hint} error={error} className={className} htmlId={htmlId}>
      {(id, describedBy) => (
        <textarea
          {...rest}
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        />
      )}
    </Field>
  );
}
