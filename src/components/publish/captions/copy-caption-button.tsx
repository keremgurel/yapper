"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { renderCaption, type PlatformCaption } from "@/lib/publish/caption";

/**
 * Copies exactly what would be posted. `renderCaption` is the single source of
 * that text, so the clipboard and the upload never disagree about where the
 * hashtags go.
 */
export default function CopyCaptionButton({
  caption,
  label,
  variant = "ghost",
}: {
  caption: PlatformCaption;
  label: string;
  variant?: "ghost" | "outline";
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(renderCaption(caption));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (insecure origin, denied permission). The text is
      // on screen and selectable, so there is nothing useful to say here.
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={() => void copy()}
    >
      {copied ? (
        <>
          <Check aria-hidden className="text-[color:var(--sg-green-500)]" />
          Copied
        </>
      ) : (
        <>
          <Copy aria-hidden />
          {label}
        </>
      )}
    </Button>
  );
}
