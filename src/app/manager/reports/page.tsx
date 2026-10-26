import Link from "next/link";
import { MoneyTrend } from "@/components/finance/charts";
import { PeriodChargePlanningCards } from "@/components/finance/period-charge-planning";
import { Button } from "@/components/ui/button";
import { dashboardData, getFinanceData } from "@/lib/queries/finance";
import { getPeriodChargePlan } from "@/lib/queries/charge-plan";
import { requireManager } from "@/lib/session";
export default async function ReportsPage() {
  const { member } = await requireManager();
  const data = await getFinanceData(member.buildingId);
  const period = data.periods.find((p) => !p.deletedAt);
  const plan = period
    ? await getPeriodChargePlan(member.buildingId, period.id, data)
    : null;
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>گزارش و برنامه‌ریزی شارژ</h1>
          <p>
            برآورد شارژ پایه از آخرین سوابق؛ آب جدا بر اساس نفرات حاضر محاسبه
            می‌شود.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/api/export/finance">دریافت گزارش Excel</Link>
        </Button>
      </div>
      {period && plan ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{period.title}</h2>
            <Link
              href={`/manager/periods/${period.id}`}
              className="text-xs text-primary underline underline-offset-4"
            >
              مشاهده دوره و ریز هزینه‌ها
            </Link>
          </div>
          <PeriodChargePlanningCards periodId={period.id} plan={plan} />
        </>
      ) : (
        <section className="panel p-6">
          <p className="text-sm">
            برای برنامه‌ریزی شارژ، ابتدا یک دوره مالی بسازید.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/manager/periods">دوره‌های مالی</Link>
          </Button>
        </section>
      )}
      <MoneyTrend data={dashboardData(data).timeline} />
    </div>
  );
}
