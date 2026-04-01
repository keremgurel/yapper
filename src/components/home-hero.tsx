interface HomeHeroProps {
  onJumpToPractice: () => void;
}

export default function HomeHero({ onJumpToPractice }: HomeHeroProps) {
  return (
    <div className="px-6 pt-10 pb-16 text-center md:pt-14 md:pb-24">
      <div className="mb-5 flex justify-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/12 dark:bg-zinc-800/90 dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)]">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-red-500 text-[13px] font-semibold text-white shadow-[0_0_18px_rgba(249,115,22,0.45)]">
            Y
          </span>
          <span className="font-display text-[18px] font-semibold tracking-[0.01em] text-slate-900 dark:text-zinc-50">
            Pull the lever. Start talking.
          </span>
          <span
            className="text-[15px] font-medium text-slate-600 dark:text-zinc-400"
            aria-hidden
          >
            →
          </span>
        </div>
      </div>

      <h1 className="font-display text-foreground mx-auto mb-4 max-w-4xl text-[40px] leading-[0.88] font-semibold tracking-[-0.03em] md:text-[72px]">
        Free Topic Generator
        <br />
        for Speech Practice
      </h1>

      <p className="text-foreground/85 mx-auto mb-7 max-w-2xl text-[16px] leading-relaxed text-slate-600 md:mb-8 md:text-[19px] dark:text-slate-400">
        Practice public speaking alone with random speech topics, table topics,
        a built-in timer, and optional camera or mic recording. No sign-up, no
        paywall, and no setup friction.
      </p>

      <button
        onClick={onJumpToPractice}
        className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-slate-900 px-8 py-3.5 text-[14px] font-semibold text-white shadow-[0_2px_12px_rgba(15,23,42,0.25)] transition-colors hover:bg-slate-800 dark:border-white/15 dark:bg-white dark:text-slate-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] dark:hover:bg-zinc-100"
      >
        Jump to practice
      </button>
    </div>
  );
}
