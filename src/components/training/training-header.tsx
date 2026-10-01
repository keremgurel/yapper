"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";
import {
  ArrowUpRight,
  Clapperboard,
  AudioLines,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import SiteAccountControls from "@/components/account/site-account-controls";
import { ChirpyMark } from "@/components/brand/chirpy-mark";
import { Button } from "@/components/ui/button";
import {
  featureGroups,
  productLinks,
  resourceLinks,
  trainFeatures,
} from "@/data/marketing-navigation";
import { marketingFeatures } from "@/data/marketing-features";

type Panel = "Products" | "Features" | "Resources";
const panels: Panel[] = ["Products", "Features", "Resources"];

export default function TrainingHeader({
  accountControls = true,
}: {
  accountControls?: boolean;
}) {
  const [open, setOpen] = useState<Panel | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const triggers = useRef<Partial<Record<Panel, HTMLButtonElement | null>>>({});
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const close = () => {
    setOpen(null);
    setMobileOpen(false);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const contents = (panel: Panel) => {
    if (panel === "Products")
      return (
        <>
          <div className="site-product-menu">
            {productLinks.map((product) => (
              <div className="site-product-pane" key={product.href}>
                <p className="site-menu-label">
                  {product.href.endsWith("studio") ? (
                    <Clapperboard size={17} />
                  ) : (
                    <AudioLines size={17} />
                  )}
                  {product.detail}
                </p>
                <Link
                  href={product.href}
                  className="site-product-link"
                  onClick={close}
                >
                  {product.title}
                </Link>
                <p className="site-menu-description">{product.description}</p>
                <div className="site-menu-shortcuts">
                  {product.links.map((link) => (
                    <Link key={link.href} href={link.href} onClick={close}>
                      {link.title}
                      <ArrowUpRight size={14} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Link className="site-menu-bottom" href="/products" onClick={close}>
            Compare our products
          </Link>
        </>
      );
    if (panel === "Features")
      return (
        <>
          <div className="site-features-products">
            <section className="site-studio-features">
              <Link
                href="/products/studio"
                className="site-features-heading"
                onClick={close}
              >
                <Clapperboard size={18} />
                Yapper Studio<span>Create and publish</span>
              </Link>
              <div className="site-feature-menu">
                {featureGroups.map((group) => (
                  <div key={group.id}>
                    <p className="site-menu-label">{group.title}</p>
                    {group.slugs.map((slug) => {
                      const feature = marketingFeatures.find(
                        (item) => item.slug === slug,
                      )!;
                      return (
                        <Link
                          key={slug}
                          href={`/features/${slug}`}
                          onClick={close}
                          className="site-feature-link"
                        >
                          {feature.shortTitle}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
            <section className="site-train-features">
              <Link
                href="/products/train"
                className="site-features-heading"
                onClick={close}
              >
                <AudioLines size={18} />
                Yapper Train<span>Practice and improve</span>
              </Link>
              {trainFeatures.map((feature) => (
                <Link
                  className="site-feature-link"
                  key={feature.href}
                  href={feature.href}
                  onClick={close}
                >
                  {feature.title}
                </Link>
              ))}
            </section>
          </div>
          <Link className="site-menu-bottom" href="/features" onClick={close}>
            Explore all features <ArrowUpRight size={14} />
          </Link>
        </>
      );
    return (
      <div className="site-resource-menu">
        {resourceLinks.map((link) => (
          <Link
            href={link.href}
            key={link.href}
            onClick={close}
            className="site-resource-link"
          >
            <span>{link.title}</span>
            <span className="site-menu-description">{link.description}</span>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <header
      data-site-nav
      className="site-header"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (mobileOpen) mobileTrigger.current?.focus();
          else if (open) triggers.current[open]?.focus();
          close();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) close();
      }}
      onPointerEnter={cancelClose}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse")
          closeTimer.current = setTimeout(() => setOpen(null), 180);
      }}
    >
      <div className="marketing-container site-header-row">
        <Link
          href="/"
          onClick={close}
          className="site-wordmark"
          aria-label="Yapper home"
        >
          <ChirpyMark size={29} />
          <span>yapper</span>
        </Link>
        <nav className="site-desktop-nav" aria-label="Main navigation">
          {panels.map((panel) => (
            <button
              key={panel}
              ref={(el) => {
                triggers.current[panel] = el;
              }}
              type="button"
              aria-expanded={open === panel}
              aria-controls={`site-panel-${panel.toLowerCase()}`}
              className="site-nav-trigger"
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") {
                  cancelClose();
                  setOpen(panel);
                }
              }}
              onClick={(event) =>
                setOpen(event.detail === 0 && open === panel ? null : panel)
              }
            >
              {panel}
              <ChevronDown size={13} />
            </button>
          ))}
          <Link
            href="/pricing"
            onClick={close}
            aria-current={pathname === "/pricing" ? "page" : undefined}
            className="site-nav-trigger"
          >
            Pricing
          </Link>
        </nav>
        <div className="site-header-actions">
          {accountControls && <SiteAccountControls showSignup={false} />}
          <Button asChild size="sm" className="site-header-cta">
            <Link href="/products/studio" onClick={close}>
              Explore Studio
            </Link>
          </Button>
          <div className="site-theme-switch">
            <div className="origin-top-left scale-[0.5]">
              <CinematicThemeSwitcher />
            </div>
          </div>
          <button
            ref={mobileTrigger}
            type="button"
            className="site-mobile-trigger"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="site-mobile-navigation"
            onClick={() => {
              setMobileOpen(!mobileOpen);
              setOpen(null);
            }}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <div
          className="site-desktop-panel"
          id={`site-panel-${open.toLowerCase()}`}
        >
          <div className="marketing-container">{contents(open)}</div>
        </div>
      )}
      {mobileOpen && (
        <nav
          id="site-mobile-navigation"
          className="site-mobile-panel marketing-container"
          aria-label="Mobile navigation"
        >
          {productLinks.map((product) => (
            <Link
              key={product.href}
              href={product.href}
              onClick={close}
              className="site-mobile-product"
            >
              <span>{product.title}</span>
              <span className="site-menu-description">{product.detail}</span>
            </Link>
          ))}
          <Link href="/products" onClick={close} className="site-feature-link">
            Compare products
          </Link>
          <details>
            <summary>
              Studio features
              <ChevronDown size={16} />
            </summary>
            {featureGroups.map((group) => (
              <div key={group.id} className="site-mobile-feature-group">
                <p className="site-menu-label">{group.title}</p>
                {group.slugs.map((slug) => (
                  <Link
                    key={slug}
                    className="site-feature-link"
                    href={`/features/${slug}`}
                    onClick={close}
                  >
                    {marketingFeatures.find((f) => f.slug === slug)!.shortTitle}
                  </Link>
                ))}
              </div>
            ))}
            <Link
              href="/features"
              onClick={close}
              className="site-feature-link"
            >
              All Studio features
            </Link>
          </details>
          <details>
            <summary>
              Train features
              <ChevronDown size={16} />
            </summary>
            <div className="site-mobile-feature-group">
              {trainFeatures.map((feature) => (
                <Link
                  className="site-feature-link"
                  key={feature.href}
                  href={feature.href}
                  onClick={close}
                >
                  {feature.title}
                </Link>
              ))}
            </div>
          </details>
          {resourceLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={close}
              className="site-feature-link"
            >
              {link.title}
            </Link>
          ))}
          <Link href="/pricing" onClick={close} className="site-feature-link">
            Pricing
          </Link>
          <Button asChild className="mt-5 w-full">
            <Link href="/products/studio" onClick={close}>
              Explore Studio
            </Link>
          </Button>
        </nav>
      )}
    </header>
  );
}
