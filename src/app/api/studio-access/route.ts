import type { NextRequest } from "next/server";

import {
  STUDIO_ACCESS_COOKIE,
  STUDIO_ACCESS_MAX_AGE_SECONDS,
  isStudioAccessEnabled,
  isStudioPasswordCorrect,
  studioAccessPassword,
  studioAccessToken,
} from "@/lib/studio-access";
import { guardStudioAccessIp } from "@/lib/public-rate-limit";
import { redeemBetaAccess } from "@/lib/db/studio-beta";
import { hashAccessCode } from "@/lib/studio-beta/access-code";
import { mintTesterCookie } from "@/lib/studio-beta/tester-cookie";

export const runtime = "nodejs";

function accessCookie(value: string): string {
  return [
    `${STUDIO_ACCESS_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${STUDIO_ACCESS_MAX_AGE_SECONDS}`,
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * Exchanges a beta tester's email and personal access code, or the team's
 * shared password, for a cookie the proxy will accept.
 *
 * Deliberately public: it sits in front of the sign-in page, so requiring auth
 * here would be circular. The rate limit is what makes a shared secret safe to
 * expose, since a single password with unlimited attempts is guessable.
 */
export async function POST(req: NextRequest): Promise<Response> {
  if (!isStudioAccessEnabled()) {
    return Response.json({ error: "not_configured" }, { status: 404 });
  }

  const limited = await guardStudioAccessIp(req);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const password = studioAccessPassword();
  if (!password) {
    return Response.json({ error: "not_configured" }, { status: 404 });
  }

  // A beta tester: their own email and code. The answer does not say which of
  // the two was wrong.
  if (typeof body.email === "string" && typeof body.code === "string") {
    const email = body.email.trim().toLowerCase();
    const tester =
      email && body.code.trim()
        ? await redeemBetaAccess(email, await hashAccessCode(email, body.code))
        : null;
    if (!tester) {
      return Response.json({ error: "wrong_code" }, { status: 401 });
    }
    const response = Response.json({ ok: true });
    response.headers.append(
      "Set-Cookie",
      accessCookie(
        await mintTesterCookie(
          password,
          tester.id,
          new Date(Date.now() + STUDIO_ACCESS_MAX_AGE_SECONDS * 1000),
        ),
      ),
    );
    return response;
  }

  const submitted = typeof body.password === "string" ? body.password : "";
  if (!submitted) {
    return Response.json({ error: "missing_password" }, { status: 400 });
  }

  if (!(await isStudioPasswordCorrect(submitted))) {
    return Response.json({ error: "wrong_password" }, { status: 401 });
  }

  const response = Response.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    accessCookie(await studioAccessToken(password)),
  );
  return response;
}
