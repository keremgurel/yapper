import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  spoolBoundedTemporaryFile,
  TemporaryFileInvalidError,
  TemporaryFileTooLargeError,
} from "./bounded-temp-file";

const roots: string[] = [];

async function testRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "yapper-spool-test-"));
  roots.push(root);
  return root;
}

async function* chunks(...values: number[][]): AsyncIterable<Uint8Array> {
  for (const value of values) yield new Uint8Array(value);
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("spoolBoundedTemporaryFile", () => {
  it("writes the exact boundary without combining chunks in memory", async () => {
    const root = await testRoot();
    const file = await spoolBoundedTemporaryFile(chunks([1, 2], [3, 4, 5]), {
      maxBytes: 5,
      declaredBytes: 5,
      temporaryRoot: root,
    });

    await expect(readFile(file.filePath)).resolves.toEqual(
      Buffer.from([1, 2, 3, 4, 5]),
    );
    await file.cleanup();
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it("rejects declared overflow before consuming the source", async () => {
    const root = await testRoot();
    let pulled = false;
    async function* source() {
      pulled = true;
      yield new Uint8Array([1]);
    }

    await expect(
      spoolBoundedTemporaryFile(source(), {
        maxBytes: 4,
        declaredBytes: 5,
        temporaryRoot: root,
      }),
    ).rejects.toBeInstanceOf(TemporaryFileTooLargeError);
    expect(pulled).toBe(false);
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it("removes a partial file after streamed overflow", async () => {
    const root = await testRoot();
    await expect(
      spoolBoundedTemporaryFile(chunks([1, 2, 3], [4, 5, 6]), {
        maxBytes: 5,
        temporaryRoot: root,
      }),
    ).rejects.toBeInstanceOf(TemporaryFileTooLargeError);
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it("removes a partial file when cancellation arrives between chunks", async () => {
    const root = await testRoot();
    const controller = new AbortController();
    async function* source() {
      yield new Uint8Array([1, 2]);
      controller.abort(new DOMException("aborted", "AbortError"));
      yield new Uint8Array([3, 4]);
    }

    await expect(
      spoolBoundedTemporaryFile(source(), {
        maxBytes: 5,
        signal: controller.signal,
        temporaryRoot: root,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it("settles and cleans up when cancellation races a stalled source", async () => {
    const root = await testRoot();
    const controller = new AbortController();
    let entered = false;
    const source: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            entered = true;
            return new Promise<IteratorResult<Uint8Array>>(() => undefined);
          },
          return() {
            return new Promise<IteratorResult<Uint8Array>>(() => undefined);
          },
        };
      },
    };

    const result = spoolBoundedTemporaryFile(source, {
      maxBytes: 5,
      signal: controller.signal,
      temporaryRoot: root,
    });
    await vi.waitFor(() => expect(entered).toBe(true));
    controller.abort(new DOMException("aborted", "AbortError"));

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it("rejects a lying declared length and removes the artifact", async () => {
    const root = await testRoot();
    await expect(
      spoolBoundedTemporaryFile(chunks([1, 2]), {
        maxBytes: 5,
        declaredBytes: 3,
        temporaryRoot: root,
      }),
    ).rejects.toBeInstanceOf(TemporaryFileInvalidError);
    await expect(readdir(root)).resolves.toEqual([]);
  });
});
