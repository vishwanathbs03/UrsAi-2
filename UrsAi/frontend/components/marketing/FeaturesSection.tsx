import {
  Brain,
  GitBranch,
  LineChart,
  ShieldCheck,
  Workflow,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
}

const features: Feature[] = [
  {
    title: "AI Decision Engine",
    description:
      "Ask plain-language questions and get reasoned, evidence-backed answers in seconds.",
    icon: Brain,
  },
  {
    title: "Business DNA",
    description:
      "Atlas learns the shape of your business — revenue mix, cost structure, unit economics.",
    icon: GitBranch,
  },
  {
    title: "Smart Simulation",
    description:
      "Stress-test pricing, hiring, and growth scenarios before you commit a single dollar.",
    icon: Workflow,
  },
  {
    title: "Live Reporting",
    description:
      "Always-current reports that highlight what changed, what matters, and what to ignore.",
    icon: LineChart,
  },
  {
    title: "Built-in Rule Engine",
    description:
      "Encode your operating playbook once. Atlas applies it consistently across every signal.",
    icon: ShieldCheck,
  },
  {
    title: "Lightweight by Design",
    description:
      "Onboard in minutes. No pipelines to build, no data team required.",
    icon: Zap,
  },
];

export function FeaturesSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="bg-background"
    >
      <div className="container py-20 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            Features
          </p>
          <h2
            id="features-title"
            className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
          >
            Everything you need to decide with confidence
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            A unified intelligence platform purpose-built for the way SMBs
            actually operate.
          </p>
        </div>

        <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <li
                key={feature.title}
                className="group rounded-xl border border-border bg-card p-6 shadow-soft transition-shadow hover:shadow-card"
              >
                <div className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
