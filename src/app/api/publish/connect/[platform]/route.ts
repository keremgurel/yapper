import { randomBytes } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";
import { buildAuthUrl } from "@/lib/publish/oauth";
import { isPlatformConfigured } from "@/lib/publish/platforms";
import { tokenCryptoConfigured } from "@/lib/publish/tokens";

export const runtime = "nodejs";

type Params = { params: Promise<{ platform: string }> };

/**
 * Start connecting a platform: sign a CSRF nonce into a short-lived cookie and
 * bounce the user to the provider's consent screen. The matching `callback`
 * route finishes the exchange. 501 until the platform's OAuth app and the token
 * key are configured.
 */
export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { platform } = await params;
  if (!publishPlatforms.includes(platform as PublishPlatform)) {
    return Response.json({ error: "unknown_platform" }, { status: 404 });
  }
  const p = platform as PublishPlatform;
  if (!isPlatformConfigured(p) || !tokenCryptoConfigured()) {
    return Response.json({ error: "not_configured" }, { status: 501 });
  }

  const redirectUri = `${new URL(req.url).origin}/api/publish/callback/${p}`;
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(p, redirectUri, state));
  res.cookies.set(`publish_state_${p}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
