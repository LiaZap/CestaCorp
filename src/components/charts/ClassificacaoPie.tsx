"use client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Row = { classificacao: string; total: number; fill: string };

export function ClassificacaoPie({ data }: { data: Row[] }) {
  if (data.length === 0) {
    return <div className="text-sm text-muted-foreground py-10 text-center">Sem dados</div>;
  }

  const total = data.reduce((acc, d) => acc + d.total, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="relative">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="classificacao"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 8, fontSize: 12, padding: "6px 10px" }}
              formatter={(v: any) => [`${v} cliente${v !== 1 ? "s" : ""}`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Total no centro do donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold leading-none">{total}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
            clientes
          </span>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.total / total) * 100 : 0;
          return (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: d.fill }}
              />
              <span className="flex-1 font-medium truncate">{d.classificacao}</span>
              <span className="text-muted-foreground tabular-nums w-10 text-right">
                {pct.toFixed(0)}%
              </span>
              <span className="font-semibold tabular-nums w-8 text-right">{d.total}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
