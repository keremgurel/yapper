import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function BlogNotFound() {
  return (
    <section className="marketing-section">
      <div className="marketing-container">
        <h1 className="type-h2">That guide does not exist.</h1>
        <p className="marketing-lede">
          The link may be wrong, or the guide was moved.
        </p>
        <div className="marketing-actions">
          <Button asChild>
            <Link href="/blog">See every guide</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
