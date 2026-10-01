import Link from "next/link";
export default function PracticeGuide({
  freestyle = false,
}: {
  freestyle?: boolean;
}) {
  return (
    <section className="marketing-section marketing-rule">
      <div className="marketing-container training-guide">
        <div>
          <h2 className="type-h2">Make each attempt useful.</h2>
          <p className="type-description mt-4">
            Listen for one thing to improve. Then try another minute.
          </p>
          <Link href="/training" className="marketing-text-link mt-6">
            Explore all exercises
          </Link>
        </div>
        <div className="marketing-faq">
          <details>
            <summary>How do I start?</summary>
            <p>
              {freestyle
                ? "Choose something you want to talk about."
                : "Generate a topic and take a moment to collect your thoughts."}{" "}
              Set the timer and begin. A point, an example, and a short
              conclusion give your answer a simple structure.
            </p>
          </details>
          <details>
            <summary>Do I need my camera or microphone?</summary>
            <p>
              No. You can use the prompt and timer on their own. Enable your
              camera or microphone only if you want to record and review your
              delivery.
            </p>
          </details>
          <details>
            <summary>Is speaking practice free?</summary>
            <p>
              Prompts, the timer, recording, and downloading your recording are
              free. Optional transcription and AI coaching use credits.
            </p>
          </details>
          <details>
            <summary>What should I listen for?</summary>
            <p>
              Start with clarity: did you make your point? On the next attempt,
              focus on your pace, unnecessary pauses, or words you repeat.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
