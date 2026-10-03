import Link from "next/link";
import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";

/** Internal links go through the router; external ones open in a new tab. */
function ArticleLink({ href = "", ...props }: ComponentPropsWithoutRef<"a">) {
  if (href.startsWith("/")) return <Link href={href} {...props} />;
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      {...props}
      rel={external ? "noreferrer noopener" : props.rel}
      target={external ? "_blank" : props.target}
    />
  );
}

/** Article elements are styled by the prose block they render into
 * (article.module.css). Only the pieces that need extra markup are here. */
export const blogMdxComponents: MDXComponents = {
  a: ArticleLink,
  table: (props) => (
    <div className="blog-table">
      <table {...props} />
    </div>
  ),
};
