import { auth } from "@clerk/nextjs/server";

/** The connector is off unless the deployment turns it on. */
export const mcpEnabled = (): boolean => process.env.YAPPER_MCP === "1";

/**
 * The creator a connector acts for: a Clerk OAuth access token from Claude or
 * ChatGPT, or the app's own session. `null` when neither is valid.
 */
export async function mcpUserId(): Promise<string | null> {
  const caller = await auth({ acceptsToken: ["oauth_token", "session_token"] });
  return caller.isAuthenticated ? (caller.userId ?? null) : null;
}

/** Clerk's Frontend API origin, which is the authorization server, read from the publishable key. */
export function authorizationServer(): string | null {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const encoded = key.split("_")[2];
  if (!encoded) return null;
  const host = Buffer.from(encoded, "base64")
    .toString("utf8")
    .replace(/\$$/, "");
  return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : null;
}
