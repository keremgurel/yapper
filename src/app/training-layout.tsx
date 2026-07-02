import TrainingHeader from "@/components/training/training-header";

export default function TrainingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      className="min-h-screen overflow-hidden"
      style={{ background: "var(--sg-bg)", color: "var(--sg-text)" }}
    >
      <TrainingHeader />
      {children}
    </main>
  );
}
