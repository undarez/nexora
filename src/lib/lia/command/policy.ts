import type { LiaCommandIntent, LiaCommandPolicy } from "./types.ts";
export function policyForIntent(intent:LiaCommandIntent):LiaCommandPolicy {
switch(intent){
case "finance.budget.read":case "finance.transactions.read":case "finance.goal.read":case "mobility.fuel.read":case "mobility.vehicle.read":case "mobility.trip.cost":case "system.health_check":case "system.diagnostics": return {mode:intent==="system.health_check"?"analyze":"read",risk:"low",requiresConfirmation:false,allowedAutomatically:true,reason:"Lecture ou analyse sans modification persistante."};
case "finance.spending.analyze":case "data.quality_check":case "seo.audit": return {mode:"analyze",risk:"low",requiresConfirmation:false,allowedAutomatically:true,reason:"Analyse sans écriture persistante."};
case "research.search":case "research.learn":case "copywriting.generate": return {mode:"suggest",risk:"low",requiresConfirmation:false,allowedAutomatically:true,reason:"Information ou brouillon sans publication automatique."};
case "productivity.task.create":case "finance.budget.allocate": return {mode:"write",risk:"medium",requiresConfirmation:true,allowedAutomatically:false,reason:"Modification persistante ou engagement utilisateur."};
case "data.deduplicate": return {mode:"write",risk:"high",requiresConfirmation:true,allowedAutomatically:false,reason:"Déduplication potentiellement destructive."};
default:return {mode:"suggest",risk:"medium",requiresConfirmation:true,allowedAutomatically:false,reason:"Intention non spécialisée."};}}
