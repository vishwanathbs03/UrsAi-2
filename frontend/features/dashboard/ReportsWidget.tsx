"use client";

import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Download, FileText, Printer, FileSpreadsheet } from "lucide-react";

export function ReportsWidget() {
  return (
    <DashboardCard
      badge="Executive Exports"
      title="Audit-Ready Executive Reports"
      caption="Export bank-ready PDF and CSV reports formatted for CAs, lenders, and investors."
      trailing={
        <Button asChild size="sm" variant="outline" className="gap-1 text-xs">
          <Link href="/reports">
            Reports Center
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          asChild
          variant="outline"
          className="flex h-auto items-center justify-between p-3.5 text-left border-border/80 hover:border-primary/40 hover:bg-muted/40 transition-all"
        >
          <Link href="/reports">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Executive Brief PDF</p>
                <p className="text-[10px] text-muted-foreground">Full Health & Scheme Analysis</p>
              </div>
            </div>
            <Download className="size-4 text-muted-foreground" />
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          className="flex h-auto items-center justify-between p-3.5 text-left border-border/80 hover:border-primary/40 hover:bg-muted/40 transition-all"
        >
          <Link href="/reports">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">KPI Data CSV Export</p>
                <p className="text-[10px] text-muted-foreground">Raw Metrics & Parameters</p>
              </div>
            </div>
            <Download className="size-4 text-muted-foreground" />
          </Link>
        </Button>
      </div>
    </DashboardCard>
  );
}
