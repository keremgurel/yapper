import TrainingHeader from "@/components/training/training-header";
import { Component as Footer } from "@/components/ui/footer-taped-design";

/** Header and page canvas for Train pages outside the marketing shell. Public
 * pages pass `footer` so they carry the same site footer as everything else;
 * signed-in pages leave it off. */
export default function TrainingLayout({
  children,
  footer = false,
}: {
  children: React.ReactNode;
  footer?: boolean;
}) {
  return (
    <>
      <main
        className="site-neutral min-h-screen overflow-x-clip"
        style={{ background: "var(--sg-bg)", color: "var(--sg-text)" }}
      >
        <TrainingHeader />
        {children}
      </main>
      {footer && <Footer />}
    </>
  );
}
