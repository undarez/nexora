import { liaChat, type LiaProviderMessage, type LiaProviderResult } from "@/lib/lia/provider";
import { selectHumanLiaResponse } from "@/lib/lia/conversation";

export type LiaModelResponseInput = {
  messages: LiaProviderMessage[];
  fallback: string;
  deterministicModel: string;
  enabled: boolean;
  timeoutMs?: number;
};

export type LiaModelResponseResult = {
  content: string;
  model: string;
  provider: LiaProviderResult["provider"];
  usage: NonNullable<LiaProviderResult["usage"]> | null;
  rejectedGenerated: boolean;
  durationMs: number;
};

export async function runLiaModelResponse(input: LiaModelResponseInput): Promise<LiaModelResponseResult> {
  if (!input.enabled) {
    return {
      content: input.fallback,
      model: input.deterministicModel,
      provider: "deterministic",
      usage: null,
      rejectedGenerated: false,
      durationMs: 0,
    };
  }

  const startedAt = Date.now();
  try {
    const result = await liaChat(input.messages, AbortSignal.timeout(input.timeoutMs ?? 60_000));
    const safeGenerated = selectHumanLiaResponse(result.content, input.fallback);
    return {
      content: safeGenerated.content,
      model: safeGenerated.rejectedGenerated ? input.deterministicModel : result.model,
      provider: safeGenerated.rejectedGenerated ? "deterministic" : result.provider,
      usage: safeGenerated.rejectedGenerated ? null : result.usage ?? null,
      rejectedGenerated: safeGenerated.rejectedGenerated,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    console.warn("Enrichissement génératif indisponible; conservation de l'analyse déterministe:", error instanceof Error ? error.message : error);
    return {
      content: input.fallback,
      model: input.deterministicModel,
      provider: "deterministic",
      usage: null,
      rejectedGenerated: true,
      durationMs: Date.now() - startedAt,
    };
  }
}
