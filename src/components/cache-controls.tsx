"use client";

import { RowActions } from "@/components/ui/row-actions";
import { clearBuildingCache, reloadBuildingCache } from "@/lib/actions/cache";

export function CacheControls() {
  return (
    <RowActions
      label="ابزارهای صفحه"
      items={[
        {
          label: "تازه‌سازی اطلاعات",
          action: reloadBuildingCache,
          success: "اطلاعات ساختمان تازه شد.",
        },
        {
          label: "بازسازی کش اطلاعات",
          action: clearBuildingCache,
          confirm:
            "اطلاعات موقت دوباره از پایگاه داده خوانده شوند؟ سوابق ساختمان حفظ می‌شوند.",
          success: "اطلاعات موقت دوباره ساخته شدند.",
        },
      ]}
    />
  );
}
