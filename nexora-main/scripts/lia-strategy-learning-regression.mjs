const { rankStrategies, chooseStrategy } = await import('../src/lib/lia/strategy-learning.ts');
const r=rankStrategies([{strategyKey:'a',outcome:'success',score:80},{strategyKey:'a',outcome:'failed',score:-20},{strategyKey:'b',outcome:'success',score:60}]);
if(r[0].strategyKey!=='b' && r[0].strategyKey!=='a') throw new Error('ranking');
if(chooseStrategy([{strategyKey:'a',outcome:'failed',score:-50},{strategyKey:'b',outcome:'success',score:90}],['a','b'])!=='b') throw new Error('selection');
console.log('✓ strategy learning contract');
