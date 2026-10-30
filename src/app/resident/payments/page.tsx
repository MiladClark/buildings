import { and, eq, desc, isNull } from "drizzle-orm";
import { EmptyState } from "@/components/finance/forms";
import { DataGrid } from "@/components/finance/data-grid";
import { ReceiptForm } from "@/components/finance/receipt-form";
import { CopyValue } from "@/components/resident/copy-value";
import { getFinanceData } from "@/lib/queries/finance";
import { getBuildingForUser } from "@/lib/queries/dashboard";
import { requireResident } from "@/lib/session";
import { db } from "@/lib/db";
import { paymentRequest } from "@/lib/db/schema";
import { formatToman } from "@/lib/format/money";
import { formatJalaliDate, isoDate } from "@/lib/format/jalali";
export default async function ResidentPaymentsPage() {
  const { session, member } = await requireResident();
  const ctx = await getBuildingForUser(session.user.id);
  if (!member.unitId)
    return (
      <EmptyState
        title="ابتدا واحدتان را متصل کنید"
        description="مدیر ساختمان می‌تواند حساب شما را به واحدتان وصل کند."
      />
    );
  const requests = await db
    .select()
    .from(paymentRequest)
    .where(
      and(
        eq(paymentRequest.userId, session.user.id),
        isNull(paymentRequest.deletedAt),
      ),
    )
    .orderBy(desc(paymentRequest.createdAt));
  const finance = await getFinanceData(member.buildingId);
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>پرداخت شارژ</h1>
          <p>
            پس از واریز به حساب ساختمان، اطلاعات پرداخت را برای تأیید مدیر ثبت
            کنید.
          </p>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="mb-5 panel-title">حساب دریافت شارژ ساختمان</h2>
          {ctx?.building.bankAccount ? (
            <>
              <p className="text-xs text-muted-foreground">
                شماره حساب یا کارت
              </p>
              <div className="my-4 flex items-center gap-3">
                <p
                  dir="ltr"
                  className="min-w-0 flex-1 break-all text-right text-xl font-bold numeric"
                >
                  {ctx.building.bankAccount}
                </p>
                <CopyValue
                  value={ctx.building.bankAccount}
                  label="شماره حساب یا کارت"
                />
              </div>
              {ctx.building.bankSheba && (
                <>
                  <p className="mt-6 text-xs text-muted-foreground">
                    شماره شبا
                  </p>
                  <div className="my-4 flex items-center gap-3">
                    <p
                      dir="ltr"
                      className="min-w-0 flex-1 break-all text-right text-sm font-semibold numeric"
                    >
                      {ctx.building.bankSheba}
                    </p>
                    <CopyValue
                      value={ctx.building.bankSheba}
                      label="شماره شبا"
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="text-xs leading-7 text-muted-foreground">
              مدیر هنوز شماره حساب را وارد نکرده است. پیش از واریز با مدیر
              ساختمان هماهنگ کنید.
            </p>
          )}
          <p className="mt-7 border-t border-border pt-5 text-xs leading-7 text-muted-foreground">
            ثبت درخواست به‌تنهایی به معنی تسویه نیست. پس از تأیید واریز توسط
            مدیر، مانده حساب شما به‌روز می‌شود.
          </p>
        </section>
        <section className="panel p-6">
          <h2 className="mb-6 panel-title">اعلام واریز</h2>
          <ReceiptForm
            resident
            units={finance.units
              .filter((u) => u.id === member.unitId && !u.deletedAt)
              .map((u) => ({ id: u.id, label: u.label }))}
            shares={finance.settlement.shares
              .filter((s) => s.unitId === member.unitId)
              .sort(
                (a, b) =>
                  finance.periods.findIndex((p) => p.id === a.periodId) -
                  finance.periods.findIndex((p) => p.id === b.periodId),
              )}
            today={isoDate(new Date())}
          />
        </section>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">وضعیت درخواست‌های شما</h2>
        </div>
        <DataGrid
          data={requests.map((r) => ({
            purpose: r.categoryId
              ? `${finance.categories.find((c) => c.id === r.categoryId)?.name ?? "هزینه"} · ${finance.periods.find((p) => p.id === r.periodId)?.title ?? ""}`
              : "واریز عمومی",
            date: formatJalaliDate(r.createdAt),
            amount: r.amountRial,
            confirmed:
              finance.requests.find((row) => row.request.id === r.id)
                ?.confirmedAmountRial == null
                ? "—"
                : formatToman(
                    finance.requests.find((row) => row.request.id === r.id)!
                      .confirmedAmountRial!,
                  ),
            note: r.note || "",
            status:
              r.status === "pending"
                ? "در انتظار بررسی"
                : r.status === "approved"
                  ? "تأییدشده"
                  : "ردشده",
          }))}
          columns={[
            { key: "purpose", label: "بابت" },
            { key: "confirmed", label: "مبلغ ثبت‌شده مدیر" },
            { key: "date", label: "تاریخ ثبت" },
            { key: "amount", label: "مبلغ", type: "money" },
            { key: "note", label: "توضیح" },
            { key: "status", label: "وضعیت", type: "status" },
          ]}
          filename="my-payment-requests"
          mobile={{
            title: "purpose",
            status: "status",
            amount: "amount",
            details: ["confirmed", "date", "note"],
          }}
        />
      </section>
    </div>
  );
}
