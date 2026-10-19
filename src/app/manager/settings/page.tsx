import { ActionForm } from "@/components/finance/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateBuildingSettings } from "@/lib/actions/building";
import { getBuildingForUser } from "@/lib/queries/dashboard";
import { requireManager } from "@/lib/session";
export default async function SettingsPage() {
  const { session } = await requireManager();
  const ctx = await getBuildingForUser(session.user.id);
  if (!ctx) return null;
  const b = ctx.building;
  async function save(f: FormData) {
    "use server";
    await updateBuildingSettings({
      name: String(f.get("name")),
      address: String(f.get("address") || ""),
      bankAccount: String(f.get("bankAccount") || ""),
      bankSheba: String(f.get("bankSheba") || ""),
      paymentDueDay: Number(f.get("paymentDueDay")),
      perUnitIncludeEmpty: f.get("perUnitIncludeEmpty") === "on",
    });
  }
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>تنظیمات ساختمان</h1>
          <p>اطلاعات ساختمان، حساب دریافت شارژ و قواعد عمومی.</p>
        </div>
      </div>
      <ActionForm
        action={save}
        className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]"
      >
        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="mb-6 panel-title">مشخصات ساختمان</h2>
            <div className="form-grid">
              <div className="form-field col-span-full">
                <label htmlFor="b-name">نام ساختمان</label>
                <Input id="b-name" name="name" defaultValue={b.name} required />
              </div>
              <div className="form-field col-span-full">
                <label htmlFor="b-address">آدرس</label>
                <Input
                  id="b-address"
                  name="address"
                  defaultValue={b.address ?? ""}
                />
              </div>
            </div>
          </section>
          <section className="panel p-6">
            <h2 className="mb-3 panel-title">حساب دریافت شارژ</h2>
            <p className="mb-6 text-xs leading-7 text-muted-foreground">
              ساکنان مبلغ را به حساب زیر واریز می‌کنند و اطلاعات واریز را برای
              تأیید شما ثبت می‌کنند.
            </p>
            <div className="form-grid">
              <div className="form-field col-span-full">
                <label htmlFor="b-account">شماره حساب یا کارت</label>
                <Input
                  id="b-account"
                  name="bankAccount"
                  dir="ltr"
                  defaultValue={b.bankAccount ?? ""}
                />
              </div>
              <div className="form-field col-span-full">
                <label htmlFor="b-sheba">شماره شبا</label>
                <Input
                  id="b-sheba"
                  name="bankSheba"
                  dir="ltr"
                  defaultValue={b.bankSheba ?? ""}
                  placeholder="IR"
                />
              </div>
            </div>
          </section>
        </div>
        <section className="panel p-6">
          <h2 className="mb-6 panel-title">قاعده‌های عمومی</h2>
          <div className="form-field">
            <label htmlFor="b-due">روز سررسید در ماه شمسی بعد</label>
            <Input
              id="b-due"
              name="paymentDueDay"
              type="number"
              min={1}
              max={28}
              defaultValue={b.paymentDueDay}
              required
            />
            <p className="text-[11px] leading-7 text-muted-foreground">
              مثلاً با انتخاب روز ۱۰، سررسید دوره مهر در دهم آبان خواهد بود.
              تاریخ دوره‌های قبلی تغییر نمی‌کند.
            </p>
          </div>
          <label className="my-6 flex items-start gap-3 border-t border-border pt-6 text-xs leading-7">
            <input
              className="mt-1.5 shrink-0"
              type="checkbox"
              name="perUnitIncludeEmpty"
              defaultChecked={b.perUnitIncludeEmpty}
            />
            <span>
              واحدهای خالی در تمام هزینه‌های واحدمحور سهم داشته باشند.
              <span className="mt-2 block text-[10px] text-muted-foreground">
                با خاموش بودن این گزینه، تنظیم اختصاصی هر دسته تعیین‌کننده است.
                آب همیشه فقط بین ساکنان تقسیم می‌شود.
              </span>
            </span>
          </label>
          <Button type="submit" className="w-full">
            ذخیره تنظیمات ساختمان
          </Button>
        </section>
      </ActionForm>
    </div>
  );
}
