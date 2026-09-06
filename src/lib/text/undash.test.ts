import { describe, expect, it } from "vitest";
import { undash } from "@/lib/text/undash";

describe("undash", () => {
  it("turns a dash between clauses into a comma", () => {
    expect(undash("Open strong — then deliver.")).toBe(
      "Open strong, then deliver.",
    );
    expect(undash("Your file is safe—try again.")).toBe(
      "Your file is safe, try again.",
    );
  });
  it("turns a dash between numbers into a range", () => {
    expect(undash("The 3–5 themes")).toBe("The 3 to 5 themes");
  });
  it("does not leave a dangling comma at a boundary", () => {
    expect(undash("— skip anything")).toBe("skip anything");
    expect(undash("Count up (1,200 — 2,850)")).toBe(
      "Count up (1,200 to 2,850)",
    );
    expect(undash("wait — .")).toBe("wait.");
  });
  it("leaves text without dashes alone", () => {
    expect(undash("plain, text.")).toBe("plain, text.");
  });
});
