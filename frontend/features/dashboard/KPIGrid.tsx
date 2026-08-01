"use client";

import React from "react";
import { KPICard, KPICardProps, KPICardSkeleton } from "./KPICard";
import {
  Building2,
  Users,
  Package,
  MapPin,
  Calendar,
  Percent,
} from "lucide-react";

export interface KPIGridProps {
  kpis?: {
    businessName?: string | null;
    business_name?: string | null;
    industry?: string | null;
    employees?: number;
    products?: number;
    services?: number;
    locations?: number;
    yearsInBusiness?: number;
    years_in_business?: number;
    profileCompletion?: number;
    profile_completion?: number;
    [key: string]: any;
  } | null;
  isLoading?: boolean;
}

export function KPIGrid({ kpis, isLoading = false }: KPIGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const k = kpis || {};
  const name = k.businessName || k.business_name || "N/A";
  const industry = k.industry || "N/A";
  const emp = k.employees ?? 0;
  const prods = k.products ?? 0;
  const servs = k.services ?? 0;
  const locs = k.locations ?? 0;
  const years = k.yearsInBusiness ?? k.years_in_business ?? 0;
  const completion = k.profileCompletion ?? k.profile_completion ?? 0;

  const items: KPICardProps[] = [
    {
      label: "Business Name",
      value: name,
      subtext: `Industry: ${industry}`,
      icon: <Building2 className="size-4" aria-hidden="true" />,
      tone: "sky",
    },
    {
      label: "Workforce",
      value: emp > 0 ? `${emp} employees` : "0 employees",
      subtext: emp > 0 ? "Active team" : "No team details",
      icon: <Users className="size-4" aria-hidden="true" />,
      tone: "indigo",
      trend: { value: "Stable", direction: "neutral" },
    },
    {
      label: "Products & Services",
      value: `${prods} / ${servs}`,
      subtext: `${prods} products, ${servs} services`,
      icon: <Package className="size-4" aria-hidden="true" />,
      tone: "purple",
      trend: prods > 0 ? { value: "+Active", direction: "up" } : undefined,
    },
    {
      label: "Active Markets",
      value: locs > 0 ? `${locs} region${locs > 1 ? "s" : ""}` : "1 region",
      subtext: "Domestic & export locations",
      icon: <MapPin className="size-4" aria-hidden="true" />,
      tone: "rose",
    },
    {
      label: "Business Age",
      value: years > 0 ? `${years} years` : "< 1 year",
      subtext: "Operating maturity",
      icon: <Calendar className="size-4" aria-hidden="true" />,
      tone: "neutral",
    },
    {
      label: "Profile Completion",
      value: `${completion}%`,
      subtext: completion === 100 ? "Fully completed" : "Pending items",
      icon: <Percent className="size-4" aria-hidden="true" />,
      tone: completion >= 80 ? "emerald" : "amber",
      trend:
        completion >= 80
          ? { value: "Optimal", direction: "up" }
          : { value: "Action", direction: "neutral" },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item, idx) => (
        <KPICard key={idx} {...item} />
      ))}
    </div>
  );
}
