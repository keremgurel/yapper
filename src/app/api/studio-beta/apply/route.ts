import { createBetaApplication } from "@/lib/db/studio-beta";
import { getPostHogClient } from "@/lib/posthog-server";
import { guardWaitlistEmail, guardWaitlistIp } from "@/lib/public-rate-limit";
import { parseBetaApplication } from "@/lib/studio-beta/application";

export const runtime = "nodejs";

/**
 * Apply to the Studio private beta. Public, so it is rate limited by address
 * and by email. The answer is the same whether or not the email had already
 * applied, so the form cannot be used to find out who is on the list.
 */
export async function POST(req: Request): Promise<Response> {
  const ipLimited = await guardWaitlistIp(req);
  if (ipLimited) return ipLimited;

  const application = parseBetaApplication(await req.json().catch(() => null));
  if ("error" in application)
    return Response.json({ error: application.error }, { status: 400 });
  const emailLimited = await guardWaitlistEmail(application.email);
  if (emailLimited) return emailLimited;

  try {
    const { created } = await createBetaApplication(application);
    if (created)
      getPostHogClient().capture({
        distinctId: application.email,
        event: "studio_beta_applied",
        properties: { has_link: application.link !== null },
      });
    return Response.json({ success: true });
  } catch (error) {
    console.error("studio beta application failed", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
