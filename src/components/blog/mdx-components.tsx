import Link from "next/link";
import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";

function ArticleLink(props: ComponentPropsWithoutRef<"a">) {
  const href = props.href ?? "";
  const className =
    "font-medium text-blue-600 underline decoration-blue-300 underline-offset-4 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300";

  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {props.children}
      </Link>
    );
  }

  return (
    <a
      {...props}
      className={className}
      rel={href.startsWith("http") ? "noreferrer noopener" : props.rel}
      target={href.startsWith("http") ? "_blank" : props.target}
    />
  );
}

export const blogMdxComponents: MDXComponents = {
  h2: (props) => (
    <h2
      {...props}
      className="text-foreground mt-14 scroll-mt-32 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl"
    />
  ),
  h3: (props) => (
    <h3
      {...props}
      className="text-foreground mt-10 scroll-mt-32 text-xl font-semibold tracking-[-0.02em] sm:text-2xl"
    />
  ),
  p: (props) => (
    <p
      {...props}
      className="text-foreground/80 text-base leading-8 sm:text-[1.05rem]"
    />
  ),
  ul: (props) => (
    <ul
      {...props}
      className="text-foreground/80 list-disc space-y-2.5 pl-6 marker:text-amber-500"
    />
  ),
  ol: (props) => (
    <ol
      {...props}
      className="text-foreground/80 list-decimal space-y-2.5 pl-6 marker:text-amber-500"
    />
  ),
  li: (props) => <li {...props} className="pl-1.5 leading-7" />,
  blockquote: (props) => (
    <blockquote
      {...props}
      className="text-foreground my-10 rounded-r-2xl border-l-4 border-amber-400 bg-gradient-to-r from-amber-50 to-transparent px-6 py-5 text-lg leading-8 italic dark:from-amber-950/30"
    />
  ),
  hr: (props) => <hr {...props} className="border-border my-12" />,
  code: (props) => (
    <code
      {...props}
      className="rounded-md bg-amber-100 px-1.5 py-0.5 font-mono text-[0.9em] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    />
  ),
  pre: (props) => (
    <pre
      {...props}
      className="my-8 overflow-x-auto rounded-[1.5rem] border border-gray-800 bg-gray-950 px-5 py-5 text-sm leading-7 text-gray-100 shadow-[0_24px_60px_rgba(3,7,18,0.18)]"
    />
  ),
  table: (props) => (
    <div className="border-border my-8 overflow-x-auto rounded-[1.25rem] border bg-white shadow-sm dark:bg-zinc-900">
      <table
        {...props}
        className="min-w-full border-collapse text-left text-sm"
      />
    </div>
  ),
  th: (props) => (
    <th
      {...props}
      className="text-foreground border-border border-b bg-amber-50 px-4 py-3 font-semibold dark:bg-amber-950/20"
    />
  ),
  td: (props) => (
    <td
      {...props}
      className="text-foreground/80 border-border border-b px-4 py-3 leading-6"
    />
  ),
  a: ArticleLink,
};
