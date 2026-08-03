"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  CalendarDays,
  Captions,
  FileText,
  Gauge,
  Layers3,
  ScrollText,
  Send,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  marketingFeatures,
  type MarketingFeature,
} from "@/data/marketing-features";

const ICONS: Record<string, LucideIcon> = {
  "idea-capture": AudioLines,
  "ai-script-writer": WandSparkles,
  "teleprompter-recorder": ScrollText,
  "transcript-video-editor": FileText,
  "automatic-captions": Captions,
  "creator-feedback": Gauge,
  "social-publishing": Send,
  "content-calendar": CalendarDays,
  "content-library": Layers3,
};

const EASE = [0.22, 1, 0.36, 1] as const;

function FeatureCard({
  feature,
  index,
}: {
  feature: MarketingFeature;
  index: number;
}) {
  const Icon = ICONS[feature.slug] ?? WandSparkles;

  return (
    <article
      className="h-full min-w-full snap-center snap-always px-1 select-none sm:px-2"
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${marketingFeatures.length}: ${feature.shortTitle}`}
    >
      <div className="relative h-full overflow-hidden rounded-[28px] border border-white/15 bg-[#111214] shadow-[0_34px_90px_rgba(0,0,0,.32)] sm:rounded-[36px]">
        <div
          aria-hidden
          className="absolute inset-0 opacity-85"
          style={{
            background: `radial-gradient(circle at 16% 12%, ${feature.accent} 0, transparent 37%), radial-gradient(circle at 88% 84%, color-mix(in srgb, ${feature.accent} 56%, #22d3ee) 0, transparent 43%)`,
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,.09),transparent_25%,rgba(0,0,0,.3)_74%)]"
        />
        <span
          aria-hidden
          className="absolute -right-5 -bottom-16 text-[12rem] leading-none font-extrabold tracking-[-0.09em] text-white/[.065] sm:text-[17rem]"
        >
          {feature.number}
        </span>

        <div className="relative flex h-full flex-col p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-white/14 pb-5">
            <p className="text-sm font-semibold text-white/70">
              {feature.eyebrow}
            </p>
            <p className="text-sm font-semibold text-white/45">
              {Number(feature.number)} of {marketingFeatures.length}
            </p>
          </div>

          <div className="grid min-h-0 flex-1 items-center gap-8 py-7 sm:grid-cols-[.72fr_1.28fr] sm:gap-10">
            <div>
              <span
                className="grid h-16 w-16 place-items-center rounded-2xl border border-white/22 bg-black/18 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.28)] backdrop-blur-xl sm:h-20 sm:w-20"
                aria-hidden
              >
                <Icon className="h-7 w-7 sm:h-9 sm:w-9" strokeWidth={1.8} />
              </span>
              <h3 className="mt-5 text-3xl leading-[0.98] font-extrabold tracking-[-0.045em] text-white sm:text-5xl">
                {feature.shortTitle}
              </h3>
            </div>

            <div>
              <p className="text-lg font-semibold text-white">
                What you can do
              </p>
              <div className="mt-3 border-t border-white/18">
                {feature.highlights.slice(0, 3).map((highlight) => (
                  <div
                    key={highlight}
                    className="flex items-start gap-3 border-b border-white/18 py-4 text-sm leading-6 font-medium text-white/74 sm:text-base"
                  >
                    <span
                      className="mt-2 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: feature.accent }}
                      aria-hidden
                    />
                    {highlight}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="max-w-lg border-t border-white/14 pt-5 text-sm leading-6 font-semibold text-white/66 sm:text-base">
            {feature.promise}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function FeatureDeck() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const reducedMotion = useReducedMotion();
  const active = marketingFeatures[activeIndex];

  const setIndex = useCallback((nextIndex: number) => {
    const current = activeIndexRef.current;
    if (current === nextIndex) return;
    setDirection(nextIndex > current ? 1 : -1);
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
  }, []);

  const move = useCallback(
    (nextDirection: 1 | -1) => {
      const nextIndex = Math.min(
        marketingFeatures.length - 1,
        Math.max(0, activeIndex + nextDirection),
      );
      if (nextIndex === activeIndex) return;
      setIndex(nextIndex);
      carouselRef.current?.scrollTo({
        left: nextIndex * carouselRef.current.clientWidth,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [activeIndex, reducedMotion, setIndex],
  );

  const goTo = useCallback(
    (nextIndex: number) => {
      setIndex(nextIndex);
      carouselRef.current?.scrollTo({
        left: nextIndex * carouselRef.current.clientWidth,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [reducedMotion, setIndex],
  );

  const updateFromScroll = useCallback(() => {
    const carousel = carouselRef.current;
    if (!carousel || carousel.clientWidth === 0) return;
    const nextIndex = Math.min(
      marketingFeatures.length - 1,
      Math.max(0, Math.round(carousel.scrollLeft / carousel.clientWidth)),
    );
    setIndex(nextIndex);
  }, [setIndex]);

  return (
    <section className="bg-background relative overflow-hidden border-b py-20 sm:py-28 lg:py-32">
      <div className="relative flex min-h-[calc(100svh-3.5rem)] items-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 transition-[background] duration-700"
          style={{
            background: `radial-gradient(circle at 78% 48%, color-mix(in srgb, ${active.accent} 12%, transparent), transparent 35%)`,
          }}
        />

        <div className="marketing-container relative grid w-full items-center gap-8 lg:grid-cols-[.78fr_1.22fr] lg:gap-16">
          <div className="hidden lg:block">
            <p className="type-label text-[var(--sg-accent-strong)]">
              Everything in one place
            </p>
            <h2 className="type-h2 mt-4 max-w-lg">
              A content creation app built around your whole process.
            </h2>
            <p className="type-description mt-5 max-w-md">
              Yapper brings your content creator tools together, from the first
              voice note to the scheduled social media post.
            </p>

            <div className="mt-9 h-[220px]">
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={active.slug}
                  custom={direction}
                  initial={
                    reducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, x: direction * 14 }
                  }
                  animate={{ opacity: 1, x: 0 }}
                  exit={
                    reducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, x: direction * -10 }
                  }
                  transition={{
                    duration: reducedMotion ? 0.01 : 0.3,
                    ease: EASE,
                  }}
                >
                  <h3 className="type-h3">{active.title}</h3>
                  <p className="type-description mt-3 max-w-md text-sm">
                    {active.description}
                  </p>
                  <Button asChild variant="link" className="mt-3 h-auto px-0">
                    <Link href={`/features/${active.slug}`}>
                      Explore {active.shortTitle.toLowerCase()}
                      <ArrowRight />
                    </Link>
                  </Button>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => move(-1)}
                disabled={activeIndex === 0}
                aria-label="Previous feature"
              >
                <ArrowLeft />
              </Button>
              <Button
                type="button"
                variant="contrast"
                size="icon"
                onClick={() => move(1)}
                disabled={activeIndex === marketingFeatures.length - 1}
                aria-label="Next feature"
              >
                <ArrowRight />
              </Button>
              <div className="ml-2 flex items-center gap-1.5">
                {marketingFeatures.map((feature, index) => (
                  <button
                    type="button"
                    key={feature.slug}
                    className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${
                      index === activeIndex
                        ? "bg-foreground w-8"
                        : "bg-border w-1.5"
                    }`}
                    onClick={() => goTo(index)}
                    aria-label={`Go to ${feature.shortTitle}`}
                    aria-current={index === activeIndex ? "true" : undefined}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-4 lg:hidden">
              <p className="type-label text-[var(--sg-accent-strong)]">
                Scroll through Yapper
              </p>
              <h2 className="type-h3 mt-2">Every tool stays connected.</h2>
            </div>
            <div
              ref={carouselRef}
              className="mx-auto flex h-[500px] w-full max-w-[650px] min-w-0 snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none sm:h-[560px] [&::-webkit-scrollbar]:hidden"
              tabIndex={0}
              role="region"
              aria-roledescription="carousel"
              aria-label="Yapper features"
              style={{ scrollbarWidth: "none" }}
              onScroll={updateFromScroll}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") move(1);
                if (event.key === "ArrowLeft") move(-1);
              }}
            >
              {marketingFeatures.map((feature, index) => (
                <FeatureCard
                  key={feature.slug}
                  feature={feature}
                  index={index}
                />
              ))}
            </div>

            <div className="mt-5 flex items-center justify-center gap-3 lg:hidden">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => move(-1)}
                disabled={activeIndex === 0}
                aria-label="Previous feature"
              >
                <ArrowLeft />
              </Button>
              <p className="text-muted-foreground min-w-16 text-center text-sm font-semibold">
                {activeIndex + 1} / {marketingFeatures.length}
              </p>
              <Button
                type="button"
                variant="contrast"
                size="icon"
                onClick={() => move(1)}
                disabled={activeIndex === marketingFeatures.length - 1}
                aria-label="Next feature"
              >
                <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
