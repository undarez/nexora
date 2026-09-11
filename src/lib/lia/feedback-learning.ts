export type LiaFeedbackSignal = "helpful" | "not_helpful" | "accepted" | "rejected" | "corrected";

export type LiaFeedback = {
  signal: LiaFeedbackSignal;
  note?: string;
  recommendationId?: string | null;
  conversationId?: string | null;
};

/**
 * Governance boundary for explicit user feedback.
 * Feedback is evidence about the interaction, not truth and never an automatic policy/model update.
 */
export function normalizeLiaFeedback(input: LiaFeedback) {
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 1000) : "";
  return {
    signal: input.signal,
    note,
    recommendationId: input.recommendationId ?? null,
    conversationId: input.conversationId ?? null,
    learningGate: "candidate",
    modelWeightUpdate: false,
    policyUpdate: false,
    financialFactUpdate: false,
  } as const;
}

export function feedbackEvidenceWeight(signal: LiaFeedbackSignal): number {
  switch (signal) {
    case "corrected": return 0.9;
    case "accepted": return 0.6;
    case "rejected": return 0.6;
    case "helpful": return 0.4;
    case "not_helpful": return 0.4;
  }
}
