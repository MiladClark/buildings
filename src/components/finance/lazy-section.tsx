"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentProps } from "react";

import type { BuildingCalendar } from "@/components/finance/calendar";
import type { ExpenseDonut, MoneyTrend } from "@/components/finance/charts";
import type { DataGrid } from "@/components/finance/data-grid";

function WidgetSkeleton({ className }: { className: string }) {
  return <div className={`panel animate-pulse bg-muted/40 ${className}`} />;
}

function WhenVisible({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`${className}${visible ? " module-enter" : ""}`}>
      {visible ? children : <WidgetSkeleton className="h-full min-h-full" />}
    </div>
  );
}

const DashboardCharts = dynamic(
  () =>
    import("@/components/finance/charts").then((mod) => {
      function Charts({
        timeline,
        categories,
      }: {
        timeline: ComponentProps<typeof MoneyTrend>["data"];
        categories: ComponentProps<typeof ExpenseDonut>["data"];
      }) {
        return (
          <>
            <mod.MoneyTrend data={timeline} />
            <mod.ExpenseDonut data={categories} />
          </>
        );
      }
      return Charts;
    }),
  { loading: () => <WidgetSkeleton className="min-h-[320px] xl:col-span-2" /> },
);

const LazyGrid = dynamic(
  () => import("@/components/finance/data-grid").then((mod) => mod.DataGrid),
  { loading: () => <WidgetSkeleton className="min-h-[280px]" /> },
) as typeof DataGrid;

const LazyCalendar = dynamic(
  () =>
    import("@/components/finance/calendar").then((mod) => mod.BuildingCalendar),
  { loading: () => <WidgetSkeleton className="min-h-[280px]" /> },
);

const LazyTrend = dynamic(
  () => import("@/components/finance/charts").then((mod) => mod.MoneyTrend),
  { loading: () => <WidgetSkeleton className="min-h-[320px]" /> },
);

export function DeferredDashboardCharts(
  props: ComponentProps<typeof DashboardCharts>,
) {
  return (
    <WhenVisible className="grid min-h-[320px] items-stretch gap-5 xl:grid-cols-[1.85fr_1fr]">
      <DashboardCharts {...props} />
    </WhenVisible>
  );
}

export function DeferredDataGrid<T extends Record<string, unknown>>(
  props: ComponentProps<typeof DataGrid<T>>,
) {
  return (
    <WhenVisible className="min-h-[280px]">
      <LazyGrid {...props} />
    </WhenVisible>
  );
}

export function DeferredCalendar(props: ComponentProps<typeof BuildingCalendar>) {
  return (
    <WhenVisible className="min-h-[280px]">
      <LazyCalendar {...props} />
    </WhenVisible>
  );
}

export function DeferredMoneyTrend(
  props: ComponentProps<typeof MoneyTrend>,
) {
  return (
    <WhenVisible className="min-h-[320px]">
      <LazyTrend {...props} />
    </WhenVisible>
  );
}
