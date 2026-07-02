import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";

import StudioNavDropdown from "@/components/studio-shell/studio-nav-dropdown";
import ResourcesNavDropdown from "@/components/training/resources-nav-dropdown";
import MobileNav from "@/components/training/mobile-nav";
import UserMenu from "@/components/account/user-menu";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";
import { ChirpyMark } from "@/components/brand/chirpy-mark";

export default function TrainingHeader() {
  return (
    <header className="border-border bg-background relative z-50 flex items-center justify-between border-b px-4 py-3 sm:px-6">
      {/* Left: logo (Chirpy the mascot + wordmark) */}
      <Link href="/" className="group flex items-center gap-2 no-underline">
        <span className="shrink-0 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-6">
          <ChirpyMark size={30} />
        </span>
        <span className="font-display text-foreground text-[20px] font-semibold tracking-[0.02em] sm:text-[22px]">
          yapper
        </span>
      </Link>

      {/* Center: Create is the main app; Resources are the free SEO tools. */}
      <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
        <StudioNavDropdown />
        <ResourcesNavDropdown />
        <Link
          href="/blog"
          className="text-foreground/80 hover:bg-muted hover:text-foreground rounded-lg px-3 py-2 text-[14px] font-semibold no-underline transition-colors"
        >
          Blog
        </Link>
      </nav>

      {/* Right: account (signed in) or sign in, then the theme toggle */}
      <div className="flex items-center gap-2">
        <Show when="signed-out">
          <SignInButton mode="modal" withSignUp>
            <button
              type="button"
              className="rounded-full bg-cyan-500 px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-cyan-600"
            >
              Sign in
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <UserMenu />
        </Show>

        {/* The switcher is 104x64; box it at the scaled size so it doesn't
            reserve dead space and throw the spacing off. */}
        <div className="h-8 w-[52px] shrink-0">
          <div className="origin-top-left scale-[0.5]">
            <CinematicThemeSwitcher />
          </div>
        </div>

        <MobileNav />
      </div>
    </header>
  );
}
