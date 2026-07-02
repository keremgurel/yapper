"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { studioNav } from "@/data/studio-nav";
import StudioNavIcon from "@/components/studio-shell/studio-nav-icon";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The Studio dashboard nav: a left rail on desktop, a horizontal tab strip on
 * mobile. Driven by studioNav so the header dropdown stays in sync. */
export default function StudioSidebar() {
  const pathname = usePathname();

  const link = (item: (typeof studioNav)[number], compact: boolean) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2.5 rounded-xl text-[13px] font-bold no-underline transition-colors ${
          compact ? "shrink-0 px-3 py-2" : "px-3 py-2.5"
        } ${
          active
            ? "bg-muted text-foreground"
            : "text-foreground/60 hover:bg-muted/60 hover:text-foreground"
        }`}
      >
        <StudioNavIcon icon={item.icon} className="h-4 w-4 shrink-0" />
        {item.title}
      </Link>
    );
  };

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden w-56 shrink-0 py-8 pr-6 lg:block">
        <p className="text-foreground/45 px-3 pb-2 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
          Studio
        </p>
        <nav className="flex flex-col gap-0.5">
          {studioNav.map((item) => link(item, false))}
        </nav>
      </aside>

      {/* Mobile tab strip */}
      <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b px-4 py-2 sm:-mx-6 sm:px-6 lg:hidden">
        {studioNav.map((item) => link(item, true))}
      </nav>
    </>
  );
}
