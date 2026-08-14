import { createReadStream, type ReadStream } from "node:fs";
import { Readable } from "node:stream";

export interface OpenFileBody {
  body: BodyInit;
  close(): void;
}

/** A lazy request body over exactly one file range. Canceling the web stream
 * destroys the underlying file descriptor; `close` covers fetch failures that
 * happen before the body is consumed. */
export function openFileBody(
  filePath: string,
  range: { start?: number; end?: number } = {},
): OpenFileBody {
  const stream: ReadStream = createReadStream(filePath, range);
  return {
    body: Readable.toWeb(stream) as unknown as BodyInit,
    close: () => stream.destroy(),
  };
}

export type StreamingRequestInit = RequestInit & { duplex: "half" };
