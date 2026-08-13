export type OutboundHttpErrorCode =
  | "timeout"
  | "aborted"
  | "network_error"
  | "response_too_large"
  | "invalid_response";

export class OutboundHttpError extends Error {
  constructor(
    readonly code: OutboundHttpErrorCode,
    readonly details: { limitBytes?: number; cause?: unknown } = {},
  ) {
    super(code, { cause: details.cause });
    this.name = "OutboundHttpError";
  }
}

export interface BoundedFetchOptions {
  /** Covers both receiving response headers and consuming the full body. */
  timeoutMs: number;
  /**
   * Maximum decoded bytes exposed by the Fetch response stream. The reader
   * copies chunks into a bounded geometric buffer and then returns a right-sized
   * copy, so peak application memory is roughly 2x maxBytes. This primitive is
   * intended for small provider control-plane JSON/text responses, not media.
   */
  maxBytes: number;
  /** Usually the inbound request signal, so disconnects stop provider work. */
  signal?: AbortSignal;
}

export interface BoundedFetchResponse {
  /** The original response, with its body consumed. Status and headers remain available. */
  response: Response;
  bytes: Uint8Array;
}

export interface BoundedJsonResponse<T> {
  response: Response;
  data: T;
}

export interface BoundedTextResponse {
  response: Response;
  text: string;
}

function validateOptions(options: BoundedFetchOptions): void {
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new TypeError("invalid_outbound_timeout");
  }
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) {
    throw new TypeError("invalid_outbound_byte_limit");
  }
}

function cancelBodyNonBlocking(
  body: ReadableStream<Uint8Array> | null,
  reason: unknown,
): void {
  if (!body) return;
  try {
    void body.cancel(reason).catch(() => undefined);
  } catch {
    // Cleanup is deliberately best effort and must never mask the primary error.
  }
}

function cancelReaderNonBlocking(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  reason: unknown,
): void {
  try {
    void reader.cancel(reason).catch(() => undefined);
  } catch {
    // Cleanup is deliberately best effort and must never mask the primary error.
  }
}

function abortError(
  timeoutSignal: AbortSignal,
  cause: unknown,
): OutboundHttpError {
  return new OutboundHttpError(timeoutSignal.aborted ? "timeout" : "aborted", {
    cause,
  });
}

function responseEncoding(response: Response): "identity" | "encoded" {
  const raw = response.headers.get("content-encoding")?.trim().toLowerCase();
  if (!raw || raw === "identity") return "identity";

  // Fetch implementations used by browsers and Next's Node runtime expose a
  // decoded response.body while retaining the wire Content-Encoding and often
  // its compressed Content-Length. Count the decoded stream, and never compare
  // that stream with compressed wire length. Unknown or stacked encodings are
  // ambiguous across Fetch implementations and are rejected.
  if (raw === "gzip" || raw === "br" || raw === "deflate") return "encoded";
  throw new OutboundHttpError("invalid_response", {
    cause: new Error("unsupported_content_encoding"),
  });
}

function responseContentLength(response: Response): number | null {
  const raw = response.headers.get("content-length");
  if (raw === null) return null;
  if (!/^[0-9]+$/.test(raw)) {
    throw new OutboundHttpError("invalid_response", {
      cause: new Error("invalid_content_length"),
    });
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new OutboundHttpError("invalid_response", {
      cause: new Error("invalid_content_length"),
    });
  }
  return value;
}

function responseTooLarge(limitBytes: number): OutboundHttpError {
  return new OutboundHttpError("response_too_large", { limitBytes });
}

/**
 * Fetch and fully consume a response under one deadline and decoded byte cap.
 * Content-Length is only an early signal; streamed bytes remain authoritative.
 */
