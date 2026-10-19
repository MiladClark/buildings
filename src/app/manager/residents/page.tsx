import { Select } from "@/components/ui/select";
import {
  ActionForm,
  ActionButton,
  EmptyState,
} from "@/components/finance/forms";
import { Button } from "@/components/ui/button";
import { assignResidentMembership, listUnits } from "@/lib/actions/building";
import { db } from "@/lib/db";
import { membership, user } from "@/lib/db/schema";

import { requireManager } from "@/lib/session";
import { unlinkResident } from "@/lib/actions/management";

export default async function ResidentsPage() {
  const { member } = await requireManager();
  const units = await listUnits();
  const users = await db.select().from(user);
  const memberships = await db.select().from(membership);
  const candidates = users.filter(
    (u) =>
      !memberships.some(
        (m) =>
          m.userId === u.id &&
          (m.role !== "resident" || m.buildingId !== member.buildingId),
      ),
  );
  const assigned = memberships.filter(
    (m) => m.buildingId === member.buildingId && m.role === "resident",
  );
  async function assign(f: FormData) {
    "use server";
    await assignResidentMembership(
      String(f.get("userId")),
      String(f.get("unitId")),
    );
  }
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>حساب ساکنان</h1>
          <p>
            این بخش اختیاری است؛ تمام ثبت‌ها و تسویه‌ها را می‌توانید خودتان در
            پنل مدیر انجام دهید. اتصال حساب فقط برای مشاهده فیش‌ها توسط ساکن
            است.
          </p>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="mb-6 panel-title">اتصال حساب به واحد</h2>
          {candidates.length && units.length ? (
            <ActionForm action={assign} className="space-y-5">
              <div className="form-field">
                <label htmlFor="assign-user">حساب ثبت‌نام‌شده</label>
                <Select id="assign-user" name="userId" required>
                  {candidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="form-field">
                <label htmlFor="assign-unit">واحد</label>
                <Select id="assign-unit" name="unitId" required>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      واحد {u.label}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit">ذخیره اتصال</Button>
            </ActionForm>
          ) : (
            <EmptyState
              title="حساب آماده اتصال نیست"
              description="ابتدا واحد را ایجاد کنید و از ساکن بخواهید در سامانه ثبت‌نام کند."
            />
          )}
        </section>
        <section className="panel p-6">
          <h2 className="mb-6 panel-title">ساکنان متصل‌شده</h2>
          {assigned.length ? (
            assigned.map((m) => {
              const u = users.find((u) => u.id === m.userId);
              return (
                <div
                  className="flex flex-wrap justify-between gap-3 border-t border-border py-4"
                  key={m.id}
                >
                  <div>
                    <p className="text-xs font-medium">{u?.name}</p>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {u?.email}
                    </p>
                  </div>
                  <span className="status status-success">
                    واحد{" "}
                    {units.find((u) => u.id === m.unitId)?.label ??
                      "تعیین نشده"}
                  </span>
                  {m.unitId && (
                    <ActionButton
                      variant="ghost"
                      action={async () => {
                        "use server";
                        await unlinkResident(m.id);
                      }}
                      confirm="اتصال حساب به واحد قطع شود؟ حساب کاربری باقی می‌ماند و بعداً می‌توانید دوباره متصلش کنید."
                    >
                      قطع اتصال
                    </ActionButton>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-xs leading-7 text-muted-foreground">
              هنوز حساب ساکنی به واحدهای این ساختمان متصل نشده است.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
