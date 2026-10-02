import Link from "next/link";
import MarketingLayout from "@/components/marketing/marketing-layout";
import { Button } from "@/components/ui/button";
import { STUDIO_PLANS, TRAIN_PLUS, formatPrice } from "@/lib/billing/plans";
import { marketingMetadata } from "@/lib/marketing-metadata";
import styles from "@/components/billing/pricing.module.css";

export const metadata = marketingMetadata(
  "Yapper pricing for Train and Studio",
  "Yapper Train and Yapper Studio are priced separately. Train is free to practice, with AI feedback from $9 a month. Studio is one membership from $7.99 a week.",
  "/pricing",
  { brandSuffix: false },
);

const studioFrom = STUDIO_PLANS[0];

export default function PricingChooser() {
  return (
    <MarketingLayout>
      <section className={styles.hero}>
        <div className="marketing-container">
          <div className={styles.intro}>
            <h1 className="type-h1">Yapper pricing</h1>
            <p>
              Train and Studio are separate products, each with its own plan. A
              plan for one does not include the other.
            </p>
          </div>
          <div className={styles.chooser}>
            <article className={styles.plan}>
              <h2>Yapper Train</h2>
              <p>
                Speaking practice. Every exercise is free. Train Plus adds
                unlimited AI feedback on what you record.
              </p>
              <p className={styles.from}>
                Free, or {formatPrice(TRAIN_PLUS.monthlyCents)} a month for
                Train Plus
              </p>
              <Button asChild variant="outline">
                <Link href="/products/train/pricing">See Train pricing</Link>
              </Button>
            </article>
            <article className={styles.plan}>
              <h2>Yapper Studio</h2>
              <p>
                Video creation. One membership with every tool, and credits for
                transcription and AI with each payment.
              </p>
              <p className={styles.from}>
                From {studioFrom.priceLabel} {studioFrom.cadenceLabel}, with a
                7-day free trial.
              </p>
              <Button asChild variant="outline">
                <Link href="/products/studio/pricing">See Studio pricing</Link>
              </Button>
            </article>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
