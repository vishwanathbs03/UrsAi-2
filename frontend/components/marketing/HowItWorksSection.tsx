import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  Landmark,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

const workflowSteps = [
  {
    step: "01",
    title: "Business Profile",
    description: "Input turnover, industry, workforce & state in 2 minutes.",
    icon: Building2,
  },
  {
    step: "02",
    title: "AI Analysis",
    description: "Sub-50ms evaluation across 8 operational categories.",
    icon: Bot,
  },
  {
    step: "03",
    title: "Health Score",
    description: "Receive your unified 0-100 Health Index & category sub-scores.",
    icon: ShieldCheck,
  },
  {
    step: "04",
    title: "Recommendations",
    description: "Daily priority action briefings to maximize operational ROI.",
    icon: CheckCircle2,
  },
  {
    step: "05",
    title: "Government Schemes",
    description: "Auto-match 25+ subsidies (PMEGP, CGTMSE, Mudra) with match %.",
    icon: Landmark,
  },
  {
    step: "06",
    title: "Business Growth",
    description: "Reinvest capital grants to achieve +24% projected growth.",
    icon: TrendingUp,
  },
];

export function HowItWorksSection() {
  return (
    <section aria-labelledby="how-title" className="bg-background py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Seamless Autonomous Workflow
          </p>
          <h2
            id="how-title"
            className="mt-3 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
          >
            How UrsBiz Drives Small Business Growth
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            From onboarding your digital twin profile to unlocking government capital subsidies in 6 simple steps.
          </p>
        </div>

        {/* Horizontal Workflow Cards */}
        <div className="mt-16 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {workflowSteps.map((s, i) => {
            const Icon = s.icon;
            const isLast = i === workflowSteps.length - 1;

            return (
              <div
                key={s.step}
                className="relative flex flex-col justify-between rounded-xl border border-border bg-card p-4 text-left shadow-soft hover-lift transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-primary">{s.step}</span>
                    {!isLast && (
                      <ChevronRight className="hidden lg:block size-4 text-muted-foreground/60" aria-hidden="true" />
                    )}
                  </div>

                  <div className="mt-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4.5" />
                  </div>

                  <h3 className="mt-3 text-sm font-bold text-foreground">{s.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {s.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
