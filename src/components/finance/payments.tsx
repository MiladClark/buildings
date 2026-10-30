"use client";
import { RowActions } from "@/components/ui/row-actions";
import { useState } from "react";
import { DataGrid, downloadCsv } from "@/components/finance/data-grid";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/finance/forms";
import { LinkedFormModal as FormModal } from "./linked-modal";
import { Button } from "@/components/ui/button";
import { ReceiptForm } from "./receipt-form";
import type { CostShare } from "@/lib/billing/settlement-state";
import { setRecordDeleted, resetPaymentReport } from "@/lib/actions/management";
import { reviewPaymentRequest } from "@/lib/actions/building";
import { formatJalaliDate } from "@/lib/format/jalali";
import { formatToman, toToman } from "@/lib/format/money";
export type PaymentHistoryRow = {
  id: string;
  unitId: string;
  periodId: string | null;
  categoryId: string | null;
  applications: {
    unitId: string;
    periodId: string;
    categoryId: string | null;
    amountRial: number;
  }[];
  unit: string;
  name: string;
  amount: number;
  date: string;
  method: string;
  note: string;
  purpose: string;
  applied: string;
  credit: string;
  standaloneExpenseId?: string | null;
  standaloneTitle?: string;
  kind?: "receipt" | "advance";
};
export function PaymentHistory({
  rows,
  units,
  shares,
  focusReceiptId,
  unitDetail = false,
}: {
  focusReceiptId?: string;
  unitDetail?: boolean;
  units: { id: string; label: string }[];
  shares: CostShare[];
  rows: PaymentHistoryRow[];
}) {
  const [receiptSearch, setReceiptSearch] = useState("");
  const data = [...rows]
    .sort(
      (a, b) =>
        Number(b.id === focusReceiptId) - Number(a.id === focusReceiptId),
    )
    .map((r) => ({
      ...r,
      dateLabel: formatJalaliDate(new Date(r.date)),
      methodLabel:
        r.kind === "advance"
          ? "پرداخت از جیب واحد"
          : r.method === "bank_transfer"
            ? "واریز بانکی"
            : r.method === "cash"
              ? "نقدی"
              : "سایر",
      status: "تأییدشده",
    }));
  const receiptActions = (r: PaymentHistoryRow) => (
    <RowActions
      label={`عملیات ${r.unit}`}
      items={[
        {
          label: "ویرایش",
          dialog: (
            <FormModal
              initialOpen={r.id === focusReceiptId}
              title="ویرایش واریز"
              description="مبلغ، واحد، موضوع، تاریخ و شرح واریز را اصلاح کنید؛ مانده‌ها دوباره محاسبه می‌شوند."
              trigger={
                <Button variant="outline" size="sm">
                  ویرایش
                </Button>
              }
            >
              <ReceiptForm
                units={units}
                shares={shares}
                today={r.date.slice(0, 10)}
                initial={{
                  id: r.id,
                  unitId: r.unitId,
                  periodId: r.periodId,
                  categoryId: r.categoryId,
                  amountRial: r.amount,
                  paidAt: r.date,
                  method: r.method,
                  note: r.note,
                  kind: r.kind,
                  standaloneExpenseId: r.standaloneExpenseId,
                  standaloneTitle: r.standaloneTitle,
                  applications: r.applications,
                }}
              />
            </FormModal>
          ),
        },
        {
          label: "ابطال",
          action: () => setRecordDeleted("payment", r.id, true),
          confirm: `واریز ${r.unit} ابطال شود؟ تسویه‌های همین واریز برگشت می‌خورند و بدهی و بستانکاری دوباره محاسبه می‌شوند. از «سابقه و بازیابی» قابل برگشت است.`,
          danger: true,
        },
      ]}
    />
  );
  const normalize = (value: string) =>
    value
      .replace(/[۰-۹]/g, (n) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(n)))
      .replace(/[٠-٩]/g, (n) => String("٠١٢٣٤٥٦٧٨٩".indexOf(n)))
      .replaceAll("ي", "ی")
      .replaceAll("ك", "ک")
      .replace(/[,٬]/g, "");
  const visibleReceipts = data.filter((r) =>
    normalize(
      `${r.purpose} ${r.note} ${r.dateLabel} ${r.methodLabel} ${formatToman(r.amount)} ${toToman(r.amount)}`,
    ).includes(normalize(receiptSearch.trim())),
  );
  if (unitDetail)
    return (
      <div className="space-y-3 px-5 pt-5 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">واریزهای این واحد</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                `unit-${rows[0]?.unit ?? "account"}-payments`,
                [
                  "موضوع",
                  "مبلغ (تومان)",
                  "مصرف بابت هزینه‌ها",
                  "اعتبار مصرف‌نشده",
                  "تاریخ",
                  "روش",
                  "شرح / پیگیری",
                ],
                visibleReceipts.map((r) => [
                  r.purpose,
                  toToman(r.amount),
                  r.applied,
                  r.credit,
                  r.dateLabel,
                  r.methodLabel,
                  r.note,
                ]),
              )
            }
          >
            خروجی واریزها
          </Button>
        </div>
        <SearchInput
          label="جست‌وجوی واریزهای این واحد"
          aria-label="جست‌وجوی واریزهای این واحد"
          value={receiptSearch}
          onChange={(e) => setReceiptSearch(e.target.value)}
          placeholder="جست‌وجوی موضوع، مبلغ یا شماره پیگیری"
        />
        {visibleReceipts.length ? (
          visibleReceipts.map((r) => (
            <article
              key={r.id}
              className="rounded-xl border border-border p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">{formatToman(r.amount)}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {r.dateLabel} · {r.methodLabel}
                  </p>
                </div>
                {receiptActions(r)}
              </div>
              <p className="mt-4 text-xs font-medium">{r.purpose}</p>
              {r.note && (
                <p className="mt-2 break-words text-xs leading-7 text-muted-foreground">
                  شرح / پیگیری: {r.note}
                </p>
              )}
              <dl className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-muted p-3 text-[11px]">
                <div>
                  <dt className="text-muted-foreground">مصرف بابت هزینه‌ها</dt>
                  <dd className="mt-2 font-medium">{r.applied}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    اعتبار مصرف‌نشده این واریز
                  </dt>
                  <dd className="mt-2 font-medium text-primary">{r.credit}</dd>
                </div>
              </dl>
              {r.applications.length > 0 && (
                <details className="mt-4 text-xs">
                  <summary className="w-fit text-primary">
                    ریز تخصیص این واریز
                  </summary>
                  <div className="mt-3 space-y-2">
                    {r.applications.map((a, i) => {
                      const share = shares.find(
                        (s) =>
                          s.unitId === a.unitId &&
                          s.periodId === a.periodId &&
                          s.categoryId === a.categoryId,
                      );
                      return (
                        <div
                          key={i}
                          className="flex flex-wrap justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[11px]"
                        >
                          <span>
                            {share?.title ?? "هزینه"} ·{" "}
                            {share?.periodTitle ?? "دوره مالی"}
                            {share?.draft ? " · پیش‌پرداخت" : ""}
                          </span>
                          <span className="font-medium">
                            {formatToman(a.amountRial)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </article>
          ))
        ) : (
          <EmptyState
            title={
              data.length ? "واریزی با این مشخصات پیدا نشد" : "واریزی ثبت نشده"
            }
            description={
              data.length
                ? "عبارت جست‌وجو را تغییر دهید."
                : "دریافت واقعی این واحد را از بخش ثبت دریافت وارد کنید."
            }
          />
        )}
      </div>
    );
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">دفتر واریز و اعتبار</h2>
        <span className="text-[10px] text-muted-foreground">
          ثبت و اصلاح دریافت‌ها توسط مدیر
        </span>
      </div>
      <DataGrid
        data={data}
        filename="building-payments"
        searchPlaceholder="جست‌وجوی واحد یا شماره پیگیری"
        columns={[
          { key: "unit", label: "واحد" },
          { key: "name", label: "ساکن" },
          { key: "purpose", label: "بابت" },
          { key: "amount", label: "مبلغ", type: "money" },
          { key: "applied", label: "مصرف بابت هزینه‌ها" },
          { key: "credit", label: "اعتبار مصرف‌نشده" },
          { key: "dateLabel", label: "تاریخ" },
          { key: "methodLabel", label: "روش" },
          { key: "note", label: "شرح / پیگیری" },
          { key: "status", label: "وضعیت", type: "status" },
        ]}
        renderAction={receiptActions}
      />
    </section>
  );
}
export function PaymentRequests({
  requests,
}: {
  requests: {
    id: string;
    unit: string;
    amount: number;
    confirmed: string;
    note: string | null;
    date: string;
    status: string;
    purpose: string;
  }[];
}) {
  const rows = requests.map((r) => ({
    ...r,
    dateLabel: formatJalaliDate(new Date(r.date)),
    statusLabel:
      r.status === "pending"
        ? "در انتظار بررسی"
        : r.status === "approved"
          ? "تأییدشده"
          : "ردشده",
  }));
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">اعلام واریز ساکنان</h2>
          <p className="panel-subtitle">
            امکان اختیاری برای حساب ساکنان؛ ثبت دریافت‌ها و وضعیت تسویه در
            اختیار مدیر است
          </p>
        </div>
      </div>
      <DataGrid
        data={rows}
        filename="payment-requests"
        searchPlaceholder="جست‌وجوی درخواست واریز"
        columns={[
          { key: "unit", label: "واحد" },
          { key: "purpose", label: "بابت" },
          { key: "amount", label: "مبلغ اعلام‌شده", type: "money" },
          { key: "confirmed", label: "مبلغ ثبت‌شده مدیر" },
          { key: "dateLabel", label: "تاریخ ثبت" },
          { key: "note", label: "توضیح ساکن" },
          { key: "statusLabel", label: "وضعیت", type: "status" },
        ]}
        emptyTitle="درخواستی در انتظار نیست"
        emptyDescription="هر زمان ساکنی واریز خود را اعلام کند، درخواست او برای بررسی اینجا قرار می‌گیرد."
        renderAction={(r) => (
          <RowActions
            label={`عملیات اعلام ${r.unit}`}
            items={[
              ...(r.status === "pending"
                ? [
                    {
                      label: "تأیید",
                      action: () => reviewPaymentRequest(r.id, true),
                      confirm:
                        "واریز بانکی را بررسی کرده‌اید؟ با تأیید، مبلغ در حساب واحد ثبت و بدهی تسویه می‌شود.",
                      success: "واریز تأیید و در حساب واحد ثبت شد.",
                    },
                    {
                      label: `رد درخواست ${r.unit}`,
                      action: () => reviewPaymentRequest(r.id, false),
                      confirm:
                        "این درخواست رد شود؟ ساکن از نیاز به بررسی اطلاعات واریز مطلع می‌شود.",
                      danger: true,
                    },
                  ]
                : [
                    {
                      label: "برگشت به بررسی",
                      action: () => resetPaymentReport(r.id),
                      confirm:
                        "این اعلام واریز به انتظار بررسی برگردد؟ اگر قبلاً تأیید شده، واریز مرتبط ابطال می‌شود و تسویه آن برمی‌گردد.",
                    },
                  ]),
              {
                label: "حذف اعلام",
                action: () => setRecordDeleted("request", r.id, true),
                confirm:
                  "این اعلام واریز حذف شود؟ دریافت مالی تأییدشده باقی می‌ماند؛ فقط اعلام ساکن از این فهرست کنار می‌رود و قابل بازیابی است.",
                danger: true,
              },
            ]}
          />
        )}
      />
    </section>
  );
}
