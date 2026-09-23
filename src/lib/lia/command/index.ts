import { detectLiaIntent } from "./intent-detector.ts";
import { policyForIntent } from "./policy.ts";
import { routeLiaIntent } from "./router.ts";
import type { LiaCommandPlan } from "./types.ts";
export * from "./types.ts";
export * from "./intent-detector.ts";
export * from "./policy.ts";
export * from "./router.ts";
export function buildLiaCommandPlan(input:string):LiaCommandPlan {
 const intent=detectLiaIntent(input);
 return {input:input.trim().slice(0,4000),intent,policy:policyForIntent(intent.intent),route:routeLiaIntent(intent.intent)};
}
