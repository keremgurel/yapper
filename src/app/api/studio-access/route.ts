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

export const runtime = "nodejs";

/**
 * Exchanges the shared Studio password for a cookie the proxy will accept.
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
  const submitted = typeof body.password === "string" ? body.password : "";
  if (!submitted) {
    return Response.json({ error: "missing_password" }, { status: 400 });
  }

  if (!(await isStudioPasswordCorrect(submitted))) {
    return Response.json({ error: "wrong_password" }, { status: 401 });
  }

  const password = studioAccessPassword();
  if (!password) {
    return Response.json({ error: "not_configured" }, { status: 404 });
  }

  const response = Response.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    [
      `${STUDIO_ACCESS_COOKIE}=${await studioAccessToken(password)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${STUDIO_ACCESS_MAX_AGE_SECONDS}`,
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; "),
  );
  return response;
}
