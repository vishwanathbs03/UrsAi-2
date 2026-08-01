import { apiClient } from "./api-client";

export interface MonthlyGrowthItem {
  month: string;
  revenue: number;
  growth_rate: number;
}

export interface HealthHistoryItem {
  month: string;
  score: number;
}

export interface BusinessAnalyticsData {
  profile_completion: number;
  health_score: number;
  employee_distribution: Record<string, number>;
  products_count: number;
  services_count: number;
  locations_count: number;
  years_in_business: number;
  industry: string;
  business_age_category: string;
  monthly_growth: MonthlyGrowthItem[];
  health_history: HealthHistoryItem[];
}

export interface BusinessAnalyticsResponse {
  generated_at: string;
  analytics: BusinessAnalyticsData;
}

export class BusinessAnalyticsService {
  async getAnalytics(): Promise<BusinessAnalyticsResponse> {
    return apiClient.get<BusinessAnalyticsResponse>("/api/v1/business/analytics");
  }
}

export const businessAnalyticsService = new BusinessAnalyticsService();
