"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Only same-origin paths inside Studio, so `?next=` cannot bounce a tester to
 * another site or back onto this page in a loop. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/studio/")) return "/studio/home";
  return next;
}

type Mode = "tester" | "team";

/**
 * The door to Studio during the private beta. A tester enters the email they
 * applied with and the access code from their invitation. The team keeps its
 * shared password behind a quiet switch.
 */
export default function StudioAccessForm({
  next,
  revoked = false,
}: {
  next?: string;
  revoked?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("tester");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    revoked
      ? "Your beta access has ended. Reply to your invitation email if that looks wrong."
      : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const ready = mode === "tester" ? email && code : password;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/studio-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "tester" ? { email, code } : { password },
        ),
      });
      if (response.ok) {
        router.replace(safeNext(next));
        router.refresh();
        return;
      }
      if (response.status === 429) {
        setError("Too many attempts. Wait a few minutes and try again.");
      } else if (response.status === 401) {
        setError(
          mode === "tester"
            ? "That email and code don't match an approved invitation."
            : "That password is not right.",
        );
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
          <KeyRound className="text-foreground/70 h-4 w-4" />
        </div>

        <h1 className="text-foreground text-[22px] font-medium tracking-[-0.02em]">
          Studio is in private beta
        </h1>
        <p className="text-muted-foreground mt-2 max-w-[46ch] text-sm">
          {mode === "tester"
            ? "Enter the email you applied with and the access code from your invitation."
            : "Enter the team password."}
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "tester" ? (
            <>
              <label htmlFor="studio-email" className="sr-only">
                Email
              </label>
              <Input
                id="studio-email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
              />
              <label htmlFor="studio-code" className="sr-only">
                Access code
              </label>
              <Input
                id="studio-code"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Access code"
                className="font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "studio-access-error" : undefined}
              />
            </>
          ) : (
            <>
              <label htmlFor="studio-password" className="sr-only">
                Team password
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
                aria-describedby={error ? "studio-access-error" : undefined}
              />
            </>
          )}

          {error && (
            <p
              id="studio-access-error"
              role="alert"
              className="text-destructive text-[13px]"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!ready || submitting}
          >
            {submitting ? "Checking…" : "Open Studio"}
          </Button>
        </form>

        <div className="text-muted-foreground mt-5 flex flex-wrap justify-between gap-2 text-[13px]">
          <Link
            href="/products/studio#waitlist"
            className="underline underline-offset-4"
          >
            Apply for the beta
          </Link>
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => {
              setMode(mode === "tester" ? "team" : "tester");
              setError(null);
            }}
          >
            {mode === "tester" ? "Use the team password" : "Use an access code"}
          </button>
        </div>
      </div>
    </div>
  );
}
