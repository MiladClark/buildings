import { spawn } from "node:child_process";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32 || /change-me|placeholder/i.test(secret)) {
  throw new Error(
    "Set BETTER_AUTH_SECRET to a random secret of at least 32 characters.",
  );
}
const url = new URL(process.env.BETTER_AUTH_URL ?? "");
if (
  url.protocol !== "https:" ||
  url.pathname !== "/" ||
  url.search ||
  url.hash
) {
  throw new Error("Set BETTER_AUTH_URL to the public HTTPS origin.");
}
await import("./migrate.mjs");
const server = spawn(process.execPath, ["server.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NOTIFICATION_WORKER_ENABLED: process.env.NOTIFICATION_WORKER_ENABLED ?? "1",
  },
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
server.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
