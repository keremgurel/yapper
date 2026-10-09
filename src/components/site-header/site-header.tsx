"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";
import SiteAccountControls from "@/components/account/site-account-controls";
import { ChirpyMark } from "@/components/brand/chirpy-mark";
import { Button } from "@/components/ui/button";
import { useHeaderCta } from "./use-header-cta";
import {
  isPanel,
  siteContextFor,
  siteNavigation,
} from "@/data/site-navigation";
import DesktopNav from "./desktop-nav";
import MobileNav from "./mobile-nav";
import NavPanel from "./nav-panel";
import { useHeaderMenus } from "./use-header-menus";

/**
 * Yapper navigation on the public site. Training lives at speakingpractice.ai;
 * legacy coaching routes retain their own controls.
 */
export default function SiteHeader({
  accountControls = true,
}: {
  accountControls?: boolean;
}) {
  const pathname = usePathname();
  const context = siteContextFor(pathname);
  const navigation = siteNavigation[context];
  const cta = useHeaderCta(navigation.cta);
  const {
    root,
    panel,
    mobile,
    close,
    cancelClose,
    openPanel: showPanel,
    closePanelSoon,
    toggleMobile,
  } = useHeaderMenus();
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const openPanel = navigation.items
    .filter(isPanel)
    .find((item) => item.label === panel);

  return (
    <header
      data-site-nav
      data-site-context={context}
      className="site-header"
      ref={root}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || (!panel && !mobile)) return;
        event.preventDefault();
        if (mobile) mobileTrigger.current?.focus();
        else if (panel) triggers.current[panel]?.focus();
        close();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) close();
      }}
      onPointerEnter={cancelClose}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") closePanelSoon();
      }}
    >
      <div className="marketing-container site-header-row">
        <div className="site-identity">
          <Link
            href="/"
            onClick={close}
            className="site-wordmark"
            aria-label="Yapper home"
          >
            <ChirpyMark size={29} />
            <span>yapper</span>
          </Link>
          {navigation.product && (
            <Link
              href={navigation.product.href}
              onClick={close}
              className="site-product-name"
              aria-current={
                pathname === navigation.product.href ? "page" : undefined
              }
            >
              {navigation.product.label}
            </Link>
          )}
        </div>
        <DesktopNav
          items={navigation.items}
          pathname={pathname}
          open={panel}
          onOpen={showPanel}
          onNavigate={close}
          registerTrigger={(label, element) => {
            triggers.current[label] = element;
          }}
        />
        <div className="site-header-actions">
          {navigation.switchTo && (
            <Link
              href={navigation.switchTo.href}
              onClick={close}
              className="site-product-switch"
            >
              {navigation.switchTo.label}
              <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          )}
          {accountControls && <SiteAccountControls showSignup={false} />}
          {cta && (
            <Button asChild size="sm" className="site-header-cta">
              <Link href={cta.href} onClick={close}>
                {cta.label}
              </Link>
            </Button>
          )}
          <div className="site-theme-switch">
            <div className="origin-top-left scale-[0.5]">
              <CinematicThemeSwitcher />
            </div>
          </div>
          <button
            ref={mobileTrigger}
            type="button"
            className="site-mobile-trigger"
            aria-label={mobile ? "Close navigation" : "Open navigation"}
            aria-expanded={mobile}
            aria-controls="site-mobile-navigation"
            onClick={toggleMobile}
          >
            {mobile ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {openPanel && <NavPanel panel={openPanel} onNavigate={close} />}
      {mobile && <MobileNav navigation={navigation} onNavigate={close} />}
    </header>
  );
}
