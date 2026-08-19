import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import DarkPanel from "@/components/marketing/dark-panel";
import GradientText from "@/components/marketing/gradient-text";
import ShapeField from "@/components/marketing/shape-field";

/**
 * The last thing on the page: one dark stage, one gradient line, one action,
 * and a drift of shapes along the floor. Everything else has been taken out so
 * the only thing left to do is the thing we want done.
 */
export default function ClosingCta() {
  return (
    <section className="marketing-container pb-20 sm:pb-28">
      <DarkPanel
        glow="warm"
        className="px-6 pt-20 pb-[19rem] sm:px-12 sm:pt-24"
      >
        <div className="relative z-10 text-center">
          <h2 className="type-h2 mx-auto max-w-[20ch] text-white">
            Say it better today.{" "}
            <GradientText>Post it better tomorrow.</GradientText>
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-base leading-relaxed text-white/65">
            The practice tools are free and need no account. Studio opens to the
            waitlist first.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/training"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold text-white no-underline transition-opacity hover:opacity-90"
              style={{ background: "var(--sg-accent)" }}
            >
              Begin training
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3.5 text-[15px] font-semibold text-white/85 no-underline transition-colors hover:bg-white/10"
            >
              Explore Studio
            </Link>
          </div>
        </div>

        <ShapeField />
      </DarkPanel>
    </section>
  );
}
