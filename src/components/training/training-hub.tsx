import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Camera,
  Compass,
  Lightbulb,
  MessageCircle,
  Mic,
  Search,
  BriefcaseBusiness,
} from "lucide-react";
import MarketingLayout from "@/components/marketing/marketing-layout";
import TrainingWorkspace from "./training-workspace";
import { trainingModes, getTrainingMode } from "@/data/training-modes";
import { trainPractice } from "@/data/site-navigation";
import styles from "./training-workspace.module.css";

const icons = [
  Lightbulb,
  Mic,
  AudioLines,
  BookOpen,
  Search,
  BriefcaseBusiness,
  MessageCircle,
  Compass,
  Camera,
];
export default function TrainingHub({ initialMode }: { initialMode?: string }) {
  const selected = initialMode ? getTrainingMode(initialMode) : undefined;
  return (
    <MarketingLayout>
      <div className={`marketing-container ${styles.hub}`}>
        {selected ? (
          <>
            <div className={styles.workspaceHeading}>
              <div>
                <p>Yapper Train</p>
                <h1 className="type-h2">{selected.title}</h1>
              </div>
              <Link href="/training" className="marketing-text-link">
                Change exercise
              </Link>
            </div>
            <TrainingWorkspace key={selected.slug} mode={selected} />
          </>
        ) : (
          <>
            <header className={styles.hubHeading}>
              <p>Yapper Train</p>
              <h1 className="type-display">
                What would you like
                <br />
                to practice?
              </h1>
              <p>
                A short session, a little more confidence. Choose an exercise to
                get started.
              </p>
            </header>
            {["Everyday practice", "Real situations"].map((group) => (
              <section className={styles.modeGroup} key={group}>
                <h2>{group}</h2>
                <div className={styles.modeGrid}>
                  {trainingModes
                    .filter((mode) => mode.group === group)
                    .map((mode) => {
                      const Icon = icons[trainingModes.indexOf(mode)];
                      return (
                        <Link
                          key={mode.slug}
                          href={`/training?mode=${mode.slug}`}
                          className={styles.modeCard}
                        >
                          <div>
                            <Icon size={21} />
                            <span>{mode.duration}</span>
                          </div>
                          <h3>{mode.title}</h3>
                          <p>{mode.description}</p>
                          <ArrowRight size={17} className={styles.modeArrow} />
                        </Link>
                      );
                    })}
                </div>
              </section>
            ))}
            <div className={styles.guideLink}>
              <BookOpen size={20} />
              <div>
                <strong>Need a warm-up first?</strong>
                <p>
                  A guided routine for word retrieval, voice, and structure.
                </p>
              </div>
              <Link
                href="/training/fluency-on-steroids"
                className="marketing-text-link"
              >
                Open the guide <ArrowRight size={15} />
              </Link>
            </div>
            <p className={styles.accessNote}>
              Prompts and practice are free. Camera and microphone are optional.{" "}
              <Link href="/products/train/ai-feedback" className="underline">
                AI feedback
              </Link>{" "}
              is optional too, and your first session is free.
            </p>
            <nav className={styles.guides} aria-labelledby="exercise-guides">
              <h2 id="exercise-guides">How each exercise works</h2>
              <ul>
                {trainPractice
                  .flatMap((column) => column.links)
                  .map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
              </ul>
            </nav>
          </>
        )}
      </div>
    </MarketingLayout>
  );
}
