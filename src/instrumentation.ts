export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NOTIFICATION_WORKER_ENABLED === "1"
  ) {
    const { startNotificationWorker } =
      await import("./lib/notifications/worker");
    startNotificationWorker();
  }
}
