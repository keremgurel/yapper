import { CircleAlert } from "lucide-react";
import { EmptyState } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";

/**
 * The result screen when scoring failed. Copy stays plain; the retry action
 * only renders when the caller can actually retry.
 */
export default function FeedbackError({
  title = "Scoring did not finish",
  description = "Something went wrong while scoring this rep. Your recording is safe.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={CircleAlert}
      title={title}
      description={description}
      action={
        onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}
