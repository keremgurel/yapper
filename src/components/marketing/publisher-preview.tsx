"use client";

import { useId, useState, type CSSProperties } from "react";
import Image from "next/image";
import { Check, ArrowUpRight, RotateCcw, Send, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { ThinkingOrb } from "thinking-orbs";
import { BorderBeam } from "border-beam";
import PlatformIcon from "@/components/publish/platform-icon";
import { useDemoPlayback } from "./use-demo-playback";

const destinations = [
  {
    platform: "youtube" as const,
    name: "YouTube Shorts",
    title: "Your first video doesn’t need a new camera",
    caption:
      "One idea. Your phone. Sixty seconds. Here’s how I finally started.",
    tag: "#creatortips",
  },
  {
    platform: "instagram" as const,
    name: "Instagram Reels",
    title: "",
    caption:
      "The camera wasn’t holding me back. Waiting to feel ready was. Save this for your first take.",
    tag: "#startcreating",
  },
  {
    platform: "tiktok" as const,
    name: "TikTok",
    title: "",
    caption:
      "POV: you stop researching cameras and finally hit record. Your phone is enough.",
    tag: "#firstvideo",
  },
];

/** A scripted walkthrough of the poster. Never connects accounts or sends posts. */
export function PublishingScene({
  frame,
  playing,
  compact = false,
  onSeek,
}: {
  frame: number;
  playing: boolean;
  compact?: boolean;
  onSeek?: (frame: number) => void;
}) {
  const id = useId();
  const { resolvedTheme } = useTheme();
  const generating = frame >= 1 && frame < 4;
  const written = frame >= 4;
  const remixing = frame >= 5 && frame < 8;
  const remixed = frame >= 8;
  const preparing = frame >= 10 && frame < 12;
  const sent = frame >= 12;
  const label = sent
    ? "Ready for your next idea"
    : preparing
      ? "Preparing your posts"
      : remixing
        ? "Remixing your cover"
        : generating
          ? "Writing for each audience"
          : written
            ? "One video. Three destinations."
            : "Give every post its own voice.";
  return (
    <div
      className={`publisher-demo${compact ? "publisher-demo-compact" : ""}`}
      data-frame={frame}
      data-playing={playing}
      aria-describedby={id}
    >
      <p id={id} className="sr-only">
        Interactive publishing demonstration using sample content. No posts are
        sent.
      </p>
      <div className="publisher-demo-copy">
        <div className="publisher-demo-heading">
          <div>
            <span>Publish</span>
            <h3>{label}</h3>
          </div>
          <button
            type="button"
            className="publisher-replay"
            aria-label="Replay publishing demo"
            onClick={() => onSeek?.(0)}
          >
            <RotateCcw size={15} />
          </button>
        </div>
        <div className="publisher-destinations">
          {destinations.map((destination, i) => (
            <div
              className="publisher-destination"
              key={destination.platform}
              data-ready={written}
            >
              <div className="publisher-destination-heading">
                <PlatformIcon
                  platform={destination.platform}
                  branded
                  className="h-4 w-4"
                />
                <strong>{destination.name}</strong>
                <span>
                  {sent ? <Check size={14} /> : written ? "Ready" : "Draft"}
                </span>
              </div>
              <div
                className="publisher-destination-copy"
                data-written={written}
                style={{ "--reveal-delay": `${i * 90}ms` } as CSSProperties}
              >
                {written ? (
                  <>
                    {destination.title && <strong>{destination.title}</strong>}
                    <p>
                      {destination.caption} <span>{destination.tag}</span>
                    </p>
                  </>
                ) : (
                  <div
                    className="publisher-skeleton"
                    aria-label="Waiting for generated copy"
                  >
                    <i />
                    <i />
                    <i />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="publisher-copy-action">
          {generating ? (
            <>
              <ThinkingOrb state="composing" size={32} paused={!playing} />
              <span>Generating titles and captions</span>
            </>
          ) : written ? (
            <>
              <Check size={15} />
              <span>Tailored to each platform</span>
            </>
          ) : (
            <button type="button" onClick={() => onSeek?.(1)}>
              <Sparkles size={15} />
              Generate titles and captions
              <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="publisher-demo-delivery">
        <div className="publisher-cover" data-remixed={remixed}>
          <Image
            src="/images/marketing/creator-studio.webp"
            alt="Creator speaking to camera"
            fill
            sizes="(max-width: 640px) 360px, 460px"
          />
          <span className="publisher-cover-type">
            {remixed ? "Your new cover" : "Video cover"}
          </span>
          <div className="publisher-cover-title" data-visible={remixed}>
            <span>YOUR PHONE</span>
            <strong>is enough.</strong>
            <small>Start creating · 01:30</small>
          </div>
          {remixing && (
            <div className="publisher-remix-glass">
              <ThinkingOrb state="composing" size={32} paused={!playing} />
              <span>Remixing your thumbnail</span>
            </div>
          )}
          {!remixed && !remixing && (
            <button
              type="button"
              className="publisher-remix-glass"
              onClick={() => onSeek?.(5)}
            >
              <Sparkles size={14} />
              Remix thumbnail
            </button>
          )}
        </div>
        <div className="publisher-send-stage" data-sent={sent}>
          <div className="publisher-flights" aria-hidden="true">
            {destinations.map((destination, i) => (
              <span
                key={destination.platform}
                style={
                  {
                    "--flight-x": `${(i - 1) * 94}px`,
                    "--flight-y": `${i === 1 ? -116 : -84}px`,
                    "--flight-turn": `${(i - 1) * 12}deg`,
                  } as CSSProperties
                }
              >
                <PlatformIcon
                  platform={destination.platform}
                  branded
                  className="h-5 w-5"
                />
                <i>
                  <Check size={9} />
                </i>
              </span>
            ))}
          </div>
          <BorderBeam
            size="sm"
            colorVariant="ocean"
            active={playing && preparing}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            strength={0.6}
          >
            <button
              type="button"
              className="publisher-send"
              data-pressed={frame === 10}
              disabled={!remixed || preparing || sent}
              onClick={() => onSeek?.(10)}
            >
              {sent ? <Check size={17} /> : <Send size={17} />}
              {sent
                ? "Posted to 3 platforms"
                : preparing
                  ? "Preparing your posts…"
                  : "Post to 3 platforms"}
            </button>
          </BorderBeam>
          <p>
            {sent
              ? "One idea, everywhere you share."
              : "YouTube · Instagram · TikTok"}
          </p>
        </div>
      </div>
    </div>
  );
}
export default function PublisherPreview() {
  const { ref, frame, active, seek, reducedMotion } = useDemoPlayback(18, 1500);
  const [reducedFrame, setReducedFrame] = useState(9);
  return (
    <div ref={ref}>
      <PublishingScene
        frame={reducedMotion ? reducedFrame : frame}
        playing={active}
        onSeek={(next) => {
          if (reducedMotion)
            setReducedFrame(next >= 10 ? 12 : next >= 5 ? 9 : 4);
          else seek(next);
        }}
      />
    </div>
  );
}
