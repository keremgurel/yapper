import { after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPostHogClient } from "@/lib/posthog-server";
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

/** An HTTP success is a completed API action, not proof of a published post. */
export function withProductAnalytics<R extends Request>(
  action: string,
  handler: (request: R) => Promise<Response>,
) {
  return async (request: R): Promise<Response> => {
    const started = performance.now();
    let status = 500;
    try {
      const response = await handler(request);
      status = response.status;
      return response;
    } finally {
      const durationMs = Math.round(performance.now() - started);
      // Resolve identity in the request context. A failure here is analytics-only.
      try {
        const { userId } = await auth();
        if (userId) {
          after(() =>
            captureServerEvent(
              userId,
              status < 400
                ? "product_action_completed"
                : "product_action_failed",
              {
                ...clientContext(request.headers.get("user-agent") ?? ""),
                action,
                status,
                duration_ms: durationMs,
                ...(request.headers.get("x-yapper-environment") ===
                  "development" ||
                request.headers
                  .get("user-agent")
                  ?.includes("YapperStudioNative/development")
                  ? { environment: "development" }
                  : {}),
                app_build:
                  request.headers.get("x-yapper-build")?.slice(0, 80) ?? null,
              },
            ),
          );
        }
      } catch {
        /* No analytics dependency in the product response. */
      }
    }
  };
}
