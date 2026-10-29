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
