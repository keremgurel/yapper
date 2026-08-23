"use client";

import Link from "next/link";
import type { BrainUsed } from "@/lib/brain/context/types";

/**
 * What the brain gave this piece of writing.
 *
 * One quiet line, but it closes the loop the Brain page opens. A creator who
 * imported a content gap list and installed a script skill has no way to tell
 * whether either did anything, and "the AI seems better now" is not a feeling
 * anyone should have to run their content on. Naming what was read makes the
 * brain an instrument rather than an atmosphere, and makes a bad result
 * diagnosable: wrong section read, or right section read and ignored.
 *
 * Nothing renders when nothing was read, deliberately. An empty "Read:" would
 * be noise on every generation by a creator who has not filled theirs in.
 */
export default function ReadLine({ used }: { used?: BrainUsed | null }) {
  const names = [...(used?.skills ?? []), ...(used?.context ?? [])];
  if (!names.length) return null;

  return (
    <p className="text-muted-foreground text-xs">
      Read from your{" "}
      <Link
        href="/studio/brain"
        className="text-muted-foreground hover:text-foreground underline underline-offset-2"
      >
        brain
      </Link>
      : {names.join(", ")}
    </p>
  );
}
