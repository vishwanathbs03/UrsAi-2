import Link from "next/link";
import { Logo } from "@/components/common/Logo";
import { theme } from "@/lib/theme";

const productLinks = [
  { href: "/", label: "Product" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/business", label: "Business" },
];

const companyLinks = [
  { href: "/", label: "About" },
  { href: "/", label: "Contact" },
  { href: "/", label: "Careers" },
];

const legalLinks = [
  { href: "/", label: "Privacy" },
  { href: "/", label: "Terms" },
  { href: "/", label: "Security" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">
              {theme.brand.tagline}
            </p>
          </div>

          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground md:flex-row md:items-center">
          <p>© {year} {theme.brand.name}. All rights reserved.</p>
          <p>Built for the international hackathon.</p>
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
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
