import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { workflowSteps } from "@/components/marketing/studio-workflow-tour";

/**
 * The seven Studio steps as a single reading line, for the homepage.
 *
 * The full tour with its mockups lives on /studio. Repeating it here would
 * make the two pages the same scroll and bury the half of the product someone
 * can actually use today, so this keeps the shape of the loop and sends people
 * across for the detail. Steps come from the tour's own list so the two can
 * never disagree about what Studio does.
 */
export default function StudioLoopStrip() {
  return (
    <div className="border-border bg-card rounded-2xl border p-6 sm:p-8">
      <ol className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {workflowSteps.map((step, i) => (
          <li key={step.eyebrow} className="flex items-start gap-3">
            <span className="text-muted-foreground mt-[3px] font-mono text-[11px] font-semibold tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0">
              <span className="text-foreground block text-sm font-semibold">
                {step.eyebrow}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-[13px] leading-5">
                {step.title}
              </span>
            </span>
          </li>
        ))}

        <li className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-[3px] font-mono text-[11px] font-semibold text-[color:var(--sg-accent)] tabular-nums"
          >
            08
          </span>
          <Link
            href="/studio"
            className="text-foreground group inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold no-underline"
          >
            See the whole loop
            <ArrowRight className="h-3.5 w-3.5 text-[color:var(--sg-accent)] transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      </ol>
    </div>
  );
}
