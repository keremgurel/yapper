import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The last thing on the page restates the two doors, because someone who read
 * the whole argument should not have to scroll back up to act on it.
 */
export default function ClosingCta() {
  return (
    <section className="marketing-container pb-20 sm:pb-28">
      <div
        className="border-border relative overflow-hidden rounded-3xl border px-6 py-16 text-center sm:px-12 sm:py-20"
        style={{
          background:
            "radial-gradient(80% 100% at 50% 0%, color-mix(in srgb, var(--sg-accent) 14%, transparent), transparent 70%), var(--sg-surface)",
        }}
      >
        <h2 className="type-h2 mx-auto max-w-[18ch]">
          Start talking today. Post better tomorrow.
        </h2>
        <p className="type-description mx-auto mt-5 max-w-[52ch] text-base">
          The practice tools are free and need no account. Studio opens to the
          waitlist first.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="sm:px-8">
            <Link href="/training" className="no-underline">
              Begin training
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="sm:px-8">
            <Link href="/studio" className="no-underline">
              Explore Studio
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
