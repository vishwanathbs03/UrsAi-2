"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  Layers,
  Palette,
  Shield,
  Sparkles,
  Type,
} from "lucide-react";
import { Logo, UrsBizIcon } from "@/components/common/Logo";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { cn } from "@/lib/utils";

const COLOR_SWATCHES = [
  {
    name: "Deep Enterprise Navy",
    role: "Primary Brand / Dark Backgrounds",
    hex: "#0A192F",
    rgb: "rgb(10, 25, 47)",
    hsl: "hsl(216, 65%, 11%)",
    bgClass: "bg-[#0A192F]",
    textClass: "text-white",
    borderClass: "border-slate-800",
  },
  {
    name: "Enterprise Slate",
    role: "Surface / Dark Mode Cards",
    hex: "#0F172A",
    rgb: "rgb(15, 23, 42)",
    hsl: "hsl(222, 47%, 11%)",
    bgClass: "bg-[#0F172A]",
    textClass: "text-white",
    borderClass: "border-slate-800",
  },
  {
    name: "Vibrant Professional Blue",
    role: "Primary Accent / CTAs / Wordmark Accent",
    hex: "#2563EB",
    rgb: "rgb(37, 99, 235)",
    hsl: "hsl(221, 83%, 53%)",
    bgClass: "bg-[#2563EB]",
    textClass: "text-white",
    borderClass: "border-blue-700",
  },
  {
    name: "Intelligent Cyan / Teal",
    role: "AI & Decision Accent / Growth Spark",
    hex: "#06B6D4",
    rgb: "rgb(6, 182, 212)",
    hsl: "hsl(189, 94%, 43%)",
    bgClass: "bg-[#06B6D4]",
    textClass: "text-slate-950",
    borderClass: "border-cyan-600",
  },
  {
    name: "Sky Highlight",
    role: "Glows / Active State Highlights",
    hex: "#38BDF8",
    rgb: "rgb(56, 189, 248)",
    hsl: "hsl(199, 89%, 60%)",
    bgClass: "bg-[#38BDF8]",
    textClass: "text-slate-950",
    borderClass: "border-sky-400",
  },
  {
    name: "Pure Light Neutral",
    role: "Light Backgrounds / Contrast Base",
    hex: "#F8FAFC",
    rgb: "rgb(248, 250, 252)",
    hsl: "hsl(210, 40%, 98%)",
    bgClass: "bg-[#F8FAFC]",
    textClass: "text-slate-900",
    borderClass: "border-slate-300",
  },
];

