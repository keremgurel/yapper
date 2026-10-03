import Link from "next/link";
import StudioStartActions from "@/components/marketing/studio-start-actions";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { featureGroups } from "@/data/marketing-navigation";
import { marketingFeatures } from "@/data/marketing-features";

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

/** The closing call to action on Studio pages: start the trial, or open
 * Studio and look around first. */
export function StudioStart() {
  return (
    <section id="start" className="marketing-section marketing-rule">
      <div className="marketing-container">
        <div className="studio-signup">
          <h2 className="type-h2">Make your next video in Yapper Studio.</h2>
          <p className="type-description">
            Every tool, 30 credits to try the AI, and 7 days before your first
            payment. Cancel anytime.
          </p>
          <StudioStartActions />
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
            <Link href="/training/random-topic-generator">
              Start a practice session
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/training">Browse practice</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
