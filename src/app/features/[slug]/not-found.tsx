import Link from "next/link";

export default function FeatureNotFound() {
  return (
    <main className="bg-background text-foreground grid min-h-screen place-items-center p-8 text-center">
      <div>
        <h1 className="font-display text-4xl font-black">
          That feature page wandered off.
        </h1>
        <Link href="/features" className="mt-6 inline-flex font-bold">
          See all features
        </Link>
      </div>
    </main>
  );
}
