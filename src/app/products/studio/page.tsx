import Link from "next/link";
import FeatureDemos from "@/components/marketing/feature-demos";
import { Check } from "lucide-react";
import MarketingLayout from "@/components/marketing/marketing-layout";
import StudioPreview from "@/components/marketing/studio-preview";
import {
  StudioSignup,
  WorkflowLinks,
} from "@/components/marketing/product-sections";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import { Button } from "@/components/ui/button";
import { marketingMetadata } from "@/lib/marketing-metadata";
import { ProductJsonLd } from "@/app/home-json-ld";

export const metadata = marketingMetadata(
  "Video creation software: script, record & edit",
  "Capture content ideas, write video scripts, record with a teleprompter, edit by transcript, add captions, and prepare social posts in Yapper Studio. Join the waitlist.",
  "/products/studio",
);
export default function StudioProductPage() {
  return (
    <MarketingLayout>
      <ProductJsonLd product="studio" />
      <section className="marketing-hero">
        <div className="marketing-container">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Yapper Studio", href: "/products/studio" },
            ]}
          />
          <div className="marketing-hero-grid">
            <div className="marketing-hero-centered">
              <h1 className="type-display">
                Video creation software.
                <br />
                From script to final cut.
              </h1>
              <p className="marketing-lede">
                The content studio for people who talk to camera. Bring your
                ideas, shape your script, record a take, and carry it through to
                the final post.
              </p>
              <div className="marketing-actions">
                <Button asChild size="lg">
                  <Link href="#waitlist">Join the Studio waitlist</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/features">See all features</Link>
                </Button>
              </div>
              <p className="marketing-note">
                In private beta.{" "}
                <Link href="/products/studio/pricing" className="underline">
                  See pricing
                </Link>
              </p>
            </div>
            <StudioPreview initialStep="Script" />
          </div>
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className="marketing-container">
          <div className="marketing-section-intro">
            <h2 className="type-h2">Keep the work together.</h2>
            <p className="type-description">
              A recording should remember the script it came from. A post should
              stay connected to the video. Studio is built around that simple
              idea.
            </p>
          </div>
          <FeatureDemos />
          <WorkflowLinks />
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className="marketing-container marketing-split">
          <StudioPreview initialStep="Edit" />
          <div>
            <p className="type-label mb-4">Made for talking-head videos</p>
            <h2 className="type-h2">
              Keep your point.
              <br />
              Lose the extra takes.
            </h2>
            <p className="type-description">
              Use the transcript to find the words you want to keep. Clean up
              the recording, style your captions, and finish the details in the
              native Mac editor.
            </p>
            <ul className="marketing-benefits">
              {[
                "Word-level editing",
                "Silence and pause removal",
                "Timed captions",
                "Precise timeline controls",
              ].map((item) => (
                <li key={item}>
                  <Check size={16} />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              className="marketing-text-link mt-7"
              href="/features/transcript-video-editor"
            >
              Explore the video editor
            </Link>
          </div>
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className="marketing-container">
          <div className="marketing-section-intro">
            <h2 className="type-h2">
              Know what’s ready.
              <br />
              Know what comes next.
            </h2>
            <p className="type-description">
              Plan the next video without losing track of the current one. Keep
              ideas, drafts, recordings, and publishing details connected.
            </p>
          </div>
          <div className="marketing-availability">
            <strong>Where Studio stands today.</strong> Studio is in private
            testing, with web workflows and a native Mac editor. Scheduling and
            automated delivery depend on enabled services and supported
            accounts. Mobile and Windows apps are not available. Access is by
            application for now.
          </div>
        </div>
      </section>
      <StudioSignup />
    </MarketingLayout>
  );
}
