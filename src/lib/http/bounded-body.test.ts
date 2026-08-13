import { describe, expect, it, vi } from "vitest";
import {
  readBoundedBody,
  readBoundedJson,
  requestBodyErrorResponse,
  RequestBodyError,
} from "./bounded-body";

const encoder = new TextEncoder();

function streamingRequest(
  stream: ReadableStream<Uint8Array>,
  options: { headers?: HeadersInit; signal?: AbortSignal } = {},
): Request {
  return new Request("https://ypr.app/api/test", {
    method: "POST",
    body: stream,
    headers: options.headers,
    signal: options.signal,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

function chunkedRequest(
  chunks: readonly Uint8Array[],
  options: {
    headers?: HeadersInit;
    signal?: AbortSignal;
    onCancel?: (reason: unknown) => void;
  } = {},
): Request {
  let index = 0;
  return streamingRequest(
    new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          const chunk = chunks[index++];
          if (chunk) controller.enqueue(chunk);
          else controller.close();
        },
        cancel: options.onCancel,
      },
      { highWaterMark: 0 },
    ),
    options,
  );
}

async function expectBodyError(
  promise: Promise<unknown>,
  code: RequestBodyError["code"],
): Promise<RequestBodyError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(RequestBodyError);
    expect(error).toMatchObject({ code });
    return error as RequestBodyError;
  }
  throw new Error("expected RequestBodyError");
}

