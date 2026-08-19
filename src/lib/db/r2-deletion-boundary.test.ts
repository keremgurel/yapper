import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.[cm]?[jt]sx?$/.test(name)
        ? [path]
        : [];
  });
}

describe("R2 deletion boundary", () => {
  // The rule is about media. A recording is referenced by submissions and
  // history, so deleting one has to be durable, fenced and idempotent, which is
  // what the leased worker provides. Scratch audio written for a single
  // transcription request is referenced by nothing and has to be gone at once,
  // so it is deleted through `discardTranscriptionAudio`, which lives in the
  // same allowed file and refuses any key outside the scratch prefix.
  it("keeps physical object deletion inside the leased lifecycle worker", () => {
    const sourceRoot = join(process.cwd(), "src");
    const allowed = new Set([
      "lib/r2.ts",
      "lib/db/r2-lifecycle.ts",
      "lib/db/r2-deletion-boundary.test.ts",
      "lib/db/r2-lifecycle-protocol.test.ts",
      // These tests assert that feedback never deletes client-owned media.
      "app/api/feedback/route.test.ts",
    ]);
    const offenders = sourceFiles(sourceRoot)
      .map((file) => ({
        file: relative(sourceRoot, file),
        contents: readFileSync(file, "utf8"),
      }))
      .filter(
        ({ file, contents }) =>
          !allowed.has(file) && /\bdeleteObject\b/.test(contents),
      )
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });
});
