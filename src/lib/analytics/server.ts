import { after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPostHogClient } from "@/lib/posthog-server";
import { runWithAiUsage, type AiUsageScope } from "@/lib/costs/ai-usage-scope";
import {
  aiGenerationProperties,
  aiUsageSummary,
} from "@/lib/costs/ai-usage-events";
import { ANALYTICS_SCHEMA_VERSION, clientContext } from "./context";

/** Analytics must never turn a successful product operation into a failure. */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties: Record<string, unknown> = {},
  timestamp?: Date,
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    const client = getPostHogClient();
    client.capture({
      distinctId,
      event,
      timestamp,
      properties: {
        product: "studio",
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
        analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
        source: "server",
        ...properties,
      },
    });
    await client.flush();
  } catch {
    console.warn("Product analytics delivery failed", { event });
  }
}

/** Webhooks are already idempotent and retryable: do not acknowledge an
 * authoritative signup/payment until ingestion accepts it. Other usage remains
 * best effort and cannot affect product operations. */
export async function captureVerifiedEvent(
  distinctId: string,
  event: string,
  properties: Record<string, unknown>,
  timestamp?: Date,
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY)
    throw new Error("Analytics ingestion is not configured");
  await getPostHogClient().captureImmediate({
    distinctId,
    event,
    timestamp,
    properties: {
      product: "studio",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
      source: "server",
      ...properties,
    },
  });
}

function requestProperties(request: Request): Record<string, unknown> {
  return {
    ...clientContext(request.headers.get("user-agent") ?? ""),
    ...(request.headers.get("x-yapper-environment") === "development" ||
    request.headers
      .get("user-agent")
      ?.includes("YapperStudioNative/development")
      ? { environment: "development" }
      : {}),
    app_build: request.headers.get("x-yapper-build")?.slice(0, 80) ?? null,
  };
}

/** One $ai_generation per provider call, then the action with its AI totals.
 * Calls made after this runs (background work) report themselves. */
async function reportAction(
  scope: AiUsageScope,
  userId: string,
  event: string,
  properties: Record<string, unknown>,
) {
  const calls = scope.calls.splice(0);
  await Promise.all([
    ...calls.map((call) =>
      captureServerEvent(userId, "$ai_generation", {
        ...properties,
        ...aiGenerationProperties(call, scope.action),
      }),
    ),
    captureServerEvent(userId, event, {
      ...properties,
      action: scope.action,
      ...aiUsageSummary(calls),
    }),
  ]);
}

/** An HTTP success is a completed API action, not proof of a published post.
 * The handler runs inside an AI usage scope, so every model call it makes is
 * attributed to this action with its tokens and cost. */
export function withProductAnalytics<Args extends [Request, ...unknown[]]>(
  action: string,
  handler: (...args: Args) => Promise<Response>,
) {
  return (...args: Args): Promise<Response> =>
    runWithAiUsage(action, async (scope) => {
      const [request] = args;
      const started = performance.now();
      let status = 500;
      try {
        const response = await handler(...args);
        status = response.status;
        return response;
      } finally {
        const durationMs = Math.round(performance.now() - started);
        // Resolve identity in the request context. A failure here is analytics-only.
        try {
          const properties = requestProperties(request);
          scope.properties = properties;
          const { userId } = await auth();
          if (userId) {
            scope.distinctId = userId;
            after(() => {
              scope.reported = true;
              return reportAction(
                scope,
                userId,
                status < 400
                  ? "product_action_completed"
                  : "product_action_failed",
                { ...properties, status, duration_ms: durationMs },
              );
            });
          } else {
            scope.reported = true;
          }
        } catch {
          scope.reported = true;
          /* No analytics dependency in the product response. */
        }
      }
    });
}
