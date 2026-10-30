const offlineHtml = `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#26745d" />
    <title>واحدبان | بدون اتصال</title>
    <style>
      body {
        margin: 0;
        min-height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: #f7f9f8;
        color: #202c29;
        font-family: Tahoma, sans-serif;
      }
      main {
        width: min(100%, 360px);
        text-align: center;
      }
      h1 {
        margin: 16px 0 8px;
        font-size: 22px;
      }
      p {
        margin: 0;
        color: #67756d;
        font-size: 14px;
        line-height: 1.9;
      }
      button {
        margin-top: 20px;
        border: 0;
        border-radius: 8px;
        background: #26745d;
        color: #fff;
        font: inherit;
        font-size: 14px;
        padding: 10px 16px;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>اتصال برقرار نیست</h1>
      <p>واحدبان برای دیدن شارژ و حساب ساختمان به اینترنت نیاز دارد. وقتی وصل شدید، دوباره تلاش کنید.</p>
      <button type="button" onclick="location.reload()">تلاش دوباره</button>
    </main>
  </body>
</html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    /* Use the safe fallback. */
  }
  const title =
    typeof payload.title === "string" ? payload.title.slice(0, 150) : "واحدبان";
  const body =
    typeof payload.body === "string"
      ? payload.body.slice(0, 2000)
      : "پیام تازه‌ای در واحدبان دارید.";
  let url = "/";
  try {
    const target = new URL(payload.url || "/", self.location.origin);
    if (
      target.origin === self.location.origin &&
      /^\/(manager|resident)(\/|\?|$)/.test(target.pathname)
    )
      url = target.pathname + target.search;
  } catch {
    /* Keep the app home as the destination. */
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: typeof payload.tag === "string" ? payload.tag : "vahedban",
      data: { url },
      dir: "rtl",
      lang: "fa",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const read =
        typeof event.notification.tag === "string" &&
        /^[\w-]{1,100}$/.test(event.notification.tag)
          ? fetch("/api/notifications/read", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: event.notification.tag }),
            }).catch(() => {})
          : Promise.resolve();
      const target = new URL(
        event.notification.data?.url || "/",
        self.location.origin,
      );
      const url =
        target.origin === self.location.origin
          ? target.href
          : self.location.origin;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const client = windows.find(
        (c) => new URL(c.url).origin === self.location.origin,
      );
      if (client) {
        await client.navigate(url);
        await Promise.all([client.focus(), read]);
        return;
      }
      await Promise.all([self.clients.openWindow(url), read]);
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(
      () =>
        new Response(offlineHtml, {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
    ),
  );
});
