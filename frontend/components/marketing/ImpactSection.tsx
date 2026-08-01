import { Building, Globe, Flame, Clock } from "lucide-react";

const stats = [
  {
    val: "63M+",
    label: "Indian MSMEs",
    desc: "Empowered small businesses driving regional innovation.",
    icon: Building,
  },
  {
    val: "30%",
    label: "GDP Contribution",
    desc: "Core economic backbone of emerging national markets.",
    icon: Globe,
  },
  {
    val: "110M+",
    label: "Employment Impact",
    desc: "Jobs created across manufacturing and service sectors.",
    icon: Flame,
  },
  {
    val: "24×7",
    label: "AI Decision Intelligence",
    desc: "Continuous autonomous monitoring and priority briefings.",
    icon: Clock,
  },
];

export function ImpactSection() {
  return (
    <section className="bg-gradient-to-b from-background via-primary/5 to-background py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Economic Impact & Social Reach
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            Driving Scale for Grassroots Economies
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Aligned with UN SDG 8 (Decent Work & Economic Growth) to democratize CFO-level intelligence.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 text-center shadow-soft hover-lift transition-all hover:border-primary/40"
              >
                <div>
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="text-4xl font-extrabold text-foreground tracking-tight">{s.val}</h3>
                  <p className="mt-1 text-sm font-bold text-primary">{s.label}</p>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
