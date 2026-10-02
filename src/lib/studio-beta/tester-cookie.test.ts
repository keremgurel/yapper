import { describe, expect, it } from "vitest";
import { mintTesterCookie, readTesterCookie } from "./tester-cookie";

const ID = "3f0e9c1a-7b2d-4e5f-8a6b-1c2d3e4f5a6b";
const now = new Date("2026-10-03T00:00:00Z");
const later = new Date("2026-11-02T00:00:00Z");

describe("the tester access cookie", () => {
  it("round-trips the application it was issued for", async () => {
    const cookie = await mintTesterCookie("secret", ID, later);
    expect(await readTesterCookie("secret", cookie, now)).toBe(ID);
  });

  it("is refused once it has expired", async () => {
    const cookie = await mintTesterCookie("secret", ID, later);
    expect(
      await readTesterCookie(
        "secret",
        cookie,
        new Date("2026-11-02T00:00:01Z"),
      ),
    ).toBeNull();
  });

  it("is refused when the secret has been rotated", async () => {
    const cookie = await mintTesterCookie("secret", ID, later);
    expect(await readTesterCookie("rotated", cookie, now)).toBeNull();
  });

  it("is refused when any part was altered", async () => {
    const cookie = await mintTesterCookie("secret", ID, later);
    const [prefix, id, expires, signature] = cookie.split(".");
    const other = "aaaaaaaa-7b2d-4e5f-8a6b-1c2d3e4f5a6b";
    for (const forged of [
      [prefix, other, expires, signature].join("."),
      [prefix, id, String(Number(expires) + 999), signature].join("."),
      [
        prefix,
        id,
        expires,
        signature.replace(/.$/, (c) => (c === "0" ? "1" : "0")),
      ].join("."),
      [prefix, id, expires, signature, "extra"].join("."),
      `t2.${id}.${expires}.${signature}`,
      "",
      undefined,
    ])
      expect(await readTesterCookie("secret", forged, now)).toBeNull();
  });
});
