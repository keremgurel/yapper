import Link from "next/link";
import { ChirpyMark } from "@/components/brand/chirpy-mark";

const columns = [
  {
    title: "Studio",
    links: [
      ["Overview", "/"],
      ["All features", "/features"],
      ["Pricing", "/pricing"],
    ],
  },
  {
    title: "Create",
    links: [
      ["AI script writer", "/features/ai-script-writer"],
      ["Teleprompter recorder", "/features/teleprompter-recorder"],
      ["Transcript video editor", "/features/transcript-video-editor"],
      ["Automatic captions", "/features/automatic-captions"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Blog", "/blog"],
      ["Content calendar", "/features/content-calendar"],
      ["Social publishing", "/features/social-publishing"],
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
              From idea
              <br />
              to posted video.
            </p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <p className="site-footer-heading">{column.title}</p>
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
