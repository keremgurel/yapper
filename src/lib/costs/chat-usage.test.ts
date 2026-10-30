import { expect, it } from "vitest";
import { isChatCompletionsPath, readChatUsage } from "./chat-usage";

const encode = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value));

it("prices cached input at the cache rate and reads Surplus's settled cost", () => {
  // A real Surplus reply shape from the 2026-10-29 probe.
  const usage = readChatUsage(
    "gpt-5.4",
    encode({
      choices: [{ message: { content: "two" } }],
      usage: {
        prompt_tokens: 8026,
        completion_tokens: 4,
        prompt_tokens_details: { cached_tokens: 7808 },
        completion_tokens_details: { reasoning_tokens: 0 },
        buyer_cost_micro: 27,
      },
    }),
  );
  expect(usage).toEqual({
    model: "gpt-5.4",
    inputTokens: 8026,
    cachedInputTokens: 7808,
    outputTokens: 4,
    reasoningTokens: 0,
    // 218 x 2.5 + 7808 x 0.25 + 4 x 15
    listCostMicrousd: 2557,
    buyerCostMicrousd: 27,
  });
});

it("prices an unknown model high and tolerates missing cache and cost fields", () => {
  expect(
    readChatUsage(
      "someone-new",
      encode({ usage: { prompt_tokens: 100, completion_tokens: 10 } }),
    ),
  ).toMatchObject({
    cachedInputTokens: 0,
    listCostMicrousd: 100 * 10 + 10 * 50,
    buyerCostMicrousd: null,
  });
});

it("never counts more cached tokens than were sent", () => {
  expect(
    readChatUsage(
      "gpt-5.4-mini",
      encode({
        usage: {
          prompt_tokens: 10,
          completion_tokens: 0,
          prompt_tokens_details: { cached_tokens: 50 },
        },
      }),
    )?.cachedInputTokens,
  ).toBe(10);
});

it("returns nothing for replies without usage", () => {
  expect(readChatUsage("gpt-5.4", encode({ choices: [] }))).toBeNull();
  expect(readChatUsage("gpt-5.4", encode({ usage: {} }))).toBeNull();
  expect(
    readChatUsage("gpt-5.4", new TextEncoder().encode("{oops")),
  ).toBeNull();
});

it("recognises the Chat Completions path only", () => {
  expect(isChatCompletionsPath("/v1/chat/completions")).toBe(true);
  expect(isChatCompletionsPath("/v1/images/generations")).toBe(false);
});
