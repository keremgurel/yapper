import Link from "next/link";
import MarketingLayout from "@/components/marketing/marketing-layout";
import StudioPreview from "@/components/marketing/studio-preview";
import FeaturePreview from "@/components/marketing/feature-preview";
import layout from "@/components/marketing/home/project-stack.module.css";
import ProjectStack from "@/components/marketing/home/project-stack";
import HomeGuides from "@/components/marketing/home/home-guides";
import { StudioStart } from "@/components/marketing/product-sections";
import StudioCtaButton from "@/components/marketing/studio-cta-button";
import { marketingMetadata } from "@/lib/marketing-metadata";
import HomeJsonLd, { ProductJsonLd } from "@/app/home-json-ld";

export const metadata = marketingMetadata(
  "Yapper Studio: your all-in-one content creation studio",
  "Everything you need to create content in one place. Ideas that sound like you, a teleprompter, one-click video editing and cross-posting. Try Yapper Studio.",
  "/",
  { brandSuffix: false },
);
export default function HomePage() {
  return (
    <MarketingLayout>
      <HomeJsonLd />
      <ProductJsonLd product="studio" />
      <section className="marketing-hero">
        <div className="marketing-container">
          <div className="marketing-hero-grid">
            <div className="marketing-hero-centered">
              <h1 className="type-display">
                Everything you need
                <br />
                to create content.
              </h1>
              <p className="marketing-lede">
                Ideas that sound like you. A teleprompter that keeps you
                natural. One click to cut the retakes. Post to your channels
                from one place—and get back to creating.
              </p>
              <div className="marketing-actions">
                <StudioCtaButton size="lg" />
              </div>
              <p className="marketing-note">
                7 days free. $24.99 monthly or $199.99 yearly. Cancel anytime.
              </p>
            </div>
            <StudioPreview initialStep="Edit" />
          </div>
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className={`marketing-container marketing-split ${layout.split}`}>
          <FeaturePreview slug="transcript-video-editor" />
          <div>
            <p className="type-label mb-4">One-click editing</p>
            <h2 className="type-h2">
              Full edit with one click.
              <br />
              Hours of time back.
            </h2>
            <p className="type-description">
              No more spending hours cutting out silences, mistakes and retakes.
              One-click edit cleans up the recording so your best take comes
              through as continuous talk. Review the cut, adjust what you want
              and add captions.
            </p>
            <p className="type-description mt-4">
              Want more control? Text-based video editing lets you remove a
              sentence by selecting its words. The timeline is there for the
              finishing touches.
            </p>
            <Link
              className="marketing-text-link mt-7"
              href="/features/transcript-video-editor"
            >
              Explore one-click video editing
            </Link>
          </div>
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className={`marketing-container marketing-split ${layout.split}`}>
          <div>
            <p className="type-label mb-4">Brain, Ideas and Lab</p>
            <h2 className="type-h2">
              The next idea should
              <br />
              sound like you.
            </h2>
            <p className="type-description">
              Brain gets to know your voice, your point of view and the content
              you’ve already made. Add your references and connect your social
              profile. Your previous videos become context for ideas rooted in
              how you think and speak.
            </p>
            <p className="type-description mt-4">
              Ask for ideas you can actually shoot. Explore the angle in Lab,
              find the hook and turn it into a script or talking points. You
              choose when to bring in AI.
            </p>
            <Link
              className="marketing-text-link mt-7"
              href="/features/idea-capture"
            >
              Find your next content idea
            </Link>
          </div>
          <FeaturePreview slug="idea-capture" />
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className={`marketing-container marketing-split ${layout.split}`}>
          <FeaturePreview slug="teleprompter-recorder" />
          <div>
            <p className="type-label mb-4">Teleprompter recorder</p>
            <h2 className="type-h2">
              Never forget what to say.
              <br />
              While sounding natural.
            </h2>
            <p className="type-description">
              Keep your script or key talking points on screen while you talk to
              the camera. Set a comfortable pace, stay on track and leave room
              for a natural delivery. Prefer to freestyle? Record without it.
            </p>
            <Link
              className="marketing-text-link mt-7"
              href="/features/teleprompter-recorder"
            >
              Record with a teleprompter
            </Link>
          </div>
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className={`marketing-container marketing-split ${layout.split}`}>
          <div>
            <p className="type-label mb-4">Poster</p>
            <h2 className="type-h2">
              One click schedule.
              <br />
              Crossposted to all your socials.
            </h2>
            <p className="type-description">
              Cross-post and schedule your video to multiple connected channels
              in one go. Choose the destinations, set each caption and
              thumbnail, then publish now or pick a time. Your posting plan
              stays connected to the video you just made.
            </p>
            <Link
              className="marketing-text-link mt-7"
              href="/features/social-publishing"
            >
              Explore cross-posting and scheduling
            </Link>
          </div>
          <FeaturePreview slug="social-publishing" />
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className="marketing-container">
          <div className="marketing-availability">
            <strong>Your studio, from idea to post.</strong> Plan on the web;
            record and edit with the native Mac editor. Publishing and
            scheduling work with supported connected accounts. Coming soon: scan
            a code to continue on your phone, record with a teleprompter, or use
            the full Studio—including the editor—in the mobile app. Windows is
            not available yet.
          </div>
        </div>
      </section>
      <ProjectStack />
      <HomeGuides />
      <StudioStart />
    </MarketingLayout>
  );
}