describe("readBoundedBody", () => {
  it.each([0, 1, 5])(
    "accepts %i bytes through an exact five-byte cap",
    async (size) => {
      const result = await readBoundedBody(
        chunkedRequest([new Uint8Array(size)], {
          headers: { "content-length": String(size) },
        }),
        { maxBytes: 5 },
      );
      expect(result.bytes).toHaveLength(size);
    },
  );

  it("preserves byte order across streamed chunks, including empty chunks", async () => {
    const result = await readBoundedBody(
      chunkedRequest([
        new Uint8Array([1, 2]),
        new Uint8Array(),
        new Uint8Array([3, 4, 5]),
      ]),
      { maxBytes: 5 },
    );
    expect([...result.bytes]).toEqual([1, 2, 3, 4, 5]);
  });

  it.each([
    ["one oversized chunk", [6]],
    ["cumulative streamed overflow", [3, 3]],
  ])("rejects %s and cancels the reader", async (_name, sizes) => {
    const cancelled = vi.fn();
    const request = chunkedRequest(
      sizes.map((size) => new Uint8Array(size)),
      { onCancel: cancelled },
    );
    const error = await expectBodyError(
      readBoundedBody(request, { maxBytes: 5 }),
      "payload_too_large",
    );
    expect(error.limitBytes).toBe(5);
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it("rejects an oversized declaration before reading and cancels the body", async () => {
    const cancelled = vi.fn();
    const request = chunkedRequest([new Uint8Array([1])], {
      headers: { "content-length": "6" },
      onCancel: cancelled,
    });
    await expectBodyError(
      readBoundedBody(request, { maxBytes: 5 }),
      "payload_too_large",
    );
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it("does not wait for cancellation before returning an early header error", async () => {
    const cancelled = vi.fn(() => new Promise<void>(() => undefined));
    const request = streamingRequest(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new Uint8Array([1]));
        },
        cancel: cancelled,
      }),
      { headers: { "content-length": "6" } },
    );

    await expectBodyError(
      readBoundedBody(request, { maxBytes: 5 }),
      "payload_too_large",
    );
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it("does not trust a smaller declared length as the streamed boundary", async () => {
    await expectBodyError(
      readBoundedBody(
        chunkedRequest([new Uint8Array(3), new Uint8Array(3)], {
          headers: { "content-length": "1" },
        }),
        { maxBytes: 5 },
      ),
      "payload_too_large",
    );
  });

  it.each([
    ["declared larger", "5", 4],
    ["declared smaller", "3", 4],
  ])(
    "rejects an in-cap Content-Length mismatch: %s",
    async (_name, declared, actual) => {
      await expectBodyError(
        readBoundedBody(
          chunkedRequest([new Uint8Array(actual)], {
            headers: { "content-length": declared },
          }),
          { maxBytes: 5 },
        ),
        "invalid_body",
      );
    },
  );

  it("accepts a streamed body with no Content-Length", async () => {
    const result = await readBoundedBody(
      chunkedRequest([new Uint8Array([1]), new Uint8Array([2])]),
      { maxBytes: 2 },
    );
    expect([...result.bytes]).toEqual([1, 2]);
  });

  it.each(["-1", "+1", "1.0", "1e3", "Infinity", "1, 1", "9007199254740992"])(
    "rejects malformed Content-Length %s and cancels",
    async (value) => {
      const cancelled = vi.fn();
      const request = chunkedRequest([new Uint8Array([1])], {
        headers: { "content-length": value },
        onCancel: cancelled,
      });
      await expectBodyError(
        readBoundedBody(request, { maxBytes: 5 }),
        "invalid_content_length",
      );
      expect(cancelled).toHaveBeenCalledOnce();
    },
  );

  it("accepts an absent body and rejects a false nonzero declaration", async () => {
    await expect(
      readBoundedBody(new Request("https://ypr.app/api/test"), {
        maxBytes: 5,
      }),
    ).resolves.toMatchObject({ bytes: new Uint8Array() });
    await expectBodyError(
      readBoundedBody(
        new Request("https://ypr.app/api/test", {
          headers: { "content-length": "1" },
        }),
        { maxBytes: 5 },
      ),
      "invalid_body",
    );
  });

  it("maps a body stream failure to invalid_body and attempts cancellation", async () => {
    const request = streamingRequest(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error("socket failed"));
        },
      }),
    );
    const error = await expectBodyError(
      readBoundedBody(request, { maxBytes: 5 }),
      "invalid_body",
    );
    expect(error.cause).toBeInstanceOf(Error);
  });

  it("rejects an already-consumed body", async () => {
    const request = new Request("https://ypr.app/api/test", {
      method: "POST",
      body: "used",
    });
    await request.text();
    await expectBodyError(
      readBoundedBody(request, { maxBytes: 5 }),
      "invalid_body",
    );
  });

  it("rejects a locked body", async () => {
    const request = chunkedRequest([new Uint8Array([1])]);
    const lock = request.body!.getReader();
    try {
      await expectBodyError(
        readBoundedBody(request, { maxBytes: 5 }),
        "invalid_body",
      );
    } finally {
      await lock.cancel();
      lock.releaseLock();
    }
  });

  it("cancels immediately when the request signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort("gone");
    const cancelled = vi.fn();
    await expectBodyError(
      readBoundedBody(
        chunkedRequest([new Uint8Array([1])], {
          signal: controller.signal,
          onCancel: cancelled,
        }),
        { maxBytes: 5 },
      ),
      "invalid_body",
    );
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it("settles a stalled read and cancels when the request aborts", async () => {
    const controller = new AbortController();
    const cancelled = vi.fn();
    const request = streamingRequest(
      new ReadableStream<Uint8Array>({
        pull() {
          return new Promise<void>(() => undefined);
        },
        cancel: cancelled,
      }),
      { signal: controller.signal },
    );
    const pending = readBoundedBody(request, { maxBytes: 5 });
    controller.abort("client disconnected");
    await expectBodyError(pending, "invalid_body");
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it("returns an abort error even when reader cancellation never settles", async () => {
    const controller = new AbortController();
    const cancelled = vi.fn(() => new Promise<void>(() => undefined));
    const request = streamingRequest(
      new ReadableStream<Uint8Array>({
        pull() {
          return new Promise<void>(() => undefined);
        },
        cancel: cancelled,
      }),
      { signal: controller.signal },
    );

    const pending = readBoundedBody(request, { maxBytes: 5 });
    controller.abort("client disconnected");
    await expectBodyError(pending, "invalid_body");
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it("returns an overflow error even when reader cancellation never settles", async () => {
    const cancelled = vi.fn(() => new Promise<void>(() => undefined));
    const request = streamingRequest(
      new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            controller.enqueue(new Uint8Array(6));
          },
          cancel: cancelled,
        },
        { highWaterMark: 0 },
      ),
    );

    await expectBodyError(
      readBoundedBody(request, { maxBytes: 5 }),
      "payload_too_large",
    );
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it("does not let a cancellation failure replace an overflow error", async () => {
    const request = streamingRequest(
      new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            controller.enqueue(new Uint8Array(6));
          },
          cancel() {
            throw new Error("cancel failed");
          },
        },
        { highWaterMark: 0 },
      ),
    );
    await expectBodyError(
      readBoundedBody(request, { maxBytes: 5 }),
      "payload_too_large",
    );
  });

  it("pulls a gated stream sequentially and never calls eager body helpers", async () => {
    const pulls: number[] = [];
    let value = 0;
    const request = streamingRequest(
      new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            pulls.push(value);
            if (value === 3) controller.close();
            else controller.enqueue(new Uint8Array([++value]));
          },
        },
        { highWaterMark: 0 },
      ),
    );
    const arrayBuffer = vi.spyOn(request, "arrayBuffer");
    const text = vi.spyOn(request, "text");
    const json = vi.spyOn(request, "json");
    const result = await readBoundedBody(request, { maxBytes: 3 });
    expect([...result.bytes]).toEqual([1, 2, 3]);
    expect(pulls).toEqual([0, 1, 2, 3]);
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it.each([
    ["normalizes parameters and case", "Audio/WebM; codecs=opus", "audio/webm"],
    ["allows an optional missing type", undefined, null],
  ])("%s", async (_name, contentType, expected) => {
    const result = await readBoundedBody(
      chunkedRequest([new Uint8Array([1])], {
        headers: contentType ? { "content-type": contentType } : undefined,
      }),
      { maxBytes: 1, allowedMediaTypes: ["audio/webm"] },
    );
    expect(result.mediaType).toBe(expected);
  });

  it.each([undefined, "text/plain", "application/json"])(
    "rejects required or disallowed media type %s",
    async (contentType) => {
      const cancelled = vi.fn();
      await expectBodyError(
        readBoundedBody(
          chunkedRequest([new Uint8Array([1])], {
            headers: contentType ? { "content-type": contentType } : undefined,
            onCancel: cancelled,
          }),
          {
            maxBytes: 1,
            allowedMediaTypes: ["audio/webm"],
            requireContentType: true,
          },
        ),
        "unsupported_media_type",
      );
      expect(cancelled).toHaveBeenCalledOnce();
    },
  );

  it.each(["gzip", "br", "deflate", "gzip, br"])(
    "rejects unsupported Content-Encoding %s and cancels before reading",
    async (contentEncoding) => {
      const cancelled = vi.fn();
      await expectBodyError(
        readBoundedBody(
          chunkedRequest([new Uint8Array([1])], {
            headers: { "content-encoding": contentEncoding },
            onCancel: cancelled,
          }),
          { maxBytes: 5 },
        ),
        "unsupported_content_encoding",
      );
      expect(cancelled).toHaveBeenCalledOnce();
    },
  );

  it("allows the identity Content-Encoding", async () => {
    await expect(
      readBoundedBody(
        chunkedRequest([new Uint8Array([1])], {
          headers: { "content-encoding": "Identity" },
        }),
        { maxBytes: 1 },
      ),
    ).resolves.toMatchObject({ bytes: new Uint8Array([1]) });
  });

  it("maps a malformed non-byte stream chunk to invalid_body", async () => {
    const cancelled = vi.fn();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue("not bytes");
      },
      cancel: cancelled,
    }) as unknown as ReadableStream<Uint8Array>;
    await expectBodyError(
      readBoundedBody(streamingRequest(stream), { maxBytes: 5 }),
      "invalid_body",
    );
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid byte limit %s before touching the body",
    async (maxBytes) => {
      await expect(
        readBoundedBody(chunkedRequest([new Uint8Array([1])]), { maxBytes }),
      ).rejects.toThrow("invalid_body_byte_limit");
    },
  );
});

