import { AsyncLocalStorage } from "node:async_hooks";
import type { ChatUsage } from "./chat-usage";

/** One provider call, as recorded by the outbound fetch. */
export interface AiCall extends ChatUsage {
  provider: string;
  status: number;
  latencyMs: number;
}

/**
 * The AI calls made while one product action runs. The analytics wrapper
 * opens a scope around its handler; outbound fetches record into whatever
 * scope is current, so no route has to thread a recorder through its helpers.
 * Calls that arrive after the scope reported (background work in `after()`)
 * are reported on their own with the identity the scope resolved.
 */
export interface AiUsageScope {
  action: string;
  calls: AiCall[];
  reported: boolean;
  distinctId?: string;
  properties?: Record<string, unknown>;
}

const store = new AsyncLocalStorage<AiUsageScope>();

export function runWithAiUsage<T>(
  action: string,
  fn: (scope: AiUsageScope) => Promise<T>,
): Promise<T> {
  const scope: AiUsageScope = { action, calls: [], reported: false };
  return store.run(scope, () => fn(scope));
}

export function currentAiUsage(): AiUsageScope | undefined {
  return store.getStore();
}
