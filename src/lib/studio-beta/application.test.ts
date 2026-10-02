import { describe, expect, it } from "vitest";
import { parseBetaApplication } from "./application";

describe("reading a beta application", () => {
  it("cleans a complete application", () => {
    expect(
      parseBetaApplication({
        email: "  Maya@Example.com ",
        name: " Maya ",
        link: " https://youtube.com/@maya ",
        useCase: " Weekly explainers ",
      }),
    ).toEqual({
      email: "maya@example.com",
      name: "Maya",
      link: "https://youtube.com/@maya",
      useCase: "Weekly explainers",
    });
  });

  it("treats the optional answers as empty when blank", () => {
    expect(
      parseBetaApplication({ email: "a@b.co", name: "A", link: "  " }),
    ).toEqual({ email: "a@b.co", name: "A", link: null, useCase: null });
  });

  it("asks for a valid email and a name", () => {
    expect(parseBetaApplication({ email: "nope", name: "A" })).toEqual({
      error: "Please enter a valid email address.",
    });
    expect(parseBetaApplication({ email: "a@b.co", name: " " })).toEqual({
      error: "Please enter your name.",
    });
    expect(parseBetaApplication(null)).toHaveProperty("error");
  });

  it("cuts answers that run too long", () => {
    const parsed = parseBetaApplication({
      email: "a@b.co",
      name: "n".repeat(500),
      useCase: "u".repeat(5000),
    });
    expect(parsed).toMatchObject({ name: "n".repeat(80) });
    expect("useCase" in parsed && parsed.useCase).toHaveLength(1000);
  });
});
