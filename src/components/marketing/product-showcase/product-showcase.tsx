"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { AudioLines, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import StudioCtaButton from "@/components/marketing/studio-cta-button";
import GlassTabs from "../glass-tabs";
import StudioWalkthrough from "./studio-walkthrough";
import TrainWalkthrough from "./train-walkthrough";
import styles from "./product-showcase.module.css";

const PRODUCTS = [
  {
    key: "train",
    tab: "Train",
    heading: "Practice speaking before it counts.",
    description:
      "Pick an exercise, speak against a timer, and get feedback on how it went. Practice is free and needs no account.",
    primary: {
      label: "Try the random topic generator",
      href: "/training/random-topic-generator",
    },
    secondary: { label: "How Train works", href: "/products/train" },
    Demo: TrainWalkthrough,
  },
  {
    key: "studio",
    tab: "Studio",
    heading: "One place for the whole video.",
    description:
      "Save an idea, script it, record with a teleprompter, edit by transcript and publish. Try it free for 7 days.",
    primary: {
      label: "Start your free trial",
      href: "/pricing",
    },
    secondary: { label: "How Studio works", href: "/" },
    Demo: StudioWalkthrough,
  },
] as const;

const TABS = [
  { value: "train", label: "Train", Icon: AudioLines },
  { value: "studio", label: "Studio", Icon: Clapperboard },
] as const;

/**
 * The homepage's product switch: Train or Studio, each with one walkthrough.
 * Both panels stay in the document so their links are always crawlable; the
 * hidden one's demo is off screen and therefore paused.
 */
export default function ProductShowcase() {
  const id = useId();
  const [selected, setSelected] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  /** Bring the chosen demo fully into view: the tabs just under the header
   * when everything fits, otherwise the whole demo with the tabs above it. */
  const reveal = () => {
    const node = root.current;
    const demo = node?.querySelector<HTMLElement>(
      '[role="tabpanel"]:not([hidden]) .demo-field',
    );
    if (!node || !demo) return;
    const header =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--site-header",
        ),
      ) || 0;
    const gap = 12;
    const tabs = node.getBoundingClientRect().top;
    const bottom = demo.getBoundingClientRect().bottom;
    if (tabs >= header && bottom <= window.innerHeight) return;
    // Lift the tabs to the header, then further only if the demo still runs
    // off the bottom of the screen.
    const shift = Math.max(
      tabs - header - gap,
      bottom - (window.innerHeight - gap),
    );
    window.scrollTo({
      top:
        window.scrollY +
        Math.min(shift, demo.getBoundingClientRect().top - header - gap),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  return (
    <div ref={root} className={styles.showcase}>
      <GlassTabs
        tabs={TABS}
        value={PRODUCTS[selected].key}
        onChange={(key) => {
          setSelected(PRODUCTS.findIndex((product) => product.key === key));
          // After the panel switches, so the measurement is of the new demo.
          requestAnimationFrame(reveal);
        }}
        panelId={(key) => `${id}-panel-${key}`}
        id={`${id}-tab`}
        label="Yapper products"
        className="product-tabs"
      />
      {PRODUCTS.map(({ Demo, ...product }, index) => (
        <div
          key={product.key}
          role="tabpanel"
          id={`${id}-panel-${product.key}`}
          aria-labelledby={`${id}-tab-${product.key}`}
          hidden={selected !== index}
        >
          <Demo />
          <div className={styles.caption}>
            <div>
              <h2 className="type-h3">{product.heading}</h2>
              <p className="type-description">{product.description}</p>
            </div>
            <div className={styles.actions}>
              {product.key === "studio" ? (
                <StudioCtaButton size="lg" />
              ) : (
                <Button asChild size="lg">
                  <Link href={product.primary.href}>
                    {product.primary.label}
                  </Link>
                </Button>
              )}
              <Button asChild size="lg" variant="outline">
                <Link href={product.secondary.href}>
                  {product.secondary.label}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
