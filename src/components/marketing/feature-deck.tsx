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
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";

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
  direction,
  onSwipe,
}: {
  feature: MarketingFeature;
  direction: 1 | -1;
  onSwipe: (direction: 1 | -1) => void;
}) {
  const reducedMotion = useReducedMotion();
  const Icon = ICONS[feature.slug] ?? WandSparkles;

  return (
    <motion.div
      className="absolute inset-0 cursor-grab touch-pan-y select-none active:cursor-grabbing"
      initial={
        reducedMotion
          ? false
          : { x: direction * 80, y: 20, rotate: direction * 2.5, opacity: 0 }
      }
      animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
      exit={
        reducedMotion
          ? { opacity: 0 }
          : {
              x: direction * -180,
              y: 46,
              rotate: direction * -5,
              opacity: 0,
            }
      }
      transition={{ duration: reducedMotion ? 0.01 : 0.56, ease: EASE }}
      drag={reducedMotion ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.14}
      onDragEnd={(_, info) => {
        if (info.offset.x < -90 || info.velocity.x < -520) onSwipe(1);
        if (info.offset.x > 90 || info.velocity.x > 520) onSwipe(-1);
      }}
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
    </motion.div>
  );
}

export default function FeatureDeck() {
  const sectionRef = useRef<HTMLElement>(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const active = marketingFeatures[activeIndex];
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

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

      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const sectionTop = window.scrollY + rect.top;
      const scrollableDistance = section.offsetHeight - window.innerHeight;
      window.scrollTo({
        top:
          sectionTop +
          (nextIndex / (marketingFeatures.length - 1)) * scrollableDistance,
        behavior: "smooth",
      });
    },
    [activeIndex, setIndex],
  );

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const nextIndex = Math.min(
      marketingFeatures.length - 1,
      Math.round(latest * (marketingFeatures.length - 1)),
    );
    setIndex(nextIndex);
  });

  const waiting = [1, 2]
    .map((offset) => marketingFeatures[activeIndex + offset])
    .filter(Boolean);

  return (
    <section
      ref={sectionRef}
      className="bg-background relative border-b"
      style={{ height: `${marketingFeatures.length * 58 + 100}svh` }}
    >
      <div className="sticky top-14 flex h-[calc(100svh-3.5rem)] items-center overflow-hidden py-6 sm:py-10">
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

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.slug}
                className="mt-9 min-h-[185px]"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.34, ease: EASE }}
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
                  <span
                    key={feature.slug}
                    className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${
                      index === activeIndex
                        ? "bg-foreground w-8"
                        : "bg-border w-1.5"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-4 lg:hidden">
              <p className="type-label text-[var(--sg-accent-strong)]">
                Scroll through Yapper
              </p>
              <h2 className="type-h3 mt-2">Every tool stays connected.</h2>
            </div>
            <div
              className="relative mx-auto h-[500px] w-full max-w-[650px] outline-none sm:h-[560px]"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") move(1);
                if (event.key === "ArrowLeft") move(-1);
              }}
            >
              {[...waiting].reverse().map((feature, reverseIndex) => {
                const depth = waiting.length - reverseIndex;
                return (
                  <div
                    key={feature.slug}
                    aria-hidden
                    className="absolute inset-x-3 inset-y-0 rounded-[28px] border border-white/10 bg-[#171719] shadow-2xl transition-transform duration-500 sm:inset-x-5 sm:rounded-[36px]"
                    style={{
                      transform: `translateY(${depth * 15}px) scale(${1 - depth * 0.034}) rotate(${depth % 2 === 0 ? -0.8 : 0.8}deg)`,
                      opacity: 1 - depth * 0.18,
                    }}
                  />
                );
              })}

              <AnimatePresence initial={false} custom={direction}>
                <FeatureCard
                  key={active.slug}
                  feature={active}
                  direction={direction}
                  onSwipe={move}
                />
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
