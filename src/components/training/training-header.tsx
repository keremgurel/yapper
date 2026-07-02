import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

import CreateNavDropdown from "@/components/create/create-nav-dropdown";
import TrainingNavDropdown from "@/components/training/training-nav-dropdown";
import MobileNav from "@/components/training/mobile-nav";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";
import { ChirpyMark } from "@/components/brand/chirpy-mark";

export default function TrainingHeader() {
  return (
    <header className="border-border bg-background relative z-50 flex items-center justify-between border-b px-3 py-3 sm:px-6">
      {/* Left: logo — Chirpy the mascot + wordmark */}
      <Link href="/" className="group flex items-center gap-2 no-underline">
        <span className="shrink-0 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
          <ChirpyMark size={30} />
        </span>
        <span className="font-display text-foreground text-[20px] font-semibold tracking-[0.02em] sm:text-[22px]">
          yapper
        </span>
      </Link>

      {/* Center: primary nav (desktop) — absolutely centered like a regular navbar */}
      <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 md:flex">
        <TrainingNavDropdown />
        <CreateNavDropdown />
      </nav>

      {/* Right: auth + theme + mobile menu */}
      <div className="flex items-center gap-1.5">
        <Show when="signed-out">
          <SignInButton mode="modal" withSignUp>
            <button
              type="button"
              className="border-border bg-card text-foreground hover:bg-muted rounded-full border px-3.5 py-2 text-[13px] font-bold shadow-sm transition-colors"
            >
              Sign in
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <Link
            href="/history"
            className="text-foreground/70 hover:text-foreground hidden text-[13px] font-bold no-underline sm:inline"
          >
            Sessions
          </Link>
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        </Show>
        <div className="origin-right scale-[0.5]">
          <CinematicThemeSwitcher />
        </div>
        <MobileNav />
      </div>
    </header>
  );
}
