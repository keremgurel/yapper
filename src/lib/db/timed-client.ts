import { Client } from "pg";
import { startSpan } from "@/lib/http/server-timing";

type Callback = (...args: unknown[]) => void;

/**
 * Stop `stop` when the call settles, whichever async style the caller used:
 * a trailing callback (how `Pool` drives its clients) or a returned promise
 * (how drizzle drives a checked-out transaction client).
 */
function timeCall(
  args: unknown[],
  stop: () => void,
  call: (args: unknown[]) => unknown,
): unknown {
  const last = args[args.length - 1];
  if (typeof last === "function") {
    const callback = last as Callback;
    return call([
      ...args.slice(0, -1),
      (...result: unknown[]) => {
        stop();
        callback(...result);
      },
    ]);
  }
  const result = call(args);
  if (result && typeof (result as Promise<unknown>).then === "function") {
    // A side branch, so the caller still owns the original promise and its
    // rejection; this branch only observes that it settled.
    (result as Promise<unknown>).then(stop, stop);
  } else {
    stop();
  }
  return result;
}

/**
 * A pg client that reports its query and connect time to the current request's
 * `Server-Timing` ("db" and "dbconnect"). Outside a timed request it behaves
 * exactly like `pg.Client`. Handed to `Pool` as its client class.
 */
export class TimedClient extends Client {
  // Overloads of pg's query/connect are forwarded untouched.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override query(...args: any[]): any {
    const stop = startSpan("db");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (a: unknown[]) => (super.query as any).apply(this, a);
    return stop ? timeCall(args, stop, call) : call(args);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override connect(...args: any[]): any {
    const stop = startSpan("dbconnect");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (a: unknown[]) => (super.connect as any).apply(this, a);
    return stop ? timeCall(args, stop, call) : call(args);
  }
}
