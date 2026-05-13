"use client";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/utils";

type Row = { mes: string; emitido: number; pago: number; atrasado: number };

export function CobrancasTimeline({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="colorEmitido" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1E3A8A" stopOpacity={0.6} />
            <stop offset="95%" stopColor="#1E3A8A" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorPago" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#84CC16" stopOpacity={0.6} />
            <stop offset="95%" stopColor="#84CC16" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorAtrasado" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.6} />
            <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
        />
        <Tooltip
          formatter={(value: number) => formatMoney(value)}
          contentStyle={{ borderRadius: 8, fontSize: 13 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="emitido" name="Emitido" stroke="#1E3A8A" fill="url(#colorEmitido)" strokeWidth={2} />
        <Area type="monotone" dataKey="pago" name="Pago" stroke="#84CC16" fill="url(#colorPago)" strokeWidth={2} />
        <Area type="monotone" dataKey="atrasado" name="Em atraso" stroke="#EF4444" fill="url(#colorAtrasado)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
