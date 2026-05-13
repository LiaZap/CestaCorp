"use client";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/utils";

type Row = {
  cliente: string;
  clienteId: string;
  valor: number;
  qtd: number;
  valorBruto?: number;
  valorAtualizado?: number;
  acrescimo?: number;
};

export function TopAtrasos({ data }: { data: Row[] }) {
  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-10 text-center">
        🎉 Nenhum cliente em atraso.
      </div>
    );
  }

  // Altura fixa por barra pra não apertar
  const alturaPorBarra = 34;
  const alturaTotal = Math.max(280, data.length * alturaPorBarra + 20);

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={alturaTotal}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <YAxis
            type="category"
            dataKey="cliente"
            tick={{ fontSize: 11, fill: "#334155" }}
            width={150}
            interval={0}
          />
          <Tooltip
            formatter={(value: number, name: string, props: any) => {
              const r = props.payload as Row;
              if (r.valorBruto != null && r.valorAtualizado != null) {
                return [
                  `${formatMoney(r.valorAtualizado)} (bruto ${formatMoney(r.valorBruto)} + ${formatMoney(r.acrescimo ?? 0)})`,
                  "Valor atualizado",
                ];
              }
              return [formatMoney(value), "Valor em aberto"];
            }}
            labelFormatter={(label) => String(label)}
            contentStyle={{ borderRadius: 8, fontSize: 13 }}
          />
          <Bar dataKey="valor" fill="#EF4444" radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>

      <ul className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
        {data.slice(0, 5).map((d) => (
          <li key={d.clienteId} className="flex justify-between gap-3">
            <Link href={`/clientes/${d.clienteId}`} className="hover:text-primary truncate">
              {d.cliente}
            </Link>
            <span className="whitespace-nowrap">
              <span className="font-medium text-red-600">{formatMoney(d.valor)}</span>
              {d.acrescimo != null && d.acrescimo > 0 && (
                <span className="text-amber-700 ml-1">
                  (+{formatMoney(d.acrescimo)})
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
