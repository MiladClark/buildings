import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthFrame } from "@/components/auth/auth-frame";
import { countUsers } from "@/lib/queries/dashboard";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { unit } from "@/lib/db/schema";
export default async function RegisterPage() {
  await connection();
  const first = (await countUsers()) === 0;
  const currentBuilding = await db.query.building.findFirst();
  const units = currentBuilding
    ? await db
        .select({ id: unit.id, label: unit.label })
        .from(unit)
        .where(
          and(eq(unit.buildingId, currentBuilding.id), isNull(unit.deletedAt)),
        )
        .orderBy(asc(unit.sortOrder), asc(unit.label))
    : [];
  return (
    <AuthFrame>
      <div className="mb-8">
        <h2 className="text-[27px] font-bold">
          {first ? "به هم‌خانه خوش آمدید." : "همسایه جدید، خوش آمدید."}
        </h2>
        <p className="mt-3 text-xs leading-7 text-muted-foreground">
          {first
            ? "با شماره تلفن حساب مدیر را بسازید و مدیریت ساختمان را شروع کنید."
            : "شماره تلفن را وارد کنید. اگر مدیر همین شماره را ساخته باشد، به همان حساب وصل می‌شوید."}
        </p>
      </div>
      <RegisterForm isFirstUser={first} units={units} />
      <p className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        حساب دارید؟{" "}
        <Link href="/login" className="mr-1 font-medium text-primary">
          ورود به هم‌خانه
        </Link>
      </p>
    </AuthFrame>
  );
}
