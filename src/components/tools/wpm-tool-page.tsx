import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import TrainingLayout from "@/app/training-layout";
import WpmCalculator from "@/components/tools/wpm-calculator";
import { WPM_FAQ } from "@/data/wpm-faq";

const muted = { color: "var(--sg-text-muted)" };

/** The words-per-minute tool page: the calculator plus the surrounding SEO copy
 * and the funnel into the create loop (record at this pace) and the guide. */
export default function WpmToolPage() {
  return (
    <TrainingLayout>
      <section className="px-4 pt-16 pb-8 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <span className="sg-chip">Free tool</span>
          <h1 className="sg-display mt-5 max-w-3xl text-4xl leading-[1.02] text-balance sm:text-5xl">
            Words per minute calculator
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8" style={muted}>
            Paste a script to see how long it takes to say out loud, or plan how
            many words fit a target time. Conversational on-camera delivery runs
            around 130 to 150 words per minute.
          </p>
        </div>
      </section>

      <section className="px-4 pb-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <WpmCalculator />
        </div>
      </section>

      {/* Funnel: turn the number into a take, and repoint to the guide. */}
      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
          <div className="sg-panel flex flex-col gap-3 p-6">
            <p className="sg-display text-2xl">Now practice that pace</p>
            <p className="text-sm leading-6" style={muted}>
              Load your script into the teleprompter and record a take at a
              scroll speed that matches your target words per minute.
            </p>
            <Link
              href="/studio/recorder"
              className="sg-btn-accent mt-auto self-start no-underline"
            >
              Record with the teleprompter
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="sg-card flex flex-col gap-3 p-6">
            <p className="sg-display text-2xl">Which pace is right?</p>
            <p className="text-sm leading-6" style={muted}>
              How to measure your rate, choose a range, and hold a steady pace
              under pressure, plus the research behind the numbers.
            </p>
            <Link
              href="/blog/words-per-minute-speaking"
              className="sg-btn-ghost mt-auto self-start no-underline"
            >
              <BookOpen className="h-4 w-4" />
              Read the speaking-pace guide
            </Link>
          </div>
        </div>
      </section>

      {/* Visible FAQ, mirroring the FAQPage JSON-LD (same source array). */}
      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="sg-display mb-6 text-3xl">Questions</h2>
          <div className="flex flex-col gap-4">
            {WPM_FAQ.map((item) => (
              <div key={item.q} className="sg-card p-6">
                <p className="sg-display text-lg">{item.q}</p>
                <p className="mt-2 text-sm leading-6" style={muted}>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </TrainingLayout>
  );
}
