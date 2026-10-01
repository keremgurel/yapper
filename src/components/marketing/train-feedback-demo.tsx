"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import styles from "./train-product.module.css";

export default function TrainFeedbackDemo() {
  const [polished, setPolished] = useState(false);
  return (
    <div
      className={styles.feedbackField}
      aria-label="Example of speaking feedback"
    >
      <div className={styles.feedbackWindow}>
        <div className={styles.feedbackHeading}>
          <span>
            <Sparkles size={16} /> Your speaking feedback
          </span>
          <span>Clarity</span>
        </div>
        <div
          className={styles.feedbackTabs}
          role="group"
          aria-label="Compare the example answer"
        >
          <button
            type="button"
            aria-pressed={!polished}
            onClick={() => setPolished(false)}
          >
            Your answer
          </button>
          <button
            type="button"
            aria-pressed={polished}
            onClick={() => setPolished(true)}
          >
            A clearer version
          </button>
        </div>
        <div className={styles.answerSpace} aria-live="polite">
          {polished ? (
            <p>
              “I learned to ask for help sooner. On my last project, a
              ten-minute conversation solved a problem I’d spent two days on.”
            </p>
          ) : (
            <p>
              “I think, <mark>for me personally</mark>, the thing I learned was{" "}
              <mark>basically</mark> to ask for help. I spent two days stuck,
              and then someone helped me in ten minutes.”
            </p>
          )}
        </div>
        <div className={styles.coachNote}>
          <span className={styles.coachCheck}>
            <Check size={16} />
          </span>
          <div>
            <strong>Lead with what you learned.</strong>
            <p>
              Your example makes the point. Bring it forward and let it do the
              work.
            </p>
          </div>
        </div>
        <div className={styles.feedbackFooter}>
          <span>Next attempt</span>
          <strong>One clear point. One specific example.</strong>
        </div>
      </div>
    </div>
  );
}
