interface FreestyleHeroProps {
  onJumpToPractice: () => void;
}

export default function FreestyleHero({
  onJumpToPractice,
}: FreestyleHeroProps) {
  return (
    <div className="px-6 pt-10 pb-16 text-center md:pt-14 md:pb-24">
      <div className="mb-5 flex justify-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/12 dark:bg-zinc-800/90 dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)]">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-red-500 text-[13px] font-semibold text-white shadow-[0_0_18px_rgba(249,115,22,0.45)]">
            Y
          </span>
          <span className="font-display text-[18px] font-semibold tracking-[0.01em] text-slate-900 dark:text-zinc-50">
            Set your time. Just speak.
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
        Freestyle Speech
        <br />
        Practice
      </h1>

      <p className="text-foreground/85 mx-auto mb-7 max-w-2xl text-[16px] leading-relaxed text-slate-600 md:mb-8 md:text-[19px] dark:text-slate-400">
        No topic, no prompt — just you and the clock. Set a timer, turn on your
        camera or mic if you want, and practice speaking freely about whatever
        comes to mind. Great for building confidence and fluency.
      </p>

      <button
        type="button"
        onClick={onJumpToPractice}
        className="home-hero-jump inline-flex cursor-pointer items-center justify-center rounded-lg border px-8 py-3.5 text-[14px] font-semibold transition-colors"
      >
        Jump to practice
      </button>
    </div>
  );
}
