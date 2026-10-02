import Link from "next/link";

/** Questions people have before they try it, answered with specifics. */
export default function HomeQuestions() {
  return (
    <section className="marketing-section marketing-rule">
      <div className="marketing-container">
        <h2 className="type-h2 mb-8">Before you start</h2>
        <div className="marketing-faq">
          <details>
            <summary>Is the random topic generator free?</summary>
            <p>
              Yes. The generator, the timer and every other exercise are free
              and work without an account. You only sign in if you want AI
              feedback on a recording.
            </p>
          </details>
          <details>
            <summary>What does the AI feedback tell me?</summary>
            <p>
              Your pace, where you paused, which filler words you used and how
              often, corrections to your own sentences, a cleaner version of
              your answer, and one thing to work on next. You can see a{" "}
              <Link href="/progress/sample" className="underline">
                sample report
              </Link>
              . Your first one is free.
            </p>
          </details>
          <details>
            <summary>Do I need to record myself?</summary>
            <p>
              No. You can practice with just the prompt and the timer. A
              recording lets you listen back, and it is what feedback is based
              on.
            </p>
          </details>
          <details>
            <summary>Can I use Yapper Studio now?</summary>
            <p>
              Yes. Studio is open to everyone, with a 7-day free trial.
              <Link href="/products/studio/pricing" className="underline">
                See Studio plans
              </Link>
              .
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
