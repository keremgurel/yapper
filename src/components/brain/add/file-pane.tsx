"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  IMPORTABLE_EXTENSIONS,
  MAX_FILE_BYTES,
} from "@/lib/brain/ingest-client";

/**
 * A file, read where it sits.
 *
 * There is no upload here and no storage behind it. The browser reads the text
 * and the parse happens locally, which is why a large export is instant and why
 * the only thing that ever leaves the machine is the section the creator
 * decides to save.
 */
export default function FilePane({ onFile }: { onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [name, setName] = useState<string | null>(null);

  const take = (file: File | undefined) => {
    if (!file) return;
    setName(file.name);
    onFile(file);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        take(event.dataTransfer.files[0]);
      }}
      className={`flex flex-col items-center rounded-xl px-6 py-10 text-center transition-colors ${
        over ? "bg-muted" : "bg-muted/50"
      }`}
    >
      <span className="bg-background text-muted-foreground mb-3 grid h-10 w-10 place-items-center rounded-full">
        <Upload aria-hidden className="h-5 w-5" />
      </span>
      <p className="text-foreground text-sm font-semibold">
        {name ?? "Drop a file, or choose one"}
      </p>
      <p className="text-muted-foreground mt-1 max-w-[36ch] text-[13px]">
        {IMPORTABLE_EXTENSIONS.join(", ")}, up to{" "}
        {Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => input.current?.click()}
      >
        Choose a file
      </Button>
      <input
        ref={input}
        type="file"
        accept={IMPORTABLE_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(event) => take(event.target.files?.[0])}
      />
    </div>
  );
}
