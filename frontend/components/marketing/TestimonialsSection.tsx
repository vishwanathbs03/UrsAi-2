import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    quote:
      "UrsBiz matched our textile unit to a 35% PMEGP subsidy worth ₹15 Lakhs within 2 minutes of onboarding. The Health Score engine pinpointed working capital bottlenecks we had ignored for months.",
    author: "Rajesh Patel",
    role: "Founder & MD, Apex Textiles",
    location: "Ahmedabad, Gujarat",
    rating: 5,
  },
  {
    quote:
      "As a Chartered Accountant managing 40+ MSME clients, UrsBiz has become our primary reporting tool. The 1-click executive PDF exports save my team 20 hours every month during bank loan applications.",
    author: "Meera Sharma",
    role: "Senior Partner, Sharma & Associates CAs",
    location: "Mumbai, Maharashtra",
    rating: 5,
  },
  {
    quote:
      "The AI Advisor's daily priority briefings are remarkable. Having a zero-hallucination CFO assistant guiding our inventory investment choices has increased our quarterly revenue by 22%.",
    author: "Vikram Sengupta",
    role: "CEO, Precision Precision Engineering",
    location: "Bengaluru, Karnataka",
    rating: 5,
  },
];

export function TestimonialsSection() {
  return (
    <section className="border-t border-border bg-background py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Trusted by MSME Founders & CAs
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            Real Stories. Measurable Impact.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Discover how growing small businesses use UrsBiz to unlock government capital and make data-driven decisions.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.author}
              className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-soft hover-lift transition-all"
            >
              <div>
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>

                <Quote className="mt-4 size-8 text-primary/20" />

                <p className="mt-2 text-sm text-foreground leading-relaxed italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              <div className="mt-6 border-t border-border pt-4">
                <p className="text-sm font-bold text-foreground">{t.author}</p>
                <p className="text-xs text-primary font-medium">{t.role}</p>
                <p className="text-[11px] text-muted-foreground">{t.location}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
