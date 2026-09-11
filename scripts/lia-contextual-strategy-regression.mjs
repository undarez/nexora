import assert from 'node:assert/strict';
import { buildStrategyContextKey, chooseContextualStrategy } from '../src/lib/lia/contextual-strategy-memory.ts';

const context = { objectiveType: 'budget', budget: true, finance: true, relational: false, autonomyLevel: 1, maxAutonomyLevel: 2 };
const key = buildStrategyContextKey(context);
assert.ok(key.includes('budget'));
const selected = chooseContextualStrategy([
  { strategyKey: 'research-first', outcome: 'success', score: 100, context: { objectiveType: 'research', research: true } },
  { strategyKey: 'budget-first', outcome: 'success', score: 60, context: { objectiveType: 'budget', budget: true, finance: true } },
], ['budget-first','research-first'], context);
assert.equal(selected, 'budget-first');
console.log('✓ contextual strategy memory contract');
