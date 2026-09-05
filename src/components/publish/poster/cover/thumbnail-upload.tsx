"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Keep the original image quality; the publish renderer handles the 9:16 crop. */
async function readThumbnail(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }
  if (!file.size || file.size > 20 * 1024 * 1024) {
    throw new Error("Choose an image under 20 MB.");
  }
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reader.onabort = () =>
      reject(new Error("The image could not be opened. Try another file."));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = data;
  await image.decode().catch(() => {
    throw new Error("The image could not be opened. Try another file.");
  });
  return data;
}

export default function ThumbnailUpload({
  onImage,
  replacing,
  disabled,
}: {
  onImage: (image: string) => void;
  replacing: boolean;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );

  const pick = async (file: File) => {
    const id = ++request.current;
    setBusy(true);
    setError("");
    try {
      const image = await readThumbnail(file);
      if (id === request.current) onImage(image);
    } catch (cause) {
      if (id === request.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The image could not be opened.",
        );
    } finally {
      if (id === request.current) setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-3 w-full max-w-[270px] space-y-2">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Choose thumbnail image"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void pick(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {busy
          ? "Opening image…"
          : replacing
            ? "Replace thumbnail"
            : "Upload thumbnail"}
      </Button>
      <p className="text-muted-foreground text-center text-[10px]">
        JPG, PNG, WebP · Up to 20 MB · 9:16 works best
      </p>
      {error ? (
        <p role="alert" className="text-xs text-amber-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}
