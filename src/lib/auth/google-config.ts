import { db } from "@/lib/db";

export function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function googleCredentialsConfigured() {
  return googleCredentials() !== null;
}

/** Credentials must exist, and the manager must not have switched Google off. */
export async function googleSignInEnabled() {
  if (!googleCredentialsConfigured()) return false;
  const building = await db.query.building.findFirst({
    columns: { googleSignInEnabled: true },
  });
  return building?.googleSignInEnabled !== false;
}
