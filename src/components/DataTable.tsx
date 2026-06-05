import React from "react";
import { cn } from "@/lib/utils";

/**
 * Tabela genérica com header, rows e estado vazio.
 * Não faz ordenação/filtro client-side — deixa pra cada página decidir via
 * server-side (?q=, ?page=, ?status=). Foca em padronizar o layout. (#80)
 *
 * Exemplo:
 *   <DataTable
 *     columns={[
 *       { key: "numero", label: "Número" },
 *       { key: "cliente", label: "Cliente", render: (c) => c.cliente.razaoSocial },
 *       { key: "valor", label: "Valor", align: "right", render: (c) => formatMoney(c.valor) },
 *     ]}
 *     rows={contratos}
 *     rowKey={(c) => c.id}
 *     empty="Nenhum contrato encontrado"
 *   />
 */

export type Column<T> = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  className?: string;
  render?: (row: T) => React.ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: React.ReactNode;
  onRowHref?: (row: T) => string | null;
  /** Children rendered after the table body (e.g. pagination controls). */
  footer?: React.ReactNode;
};

export function DataTable<T>({ columns, rows, rowKey, empty, onRowHref, footer }: Props<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "py-2 pr-3",
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                  c.className,
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                {empty ?? "Nenhum registro encontrado."}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const href = onRowHref?.(row) ?? null;
              return (
                <tr key={rowKey(row)} className="border-b last:border-0 hover:bg-muted/50">
                  {columns.map((c) => {
                    const cell = c.render ? c.render(row) : (row as any)[c.key];
                    return (
                      <td
                        key={c.key}
                        className={cn(
                          "py-2 pr-3",
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center",
                          c.className,
                        )}
                      >
                        {href && c.key === columns[0].key ? (
                          <a href={href} className="hover:text-primary">
                            {cell}
                          </a>
                        ) : (
                          cell
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {footer}
    </div>
  );
}
