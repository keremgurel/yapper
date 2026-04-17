"use client";

import { useCallback, useState } from "react";
import { type Category, type Difficulty, type Topic } from "@/data/topics";
import { playSlotTick } from "@/lib/audio";
import { getRandomTopic, pickReelBlurbs } from "@/lib/practice-helpers";
import { trackTopicGenerated, trackFilterChanged } from "@/lib/analytics";

export function useTopicGenerator(initialTopic: Topic) {
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [spinning, setSpinning] = useState(false);
  const [reelBlurbs, setReelBlurbs] = useState<string[]>([]);
  const [category, setCategory] = useState<Category | "All">("All");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [hasGeneratedTopic, setHasGeneratedTopic] = useState(false);
  const [customPromptText, setCustomPromptText] = useState<string | null>(null);

  const generateTopic = useCallback(() => {
    setCustomPromptText(null);
    setHasGeneratedTopic(true);
    setReelBlurbs(pickReelBlurbs());
    setSpinning(true);
    trackTopicGenerated({ category, difficulty });
    const tickInterval = setInterval(
      () => playSlotTick(600 + Math.random() * 400),
      80,
    );
    setTimeout(() => {
      clearInterval(tickInterval);
      setSpinning(false);
      setReelBlurbs([]);
      setTopic((prev) => getRandomTopic(prev, category, difficulty));
    }, 600);
  }, [category, difficulty]);

  const handleCategoryChange = useCallback(
    (value: string) => {
      const nextCategory = value as Category | "All";
      setCategory(nextCategory);
      setCustomPromptText(null);
      setHasGeneratedTopic(true);
      setTopic(getRandomTopic(topic, nextCategory, difficulty));
      trackFilterChanged({ filter: "category", value: nextCategory });
    },
    [difficulty, topic],
  );

  const handleDifficultyChange = useCallback(
    (value: string) => {
      const nextDifficulty = value as Difficulty | "All";
      setDifficulty(nextDifficulty);
      setCustomPromptText(null);
      setHasGeneratedTopic(true);
      setTopic(getRandomTopic(topic, category, nextDifficulty));
      trackFilterChanged({ filter: "difficulty", value: nextDifficulty });
    },
    [category, topic],
  );

  return {
    topic,
    spinning,
    reelBlurbs,
    category,
    difficulty,
    hasGeneratedTopic,
    customPromptText,
    setCustomPromptText,
    setHasGeneratedTopic,
    generateTopic,
    handleCategoryChange,
    handleDifficultyChange,
  };
}
