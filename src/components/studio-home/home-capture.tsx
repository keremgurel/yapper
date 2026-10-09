"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import IdeaCapture from "@/components/ideas/idea-capture";

/**
 * The first thing on Home: the same composer as the Idea Bank, focused on
 * arrival, so a thought goes from head to saved in one keystroke. A capture
 * says where it went and keeps the creator here to add the next one.
 */
export default function HomeCapture({
  onCapture,
}: {
  onCapture: (text: string) => Promise<void>;
}) {
  const [saved, setSaved] = useState(0);

  return (
    <div>
      <IdeaCapture
        onCapture={async (text) => {
          await onCapture(text);
          setSaved((count) => count + 1);
        }}
      />
      <p
        aria-live="polite"
        className="text-muted-foreground mt-2 flex min-h-5 items-center gap-1.5 px-1 text-xs"
      >
        {saved > 0 ? (
          <>
            <CheckCircle2
              aria-hidden
              className="size-3.5 text-[color:var(--sg-green-500)]"
            />
            Saved to Ideas. Yapper is shaping it into a script below.
            <Link
              href="/studio/ideas"
              className="text-foreground font-semibold underline-offset-2 hover:underline"
            >
              Open Ideas
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
