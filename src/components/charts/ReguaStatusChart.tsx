"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { dia: string; ENVIADO: number; ERRO: number; PENDENTE: number; PULADO: number };

export function ReguaStatusChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="dia"
          tick={{ fontSize: 10 }}
          interval={Math.floor(data.length / 10)}
        />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="ENVIADO" stackId="a" fill="#84CC16" />
        <Bar dataKey="PULADO" stackId="a" fill="#94A3B8" />
        <Bar dataKey="ERRO" stackId="a" fill="#EF4444" />
        <Bar dataKey="PENDENTE" stackId="a" fill="#F59E0B" />
      </BarChart>
    </ResponsiveContainer>
  );
}
