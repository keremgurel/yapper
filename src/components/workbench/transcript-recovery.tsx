"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useTranscriptRecovery,
  type RecoveryError,
} from "@/hooks/use-transcript-recovery";
import type { ContentPatch } from "@/lib/content/client";

const MESSAGE: Record<RecoveryError, string> = {
  resolve_failed: "That did not work. Try attaching the file instead.",
  still_no_media: "Still cannot reach the video. Attach it or paste the words.",
  transcribe_failed: "Could not transcribe that file. Try another format.",
  empty: "Nothing to save.",
};

/**
 * The always-works escape hatch for a reference with no transcript.
 *
 * Shown instead of pretending the reference is fine. Retry first, because the
 * usual cause is a depleted scraper that recovers on its own; then the two
 * routes that do not depend on reaching the platform at all.
 */
export default function TranscriptRecovery({
  sourceUrl,
  update,
}: {
  sourceUrl: string | null;
  update: (patch: ContentPatch) => void;
}) {
  const { busy, error, retry, attach, paste } = useTranscriptRecovery(
    sourceUrl,
    update,
  );
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border-border/60 mt-2 border-t pt-2">
      <p className="text-muted-foreground text-xs">
        We could not hear this one. Anything built on it will be guessing until
        it has the words.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {sourceUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void retry()}
            disabled={busy !== null}
            className="h-7 text-xs"
          >
            {busy === "retry" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCw className="h-3.5 w-3.5" />
            )}
            Retry
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="h-7 text-xs"
        >
          {busy === "attach" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          Attach the video · 1 credit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPasting((v) => !v)}
          disabled={busy !== null}
          className="text-muted-foreground h-7 text-xs"
        >
          {pasting ? "Cancel" : "Paste the transcript"}
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        aria-label="Attach the reference video or audio"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so picking the same file twice still fires a change event.
          e.target.value = "";
          if (file) void attach(file);
        }}
      />

      {pasting && (
        <div className="mt-2 space-y-2">
          <Textarea
            value={text}
            rows={4}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste what is said in the video"
            aria-label="Reference transcript"
          />
          <Button
            type="button"
            size="sm"
            disabled={busy !== null || !text.trim()}
            onClick={() =>
              void paste(text).then((saved) => {
                // Only cleared once it is actually stored; otherwise a failed
                // save would throw away words the creator typed by hand.
                if (!saved) return;
                setText("");
                setPasting(false);
              })
            }
          >
            Save transcript
          </Button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs font-semibold text-amber-500" role="alert">
          {MESSAGE[error]}
        </p>
      )}
    </div>
  );
}
