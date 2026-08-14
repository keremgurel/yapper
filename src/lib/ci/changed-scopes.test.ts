import { describe, expect, it } from "vitest";
import { changedScopes } from "./changed-scopes.mjs";

describe("changedScopes", () => {
  it("does not spend native or PostgreSQL minutes on a browser-only change", () => {
    expect(
      changedScopes(["src/lib/voice/voice-capture-controller.ts"]),
    ).toEqual({
      web: true,
      native: false,
      postgres: false,
    });
  });

  it("runs only native checks for native app changes", () => {
    expect(
      changedScopes(["native-macos/Sources/YapperNative/EditorSession.swift"]),
    ).toEqual({ web: false, native: true, postgres: false });
  });

  it("includes PostgreSQL when an API or database contract changes", () => {
    expect(changedScopes(["src/app/api/publish/route.ts"])).toEqual({
      web: true,
      native: false,
      postgres: true,
    });
    expect(changedScopes(["drizzle/0016_example.sql"])).toEqual({
      web: true,
      native: false,
      postgres: true,
    });
  });

  it("runs every gate when CI classification itself changes", () => {
    expect(changedScopes([".github/workflows/ci.yml"])).toEqual({
      web: true,
      native: true,
      postgres: true,
    });
  });

  it("skips expensive jobs for documentation-only changes", () => {
    expect(changedScopes(["README.md", "docs/release.md"])).toEqual({
      web: false,
      native: false,
      postgres: false,
    });
  });
});
