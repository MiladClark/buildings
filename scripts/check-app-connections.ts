/** Read-only route/API smoke checks against the isolated local preview server. */
import assert from "node:assert/strict";

const base = "http://localhost:3301";
async function login(email: string) {
  const response = await fetch(`${base}/api/auth/sign-in/identifier`, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: email,
      password: "Local-preview-1405!",
    }),
  });
  assert.equal(response.status, 200, "preview login");
  return response.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
}
async function check(path: string, cookie: string, content?: string) {
  const response = await fetch(base + path, {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(60000),
  });
  assert.equal(response.status, 200, path);
  const body = await response.text();
  assert.ok(!body.includes('id="__next_error__"'), `${path}: render failure`);
  assert.ok(
    !body.includes("<template data-dgst="),
    `${path}: streamed render failure`,
  );
  if (path.startsWith("/api/")) JSON.parse(body);
  else assert.ok(body.includes("<h1"), `${path}: page heading missing`);
  if (content)
    assert.ok(body.includes(content), `${path}: expected page content`);
  console.log(`PASS ${path}`);
  return body;
}
async function main() {
  const manager = await login("manager@preview.local");
  let periodsHtml = "";
  for (const path of [
    "/manager",
    "/manager/units",
    "/manager/periods",
    "/manager/expenses",
    "/manager/expenses?view=payments",
    "/manager/expenses?view=archive",
    "/manager/bills",
    "/manager/payments",
    "/manager/calendar",
    "/manager/maintenance",
    "/manager/chat",
    "/manager/reports",
    "/manager/settings",
    "/manager/history",
    "/manager/categories",
    "/manager/residents",
    "/manager/account",
  ]) {
    const body = await check(path, manager);
    if (path === "/manager/periods") periodsHtml = body;
  }
  const workbook = await fetch(`${base}/api/export/finance`, {
    headers: { Cookie: manager },
  });
  assert.equal(workbook.status, 200, "manager Excel export");
  assert.equal(
    Buffer.from(await workbook.arrayBuffer())
      .subarray(0, 2)
      .toString(),
    "PK",
    "valid Excel ZIP container",
  );
  console.log("PASS finance Excel export");
  const periodId = periodsHtml.match(
    /\/manager\/periods\/([a-zA-Z0-9-]+)/,
  )?.[1];
  assert.ok(periodId, "preview period link exists");
  const pdf = await fetch(
    `${base}/api/export/period/${periodId}/expenses/pdf`,
    { headers: { Cookie: manager } },
  );
  assert.equal(pdf.status, 200, "period PDF export");
  assert.equal(
    Buffer.from(await pdf.arrayBuffer())
      .subarray(0, 4)
      .toString(),
    "%PDF",
    "valid PDF header",
  );
  console.log("PASS period PDF export");
  for (const path of [
    "/api/chat/status",
    "/api/notifications/status",
    "/api/notifications/inbox",
  ])
    await check(path, manager);
  const resident = await login("resident@preview.local");
  for (const path of [
    "/resident",
    "/resident/invoices",
    "/resident/payments",
    "/resident/maintenance",
    "/resident/chat",
    "/resident/account",
    "/resident/notifications",
  ])
    await check(path, resident);
  const protectedApi = await fetch(`${base}/api/export/finance`, {
    headers: { Cookie: resident },
  });
  assert.equal(
    protectedApi.status,
    403,
    "resident cannot export manager finance data",
  );
  const anonymous = await fetch(`${base}/api/notifications/status`);
  assert.equal(anonymous.status, 401, "anonymous notification request");
  const crossOrigin = await fetch(`${base}/api/notifications/read`, {
    method: "POST",
    headers: {
      Cookie: manager,
      Origin: "https://invalid.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ all: true }),
  });
  assert.equal(crossOrigin.status, 403, "cross-origin mutation denied");
  console.log("PASS access isolation, anonymous and cross-origin boundaries");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
