"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import DemoBackdrop from "@/components/marketing/demo-backdrop";
import DemoDictation from "@/components/marketing/demo-dictation";
import EditProgressPreview from "@/components/marketing/edit-progress-preview";
import {
  PublishingFilm,
  RecordingFilm,
  ScriptFilm,
} from "@/components/marketing/feature-scenes";
import { useDemoPlayback } from "@/components/marketing/use-demo-playback";
import { Button } from "@/components/ui/button";
import StudioCtaButton from "@/components/marketing/studio-cta-button";
import styles from "./deck.module.css";

const IDEA =
  "I want to make a video about how I kept putting off my first post because I thought I needed a better camera.";

interface Step {
  href: string;
  link: string;
  title: string;
  text: string;
  palette: "blue" | "peach";
  frames: number;
  film: (frame: number, playing: boolean) => ReactNode;
}

// A real sequence: each step hands its output to the next.
const STEPS: Step[] = [
  {
    href: "/features/idea-capture",
    link: "Idea capture",
    title: "Capture the idea",
    text: "Say it, type it, or drop a link. Studio keeps the original and files it where you will find it.",
    palette: "blue",
    frames: 6,
    film: (frame, playing) => (
      <DemoDictation
        text={IDEA.split(" ")
          .slice(0, frame * 5)
          .join(" ")}
        active={playing && frame > 0 && frame < 5}
        saved={frame >= 5}
        frame={frame}
      />
    ),
  },
  {
    href: "/features/ai-script-writer",
    link: "AI script writer",
    title: "Write the script",
    text: "Chirpy turns the idea into a hook and a script you can actually say out loud.",
    palette: "peach",
    frames: 7,
    film: (frame, playing) => <ScriptFilm frame={frame} playing={playing} />,
  },
  {
    href: "/features/teleprompter-recorder",
    link: "Teleprompter recorder",
    title: "Record with a teleprompter",
    text: "The script scrolls at your pace while you look at the lens.",
    palette: "blue",
    frames: 6,
    film: (frame, playing) => <RecordingFilm frame={frame} playing={playing} />,
  },
  {
    href: "/features/transcript-video-editor",
    link: "Transcript video editor",
    title: "Edit by transcript",
    text: "Delete words to cut the video. One click removes the retakes and the dead air.",
    palette: "peach",
    frames: 6,
    film: (frame, playing) => (
      <EditProgressPreview frame={frame} playing={playing} />
    ),
  },
  {
    href: "/features/social-publishing",
    link: "Social publishing",
    title: "Caption and publish",
    text: "Timed captions, a thumbnail, and a post prepared for each platform.",
    palette: "blue",
    frames: 7,
    film: (frame) => <PublishingFilm frame={frame} />,
  },
];

function DeckCard({ step, index }: { step: Step; index: number }) {
  const { ref, frame, active } = useDemoPlayback(step.frames);
  return (
    <li className={styles.card} style={{ ["--i" as string]: index }}>
      <div className={styles.copy}>
        <p className={styles.count}>
          Step {index + 1} of {STEPS.length}
        </p>
        <h3>{step.title}</h3>
        <p className={styles.text}>{step.text}</p>
        <Link href={step.href} className={styles.link}>
          {step.link}
        </Link>
      </div>
      <div className={styles.stage} ref={ref}>
        <DemoBackdrop palette={step.palette} />
        <div className={styles.film} inert aria-hidden="true">
          {step.film(frame, active)}
        </div>
      </div>
    </li>
  );
}

/**
 * The Studio workflow as a deck: scroll, and each step slides up and settles
 * on top of the one before, leaving the earlier steps' edges showing. Every
 * card plays the small film of its own stage.
 */
export default function StudioDeck() {
  return (
    <section className="marketing-section marketing-rule">
      <div className="marketing-container">
        <div className={styles.intro}>
          <h2 className="type-h2">
            A talking video, from the idea to the post
          </h2>
          <p className="type-description">
            Yapper Studio keeps the idea, the script, the take and the post in
            one place, so nothing is retyped or re-uploaded between tools. Try
            it free for 7 days.
          </p>
        </div>
        <ol className={styles.deck}>
          {STEPS.map((step, index) => (
            <DeckCard key={step.href} step={step} index={index} />
          ))}
        </ol>
        <div className={styles.actions}>
          <StudioCtaButton />
          <Button asChild variant="outline">
            <Link href="/">How Studio works</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
