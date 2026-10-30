import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/i18n/context";
import { chartData } from "@/lib/chart";
import { formatDate, formatMoney } from "@/lib/format";
import type { Prices } from "@/lib/schemas";

export function PriceChart({ prices }: { prices: Prices }) {
  const { lang, t } = useI18n();
  const { points, lines, domain } = chartData(prices);
  return (
    <ComposedChart width={720} height={280} margin={{ left: 8, right: 8 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis
        dataKey="x"
        type="number"
        scale="time"
        domain={domain}
        ticks={lines.map((l) => l.x)}
        tickFormatter={(v: number) => formatDate(new Date(v).toISOString(), lang) ?? ""}
      />
      <YAxis tickFormatter={(v: number) => formatMoney(v, lang) ?? ""} width={96} />
      <Tooltip
        labelFormatter={(v) => formatDate(new Date(Number(v)).toISOString(), lang) ?? ""}
        formatter={(v) => formatMoney(Number(v), lang) ?? ""}
      />
      <Legend />
      <Scatter name={t("detail.price")} data={points} dataKey="amount" fill="#64748b" />
      <Line
        name={t("detail.median")}
        data={lines}
        dataKey="median"
        stroke="#2563eb"
        dot={false}
        connectNulls={false}
        isAnimationActive={false}
      />
      <Line
        name={t("detail.p10")}
        data={lines}
        dataKey="p10"
        stroke="#16a34a"
        dot={false}
        connectNulls={false}
        isAnimationActive={false}
      />
    </ComposedChart>
  );
}
