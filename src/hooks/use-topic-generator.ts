"use client";

import { takeRetryPrompt } from "@/lib/practice/retry-prompt";
import { useCallback, useEffect, useRef, useState } from "react";
import topics, {
  type Category,
  type Difficulty,
  type Topic,
} from "@/data/topics";
import { playSlotTick, playSlotLand } from "@/lib/audio";
import {
  getRandomFromPool,
  filterTopicPool,
  pickReelBlurbs,
} from "@/lib/practice-helpers";
import { trackTopicGenerated, trackFilterChanged } from "@/lib/analytics";

export function useTopicGenerator(
  initialTopic: Topic,
  pool?: Topic[],
  initialGenerated = false,
) {
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [spinning, setSpinning] = useState(false);
  const [reelBlurbs, setReelBlurbs] = useState<string[]>([]);
  const [category, setCategory] = useState<Category | "All">("All");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [hasGeneratedTopic, setHasGeneratedTopic] = useState(initialGenerated);
  const [customPromptText, setCustomPromptText] = useState<string | null>(null);

  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelSpin = useCallback(() => {
    if (spinTimer.current) clearTimeout(spinTimer.current);
    if (tickTimer.current) clearTimeout(tickTimer.current);
    spinTimer.current = null;
    tickTimer.current = null;
  }, []);
  useEffect(() => cancelSpin, [cancelSpin]);
  // Arriving from a report's "try this prompt again": start on that prompt.
  useEffect(() => {
    const retry = takeRetryPrompt();
    if (!retry) return;
    // Session storage is only readable after mount, so this state cannot be
    // an initial value. Applied on the next tick, outside the effect body.
    // Not cancelled on cleanup: the prompt is read once, and a development
    // double-mount would otherwise lose it.
    requestAnimationFrame(() => {
      setCustomPromptText(retry);
      setHasGeneratedTopic(true);
    });
  }, []);
  const hasPool = !!pool && pool.length > 0;

  const generateTopic = useCallback(() => {
    cancelSpin();
    const filtered = hasPool
      ? filterTopicPool(pool!, category, difficulty)
      : undefined;
    const source = filtered?.length
      ? filtered
      : filterTopicPool(pool ?? topics, category, difficulty);
    const next = getRandomFromPool(source, topic);
    setCustomPromptText(null);
    setHasGeneratedTopic(true);
    setReelBlurbs([topic.text, ...pickReelBlurbs(source), next.text]);
    setSpinning(true);
    trackTopicGenerated({ category, difficulty });
    const startedAt = Date.now();
    const tick = () => {
      playSlotTick(600 + Math.random() * 400);
      const progress = Math.min(1, (Date.now() - startedAt) / 1300);
      tickTimer.current = setTimeout(tick, 65 + progress * progress * 260);
    };
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) tick();
    spinTimer.current = setTimeout(
      () => {
        cancelSpin();
        setSpinning(false);
        setReelBlurbs([]);
        setTopic(next);
        playSlotLand();
      },
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1300,
    );
  }, [category, difficulty, pool, hasPool, cancelSpin, topic]);

  const handleCategoryChange = useCallback(
    (value: string) => {
      const nextCategory = value as Category | "All";
      setCategory(nextCategory);
      setCustomPromptText(null);
      setHasGeneratedTopic(true);
      cancelSpin();
      setSpinning(false);
      const source = pool ?? topics;
      const requested = filterTopicPool(source, nextCategory, difficulty);
      const nextDifficulty = requested.length ? difficulty : "All";
      setDifficulty(nextDifficulty);
      setTopic(
        getRandomFromPool(
          filterTopicPool(source, nextCategory, nextDifficulty),
          topic,
        ),
      );
      trackFilterChanged({ filter: "category", value: nextCategory });
    },
    [difficulty, topic, pool, cancelSpin],
  );

  const handleDifficultyChange = useCallback(
    (value: string) => {
      const nextDifficulty = value as Difficulty | "All";
      setDifficulty(nextDifficulty);
      setCustomPromptText(null);
      setHasGeneratedTopic(true);
      cancelSpin();
      setSpinning(false);
      const source = filterTopicPool(pool ?? topics, category, nextDifficulty);
      if (source.length) setTopic(getRandomFromPool(source, topic));
      trackFilterChanged({ filter: "difficulty", value: nextDifficulty });
    },
    [category, topic, pool, cancelSpin],
  );

  return {
    topic,
    spinning,
    reelBlurbs,
    category,
    difficulty,
    hasGeneratedTopic,
    hasPool,
    customPromptText,
    setCustomPromptText,
    setHasGeneratedTopic,
    generateTopic,
    handleCategoryChange,
    handleDifficultyChange,
  };
}
