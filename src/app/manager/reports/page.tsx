import { Select } from "@/components/ui/select";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ActionForm } from "@/components/finance/forms";
import { MoneyTrend } from "@/components/finance/charts";
import { BudgetPlanner } from "@/components/finance/budget-planner";
import { Button } from "@/components/ui/button";
import { runChargeRecommendation } from "@/lib/actions/building";
import { db } from "@/lib/db";
import { chargeRecommendation } from "@/lib/db/schema";
import { dashboardData, getFinanceData } from "@/lib/queries/finance";
import { requireManager } from "@/lib/session";
import { calculateChargeRecommendation } from "@/lib/billing/forecast";
import { effectiveOccupants } from "@/lib/billing/occupancy";
export default async function ReportsPage() {
  const { member } = await requireManager();
  const data = await getFinanceData(member.buildingId);
  const latest = await db.query.chargeRecommendation.findFirst({
    where: eq(chargeRecommendation.buildingId, member.buildingId),
    orderBy: desc(chargeRecommendation.computedAt),
  });
  const ledger = {
    units: data.units,
    periods: data.periods,
    categories: data.categories,
    expenses: data.expenses.map((r) => r.expense),
    settings: data.settings,
  };
  const live = ledger.periods.some((p) => p.status !== "draft")
    ? calculateChargeRecommendation(ledger, latest?.monthsWindow ?? 6)
    : null;
  const breakdown = live?.breakdown ?? [];
  async function compute(f: FormData) {
    "use server";
    await runChargeRecommendation(Number(f.get("months")));
  }
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>گزارش و برنامه‌ریزی شارژ</h1>
          <p>
            شارژ دوره بعد را با سابقه واقعی هزینه‌ها و تغییر قیمت‌ها برآورد
            کنید.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/api/export/finance">دریافت گزارش Excel</Link>
        </Button>
      </div>
      <section className="panel p-6">
        <h2 className="panel-title">میانگین هزینه ماهانه ساختمان</h2>
        <p className="mb-5 mt-2 text-xs leading-7 text-muted-foreground">
          دوره‌های صادرشده، شامل بایگانی، مبنای میانگین‌اند. تغییر هزینه، قواعد
          یا وضعیت واحدها در پیشنهاد فعلی اعمال می‌شود؛ شارژ ثابت با نرخ فعلی
          محاسبه می‌شود.
        </p>
        <ActionForm action={compute} className="flex flex-wrap items-end gap-4">
          <div className="form-field">
            <label htmlFor="months">بازه بررسی</label>
            <Select
              id="months"
              name="months"
              defaultValue={latest?.monthsWindow ?? 6}
            >
              <option value={3}>۳ ماه اخیر</option>
              <option value={6}>۶ ماه اخیر</option>
              <option value={12}>۱۲ ماه اخیر</option>
              <option value={24}>۲۴ ماه اخیر</option>
            </Select>
          </div>
          <Button type="submit">محاسبه میانگین و پیشنهاد</Button>
        </ActionForm>
      </section>
      <BudgetPlanner
        key={JSON.stringify(breakdown)}
        breakdown={breakdown}
        units={data.units
          .filter((u) => !u.deletedAt)
          .map((u) => ({
            id: u.id,
            label: u.label,
            occupants: effectiveOccupants(u),
            empty: u.status === "empty",
            temporarilyAbsent: u.temporarilyAbsent,
          }))}
        computedAt={live ? new Date().toISOString() : null}
      />
      <MoneyTrend data={dashboardData(data).timeline} />
    </div>
  );
}
