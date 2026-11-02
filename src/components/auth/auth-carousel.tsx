"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STEPS } from "./step-stack/steps";
import backdrops from "@/components/marketing/grainient-background.module.css";
import styles from "./auth-carousel.module.css";

const INTERVAL = 6000;
const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(callback: () => void) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const getReducedMotion = () => window.matchMedia(MOTION_QUERY).matches;
const serverReducedMotion = () => true;

const descriptions = [
  "Save the thought before it slips away.",
  "Turn your idea into a script that sounds like you.",
  "Keep your words in view and your eyes on the camera.",
  "Keep your best take. Leave the pauses behind.",
  "One video, ready for all your channels.",
];
const backgrounds = ["ideas", "script", "record", "edit", "publish"];

export default function AuthCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const root = useRef<HTMLElement>(null);
  const reduce = useSyncExternalStore(
    subscribeMotion,
    getReducedMotion,
    serverReducedMotion,
  );
  const playing = !paused && !reduce;

  useEffect(() => {
    if (!playing || hovered) return;
    const element = root.current;
    if (!element) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let visible = false;
    const sync = () => {
      clearInterval(timer);
      if (!visible || document.hidden) return;
      timer = setInterval(
        () => setIndex((i) => (i + 1) % STEPS.length),
        INTERVAL,
      );
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [playing, hovered]);

  return (
    <section
      ref={root}
      className={styles.carousel}
      aria-label="Create with Yapper"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-playing={playing}
    >
      <div className={styles.slides} aria-live={playing ? "off" : "polite"}>
        {STEPS.map((step, i) => (
          <div
            key={step.id}
            className={`${styles.slide} ${backdrops.background}`}
            data-active={index === i}
            data-palette={backgrounds[i]}
            aria-hidden={index !== i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${STEPS.length}: ${step.label}`}
          >
            <div className={styles.intro}>
              <p>
                From first idea
                <br />
                to posted video.
              </p>
              <span>Make it yours with Yapper.</span>
            </div>
            <div className={styles.example}>
              <div className={styles.exampleHeader}>
                <step.Icon size={18} strokeWidth={1.75} aria-hidden />
                <span>{step.label}</span>
              </div>
              <step.Body />
            </div>
            <div className={styles.caption}>
              <h2>{step.title}</h2>
              <p>{descriptions[i]}</p>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.controls}>
        <div
          className={styles.indicators}
          role="group"
          aria-label="Choose a Studio step"
        >
          {STEPS.map((step, i) => (
            <button
              key={step.id}
              type="button"
              aria-label={`Show ${step.label.toLowerCase()}`}
              aria-pressed={index === i}
              className={styles.indicator}
              onFocus={() => setPaused(true)}
              onClick={() => {
                setPaused(true);
                setIndex(i);
              }}
            >
              <span />
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={styles.playback}
          aria-label={playing ? "Pause slideshow" : "Play slideshow"}
          disabled={reduce}
          onClick={() => setPaused((value) => !value)}
        >
          {playing ? (
            <Pause size={16} aria-hidden />
          ) : (
            <Play size={16} aria-hidden />
          )}
        </Button>
      </div>
    </section>
  );
}
