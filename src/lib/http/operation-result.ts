/**
 * What a shared operation returns, so a route and a Chirpy executor can call
 * the same function and each turn a refusal into its own reply: the route into
 * the JSON error it always sent, Chirpy into a sentence for the creator.
 */
export type OperationResult<T> = { ok: true; value: T } | OperationRefusal;

export interface OperationRefusal {
  ok: false;
  status: number;
  error: string;
  detail?: string;
  /** A guard's own reply (rate limits carry Retry-After), sent back as is by
   * a route. */
  response?: Response;
}

export function succeeded<T>(value: T): OperationResult<T> {
  return { ok: true, value };
}

export function refused(
  status: number,
  error: string,
  detail?: string,
): OperationRefusal {
  return detail === undefined
    ? { ok: false, status, error }
    : { ok: false, status, error, detail };
}

/** The billing and rate-limit guards answer with a ready Response; read its
 * status and error code so a caller that is not a route can explain it. */
export async function refusedBy(response: Response): Promise<OperationRefusal> {
  const body = (await response
    .clone()
    .json()
    .catch(() => ({}))) as { error?: unknown };
  return {
    ok: false,
    status: response.status,
    error: typeof body.error === "string" ? body.error : "refused",
    response,
  };
}

/** The reply a route has always sent for a refusal. */
export function refusalResponse(result: OperationRefusal): Response {
  if (result.response) return result.response;
  return Response.json(
    result.detail === undefined
      ? { error: result.error }
      : { error: result.error, detail: result.detail },
    { status: result.status },
  );
}
