import { describe, expect, it } from "vitest";
import { expireOpenConfirmations, type ChirpyMessage } from "./chirpy-message";

function asked(id: number, state: "open" | "confirmed"): ChirpyMessage {
  return {
    id,
    author: "chirpy",
    text: "",
    confirm: {
      executionID: `e${id}`,
      question: "Cancel “Gym myths” on TikTok? It won’t go out.",
      confirmLabel: "Cancel it",
      cancelLabel: "Keep it",
      typedHint: "Reply yes to cancel it, or no to keep it.",
      state,
    },
  };
}

describe("expireOpenConfirmations", () => {
  it("stops every unanswered question from waiting for a typed yes", () => {
    const thread = [
      asked(1, "confirmed"),
      asked(2, "open"),
      { id: 3, author: "you" as const, text: "what else is on Friday?" },
    ];
    const next = expireOpenConfirmations(thread);
    expect(next.map((message) => message.confirm?.state)).toEqual([
      "confirmed",
      "expired",
      undefined,
    ]);
    expect(next.some((message) => message.confirm?.state === "open")).toBe(
      false,
    );
  });

  it("leaves a thread with nothing waiting as it was", () => {
    const thread = [asked(1, "confirmed")];
    expect(expireOpenConfirmations(thread)).toBe(thread);
  });
});
