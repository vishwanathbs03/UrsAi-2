import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/common/EmptyState";

interface PlaceholderPageProps {
  title: string;
  description: string;
  badge?: string;
}

/**
 * Shared shell used by every "coming soon" route. Renders the page
 * header, description, and a single empty-state card so the shell
 * stays consistent and individual routes only need to declare their
 * copy.
 */
export function PlaceholderPage({ title, description, badge = "Coming soon" }: PlaceholderPageProps) {
  return (
    <PageContainer width="wide">
      <div className="mb-8 flex flex-col gap-2">
        <span className="inline-flex w-fit items-center rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {badge}
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">{description}</p>
      </div>

      <EmptyState
        title="This module is under construction"
        description="We're building this area as part of an upcoming sprint. Check back soon."
      />

      <div className="mt-8">
        <Button asChild variant="outline" size="sm">
          <Link href="/">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to home
          </Link>
        </Button>
      </div>
    </PageContainer>
  );
}
