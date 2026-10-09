import Link from "next/link";
import { Lightbulb, FileText, Video, Scissors, Send } from "lucide-react";
import { ChirpyMark } from "@/components/brand/chirpy-mark";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";
import styles from "./auth.module.css";

const workflow = [
  { label: "Brainstorm", icon: Lightbulb, tone: "idea" },
  { label: "Script", icon: FileText, tone: "script" },
  { label: "Record", icon: Video, tone: "record" },
  { label: "Edit", icon: Scissors, tone: "edit" },
  { label: "Crosspost", icon: Send, tone: "publish" },
];

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={`marketing-container ${styles.header}`}>
        <Link href="/" className="site-wordmark" aria-label="Yapper home">
          <ChirpyMark size={32} />
          <span>yapper</span>
        </Link>
        <div className={styles.themeSwitch}>
          <div className="origin-top-left scale-[0.5]">
            <CinematicThemeSwitcher />
          </div>
        </div>
      </header>

      <main className={`marketing-container ${styles.main}`}>
        <div className={styles.layout}>
          <section className={styles.story} aria-label="Yapper Studio">
            <p className={styles.product}>Yapper Studio</p>
            <p className={styles.headline}>
              From first idea
              <br />
              to posted video.
            </p>
            <p className={styles.description}>
              A place for your ideas to become something.
              <br />
              Script, record, edit and share. All together.
            </p>
            <ol className={styles.workflow} aria-label="Your creative workflow">
              {workflow.map(({ label, icon: Icon, tone }) => (
                <li key={label}>
                  <span className={styles.tile} data-tone={tone}>
                    <Icon size={28} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className={styles.form} aria-label="Access your studio">
            {children}
          </section>
        </div>
      </main>

      <footer className={`marketing-container ${styles.footer}`}>
        <Link href="/">Back to Yapper</Link>
        <nav aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}
