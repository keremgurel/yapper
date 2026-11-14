import Link from "next/link";
import { ChirpyMark } from "@/components/brand/chirpy-mark";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";
import AuthCarousel from "./auth-carousel";
import styles from "./auth.module.css";

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className="site-wordmark" aria-label="Yapper home">
            <ChirpyMark size={28} />
            <span>yapper</span>
          </Link>
          <div className={styles.themeSwitch}>
            <div className="origin-top-left scale-[0.5]">
              <CinematicThemeSwitcher />
            </div>
          </div>
        </header>
        <main className={styles.layout}>
          <AuthCarousel />
          <section className={styles.form} aria-label="Access your studio">
            {children}
          </section>
        </main>
        <footer className={styles.footer}>
          <Link href="/">Back to Yapper</Link>
          <nav aria-label="Legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
