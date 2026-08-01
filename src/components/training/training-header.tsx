import Link from "next/link";

import ResourcesNavDropdown from "@/components/training/resources-nav-dropdown";
import MobileNav from "@/components/training/mobile-nav";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";
import { ChirpyMark } from "@/components/brand/chirpy-mark";
import { Button } from "@/components/ui/button";

export default function TrainingHeader() {
  return (
    <header
      data-site-nav
      className="border-border bg-background sticky top-0 z-50 flex h-14 items-center justify-between border-b px-4 sm:px-6"
    >
      {/* Left: logo (Chirpy the mascot + wordmark) */}
      <Link href="/" className="group flex items-center gap-2 no-underline">
        <span className="shrink-0 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-6">
          <ChirpyMark size={30} />
        </span>
        <span className="font-display text-foreground text-[20px] font-semibold tracking-[0.02em] sm:text-[22px]">
          yapper
        </span>
      </Link>

      {/* Center: marketing product pages + the free SEO resources. */}
      <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
        <Link
          href="/features"
          className="text-foreground/80 hover:bg-muted hover:text-foreground rounded-lg px-3 py-2 text-[14px] font-semibold no-underline transition-colors"
        >
          Features
        </Link>
        <ResourcesNavDropdown />
        <Link
          href="/blog"
          className="text-foreground/80 hover:bg-muted hover:text-foreground rounded-lg px-3 py-2 text-[14px] font-semibold no-underline transition-colors"
        >
          Blog
        </Link>
      </nav>

      {/* Right: waitlist CTA and the original theme switcher. */}
      <div className="flex items-center gap-2">
        <Button
          asChild
          type="button"
          size="sm"
          className="hidden sm:inline-flex"
        >
          <Link href="/#waitlist">Join waitlist</Link>
        </Button>

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
