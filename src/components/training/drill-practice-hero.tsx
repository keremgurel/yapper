"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GlassyButton } from "@/components/ui/glassy-button";

export default function DrillPracticeHero({
  titleTop,
  titleBottom,
  description,
  onJumpToPractice,
}: {
  eyebrow?: string;
  titleTop: string;
  titleBottom: string;
  description: string;
  onJumpToPractice: () => void;
}) {
  const title = `${titleTop} ${titleBottom}`;
  return (
    <section className="training-hero marketing-container">
      <Link href="/training" className="training-back">
        <ArrowLeft size={14} />
        All speaking exercises
      </Link>
      <div className="training-hero-row">
        <div>
          <h1 className="type-h1">
            {title.charAt(0) + title.slice(1).toLowerCase()}
          </h1>
          <p className="type-description">{description}</p>
        </div>
        <GlassyButton onClick={onJumpToPractice} height={46}>
          Start practicing
        </GlassyButton>
      </div>
      <p className="marketing-note">
        Free practice. Camera and microphone are optional.
      </p>
    </section>
  );
}
