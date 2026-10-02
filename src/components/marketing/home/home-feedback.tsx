import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DeliveryGauges, SpeechTimeline } from "@/components/training/feedback";
import { sampleMetrics, sampleTranscript } from "@/data/sample-feedback";
import styles from "./home.module.css";

/** A real slice of the feedback report, drawn from the sample answer. */
export default function HomeFeedback() {
  return (
    <section className="marketing-section marketing-rule">
      <div className="marketing-container">
        <div className={styles.intro}>
          <h2 className="type-h2">See where you hesitated, not just a score</h2>
          <p className="type-description">
            Record an attempt and Yapper Train maps it out: where you spoke,
            where you paused in the middle of a sentence, and every filler word.
            Then it corrects your own sentences and gives you one thing to
            change on the next try.
          </p>
        </div>
        <div className={styles.report}>
          <SpeechTimeline words={sampleTranscript} />
          <DeliveryGauges metrics={sampleMetrics} />
        </div>
        <div className={styles.actions}>
          <Button asChild>
            <Link href="/progress/sample">See a full sample report</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/products/train/ai-feedback">
              How AI feedback works
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
