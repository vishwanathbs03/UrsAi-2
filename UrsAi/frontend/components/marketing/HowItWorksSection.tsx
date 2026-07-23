const steps = [
  {
    number: "01",
    title: "Connect your data",
    description:
      "Plug in your existing tools in minutes. No migrations, no engineering work.",
  },
  {
    number: "02",
    title: "Atlas learns your business",
    description:
      "Our models map your revenue, costs, and operations into a living Business DNA.",
  },
  {
    number: "03",
    title: "Decide with confidence",
    description:
      "Ask, simulate, and report — all in one place. Get answers you can defend in a board meeting.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      aria-labelledby="how-title"
      className="border-t border-border bg-secondary/30"
    >
      <div className="container py-20 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            How it works
          </p>
          <h2
            id="how-title"
            className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
          >
            From chaos to clarity in three steps
          </h2>
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <li
              key={step.number}
              className="relative rounded-xl border border-border bg-card p-6 shadow-soft"
            >
              <span className="text-3xl font-semibold tracking-tight text-primary">
                {step.number}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
