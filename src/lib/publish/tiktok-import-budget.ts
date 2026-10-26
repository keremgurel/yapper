import {
  consumeRateLimits,
  rateLimitErrorResponse,
  rateLimitUserSubject,
  RateLimitUnavailableError,
} from "@/lib/db/rate-limit";
import { guardProviderSpend } from "@/lib/provider-rate-limit";
import {
  reserveTikTokImportBudget,
  ProviderBudgetError,
} from "@/lib/costs/provider-budget";

/** DB-backed gates apply across server instances. Cache hits never enter here.
 * At most two admissions within the 150-second workflow, with one/user, plus
 * a five-minute same-post cooldown. Never refund a potentially billable run. */
export async function guardTikTokImportSpend(
  req: Request,
  userId: string,
  postId: string,
): Promise<Response | null> {
  const limited = await guardProviderSpend(req, userId, "tiktok-import");
  if (limited) return limited;
  try {
    const decisions = await consumeRateLimits([
      {
        subjectHash: "tiktok-import",
        policy: {
          scope: "global:tiktok-import:pacing",
          capacity: 2,
          refillPerSecond: 1 / 180,
        },
      },
      {
        subjectHash: rateLimitUserSubject(userId),
        policy: {
          scope: "user:tiktok-import:pacing",
          capacity: 1,
          refillPerSecond: 1 / 180,
        },
      },
      {
        subjectHash: rateLimitUserSubject(`${userId}:${postId}`),
        policy: {
          scope: "post:tiktok-import:cooldown",
          capacity: 1,
          refillPerSecond: 1 / 300,
        },
      },
    ]);
    const denied = decisions.find((decision) => !decision.allowed);
    if (denied) return rateLimitErrorResponse(denied);
    await reserveTikTokImportBudget();
    return null;
  } catch (error) {
    if (error instanceof ProviderBudgetError)
      return Response.json(
        { error: "provider_budget_unavailable" },
        { status: 503 },
      );
    return rateLimitErrorResponse(
      error instanceof RateLimitUnavailableError
        ? error
        : new RateLimitUnavailableError({ cause: error }),
    );
  }
}
