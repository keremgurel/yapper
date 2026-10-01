"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { useDemoPlayback } from "./use-demo-playback";

const words = ["Start", "with", "what", "you", "have."];
export default function CaptionsPreview() {
  const { ref, frame } = useDemoPlayback(10, 900);
  return (
    <div
      ref={ref}
      className="captions-only-demo"
      role="img"
      aria-label="Automatic captions demonstration: transcript words appear in sync on a vertical video."
    >
      <div className="captions-demo-settings" aria-hidden="true">
        <h2>Captions that follow your voice.</h2>
        <p>Word-level timing from your transcript.</p>
        <div className="caption-timed-words">
          {words.map((word, i) => (
            <span key={word} data-current={frame % words.length === i}>
              <time>00:0{i}</time>
              {word}
            </span>
          ))}
        </div>
        <div className="captions-demo-ready">
          <Check size={15} />
          Captions generated
        </div>
      </div>
      <div className="captions-demo-video" aria-hidden="true">
        <Image
          src="/images/marketing/creator-studio.webp"
          alt=""
          fill
          sizes="320px"
        />
        <p>
          {words.map((word, i) => (
            <span key={word} data-current={frame % words.length === i}>
              {word}{" "}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
