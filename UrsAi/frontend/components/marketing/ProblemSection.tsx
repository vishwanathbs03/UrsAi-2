/**
 * Problem statement — three pain points most SMBs share.
 */
const problems = [
  {
    title: "Too many dashboards, no clear answer",
    description:
      "Reports pile up faster than anyone can read them. The real questions — what to do next, what is at risk, where to invest — stay unanswered.",
  },
  {
    title: "Decisions trapped in spreadsheets",
    description:
      "Critical context lives in exports, side-channels, and tribal knowledge. By the time a decision is made, the data is already stale.",
  },
  {
    title: "Hiring a data team isn't an option",
    description:
      "Most growing businesses can't justify a full analytics function. Yet without one, every strategic choice is a guess.",
  },
];

export function ProblemSection() {
  return (
    <section
      aria-labelledby="problem-title"
      className="border-y border-border bg-secondary/30"
    >
      <div className="container py-20 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            The problem
          </p>
          <h2
            id="problem-title"
            className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
          >
            Running a business shouldn&apos;t feel like guesswork
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Modern teams have more data than ever — and less clarity than
            they need.
          </p>
        </div>

        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {problems.map((problem) => (
            <li
              key={problem.title}
              className="rounded-xl border border-border bg-card p-6 shadow-soft"
            >
              <h3 className="text-lg font-semibold text-foreground">
                {problem.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {problem.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
