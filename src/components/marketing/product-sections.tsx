import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { featureGroups } from "@/data/marketing-navigation";
import { marketingFeatures } from "@/data/marketing-features";
import StudioWaitlist from "@/components/marketing/studio-waitlist";

export function ProductPair() {
  return (
    <div className="marketing-product-pair">
      <article className="marketing-product-summary">
        <p className="type-label mb-4">Create content</p>
        <h3 className="type-h2">Yapper Studio</h3>
        <p className="type-description">
          A place for your ideas, scripts, recordings, edits, and publishing
          plan. Keep the whole video together.
        </p>
        <Link className="marketing-text-link" href="/products/studio">
          Explore Studio
          <ArrowUpRight size={15} />
        </Link>
        <p className="marketing-note">In private testing</p>
      </article>
      <article className="marketing-product-summary">
        <p className="type-label mb-4">Learn to speak</p>
        <h3 className="type-h2">Yapper Train</h3>
        <p className="type-description">
          Get comfortable saying what you mean. Practice with prompts, listen
          back, and get feedback for your next attempt.
        </p>
        <Link className="marketing-text-link" href="/products/train">
          Explore Train
          <ArrowUpRight size={15} />
        </Link>
        <p className="marketing-note">
          Free practice available now. AI coaching uses credits.
        </p>
      </article>
    </div>
  );
}

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

export function StudioSignup() {
  return (
    <section id="waitlist" className="marketing-section marketing-rule">
      <div className="marketing-container">
        <div className="studio-signup">
          <h2 className="type-h2">Get early access to Yapper Studio.</h2>
          <p className="type-description">
            Join the list and we’ll tell you when Studio is ready.
          </p>
          <StudioWaitlist />
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
