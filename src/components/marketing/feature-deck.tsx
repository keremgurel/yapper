"use client";

import { useCallback, useState } from "react";
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
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";

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

const PREMIUM_EASE = [0.22, 1, 0.36, 1] as const;

function FeatureCard({
  feature,
  onDismiss,
  direction,
}: {
  feature: MarketingFeature;
  onDismiss: (direction: 1 | -1) => void;
  direction: 1 | -1;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-320, 0, 320], [-7, 0, 7]);
  const opacity = useTransform(x, [-360, -100, 0, 100, 360], [0, 1, 1, 1, 0]);
  const reducedMotion = useReducedMotion();
  const Icon = ICONS[feature.slug] ?? WandSparkles;

  return (
    <motion.div
      className="absolute inset-0 cursor-grab touch-pan-y select-none active:cursor-grabbing"
      style={{ x, rotate, opacity, transformOrigin: "50% 110%" }}
      initial={reducedMotion ? false : { y: 24, scale: 0.97 }}
      animate={{ y: 0, scale: 1 }}
      exit={
        reducedMotion
          ? { scale: 0.99 }
          : {
              x: direction > 0 ? -520 : 520,
              y: 42,
              rotate: direction > 0 ? -9 : 9,
            }
      }
      transition={{ duration: reducedMotion ? 0.01 : 0.48, ease: PREMIUM_EASE }}
      drag={reducedMotion ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.18}
      onDragEnd={(_, info) => {
        if (info.offset.x < -95 || info.velocity.x < -520) onDismiss(1);
        else if (info.offset.x > 95 || info.velocity.x > 520) onDismiss(-1);
      }}
    >
      <div className="relative h-full overflow-hidden rounded-[30px] border border-white/15 bg-[#111214] shadow-[0_34px_90px_rgba(0,0,0,.42)] sm:rounded-[38px]">
        <div
          aria-hidden
          className="absolute inset-0 opacity-80"
          style={{
            background: `radial-gradient(circle at 18% 12%, ${feature.accent} 0, transparent 36%), radial-gradient(circle at 88% 84%, color-mix(in srgb, ${feature.accent} 55%, #22d3ee) 0, transparent 40%)`,
          }}
        />
        <div className="absolute inset-[1px] rounded-[29px] bg-[linear-gradient(145deg,rgba(255,255,255,.14),transparent_22%,rgba(0,0,0,.3)_70%)] sm:rounded-[37px]" />
        <span className="absolute -right-3 -bottom-16 font-mono text-[11rem] leading-none font-black tracking-[-.12em] text-white/[.055] sm:text-[15rem]">
          {feature.number}
        </span>

        <div className="relative flex h-full flex-col p-5 sm:p-7">
          <div className="flex items-center justify-between border-b border-white/12 pb-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <span className="font-mono text-[10px] font-bold tracking-[.16em] text-white/50 uppercase">
              Yapper instrument {feature.number}
            </span>
          </div>

          <div className="grid min-h-0 flex-1 items-center gap-5 py-5 sm:grid-cols-[.72fr_1.28fr] sm:gap-7 sm:py-7">
            <div className="flex items-center gap-4 sm:block">
              <span
                className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_16px_40px_rgba(0,0,0,.25)] sm:h-24 sm:w-24 sm:rounded-[28px]"
                style={{
                  background: `color-mix(in srgb, ${feature.accent} 72%, #0a0a0b)`,
                }}
              >
                <Icon className="h-7 w-7 sm:h-10 sm:w-10" strokeWidth={1.7} />
              </span>
              <div className="sm:mt-5">
                <p className="text-[10px] font-black tracking-[.18em] text-white/55 uppercase">
                  {feature.eyebrow}
                </p>
                <h3 className="font-display mt-1 text-2xl leading-[1] font-black tracking-[-.045em] text-white sm:text-4xl">
                  {feature.shortTitle}
                </h3>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/12 bg-black/35 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-md sm:rounded-[26px] sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[9px] font-bold tracking-[.16em] text-white/40 uppercase">
                  Connected workflow
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.8)]" />
              </div>
              <div className="space-y-2">
                {feature.highlights.slice(0, 3).map((highlight, index) => (
                  <div
                    key={highlight}
                    className="flex items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.055] px-3 py-2.5 text-[11px] font-semibold text-white/75 sm:text-xs"
                  >
                    <span
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-md font-mono text-[8px] font-black text-black"
                      style={{ background: feature.accent }}
                    >
                      {index + 1}
                    </span>
                    {highlight}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between gap-4 border-t border-white/12 pt-4">
            <p className="max-w-sm text-xs leading-5 font-semibold text-white/65 sm:text-sm">
              {feature.promise}
            </p>
            <span className="shrink-0 font-mono text-[9px] font-bold tracking-[.14em] text-white/40 uppercase">
              Drag to change
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function FeatureDeck() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const reducedMotion = useReducedMotion();
  const active = marketingFeatures[activeIndex];

  const move = useCallback((nextDirection: 1 | -1) => {
    setDirection(nextDirection);
    setActiveIndex(
      (current) =>
        (current + nextDirection + marketingFeatures.length) %
        marketingFeatures.length,
    );
  }, []);

  const waiting = [1, 2].map(
    (offset) =>
      marketingFeatures[(activeIndex + offset) % marketingFeatures.length],
  );

  return (
    <section className="relative overflow-x-clip border-b py-24 sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50 transition-[background] duration-700"
        style={{
          background: `radial-gradient(circle at 78% 50%, color-mix(in srgb, ${active.accent} 12%, transparent), transparent 34%)`,
        }}
      />
      <div className="relative mx-auto grid max-w-[1200px] items-center gap-16 px-4 sm:px-6 lg:grid-cols-[.78fr_1.22fr] lg:gap-20">
        <div>
          <p className="text-xs font-black tracking-[.18em] text-[color:var(--sg-accent)] uppercase">
            Inside Yapper
          </p>
          <h2 className="font-display text-foreground mt-4 max-w-lg text-[clamp(2.75rem,5vw,5.2rem)] leading-[.92] font-black tracking-[-.055em]">
            Every tool knows what came before.
          </h2>
          <p className="text-muted-foreground mt-6 max-w-md text-[15px] leading-7">
            Swipe through one connected creative system. Every step carries the
            original idea, your context, and the work you already finished into
            what comes next.
          </p>

          <div className="mt-10 min-h-[220px]" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.slug}
                initial={
                  reducedMotion
                    ? false
                    : { y: 16, opacity: 0, filter: "blur(10px)" }
                }
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={
                  reducedMotion
                    ? { opacity: 0 }
                    : { y: -8, opacity: 0, filter: "blur(6px)" }
                }
                transition={{
                  duration: reducedMotion ? 0.01 : 0.42,
                  ease: PREMIUM_EASE,
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="font-mono text-xs font-black"
                    style={{ color: active.accent }}
                  >
                    {active.number}
                  </span>
                  <span className="bg-border h-px w-10" />
                  <span className="text-muted-foreground text-[10px] font-black tracking-[.16em] uppercase">
                    {active.eyebrow}
                  </span>
                </div>
                <h3 className="text-foreground mt-4 text-2xl leading-tight font-black tracking-[-.025em] sm:text-3xl">
                  {active.title}
                </h3>
                <p className="text-muted-foreground mt-3 max-w-md text-sm leading-6">
                  {active.description}
                </p>
                <Link
                  href={`/features/${active.slug}`}
                  className="text-foreground mt-5 inline-flex items-center gap-2 text-sm font-black no-underline"
                >
                  Explore {active.shortTitle.toLowerCase()}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Previous feature"
              className="border-border bg-card text-foreground hover:bg-muted grid h-11 w-11 place-items-center rounded-full border transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Next feature"
              className="bg-foreground text-background grid h-11 w-11 place-items-center rounded-full transition-transform hover:scale-[1.04]"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
            <div className="ml-2 flex flex-1 items-center gap-1.5">
              {marketingFeatures.map((feature, index) => (
                <button
                  key={feature.slug}
                  type="button"
                  aria-label={`Show ${feature.shortTitle}`}
                  aria-current={index === activeIndex ? "true" : undefined}
                  onClick={() => {
                    setDirection(index > activeIndex ? 1 : -1);
                    setActiveIndex(index);
                  }}
                  className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${index === activeIndex ? "bg-foreground w-8" : "bg-border w-1.5"}`}
                />
              ))}
            </div>
            <span className="text-muted-foreground font-mono text-[11px] font-bold">
              {String(activeIndex + 1).padStart(2, "0")} /{" "}
              {String(marketingFeatures.length).padStart(2, "0")}
            </span>
          </div>
        </div>

        <div
          className="relative mx-auto h-[470px] w-full max-w-[650px] outline-none sm:h-[540px]"
          tabIndex={0}
          role="region"
          aria-label="Yapper features. Swipe the card or use the arrow keys."
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
                className="absolute inset-x-3 top-0 bottom-0 rounded-[30px] border border-white/10 bg-[#161719] shadow-2xl transition-transform duration-500 sm:inset-x-5 sm:rounded-[38px]"
                style={{
                  transform: `translateY(${depth * 17}px) scale(${1 - depth * 0.035}) rotate(${depth % 2 === 0 ? -1.2 : 1.2}deg)`,
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
              onDismiss={move}
            />
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
