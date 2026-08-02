"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  FileText,
  Landmark,
  Play,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-gradient-to-b from-background via-background/95 to-primary/5 pt-12 pb-20 md:pt-20 md:pb-28"
    >
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-primary/10 blur-[120px]" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Headline & CTAs */}
          <div className="flex flex-col items-start text-left lg:col-span-7">
            {/* Feature Badges pill */}
            <div className="mb-6 inline-flex flex-wrap items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary backdrop-blur">
              <Sparkles className="size-3.5 animate-pulse text-primary" aria-hidden="true" />
              <span>Next-Gen Enterprise BI</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-foreground">AI Business Twin</span>
            </div>

            <h1
              id="hero-title"
              className="text-balance text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:leading-[1.15]"
            >
              AI-Powered Business Intelligence for{" "}
              <span className="bg-gradient-to-r from-primary via-blue-500 to-teal-400 bg-clip-text text-transparent">
                MSMEs
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg md:text-xl leading-relaxed">
              Make smarter business decisions with AI-driven insights, business
              health scoring, government scheme discovery, analytics, and executive
              reports—all in one platform.
            </p>

            {/* Feature Pill Tags */}
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { label: "AI Business Advisor", icon: Bot },
                { label: "Business Health Score", icon: TrendingUp },
                { label: "Business Digital Twin", icon: Building2 },
                { label: "Government Schemes", icon: Landmark },
                { label: "Executive Reports", icon: FileText },
              ].map((badge) => {
                const Icon = badge.icon;
                return (
                  <span
                    key={badge.label}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/80 px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur"
                  >
                    <Icon className="size-3 text-primary" />
                    {badge.label}
                  </span>
                );
              })}
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
              <Button asChild size="lg" className="gap-2 shadow-lg shadow-primary/20 text-base h-12 px-8">
                <Link href="/login">
                  Get Started Free
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="gap-2 h-12 px-6 border-border hover:bg-muted/50"
              >
                <a href="#showcase">
                  <Play className="size-4 fill-current text-primary" aria-hidden="true" />
                  Watch Product Demo
                </a>
              </Button>
            </div>

            {/* Trust points */}
            <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3.5 text-emerald-500" /> Free Tier Available
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3.5 text-emerald-500" /> Sub-50ms AI Engine
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3.5 text-emerald-500" /> Deterministic Rule Engine
              </span>
            </div>
          </div>

          {/* Right Column: Dashboard Mockup Card */}
          <div className="lg:col-span-5">
            <div className="relative rounded-2xl border border-border bg-card/90 p-4 shadow-2xl backdrop-blur hover-lift transition-all">
              {/* Card top bar */}
              <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-red-500/80" />
                  <span className="size-3 rounded-full bg-amber-500/80" />
                  <span className="size-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground">UrsBiz Executive Console</span>
              </div>

              {/* Mockup content */}
              <div className="space-y-4">
                {/* Health Score Pill */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Business Health Score</p>
                      <h3 className="text-2xl font-extrabold text-foreground mt-0.5">78 <span className="text-sm font-normal text-muted-foreground">/ 100</span></h3>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-500">
                      Strong Growth
                    </span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-gradient-to-r from-primary to-teal-400 w-[78%]" />
                  </div>
                </div>

                {/* Scheme Callout */}
                <div className="rounded-xl border border-border bg-muted/30 p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-teal-500/15 text-teal-500 font-bold">
                      <Landmark className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">PMEGP Capital Subsidy</p>
                      <p className="text-[11px] text-muted-foreground">Up to 35% subsidy matched</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-bold text-teal-500">
                    95% Match
                  </span>
                </div>

                {/* Action Recommendation */}
                <div className="rounded-xl border border-border bg-card p-3.5 text-xs">
                  <p className="font-semibold text-primary">Daily Priority Action</p>
                  <p className="text-muted-foreground mt-1 leading-relaxed">
                    Reinvest ₹2,50,000 into working capital to boost 12-month revenue trajectory by +24%.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