describe("readBoundedJson", () => {
  const jsonRequest = (
    chunks: readonly Uint8Array[],
    contentType = "application/json",
  ) =>
    chunkedRequest(chunks, {
      headers: { "content-type": contentType },
    });

  it.each([
    ["object", '{"ok":true}', { ok: true }],
    ["array", "[1,2]", [1, 2]],
    ["scalar", "42", 42],
  ])("parses a valid JSON %s", async (_name, source, expected) => {
    await expect(
      readBoundedJson(jsonRequest([encoder.encode(source)]), {
        maxBytes: 64,
      }),
    ).resolves.toEqual(expected);
  });

  it("decodes multibyte UTF-8 split across chunks and counts encoded bytes", async () => {
    const source = encoder.encode('{"value":"é"}');
    const result = await readBoundedJson<{ value: string }>(
      jsonRequest([
        source.slice(0, 11),
        source.slice(11, 12),
        source.slice(12),
      ]),
      { maxBytes: source.byteLength },
    );
    expect(result).toEqual({ value: "é" });
    await expectBodyError(
      readBoundedJson(jsonRequest([source]), {
        maxBytes: source.byteLength - 1,
      }),
      "payload_too_large",
    );
  });

  it("accepts a UTF-8 BOM", async () => {
    const source = new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode("{}")]);
    await expect(
      readBoundedJson(jsonRequest([source]), { maxBytes: source.byteLength }),
    ).resolves.toEqual({});
  });

  it.each([
    ["empty", new Uint8Array()],
    ["whitespace", encoder.encode("  \n")],
    ["truncated", encoder.encode('{"a":')],
    ["trailing garbage", encoder.encode("{} nope")],
    ["malformed UTF-8", new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x7d])],
  ])("rejects %s JSON", async (_name, source) => {
    await expectBodyError(
      readBoundedJson(jsonRequest([source]), { maxBytes: 64 }),
      "invalid_json",
    );
  });

  it.each([
    "application/json",
    "Application/JSON; Charset=UTF-8",
    "application/problem+json",
    "application/vnd.yapper+json",
  ])("accepts JSON media type %s", async (contentType) => {
    await expect(
      readBoundedJson(jsonRequest([encoder.encode("{}")], contentType), {
        maxBytes: 2,
      }),
    ).resolves.toEqual({});
  });

  it.each([undefined, "text/json", "text/plain", "application/javascript"])(
    "rejects non-JSON media type %s",
    async (contentType) => {
      const request = chunkedRequest([encoder.encode("{}")], {
        headers: contentType ? { "content-type": contentType } : undefined,
      });
      await expectBodyError(
        readBoundedJson(request, { maxBytes: 2 }),
        "unsupported_media_type",
      );
    },
  );
});

describe("requestBodyErrorResponse", () => {
  it.each([
    ["payload_too_large", 413],
    ["unsupported_media_type", 415],
    ["unsupported_content_encoding", 415],
    ["invalid_content_length", 400],
    ["invalid_body", 400],
    ["invalid_json", 400],
  ] as const)("maps %s to a no-store %i response", async (code, status) => {
    const response = requestBodyErrorResponse(
      new RequestBodyError(code, code === "payload_too_large" ? 5 : undefined),
    );
    expect(response).not.toBeNull();
    expect(response!.status).toBe(status);
    expect(response!.headers.get("cache-control")).toBe("no-store");
    await expect(response!.json()).resolves.toEqual(
      code === "payload_too_large"
        ? { error: code, limitBytes: 5 }
        : { error: code },
    );
  });

  it("does not swallow unrelated exceptions", () => {
    expect(requestBodyErrorResponse(new Error("boom"))).toBeNull();
  });
});
