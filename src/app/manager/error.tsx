"use client";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function ErrorBoundary({ retry }: { retry: () => void }) {
  return (
    <div className="panel mx-auto max-w-lg p-8 text-center">
      <CircleAlert size={34} className="mx-auto mb-5 text-destructive" />
      <h2 className="text-lg font-bold">بارگذاری اطلاعات انجام نشد</h2>
      <p className="my-5 text-xs leading-7 text-muted-foreground">
        ارتباط با سامانه را بررسی کنید و دوباره تلاش کنید. اطلاعات ثبت‌شده شما
        تغییری نکرده است.
      </p>
      <Button onClick={retry}>تلاش دوباره</Button>
    </div>
  );
}
