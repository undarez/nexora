# NEXORA V5.06.18 — Build Fix

Correctifs issus du build Next/TypeScript utilisateur :
- exclusion des Supabase Edge Functions Deno des sources TypeScript Next.js ;
- correction du type Habit ;
- garde null du client Supabase dans knowledge ingest ;
- ajout de proactive_notifications dans le select cron ;
- alignement AgentToolRisk avec les risques réellement déclarés ;
- branchement explicite du Financial Autopilot sur buildFinancialSupervisorContext ;
- correction du type de retour de persistAutopilotSnapshot.

Les Edge Functions restent des artefacts Supabase/Deno et ne doivent pas être compilées par le TypeScript de l'application Next.js.
