"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { ActionForm, FormModal } from "./forms";
import { DataGrid } from "./data-grid";
import { MoneyInput } from "./money-input";
import { JalaliDateField } from "./calendar";
import { payExpense, voidExpensePayment } from "@/lib/actions/disbursements";
import {
  formatToman,
  tomanInputToRial,
  toToman,
  toPersianDigits,
} from "@/lib/format/money";
import { formatJalaliDate } from "@/lib/format/jalali";
import type { Disbursement, Treasury } from "@/lib/billing/treasury";

type Cost = Treasury["costs"][number];
type HistoryRow = Omit<Disbursement, "paidAt" | "createdAt" | "cancelledAt"> & {
  paidAt: string;
  createdAt: string;
  cancelledAt: string | null;
};

export function TreasurySummary({ treasury }: { treasury: Treasury }) {
  const [expanded, setExpanded] = useState(false);
  const breakdownId = useId();
  return (
    <section className="panel p-5 space-y-4" aria-label="حساب ساختمان">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="panel-title">موجودی حساب ساختمان</h2>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            {formatToman(treasury.balanceRial)}
          </p>
        </div>
        <Button variant="outline" asChild size="sm">
          <Link href="/manager/expenses?view=payments#fund-payments">
            ثبت پرداخت و ریز خرید
          </Link>
        </Button>
      </div>
      <button
        type="button"
        className="text-xs text-primary sm:hidden"
        aria-expanded={expanded}
        aria-controls={breakdownId}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "بستن جزئیات موجودی" : "جزئیات دریافت و پرداخت حساب"}
      </button>
      <div
        id={breakdownId}
        className={expanded ? "space-y-4" : "hidden space-y-4 sm:block"}
      >
        <dl className="grid gap-4 sm:grid-cols-3 text-sm">
          {[
            ["دریافت تأییدشده از واحدها", treasury.receivedRial],
            ["پرداخت واقعی از حساب", treasury.paidRial],
            ["مانده برآورد هزینه‌های پرداخت‌نشده", treasury.pendingRial],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-2 font-medium tabular-nums">
                {formatToman(Number(value))}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground leading-7">
          ثبت هزینه یا برآورد خرید، موجودی را کم نمی‌کند. فقط پرداخت تأییدشده از
          حساب کسر می‌شود. موجودی بر اساس دریافت‌ها و پرداخت‌های ثبت‌شده در اپ
          است.
        </p>
      </div>
    </section>
  );
}

function DisbursementForm({
  cost,
  balance,
  today,
}: {
  cost: Cost;
  balance: number;
  today: string;
}) {
  const formId = useId();
  const [receiptId] = useState(() => crypto.randomUUID());
  const [itemized, setItemized] = useState(false);
  const [items, setItems] = useState([
    { id: "first", description: "", amount: "" },
  ]);
  const [amountText, setAmountText] = useState(() => {
    const remaining = Math.max(0, cost.estimateRial - cost.paidRial);
    return remaining ? String(toToman(remaining)) : "";
  });
  const [final, setFinal] = useState(true);
  const parse = (value: string) => {
    try {
      return tomanInputToRial(value);
    } catch {
      return 0;
    }
  };
  const amount = itemized
    ? items.reduce((s, i) => s + parse(i.amount), 0)
    : parse(amountText);
  return (
    <ActionForm
      className="space-y-4"
      success="پرداخت ثبت شد و موجودی حساب به‌روز شد."
      action={async (f) => {
        const purchaseItems = itemized
          ? items.map((i) => ({
              description: i.description,
              amountRial: tomanInputToRial(i.amount),
            }))
          : [];
        await payExpense({
          id: receiptId,
          ...cost.target,
          amountRial: itemized
            ? purchaseItems.reduce((s, i) => s + i.amountRial, 0)
            : tomanInputToRial(f.get("amount")),
          payee: String(f.get("payee") || ""),
          paidAt: String(f.get("paidAt")),
          method: String(f.get("method")) as Disbursement["method"],
          reference: String(f.get("reference") || ""),
          note: String(f.get("note") || ""),
          items: purchaseItems,
          finalPayment: final,
        });
      }}
    >
      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-secondary p-3 text-xs">
        <div>
          <dt>مبلغ برآورد / ثبت هزینه</dt>
          <dd className="mt-2">{formatToman(cost.estimateRial)}</dd>
        </div>
        <div>
          <dt>قبلاً پرداخت‌شده</dt>
          <dd className="mt-2">{formatToman(cost.paidRial)}</dd>
        </div>
      </dl>
      <div className="form-field">
        <label htmlFor={`${formId}-payee`}>گیرنده وجه / فروشنده</label>
        <Input
          id={`${formId}-payee`}
          name="payee"
          required
          maxLength={200}
          placeholder="مثلاً آقای احمدی، نظافت‌چی ساختمان"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={itemized}
          onChange={(e) => setItemized(e.target.checked)}
        />
        ثبت ریز اقلام خرید
      </label>
      {itemized ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2"
            >
              <div className="form-field">
                <label htmlFor={`${formId}-${item.id}-name`}>نام کالا</label>
                <Input
                  id={`${formId}-${item.id}-name`}
                  required
                  maxLength={200}
                  placeholder="مثلاً تاید"
                  value={item.description}
                  onChange={(e) =>
                    setItems((rows) =>
                      rows.map((r) =>
                        r.id === item.id
                          ? { ...r, description: e.target.value }
                          : r,
                      ),
                    )
                  }
                />
              </div>
              <div className="form-field">
                <label htmlFor={`${formId}-${item.id}-amount`}>
                  قیمت کل (تومان)
                </label>
                <MoneyInput
                  id={`${formId}-${item.id}-amount`}
                  required
                  value={item.amount}
                  onChange={(e) =>
                    setItems((rows) =>
                      rows.map((r) =>
                        r.id === item.id ? { ...r, amount: e.target.value } : r,
                      ),
                    )
                  }
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={items.length === 1}
                aria-label={`حذف قلم ${index + 1}`}
                onClick={() =>
                  setItems((rows) => rows.filter((r) => r.id !== item.id))
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={items.length >= 100}
            onClick={() =>
              setItems((rows) => [
                ...rows,
                { id: crypto.randomUUID(), description: "", amount: "" },
              ])
            }
          >
            <Plus size={15} />
            افزودن کالا
          </Button>
          <p className="text-sm font-medium" aria-live="polite">
            جمع ریز خرید: {formatToman(amount)}
          </p>
        </div>
      ) : (
        <div className="form-field">
          <label htmlFor={`${formId}-amount`}>مبلغ واقعی پرداخت (تومان)</label>
          <MoneyInput
            id={`${formId}-amount`}
            name="amount"
            required
            value={amountText}
            onChange={(e) => {
              setAmountText(e.target.value);
            }}
          />
          <p className="text-xs text-muted-foreground">
            مبلغ واقعی می‌تواند کمتر یا بیشتر از برآورد باشد.
          </p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <JalaliDateField
          name="paidAt"
          label="تاریخ پرداخت"
          required
          defaultValue={today}
        />
        <div className="form-field">
          <label htmlFor={`${formId}-method`}>روش پرداخت</label>
          <Select
            id={`${formId}-method`}
            name="method"
            defaultValue="bank_transfer"
          >
            <option value="bank_transfer">انتقال بانکی</option>
            <option value="cash">نقدی</option>
            <option value="other">سایر</option>
          </Select>
        </div>
      </div>
      <div className="form-field">
        <label htmlFor={`${formId}-reference`}>
          شماره پیگیری / رسید (اختیاری)
        </label>
        <Input id={`${formId}-reference`} name="reference" maxLength={200} />
      </div>
      <div className="form-field">
        <label htmlFor={`${formId}-note`}>توضیح پرداخت (اختیاری)</label>
        <Input id={`${formId}-note`} name="note" maxLength={2000} />
      </div>
      <label className="flex items-start gap-2 text-sm leading-7">
        <input
          className="mt-2"
          type="checkbox"
          checked={final}
          onChange={(e) => setFinal(e.target.checked)}
        />
        این هزینه با این پرداخت تسویه شد؛ پرداخت دیگری باقی نمانده.
      </label>
      <div
        className="rounded-lg bg-secondary p-3 text-xs leading-7"
        aria-live="polite"
      >
        <p>
          کسر از حساب: <strong>{formatToman(amount)}</strong>
        </p>
        <p>
          موجودی پس از ثبت: <strong>{formatToman(balance - amount)}</strong>
        </p>
        {final && (
          <p>
            مبلغ نهایی کل هزینه: {formatToman(cost.paidRial + amount)}؛ اختلاف
            با برآورد: {formatToman(cost.paidRial + amount - cost.estimateRial)}
          </p>
        )}
        {!final && (
          <p>
            پرداخت علی‌الحساب ثبت می‌شود و هزینه برای پرداخت بعدی باز می‌ماند.
          </p>
        )}
        {balance - amount < 0 && (
          <p className="text-destructive">
            با ثبت این پرداخت، حساب ثبت‌شده کسری خواهد داشت.
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-7">
        این دکمه ثبت حسابداری پرداختی است که انجام داده‌اید. سهم شارژ و فیش
        واحدها با ثبت پرداخت تغییر نمی‌کند.
      </p>
      <Button type="submit" className="w-full">
        تأیید پرداخت و کسر از حساب
      </Button>
    </ActionForm>
  );
}

export function CostPaymentButton({
  cost,
  balance,
  today,
}: {
  cost: Cost;
  balance: number;
  today: string;
}) {
  return (
    <FormModal
      title={`پرداخت ${cost.title}`}
      description="مبلغ واقعی پرداخت‌شده را ثبت کنید. موجودی حساب به همین میزان کم می‌شود."
      trigger={
        <Button size="sm" variant="outline" disabled={cost.settled}>
          {cost.settled
            ? "تسویه‌شده"
            : cost.paidRial > 0
              ? "ثبت پرداخت بعدی"
              : "ثبت پرداخت"}
        </Button>
      }
    >
      <DisbursementForm cost={cost} balance={balance} today={today} />
    </FormModal>
  );
}

export function TreasuryLedger({
  treasury,
  history,
  today,
  standaloneId,
}: {
  treasury: Treasury;
  history: HistoryRow[];
  today: string;
  standaloneId?: string;
}) {
  const [filter, setFilter] = useState("pending");
  const [historyFilter, setHistoryFilter] = useState("active");
  const scope = treasury.costs.filter(
    (c) => !standaloneId || c.target.standaloneExpenseId === standaloneId,
  );
  const rows = scope
    .filter(
      (c) => filter === "all" || (filter === "paid" ? c.settled : !c.settled),
    )
    .map((c) => ({
      ...c,
      scopeLabel: `${c.periodTitle} · ${formatJalaliDate(new Date(c.date))}`,
    }));
  const payments = history
    .filter(
      (d) =>
        (!standaloneId || d.standaloneExpenseId === standaloneId) &&
        (historyFilter === "all" ||
          (historyFilter === "cancelled" ? !!d.cancelledAt : !d.cancelledAt)),
    )
    .map((d) => ({
      ...d,
      title:
        treasury.costs.find((c) =>
          d.standaloneExpenseId
            ? c.target.standaloneExpenseId === d.standaloneExpenseId
            : c.target.expenseId === d.expenseId,
        )?.title ?? "هزینه بایگانی‌شده",
      dateLabel: formatJalaliDate(new Date(d.paidAt)),
      state: d.cancelledAt
        ? "لغوشده"
        : d.finalPayment
          ? "پرداخت نهایی"
          : "علی‌الحساب",
    }));
  return (
    <div className="space-y-6" id="fund-payments">
      <section className="panel">
        <div className="panel-head flex-wrap">
          <div>
            <h2 className="panel-title">پرداخت هزینه‌ها از حساب</h2>
            <p className="panel-subtitle">
              نظافت، قبوض و خرید لوازم؛ برآورد و پرداخت واقعی جدا ثبت می‌شوند.
            </p>
          </div>
          <Select
            aria-label="وضعیت پرداخت هزینه‌ها"
            value={filter}
            onValueChange={setFilter}
          >
            <option value="pending">در انتظار پرداخت</option>
            <option value="paid">پرداخت‌شده</option>
            <option value="all">همه هزینه‌ها</option>
          </Select>
        </div>
        <MobileCostList
          costs={rows}
          balance={treasury.balanceRial}
          today={today}
        />
        <div className="hidden lg:block">
          <DataGrid
            data={rows}
            filename="expense-payment-status"
            searchPlaceholder="جست‌وجوی هزینه برای پرداخت"
            emptyTitle={
              filter === "pending"
                ? "هزینه‌ای در انتظار پرداخت نیست"
                : "هزینه‌ای در این فهرست نیست"
            }
            emptyDescription="هزینه جدید را از بالای همین صفحه ثبت کنید؛ سپس پرداخت واقعی آن را تأیید کنید."
            columns={[
              { key: "title", label: "هزینه" },
              { key: "scopeLabel", label: "دوره / تاریخ" },
              {
                key: "estimateRial",
                label: "برآورد / مبلغ ثبت‌شده",
                type: "money",
              },
              { key: "paidRial", label: "کل پرداخت واقعی", type: "money" },
              { key: "remainingRial", label: "مانده برآورد", type: "money" },
              { key: "state", label: "وضعیت" },
            ]}
            renderAction={(c) => (
              <CostPaymentButton
                cost={c}
                balance={treasury.balanceRial}
                today={today}
              />
            )}
          />
        </div>
      </section>
      <section className="panel">
        <div className="panel-head flex-wrap">
          <div>
            <h2 className="panel-title">اسناد پرداخت از حساب</h2>
            <p className="panel-subtitle">
              رسید، ریز خرید و لغو ثبت اشتباه؛ همه با سابقه نگه‌داری می‌شوند.
            </p>
          </div>
          <Select
            aria-label="فیلتر اسناد پرداخت"
            value={historyFilter}
            onValueChange={setHistoryFilter}
          >
            <option value="active">پرداخت‌های تأییدشده</option>
            <option value="cancelled">پرداخت‌های لغوشده</option>
            <option value="all">همه اسناد</option>
          </Select>
        </div>
        <DataGrid
          data={payments}
          filename="fund-disbursements"
          columns={[
            { key: "title", label: "بابت" },
            { key: "payee", label: "گیرنده" },
            { key: "dateLabel", label: "تاریخ پرداخت" },
            { key: "amountRial", label: "مبلغ", type: "money" },
            { key: "reference", label: "شماره پیگیری" },
            { key: "state", label: "وضعیت" },
          ]}
          emptyTitle="سند پرداختی در این فهرست نیست"
          emptyDescription="بعد از تأیید پرداخت، سند و ریز خرید در این بخش ثبت می‌شود."
          renderAction={(d) => (
            <FormModal
              title="سند پرداخت"
              description={`${d.title} · ${d.payee}`}
              trigger={
                <Button size="sm" variant="outline">
                  رسید و جزئیات
                </Button>
              }
            >
              <div className="space-y-4 text-sm leading-7">
                <p>
                  مبلغ پرداخت: <strong>{formatToman(d.amountRial)}</strong>
                </p>
                <p>
                  تاریخ پرداخت: {d.dateLabel} ·{" "}
                  {d.method === "cash"
                    ? "نقدی"
                    : d.method === "bank_transfer"
                      ? "بانکی"
                      : "سایر"}
                </p>
                <p>وضعیت: {d.state}</p>
                <p className="break-all text-xs text-muted-foreground">
                  شناسه سند: {d.id}
                </p>
                <p>زمان ثبت سند: {formatJalaliDate(new Date(d.createdAt))}</p>
                {d.reference && <p>شماره پیگیری: {d.reference}</p>}
                {d.note && <p>توضیح: {d.note}</p>}
                {d.items.length > 0 && (
                  <div>
                    <h3 className="font-semibold">ریز خرید</h3>
                    <ul className="divide-y divide-border">
                      {d.items.map((item, index) => (
                        <li
                          key={index}
                          className="flex justify-between gap-4 py-2"
                        >
                          <span>{item.description}</span>
                          <span className="shrink-0">
                            {formatToman(item.amountRial)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p>جمع: {formatToman(d.amountRial)}</p>
                  </div>
                )}
                {d.cancelledAt ? (
                  <p className="rounded-lg bg-secondary p-3">
                    لغو شده در {formatJalaliDate(new Date(d.cancelledAt))}؛
                    دلیل: {d.cancellationReason}. این سند از موجودی کسر نمی‌شود.
                  </p>
                ) : (
                  <FormModal
                    title="لغو ثبت پرداخت اشتباه"
                    description={`با لغو، ${formatToman(d.amountRial)} به موجودی ثبت‌شده برمی‌گردد و سند برای پیگیری باقی می‌ماند. این گزینه برای اصلاح ثبت اشتباه است.`}
                    trigger={
                      <Button variant="outline">لغو پرداخت اشتباه</Button>
                    }
                  >
                    <ActionForm
                      className="space-y-4"
                      success="پرداخت لغو شد و مبلغ به موجودی ثبت‌شده برگشت."
                      action={async (f) =>
                        voidExpensePayment(d.id, String(f.get("reason") || ""))
                      }
                    >
                      <label className="form-field">
                        <span>دلیل لغو</span>
                        <Input
                          name="reason"
                          required
                          maxLength={2000}
                          placeholder="مثلاً پرداخت انجام نشده و اشتباهی تأیید شده"
                        />
                      </label>
                      <Button type="submit" variant="destructive">
                        تأیید لغو و بازگرداندن موجودی
                      </Button>
                    </ActionForm>
                  </FormModal>
                )}
              </div>
            </FormModal>
          )}
        />
      </section>
    </div>
  );
}

function MobileCostList({
  costs,
  balance,
  today,
}: {
  costs: Cost[];
  balance: number;
  today: string;
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const rows = costs.filter((c) =>
    `${c.title} ${c.category} ${c.periodTitle}`.includes(search.trim()),
  );
  return (
    <div className="lg:hidden">
      <div className="px-5 pb-4">
        <SearchInput
          aria-label="جست‌وجوی هزینه در موبایل"
          label="جست‌وجوی هزینه یا دوره"
          placeholder="جست‌وجوی هزینه یا دوره"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ul className="divide-y divide-border">
        {(showAll ? rows : rows.slice(0, 5)).map((c) => (
          <li key={c.key} className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold break-words">{c.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.periodTitle} · {formatJalaliDate(new Date(c.date))}
                </p>
              </div>
              <CostPaymentButton cost={c} balance={balance} today={today} />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              {[
                ["برآورد", c.estimateRial],
                ["پرداخت واقعی", c.paidRial],
                ["مانده برآورد", c.remainingRial],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1 tabular-nums">
                    {formatToman(Number(value))}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="text-muted-foreground">وضعیت</dt>
                <dd className="mt-1">{c.state}</dd>
              </div>
            </dl>
            {c.directRial > 0 && (
              <p className="text-xs text-muted-foreground">
                از پرداخت واقعی، {formatToman(c.directRial)} از جیب واحدها
                پرداخت شده است.
              </p>
            )}
            {c.actualRial != null && (
              <p className="text-xs">مبلغ نهایی: {formatToman(c.actualRial)}</p>
            )}
          </li>
        ))}
      </ul>
      {!rows.length && (
        <p className="px-5 pb-5 text-sm text-muted-foreground">
          هزینه‌ای در این فهرست نیست.
        </p>
      )}
      {rows.length > 5 && (
        <div className="px-5 pb-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll
              ? "نمایش کمتر"
              : `نمایش همه ${toPersianDigits(String(rows.length))} هزینه`}
          </Button>
        </div>
      )}
    </div>
  );
}
