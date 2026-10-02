/**
 * One place that notices when a Studio action was refused for billing, so
 * every AI button does not need its own upgrade prompt. It watches the
 * browser's fetch for a 402 from our own API and tells whoever is listening.
 */

export type PaywallReason = "not_entitled" | "insufficient_credits";

const REASONS = new Set<string>(["not_entitled", "insufficient_credits"]);
const listeners = new Set<(reason: PaywallReason) => void>();

export function onPaywall(listener: (reason: PaywallReason) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function report(reason: PaywallReason) {
  for (const listener of listeners) listener(reason);
}

function requestPath(input: RequestInfo | URL): string | null {
  try {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
      window.location.origin,
    );
    return url.origin === window.location.origin ? url.pathname : null;
  } catch {
    return null;
  }
}

/** Which refusals the Studio prompt handles. Train feedback has its own. */
export function isStudioPaywallPath(path: string | null): boolean {
  return (
    !!path && path.startsWith("/api/") && !path.startsWith("/api/training/")
  );
}

export function paywallReason(body: unknown): PaywallReason | null {
  const code = (body as { error?: unknown } | null)?.error;
  return typeof code === "string" && REASONS.has(code)
    ? (code as PaywallReason)
    : null;
}

let installed = false;

/** Wrap `fetch` once per page. Callers still get the original response. */
export function installPaywallWatch() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await original(input, init);
    if (response.status === 402 && isStudioPaywallPath(requestPath(input))) {
      response
        .clone()
        .json()
        .then((body) => {
          const reason = paywallReason(body);
          if (reason) report(reason);
        })
        .catch(() => {});
    }
    return response;
  };
}
