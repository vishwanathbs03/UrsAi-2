import { useQuery } from "@tanstack/react-query";
import { intelligenceService } from "@/services/intelligence-service";
import type { IntelligenceResponse } from "@/types/dashboard";

export function useIntelligence() {
  return useQuery<IntelligenceResponse, Error>({
    queryKey: ["business-intelligence"],
    queryFn: () => intelligenceService.fetchFullIntelligence(),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