export default function BrandIdentityPage() {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(text);
      setCopiedHex(text);
      setTimeout(() => setCopiedHex(null), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-16">
          {/* Header */}
          <div className="space-y-4 text-center max-w-3xl mx-auto">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors pb-2"
            >
              <ArrowLeft className="size-3.5" /> Back to Application
            </Link>
            <div className="flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="size-3.5" /> Brand Guidelines &amp; Visual Identity
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              URSBiz Brand Design System
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              Enterprise SaaS Visual Identity for MSME Business Intelligence, Autonomous Decision
              Engineering, and Growth Prediction.
            </p>
            <div className="inline-block rounded-xl border border-border/80 bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary">
              ANALYZE · PREDICT · GROW · SUCCEED
            </div>
          </div>

          {/* 1. Primary Concept & Anatomy */}
          <section className="space-y-6">
            <div className="border-b border-border pb-3 flex items-center justify-between">
              <div className="space-y-0.5">
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Layers className="size-5 text-primary" /> 1. Logo Anatomy &amp; Core Concept
                </h2>
                <p className="text-xs text-muted-foreground">
                  The geometric synthesis of the letter &ldquo;U&rdquo;, multi-tiered analytics growth bars, and the predictive AI diamond star.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-border/80 bg-card p-6 flex flex-col items-center justify-center text-center space-y-3 shadow-xs">
                <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                  <span className="text-3xl font-black">U</span>
                </div>
                <h3 className="text-sm font-bold text-foreground">1. Stylized &ldquo;U&rdquo; Enclosure</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Solid geometric letterform representing Unity, Ubiquity, and the core URSBiz platform foundation.
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-6 flex flex-col items-center justify-center text-center space-y-3 shadow-xs">
                <div className="size-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-600">
                  <div className="flex items-end gap-1 h-8">
                    <span className="w-1.5 h-3 bg-cyan-500 rounded-xs" />
                    <span className="w-1.5 h-5 bg-blue-500 rounded-xs" />
                    <span className="w-1.5 h-8 bg-blue-600 rounded-xs" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-foreground">2. Ascending Analytics Bars</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Three ascending data pillars embedded within the &ldquo;U&rdquo; signifying Analyze $\rightarrow$ Predict $\rightarrow$ Grow.
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-6 flex flex-col items-center justify-center text-center space-y-3 shadow-xs">
                <div className="size-16 rounded-2xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20 text-sky-500">
                  <Sparkles className="size-8" />
                </div>
                <h3 className="text-sm font-bold text-foreground">3. Precision AI Sparkle Star</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  4-point intelligence star positioned at the upper apex representing foresight, artificial intelligence, and calculated clarity.
                </p>
              </div>
            </div>
          </section>

          {/* 2. Complete Logo Variants Matrix */}
          <section className="space-y-6">
            <div className="border-b border-border pb-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Eye className="size-5 text-primary" /> 2. Official Logo Variants
              </h2>
              <p className="text-xs text-muted-foreground">
                Approved brand lockups for application headers, dark mode, light mode, print documentation, and mobile screens.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Variant A: Primary Horizontal */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    A. Primary Horizontal Lockup
                  </span>
                  <span className="text-[10px] rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                    Hero / Marketing
                  </span>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/50 p-8 flex items-center justify-center min-h-[120px]">
                  <Logo size="lg" variant="primary" withSubtitle />
                </div>
                <p className="text-xs text-muted-foreground">
                  Includes the icon, bold URSBiz wordmark, and the official enterprise subtitle.
                </p>
              </div>

              {/* Variant B: Compact Horizontal */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    B. Compact Horizontal Lockup
                  </span>
                  <span className="text-[10px] rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                    Navbar / Sidebar
                  </span>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/50 p-8 flex items-center justify-center min-h-[120px]">
                  <Logo size="md" variant="compact" />
                </div>
                <p className="text-xs text-muted-foreground">
                  The primary application header lockup optimized for standard navigation bars.
                </p>
              </div>

              {/* Variant C: Dark Navy / Reversed */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    C. Reversed / Dark Background
                  </span>
                  <span className="text-[10px] rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                    Dark Mode / Slide Decks
                  </span>
                </div>
                <div className="rounded-xl bg-[#0A192F] p-8 flex items-center justify-center min-h-[120px] border border-slate-800">
                  <Logo size="lg" variant="white" withSubtitle />
                </div>
                <p className="text-xs text-muted-foreground">
                  High-contrast white wordmark and cyan accents for dark navy surfaces.
                </p>
              </div>

              {/* Variant D: Blue Header */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    D. Brand Blue Background
                  </span>
                  <span className="text-[10px] rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                    Marketing Banners
                  </span>
                </div>
                <div className="rounded-xl bg-[#2563EB] p-8 flex items-center justify-center min-h-[120px] shadow-sm">
                  <Logo size="lg" variant="blue" withSubtitle />
                </div>
                <p className="text-xs text-muted-foreground">
                  High-vibrancy lockup for colored header strips and banner communications.
                </p>
              </div>

              {/* Variant E: Monochrome Black */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    E. Monochrome Black / Print
                  </span>
                  <span className="text-[10px] rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                    PDFs / Formal Reports
                  </span>
                </div>
                <div className="rounded-xl bg-white p-8 flex items-center justify-center min-h-[120px] border border-slate-200 text-slate-950">
                  <Logo size="md" variant="monochrome" withSubtitle />
                </div>
                <p className="text-xs text-muted-foreground">
                  100% single-color black for thermal printing, invoices, and legal documents.
                </p>
              </div>

              {/* Variant F: Icon Only & App Icons */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    F. Icon-Only &amp; App Icon Badges
                  </span>
                  <span className="text-[10px] rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                    Favicons / App Tiles
                  </span>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/50 p-8 flex items-center justify-center gap-6 min-h-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <UrsBizIcon size={16} />
                    <span className="text-[9px] text-muted-foreground">16px</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <UrsBizIcon size={24} />
                    <span className="text-[9px] text-muted-foreground">24px</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <UrsBizIcon size={32} />
                    <span className="text-[9px] text-muted-foreground">32px</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <UrsBizIcon size={48} variant="app-icon" />
                    <span className="text-[9px] text-muted-foreground">48px App</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <UrsBizIcon size={64} variant="app-icon" />
                    <span className="text-[9px] text-muted-foreground">64px PWA</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Scales cleanly from 16px browser tab favicons to 512px app launcher icons.
                </p>
              </div>
            </div>
          </section>

          {/* 3. Color System Swatches */}
          <section className="space-y-6">
            <div className="border-b border-border pb-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Palette className="size-5 text-primary" /> 3. Color System &amp; Brand Tokens
              </h2>
              <p className="text-xs text-muted-foreground">
                Enterprise palette structured around Trust (Navy), Intelligence (Blue), and Growth (Cyan).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {COLOR_SWATCHES.map((swatch) => (
                <div
                  key={swatch.hex}
                  className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs flex flex-col"
                >
                  <div className={cn("h-24 w-full p-4 flex flex-col justify-end border-b", swatch.bgClass, swatch.textClass, swatch.borderClass)}>
                    <span className="text-sm font-bold">{swatch.name}</span>
                  </div>
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <p className="text-xs text-muted-foreground">{swatch.role}</p>
                    <div className="space-y-1 text-xs font-mono">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>HEX:</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(swatch.hex)}
                          className="font-bold text-foreground hover:text-primary inline-flex items-center gap-1"
                        >
                          {swatch.hex}
                          {copiedHex === swatch.hex ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3 text-muted-foreground" />}
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                        <span>RGB:</span>
                        <span>{swatch.rgb}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                        <span>HSL:</span>
                        <span>{swatch.hsl}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Safe Area & Clear Space Rules */}
          <section className="space-y-6">
            <div className="border-b border-border pb-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Shield className="size-5 text-primary" /> 4. Safe Area &amp; Clear Space Guidelines
              </h2>
              <p className="text-xs text-muted-foreground">
                To maintain brand prominence and visual legibility, keep minimum clear space around the logo equivalent to height $X$ of the &ldquo;U&rdquo; icon.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-8 shadow-xs">
              <div className="relative mx-auto max-w-lg rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-10 flex items-center justify-center">
                {/* Guidelines */}
                <div className="absolute top-2 left-2 text-[10px] font-mono text-primary font-bold">Clear Space: X = 32px</div>
                <Logo size="lg" variant="compact" />
              </div>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div className="rounded-xl border border-border/60 bg-background/50 p-3 space-y-1">
                  <span className="font-bold text-foreground">Do:</span>
                  <p>Maintain at least 1X padding around all edges of the logo on all backgrounds.</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/50 p-3 space-y-1">
                  <span className="font-bold text-foreground">Don&apos;t:</span>
                  <p>Do not skew, rotate, recolor outside the approved palette, or crowd with adjacent icons.</p>
                </div>
              </div>
            </div>
          </section>

          {/* 5. Typography Recommendation */}
          <section className="space-y-6">
            <div className="border-b border-border pb-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Type className="size-5 text-primary" /> 5. Typography Standards
              </h2>
              <p className="text-xs text-muted-foreground">
                Engineered for maximum legibility on digital dashboards, charts, and enterprise documents.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-3 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Primary Interface Typeface
                </span>
                <h3 className="text-2xl font-black text-foreground">Inter &amp; System Geometric UI</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Clean, open aperture geometric sans-serif designed for high-density SaaS user interfaces, tables, and analytics cards.
                </p>
                <div className="pt-2 text-xs font-mono text-muted-foreground bg-muted/40 p-2.5 rounded-lg">
                  font-family: ui-sans-serif, system-ui, -apple-system, &ldquo;Segoe UI&rdquo;, Roboto, sans-serif;
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-3 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Indic / Kannada Unicode Font Stack
                </span>
                <h3 className="text-2xl font-black text-foreground">Noto Sans Kannada</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Engineered for fluent, high-contrast Kannada script rendering across all Windows, macOS, and mobile browsers.
                </p>
                <div className="pt-2 text-xs font-mono text-muted-foreground bg-muted/40 p-2.5 rounded-lg">
                  font-family: &ldquo;Noto Sans Kannada&rdquo;, &ldquo;Tunga&rdquo;, &ldquo;Kedage&rdquo;, sans-serif;
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
