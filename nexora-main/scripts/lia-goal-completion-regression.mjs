import fs from 'node:fs';
const files = ['src/lib/lia/goal-completion.ts','supabase/migrations/0066_lia_goal_completion.sql'];
for (const f of files) if (!fs.existsSync(f)) throw new Error(`missing ${f}`);
const src = fs.readFileSync(files[0],'utf8');
for (const token of ['evaluateLiaGoal','all_steps_completed','needs_human','persistLiaGoalEvaluation']) if (!src.includes(token)) throw new Error(`missing ${token}`);
const sql = fs.readFileSync(files[1],'utf8');
for (const token of ['lia_goal_evaluations','row level security','progress']) if (!sql.toLowerCase().includes(token.toLowerCase())) throw new Error(`missing ${token}`);
console.log('✓ goal completion contract');
