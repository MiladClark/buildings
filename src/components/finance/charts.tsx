"use client";
import { Select } from "@/components/ui/select";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ChartLine } from "lucide-react";
import { formatToman, toPersianDigits as fa } from "@/lib/format/money";
import { EmptyState } from "@/components/finance/forms";

const palette = [
  "#347b60",
  "#8baa99",
  "#bbcebd",
  "#ced9d1",
  "#dfe7df",
  "#6a8c7a",
  "#a2baab",
];
export function MoneyTrend({
  data,
}: {
  data: { id: string; label: string; income: number; expense: number }[];
}) {
  const [range, setRange] = useState(6);
  const rows = data.slice(-range);
  return (
    <section className="panel min-w-0">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">جریان مالی ساختمان</h2>
          <p className="panel-subtitle">
            مقایسه دریافت‌ها و هزینه‌ها در ماه‌های شمسی
          </p>
        </div>
        <Select
          aria-label="بازه نمودار"
          value={range}
          onValueChange={(value) => setRange(+value)}
          className="border-border text-xs"
        >
          <option value={6}>۶ ماه اخیر</option>
          <option value={12}>۱۲ ماه اخیر</option>
          <option value={24}>۲۴ ماه اخیر</option>
        </Select>
      </div>
      <div className="flex items-center gap-5 px-6 pb-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-primary" />
          دریافت‌ها
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-[var(--chart-muted)]" />
          هزینه‌ها
        </span>
        <span className="ms-auto">میلیون تومان</span>
      </div>
      {rows.length ? (
        <div
          dir="ltr"
          className="h-[240px] px-3 pb-2"
          role="img"
          aria-label="نمودار دریافت‌ها و هزینه‌های ساختمان"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={rows}
              margin={{ top: 15, right: 15, left: -18, bottom: 5 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey="label"
                tickFormatter={(label: string) => label.split(" ")[0]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
                tickMargin={16}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
                tickFormatter={(n: number) =>
                  fa(
                    (n / 10000000).toLocaleString("en-US", {
                      maximumFractionDigits: 1,
                    }),
                  )
                }
              />
              <Tooltip
                contentStyle={{
                  direction: "rtl",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  fontSize: 11,
                  fontFamily: "var(--font-vazirmatn)",
                }}
                formatter={(value, name) => [
                  formatToman(Number(value)),
                  name === "income" ? "دریافت‌ها" : "هزینه‌ها",
                ]}
              />
              <Area
                type="monotone"
                dataKey="expense"
                stroke="var(--chart-muted)"
                fill="var(--muted)"
                strokeWidth={2}
                fillOpacity={0.4}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="var(--primary)"
                fill="var(--primary)"
                strokeWidth={2.5}
                fillOpacity={0.07}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          title="اولین فصل حساب‌وکتاب شما"
          description="با ایجاد اولین دوره و ثبت هزینه یا دریافت، روند مالی ساختمان اینجا شکل می‌گیرد."
        />
      )}
      <div className="mx-6 flex items-center gap-1.5 border-t border-border py-3.5 text-[10px] text-muted-foreground">
        <ChartLine size={14} />
        دریافت‌ها و هزینه‌ها بر اساس تاریخ ثبت در ماه شمسی
      </div>
    </section>
  );
}
export function ExpenseDonut({
  data,
}: {
  data: { name: string; amount: number }[];
}) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  const sorted = data
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const rows =
    sorted.length > 5
      ? [
          ...sorted.slice(0, 4),
          {
            name: "سایر هزینه‌ها",
            amount: sorted.slice(4).reduce((s, r) => s + r.amount, 0),
          },
        ]
      : sorted;
  return (
    <section className="panel min-w-0">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">هزینه‌ها کجا می‌روند؟</h2>
          <p className="panel-subtitle">
            سهم هر دسته از هزینه‌های دوره انتخابی
          </p>
        </div>
      </div>
      {total ? (
        <>
          <div
            className="relative mx-auto h-[180px] w-full max-w-[270px]"
            role="img"
            aria-label={`توزیع هزینه‌ها، جمع ${formatToman(total)}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={79}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={3}
                  cornerRadius={3}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {rows.map((r, i) => (
                    <Cell key={r.name} fill={palette[i % palette.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => formatToman(Number(v))}
                  contentStyle={{
                    direction: "rtl",
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] text-muted-foreground">
                مجموع هزینه‌ها
              </span>
              <span className="my-1 text-lg font-bold numeric">
                {fa(
                  (total / 10000000).toLocaleString("en-US", {
                    maximumFractionDigits: 1,
                  }),
                )}
              </span>
              <span className="text-[9px] text-muted-foreground">
                میلیون تومان
              </span>
            </div>
          </div>
          <div className="space-y-3 px-6 pb-6">
            {rows.slice(0, 5).map((r, i) => (
              <div className="flex items-center gap-2 text-[10px]" key={r.name}>
                <span
                  className="size-2 rounded-sm"
                  style={{ background: palette[i % palette.length] }}
                />
                <span className="text-muted-foreground">{r.name}</span>
                <span className="ms-auto font-medium">
                  {fa(String(Math.round((r.amount / total) * 100)))}٪
                </span>
                <span className="w-[82px] text-end text-muted-foreground">
                  {fa(
                    (r.amount / 10000000).toLocaleString("en-US", {
                      maximumFractionDigits: 1,
                    }),
                  )}{" "}
                  میلیون
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="هزینه‌ای در این بازه نیست"
          description="پس از ثبت قبض‌ها، تعمیرات و نظافت، سهم هر هزینه را اینجا ببینید."
        />
      )}
    </section>
  );
}
