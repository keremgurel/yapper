import TrainingHeader from "@/components/training/training-header";
import { Component as Footer } from "@/components/ui/footer-taped-design";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-site">
      <a href="#main-content" className="site-skip-link">
        Skip to content
      </a>
      <TrainingHeader />
      <main id="main-content">{children}</main>
      <Footer />
    </div>
  );
}
