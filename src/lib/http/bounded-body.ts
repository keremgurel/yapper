export type RequestBodyErrorCode =
  | "payload_too_large"
  | "unsupported_media_type"
  | "unsupported_content_encoding"
  | "invalid_content_length"
  | "invalid_body"
  | "invalid_json";

const ERROR_STATUS: Record<RequestBodyErrorCode, number> = {
  payload_too_large: 413,
  unsupported_media_type: 415,
  unsupported_content_encoding: 415,
  invalid_content_length: 400,
  invalid_body: 400,
  invalid_json: 400,
};

export class RequestBodyError extends Error {
  readonly status: number;

  constructor(
    readonly code: RequestBodyErrorCode,
    readonly limitBytes?: number,
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.name = "RequestBodyError";
    this.status = ERROR_STATUS[code];
  }
}

export interface BoundedBodyOptions {
  maxBytes: number;
  allowedMediaTypes?: readonly string[] | ((mediaType: string) => boolean);
  requireContentType?: boolean;
}

export interface BoundedBody {
  /** Owned, contiguous bytes backed by an ArrayBuffer (never SharedArrayBuffer). */
  bytes: Uint8Array<ArrayBuffer>;
  /** Lowercase media type without parameters, or null when none was supplied. */
  mediaType: string | null;
}

function normalizeMediaType(value: string | null): string | null {
  if (value === null) return null;
  const mediaType = value.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType || null;
}

function validateOptions(options: BoundedBodyOptions): void {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) {
    throw new TypeError("invalid_body_byte_limit");
  }
  if (Array.isArray(options.allowedMediaTypes)) {
    if (
      options.allowedMediaTypes.length === 0 ||
      options.allowedMediaTypes.some(
        (value) => normalizeMediaType(value) !== value,
      )
    ) {
      throw new TypeError("invalid_allowed_media_types");
    }
  }
}

function parseContentLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (raw === null) return null;
  if (!/^[0-9]+$/.test(raw)) {
    throw new RequestBodyError("invalid_content_length");
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new RequestBodyError("invalid_content_length");
  }
  return value;
}

function acceptsMediaType(
  mediaType: string,
  allowed: NonNullable<BoundedBodyOptions["allowedMediaTypes"]>,
): boolean {
  return typeof allowed === "function"
    ? allowed(mediaType)
    : allowed.includes(mediaType);
}

function cancelStream(
  stream: ReadableStream<Uint8Array> | null,
  reason: unknown,
): void {
  if (!stream) return;
  try {
    void stream.cancel(reason).catch(() => undefined);
  } catch {
    // Cancellation is cleanup. It must never replace the useful primary error.
  }
}

/**
 * Read a Fetch request body without ever trusting Content-Length as the size
 * boundary. The declared length is an early rejection/integrity signal; the
 * cumulative streamed byte count remains authoritative.
 */
export async function readBoundedBody(
  request: Request,
  options: BoundedBodyOptions,
): Promise<BoundedBody> {
  validateOptions(options);

  let declared: number | null;
  try {
    declared = parseContentLength(request);
  } catch (error) {
    cancelStream(request.body, error);
    throw error;
  }
  if (declared !== null && declared > options.maxBytes) {
    const error = new RequestBodyError("payload_too_large", options.maxBytes);
    cancelStream(request.body, error);
    throw error;
  }

  const contentEncoding = request.headers
    .get("content-encoding")
    ?.trim()
    .toLowerCase();
  if (contentEncoding && contentEncoding !== "identity") {
    const error = new RequestBodyError("unsupported_content_encoding");
    cancelStream(request.body, error);
    throw error;
  }

  const mediaType = normalizeMediaType(request.headers.get("content-type"));
  if (
    (options.requireContentType && mediaType === null) ||
    (mediaType !== null &&
      options.allowedMediaTypes !== undefined &&
      !acceptsMediaType(mediaType, options.allowedMediaTypes))
  ) {
    const error = new RequestBodyError("unsupported_media_type");
    cancelStream(request.body, error);
    throw error;
  }

  if (!request.body) {
    if (declared !== null && declared !== 0) {
      throw new RequestBodyError("invalid_body");
    }
    return { bytes: new Uint8Array(new ArrayBuffer(0)), mediaType };
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = request.body.getReader();
  } catch (cause) {
    throw new RequestBodyError("invalid_body", undefined, { cause });
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  let cancelled = false;
  const cancelReader = (reason: unknown): void => {
    if (cancelled) return;
    cancelled = true;
    try {
      void reader.cancel(reason).catch(() => undefined);
    } catch {
      // Preserve the body error that made cancellation necessary.
    }
  };

  let rejectOnAbort: ((reason: unknown) => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectOnAbort = reject;
  });
  const abort = () =>
    rejectOnAbort?.(
      new RequestBodyError("invalid_body", undefined, {
        cause: request.signal.reason,
      }),
    );
  request.signal.addEventListener("abort", abort, { once: true });

  try {
    if (request.signal.aborted) abort();
    while (true) {
      const { done, value } = await Promise.race([reader.read(), aborted]);
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        throw new RequestBodyError("invalid_body");
      }
      if (value.byteLength === 0) continue;
      if (value.byteLength > options.maxBytes - total) {
        const error = new RequestBodyError(
          "payload_too_large",
          options.maxBytes,
        );
        cancelReader(error);
        throw error;
      }
      chunks.push(value);
      total += value.byteLength;
    }
    if (declared !== null && total !== declared) {
      throw new RequestBodyError("invalid_body");
    }
  } catch (error) {
    cancelReader(error);
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError("invalid_body", undefined, { cause: error });
  } finally {
    request.signal.removeEventListener("abort", abort);
    try {
      reader.releaseLock();
    } catch {
      // A raced read may remain pending while best-effort cancellation settles.
      // Lock cleanup must not replace the typed error returned to the caller.
    }
  }

  const bytes = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, mediaType };
}

const isJsonMediaType = (mediaType: string): boolean =>
  mediaType === "application/json" ||
  (mediaType.startsWith("application/") && mediaType.endsWith("+json"));

export async function readBoundedJson<T = unknown>(
  request: Request,
  options: Pick<BoundedBodyOptions, "maxBytes">,
): Promise<T> {
  const { bytes } = await readBoundedBody(request, {
    maxBytes: options.maxBytes,
    allowedMediaTypes: isJsonMediaType,
    requireContentType: true,
  });
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as T;
  } catch (cause) {
    throw new RequestBodyError("invalid_json", undefined, { cause });
  }
}

export function requestBodyErrorResponse(error: unknown): Response | null {
  if (!(error instanceof RequestBodyError)) return null;
  return Response.json(
    error.code === "payload_too_large"
      ? { error: error.code, limitBytes: error.limitBytes }
      : { error: error.code },
    {
      status: error.status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
