"use client";

import {
  useCallback,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { Upload } from "lucide-react";

/**
 * Drop a video anywhere on the Poster to add it.
 *
 * The old path was a hidden file input behind a header button, which is the
 * slowest possible way to get a finished video into the tool. Dragging is how
 * people actually move a file they just exported, so the whole workspace is
 * the target and the overlay only appears once something is genuinely being
 * dragged over it.
 */
export default function VideoDropzone({
  onFiles,
  children,
}: {
  onFiles: (files: File[]) => void;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);

  // Drag events fire for every child element, so a plain boolean flickers as
  // the pointer crosses them. Counting enter and leave keeps it stable, and the
  // count itself never needs to render.
  const depth = useRef(0);

  const onDragEnter = useCallback((event: DragEvent) => {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    depth.current += 1;
    setOver(true);
  }, []);

  const onDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  }, []);

  const onDragOver = useCallback((event: DragEvent) => {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      depth.current = 0;
      setOver(false);
      const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
        file.type.startsWith("video/"),
      );
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  return (
    <div
      className="relative"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}

      {over && (
        <div
          aria-hidden
          className="bg-background/85 pointer-events-none absolute inset-0 z-50 grid place-items-center rounded-2xl border-2 border-dashed border-[color:var(--sg-accent)] backdrop-blur-sm"
        >
          <div className="text-center">
            <Upload className="mx-auto h-8 w-8 text-[color:var(--sg-accent)]" />
            <p className="text-foreground mt-3 text-sm font-semibold">
              Drop to add it here
            </p>
            <p className="text-muted-foreground mt-1 text-[13px]">
              It uploads and opens ready to cross-post
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
