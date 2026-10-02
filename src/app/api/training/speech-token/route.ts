import { auth } from "@clerk/nextjs/server";
import {
  issueSpeechToken,
  speechCredentials,
} from "@/lib/pronunciation/azure-token";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";
import { resolveTrainFeedbackAccess } from "@/lib/training-feedback/access";
import { ensureUser } from "@/lib/db/users";

export const runtime = "nodejs";

/**
 * Hand the browser a short-lived Speech token so it can score pronunciation on
 * the recording it already holds. A token is paid capacity, so it is issued
 * only to someone who could run a feedback session right now: signed in, and
 * either on Train Plus within fair use or holding the credits for one session.
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;
  const credentials = speechCredentials();
  if (!credentials)
    return Response.json({ error: "no_provider" }, { status: 501 });

  await ensureUser(userId);
  const access = await resolveTrainFeedbackAccess(userId);
  if (access instanceof Response) return access;
  const spendLimited = await guardProviderSpend(req, userId, "speech-token");
  if (spendLimited) return spendLimited;

  try {
    const token = await issueSpeechToken(credentials);
    return Response.json(
      { token, region: credentials.region },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "token_failed" }, { status: 502 });
  }
}
