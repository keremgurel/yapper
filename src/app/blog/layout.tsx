import TrainingHeader from "@/components/training/training-header";
import { Component as Footer } from "@/components/ui/footer-taped-design";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TrainingHeader />
      {children}
      <Footer />
    </>
  );
}
