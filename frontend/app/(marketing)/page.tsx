import { HeroSection } from "@/components/marketing/HeroSection";
import { TechStackSection } from "@/components/marketing/TechStackSection";
import { FeaturesSection } from "@/components/marketing/FeaturesSection";
import { ProductShowcaseSection } from "@/components/marketing/ProductShowcaseSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { WhyUrsBizSection } from "@/components/marketing/WhyUrsBizSection";
import { ImpactSection } from "@/components/marketing/ImpactSection";
import { TestimonialsSection } from "@/components/marketing/TestimonialsSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { CtaSection } from "@/components/marketing/CtaSection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <TechStackSection />
      <FeaturesSection />
      <ProductShowcaseSection />
      <HowItWorksSection />
      <WhyUrsBizSection />
      <ImpactSection />
      <TestimonialsSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
