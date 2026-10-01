import PolishedPane from "@/components/training/feedback/polished-pane";

export default function FeedbackPreview() {
  return (
    <figure
      className="feedback-only-demo"
      aria-label="Example speaking feedback and a clearer version of the same response."
    >
      <div>
        <h2>Your response</h2>
        <blockquote>
          “I guess I kept waiting for the right camera, and, um, I think I was
          actually just nervous about starting.”
        </blockquote>
        <p className="feedback-demo-note">
          Lead with the point. Removing the qualifiers makes your thought easier
          to follow.
        </p>
      </div>
      <div inert>
        <PolishedPane text="I kept waiting for the right camera. What I really needed was the confidence to start." />
      </div>
    </figure>
  );
}
