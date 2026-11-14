import { afterEach, describe, expect, it, vi } from "vitest";
import { SURPLUS_KEY_ENV, surplusKey } from "./surplus-key";

afterEach(() => vi.unstubAllEnvs());

function clearScopedKeys() {
  for (const name of Object.values(SURPLUS_KEY_ENV)) vi.stubEnv(name, "");
}

describe("surplusKey", () => {
  it("uses the area's own key when it has one", () => {
    clearScopedKeys();
    vi.stubEnv("SURPLUS_API_KEY", "shared");
    vi.stubEnv("SURPLUS_API_KEY_EDITING", "editing-key");
    expect(surplusKey("editing")).toBe("editing-key");
  });

  it("falls back to the shared key for an area without one", () => {
    clearScopedKeys();
    vi.stubEnv("SURPLUS_API_KEY", "shared");
    vi.stubEnv("SURPLUS_API_KEY_EDITING", "editing-key");
    expect(surplusKey("overlays")).toBe("shared");
  });

  it("treats an empty area key as unset", () => {
    clearScopedKeys();
    vi.stubEnv("SURPLUS_API_KEY", "shared");
    expect(surplusKey("ideas")).toBe("shared");
  });

  it("reports no key when neither is set", () => {
    clearScopedKeys();
    vi.stubEnv("SURPLUS_API_KEY", "");
    expect(surplusKey("brain")).toBeUndefined();
  });

  it("gives every area a distinct variable", () => {
    const names = Object.values(SURPLUS_KEY_ENV);
    expect(new Set(names).size).toBe(names.length);
  });
});
