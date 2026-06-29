"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { formatBahtShort } from "@/lib/money";

// Values are passed in satang; the tooltip renders ฿ short form.
const tip = (v: number) => formatBahtShort(v);

export function StageBarChart({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={78}
          tick={{ fontSize: 11, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip formatter={(v: number) => tip(v)} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="value" radius={4}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendBarChart({
  data,
  revenueLabel,
  netLabel,
}: {
  data: { label: string; revenue: number; net: number }[];
  revenueLabel: string;
  netLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip formatter={(v: number) => tip(v)} cursor={{ fill: "#f1f5f9" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar name={revenueLabel} dataKey="revenue" fill="#cbd5e1" radius={3} />
        <Bar name={netLabel} dataKey="net" fill="#16a34a" radius={3} />
      </BarChart>
    </ResponsiveContainer>
  );
}
