"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type Phase = "idle" | "minting" | "ready" | "expired" | "error";

/**
 * Opens this item's teleprompter on the creator's phone.
 *
 * The QR encodes a one-use sign-in link, which is a bearer credential: whoever
 * opens it is signed in as the creator until it is redeemed or expires. That
 * shapes the whole component. The code is minted only on demand rather than
 * rendered with the page, it is never persisted, and it visibly expires on a
 * timer so a code left on a shared screen stops being a way in.
 */
export default function SendToPhone({ itemId }: { itemId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [url, setUrl] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => stopTimer, [stopTimer]);

  const mint = async () => {
    setPhase("minting");
    try {
      const res = await fetch("/api/handoff/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: `/studio/recorder?item=${itemId}` }),
      });
      if (!res.ok) throw new Error("mint_failed");
      const data = (await res.json()) as {
        url: string;
        expiresInSeconds: number;
      };
      setUrl(data.url);
      setSecondsLeft(data.expiresInSeconds);
      setPhase("ready");

      stopTimer();
      timer.current = setInterval(() => {
        setSecondsLeft((left) => {
          if (left > 1) return left - 1;
          stopTimer();
          // The URL is dropped, not just hidden: an expired code should not be
          // recoverable from the DOM.
          setUrl("");
          setPhase("expired");
          return 0;
        });
      }, 1000);
    } catch {
      setPhase("error");
    }
  };

  if (phase === "ready" && url) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-lg bg-white p-3">
          {/* Always on white regardless of theme: a QR needs the light module
              to be the light one, and inverting it stops most scanners. */}
          <QRCodeSVG value={url} size={148} marginSize={0} />
        </div>
        <p className="text-muted-foreground text-center text-xs">
          Scan with your phone camera. Expires in {secondsLeft}s.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void mint()}
        disabled={phase === "minting"}
        className="w-full"
      >
        {phase === "minting" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Smartphone className="h-4 w-4" />
        )}
        {phase === "expired" ? "Show a new code" : "Send to phone"}
      </Button>
      {phase === "error" && (
        <p className="text-destructive text-xs" role="alert">
          Couldn&apos;t create a code. Try again.
        </p>
      )}
      {phase === "expired" && (
        <p className="text-muted-foreground text-xs">That code expired.</p>
      )}
    </div>
  );
}
