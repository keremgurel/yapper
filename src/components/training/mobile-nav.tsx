"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CreditCard,
  HeartHandshake,
  Library,
  Layers3,
  Menu,
  Shuffle,
  Users,
  Volume2,
  X,
} from "lucide-react";

import { trainingNavDropdownItems } from "@/data/training";
import { marketingFeatures } from "@/data/marketing-features";

// Mirrors the motion tokens in globals.css (--sg-ease-out, --sg-dur-base);
// framer-motion needs numbers, not CSS variables.
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const DUR_BASE = 0.24;

type Icon = ComponentType<{ className?: string }>;

const resourceIcon: Record<string, Icon> = {
  "Random topic generator": Shuffle,
  "Read aloud": Volume2,
  "Explain after reading": BookOpen,
  "Interview prep": BriefcaseBusiness,
  "Conflict handling": HeartHandshake,
  "Dating/social practice": Users,
};

function Row({
  href,
  title,
  icon,
  onNavigate,
  variants,
}: {
  href: string;
  title: string;
  icon: React.ReactNode;
  onNavigate: () => void;
  variants: Variants;
}) {
  return (
    <motion.div variants={variants}>
      <Link
        href={href}
        onClick={onNavigate}
        className="group hover:bg-muted flex items-center gap-3 rounded-2xl p-2.5 no-underline transition-colors"
      >
        <span className="bg-muted text-foreground/75 group-hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors">
          {icon}
        </span>
        <span className="text-foreground flex-1 text-[14px] font-bold">
          {title}
        </span>
        <ArrowRight className="text-foreground/25 group-hover:text-foreground h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
      </Link>
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground px-2.5 pt-2 pb-1 text-[11px] font-bold tracking-[0.1em] uppercase">
      {children}
    </p>
  );
}

/**
 * The mobile navbar IS the menu: the hamburger sits in the header's top row and
 * clicking it reveals a single rounded panel beneath the bar with the Training
 * and Create links, coglyde-style. The reveal is transform and opacity only,
 * and collapses to nothing under prefers-reduced-motion.
 */
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const reduceMotion = useReducedMotion();

  const listVariants: Variants = {
    hidden: {},
    show: reduceMotion
      ? {}
      : { transition: { staggerChildren: 0.025, delayChildren: 0.05 } },
  };
  const itemVariants: Variants = reduceMotion
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0, y: 6 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: DUR_BASE, ease: EASE_OUT },
        },
      };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="border-border bg-card text-foreground hover:bg-muted flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {open ? (
          <motion.button
            aria-hidden
            tabIndex={-1}
            onClick={close}
            className="fixed inset-0 z-40 cursor-default bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : DUR_BASE }}
          />
        ) : null}
      </AnimatePresence>

      {/* Panel below the header. Slides and fades; never animates layout. */}
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="panel"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{
              duration: reduceMotion ? 0 : DUR_BASE,
              ease: EASE_OUT,
            }}
            style={{ boxShadow: "var(--sg-shadow-panel)" }}
            className="border-border bg-card absolute inset-x-0 top-full z-50 overflow-hidden rounded-b-3xl border-b"
          >
            <motion.div
              variants={listVariants}
              initial="hidden"
              animate="show"
              className="no-scrollbar max-h-[72vh] space-y-0.5 overflow-y-auto p-3"
            >
              <SectionLabel>Features</SectionLabel>
              {marketingFeatures.map((item) => (
                <Row
                  key={`f-${item.slug}`}
                  href={`/features/${item.slug}`}
                  title={item.shortTitle}
                  icon={<Layers3 className="h-4 w-4" />}
                  onNavigate={close}
                  variants={itemVariants}
                />
              ))}

              <div className="border-border/60 my-2 border-t" />

              <SectionLabel>Training</SectionLabel>
              {trainingNavDropdownItems.map((item) => (
                <Row
                  key={`r-${item.href}`}
                  href={item.href}
                  title={item.title}
                  icon={(() => {
                    const I = resourceIcon[item.title] ?? Library;
                    return <I className="h-4 w-4" />;
                  })()}
                  onNavigate={close}
                  variants={itemVariants}
                />
              ))}
              <Row
                href="/training"
                title="All practice tools"
                icon={<Library className="h-4 w-4" />}
                onNavigate={close}
                variants={itemVariants}
              />

              <div className="border-border/60 my-2 border-t" />

              <Row
                href="/pricing"
                title="Pricing"
                icon={<CreditCard className="h-4 w-4" />}
                onNavigate={close}
                variants={itemVariants}
              />
              <Row
                href="/blog"
                title="Blog"
                icon={<BookOpen className="h-4 w-4" />}
                onNavigate={close}
                variants={itemVariants}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
