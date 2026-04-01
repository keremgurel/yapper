"use client";

import type { Topic } from "@/data/topics";

interface TopicReelProps {
  topic: Topic;
  spinning: boolean;
  reelBlurbs: string[];
}

export default function TopicReel({
  topic,
  spinning,
  reelBlurbs,
}: TopicReelProps) {
  return (
    <div className="relative flex h-[150px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30 px-7 py-7 text-center backdrop-blur-md">
      {spinning ? (
        <div className="animate-reel-spin flex flex-col gap-4">
          {reelBlurbs.map((t, i) => (
            <p
              key={i}
              className="m-0 font-serif text-lg text-white opacity-30 blur-[2px]"
            >
              {t}
            </p>
          ))}
        </div>
      ) : (
        <>
          <div className="animate-fade-slide-in mb-4 flex justify-center gap-2 [animation-delay:50ms]">
            <span className="rounded-full bg-blue-400/15 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-blue-300 uppercase">
              {topic.category}
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-300 uppercase">
              {topic.difficulty}
            </span>
          </div>
          <p className="animate-fade-slide-in m-0 font-serif text-xl leading-relaxed font-medium text-white [animation-delay:100ms]">
            {topic.text}
          </p>
        </>
      )}
    </div>
  );
}
