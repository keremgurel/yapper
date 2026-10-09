import { describe, expect, it } from "vitest";
import { greeting } from "@/components/studio-home/greeting";

describe("greeting", () => {
  it("follows the local hour", () => {
    expect(greeting(8)).toBe("Good morning");
    expect(greeting(13)).toBe("Good afternoon");
    expect(greeting(19)).toBe("Good evening");
    expect(greeting(1)).toBe("Working late");
    expect(greeting(23)).toBe("Working late");
  });

  it("adds the first name when there is one", () => {
    expect(greeting(8, "Kerem")).toBe("Good morning, Kerem");
    expect(greeting(8, "  ")).toBe("Good morning");
    expect(greeting(8, null)).toBe("Good morning");
  });
});
