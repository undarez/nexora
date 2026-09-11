export type NexoraBrainMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type NexoraBrainProvider = "native" | "llama_cpp" | "ollama" | "remote" | "deterministic";

export type NexoraBrainMode =
  | "native_first"
  | "native_only"
  | "local_first"
  | "local_only"
  | "remote_only"
  | "deterministic_only";

export type NexoraBrainUsage = {
  inputChars?: number | null;
  outputChars?: number | null;
  generatedTokens?: number | null;
  tokensPerSecond?: number | null;
  latencyMs?: number | null;
};

export type NexoraBrainResult = {
  content: string;
  model: string;
  provider: NexoraBrainProvider;
  usage?: NexoraBrainUsage;
};

export type NexoraBrainHealth = {
  mode: NexoraBrainMode;
  selected: NexoraBrainProvider;
  native: { configured: boolean; healthy: boolean };
  local: { configured: boolean; healthy: boolean; engine: "llama_cpp" | "ollama" | null };
  remote: { configured: boolean; healthy: boolean };
};
