import assert from "node:assert/strict";

const base = process.env.APP_URL || "http://127.0.0.1:3300";

async function login(email: string) {
  const response = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({
      email,
      password: process.env.PREVIEW_PASSWORD || "Local-preview-1405!",
    }),
  });
  assert.equal(response.status, 200, `login failed for ${email}`);
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function request(
  path: string,
  options: RequestInit & { cookie?: string } = {},
) {
  const headers = new Headers(options.headers);
  if (options.cookie) headers.set("Cookie", options.cookie);
  if (options.method && options.method !== "GET") headers.set("Origin", base);
  return fetch(base + path, { ...options, headers });
}

async function main() {
  const manager = await login("manager@preview.local");
  const resident = await login("resident@preview.local");

  const existing = (await (
    await request("/api/chat", { cookie: manager })
  ).json()) as { messages: Array<{ id: string; body: string }> };
  for (const message of existing.messages) {
    if (
      message.body.startsWith("پیام آزمون ") ||
      message.body === "تصویر آزمون"
    ) {
      await request(`/api/chat/${message.id}`, {
        method: "DELETE",
        cookie: manager,
      });
    }
  }

  assert.equal((await request("/api/chat")).status, 401);
  assert.equal((await request("/api/chat", { cookie: resident })).status, 200);

  for (const path of [
    "/resident",
    "/resident/invoices",
    "/resident/payments",
    "/resident/maintenance",
    "/resident/chat",
  ]) {
    assert.equal((await request(path, { cookie: resident })).status, 200, path);
  }
  assert.equal(
    (await request("/manager/chat", { cookie: manager })).status,
    200,
  );

  const createText = new FormData();
  createText.set("body", `پیام آزمون ${Date.now()}`);
  const createdResponse = await request("/api/chat", {
    method: "POST",
    cookie: resident,
    body: createText,
  });
  assert.equal(
    createdResponse.status,
    201,
    await createdResponse.clone().text(),
  );
  const created = (await createdResponse.json()) as {
    message: { id: string };
  };
  const createdId = created.message.id;

  const managerEdit = await request(`/api/chat/${createdId}`, {
    method: "PATCH",
    cookie: manager,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "ویرایش غیرمجاز" }),
  });
  assert.equal(managerEdit.status, 403, "manager must not edit resident text");

  const ownerEdit = await request(`/api/chat/${createdId}`, {
    method: "PATCH",
    cookie: resident,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "پیام آزمون ویرایش‌شده" }),
  });
  assert.equal(ownerEdit.status, 200);

  const managerDelete = await request(`/api/chat/${createdId}`, {
    method: "DELETE",
    cookie: manager,
  });
  assert.equal(managerDelete.status, 200, "manager moderation delete");

  const imageForm = new FormData();
  imageForm.set("body", "تصویر آزمون");
  imageForm.set(
    "image",
    new File(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      "test.png",
      { type: "image/png" },
    ),
  );
  const imageResponse = await request("/api/chat", {
    method: "POST",
    cookie: resident,
    body: imageForm,
  });
  assert.equal(imageResponse.status, 201);
  const imageMessage = (await imageResponse.json()) as {
    message: { id: string };
  };
  const imageMessageId = imageMessage.message.id;

  const image = await request(`/api/chat/image/${imageMessageId}`, {
    cookie: resident,
  });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/webp");
  assert.equal(
    (await request(`/api/chat/image/${imageMessageId}`)).status,
    401,
  );
  assert.equal(
    (
      await request(`/api/chat/${imageMessageId}`, {
        method: "DELETE",
        cookie: resident,
      })
    ).status,
    200,
  );

  const afterDelete = (await (
    await request("/api/chat", { cookie: resident })
  ).json()) as { messages: Array<{ id: string }> };
  assert.ok(!afterDelete.messages.some((message) => message.id === createdId));
  assert.ok(
    !afterDelete.messages.some((message) => message.id === imageMessageId),
  );

  console.log("Chat routes, image handling, editing and permissions verified.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
