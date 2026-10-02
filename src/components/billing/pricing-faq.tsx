import { Plus } from "lucide-react";
import styles from "./pricing.module.css";

/** Question and answer disclosures for a pricing page. */
export default function PricingFaq({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  return (
    <div className={styles.faq}>
      {items.map(({ question, answer }) => (
        <details key={question}>
          <summary>
            {question}
            <Plus size={17} aria-hidden="true" />
          </summary>
          <p>{answer}</p>
        </details>
      ))}
    </div>
  );
}
