import Link from "next/link";
import { ChirpyMark } from "@/components/brand/chirpy-mark";

const columns = [
  {
    title: "Products",
    links: [
      ["Yapper Studio", "/products/studio"],
      ["Yapper Train", "/products/train"],
      ["Compare products", "/products"],
      ["Pricing", "/pricing"],
    ],
  },
  {
    title: "Create with Studio",
    links: [
      ["Capture ideas", "/features/idea-capture"],
      ["Write scripts", "/features/ai-script-writer"],
      ["Record with a teleprompter", "/features/teleprompter-recorder"],
      ["Edit videos", "/features/transcript-video-editor"],
      ["Plan and publish", "/features/social-publishing"],
    ],
  },
  {
    title: "Learn and explore",
    links: [
      ["Speaking practice", "/training"],
      ["Random topics", "/training/random-topic-generator"],
      ["Free tools", "/tools"],
      ["Guides and ideas", "/blog"],
    ],
  },
];

export function Component() {
  return (
    <footer className="site-footer">
      <div className="marketing-container">
        <div className="site-footer-grid">
          <div>
            <Link href="/" className="site-wordmark">
              <ChirpyMark size={29} />
              yapper
            </Link>
            <p className="site-footer-description">
              Find your voice.
              <br />
              Make something with it.
            </p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="site-footer-heading">{column.title}</h2>
              <ul>
                {column.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="site-footer-bottom">
          <p>© {new Date().getFullYear()} OCX Software Inc.</p>
          <div>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <a
              href="https://www.instagram.com/ypr.app/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram
            </a>
            <a
              href="https://www.tiktok.com/@ypr.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              TikTok
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
