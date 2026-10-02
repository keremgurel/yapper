import Link from "next/link";
import { ChirpyMark } from "@/components/brand/chirpy-mark";

// One column per product, so a visitor can tell which links belong to which.
const columns = [
  {
    title: "Yapper Train",
    links: [
      ["Overview", "/products/train"],
      ["Speaking exercises", "/training"],
      ["Random topic generator", "/training/random-topic-generator"],
      ["Interview practice", "/training/interview-prep"],
      ["AI feedback", "/products/train/ai-feedback"],
      ["Train pricing", "/products/train/pricing"],
    ],
  },
  {
    title: "Yapper Studio",
    links: [
      ["Overview", "/products/studio"],
      ["All features", "/features"],
      ["AI script writer", "/features/ai-script-writer"],
      ["Teleprompter recorder", "/features/teleprompter-recorder"],
      ["Transcript video editor", "/features/transcript-video-editor"],
      ["Studio pricing", "/products/studio/pricing"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Speaking guides", "/blog"],
      ["Free tools", "/tools"],
      ["Pricing", "/pricing"],
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
