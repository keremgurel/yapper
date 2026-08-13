import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchBoundedJson,
  fetchBoundedResponse,
  fetchBoundedText,
  OutboundHttpError,
} from "./outbound";

const encoder = new TextEncoder();

function streamResponse(
  chunks: readonly Uint8Array[],
  options: {
    headers?: HeadersInit;
    status?: number;
    onCancel?: (reason: unknown) => void | Promise<void>;
  } = {},
): Response {
  let index = 0;
  return new Response(
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
    { status: options.status, headers: options.headers },
  );
}

async function expectCode(
  promise: Promise<unknown>,
  code: OutboundHttpError["code"],
): Promise<OutboundHttpError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(OutboundHttpError);
    expect(error).toMatchObject({ code });
    return error as OutboundHttpError;
  }
  throw new Error("expected OutboundHttpError");
}

const options = { timeoutMs: 1_000, maxBytes: 5 };

afterEach(() => vi.unstubAllGlobals());

describe("fetchBoundedResponse", () => {
  it("preserves streamed bytes and response metadata at the exact cap", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        streamResponse(
          [new Uint8Array([1, 2]), new Uint8Array(), new Uint8Array([3, 4, 5])],
          {
            status: 202,
          },
        ),
      ),
    );
    const result = await fetchBoundedResponse(
      "https://provider.test",
      {},
      options,
    );
    expect([...result.bytes]).toEqual([1, 2, 3, 4, 5]);
    expect(result.response.status).toBe(202);
  });

  it("enforces actual bytes without Content-Length and cancels nonblocking", async () => {
    const cancelled = vi.fn(() => new Promise<void>(() => undefined));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        streamResponse([new Uint8Array(3), new Uint8Array(3)], {
          onCancel: cancelled,
        }),
      ),
    );
    const error = await expectCode(
      fetchBoundedResponse("https://provider.test", {}, options),
      "response_too_large",
    );
    expect(error.details.limitBytes).toBe(5);
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it("does not trust a smaller declared Content-Length", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        streamResponse([new Uint8Array(3), new Uint8Array(3)], {
          headers: { "content-length": "1" },
        }),
      ),
    );
    await expectCode(
      fetchBoundedResponse("https://provider.test", {}, options),
      "response_too_large",
    );
  });

  it("rejects an oversized identity declaration before pulling", async () => {
    const cancelled = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        streamResponse([new Uint8Array([1])], {
          headers: { "content-length": "6" },
          onCancel: cancelled,
        }),
      ),
    );
    await expectCode(
      fetchBoundedResponse("https://provider.test", {}, options),
      "response_too_large",
    );
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it("rejects malformed and mismatched identity Content-Length", async () => {
    for (const length of ["-1", "1.0", "Infinity", "9007199254740992"]) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          streamResponse([new Uint8Array([1])], {
            headers: { "content-length": length },
          }),
        ),
      );
      await expectCode(
        fetchBoundedResponse("https://provider.test", {}, options),
        "invalid_response",
      );
    }
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        streamResponse([new Uint8Array([1])], {
          headers: { "content-length": "2" },
        }),
      ),
    );
    await expectCode(
      fetchBoundedResponse("https://provider.test", {}, options),
      "invalid_response",
    );
  });

  it.each(["gzip", "br", "deflate"])(
    "counts the Fetch-decoded %s stream and ignores compressed wire length",
    async (encoding) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          streamResponse([new Uint8Array(5)], {
            headers: { "content-encoding": encoding, "content-length": "1" },
          }),
        ),
      );
      await expect(
        fetchBoundedResponse("https://provider.test", {}, options),
      ).resolves.toMatchObject({ bytes: new Uint8Array(5) });
    },
  );

  it("still caps the decoded stream of an encoded response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        streamResponse([new Uint8Array(6)], {
          headers: { "content-encoding": "gzip", "content-length": "1" },
        }),
      ),
    );
    await expectCode(
      fetchBoundedResponse("https://provider.test", {}, options),
      "response_too_large",
    );
  });

  it.each(["zstd", "gzip, br"])(
    "rejects ambiguous encoding %s",
    async (encoding) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          streamResponse([new Uint8Array([1])], {
            headers: { "content-encoding": encoding },
          }),
        ),
      );
      await expectCode(
        fetchBoundedResponse("https://provider.test", {}, options),
        "invalid_response",
      );
    },
  );

  it("classifies a stalled fetch deadline as timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    await expectCode(
      fetchBoundedResponse(
        "https://provider.test",
        {},
        { ...options, timeoutMs: 5 },
      ),
      "timeout",
    );
  });

  it("classifies a stalled body deadline as timeout and cancels", async () => {
    const cancelled = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            pull: () => new Promise<void>(() => undefined),
            cancel: cancelled,
          }),
        ),
      ),
    );
    await expectCode(
      fetchBoundedResponse(
        "https://provider.test",
        {},
        { ...options, timeoutMs: 5 },
      ),
      "timeout",
    );
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it.each(["option", "init"])(
    "composes and classifies the %s caller signal",
    async (source) => {
      const controller = new AbortController();
      vi.stubGlobal(
        "fetch",
        vi.fn(() => new Promise<Response>(() => undefined)),
      );
      const pending = fetchBoundedResponse(
        "https://provider.test",
        source === "init" ? { signal: controller.signal } : {},
        source === "option"
          ? { ...options, signal: controller.signal }
          : options,
      );
      controller.abort("caller gone");
      await expectCode(pending, "aborted");
    },
  );

  it("rejects a pre-aborted signal before calling fetch", async () => {
    const controller = new AbortController();
    controller.abort("already gone");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expectCode(
      fetchBoundedResponse(
        "https://provider.test",
        {},
        {
          ...options,
          signal: controller.signal,
        },
      ),
      "aborted",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("classifies a malformed response stream chunk", async () => {
    const malformedStream = new ReadableStream<unknown>({
      start(controller) {
        controller.enqueue("not bytes");
        controller.close();
      },
    });
    const malformed = new Response(malformedStream as unknown as BodyInit);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(malformed));
    await expectCode(
      fetchBoundedResponse("https://provider.test", {}, options),
      "invalid_response",
    );
  });

  it("classifies a non-abort fetch rejection as network_error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("dns")));
    await expectCode(
      fetchBoundedResponse("https://provider.test", {}, options),
      "network_error",
    );
  });

  it("classifies a response stream failure as invalid_response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.error(new Error("socket reset"));
            },
          }),
        ),
      ),
    );
    const error = await expectCode(
      fetchBoundedResponse("https://provider.test", {}, options),
      "invalid_response",
    );
    expect(error.details.cause).toBeInstanceOf(Error);
  });

  it("accepts an absent zero-length body and rejects a false declaration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null)));
    await expect(
      fetchBoundedResponse("https://provider.test", {}, options),
    ).resolves.toMatchObject({ bytes: new Uint8Array() });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(null, { headers: { "content-length": "1" } }),
        ),
    );
    await expectCode(
      fetchBoundedResponse("https://provider.test", {}, options),
      "invalid_response",
    );
  });

  it("rejects invalid options before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchBoundedResponse(
        "https://provider.test",
        {},
        { ...options, maxBytes: 0 },
      ),
    ).rejects.toThrow("invalid_outbound_byte_limit");
    await expect(
      fetchBoundedResponse(
        "https://provider.test",
        {},
        { ...options, timeoutMs: 0 },
      ),
    ).rejects.toThrow("invalid_outbound_timeout");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("strict response decoding", () => {
  it("decodes valid UTF-8 text and rejects invalid UTF-8", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(streamResponse([encoder.encode("héllo")])),
    );
    await expect(
      fetchBoundedText(
        "https://provider.test",
        {},
        { ...options, maxBytes: 10 },
      ),
    ).resolves.toMatchObject({ text: "héllo" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(streamResponse([new Uint8Array([0xc3, 0x28])])),
    );
    await expectCode(
      fetchBoundedText("https://provider.test", {}, options),
      "invalid_response",
    );
  });

  it.each(["application/json", "application/problem+json; charset=utf-8"])(
    "parses strict JSON with %s",
    async (contentType) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          streamResponse([encoder.encode('{"ok":true}')], {
            headers: { "content-type": contentType },
          }),
        ),
      );
      await expect(
        fetchBoundedJson<{ ok: boolean }>(
          "https://provider.test",
          {},
          {
            ...options,
            maxBytes: 20,
          },
        ),
      ).resolves.toMatchObject({ data: { ok: true } });
    },
  );

  it("rejects missing/wrong JSON media type, malformed JSON, and invalid UTF-8", async () => {
    for (const response of [
      streamResponse([encoder.encode("{}")]),
      streamResponse([encoder.encode("{}")], {
        headers: { "content-type": "text/plain" },
      }),
      streamResponse([encoder.encode("{")], {
        headers: { "content-type": "application/json" },
      }),
      streamResponse([new Uint8Array([0xc3, 0x28])], {
        headers: { "content-type": "application/json" },
      }),
    ]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      await expectCode(
        fetchBoundedJson("https://provider.test", {}, options),
        "invalid_response",
      );
    }
  });
});
