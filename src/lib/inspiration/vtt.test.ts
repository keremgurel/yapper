import { describe, expect, it } from "vitest";
import { vttToText } from "./vtt";

describe("vttToText", () => {
  it("keeps the words and drops the rest", () => {
    const body = `WEBVTT\n\n1\n00:00:00.020 --> 00:00:04.780\nIf I found out today,\n\n2\n00:00:04.781 --> 00:00:07.541\nhere is the <b>plan</b>\n\n00:00:07.542 --> 00:00:09.000\nhere is the plan\n`;
    expect(vttToText(body)).toBe("If I found out today, here is the plan");
  });
  it("is empty for a file with no cues", () => {
    expect(vttToText("WEBVTT\nKind: captions\n")).toBe("");
  });
});
