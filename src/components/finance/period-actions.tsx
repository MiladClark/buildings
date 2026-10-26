"use client";
import { RowActions } from "@/components/ui/row-actions";
import type { PeriodType } from "@/lib/billing/periods";
import { useRouter } from "next/navigation";
import { FormModal } from "./forms";
import { PeriodCreateForm } from "./period-create-form";
import { Button } from "@/components/ui/button";
import { managePeriod, setRecordDeleted } from "@/lib/actions/management";

export type EditablePeriod = {
  id: string;
  title: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  dueDate: string | null;
  status: string;
};
export function PeriodActions({
  period,
  detail = false,
}: {
  period: EditablePeriod;
  detail?: boolean;
}) {
  const router = useRouter();
  return (
    <RowActions
      label={`عملیات ${period.title}`}
      items={[
        ...(!detail
          ? [{ label: "مشاهده دوره", href: `/manager/periods/${period.id}` }]
          : []),
        {
          label: "ویرایش",
          dialog: (
            <FormModal
              title="ویرایش دوره مالی"
              description="بازه محاسبه شارژ و آخرین مهلت پرداخت ساکنان را مشخص کنید."
              trigger={
                <Button variant="outline" size="sm">
                  ویرایش
                </Button>
              }
            >
              <PeriodCreateForm initial={period} />
            </FormModal>
          ),
        },
        ...(period.status !== "draft"
          ? [
              {
                label: "بازکردن برای اصلاح",
                action: () => managePeriod(period.id, "reopen"),
                confirm:
                  "دوره برای اصلاح باز شود؟ فیش‌های فعلی از اعتبار خارج می‌شوند؛ واریزها حفظ می‌شوند و سهم پیش‌نویس با وضعیت فعلی واحدها و قواعد محاسبه می‌شود. پس از اصلاح، فیش‌ها را دوباره صادر کنید.",
                success:
                  "دوره باز شد؛ پس از بررسی سهم‌ها، فیش‌ها را دوباره صادر کنید.",
              },
            ]
          : []),
        ...(period.status !== "draft"
          ? [
              {
                label:
                  period.status === "archived" ? "خروج از بایگانی" : "بایگانی",
                action: () =>
                  managePeriod(
                    period.id,
                    period.status === "archived" ? "unarchive" : "archive",
                  ),
              },
            ]
          : []),
        {
          label: "حذف",
          action: async () => {
            await setRecordDeleted("period", period.id, true);
            if (detail) router.push("/manager/periods");
          },
          confirm: `«${period.title}» حذف شود؟ هزینه‌ها و سابقه فیش‌ها برای بازیابی حفظ می‌شوند. فیش‌های فعال باطل و مبلغ تخصیص‌یافته به این دوره بستانکاری واحدها می‌شود. واریز واقعی حذف نمی‌شود.`,
          success: "دوره حذف شد؛ از سابقه و بازیابی برمی‌گردد.",
          danger: true,
        },
      ]}
    />
  );
}
