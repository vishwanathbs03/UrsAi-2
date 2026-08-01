import { apiRequest } from "./api-client";

export interface DashboardEndpointResponse {
  business: {
    id: number;
    legal_name: string;
    industry: string;
    country?: string | null;
    annual_revenue: number;
    revenue_currency: string;
    is_completed: boolean;
    updated_at: string;
  } | null;
  kpis: {
    business_name?: string | null;
    businessName?: string | null;
    industry?: string | null;
    employees?: number;
    products?: number;
    services?: number;
    locations?: number;
    years_in_business?: number;
    yearsInBusiness?: number;
    profile_completion?: number;
    profileCompletion?: number;
    [key: string]: any;
  };
  health_score?: number;
  healthScore?: number;
  ai_summary?: string;
  aiSummary?: string;
  recent_activity?: Array<{ id?: string; title: string; timestamp?: string; category?: string }>;
  recentActivity?: Array<{ id?: string; title: string; timestamp?: string; category?: string }>;
  quick_actions?: Array<{ id?: string; label: string; href?: string; icon?: string }>;
  quickActions?: Array<{ id?: string; label: string; href?: string; icon?: string }>;
}

export const dashboardService = {
  async getDashboard(): Promise<DashboardEndpointResponse> {
    return apiRequest<DashboardEndpointResponse>("/api/v1/dashboard");
  },
};
