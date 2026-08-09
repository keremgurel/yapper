"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { ChirpyMark } from "@/components/brand/chirpy-mark";
import { safeHandoffTarget } from "@/lib/handoff/target";

/**
 * Phone half of the QR handoff: trade the one-use ticket for a session, then
 * continue to whatever the creator scanned the code for.
 *
 * The destination is re-validated here even though the API already checked it.
 * By this point the URL has passed through a camera, a QR decoder and the
 * address bar, so what arrives on this page is untrusted whatever was minted.
 */
function HandoffContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useSignIn();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  const ticket = params.get("ticket") ?? "";
  const to = safeHandoffTarget(params.get("to"));

  useEffect(() => {
    if (!signIn || !ticket || started.current) return;
    // Guarded with a ref rather than state: the ticket is single-use, so a
    // second attempt from a re-render would consume nothing and fail.
    started.current = true;

    void (async () => {
      const attempt = await signIn.ticket({ ticket });
      if (attempt.error) {
        setFailed(true);
        return;
      }
      // `finalize` is what activates the session; `ticket` alone only verifies.
      const done = await signIn.finalize();
      if (done.error) {
        setFailed(true);
        return;
      }
      router.replace(to);
    })();
  }, [signIn, ticket, to, router]);

  const problem = !ticket
    ? "This link is incomplete."
    : failed
      ? "This link has expired or was already used."
      : null;

  return (
    <main className="bg-background flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <ChirpyMark size={38} />
        {problem ? (
          <div>
            <p className="text-foreground font-bold">{problem}</p>
            <p className="text-muted-foreground mt-2 text-sm">
              Open Yapper Studio on your computer and scan a fresh code.
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing you in on this device…
          </p>
        )}
      </div>
    </main>
  );
}

export default function HandoffPage() {
  return (
    <Suspense fallback={null}>
      <HandoffContent />
    </Suspense>
  );
}
