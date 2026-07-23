import { HeroSection } from "@/components/marketing/HeroSection";
import { ProblemSection } from "@/components/marketing/ProblemSection";
import { FeaturesSection } from "@/components/marketing/FeaturesSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { CtaSection } from "@/components/marketing/CtaSection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <CtaSection />
    </>
  );
}
