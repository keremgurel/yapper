import { describe, expect, it } from "vitest";
import { safeJsonLdStringify } from "@/lib/json-ld";

describe("safeJsonLdStringify", () => {
  it("escapes every < so a payload can't close the ld+json script tag", () => {
    const payload = { name: "</script><script>alert(1)</script>" };
    const out = safeJsonLdStringify(payload);
    // The only way out of a <script> raw-text element is a literal </script,
    // which needs a <; escaping it defuses the injection.
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(out).toContain("\\u003c/script>");
  });

  it("still round-trips back to the original value", () => {
    const value = { a: 1, b: ["x", "<y>"], c: { d: "</a>" } };
    expect(JSON.parse(safeJsonLdStringify(value))).toEqual(value);
  });
});
