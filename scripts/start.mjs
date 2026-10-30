import { spawn } from "node:child_process";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--port",
    "3300",
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NOTIFICATION_WORKER_ENABLED:
        process.env.NOTIFICATION_WORKER_ENABLED ?? "1",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.kill(signal));
server.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
server.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
