import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPanel, type SiteNavigation } from "@/data/site-navigation";

/** The phone menu: the same items as the desktop row, one level deep. */
export default function MobileNav({
  navigation,
  onNavigate,
}: {
  navigation: SiteNavigation;
  onNavigate: () => void;
}) {
  const cta = navigation.cta;
  return (
    <nav
      id="site-mobile-navigation"
      className="site-mobile-panel marketing-container"
      aria-label="Mobile navigation"
    >
      {navigation.items.map((item) =>
        isPanel(item) ? (
          <details key={item.label}>
            <summary>
              {item.label}
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            {item.columns.map((column) => (
              <div key={column.title} className="site-mobile-feature-group">
                <p className="site-menu-label">{column.title}</p>
                {column.links.map((link) => (
                  <Link
                    key={link.href}
                    className="site-feature-link"
                    href={link.href}
                    onClick={onNavigate}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
            <Link
              href={item.footer.href}
              onClick={onNavigate}
              className="site-feature-link"
            >
              {item.footer.label}
            </Link>
          </details>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className="site-feature-link"
          >
            {item.label}
          </Link>
        ),
      )}
      {cta && (
        <Button asChild variant="titanium" className="mt-5 w-full">
          <Link href={cta.href} onClick={onNavigate}>
            {cta.label}
          </Link>
        </Button>
      )}
      {navigation.switchTo && (
        <Link
          href={navigation.switchTo.href}
          onClick={onNavigate}
          className="site-product-switch site-product-switch-mobile"
        >
          {navigation.switchTo.label}
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
