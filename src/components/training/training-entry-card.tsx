import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function TrainingEntryCard() {
  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div
        className="mx-auto max-w-6xl border-y py-8"
        style={{ borderColor: "var(--sg-border)" }}
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="sg-label" style={{ color: "var(--sg-label)" }}>
              Training programs
            </p>
            <h2 className="sg-display mt-3 text-3xl leading-none sm:text-5xl">
              Structured reps for every speaking mode.
            </h2>
            <p
              className="mt-4 max-w-2xl text-base leading-7"
              style={{ color: "var(--sg-text-muted)" }}
            >
              Pick a drill, get a focused prompt, and record a clean rep with
              the same timer and practice flow Yapper uses everywhere.
            </p>
          </div>
          <Link
            href="/training"
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black no-underline transition-transform hover:-translate-y-0.5"
            style={{
              background: "var(--sg-text)",
              color: "var(--sg-bg)",
              boxShadow: "var(--sg-shadow-card)",
            }}
          >
            Open training
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
