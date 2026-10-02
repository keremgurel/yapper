import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { NavPanel as Panel } from "@/data/site-navigation";

export function panelId(label: string) {
  return `site-panel-${label.toLowerCase().replace(/\s+/g, "-")}`;
}

/** The open desktop menu: titled columns of links and one way to see all. */
export default function NavPanel({
  panel,
  onNavigate,
}: {
  panel: Panel;
  onNavigate: () => void;
}) {
  return (
    <div className="site-desktop-panel" id={panelId(panel.label)}>
      <div className="marketing-container">
        <div
          className="site-panel-columns"
          style={{ ["--site-panel-columns" as string]: panel.columns.length }}
        >
          {panel.columns.map((column) => (
            <div key={column.title}>
              <p className="site-menu-label">{column.title}</p>
              {column.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onNavigate}
                  className="site-feature-link"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <Link
          className="site-menu-bottom"
          href={panel.footer.href}
          onClick={onNavigate}
        >
          {panel.footer.label} <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
