import Link from "next/link";

import SiteAccountControls from "@/components/account/site-account-controls";
import TrainingNavDropdown from "@/components/training/training-nav-dropdown";
import MobileNav from "@/components/training/mobile-nav";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";
import { ChirpyMark } from "@/components/brand/chirpy-mark";

/**
 * The site-wide public navbar. Studio renders it above its own app header,
 * which already carries the credit meter and account menu, so it passes
 * `accountControls={false}` to avoid showing the account twice.
 */
export default function TrainingHeader({
  accountControls = true,
}: {
  accountControls?: boolean;
}) {
  return (
    <header
      data-site-nav
      className="border-border bg-background sticky top-0 z-50 flex h-14 items-center justify-between border-b px-4 sm:px-6"
    >
      {/* Left: logo (Chirpy the mascot + wordmark) */}
      <Link href="/" className="group flex items-center gap-2 no-underline">
        <span
          className="shrink-0 transition-transform group-hover:scale-105 group-hover:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-hover:rotate-0"
          style={{ transitionDuration: "var(--sg-dur-base)" }}
        >
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
        <TrainingNavDropdown />
        <Link
          href="/pricing"
          className="text-foreground/80 hover:bg-muted hover:text-foreground rounded-lg px-3 py-2 text-[14px] font-semibold no-underline transition-colors"
        >
          Pricing
        </Link>
        <Link
          href="/blog"
          className="text-foreground/80 hover:bg-muted hover:text-foreground rounded-lg px-3 py-2 text-[14px] font-semibold no-underline transition-colors"
        >
          Blog
        </Link>
      </nav>

      {/* Right: account controls and the original theme switcher. */}
      <div className="flex items-center gap-2">
        {accountControls && <SiteAccountControls />}

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
