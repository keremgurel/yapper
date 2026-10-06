"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { AlertDialog } from "radix-ui";
import { Button } from "@/components/ui/button";

export default function RemoveUpload({
  id,
  title,
  onRemoved,
}: {
  id: string;
  title: string;
  onRemoved: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/publish/uploads/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(
          body.message ?? "Couldn’t remove this upload. Try again.",
        );
      }
      onRemoved(id);
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t remove this upload. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label={`Remove ${title}`}
        className="bg-background text-destructive absolute top-2 right-2 z-10"
        onClick={() => setOpen(true)}
      >
        <X aria-hidden className="size-4" />
      </Button>
      <AlertDialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <AlertDialog.Content className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6 shadow-lg">
            <AlertDialog.Title className="text-lg font-semibold">
              Remove this upload?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-muted-foreground mt-2 text-sm">
              Your original file and published posts stay untouched.
            </AlertDialog.Description>
            {error && (
              <p role="alert" className="text-destructive mt-3 text-sm">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="outline" disabled={busy}>
                  Cancel
                </Button>
              </AlertDialog.Cancel>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => void remove()}
              >
                {busy ? "Removing…" : "Remove upload"}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
