"use client";
import { useId } from "react";
import { Select } from "@/components/ui/select";
import { FieldHint } from "@/components/ui/field-hint";
import { toPersianDigits as fa } from "@/lib/format/money";
export function BillCoverageField({ months }: { months?: number | null }) {
  const id = useId();
  return (
    <div className="form-field col-span-full">
      <label htmlFor={id}>
        بازه قبض (اختیاری){" "}
        <FieldHint label="بازه قبض">
          اگر قبض دوماهه یا سه‌ماهه است، بازه واقعی را انتخاب کنید. فقط برای
          برآورد ماهانه استفاده می‌شود و مبلغ واقعی قبض یا سهم آب را تغییر
          نمی‌دهد. برای خرید وسایل و دستمزد، خالی بگذارید.
        </FieldHint>
      </label>
      <Select
        id={id}
        name="coverageMonths"
        defaultValue={months ? String(months) : ""}
      >
        <option value="">نامشخص / این هزینه قبض نیست</option>
        {Array.from({ length: 36 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {fa(String(i + 1))} ماه
          </option>
        ))}
      </Select>
    </div>
  );
}
