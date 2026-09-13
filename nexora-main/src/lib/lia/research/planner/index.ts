export type ResearchPlan = { query:string; unknowns:string[]; steps:Array<{id:string; objective:string; sourceTiers:string[]; query:string; rationale:string}>; stopRules:{maxSteps:number; minStrongSources:number; stopOnContradiction:boolean; stopOnSufficientEvidence:boolean}; maxSourcesPerStep:number; autonomy:"bounded"; executionAllowed:false };
const tiers=["official","authority","standard","scientific","vendor","reputable_secondary","community"];
export function planResearch(query:string, unknowns:string[]=[], maxSteps=5):ResearchPlan{
 const q=query.trim(); const u=unknowns.filter(x=>typeof x==="string"&&x.trim()).slice(0,10);
 const objectives=u.length?u:[`Établir les faits nécessaires pour répondre à : ${q}`];
 const steps=objectives.slice(0,Math.max(1,Math.min(8,maxSteps))).map((o,i)=>({id:`research-${i+1}`,objective:o,sourceTiers:tiers.slice(0,i<2?4:6),query:`${q} ${o}`,rationale:i===0?"Commencer par les sources primaires et autorités compétentes.":"Compléter, corroborer et rechercher les éventuelles contradictions."}));
 return {query:q,unknowns:u,steps,stopRules:{maxSteps:steps.length,minStrongSources:2,stopOnContradiction:true,stopOnSufficientEvidence:true},maxSourcesPerStep:8,autonomy:"bounded",executionAllowed:false};
}
export function shouldStopResearch(input:{strongSources:number; verifiedClaims:number; contradictions:number; stepsCompleted:number; plan:ResearchPlan}){
 if(input.contradictions>0&&input.plan.stopRules.stopOnContradiction)return {stop:true,reason:"contradiction_requires_arbitration"};
 if(input.verifiedClaims>0&&input.strongSources>=input.plan.stopRules.minStrongSources&&input.plan.stopRules.stopOnSufficientEvidence)return {stop:true,reason:"sufficient_evidence"};
 if(input.stepsCompleted>=input.plan.stopRules.maxSteps)return {stop:true,reason:"step_budget_exhausted"};
 return {stop:false,reason:"more_evidence_needed"};
}
