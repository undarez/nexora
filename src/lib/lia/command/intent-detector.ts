import type { LiaCommandIntent,LiaCommandParameters,LiaIntentResult } from "./types.ts";
const normalize=(v:string)=>v.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const rules:Array<{intent:LiaCommandIntent;patterns:RegExp[];confidence:number;reason:string}>=[
{intent:"system.health_check",patterns:[/\b(verifie|verifier|check|sante|etat|fonctionne|fonctionnement).*(systeme|serveur|nexora|lia|application)/i,/\b(etat|sante).*(application|nexora)/i],confidence:97,reason:"Demande explicite d'état du système."},
{intent:"system.diagnostics",patterns:[/\b(erreur|bug|incident|diagnostic|logs?|journal|panne|ne fonctionne pas)\b/i],confidence:94,reason:"La demande concerne un diagnostic technique."},
{intent:"research.learn",patterns:[/\b(apprends?|apprendre|etudie|forme[- ]toi|forme toi|documente[- ]toi)\b/i],confidence:97,reason:"Demande explicite d'apprentissage."},
{intent:"research.search",patterns:[/\b(recherche|cherche|trouve|internet|web|source|actualite|actualites|veille)\b/i],confidence:96,reason:"Demande explicite de recherche externe."},
{intent:"mobility.fuel.read",patterns:[/\b(prix|cout|depense).*(essence|carburant|gazole|diesel|e10|e5|sp98|e85|gpl)/i,/\b(essence|carburant|gazole|diesel).*(prix|cout|depense)/i],confidence:96,reason:"La demande porte sur le carburant."},
{intent:"mobility.trip.cost",patterns:[/\b(trajet|route|aller|retour|kilometre|km).*(cout|couter|prix|carburant|essence)/i,/\bcombien.*(trajet|aller|retour).*(coute|cout)/i],confidence:96,reason:"La demande porte sur le coût d'un trajet."},
{intent:"mobility.vehicle.read",patterns:[/\b(moto|voiture|scooter|vehicule).*(consommation|chevaux|modele|caracteristique)/i],confidence:94,reason:"La demande porte sur un véhicule."},
{intent:"finance.budget.allocate",patterns:[/\b(mets?|ajoute|transfere|alloue|affecte|place).*(budget|enveloppe)/i],confidence:96,reason:"La demande modifie une enveloppe."},
{intent:"finance.budget.read",patterns:[/\b(combien|reste|restant|budget|enveloppe|depense|depenses).*(budget|enveloppe|depense|depenses)/i,/\bmon budget|mes enveloppes\b/i],confidence:93,reason:"La demande consulte le budget."},
{intent:"finance.transactions.read",patterns:[/\b(transactions?|operations?|mouvements?|achats?|depenses?).*(liste|voir|montre|affiche|combien|quelles?)/i],confidence:92,reason:"La demande consulte les transactions."},
{intent:"finance.spending.analyze",patterns:[/\b(analyse|analyser|pourquoi|evolution|evolue|augmente|baisse|depense|depenses).*(depense|depenses|mois|budget)/i,/\bpourquoi.*depense/i],confidence:94,reason:"La demande analyse les dépenses."},
{intent:"finance.goal.read",patterns:[/\b(objectif|objectifs|epargne).*(combien|avance|reste|atteindre|progression)/i],confidence:92,reason:"La demande consulte un objectif."},
{intent:"data.deduplicate",patterns:[/\b(doublons?|doublon|dupliquer|duplicates?)\b/i],confidence:98,reason:"La demande concerne les doublons."},
{intent:"data.quality_check",patterns:[/\b(qualite|coherence|coherent|donnees|incoherentes|nettoie|nettoyer|anomalie|anomalies)\b/i],confidence:88,reason:"La demande concerne la qualité des données."},
{intent:"copywriting.generate",patterns:[/\b(copywriting|texte|redige|ecris|ecrire|landing|email|message marketing|contenu)\b/i],confidence:90,reason:"La demande relève de la rédaction."},
{intent:"seo.audit",patterns:[/\b(seo|referencement|meta title|meta description|mots?[- ]cles?|sitemap|robots)\b/i],confidence:98,reason:"La demande relève du SEO."},
{intent:"productivity.task.create",patterns:[/\b(rappel|rappelle[- ]moi|tache|todo)\b/i],confidence:94,reason:"La demande concerne une tâche ou un rappel."}];
function params(intent:LiaCommandIntent,input:string):LiaCommandParameters{
 const n=normalize(input),p:LiaCommandParameters={};
 const amount=n.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)/i)?.[1]; if(amount)p.amount_eur=Number(amount.replace(",",".")); 
 const km=n.match(/(\d+(?:[.,]\d+)?)\s*(?:km|kilometres?)/i)?.[1]; if(km)p.distance_km=Number(km.replace(",","."));
 const fuel=n.match(/\b(e10|e5|sp98|e85|gazole|diesel|gpl)\b/i)?.[1]; if(fuel)p.fuel_type=fuel.toLowerCase();
 const envelope=input.match(/(?:enveloppe|budget)\s+([\p{L}0-9_-]+)/iu)?.[1]; if(envelope)p.envelope=envelope;
 if(intent==="mobility.trip.cost"&&/travail|boulot|emploi/i.test(n))p.trip_type="work"; return p;
}
export function detectLiaIntent(input:string):LiaIntentResult{
 const raw=input.trim(); if(raw.length<3)return {intent:"unknown",domain:"unknown",confidence:20,parameters:{},missing:["objectif précis"],reason:"Entrée trop courte."};
 const matches=rules.filter(r=>r.patterns.some(p=>p.test(normalize(raw)))).sort((a,b)=>b.confidence-a.confidence);
 if(!matches.length)return {intent:"unknown",domain:"unknown",confidence:35,parameters:{},missing:[],reason:"Aucune intention spécialisée détectée."};
 const best=matches[0]; return {intent:best.intent,domain:best.intent.split(".")[0] as LiaIntentResult["domain"],confidence:best.confidence,parameters:params(best.intent,raw),missing:[],reason:best.reason};
}
