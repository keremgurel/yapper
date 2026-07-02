/** Shared section shell: a labelled band with a title, blurb, and content. */
export function Section({
  id,
  eyebrow,
  title,
  blurb,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "var(--sg-space-16) var(--sg-space-5)",
        borderBottom: "1px solid var(--sg-border)",
      }}
    >
      <div style={{ marginBottom: "var(--sg-space-8)", maxWidth: 640 }}>
        <span className="sg-label">{eyebrow}</span>
        <h2
          className="sg-display"
          style={{
            fontSize: "var(--sg-text-3xl)",
            margin: "var(--sg-space-3) 0 0",
          }}
        >
          {title}
        </h2>
        {blurb && (
          <p
            style={{
              color: "var(--sg-text-muted)",
              fontSize: "var(--sg-text-lg)",
              lineHeight: 1.5,
              margin: "var(--sg-space-3) 0 0",
            }}
          >
            {blurb}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
