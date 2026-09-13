import fs from 'node:fs';
const recovery = fs.readFileSync('src/lib/lia/adaptive-recovery.ts','utf8');
const runtime = fs.readFileSync('src/lib/lia/orchestrator-runtime.ts','utf8');
const migration = fs.readFileSync('supabase/migrations/0065_lia_adaptive_recovery.sql','utf8');
if (!recovery.includes('retry_same') || !recovery.includes('switch_to_safe_observation') || !recovery.includes('retryCount >= 3')) throw new Error('recovery guardrails missing');
if (!runtime.includes('decideLiaRecovery') || !runtime.includes('recovery_strategy')) throw new Error('runtime recovery wiring missing');
if (!migration.includes('recovery_strategy')) throw new Error('migration missing');
console.log('✓ adaptive recovery contract');
