import { Select } from "@/components/ui/select";
import {
  ActionButton,
  ActionForm,
  FormModal,
} from "@/components/finance/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/finance/money-input";
import { tomanInputToRial } from "@/lib/format/money";
import {
  createCategory,
  listCategories,
  updateCategoryAllocation,
} from "@/lib/actions/building";

import { setRecordDeleted } from "@/lib/actions/management";

const methods = {
  per_person: "بر اساس نفرات",
  per_unit: "مساوی بین واحدها",
  fixed_per_unit: "مبلغ ثابت برای هر واحد",
  excluded: "شخصی، خارج از شارژ",
};
export default async function CategoriesPage() {
  const categories = await listCategories();
  async function create(f: FormData) {
    "use server";
    await createCategory({
      name: String(f.get("name")),
      allocationMethod: String(f.get("method")) as keyof typeof methods,
      includeEmptyUnits: f.get("empty") === "on",
      fixedMonthlyAmount: tomanInputToRial(f.get("fixedToman")) || undefined,
    });
  }
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>قواعد تقسیم هزینه</h1>
          <p>
            هر هزینه یک قاعده روشن؛ آب به تعداد نفرات، برق مشترک و آسانسور به
            تعداد واحدها.
          </p>
        </div>
        <FormModal
          title="دسته هزینه جدید"
          description="برای تعمیرات، خرید تجهیزات یا هر هزینه دیگر یک دسته اختصاصی تعریف کنید."
        >
          <ActionForm action={create} className="form-grid">
            <div className="form-field col-span-full">
              <label htmlFor="cat-name">نام دسته</label>
              <Input id="cat-name" name="name" required />
            </div>
            <div className="form-field col-span-full">
              <label htmlFor="cat-method">روش محاسبه</label>
              <Select id="cat-method" name="method">
                {Object.entries(methods).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="form-field">
              <label htmlFor="cat-fixed">مبلغ ثابت هر واحد (تومان)</label>
              <MoneyInput id="cat-fixed" name="fixedToman" />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" name="empty" />
              واحد خالی هم سهم داشته باشد
            </label>
            <Button type="submit" className="w-fit">
              افزودن دسته
            </Button>
          </ActionForm>
        </FormModal>
      </div>
      <div className="rounded-xl border border-border bg-secondary/50 p-5 text-xs leading-7 text-muted-foreground">
        درصد تعدیل فقط برای پیشنهاد شارژ آینده است. هزینه واقعی قبض و فیش‌های
        نهایی‌شده تغییر نمی‌کنند. گاز مستقل هر واحد در شارژ مشترک محاسبه
        نمی‌شود.
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {categories.map((c) => {
          async function save(f: FormData) {
            "use server";
            await updateCategoryAllocation(c.id, {
              name: String(f.get("name")),
              allocationMethod: String(f.get("method")) as keyof typeof methods,
              includeEmptyUnits: f.get("empty") === "on",
              fixedMonthlyAmount: tomanInputToRial(f.get("fixedToman")) || null,
              inflationPercent: Number(f.get("inflation")),
            });
          }
          return (
            <section key={c.id} className="panel p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-sm font-bold">{c.name}</h2>
                <span
                  className={`status ${c.allocationMethod === "excluded" ? "status-neutral" : "status-success"}`}
                >
                  {c.allocationMethod === "excluded"
                    ? "خارج از شارژ"
                    : "هزینه مشترک"}
                </span>
              </div>
              <ActionForm action={save} className="form-grid">
                <div className="form-field col-span-full">
                  <label htmlFor={`name-${c.id}`}>نام دسته هزینه</label>
                  <Input
                    id={`name-${c.id}`}
                    name="name"
                    defaultValue={c.name}
                    required
                    maxLength={150}
                  />
                </div>
                <div className="form-field col-span-full">
                  <label htmlFor={`method-${c.id}`}>روش تقسیم</label>
                  <Select
                    id={`method-${c.id}`}
                    name="method"
                    defaultValue={c.allocationMethod}
                  >
                    {Object.entries(methods).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="form-field">
                  <label htmlFor={`fixed-${c.id}`}>
                    مبلغ ثابت هر واحد (تومان)
                  </label>
                  <MoneyInput
                    id={`fixed-${c.id}`}
                    name="fixedToman"
                    defaultRial={c.fixedMonthlyAmount}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`inflation-${c.id}`}>
                    تعدیل پیشنهاد آینده (٪)
                  </label>
                  <Input
                    id={`inflation-${c.id}`}
                    name="inflation"
                    type="number"
                    min={-100}
                    max={1000}
                    defaultValue={c.inflationPercent ?? 0}
                  />
                </div>
                <label className="col-span-full flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="empty"
                    defaultChecked={c.includeEmptyUnits}
                  />
                  واحدهای خالی در هزینه واحدمحور سهم دارند
                </label>
                <Button
                  variant="outline"
                  type="submit"
                  size="sm"
                  className="w-fit"
                >
                  ذخیره قاعده
                </Button>
              </ActionForm>
              <div className="mt-4 border-t border-border pt-4">
                <ActionButton
                  variant="ghost"
                  action={async () => {
                    "use server";
                    await setRecordDeleted("category", c.id, true);
                  }}
                  confirm="دسته از فهرست ثبت هزینه کنار گذاشته شود؟ هزینه‌های موجود حفظ می‌شوند؛ شارژ ثابت خودکار این دسته در دوره‌های باز متوقف می‌شود. از سابقه و بازیابی قابل برگشت است."
                >
                  حذف دسته از فهرست
                </ActionButton>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
