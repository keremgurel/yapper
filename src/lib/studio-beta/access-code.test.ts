import { describe, expect, it } from "vitest";
import {
  generateAccessCode,
  hashAccessCode,
  normalizeAccessCode,
} from "./access-code";

describe("tester access codes", () => {
  it("generates three groups of four unambiguous characters", () => {
    for (let i = 0; i < 50; i += 1)
      expect(generateAccessCode()).toMatch(
        /^[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/,
      );
  });

  it("does not repeat", () => {
    const codes = new Set(Array.from({ length: 200 }, generateAccessCode));
    expect(codes.size).toBe(200);
  });

  it("forgives case, dashes and spaces when a code is typed", () => {
    expect(normalizeAccessCode(" k7qm 2hxp-9rtd ")).toBe("K7QM2HXP9RTD");
  });

  it("hashes the same code the same way however it was typed", async () => {
    expect(await hashAccessCode("A@b.co", "K7QM-2HXP-9RTD")).toBe(
      await hashAccessCode(" a@B.co ", "k7qm2hxp9rtd"),
    );
  });

  it("binds a code to the email it was issued for", async () => {
    expect(await hashAccessCode("a@b.co", "K7QM-2HXP-9RTD")).not.toBe(
      await hashAccessCode("c@d.co", "K7QM-2HXP-9RTD"),
    );
  });
});
