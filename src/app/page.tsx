import Link from "next/link";
import MetalStatusBadge from "@/components/ui/metal-status-badge";
import FeatureDemos from "@/components/marketing/feature-demos";
import { GlassyButton } from "@/components/ui/glassy-button";
import { ArrowUpRight } from "lucide-react";
import MarketingLayout from "@/components/marketing/marketing-layout";
import StudioPreview from "@/components/marketing/studio-preview";
import TrainingPreview from "@/components/marketing/training-preview";
import {
  StudioSignup,
  WorkflowLinks,
} from "@/components/marketing/product-sections";
import { Button } from "@/components/ui/button";
import HomeJsonLd from "@/app/home-json-ld";
import { marketingMetadata } from "@/lib/marketing-metadata";

export const metadata = marketingMetadata(
  "Content creation app for video creators",
  "Write scripts, record with a teleprompter, edit videos, and plan social posts in Yapper Studio. Explore the content creation app and Yapper Train speaking practice.",
  "/",
);

export default function HomePage() {
  return (
    <MarketingLayout>
      <HomeJsonLd />
      <section className="marketing-hero marketing-home-hero">
        <div className="marketing-container">
          <div className="marketing-hero-copy">
            <div className="marketing-hero-badge">
              <MetalStatusBadge>Private beta</MetalStatusBadge>
            </div>
            <h1 className="type-display">
              Content creation.
              <br />
              From idea to published.
            </h1>
            <p className="marketing-lede">
              Capture the idea. Write the script. Record, edit, and post your
              video. One content creation app for the whole process.
            </p>
            <div className="marketing-actions">
              <GlassyButton href="#waitlist" height={48}>
                Join the Studio waitlist
              </GlassyButton>
              <Link href="/products/studio" className="marketing-text-link">
                Explore Studio <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
          <StudioPreview />
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className="marketing-container">
          <div className="marketing-section-intro">
            <div>
              <p className="type-label mb-4">Inside Yapper Studio</p>
              <h2 className="type-h2">A place for every part of your video.</h2>
            </div>
            <p className="type-description">
              From a passing thought to a post on your calendar. Your work stays
              connected as you move through Studio.
            </p>
          </div>
          <FeatureDemos />
          <WorkflowLinks />
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className="marketing-container marketing-split">
          <TrainingPreview />
          <div>
            <p className="type-label mb-4">Yapper Train</p>
            <h2 className="type-h2">
              Practice public speaking before it counts.
            </h2>
            <p className="type-description">
              A presentation, a conversation, a minute on camera. Practice
              putting your thoughts into words, then take one useful improvement
              into your next attempt.
            </p>
            <div className="marketing-actions">
              <Button variant="outline" asChild>
                <Link href="/training">Start practicing</Link>
              </Button>
              <Link className="marketing-text-link" href="/products/train">
                Explore Train
                <ArrowUpRight size={15} />
              </Link>
            </div>
            <p className="marketing-note">
              Practice free. Add AI coaching when you want feedback.
            </p>
          </div>
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className="marketing-container">
          <h2 className="type-h2 mb-8">A few things to know.</h2>
          <div className="marketing-faq">
            <details>
              <summary>
                What’s the difference between Yapper Train and Yapper Studio?
              </summary>
              <p>
                Yapper Train helps you practice speaking and improve your
                delivery. Yapper Studio is for creating content: capture ideas,
                write scripts, record, edit, and prepare posts. You can use
                either for its own purpose.
              </p>
            </details>
            <details>
              <summary>What can I use today?</summary>
              <p>
                Yapper Train’s speaking practice tools are open now. AI coaching
                uses credits, with details on the{" "}
                <Link href="/pricing" className="underline">
                  pricing page
                </Link>
                . Studio is in private testing; join its waitlist for public
                access updates.
              </p>
            </details>
            <details>
              <summary>Are the mobile apps available?</summary>
              <p>
                Dedicated mobile apps are planned. For now, you can use the
                speaking practice website on your phone. Studio’s recording and
                planning workflow is being developed alongside its native Mac
                editor.
              </p>
            </details>
          </div>
        </div>
      </section>
      <StudioSignup />
    </MarketingLayout>
  );
}
