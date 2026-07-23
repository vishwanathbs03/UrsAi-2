import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Hero section — primary headline, supporting copy, and two CTAs.
 * Buttons are non-functional placeholders per the milestone scope.
 */
export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-radial-fade"
    >
      <div className="container relative flex flex-col items-center py-24 text-center md:py-32">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          <span>Introducing Atlas AI</span>
        </span>

        <h1
          id="hero-title"
          className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground md:text-6xl"
        >
          The intelligence layer for modern SMBs
        </h1>

        <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
          Atlas AI turns operational data into clear decisions — without
          dashboards, without spreadsheets, without a data team.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/register">
              Get Started
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#features">Learn More</Link>
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required • 14-day free trial
        </p>
      </div>
    </section>
  );
}
