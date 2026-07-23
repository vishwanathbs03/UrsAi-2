import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Call-to-action section. Placeholder buttons per milestone scope.
 */
export function CtaSection() {
  return (
    <section aria-labelledby="cta-title" className="bg-background">
      <div className="container py-20 md:py-24">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card px-6 py-16 text-center shadow-card md:px-12">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
          <div className="relative">
            <h2
              id="cta-title"
              className="text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
            >
              Ready to make decisions, not guesses?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
              Start your free trial today and experience what intelligence
              actually feels like for a growing business.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
          </div>
        </div>
      </div>
    </section>
  );
}
