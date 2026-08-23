import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expandIdea } from "./expand";

beforeEach(() => {
  vi.stubEnv("SURPLUS_API_KEY", "test_key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("expandIdea provider request", () => {
  it("sets an explicit output budget and composes the caller abort signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content: '{"title":"A useful idea","pillar":null,"sections":[]}',
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expandIdea(
      { transcript: "A bounded idea" },
      { section: "", pillarNames: [] },
      controller.signal,
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toMatchObject({
      max_completion_tokens: 3_000,
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal).not.toBe(controller.signal);
    expect(init.signal?.aborted).toBe(false);
    controller.abort("client_disconnected");
    expect(init.signal?.aborted).toBe(true);
  });
});
