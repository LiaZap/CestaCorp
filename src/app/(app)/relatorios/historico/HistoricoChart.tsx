"use client";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Row = {
  mes: number;
  label: string;
  entradas: number;
  saidas: number;
  ativos: number;
  saldo: number;
};

export function HistoricoChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="label" fontSize={12} />
        <YAxis yAxisId="left" fontSize={12} />
        <YAxis yAxisId="right" orientation="right" fontSize={12} />
        <Tooltip
          contentStyle={{ borderRadius: 8, fontSize: 13 }}
          formatter={(v: any, name: string) => {
            if (name === "Ativos") return [Number(v).toLocaleString("pt-BR"), name];
            return [v, name];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="entradas" name="Entradas" fill="#10B981" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="left" dataKey="saidas" name="Saídas" fill="#EF4444" radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="ativos"
          name="Ativos"
          stroke="#1F4FC4"
          strokeWidth={2}
          dot={{ r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
