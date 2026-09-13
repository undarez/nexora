const { chooseStrategy, strategyScoreForOutcome } = await import('../src/lib/lia/strategy-learning.ts');
if (chooseStrategy([{strategyKey:'budget-first',outcome:'success',score:100}], ['research-first','budget-first']) !== 'budget-first') throw new Error('learned strategy selection');
if (chooseStrategy([{strategyKey:'unsafe',outcome:'success',score:100}], ['research-first','budget-first']) !== 'research-first') throw new Error('allow-list');
if (strategyScoreForOutcome('completed').score !== 100) throw new Error('completion score');
if (strategyScoreForOutcome('failed').score !== -100) throw new Error('failure score');
console.log('✓ strategy orchestration contract');
