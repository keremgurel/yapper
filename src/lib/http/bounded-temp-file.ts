import { mkdtemp, open, rm, type FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class TemporaryFileTooLargeError extends Error {
  constructor(readonly limitBytes: number) {
    super("temporary_file_too_large");
    this.name = "TemporaryFileTooLargeError";
  }
}

export class TemporaryFileInvalidError extends Error {
  constructor(message = "temporary_file_invalid") {
    super(message);
    this.name = "TemporaryFileInvalidError";
  }
}

export interface BoundedTemporaryFile {
  filePath: string;
  byteLength: number;
  cleanup(): Promise<void>;
}

async function writeChunk(file: FileHandle, chunk: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < chunk.byteLength) {
    const { bytesWritten } = await file.write(
      chunk,
      offset,
      chunk.byteLength - offset,
    );
    if (bytesWritten <= 0) throw new TemporaryFileInvalidError();
    offset += bytesWritten;
  }
}

/**
 * Materialize a bounded async byte stream on disk while retaining at most one
 * source chunk in application memory. The returned owner controls cleanup;
 * every failure path removes the partial file and its private directory.
 */
export async function spoolBoundedTemporaryFile(
  source: AsyncIterable<Uint8Array>,
  options: {
    maxBytes: number;
    declaredBytes?: number;
    signal?: AbortSignal;
    prefix?: string;
    fileName?: string;
    temporaryRoot?: string;
  },
): Promise<BoundedTemporaryFile> {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) {
    throw new TypeError("invalid_temporary_file_limit");
  }
  if (
    options.declaredBytes !== undefined &&
    (!Number.isSafeInteger(options.declaredBytes) || options.declaredBytes <= 0)
  ) {
    throw new TemporaryFileInvalidError("invalid_declared_size");
  }
  if (
    options.declaredBytes !== undefined &&
    options.declaredBytes > options.maxBytes
  ) {
    throw new TemporaryFileTooLargeError(options.maxBytes);
  }

  options.signal?.throwIfAborted();
  const iterator = source[Symbol.asyncIterator]();
  const directory = await mkdtemp(
    join(options.temporaryRoot ?? tmpdir(), options.prefix ?? "yapper-media-"),
  );
  const filePath = join(directory, options.fileName ?? "media.bin");
  let file: FileHandle | undefined;
  let total = 0;
  let finished = false;
  let rejectAbort: ((reason: unknown) => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const abort = () =>
    rejectAbort?.(
      options.signal?.reason ?? new DOMException("aborted", "AbortError"),
    );
  options.signal?.addEventListener("abort", abort, { once: true });

  try {
    file = await open(filePath, "wx");
    while (true) {
      options.signal?.throwIfAborted();
      const next = await Promise.race([iterator.next(), aborted]);
      if (next.done) {
        finished = true;
        break;
      }
      const chunk = next.value;
      if (!(chunk instanceof Uint8Array)) {
        throw new TemporaryFileInvalidError("invalid_stream_chunk");
      }
      if (chunk.byteLength > options.maxBytes - total) {
        throw new TemporaryFileTooLargeError(options.maxBytes);
      }
      await writeChunk(file, chunk);
      total += chunk.byteLength;
    }
    options.signal?.throwIfAborted();
    if (total <= 0 || (options.declaredBytes ?? total) !== total) {
      throw new TemporaryFileInvalidError("content_length_mismatch");
    }
    await file.close();
    file = undefined;
    return {
      filePath,
      byteLength: total,
      cleanup: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await file?.close().catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", abort);
    if (!finished && iterator.return) {
      try {
        void iterator.return().catch(() => undefined);
      } catch {
        // Source cancellation is best effort and cannot mask bounded cleanup.
      }
    }
  }
}
