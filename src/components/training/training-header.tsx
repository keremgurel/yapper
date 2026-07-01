import Link from "next/link";

import CreateNavDropdown from "@/components/create/create-nav-dropdown";
import TrainingNavDropdown from "@/components/training/training-nav-dropdown";
import MobileNav from "@/components/training/mobile-nav";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";

export default function TrainingHeader() {
  return (
    <header className="border-border bg-background relative z-50 flex items-center justify-between border-b px-3 py-3 sm:px-6">
      {/* Left: logo */}
      <Link href="/" className="flex items-center gap-2 no-underline">
        <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-red-500 text-sm font-black text-white">
          Y
        </div>
        <span className="font-display text-foreground hidden text-[22px] font-semibold tracking-[0.02em] sm:inline">
          yapper
        </span>
      </Link>

      {/* Center: primary nav (desktop) — absolutely centered like a regular navbar */}
      <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 md:flex">
        <TrainingNavDropdown />
        <CreateNavDropdown />
      </nav>

      {/* Right: theme + mobile menu */}
      <div className="flex items-center gap-1.5">
        <div className="origin-right scale-[0.5]">
          <CinematicThemeSwitcher />
        </div>
        <MobileNav />
      </div>
    </header>
  );
}
