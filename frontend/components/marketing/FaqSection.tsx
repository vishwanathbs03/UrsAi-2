"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

const faqs = [
  {
    q: "What is UrsBiz and how does it help my business?",
    a: "UrsBiz is an AI-powered Business Intelligence Platform designed for MSMEs. It creates a digital twin of your business profile to compute a 0-100 Business Health Score, automatically match 25+ government schemes (like PMEGP, CGTMSE, Mudra), generate daily priority briefings, and export bank-ready PDF executive reports.",
  },
  {
    q: "Does UrsBiz guarantee government scheme approval?",
    a: "UrsBiz evaluates your operational profile against official ministry eligibility rules to deliver high-confidence match scores (%) and step-by-step application document checklists. Final sanctioning rests with the respective government sanctioning authority.",
  },
  {
    q: "How does the AI engine avoid hallucinations?",
    a: "UrsBiz uses a 100% deterministic rule engine for financial scoring and subsidy eligibility to ensure zero mathematical hallucinations. For natural language queries, it pairs vector RAG search over official government gazette guidelines.",
  },
  {
    q: "How long does it take to onboard my business profile?",
    a: "Onboarding takes less than 2 minutes. Simply fill out our 4-step wizard detailing your turnover, sector, workforce size, and state to instantly view your health score and eligible schemes.",
  },
  {
    q: "Can I export reports for bank loan applications?",
    a: "Yes! With one click, you can download audit-ready executive PDF and CSV reports formatted for bank loan applications, CA reviews, and investor presentations.",
  },
  {
    q: "Is there a free tier available for small businesses?",
    a: "Yes, UrsBiz offers a free core tier allowing business health score calculation, basic scheme matching, and dashboard access with zero credit card required.",
  },
];

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section className="border-t border-border bg-muted/20 py-20 md:py-28">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Frequently Asked Questions
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            Everything You Need to Know About UrsBiz
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Have questions about health scoring, scheme discovery, or executive reports? We have answers.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {faqs.map((faq, i) => {
            const isOpen = openIdx === i;

            return (
              <div
                key={faq.q}
                className="rounded-xl border border-border bg-card shadow-soft transition-all"
              >
                <button
                  onClick={() => toggle(i)}
                  className="flex w-full items-center justify-between p-5 text-left text-base font-bold text-foreground focus:outline-none"
                >
                  <span className="flex items-center gap-3">
                    <HelpCircle className="size-4 text-primary shrink-0" />
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`size-5 text-muted-foreground transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-border/60 px-5 pt-3 pb-5 text-sm text-muted-foreground leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
