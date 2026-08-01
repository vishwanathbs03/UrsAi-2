import Link from "next/link";
import { Logo } from "@/components/common/Logo";
import { theme } from "@/lib/theme";
import { Github, Mail, ShieldCheck } from "lucide-react";

const productLinks = [
  { href: "/dashboard", label: "Executive Dashboard" },
  { href: "/business", label: "Business Digital Twin" },
  { href: "/schemes", label: "Government Schemes" },
  { href: "/analytics", label: "Predictive Analytics" },
  { href: "/advisor", label: "AI Advisor" },
];

const featureLinks = [
  { href: "/dashboard", label: "Health Score Engine" },
  { href: "/schemes", label: "PMEGP & Subsidies" },
  { href: "/reports", label: "1-Click PDF Exports" },
  { href: "/notifications", label: "Critical Alerts" },
  { href: "/action-board", label: "Action Board" },
];

const resourceLinks = [
  { href: "/pitch-deck.html", label: "Keynote Presentation" },
  { href: "/#faq", label: "Frequently Asked Questions" },
  { href: "/#showcase", label: "Product Tour" },
];

const legalLinks = [
  { href: "#", label: "Privacy Policy" },
  { href: "#", label: "Terms of Service" },
  { href: "#", label: "Security Overview" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Logo size="lg" />
            <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
              {theme.brand.tagline}. Autonomous financial decision engine and government scheme discovery platform for MSMEs.
            </p>

            <div className="flex items-center gap-3 pt-2 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-4 text-emerald-500" /> Enterprise Encrypted
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Mail className="size-4 text-primary" /> founders@ursbiz.com
              </span>
            </div>
          </div>

          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Features" links={featureLinks} />
          <FooterColumn title="Resources & Legal" links={[...resourceLinks, ...legalLinks]} />
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-xs text-muted-foreground sm:flex-row">
          <p>© {year} {theme.brand.name}. All rights reserved.</p>

          <div className="flex items-center gap-6">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Github className="size-4" />
              <span>GitHub</span>
            </a>
            <Link href="#" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="#" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="text-xs font-extrabold uppercase tracking-widest text-foreground">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
