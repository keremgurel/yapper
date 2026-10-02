import MarketingLayout from "@/components/marketing/marketing-layout";
import ProductShowcase from "@/components/marketing/product-showcase/product-showcase";
import ExerciseBento from "@/components/marketing/home/exercise-bento";
import HomeFeedback from "@/components/marketing/home/home-feedback";
import HomeGuides from "@/components/marketing/home/home-guides";
import HomeQuestions from "@/components/marketing/home/home-questions";
import StudioDeck from "@/components/marketing/home/studio-deck";
import HomeJsonLd from "@/app/home-json-ld";
import { marketingMetadata } from "@/lib/marketing-metadata";

export const metadata = marketingMetadata(
  "Yapper: speaking practice and a video studio",
  "Yapper makes two separate products. Yapper Train is free speaking practice with a random topic generator, timed exercises and AI feedback. Yapper Studio takes a video from idea to published post.",
  "/",
  { brandSuffix: false },
);

export default function HomePage() {
  return (
    <MarketingLayout>
      <HomeJsonLd />
      <section className="marketing-hero marketing-home-hero">
        <div className="marketing-container">
          <div className="marketing-hero-copy">
            <h1 className="type-display">
              Get better at speaking.
              <br />
              Make better videos.
            </h1>
            <p className="marketing-lede">
              Two products from Yapper. Train for speaking practice, Studio for
              making video.
            </p>
          </div>
          <div id="products" className="home-showcase">
            <ProductShowcase />
          </div>
        </div>
      </section>

      <ExerciseBento />
      <HomeFeedback />
      <StudioDeck />
      <HomeGuides />
      <HomeQuestions />
    </MarketingLayout>
  );
}
