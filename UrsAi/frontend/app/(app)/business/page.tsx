import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export const metadata: Metadata = {
  title: "Business",
};

export default function BusinessPage() {
  return (
    <ProtectedRoute>
      <PlaceholderPage
        badge="Business"
        title="Your Business DNA"
        description="Tell Atlas about your business once. We'll model the rest — revenue, costs, unit economics — and keep it in sync as you grow."
      />
    </ProtectedRoute>
  );
}
