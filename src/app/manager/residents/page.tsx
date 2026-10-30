import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { account, membership, unit, user } from "@/lib/db/schema";
import { requireManager } from "@/lib/session";
import {
  BuildingAccountForm,
  BuildingAccountList,
} from "@/components/finance/building-accounts";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/finance/forms";
import { Plus } from "lucide-react";

export default async function ResidentsPage() {
  const { member, session } = await requireManager();
  const [people, units] = await Promise.all([
    db
      .select({ member: membership, person: user })
      .from(membership)
      .innerJoin(user, eq(membership.userId, user.id))
      .where(eq(membership.buildingId, member.buildingId)),
    db
      .select({ id: unit.id, label: unit.label, deletedAt: unit.deletedAt })
      .from(unit)
      .where(eq(unit.buildingId, member.buildingId))
      .orderBy(unit.sortOrder, unit.label),
  ]);
  const identities = people.length
    ? await db
        .select({
          userId: account.userId,
          providerId: account.providerId,
          password: account.password,
        })
        .from(account)
        .where(
          inArray(
            account.userId,
            people.map((p) => p.person.id),
          ),
        )
    : [];
  const active = new Set(
    identities
      .filter((a) => a.password || a.providerId !== "credential")
      .map((a) => a.userId),
  );
  const unitOptions = units
    .filter((u) => !u.deletedAt)
    .map(({ id, label }) => ({ id, label }));
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>حساب‌ها و دسترسی‌ها</h1>
          <p>
            شماره را ثبت کنید و نقش ساکن یا مدیر ساختمان را انتخاب کنید؛ ورود
            همه از همان صفحه ورود است.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/manager/account">تنظیمات حساب من</Link>
          </Button>
          <FormModal
            title="افزودن حساب"
            description="شماره تلفن و نقش حساب را مشخص کنید."
            trigger={
              <Button>
                <Plus size={16} />
                افزودن حساب
              </Button>
            }
          >
            <BuildingAccountForm units={unitOptions} />
          </FormModal>
        </div>
      </div>
      <div className="max-w-[1160px]">
        <BuildingAccountList
          units={unitOptions}
          rows={people
            .sort(
              (a, b) =>
                Number(b.member.role === "manager") -
                  Number(a.member.role === "manager") ||
                a.person.name.localeCompare(b.person.name, "fa"),
            )
            .map(({ member: m, person: p }) => ({
              id: m.id,
              userId: p.id,
              name: p.name,
              phone: p.phone,
              email: p.email,
              role: m.role,
              unitId: m.unitId,
              active: active.has(p.id),
              own: p.id === session.user.id,
            }))}
        />
      </div>
    </div>
  );
}
