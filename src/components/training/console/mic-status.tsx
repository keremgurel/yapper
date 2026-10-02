import { MicOff } from "lucide-react";
import styles from "@/components/training/training-workspace.module.css";

/** Whether the microphone is live. When it is not, this is the one place to
 * turn it on, replacing the old mic button under the console. */
export default function MicStatus({
  on,
  recording,
  disabled,
  onEnable,
}: {
  on: boolean;
  recording: boolean;
  disabled: boolean;
  onEnable: () => void;
}) {
  if (on)
    return (
      <span className={styles.micStatus} data-recording={recording}>
        <i aria-hidden="true" />
        {recording ? "Recording" : "Mic ready"}
      </span>
    );
  return (
    <button
      type="button"
      className={styles.micStatus}
      data-off="true"
      disabled={disabled}
      onClick={onEnable}
    >
      <MicOff size={14} aria-hidden="true" />
      Turn on mic
    </button>
  );
}
