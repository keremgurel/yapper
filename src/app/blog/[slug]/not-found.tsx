import Link from "next/link";

export default function BlogNotFound() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6">
      <div className="border-border max-w-lg rounded-[2rem] border bg-white p-10 text-center shadow-[0_25px_70px_rgba(17,24,39,0.08)] dark:bg-zinc-900">
        <p className="text-foreground/40 text-xs tracking-[0.28em] uppercase">
          404
        </p>
        <h1 className="text-foreground mt-4 text-4xl font-semibold tracking-[-0.05em]">
          That article does not exist.
        </h1>
        <p className="text-foreground/60 mt-4 text-base leading-7">
          The slug is missing or the post has not been published yet.
        </p>
        <Link
          href="/blog"
          className="mt-8 inline-flex rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-zinc-100"
        >
          Back to the blog
        </Link>
      </div>
    </main>
  );
}
