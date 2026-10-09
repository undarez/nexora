import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const gateway = read("src/lib/lia/voice/gateway.ts");
const route = read("src/app/api/lia/voice/synthesize/route.ts");
const conversation = read("src/lib/lia/chat-conversation.ts");
const nexo = read("src/components/nexo/nexo-assistant.tsx");
const authPage = read("src/app/auth/page.tsx");
const landingPage = read("src/app/(landing)/page.tsx");
const onboardingPage = read("src/app/onboarding/page.tsx");
const authCallback = read("src/app/auth/callback/route.ts");
const authConfirm = read("src/app/auth/confirm/route.ts");
const weeklyReport = read("src/lib/lia/weekly-financial-report.ts");
const runtimeCron = read("src/app/api/lia/runtime/cron/route.ts");
const protectedLayout = read("src/app/(protected)/layout.tsx");
const weeklyMigration = read("supabase/migrations/20261009100000_lia_weekly_financial_report.sql");

const required = [
  ["Fish Audio provider", gateway.includes('"fish"')],
  ["Fish API endpoint", gateway.includes("https://api.fish.audio/v1/tts")],
  ["Fish server dispatch", gateway.includes('if (provider === "fish") return fish(request)')],
  ["server-side Fish secret", gateway.includes("FISH_AUDIO_API_KEY")],
  ["voice synthesis route", route.includes("synthesizeVoice") && route.includes("export async function POST")],
  ["same-origin protection", route.includes("assertSameOrigin")],
  ["authentication", route.includes("supabase.auth.getUser()")],
  ["conversation evaluation", conversation.includes("evaluateAndCorrectLiaResponse")],
  ["evaluation persistence", conversation.includes("lia_response_evaluations")],
  ["Nexo microphone", nexo.includes("SpeechRecognition") && nexo.includes("<Mic")],
  ["Nexo spoken response", nexo.includes("speakLia") && nexo.includes("/api/lia/voice/synthesize")],
  ["password login always redirects to dashboard", authPage.includes('window.location.replace("/dashboard")')],
  ["existing sessions leave auth page for dashboard", authPage.includes('supabase.auth.getUser().then(({ data }) =>') && authPage.includes('window.location.replace("/dashboard")')],
  ["authenticated visitors leave landing page", landingPage.includes('const supabase = await createClient()') && landingPage.includes('if (user) redirect("/dashboard")')],
  ["existing users bypass workspace choice by default", onboardingPage.includes('searchParams.get("setup") === "1"') && onboardingPage.includes('else if (!setupRequested) router.replace("/dashboard")')],
  ["OAuth callback always redirects to dashboard", authCallback.includes('new URL("/dashboard", url.origin)') && !authCallback.includes('new URL(next, url.origin)')],
  ["email confirmation redirects to dashboard", authConfirm.includes('new URL("/dashboard", url.origin)')],
  ["weekly report calculates finance score", weeklyReport.includes("${score}/100") && weeklyReport.includes("criteria") && weeklyReport.includes("score")],
  ["weekly report sends through server email provider", weeklyReport.includes("sendNexoraEmail")],
  ["weekly report cron action is dispatched", runtimeCron.includes('"weekly_financial_report"') && runtimeCron.includes("sendWeeklyFinancialReport")],
  ["weekly report job is idempotently provisioned", protectedLayout.includes("lia_ensure_weekly_financial_report_job") && weeklyMigration.includes("lia_runtime_jobs_weekly_financial_report_uidx")],
];

for (const [name, ok] of required) {
  if (!ok) throw new Error("Missing contract: " + name);
}

if (route.includes("NEXT_PUBLIC_") && route.includes("API_KEY")) {
  throw new Error("Voice route must not expose provider secrets");
}

console.log("LIA voice + Nexo evaluation regression: PASS");
