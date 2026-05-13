"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { dia: string; enviados: number };

export function ReguaVolumeChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="reguaVol" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#84CC16" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#84CC16" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
        <Area type="monotone" dataKey="enviados" stroke="#65A30D" strokeWidth={2} fill="url(#reguaVol)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
