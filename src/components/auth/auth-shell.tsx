import Link from "next/link";
import { ChirpyMark } from "@/components/brand/chirpy-mark";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";
import StepStack from "./step-stack/step-stack";
import styles from "./auth.module.css";

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
            <p className={styles.headline}>From first idea to posted video.</p>
            <p className={styles.description}>
              Script, record, edit and post, all in one place.
            </p>
            <StepStack />
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
