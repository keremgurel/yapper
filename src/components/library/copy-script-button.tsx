"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? (
        <>
          <Check className="h-4 w-4 text-emerald-500" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          Copy script
        </>
      )}
    </Button>
  );
}
