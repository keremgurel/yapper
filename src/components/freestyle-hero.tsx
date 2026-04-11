import { GlassyButton } from "@/components/ui/glassy-button";

interface FreestyleHeroProps {
  onJumpToPractice: () => void;
}

export default function FreestyleHero({
  onJumpToPractice,
}: FreestyleHeroProps) {
  return (
    <div className="px-6 pt-10 pb-16 text-center md:pt-14 md:pb-24">
      <div className="mb-5 flex justify-center">
        <div className="hero-badge-prominent inline-flex items-center gap-3 rounded-full px-4 py-2.5 backdrop-blur-md">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-red-500 text-[13px] font-semibold text-white shadow-[0_0_18px_rgba(249,115,22,0.45)]">
            Y
          </span>
          <span className="font-display text-[18px] font-semibold tracking-[0.01em]">
            Set your time. Just speak.
          </span>
          <span className="text-[15px] font-medium" aria-hidden>
            →
          </span>
        </div>
      </div>

      <h1 className="font-display text-foreground mx-auto mb-4 max-w-4xl text-[40px] leading-[0.88] font-semibold tracking-[-0.03em] md:text-[72px]">
        Freestyle Speech
        <br />
        Practice
      </h1>

      <p className="hero-description mx-auto mb-7 max-w-2xl text-[16px] leading-relaxed md:mb-8 md:text-[19px]">
        No topic, no prompt. Just you and the clock. Set a timer, turn on your
        camera or mic if you want, and practice speaking freely about whatever
        comes to mind. Great for building confidence and fluency.
      </p>

      <GlassyButton onClick={onJumpToPractice} height={48}>
        Jump to practice
      </GlassyButton>
    </div>
  );
}
