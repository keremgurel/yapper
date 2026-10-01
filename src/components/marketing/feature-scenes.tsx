"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Check, FileText, Mic, Send, Sparkles } from "lucide-react";
import { ChirpyMark } from "@/components/brand/chirpy-mark";
import HookChosen from "@/components/canvas/hooks/hook-chosen";
import TeleprompterOverlay from "@/components/teleprompter/teleprompter-overlay";
import PlatformIcon from "@/components/publish/platform-icon";
import VoiceSurface from "@/components/common/voice-surface";
import styles from "./feature-scenes.module.css";

const noop = () => {};

export function ScriptFilm({
  frame,
  playing,
}: {
  frame: number;
  playing: boolean;
}) {
  const revised = frame >= 3;
  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <FileText size={15} />
        <strong>Script</strong>
        <span>{revised ? "Saved" : "Draft"}</span>
      </header>
      <div className={styles.document}>
        <div className={styles.hook}>
          <HookChosen
            hook={
              revised
                ? "Your first video doesn’t need a new camera."
                : "I kept putting off my first video."
            }
            hookKey="feature-film-hook"
            onChange={noop}
            onAskForHooks={noop}
          />
        </div>
        <p>
          One idea. My phone. Sixty seconds. That was enough to make my first
          video.
        </p>
      </div>
      <div className={styles.assistant}>
        <div className={styles.assistantTitle}>
          <ChirpyMark size={22} />
          <strong>Chirpy</strong>
          <span>{revised ? <Check size={14} /> : <Sparkles size={14} />}</span>
        </div>
        <VoiceSurface
          active={playing && frame === 1}
          level={0.2}
          type="default"
          className={styles.request}
        >
          <Mic size={13} />
          <span>
            {revised
              ? "A stronger hook. Still your voice."
              : "Make the opening more compelling."}
          </span>
        </VoiceSurface>
      </div>
    </div>
  );
}

export function RecordingFilm({
  frame,
  playing,
}: {
  frame: number;
  playing: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: frame * 17,
      behavior: playing ? "smooth" : "instant",
    });
  }, [frame, playing]);
  return (
    <div className={styles.camera}>
      <Image
        src="/images/marketing/creator-studio.webp"
        alt=""
        fill
        sizes="355px"
      />
      <TeleprompterOverlay
        scrollRef={scrollRef}
        text={
          "Your first video doesn’t need a new camera.\n\nStart with one idea. Say it out loud.\n\nMake the next take better."
        }
        fontScale={0.5}
        heightPct={26}
        opacity={0.9}
      />
      <div className={styles.cameraFooter}>
        <span className={styles.recordTime}>
          <i />
          00:{String(8 + frame * 3).padStart(2, "0")}
        </span>
        <span className={styles.recordButton}>
          <i />
        </span>
        <span>120 wpm</span>
      </div>
    </div>
  );
}

const channels = [
  { platform: "youtube" as const, name: "YouTube Shorts" },
  { platform: "instagram" as const, name: "Instagram Reels" },
  { platform: "tiktok" as const, name: "TikTok" },
];
export function PublishingFilm({ frame }: { frame: number }) {
  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <Send size={15} />
        <strong>Publish video</strong>
        <span>3 channels</span>
      </header>
      <div className={styles.post}>
        <div className={styles.thumbnail}>
          <Image
            src="/images/marketing/creator-studio.webp"
            alt=""
            fill
            sizes="62px"
          />
          <span>01:30</span>
        </div>
        <div>
          <strong>Your phone is enough.</strong>
          <p>
            One idea. Sixty seconds.
            <br />
            Start with what you have.
          </p>
        </div>
      </div>
      <div className={styles.channels}>
        {channels.map(({ platform, name }, i) => (
          <div key={platform}>
            <PlatformIcon platform={platform} branded className="h-4 w-4" />
            <span>{name}</span>
            <span className={styles.channelStatus}>
              {frame > i ? (
                <>
                  <Check size={12} />
                  Ready
                </>
              ) : (
                "Preparing"
              )}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.send}>
        <Send size={13} />
        Post to 3 platforms
      </div>
    </div>
  );
}
