import { auth, clerkClient } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { safeHandoffTarget } from "@/lib/handoff/target";

export const runtime = "nodejs";

/**
 * How long the QR stays good for.
 *
 * Longer than the native handoff's 60 seconds, because that one is consumed by
 * a program the instant it is minted while this one waits for a human to pick
 * up a phone, unlock it and line up a camera. Still short: the link is a bearer
 * credential, so anyone who photographs the screen inside the window is the
 * creator until it is used.
 */
const TICKET_SECONDS = 180;

/**
 * Mint a one-use link that opens a Studio page on the creator's phone, already
 * signed in.
 *
 * A POST rather than a GET because it has a side effect (it creates a
 * credential) and must never be prefetched, cached, or fired by a link the
 * creator merely hovered.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { to?: unknown };
  const to = safeHandoffTarget(body.to);

  const client = await clerkClient();
  const signInToken = await client.signInTokens.createSignInToken({
    userId,
    expiresInSeconds: TICKET_SECONDS,
  });

  // Built from the request origin, not the canonical site URL: a preview
  // deployment must produce a QR that points at itself rather than at
  // production, or scanning it silently tests the wrong build.
  const url = new URL("/studio/handoff", req.nextUrl.origin);
  url.searchParams.set("ticket", signInToken.token);
  url.searchParams.set("to", to);

  return Response.json(
    { url: url.toString(), expiresInSeconds: TICKET_SECONDS },
    // Never stored anywhere: this response body is a live credential.
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
