import TrainingHeader from "@/components/training/training-header";

export default function TrainingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f8fafc] text-slate-950 dark:bg-[#0f1117] dark:text-white">
      <TrainingHeader />
      {children}
    </main>
  );
}
