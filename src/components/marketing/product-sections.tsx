import Link from "next/link";
import StudioStartActions from "@/components/marketing/studio-start-actions";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { featureGroups } from "@/data/marketing-navigation";
import { marketingFeatures } from "@/data/marketing-features";
import { TRIAL_CREDITS, TRIAL_DAYS } from "@/lib/billing/plans";

export function WorkflowLinks() {
  return (
    <div className="marketing-workflow">
      {featureGroups.map((group, index) => (
        <article className="marketing-workflow-item" key={group.id}>
          <div className="marketing-workflow-heading">
            <span className="marketing-step-number">0{index + 1}</span>
            <h3 className="type-h3">{group.title}</h3>
          </div>
          <p className="type-description">{group.description}</p>
          <div className="marketing-workflow-links">
            {group.slugs.map((slug) => (
              <Link
                key={slug}
                href={`/features/${slug}`}
                className="marketing-text-link"
              >
                {marketingFeatures.find((f) => f.slug === slug)!.shortTitle}
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

/** The closing invitation to access Studio. */
export function StudioStart() {
  return (
    <section
      id="start"
      className="marketing-section marketing-rule"
      aria-labelledby="studio-start-title"
    >
      <div className="marketing-container">
        <div className="studio-signup">
          <h2 id="studio-start-title" className="type-h2">
            Make your next video in Yapper Studio.
          </h2>
          <p className="type-description">
            Try every Studio tool free for {TRIAL_DAYS} days, with{" "}
            {TRIAL_CREDITS} AI credits.
          </p>
          <StudioStartActions />
          <p className="type-caption">Cancel anytime.</p>
        </div>
      </div>
    </section>
  );
}

export function TrainingCta() {
  return (
    <section className="marketing-section marketing-rule">
      <div className="marketing-container marketing-split">
        <div>
          <h2 className="type-h2">
            Start with a one-minute speaking exercise.
          </h2>
          <p className="type-description">
            Pick a topic and say what comes to mind. Free practice, with no
            account needed.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="https://speakingpractice.ai/">
              Start a practice session
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="https://speakingpractice.ai/">Browse practice</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