export async function fetchBoundedResponse(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: BoundedFetchOptions,
): Promise<BoundedFetchResponse> {
  validateOptions(options);
  const timeoutSignal = AbortSignal.timeout(options.timeoutMs);
  const signals = [init.signal, options.signal, timeoutSignal].filter(
    (signal): signal is AbortSignal => signal != null,
  );
  const signal = signals.length === 1 ? signals[0] : AbortSignal.any(signals);

  let response: Response;
  let rejectFetchAbort: ((reason: unknown) => void) | undefined;
  const fetchAborted = new Promise<never>((_resolve, reject) => {
    rejectFetchAbort = reject;
  });
  const onFetchAbort = () =>
    rejectFetchAbort?.(abortError(timeoutSignal, signal.reason));
  signal.addEventListener("abort", onFetchAbort, { once: true });
  try {
    if (signal.aborted) throw abortError(timeoutSignal, signal.reason);
    response = await Promise.race([
      fetch(input, { ...init, signal }),
      fetchAborted,
    ]);
  } catch (cause) {
    if (cause instanceof OutboundHttpError) throw cause;
    if (signal.aborted) throw abortError(timeoutSignal, cause);
    throw new OutboundHttpError("network_error", { cause });
  } finally {
    signal.removeEventListener("abort", onFetchAbort);
  }

  let encoding: "identity" | "encoded";
  let declared: number | null;
  try {
    encoding = responseEncoding(response);
    declared = responseContentLength(response);
  } catch (error) {
    cancelBodyNonBlocking(response.body, error);
    throw error;
  }

  if (
    encoding === "identity" &&
    declared !== null &&
    declared > options.maxBytes
  ) {
    const error = responseTooLarge(options.maxBytes);
    cancelBodyNonBlocking(response.body, error);
    throw error;
  }
  if (!response.body) {
    if (encoding === "identity" && declared !== null && declared !== 0) {
      throw new OutboundHttpError("invalid_response", {
        cause: new Error("content_length_mismatch"),
      });
    }
    return { response, bytes: new Uint8Array() };
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = response.body.getReader();
  } catch (cause) {
    throw new OutboundHttpError("invalid_response", { cause });
  }

  let rejectAbort: ((reason: unknown) => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => rejectAbort?.(abortError(timeoutSignal, signal.reason));
  signal.addEventListener("abort", onAbort, { once: true });

  let storage = new Uint8Array(0);
  let total = 0;
  try {
    if (signal.aborted) onAbort();
    while (true) {
      const { done, value } = await Promise.race([reader.read(), aborted]);
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        throw new OutboundHttpError("invalid_response", {
          cause: new Error("invalid_response_chunk"),
        });
      }
      if (value.byteLength === 0) continue;
      if (value.byteLength > options.maxBytes - total) {
        throw responseTooLarge(options.maxBytes);
      }
      const required = total + value.byteLength;
      if (required > storage.byteLength) {
        const nextCapacity = Math.min(
          options.maxBytes,
          Math.max(
            required,
            storage.byteLength === 0 ? 8_192 : storage.byteLength * 2,
          ),
        );
        try {
          const expanded = new Uint8Array(nextCapacity);
          expanded.set(storage);
          storage = expanded;
        } catch (cause) {
          throw new OutboundHttpError("invalid_response", { cause });
        }
      }
      storage.set(value, total);
      total += value.byteLength;
    }
    if (encoding === "identity" && declared !== null && declared !== total) {
      throw new OutboundHttpError("invalid_response", {
        cause: new Error("content_length_mismatch"),
      });
    }
  } catch (error) {
    cancelReaderNonBlocking(reader, error);
    if (error instanceof OutboundHttpError) throw error;
    throw new OutboundHttpError("invalid_response", { cause: error });
  } finally {
    signal.removeEventListener("abort", onAbort);
    try {
      reader.releaseLock();
    } catch {
      // Cleanup must not mask a timeout, abort, size, or response error.
    }
  }

  return { response, bytes: storage.slice(0, total) };
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new OutboundHttpError("invalid_response", { cause });
  }
}

export async function fetchBoundedText(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: BoundedFetchOptions,
): Promise<BoundedTextResponse> {
  const { response, bytes } = await fetchBoundedResponse(input, init, options);
  return { response, text: decodeUtf8(bytes) };
}

function isJsonMediaType(value: string | null): boolean {
  const mediaType = value?.split(";", 1)[0]?.trim().toLowerCase();
  return (
    mediaType === "application/json" ||
    (!!mediaType &&
      mediaType.startsWith("application/") &&
      mediaType.endsWith("+json"))
  );
}

export async function fetchBoundedJson<T = unknown>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: BoundedFetchOptions,
): Promise<BoundedJsonResponse<T>> {
  const { response, bytes } = await fetchBoundedResponse(input, init, options);
  if (!isJsonMediaType(response.headers.get("content-type"))) {
    throw new OutboundHttpError("invalid_response", {
      cause: new Error("invalid_json_content_type"),
    });
  }
  try {
    const text = decodeUtf8(bytes);
    return { response, data: JSON.parse(text) as T };
  } catch (cause) {
    if (cause instanceof OutboundHttpError) throw cause;
    throw new OutboundHttpError("invalid_response", { cause });
  }
}
