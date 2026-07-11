import TrainingHeader from "@/components/training/training-header";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TrainingHeader />
      {children}
    </>
  );
}
