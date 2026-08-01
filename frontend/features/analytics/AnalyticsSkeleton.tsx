"use client";

import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { PageContainer } from "@/components/layout/PageContainer";

/**
 * Loading skeleton for the analytics page grid.
 */
export function AnalyticsSkeletonGrid() {
  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-4">
        <DashboardSkeleton rows={2} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardSkeleton rows={3} />
          <DashboardSkeleton rows={3} />
          <DashboardSkeleton rows={3} />
          <DashboardSkeleton rows={3} />
        </div>
        <DashboardSkeleton rows={4} />
        <DashboardSkeleton rows={5} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DashboardSkeleton rows={4} />
          <DashboardSkeleton rows={4} />
        </div>
        <DashboardSkeleton rows={4} />
        <DashboardSkeleton rows={3} />
      </div>
    </PageContainer>
  );
}
