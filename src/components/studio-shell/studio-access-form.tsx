"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Only same-origin paths inside Studio, so `?next=` cannot bounce a tester to
 * another site or back onto this page in a loop. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/studio/")) return "/studio/home";
  return next;
}

export default function StudioAccessForm({ next }: { next?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/studio-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        router.replace(safeNext(next));
        router.refresh();
        return;
      }
      if (response.status === 429) {
        setError("Too many attempts. Wait a few minutes and try again.");
      } else if (response.status === 401) {
        setError("That password is not right.");
      } else {
        setError("Could not check that right now. Try again.");
      }
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="marketing-container flex min-h-[70vh] items-center justify-center py-16">
      <div className="border-border bg-card w-full max-w-[420px] rounded-2xl border p-6">
        <div className="bg-muted mb-4 grid h-10 w-10 place-items-center rounded-full">
          <Lock className="text-foreground/70 h-4 w-4" />
        </div>

        <h1 className="font-display text-foreground text-[22px] font-bold tracking-[-0.01em]">
          Studio is not open yet
        </h1>
        <p className="text-muted-foreground mt-2 max-w-[46ch] text-sm">
          The practice tools and AI feedback are live for everyone. Studio is
          still being built, so it needs the team password for now.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <label htmlFor="studio-password" className="sr-only">
            Studio password
          </label>
          <Input
            id="studio-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Team password"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "studio-password-error" : undefined}
          />

          {error && (
            <p
              id="studio-password-error"
              role="alert"
              className="text-destructive text-[13px]"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!password || submitting}
          >
            {submitting ? "Checking…" : "Unlock Studio"}
          </Button>
        </form>
      </div>
    </div>
  );
}
