"use client";

import { useId, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Download,
  House,
  Plus,
  Receipt,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { FieldHint } from "@/components/ui/field-hint";
import { ActionForm, EmptyState, FormModal } from "./forms";
import { MoneyInput } from "./money-input";
import { ReceiptForm } from "./receipt-form";
import { PaymentHistory, type PaymentHistoryRow } from "./payments";
import { downloadCsv } from "./data-grid";
import {
  rowLimitOptions,
  useTablePageSize,
  type RowLimit,
} from "./use-table-page-size";
import {
  unitAccountSummary,
  type AccountUnit,
  type UnitAccount,
} from "@/lib/billing/unit-accounts";
import type { CostShare } from "@/lib/billing/settlement-state";
import { releaseCostSettlement } from "@/lib/actions/management";
import { settleCostFromCredit } from "@/lib/actions/building";
import {
  formatToman,
  toPersianDigits as fa,
  toToman,
  tomanInputToRial,
} from "@/lib/format/money";
import { formatJalaliDate } from "@/lib/format/jalali";

type Props = {
  units: AccountUnit[];
  accounts: UnitAccount[];
  shares: CostShare[];
  receipts: PaymentHistoryRow[];
  standaloneCosts?: { id: string; description: string }[];
  today: string;
};

export function UnitAccounts(props: Props) {
  const { units, accounts, shares } = props;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const openedCard = useRef<HTMLButtonElement | null>(null);
  const [rowLimit, setRowLimit] = useTablePageSize("unit-account-cards", 10);
  const [page, setPage] = useState(0);
  const searchId = useId(),
    limitId = useId();
  const cards = units.map((u) =>
    unitAccountSummary(
      u,
      accounts.find((a) => a.unitId === u.id),
      shares,
    ),
  );
  const normalize = (value: string) =>
    value
      .replace(/[۰-۹]/g, (n) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(n)))
      .replace(/[٠-٩]/g, (n) => String("٠١٢٣٤٥٦٧٨٩".indexOf(n)))
      .replaceAll("ي", "ی")
      .replaceAll("ك", "ک")
      .toLocaleLowerCase("fa");
  const filtered = cards.filter(
    (u) =>
      (filter === "archived" ? u.deleted : !u.deleted) &&
      (filter === "all" || filter === "archived" || filter === "credit"
        ? filter !== "credit" || u.account.creditRial > 0
        : u.state === filter) &&
      normalize(`واحد ${u.label} ${u.name}`).includes(normalize(search.trim())),
  );
  const size = rowLimit === "all" ? Math.max(1, filtered.length) : rowLimit;
  const lastPage = Math.max(0, Math.ceil(filtered.length / size) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = filtered.slice(currentPage * size, (currentPage + 1) * size);
  const selected = cards.find((u) => u.id === selectedId);
  return (
    <section className="space-y-5" aria-labelledby="unit-accounts-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="unit-accounts-title" className="text-lg font-bold">
            پرونده مالی واحدها
          </h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            هر واحد، یک حساب روشن. برای مشاهده جزئیات و مدیریت تسویه، کارت واحد
            را باز کنید.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadCsv(
              "unit-accounts",
              [
                "واحد",
                "ساکن / مالک",
                "مانده کل هزینه‌ها (تومان)",
                "بدهی فیش‌ها (تومان)",
                "مانده پیش‌نویس (تومان)",
                "بستانکاری آزاد (تومان)",
                "مبلغ محفوظ (تومان)",
                "کل واریز و اعتبار (تومان)",
              ],
              filtered.map((u) => [
                u.label,
                u.name,
                toToman(u.unpaidRial),
                toToman(u.account.debtRial),
                toToman(u.draftBalanceRial),
                toToman(u.account.creditRial),
                toToman(u.account.reservedRial),
                toToman(u.account.receivedRial),
              ]),
            )
          }
        >
          <Download size={16} />
          خروجی حساب‌ها
        </Button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          label="جست‌وجوی واحد یا نام ساکن"
          id={searchId}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="شماره واحد یا نام ساکن را جست‌وجو کنید"
        />
        <Select
          value={filter}
          onValueChange={(v) => {
            setFilter(v);
            setPage(0);
          }}
          aria-label="فیلتر وضعیت حساب واحدها"
          className="sm:!w-56"
        >
          <option value="all">همه واحدهای فعال</option>
          <option value="unpaid">دارای مانده هزینه</option>
          <option value="credit">دارای بستانکاری آزاد</option>
          <option value="settled">تسویه‌شده</option>
          <option value="empty">بدون هزینه</option>
          <option value="archived">واحدهای حذف‌شده</option>
        </Select>
      </div>
      {visible.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={(e) => {
                openedCard.current = e.currentTarget;
                setSelectedId(u.id);
              }}
              aria-label={`مشاهده حساب واحد ${fa(u.label)}، ${u.name}`}
              className="group min-w-0 rounded-2xl border border-border bg-card p-5 text-start transition-colors hover:border-primary/60 focus-visible:border-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-lg font-bold text-primary">
                    {fa(u.label)}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold">واحد {fa(u.label)}</h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {u.name}
                    </p>
                  </div>
                </div>
                <span
                  className={`status ${u.state === "unpaid" ? "status-warning" : u.state === "empty" ? "" : "status-success"}`}
                >
                  {u.deleted ? "حذف‌شده" : u.stateLabel}
                </span>
              </div>
              <div className="my-5">
                <p className="text-[11px] text-muted-foreground">
                  مانده هزینه‌ها
                </p>
                <p className="mt-2 text-xl font-bold tabular-nums">
                  {formatToman(u.unpaidRial)}
                </p>
                <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
                  {u.outstandingCount
                    ? `${fa(String(u.outstandingCount))} هزینه تسویه‌نشده`
                    : "هزینه تسویه‌نشده‌ای ندارد"}
                  {u.draftBalanceRial > 0 ? " · شامل پیش‌نویس" : ""}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-[11px]">
                <div>
                  <dt className="text-muted-foreground">بستانکاری آزاد</dt>
                  <dd className="mt-2 font-semibold text-primary">
                    {formatToman(u.account.creditRial)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">واریز و اعتبار</dt>
                  <dd className="mt-2 font-semibold">
                    {formatToman(u.account.receivedRial)}
                  </dd>
                </div>
              </dl>
              <div className="mt-5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span>
                  {u.account.reservedRial > 0
                    ? `مبلغ محفوظ: ${formatToman(u.account.reservedRial)}`
                    : u.occupancy}
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  ورود به حساب
                  <ArrowLeft
                    size={14}
                    className="transition-transform group-hover:-translate-x-1 motion-reduce:transform-none"
                  />
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            title="واحدی پیدا نشد"
            description="نام یا شماره واحد و فیلتر وضعیت را بررسی کنید."
          />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p role="status">
          {fa(String(filtered.length))} واحد
          {filtered.length
            ? ` · نمایش ${fa(String(currentPage * size + 1))} تا ${fa(String(Math.min((currentPage + 1) * size, filtered.length)))}`
            : ""}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={limitId}>تعداد کارت‌ها</label>
          <Select
            id={limitId}
            value={String(rowLimit)}
            onValueChange={(v) => {
              setRowLimit(v === "all" ? "all" : (Number(v) as RowLimit));
              setPage(0);
            }}
            className="!w-24 !min-h-9 !h-9"
          >
            {rowLimitOptions.map((n) => (
              <option key={n} value={n}>
                {n === "all" ? "همه" : fa(String(n))}
              </option>
            ))}
          </Select>
          {lastPage > 0 && (
            <>
              <Button
                variant="outline"
                size="icon"
                aria-label="صفحه قبل واحدها"
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronRight />
              </Button>
              <span>
                صفحه {fa(String(currentPage + 1))} از {fa(String(lastPage + 1))}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="صفحه بعد واحدها"
                disabled={currentPage === lastPage}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronLeft />
              </Button>
            </>
          )}
        </div>
      </div>
      <Dialog.Root
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="motion-overlay fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
          <Dialog.Content
            dir="rtl"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              openedCard.current?.focus();
            }}
            className="motion-dialog fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100%-24px)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-7">
              <div>
                <Dialog.Title className="text-lg font-bold">
                  حساب واحد {selected ? fa(selected.label) : ""}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                  {selected?.name} · {selected?.occupancy}
                  {selected?.deleted ? " · واحد حذف‌شده" : ""}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="بستن پرونده واحد"
                >
                  <X size={20} />
                </Button>
              </Dialog.Close>
            </div>
            {selected && (
              <UnitAccountDetail
                key={selected.id}
                {...props}
                selected={selected}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

function UnitAccountDetail({
  selected,
  shares,
  receipts,
  units,
  standaloneCosts,
  today,
}: Props & { selected: ReturnType<typeof unitAccountSummary> }) {
  const [tab, setTab] = useState("costs");
  const [receiptPurpose, setReceiptPurpose] = useState<
    { periodId: string; categoryId: string } | undefined
  >();
  const [receiptVersion, setReceiptVersion] = useState(0);
  const [period, setPeriod] = useState("all");
  const [costFilter, setCostFilter] = useState(
    shares.some((s) => s.unitId === selected.id && s.balanceRial > 0)
      ? "unpaid"
      : "all",
  );
  const ownShares = shares.filter((s) => s.unitId === selected.id);
  const ownReceipts = receipts.filter((r) => r.unitId === selected.id);
  const periods = [
    ...new Map(ownShares.map((s) => [s.periodId, s.periodTitle])).entries(),
  ];
  const costs = ownShares.filter(
    (s) =>
      (period === "all" || s.periodId === period) &&
      (costFilter === "all" ||
        (costFilter === "unpaid"
          ? s.balanceRial > 0
          : costFilter === "draft"
            ? s.draft
            : s.amountRial > 0 && s.balanceRial === 0)),
  );
  const beginReceipt = (purpose?: { periodId: string; categoryId: string }) => {
    setReceiptPurpose(purpose);
    setReceiptVersion((v) => v + 1);
    setTab("new");
  };
  return (
    <div className="min-h-0 overflow-y-auto overscroll-contain">
      <div className="p-5 sm:p-7">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {[
            {
              label: "کل واریز و اعتبار ثبت‌شده",
              value: selected.account.receivedRial,
              hint: "جمع واریزهای فعال و پرداخت‌های مستقیم از جیب این واحد است. پرداخت مستقیم، درآمد نقدی صندوق نیست. ثبت ابطال‌شده حساب نمی‌شود.",
            },
            {
              label: "بستانکاری آزاد",
              value: selected.account.creditRial,
              hint: "پولی که دریافت شده ولی هنوز بابت هزینه‌ای مصرف نشده است. با دکمه «از بستانکاری» می‌توانید آن را به هزینه دلخواه تخصیص دهید.",
            },
            {
              label: "مبلغ محفوظ",
              value: selected.account.reservedRial,
              hint: "مبالغ محفوظ بابت هزینه‌های مستقل و دوره‌های پیش‌نویس است. مبلغ مستقل فقط با انتقال هزینه به دوره وارد محاسبه سهم و بستانکاری آزاد می‌شود.",
            },
            {
              label: "بدهی فیش‌های صادرشده",
              value: selected.account.debtRial,
              hint: "جمع مانده فیش‌های نهایی‌شده است؛ هزینه‌های پیش‌نویس در این عدد نیستند. بستانکاری آزاد هم خودکار از این عدد کم نمی‌شود تا آن را تخصیص دهید.",
            },
          ].map((m) => (
            <div key={m.label}>
              <div className="flex min-h-7 items-center gap-1 text-[11px] text-muted-foreground">
                <span>{m.label}</span>
                <FieldHint label={m.label}>{m.hint}</FieldHint>
              </div>
              <p
                className={`mt-3 text-base font-bold ${m.label === "بستانکاری آزاد" ? "text-primary" : ""}`}
              >
                {formatToman(m.value)}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3 text-xs leading-6">
          <span>
            مانده هزینه‌های پیش‌نویس:{" "}
            <strong>{formatToman(selected.draftBalanceRial)}</strong>
          </span>
          <span className="text-muted-foreground">
            مانده خالص فیش‌ها:{" "}
            {formatToman(Math.abs(selected.account.balanceRial))}{" "}
            {selected.account.balanceRial > 0
              ? "بدهکار"
              : selected.account.balanceRial < 0
                ? "بستانکار"
                : "تسویه"}
          </span>
        </div>
      </div>
      <Tabs.Root value={tab} onValueChange={setTab} dir="rtl">
        <Tabs.List
          aria-label="بخش‌های حساب واحد"
          className="flex gap-1 border-y border-border bg-muted/40 px-3 sm:px-6"
        >
          {[
            { id: "costs", title: "هزینه‌ها و تسویه", Icon: Wallet },
            {
              id: "receipts",
              title: `واریزها (${fa(String(ownReceipts.length))})`,
              Icon: Receipt,
            },
            ...(!selected.deleted
              ? [{ id: "new", title: "ثبت دریافت", Icon: Plus }]
              : []),
          ].map(({ id, title, Icon }) => (
            <Tabs.Trigger
              key={id}
              value={id}
              className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap border-b-2 border-transparent px-2 py-3 text-[11px] font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary sm:flex-none sm:px-3 sm:text-xs"
            >
              <Icon size={17} className="hidden sm:block" />
              {title}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="costs" className="p-5 sm:p-7">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <Select
              value={period}
              onValueChange={setPeriod}
              aria-label="دوره مالی حساب واحد"
              className="sm:!w-72"
            >
              <option value="all">همه دوره‌های مالی</option>
              {periods.map(([id, title]) => (
                <option value={id} key={id}>
                  {title}
                </option>
              ))}
            </Select>
            <Select
              value={costFilter}
              onValueChange={setCostFilter}
              aria-label="وضعیت هزینه‌های واحد"
              className="sm:!w-48"
            >
              <option value="all">همه هزینه‌ها</option>
              <option value="unpaid">تسویه‌نشده</option>
              <option value="settled">تسویه‌شده</option>
              <option value="draft">پیش‌نویس</option>
            </Select>
            <Button
              className="sm:ms-auto"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  `unit-${selected.label}-costs`,
                  [
                    "هزینه",
                    "دوره",
                    "مرحله",
                    "سهم واحد (تومان)",
                    "تسویه‌شده (تومان)",
                    "مانده (تومان)",
                  ],
                  costs.map((s) => [
                    s.title,
                    s.periodTitle,
                    s.draft ? "پیش‌نویس" : "فیش صادرشده",
                    toToman(s.amountRial),
                    toToman(s.paidRial),
                    toToman(s.balanceRial),
                  ]),
                )
              }
            >
              <Download size={15} />
              خروجی هزینه‌ها
            </Button>
          </div>
          {costs.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {costs.map((s) => (
                <article
                  key={JSON.stringify([s.periodId, s.categoryId])}
                  className="rounded-xl border border-border p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        {s.title}
                        {s.amountRial > 0 && s.balanceRial === 0 && (
                          <CircleCheck
                            size={17}
                            strokeWidth={2.25}
                            className="text-primary"
                          />
                        )}
                      </h3>
                      <Link
                        href={`/manager/periods/${s.periodId}`}
                        className="mt-2 inline-block text-[11px] text-muted-foreground hover:text-primary"
                      >
                        {s.periodTitle} · {s.draft ? "پیش‌نویس" : "فیش صادرشده"}
                      </Link>
                    </div>
                    <span
                      className={`status ${s.amountRial === 0 ? "" : s.balanceRial === 0 ? "status-success" : "status-warning"}`}
                    >
                      {s.amountRial === 0
                        ? "سهم ندارد"
                        : s.balanceRial === 0
                          ? "تسویه‌شده"
                          : s.paidRial
                            ? "پرداخت ناقص"
                            : "پرداخت‌نشده"}
                    </span>
                  </div>
                  <dl className="my-4 grid grid-cols-3 gap-3 text-[11px]">
                    <div>
                      <dt className="text-muted-foreground">سهم واحد</dt>
                      <dd className="mt-2 font-medium">
                        {formatToman(s.amountRial)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        {s.draft ? "پیش‌پرداخت" : "تسویه‌شده"}
                      </dt>
                      <dd className="mt-2 font-medium text-primary">
                        {formatToman(s.paidRial)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">مانده هزینه</dt>
                      <dd className="mt-2 font-bold">
                        {formatToman(s.balanceRial)}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    {s.categoryId && s.balanceRial > 0 && !selected.deleted && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          beginReceipt({
                            periodId: s.periodId,
                            categoryId: s.categoryId!,
                          })
                        }
                      >
                        <Plus size={14} />
                        ثبت واریز
                      </Button>
                    )}
                    {s.balanceRial > 0 && selected.account.creditRial > 0 && (
                      <AllocationForm
                        share={s}
                        credit={selected.account.creditRial}
                        mode="apply"
                      />
                    )}
                    {s.paidRial > 0 && (
                      <AllocationForm
                        share={s}
                        credit={selected.account.creditRial}
                        mode="release"
                      />
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="هزینه‌ای در این فیلتر نیست"
              description="دوره یا وضعیت را تغییر دهید؛ هزینه‌های ساختمان از صفحه دوره مالی اضافه می‌شوند."
            />
          )}
          <p className="mt-5 text-[11px] leading-7 text-muted-foreground">
            بستانکاری آزاد را می‌توانید به یک هزینه اختصاص دهید. برگشت تسویه،
            پول را به بستانکاری برمی‌گرداند و اصل واریز را حذف نمی‌کند.
            پیش‌پرداخت تا صدور فیش، بابت همان هزینه محفوظ است.
          </p>
        </Tabs.Content>
        <Tabs.Content value="receipts" className="min-w-0 pb-5">
          <PaymentHistory
            unitDetail
            units={units.map((u) => ({
              id: u.id,
              label: u.deleted ? `${u.label} (حذف‌شده)` : u.label,
            }))}
            shares={shares}
            rows={ownReceipts}
          />
          {!selected.deleted && (
            <div className="px-5 pt-4 sm:px-7">
              <Button onClick={() => beginReceipt()}>
                <Plus size={16} />
                ثبت واریز برای این واحد
              </Button>
            </div>
          )}
        </Tabs.Content>
        {!selected.deleted && (
          <Tabs.Content value="new" className="p-5 sm:p-7">
            <div className="mb-5 flex items-center gap-2 text-sm font-medium">
              <House size={20} />
              دریافت از واحد {fa(selected.label)} · {selected.name}
            </div>
            <ReceiptForm
              key={receiptVersion}
              lockUnit
              units={[{ id: selected.id, label: selected.label }]}
              shares={ownShares}
              standaloneCosts={standaloneCosts}
              today={today}
              defaultUnitId={selected.id}
              defaultPurpose={receiptPurpose}
              onSaved={() => {
                setTab("receipts");
                setReceiptVersion((v) => v + 1);
              }}
            />
          </Tabs.Content>
        )}
      </Tabs.Root>
      {ownReceipts[0] && (
        <p className="border-t border-border px-5 py-4 text-[10px] text-muted-foreground sm:px-7">
          آخرین واریز: {formatJalaliDate(new Date(ownReceipts[0].date))} ·{" "}
          {formatToman(ownReceipts[0].amount)}
        </p>
      )}
    </div>
  );
}

function AllocationForm({
  share,
  credit,
  mode,
}: {
  share: CostShare;
  credit: number;
  mode: "apply" | "release";
}) {
  const maximum =
    mode === "apply" ? Math.min(share.balanceRial, credit) : share.paidRial;
  const amountId = useId();
  return (
    <FormModal
      title={mode === "apply" ? "استفاده از بستانکاری" : "برگشت به بستانکاری"}
      description={`${share.title} · ${share.periodTitle}. ${mode === "apply" ? "بخشی از اعتبار آزاد را به این هزینه اختصاص دهید؛ واریز جدیدی ثبت نمی‌شود." : "تمام یا بخشی از تسویه را به اعتبار آزاد برگردانید؛ اصل واریز باقی می‌ماند."}`}
      trigger={
        <Button variant={mode === "apply" ? "secondary" : "ghost"} size="sm">
          {mode === "apply" ? "از بستانکاری" : "برگشت به بستانکاری"}
        </Button>
      }
    >
      <ActionForm
        className="space-y-5"
        success={
          mode === "apply"
            ? "بستانکاری به هزینه اختصاص یافت."
            : "مبلغ به بستانکاری واحد برگشت."
        }
        action={async (f) => {
          const amountRial = tomanInputToRial(f.get("amountToman"));
          if (amountRial <= 0 || amountRial > maximum)
            throw new Error(
              "مبلغ باید بیشتر از صفر و حداکثر برابر مبلغ قابل استفاده باشد.",
            );
          const payload = {
            unitId: share.unitId,
            periodId: share.periodId,
            categoryId: share.categoryId,
            amountRial,
          };
          if (mode === "apply") await settleCostFromCredit(payload);
          else await releaseCostSettlement(payload);
        }}
      >
        <div className="rounded-xl bg-muted p-4 text-xs leading-7">
          <p>
            مبلغ قابل {mode === "apply" ? "استفاده" : "برگشت"}:{" "}
            <strong>{formatToman(maximum)}</strong>
          </p>
          <p className="text-muted-foreground">
            می‌توانید مبلغ کمتری وارد کنید.
          </p>
        </div>
        <div className="form-field">
          <label htmlFor={amountId}>مبلغ (تومان)</label>
          <MoneyInput
            id={amountId}
            name="amountToman"
            defaultRial={maximum}
            required
          />
        </div>
        <Button type="submit">
          {mode === "apply"
            ? "تخصیص اعتبار به هزینه"
            : "برگشت مبلغ به بستانکاری"}
        </Button>
      </ActionForm>
    </FormModal>
  );
}
