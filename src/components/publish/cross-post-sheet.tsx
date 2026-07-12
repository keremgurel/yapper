"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCrossPost } from "@/hooks/use-cross-post";

export interface CrossPostTarget {
  id: string;
  title: string;
  submissionId: string;
}

/**
 * Compose a YouTube post for one master video and send it. Mounted per target
 * (keyed by the parent), so its fields seed from the item without a
 * set-state-in-effect; unmounts when closed.
 */
export default function CrossPostSheet({
  item,
  onClose,
}: {
  item: CrossPostTarget;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState("");
  const { state, error, result, post } = useCrossPost();

  const busy = state === "posting";
  const close = (o: boolean) => {
    setOpen(o);
    if (!o) onClose();
  };
  const submit = () => {
    if (!title.trim() || busy) return;
    void post({
      submissionId: item.submissionId,
      title: title.trim(),
      description: description.trim() || undefined,
      contentItemId: item.id,
    });
  };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Post to YouTube</SheetTitle>
          <SheetDescription>
            Uploads to your channel. It stays private until your YouTube API
            audit clears.
          </SheetDescription>
        </SheetHeader>

        {state === "done" && result ? (
          <div className="flex flex-col gap-3 p-4">
            <p className="text-sm font-bold text-[color:var(--sg-green-500)]">
              Posted to YouTube (private).
            </p>
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="text-foreground flex items-center gap-1.5 text-sm font-bold hover:text-[color:var(--sg-accent)]"
            >
              <ExternalLink className="h-4 w-4" />
              View on YouTube
            </a>
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-foreground/70 text-xs font-bold">
                Title
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                disabled={busy}
                className="border-border bg-card rounded-lg border px-3 py-2 text-sm outline-none focus:border-[color:var(--sg-accent)]"
              />
              <span className="text-muted-foreground text-[11px]">
                {title.length}/100
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-foreground/70 text-xs font-bold">
                Description
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                rows={5}
                disabled={busy}
                placeholder="Optional"
                className="border-border bg-card placeholder:text-foreground/30 resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:border-[color:var(--sg-accent)]"
              />
            </label>

            {error && (
              <p className="text-sm font-bold text-[color:var(--sg-pink-500)]">
                {error === "not_connected"
                  ? "Connect YouTube first (Connections)."
                  : "Couldn't post. Try again."}
              </p>
            )}

            <Button
              type="button"
              onClick={submit}
              disabled={!title.trim() || busy}
              style={{ background: "var(--sg-accent-gradient)" }}
              className="text-white"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {busy ? "Posting…" : "Post to YouTube"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
