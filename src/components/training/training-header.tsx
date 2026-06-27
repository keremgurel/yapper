import Link from "next/link";

import TrainingNavDropdown from "@/components/training/training-nav-dropdown";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";

export default function TrainingHeader() {
  return (
    <header className="border-border flex items-center justify-between border-b px-3 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-red-500 text-sm font-black text-white">
            Y
          </div>
          <span className="font-display text-foreground hidden text-[22px] font-semibold tracking-[0.02em] sm:inline">
            yapper
          </span>
        </Link>
        <TrainingNavDropdown />
      </div>
      <div className="origin-right scale-[0.5]">
        <CinematicThemeSwitcher />
      </div>
    </header>
  );
}
