import { Code2, Cpu, Database, Layers, Server, Shield, Smartphone, Zap } from "lucide-react";

const techStack = [
  { name: "Next.js 15", category: "Frontend Framework", icon: Layers },
  { name: "React 19", category: "UI Architecture", icon: Code2 },
  { name: "FastAPI", category: "Python Backend API", icon: Server },
  { name: "PostgreSQL", category: "Enterprise Database", icon: Database },
  { name: "Python 3.12", category: "AI & Decision Engine", icon: Cpu },
  { name: "Tailwind CSS", category: "Design System", icon: Zap },
  { name: "Docker", category: "Container Deployment", icon: Shield },
];

export function TechStackSection() {
  return (
    <section className="border-y border-border/60 bg-muted/20 py-10">
      <div className="container mx-auto px-4">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Powered by Enterprise-Grade Technology Architecture
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {techStack.map((tech) => {
            const Icon = tech.icon;
            return (
              <div
                key={tech.name}
                className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-card/60 px-4 py-2 shadow-xs transition-all hover:border-primary/40 hover:bg-card"
              >
                <Icon className="size-4 text-primary" aria-hidden="true" />
                <div className="text-left">
                  <p className="text-xs font-bold text-foreground">{tech.name}</p>
                  <p className="text-[10px] text-muted-foreground">{tech.category}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
