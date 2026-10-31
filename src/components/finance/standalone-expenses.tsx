"use client";
import { RowActions } from "@/components/ui/row-actions";
import { useState } from "react";
import { DataGrid } from "./data-grid";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ActionButton, ActionForm, FormModal } from "./forms";
import {
  deleteStandaloneExpense,
  moveStandaloneExpense,
  unbillStandaloneExpense,
} from "@/lib/actions/standalone-expenses";

export function StandaloneExpenses({
  rows,
  initialFilter = "all",
}: {
  initialFilter?: string;
  rows: {
    id: string;
    description: string;
    category: string;
    date: string;
    amount: number;
    receipts: number;
    advances: number;
    state: string;
    deleted: boolean;
  }[];
}) {
  const [filter, setFilter] = useState(initialFilter);
  return (
    <section className="panel" id="independent-costs">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">دفتر هزینه‌های مستقل</h2>
          <p className="panel-subtitle">
            ثبت هزینه و پرداخت‌ها، بدون اضافه‌شدن خودکار به شارژ
          </p>
        </div>
        <Select
          aria-label="فیلتر هزینه‌های مستقل"
          value={filter}
          onValueChange={setFilter}
        >
          <option value="pending">خارج از شارژ</option>
          <option value="linked">منتقل‌شده به دوره</option>
          <option value="all">همه هزینه‌های فعال</option>
          <option value="deleted">حذف‌شده و قابل بازیابی</option>
        </Select>
      </div>
      <DataGrid
        data={rows.filter((r) =>
          filter === "deleted"
            ? r.deleted
            : !r.deleted &&
              (filter === "all" ||
                (filter === "pending"
                  ? r.state === "مستقل"
                  : r.state !== "مستقل")),
        )}
        filename="independent-expenses"
        searchPlaceholder="جست‌وجوی هزینه مستقل"
        columns={[
          { key: "description", label: "شرح هزینه" },
          { key: "category", label: "دسته" },
          { key: "date", label: "تاریخ" },
          { key: "amount", label: "مبلغ کل", type: "money" },
          { key: "receipts", label: "واریز به مدیر", type: "money" },
          { key: "advances", label: "از جیب واحدها", type: "money" },
          { key: "state", label: "محل ثبت" },
        ]}
        emptyTitle="هزینه مستقلی در این فهرست نیست"
        emptyDescription="از «ثبت هزینه جدید»، حالت «مستقل؛ فعلاً خارج از شارژ» را انتخاب کنید."
        renderAction={(r) => (
          <div className="flex items-center gap-2">
            {!r.deleted && r.state !== "مستقل" && (
              <ActionButton
                action={unbillStandaloneExpense.bind(null, r.id)}
                variant="outline"
                confirm="هزینه مستقل از دوره خارج شود؟ واریزها حفظ می‌شوند؛ اگر فیش صادر شده، دوره برای اصلاح باز می‌شود."
                success="هزینه به دفتر مستقل برگشت و واریزهای آن حفظ شدند."
              >
                خارج‌کردن از دوره
              </ActionButton>
            )}
            <RowActions
              items={[
                {
                  label: "پرونده هزینه",
                  href: `/manager/expenses/independent/${r.id}`,
                },
              ]}
            />
          </div>
        )}
      />
    </section>
  );
}

export function StandaloneCostActions({
  id,
  deleted,
  linked,
  periods,
}: {
  id: string;
  deleted: boolean;
  linked: boolean;
  periods: { id: string; title: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {deleted ? (
        <ActionButton action={() => deleteStandaloneExpense(id, false)}>
          بازیابی هزینه
        </ActionButton>
      ) : (
        <>
          {linked ? (
            <ActionButton
              action={() => unbillStandaloneExpense(id)}
              confirm="هزینه از شارژ خارج شود؟ اگر فیش صادر شده باشد، دوره برای اصلاح باز می‌شود و باید دوباره فیش صادر کنید. تخصیص‌های پرداخت‌های مرتبط برگشت می‌خورند و مبلغ برای این هزینه مستقل محفوظ می‌ماند؛ پولی به کسی برگردانده نمی‌شود."
            >
              خارج‌کردن از شارژ
            </ActionButton>
          ) : (
            <FormModal
              title="انتقال به شارژ دوره"
              description="هزینه یک‌بار وارد دفتر دوره می‌شود. اگر از محل شارژ تأمین شود، واریزهای قبلی بابت شارژ همان واحد حساب می‌شوند؛ در دریافت جداگانه، بابت سهم همین هزینه. مبلغ اضافه بستانکاری می‌ماند."
              trigger={
                <Button variant="outline" disabled={!periods.length}>
                  انتقال به شارژ دوره
                </Button>
              }
            >
              <ActionForm
                action={async (f) =>
                  moveStandaloneExpense(
                    id,
                    String(f.get("periodId")),
                    String(f.get("billingTreatment") || "auto") as
                      "auto" | "separate",
                  )
                }
                className="space-y-4"
              >
                <div className="form-field">
                  <label htmlFor="standalone-period">دوره باز مقصد</label>
                  <Select id="standalone-period" name="periodId" required>
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="form-field">
                  <label htmlFor="standalone-treatment">روش تأمین هزینه</label>
                  <Select
                    id="standalone-treatment"
                    name="billingTreatment"
                    defaultValue="auto"
                  >
                    <option value="auto">از محل شارژ؛ آب بر اساس نفرات</option>
                    <option value="separate">
                      دریافت جداگانه (فوق‌العاده)
                    </option>
                  </Select>
                </div>
                <Button type="submit">انتقال و محاسبه پرداخت‌های قبلی</Button>
              </ActionForm>
            </FormModal>
          )}
          {!linked && (
            <ActionButton
              variant="ghost"
              action={() => deleteStandaloneExpense(id, true)}
              confirm="هزینه حذف شود؟ فقط هزینه بدون پرداخت فعال قابل حذف است. اگر ثبت اشتباهی دارید ابتدا آن پرداخت را ابطال کنید؛ حذف و ابطال، برگشت واقعی وجه نیست. هزینه از فهرست حذف‌شده‌ها قابل بازیابی است."
            >
              حذف هزینه
            </ActionButton>
          )}
        </>
      )}
      {!linked && !deleted && !periods.length && (
        <p className="w-full text-xs text-muted-foreground">
          برای انتقال، ابتدا یک دوره مالی باز ایجاد کنید.
        </p>
      )}
    </div>
  );
}
