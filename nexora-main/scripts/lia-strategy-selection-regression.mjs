import assert from 'node:assert/strict';
import { selectStrategyV2 } from '../src/lib/lia/strategy-selection.ts';
const base={objectiveType:'budget',budget:true,finance:true,autonomyLevel:1,maxAutonomyLevel:2};
const out=selectStrategyV2({
 allowed:['budget-first','research-first'],
 experiences:[{strategyKey:'budget-first',outcome:'success',score:100,context:base}],
 memories:[{strategyKey:'budget-first',sampleSize:1,decayedScore:100,successRate:1,consistency:1,confidence:.9,contradiction:false}],
 context:base,contextKey:'budget|x',explorationRate:0,
});
assert.equal(out.selected,'budget-first');
const safe=selectStrategyV2({allowed:['safe'],experiences:[{strategyKey:'unsafe',outcome:'success',score:100}],context:base,contextKey:'x',explorationRate:.2});
assert.equal(safe.selected,'safe');
console.log('✓ strategy selection v2 contract');
