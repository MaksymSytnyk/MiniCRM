import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Report } from "@/lib/types";
import { money } from "@/lib/utils";
const colors = ["#9b8afb", "#5e82db", "#6bc5a2", "#666674"];
const tooltip = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  color: "var(--text)",
  fontSize: 12,
};
export function RevenueChart({ data }: { data: Report["series"] }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 20, right: 12, bottom: 0, left: -18 }}
        >
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9b8afb" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#9b8afb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--line)"
            vertical={false}
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="label"
            tickFormatter={(s) => s.split(" ")[0]}
            tick={{ fill: "var(--subtle)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            dy={12}
          />
          <YAxis
            tickFormatter={(v) => (v >= 1000 ? `$${v / 1000}k` : `$${v}`)}
            tick={{ fill: "var(--subtle)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltip}
            formatter={(value) => [money(Number(value)), "Revenue"]}
            cursor={{ stroke: "#9b8afb", strokeDasharray: "4 4" }}
          />
          <Area
            name="Revenue"
            type="monotone"
            dataKey="revenue"
            stroke="#a596ff"
            strokeWidth={2.5}
            fill="url(#revenueFill)"
            activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ClientsChart({ data }: { data: Report["series"] }) {
  return (
    <div className="chart small-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 0, bottom: 0, left: -30 }}
        >
          <CartesianGrid
            stroke="var(--line)"
            vertical={false}
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="label"
            tickFormatter={(s) => s.split(" ")[0]}
            tick={{ fill: "var(--subtle)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--subtle)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltip} cursor={{ fill: "var(--hover)" }} />
          <Bar
            dataKey="clients"
            name="New clients"
            fill="#9b8afb"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function PipelineChart({ data }: { data: Report["deals_by_status"] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="pipeline-chart">
      <div className="donut-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total ? data : [{ name: "No deals", count: 1 }]}
              dataKey="count"
              innerRadius={63}
              outerRadius={80}
              paddingAngle={total ? 4 : 0}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {(total ? data : [{ name: "No deals" }]).map((d, i) => (
                <Cell key={d.name} fill={total ? colors[i] : "var(--line)"} />
              ))}
            </Pie>
            {!!total && <Tooltip contentStyle={tooltip} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <strong>{total}</strong>
          <span>Total deals</span>
        </div>
      </div>
      <div className="chart-legend">
        {data.map((d, i) => (
          <div key={d.name}>
            <span>
              <i style={{ background: colors[i] }} />
              {d.name}
            </span>
            <strong>{d.count}</strong>
            <small>{total ? Math.round((d.count / total) * 100) : 0}%</small>
          </div>
        ))}
      </div>
    </div>
  );
}
