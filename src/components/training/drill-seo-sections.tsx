import type { DrillContent } from "@/data/drills";
export default function DrillSeoSections({ drill }: { drill: DrillContent }) {
  return (
    <>
      <section className="marketing-section marketing-rule">
        <div className="marketing-container training-guide">
          <div>
            <h2 className="type-h2">How to practice</h2>
            <p className="type-description mt-3">
              One focused exercise, then one thing to improve.
            </p>
          </div>
          <ol className="training-steps">
            {drill.howItWorks.map((step, i) => (
              <li key={step.title}>
                <span>{i + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className="marketing-container">
          <h2 className="type-h2">What you’ll work on</h2>
          <div className="training-benefits">
            {drill.benefits.map((benefit) => (
              <div key={benefit.title}>
                <h3 className="type-h3">{benefit.title}</h3>
                <p className="type-description mt-3">{benefit.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className="marketing-container training-guide">
          <h2 className="type-h2">Common questions</h2>
          <div className="marketing-faq">
            {drill.faq.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
