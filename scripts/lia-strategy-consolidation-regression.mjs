import assert from 'node:assert/strict';
import { consolidateStrategyExperiences } from '../src/lib/lia/strategy-consolidation.ts';
const memories = consolidateStrategyExperiences([
 {strategyKey:'budget-first',outcome:'success',score:100,createdAt:new Date().toISOString()},
 {strategyKey:'budget-first',outcome:'success',score:80,createdAt:new Date().toISOString()},
 {strategyKey:'budget-first',outcome:'failed',score:-100,createdAt:new Date().toISOString()},
 {strategyKey:'research-first',outcome:'failed',score:-100,createdAt:new Date().toISOString()},
]);
assert.equal(memories[0].strategyKey,'budget-first');
assert.equal(memories.find(x=>x.strategyKey==='budget-first')?.contradiction,true);
assert.ok((memories.find(x=>x.strategyKey==='budget-first')?.confidence ?? 0) > 0);
console.log('✓ strategy consolidation contract');
