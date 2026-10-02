"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { storeRetryPrompt } from "@/lib/practice/retry-prompt";
import type { TrainingContext } from "@/lib/training-feedback/types";

/**
 * The one thing to change, and the way to try it immediately. Repeating the
 * same prompt with a single focus is what builds fluency, so this sits at the
 * top of the report and everything else supports it.
 */
export default function NextAttempt({
  focus,
  context,
}: {
  focus: string;
  context?: TrainingContext | null;
}) {
  const router = useRouter();
  const retry = () => {
    if (context?.prompt) storeRetryPrompt(context.prompt);
    router.push(
      context?.drillSlug ? `/training?mode=${context.drillSlug}` : "/training",
    );
  };
  return (
    <div className="bg-card border-border flex flex-col gap-5 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-medium">
          For your next attempt
        </p>
        <p className="text-foreground mt-1.5 max-w-[60ch] text-[17px] leading-snug font-medium">
          {focus}
        </p>
      </div>
      <Button type="button" size="lg" onClick={retry} className="shrink-0">
        Try this prompt again
      </Button>
    </div>
  );
}
