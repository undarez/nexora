import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const gateway = read("src/lib/lia/voice/gateway.ts");
const route = read("src/app/api/lia/voice/synthesize/route.ts");
const conversation = read("src/lib/lia/chat-conversation.ts");
const nexo = read("src/components/nexo/nexo-assistant.tsx");

const required = [
  ["Fish Audio provider", gateway.includes('"fish"')],
  ["Fish API endpoint", gateway.includes("https://api.fish.audio/v1/tts")],
  ["server-side Fish secret", gateway.includes("FISH_AUDIO_API_KEY")],
  ["voice synthesis route", route.includes("/api/lia/voice/synthesize")],
  ["same-origin protection", route.includes("assertSameOrigin")],
  ["authentication", route.includes('supabase.auth.getUser()')],
  ["conversation evaluation", conversation.includes("evaluateAndCorrectLiaResponse")],
  ["evaluation persistence", conversation.includes("lia_response_evaluations")],
  ["Nexo microphone", nexo.includes("SpeechRecognition") && nexo.includes("<Mic")],
  ["Nexo spoken response", nexo.includes("speakLia") && nexo.includes("/api/lia/voice/synthesize")],
];

for (const [name, ok] of required) {
  if (!ok) throw new Error("Missing contract: " + name);
}

if (route.includes("NEXT_PUBLIC_") && route.includes("API_KEY")) {
  throw new Error("Voice route must not expose provider secrets");
}

console.log("LIA voice + Nexo evaluation regression: PASS");
