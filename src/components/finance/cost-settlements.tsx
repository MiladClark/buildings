"use client";
import { Select } from "@/components/ui/select";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { DataGrid } from "./data-grid";
import { ActionButton } from "./forms";
import { releaseCostSettlement } from "@/lib/actions/management";
import { settleCostFromCredit } from "@/lib/actions/building";
import type { CostShare } from "@/lib/billing/settlement-state";
import { formatToman } from "@/lib/format/money";

export function CostSettlements({
  shares,
  units,
  accounts,
  resident = false,
}: {
  shares: CostShare[];
  units: { id: string; label: string; deletedAt?: Date | null }[];
  accounts: { unitId: string; creditRial: number }[];
  resident?: boolean;
}) {
  const [selectedScope, setScope] = useState("all");
  const choices = [
    ...new Map(
      shares.map((s) => [
        JSON.stringify([s.periodId, s.categoryId]),
        `${s.title} · ${s.periodTitle}`,
      ]),
    ).entries(),
  ];
  const scope =
    selectedScope === "all" || choices.some(([id]) => id === selectedScope)
      ? selectedScope
      : "all";
  const rows = shares
    .filter(
      (s) =>
        scope === "all" || JSON.stringify([s.periodId, s.categoryId]) === scope,
    )
    .map((s) => ({
      ...s,
      unitLabel: `واحد ${units.find((u) => u.id === s.unitId)?.label ?? ""}`,
      kind: s.draft ? "پیش‌نویس / پیش‌پرداخت" : "فیش صادرشده",
      status:
        s.amountRial === 0
          ? "سهم ندارد"
          : s.balanceRial === 0
            ? "تسویه‌شده"
            : s.paidRial > 0
              ? "پرداخت ناقص"
              : "پرداخت‌نشده",
      credit: accounts.find((a) => a.unitId === s.unitId)?.creditRial ?? 0,
    }));
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">تسویه به تفکیک هزینه</h2>
          <p className="panel-subtitle">
            مشخص است هر واحد بابت نظافت، آب و سایر هزینه‌ها چقدر پرداخت کرده است
          </p>
        </div>
        <Select
          aria-label="فیلتر موضوع پرداخت"
          value={scope}
          onValueChange={(value) => setScope(value)}
          className="!max-w-full text-xs"
        >
          <option value="all">همه هزینه‌ها و دوره‌ها</option>
          {choices.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <DataGrid
        data={rows}
        filename={resident ? "my-cost-settlements" : "cost-settlements"}
        searchPlaceholder="جست‌وجوی واحد، هزینه یا دوره"
        columns={[
          { key: "unitLabel", label: "واحد" },
          { key: "title", label: "بابت" },
          { key: "periodTitle", label: "دوره" },
          { key: "amountRial", label: "سهم واحد", type: "money" },
          { key: "paidRial", label: "پرداخت‌شده", type: "money" },
          { key: "balanceRial", label: "مانده هزینه", type: "money" },
          { key: "status", label: "وضعیت", type: "status" },
          { key: "kind", label: "مرحله" },
        ]}
        renderAction={
          resident
            ? undefined
            : (r) => (
                <div className="flex gap-1">
                  {r.categoryId &&
                    r.balanceRial > 0 &&
                    !units.find((u) => u.id === r.unitId)?.deletedAt && (
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/manager/payments?new=1&unit=${r.unitId}&period=${r.periodId}&category=${r.categoryId}`}
                        >
                          ثبت واریز
                        </Link>
                      </Button>
                    )}
                  {r.balanceRial > 0 && r.credit > 0 ? (
                    <ActionButton
                      variant="outline"
                      action={() =>
                        settleCostFromCredit({
                          unitId: r.unitId,
                          periodId: r.periodId,
                          categoryId: r.categoryId,
                        })
                      }
                      confirm={`تا ${formatToman(Math.min(r.balanceRial, r.credit))} از بستانکاری ${r.unitLabel} بابت ${r.title} استفاده شود؟ دریافت جدیدی ثبت نمی‌شود.`}
                    >
                      از بستانکاری
                    </ActionButton>
                  ) : null}
                  {r.paidRial > 0 && (
                    <ActionButton
                      variant="ghost"
                      action={() =>
                        releaseCostSettlement({
                          unitId: r.unitId,
                          periodId: r.periodId,
                          categoryId: r.categoryId,
                        })
                      }
                      confirm={`تسویه ${r.title} برای ${r.unitLabel} برگشت بخورد؟ ${formatToman(r.paidRial)} بستانکاری می‌شود؛ واریز واقعی حذف نمی‌شود و می‌توانید آن را به هزینه درست اختصاص دهید.`}
                    >
                      برگشت تسویه
                    </ActionButton>
                  )}
                </div>
              )
        }
      />
      <p className="border-t border-border px-5 py-4 text-[10px] leading-6 text-muted-foreground">
        مبالغ پیش‌نویس تا صدور فیش قابل تغییرند. مبلغ آزادشده از سهم پیش‌نویس به
        بستانکاری برمی‌گردد. واریزهای قدیمیِ بدون موضوع، مطابق تسویه قبلی فیش‌ها
        و به‌ترتیب اقلام آن نمایش داده می‌شوند.
      </p>
    </section>
  );
}
