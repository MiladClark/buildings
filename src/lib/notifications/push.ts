import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushIdentity } from "@/lib/db/schema";

export async function getPushIdentity() {
  const publicKey = process.env.VAPID_PUBLIC_KEY,
    privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "https://vahedban.ir";
  if (publicKey && privateKey) return { publicKey, privateKey, subject };
  if (publicKey || privateKey)
    throw new Error("هر دو کلید VAPID باید با هم تنظیم شوند.");
  const existing = await db.query.pushIdentity.findFirst({
    where: eq(pushIdentity.id, "default"),
  });
  if (existing) return existing;
  const keys = webpush.generateVAPIDKeys();
  await db
    .insert(pushIdentity)
    .values({ id: "default", ...keys, subject })
    .onConflictDoNothing();
  return (await db.query.pushIdentity.findFirst({
    where: eq(pushIdentity.id, "default"),
  }))!;
}
// Restrict stored URLs to push providers; never POST to an arbitrary supplied host.
export function validPushEndpoint(value: string) {
  try {
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      u.hash ||
      value.length > 3000
    )
      return false;
    return (
      u.hostname === "fcm.googleapis.com" ||
      u.hostname === "updates.push.services.mozilla.com" ||
      u.hostname === "push.services.mozilla.com" ||
      u.hostname === "web.push.apple.com" ||
      u.hostname.endsWith(".notify.windows.com") ||
      u.hostname === "wns2-par02p.notify.windows.com"
    );
  } catch {
    return false;
  }
}
export async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string; url: string; tag: string },
) {
  if (!validPushEndpoint(subscription.endpoint))
    throw new Error("INVALID_PUSH_ENDPOINT");
  const identity = await getPushIdentity();
  return webpush.sendNotification(subscription, encodePushPayload(payload), {
    vapidDetails: {
      subject: identity.subject,
      publicKey: identity.publicKey,
      privateKey: identity.privateKey,
    },
    TTL: 3600,
    urgency: "normal",
    timeout: 10000,
  });
}

// Push services limit the encrypted message to about 4 KiB. Keep the complete
// announcement in the inbox, and fit its phone preview by UTF-8 bytes.
export function encodePushPayload(payload: {
  title: string;
  body: string;
  url: string;
  tag: string;
}) {
  const encoded = JSON.stringify(payload);
  if (Buffer.byteLength(encoded, "utf8") <= 3500) return encoded;
  let body = "";
  const budget =
    3500 - Buffer.byteLength(JSON.stringify({ ...payload, body: "…" }), "utf8");
  let used = 0;
  for (const character of payload.body) {
    const size = Buffer.byteLength(
      JSON.stringify(character).slice(1, -1),
      "utf8",
    );
    if (used + size > budget) break;
    body += character;
    used += size;
  }
  return JSON.stringify({ ...payload, body: `${body}…` });
}
