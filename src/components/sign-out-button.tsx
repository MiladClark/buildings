"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { unsubscribePush } from "@/lib/actions/notifications";

export function SignOutButton() {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full justify-start gap-2"
      onClick={async () => {
        if ("serviceWorker" in navigator) {
          try {
            const reg = await navigator.serviceWorker.getRegistration("/");
            const sub = await reg?.pushManager?.getSubscription();
            if (sub) {
              await unsubscribePush(sub.endpoint).catch(() => {});
              await sub.unsubscribe();
            }
          } catch {}
        }
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      <LogOut size={18} />
      خروج
    </Button>
  );
}
