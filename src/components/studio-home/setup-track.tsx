import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SetupStep } from "@/components/studio-home/setup-steps";

/**
 * Getting started, for a creator who has not finished it: three steps in a
 * row with how many are done. It disappears for good once all three are, so
 * a set-up account never sees it.
 */
export default function SetupTrack({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((step) => step.done).length;

  return (
    <section
      aria-label="Get set up"
      className="bg-card border-border rounded-xl border"
    >
      <header className="flex items-baseline justify-between gap-3 px-4 pt-3.5">
        <h2 className="font-display text-foreground text-sm font-semibold">
          Get set up
        </h2>
        <span className="text-muted-foreground text-xs">
          <span className="font-mono tabular-nums">{done}</span> of{" "}
          <span className="font-mono tabular-nums">{steps.length}</span> done
        </span>
      </header>
      <div
        aria-hidden
        className="bg-muted mx-4 mt-2.5 h-1 overflow-hidden rounded-full"
      >
        <div
          className="h-full rounded-full bg-[color:var(--sg-green-500)] motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${(done / steps.length) * 100}%` }}
        />
      </div>
      <ol className="divide-border/60 grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {steps.map((step, index) => (
          <li key={step.id} className="flex gap-3 p-4">
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                step.done
                  ? "bg-[color:var(--sg-green-500)] text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step.done ? (
                <Check aria-hidden className="size-3.5 stroke-[3]" />
              ) : (
                <span className="font-mono tabular-nums">{index + 1}</span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${
                  step.done
                    ? "text-muted-foreground line-through decoration-1"
                    : "text-foreground"
                }`}
              >
                {step.title}
                {step.done ? <span className="sr-only"> (done)</span> : null}
              </p>
              {step.done ? null : (
                <>
                  <p className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
                    {step.detail}
                  </p>
                  {step.action ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="mt-2.5"
                    >
                      <Link href={step.action.href}>{step.action.label}</Link>
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
