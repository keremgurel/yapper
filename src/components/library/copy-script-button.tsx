"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { ideaToScript, type ScriptSource } from "@/lib/inspiration/idea-format";

export default function CopyScriptButton({ idea }: { idea: ScriptSource }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ideaToScript(idea));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable; no-op
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="border-border text-foreground/80 hover:bg-muted hover:text-foreground inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Copy script
        </>
      )}
    </button>
  );
}
