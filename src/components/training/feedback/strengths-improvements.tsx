import { Check, Target } from "lucide-react";
import styles from "@/components/training/feedback/takeaways.module.css";

/**
 * What worked and what to work on, as two panels. When one list is empty the
 * other takes the full width; when both are empty the parent skips the
 * section entirely.
 */
export default function StrengthsImprovements({
  strengths,
  improvements,
}: {
  strengths: string[];
  improvements: string[];
}) {
  const panels = [
    { key: "keep", title: "Keep doing", items: strengths, Icon: Check },
    { key: "next", title: "Work on next", items: improvements, Icon: Target },
  ].filter((panel) => panel.items.length > 0);
  if (panels.length === 0) return null;

  return (
    <div className={styles.panels} data-single={panels.length === 1}>
      {panels.map(({ key, title, items, Icon }) => (
        <section key={key} className={styles.panel} data-kind={key}>
          <h3>{title}</h3>
          <ul>
            {items.map((item, index) => (
              <li key={index}>
                <span className={styles.icon} aria-hidden="true">
                  <Icon size={14} strokeWidth={2.4} />
                </span>
                <p>{item}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
