"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import AiCommandBar from "@/components/studio/ai-command-bar";
import { useStudio } from "@/components/studio/studio-context";

/**
 * The little character in the corner. Press it and it grows into the command
 * bar it was standing in for; the bar shrinks back into it on the way out.
 *
 * Both live in the same bottom-right corner and transform from it, so one reads
 * as the other opening rather than as two things swapping places.
 */
export default function AiAssistant() {
  const { words, mediaAssets } = useStudio();
  const [open, setOpen] = useState(false);

  return (
    // A zero-sized anchor: both children hang off its bottom-right corner, so
    // neither can push the other around as they grow and shrink.
    <div className="pointer-events-none fixed right-5 bottom-5 z-50 h-0 w-0">
      <div
        inert={!open}
        className={`absolute right-0 bottom-0 origin-bottom-right transition-all duration-200 ease-out ${
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-90 opacity-0"
        }`}
      >
        <AiCommandBar
          assets={mediaAssets}
          hasTranscript={words.length > 0}
          open={open}
          onClose={() => setOpen(false)}
        />
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the AI editor"
        title="Ask the AI editor"
        className={`absolute right-0 bottom-0 grid h-12 w-12 origin-bottom-right place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-xl transition-all duration-200 ease-out hover:scale-105 ${
          open
            ? "pointer-events-none scale-50 opacity-0"
            : "pointer-events-auto scale-100 opacity-100"
        }`}
      >
        <Sparkles className="h-5 w-5" />
      </button>
    </div>
  );
}
