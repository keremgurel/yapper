"use client";

import { useRef, useState } from "react";
import { ExternalLink, Loader2, LockKeyhole, Upload } from "lucide-react";

function Step({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="border-border bg-card text-foreground mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold">
        {number}
      </span>
      <p className="text-foreground/75 text-sm leading-6">{children}</p>
    </li>
  );
}

/**
 * The pre-upload half of the import sheet: how to get the export out of
 * Instagram, then the drop target that reads it. Render-only; the sheet owns
 * the parsed entries.
 */
export default function InstagramImportSteps({
  reading,
  error,
  onFile,
}: {
  reading: boolean;
  error: string | null;
  onFile: (file?: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div>
      <ol className="space-y-3">
        <Step number={1}>
          In Instagram, open <strong>Accounts Center</strong>, then
          <strong> Your information and permissions</strong>.
        </Step>
        <Step number={2}>
          Choose <strong>Export your information</strong>, select your Instagram
          profile, then export <strong>Saved</strong> for
          <strong> All time</strong> in <strong>JSON</strong> format.
        </Step>
        <Step number={3}>
          When Instagram sends the download, drop the untouched ZIP here.
        </Step>
      </ol>

      <a
        href="https://www.facebook.com/help/181231772500920"
        target="_blank"
        rel="noreferrer"
        className="text-muted-foreground hover:text-foreground mt-4 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-4"
      >
        Open Meta&apos;s export instructions
        <ExternalLink className="h-3 w-3" />
      </a>

      <input
        ref={inputRef}
        type="file"
        accept=".zip,.json,.html,.htm,application/zip,application/json,text/html"
        className="sr-only"
        onChange={(event) => {
          // Clear the value so re-picking the same file after an error still
          // fires change.
          const file = event.target.files?.[0];
          event.target.value = "";
          onFile(file);
        }}
      />
      <button
        type="button"
        disabled={reading}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          onFile(event.dataTransfer.files[0]);
        }}
        className={`bg-muted mt-6 flex w-full flex-col items-center rounded-2xl px-6 py-10 text-center transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
          dragging
            ? "ring-2 ring-[color:var(--sg-accent)]"
            : "hover:bg-muted/80"
        }`}
      >
        {reading ? (
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        ) : (
          <Upload className="text-muted-foreground h-6 w-6" />
        )}
        <span className="text-foreground mt-3 text-sm font-semibold">
          {reading ? "Reading your archive…" : "Choose Instagram export"}
        </span>
        <span className="text-muted-foreground mt-1 text-xs">
          ZIP, JSON, or HTML · up to 100 MB
        </span>
      </button>

      {error && (
        <p role="alert" className="text-destructive mt-3 text-sm leading-5">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-start gap-2.5">
        <LockKeyhole className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p className="text-muted-foreground text-xs leading-5">
          The archive is read on this device. Yapper imports only the Instagram
          links you select, not the ZIP or your account credentials.
        </p>
      </div>
    </div>
  );
}
