import styles from "./product-showcase.module.css";

/** The stages of a walkthrough, with the current one marked. Each is a button
 * so a viewer can jump to the part they care about. */
export default function WalkthroughSteps({
  steps,
  current,
  onSelect,
  label,
}: {
  steps: readonly string[];
  current: number;
  onSelect: (index: number) => void;
  label: string;
}) {
  return (
    <ol className={styles.steps} aria-label={label}>
      {steps.map((step, index) => (
        <li key={step}>
          <button
            type="button"
            aria-current={index === current ? "step" : undefined}
            onClick={() => onSelect(index)}
          >
            {step}
          </button>
        </li>
      ))}
    </ol>
  );
}
