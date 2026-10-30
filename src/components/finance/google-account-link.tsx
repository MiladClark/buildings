"use client";
import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
export function GoogleAccountLink() {
  const [pending, start] = useTransition();
  const path = usePathname();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await authClient.linkSocial({
            provider: "google",
            callbackURL: path,
            errorCallbackURL: path,
          });
          if (result.error)
            toast.error("اتصال گوگل انجام نشد؛ دوباره تلاش کنید.");
        })
      }
    >
      {pending ? "در حال اتصال…" : "اتصال گوگل به همین حساب"}
    </Button>
  );
}
