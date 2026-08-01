"use client";

import { useCallback } from "react";
import { Download, Printer, RefreshCcw } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReportHeaderProps {
  lastAnalyzedAt: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

/**
 * Report header — title, last-analysed timestamp, Refresh
 * control, Print, and Download PDF placeholder button.
 *
 * The Print button calls `window.print()`. The Download PDF
 * button is a placeholder per the milestone spec — the
 * backend has no PDF endpoint yet. Both buttons are wrapped
 * in a "no-print" class so the @media print block in
 * PrintStyles hides them.
 */
export function ReportHeader({
  lastAnalyzedAt,
  isRefreshing,
  onRefresh,
}: ReportHeaderProps) {
  const handlePrint = useCallback(() => {
    if (typeof window === "undefined") return;
    window.print();
  }, []);

  const handleDownloadPlaceholder = useCallback(() => {
    // Placeholder: PDF generation is out of scope for Sprint 6
    // Part 2. Surface a non-blocking toast-like message via
    // window.print() so the user can still "save as PDF"
    // through the browser's print dialog. This is the same
    // UX a placeholder typically offers until the backend
    // ships a real PDF endpoint.
    if (typeof window === "undefined") return;
    window.print();
  }, []);

  return (
    <DashboardCard
      badge="Executive Report"
      title="Business Executive Report"
      caption="A consolidated read of the business across every analytical engine. Print-ready; downloadable as PDF through the browser's print dialog."
      trailing={
        <div className="report-no-print flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={isRefreshing ? "Refreshing report" : "Refresh report"}
          >
            <RefreshCcw
              className={cn(
                "size-4 transition-transform",
                isRefreshing && "animate-spin",
              )}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">
              {isRefreshing ? "Refreshing" : "Refresh"}
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            aria-label="Print report"
          >
            <Printer className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Print Report</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const res = await fetch("/api/v1/reports/csv", { credentials: "include" });
                if (res.ok) {
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "Business_Dashboard_Export.csv";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }
              } catch {
                // ignore
              }
            }}
            aria-label="Download CSV Data Export"
          >
            <Download className="size-4 text-emerald-500" aria-hidden="true" />
            <span className="hidden sm:inline">Download CSV</span>
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={async () => {
              try {
                const res = await fetch("/api/v1/reports/pdf?report_type=executive", { credentials: "include" });
                if (res.ok) {
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "Executive_Business_Report.pdf";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  return;
                }
              } catch {
                // ignore
              }
              handlePrint();
            }}
            aria-label="Download PDF Report"
          >
            <Download className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Download PDF</span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-1.5 rounded-full bg-primary"
            aria-hidden="true"
          />
          Last analysis
        </span>
        <span className="font-mono text-foreground">
          {lastAnalyzedAt ? formatTimestamp(lastAnalyzedAt) : "—"}
        </span>
      </div>
    </DashboardCard>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
