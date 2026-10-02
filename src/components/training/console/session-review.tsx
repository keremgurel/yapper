import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import TrainingFeedbackCta from "@/components/training/feedback-cta";
import type { TrainingContext } from "@/lib/training-feedback/types";
import styles from "@/components/training/training-workspace.module.css";

/**
 * The screen after an attempt: listen back, get feedback, or go again.
 * Feedback is the main action. Going again is always one click away.
 */
export default function SessionReview({
  recordedUrl,
  isVideo,
  recorded,
  audio,
  audioPending,
  context,
  onDownload,
  preparingDownload,
  onRetry,
  onNewPrompt,
}: {
  recordedUrl: string | null;
  isVideo: boolean;
  /** Whether this attempt was recorded at all. */
  recorded: boolean;
  audio: Blob | null;
  audioPending: boolean;
  context: TrainingContext;
  onDownload: () => void;
  preparingDownload: boolean;
  onRetry: () => void;
  onNewPrompt: () => void;
}) {
  return (
    <div className={styles.review}>
      <div className={styles.reviewHeading}>
        <span className={styles.reviewMark}>
          <Check size={22} aria-hidden="true" />
        </span>
        <h2 className="type-h2">That’s one done.</h2>
        <p className={styles.reviewPrompt}>{context.prompt}</p>
      </div>
      {recordedUrl ? (
        <div className={styles.replay}>
          {isVideo ? (
            <video src={recordedUrl} controls playsInline />
          ) : (
            <audio src={recordedUrl} controls />
          )}
        </div>
      ) : (
        <p className={styles.reviewNote}>
          {recorded
            ? "Your recording is being prepared."
            : "You practiced without recording, so there is nothing to play back or score this time."}
        </p>
      )}
      <div className={styles.reviewFeedback}>
        <TrainingFeedbackCta
          audio={audio}
          audioPending={audioPending}
          context={context}
        />
      </div>
      <div className={styles.reviewActions}>
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
        <Button variant="outline" onClick={onNewPrompt}>
          New prompt
        </Button>
        {recordedUrl && (
          <Button
            variant="ghost"
            onClick={onDownload}
            disabled={preparingDownload}
          >
            {preparingDownload ? "Preparing download…" : "Download recording"}
          </Button>
        )}
      </div>
    </div>
  );
}
