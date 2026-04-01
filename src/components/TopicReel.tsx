"use client";

import type { Topic } from "@/data/topics";
import topics from "@/data/topics";

interface TopicReelProps {
  topic: Topic;
  spinning: boolean;
}

export default function TopicReel({ topic, spinning }: TopicReelProps) {
  const reelItems = spinning
    ? Array.from(
        { length: 5 },
        () => topics[Math.floor(Math.random() * topics.length)].text
      )
    : [];

  return (
    <div className="bg-card border border-border rounded-2xl px-7 py-9 w-full text-center shadow-card overflow-hidden relative min-h-[130px] flex flex-col items-center justify-center">
      {spinning ? (
        <div className="animate-reel-spin flex flex-col gap-4">
          {reelItems.map((t, i) => (
            <p
              key={i}
              className="text-lg font-serif text-foreground opacity-30 blur-[2px] m-0"
            >
              {t}
            </p>
          ))}
        </div>
      ) : (
        <>
          <div className="flex justify-center gap-2 mb-4 animate-fade-slide-in [animation-delay:50ms]">
            <span className="text-[10px] font-semibold text-blue-500 bg-blue-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
              {topic.category}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
              {topic.difficulty}
            </span>
          </div>
          <p className="text-xl leading-relaxed font-medium text-foreground font-serif m-0 animate-fade-slide-in [animation-delay:100ms]">
            {topic.text}
          </p>
        </>
      )}
    </div>
  );
}
