import { AsyncLocalStorage } from "node:async_hooks";

/**
 * A `Server-Timing` header for route handlers, so a client can tell time spent
 * on the server from time spent on the network.
 *
 * The request's timings live in AsyncLocalStorage: the database client records
 * into whatever request is current when it runs a query, and nothing has to be
 * threaded through function arguments. Outside a wrapped handler the recorders
 * are no-ops.
 */

interface Span {
  ms: number;
  count: number;
}

type Timings = Map<string, Span>;

const store = new AsyncLocalStorage<Timings>();

/**
 * Start timing one unit of work under `name` (for example "db"). Returns the
 * function that stops it, or null when no timed request is running, so a
 * caller outside a request pays nothing.
 */
export function startSpan(name: string): (() => void) | null {
  const timings = store.getStore();
  if (!timings) return null;
  const start = performance.now();
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const span = timings.get(name) ?? { ms: 0, count: 0 };
    span.ms += performance.now() - start;
    span.count += 1;
    timings.set(name, span);
  };
}

/** Format timings as a `Server-Timing` value: `total` first, then each span. */
export function formatServerTiming(totalMs: number, timings: Timings): string {
  const parts = [`total;dur=${totalMs.toFixed(1)}`];
  for (const [name, span] of timings) {
    parts.push(`${name};dur=${span.ms.toFixed(1)};desc="${span.count}"`);
  }
  return parts.join(", ");
}

function withHeader(response: Response, value: string): Response {
  try {
    response.headers.set("Server-Timing", value);
    return response;
  } catch {
    // Some responses (redirects, fetch passthroughs) have immutable headers.
    const copy = new Response(response.body, response);
    copy.headers.set("Server-Timing", value);
    return copy;
  }
}

/**
 * Wrap a route handler so its response carries `Server-Timing`: the handler's
 * total time plus every span recorded while it ran (database time and query
 * count, today). The wrapped function keeps the handler's exact signature.
 */
export function withServerTiming<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return (...args: Args) => {
    const timings: Timings = new Map();
    const start = performance.now();
    return store.run(timings, async () => {
      const response = await handler(...args);
      return withHeader(
        response,
        formatServerTiming(performance.now() - start, timings),
      );
    });
  };
}
