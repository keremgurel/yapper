import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { isPanel, type NavItem } from "@/data/site-navigation";
import { panelId } from "./nav-panel";

export function isCurrent(pathname: string | null, href: string) {
  return pathname === href.split("#")[0];
}

/** The row of links and menu triggers beside the wordmark. */
export default function DesktopNav({
  items,
  pathname,
  open,
  onOpen,
  onNavigate,
  registerTrigger,
}: {
  items: NavItem[];
  pathname: string | null;
  open: string | null;
  onOpen: (label: string | null) => void;
  onNavigate: () => void;
  registerTrigger: (label: string, element: HTMLButtonElement | null) => void;
}) {
  return (
    <nav className="site-desktop-nav" aria-label="Main navigation">
      {items.map((item) =>
        isPanel(item) ? (
          <button
            key={item.label}
            ref={(element) => registerTrigger(item.label, element)}
            type="button"
            aria-expanded={open === item.label}
            aria-controls={panelId(item.label)}
            className="site-nav-trigger"
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") onOpen(item.label);
            }}
            // A keyboard activation (detail 0) toggles; a mouse click after
            // hover-open must not immediately close what the hover opened.
            onClick={(event) =>
              onOpen(
                event.detail === 0 && open === item.label ? null : item.label,
              )
            }
          >
            {item.label}
            <ChevronDown size={13} aria-hidden="true" />
          </button>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            onPointerEnter={() => onOpen(null)}
            aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
            className="site-nav-trigger"
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}
