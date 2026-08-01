import { apiClient } from "./api-client";

export interface SchemeItem {
  id: string;
  name: string;
  description: string;
  category: string;
  eligibility_status: "eligible" | "partiallyEligible" | "notEligible";
  eligibility_reason: string;
  matching_score: number;
  priority: "High" | "Medium" | "Low";
  benefits: string[];
  documents_required: string[];
  application_steps: string[];
  application_link: string;
  target_industries: string[];
  max_turnover?: number;
  min_turnover?: number;
}

export interface CategorizedSchemes {
  recommended: SchemeItem[];
  eligible: SchemeItem[];
  partially_eligible: SchemeItem[];
  not_eligible: SchemeItem[];
}

export interface BusinessSchemesResponse {
  generated_at: string;
  total_schemes: number;
  schemes: CategorizedSchemes;
}

export class SchemesService {
  async getSchemes(): Promise<BusinessSchemesResponse> {
    return apiClient.get<BusinessSchemesResponse>("/api/v1/business/schemes");
  }
}

export const schemesService = new SchemesService();
