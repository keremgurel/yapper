"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { AudioLines, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      "Save an idea, script it, record with a teleprompter, edit by transcript and publish. Studio is in private beta.",
    primary: {
      label: "Apply for the Studio beta",
      href: "/products/studio#waitlist",
    },
    secondary: { label: "How Studio works", href: "/products/studio" },
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
  return (
    <div className={styles.showcase}>
      <GlassTabs
        tabs={TABS}
        value={PRODUCTS[selected].key}
        onChange={(key) =>
          setSelected(PRODUCTS.findIndex((product) => product.key === key))
        }
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
              <Button asChild size="lg">
                <Link href={product.primary.href}>{product.primary.label}</Link>
              </Button>
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
