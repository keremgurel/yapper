import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/** Closes a Train exercise page with what to do after an attempt. */
export default function TrainNextStep() {
  return (
    <section className="marketing-section marketing-rule">
      <div className="marketing-container marketing-split">
        <div>
          <h2 className="type-h2">Want to know how that went?</h2>
          <p className="type-description">
            Record an attempt and ask for AI feedback. You get a transcript,
            five scores and one thing to work on next. Your first session is
            free.
          </p>
        </div>
        <div className="marketing-actions">
          <Link
            className="marketing-text-link"
            href="/products/train/ai-feedback"
          >
            How AI feedback works <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <Link className="marketing-text-link" href="/training">
            More exercises <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
