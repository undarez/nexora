import {
  buildLiaRecommendation,
  formatLiaRecommendation,
  type LiaRecommendation,
} from "@/lib/lia/recommendation-engine";

export type LiaRecommendationContext = {
  objective: string;
  balance: number;
  income90d: number;
  expense90d: number;
  transactionCount: number;
  hasBudget: boolean;
  riskSignals: number;
  confidenceScore: number;
};

export function buildLiaRecommendationContext(args: LiaRecommendationContext): LiaRecommendation {
  return buildLiaRecommendation(args);
}

export function formatLiaRecommendationContext(recommendation: LiaRecommendation): string {
  return formatLiaRecommendation(recommendation);
}
