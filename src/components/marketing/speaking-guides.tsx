import Link from "next/link";
import { speakingGuides } from "@/data/marketing-resources";

export default function SpeakingGuides() {
  return (
    <section className="marketing-section marketing-rule">
      <div className="marketing-container">
        <p className="type-label mb-4">Speaking guides</p>
        <h2 className="type-h2">
          Make your next practice session more useful.
        </h2>
        <div className="marketing-process">
          {speakingGuides.map((guide) => (
            <article key={guide.href}>
              <h3 className="type-h3">
                <Link className="marketing-text-link" href={guide.href}>
                  {guide.title}
                </Link>
              </h3>
              <p className="type-description">{guide.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
