import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureUser } from "@/lib/db/users";
import { upsertConnection } from "@/lib/db/publish";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";
import { exchangeCode, fetchAccount } from "@/lib/publish/oauth";

export const runtime = "nodejs";

type Params = { params: Promise<{ platform: string }> };

/** Where the user lands after the OAuth dance, connected or with a reason: back
 * on the Connections page they started from, not the library. */
function back(origin: string, params: Record<string, string>): NextResponse {
  const url = new URL("/studio/connections", origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/**
 * Finish connecting a platform: verify the CSRF nonce, exchange the code for
 * tokens, identify the account, and store the (encrypted) connection. Redirects
 * back into the app either way — a query flag drives the toast, so the user is
 * never dumped on a raw JSON error.
 */
export async function GET(req: Request, { params }: Params): Promise<Response> {
  const url = new URL(req.url);
  const origin = url.origin;

  const { userId } = await auth();
  if (!userId) return back(origin, { connect_error: "signed_out" });

  const { platform } = await params;
  if (!publishPlatforms.includes(platform as PublishPlatform)) {
    return back(origin, { connect_error: "unknown_platform" });
  }
  const p = platform as PublishPlatform;

  const providerError = url.searchParams.get("error");
  if (providerError) return back(origin, { connect_error: providerError });

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieName = `publish_state_${p}`;
  const expected = req.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);

  if (!code || !state || !expected || state !== expected) {
    const res = back(origin, { connect_error: "invalid_state" });
    res.cookies.delete(cookieName);
    return res;
  }

  try {
    const redirectUri = `${origin}/api/publish/callback/${p}`;
    const tokens = await exchangeCode(p, code, redirectUri);
    const account = await fetchAccount(p, tokens.accessToken);
    await ensureUser(userId);
    await upsertConnection(userId, p, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      externalAccountId: account.externalAccountId,
      handle: account.handle,
    });
    const res = back(origin, { connected: p });
    res.cookies.delete(cookieName);
    return res;
  } catch (e) {
    console.error(`[publish] ${p} connect failed`, e);
    const res = back(origin, { connect_error: "exchange_failed" });
    res.cookies.delete(cookieName);
    return res;
  }
}
