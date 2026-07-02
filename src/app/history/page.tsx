import type { Metadata } from "next";
import TrainingHeader from "@/components/training/training-header";
import HistoryView from "@/components/history/history-view";

export const metadata: Metadata = {
  title: "Your sessions",
  robots: { index: false, follow: false },
};

export default function HistoryPage() {
  return (
    <main className="bg-background text-foreground min-h-screen">
      <TrainingHeader />
      <HistoryView />
    </main>
  );
}
