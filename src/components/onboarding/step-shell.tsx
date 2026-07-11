"use client";

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

/** The number of dotted progress steps (socials → pillars → inspiration).
 * The welcome screen sits before the dots. */
export const STEP_COUNT = 3;

/** Shared frame for an onboarding step: back + progress dots + optional skip on
 * top, titled content in the middle, a pinned footer CTA at the bottom. Fixed
 * min height so the card doesn't jump between steps. */
export default function StepShell({
  stepIndex,
  title,
  subtitle,
  onBack,
  onSkip,
  footer,
  children,
}: {
  stepIndex: number;
  title: string;
  subtitle: string;
  onBack?: () => void;
  onSkip?: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[540px] flex-col p-6 sm:p-8">
      <div className="mb-7 flex items-center justify-between">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground -ml-1"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <span className="w-5" />
        )}

        <div className="flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIndex
                  ? "w-5 bg-[color:var(--sg-accent)]"
                  : i < stepIndex
                    ? "w-1.5 bg-[color:var(--sg-accent)]"
                    : "bg-foreground/20 w-1.5"
              }`}
            />
          ))}
        </div>

        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground text-sm font-semibold"
          >
            Skip
          </button>
        ) : (
          <span className="w-8" />
        )}
      </div>

      <div className="flex-1">
        <h2 className="font-display text-foreground text-2xl font-black tracking-tight">
          {title}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {subtitle}
        </p>
        <div className="mt-5">{children}</div>
      </div>

      <div className="mt-6">{footer}</div>
    </div>
  );
}
