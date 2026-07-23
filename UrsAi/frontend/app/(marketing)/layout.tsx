import { AppLayout } from "@/components/layout/AppLayout";
import { Footer } from "@/components/layout/Footer";

/**
 * Marketing layout: navbar + footer, no sidebar. Used for the public
 * landing page and any future marketing routes.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout withSidebar={false}>
      <div className="flex flex-1 flex-col">{children}</div>
      <Footer />
    </AppLayout>
  );
}
