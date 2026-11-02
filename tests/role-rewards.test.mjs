import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ entryPoints:['lib/role-rewards.ts'],bundle:true,write:false,platform:'node',format:'esm' });
const { chooseReward, roleRewards } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
test('all accepted random bytes give exactly the requested reward probabilities', () => {
  assert.deepEqual(roleRewards.map(r=>r.weight),[50,20,7,3,5,14,1]);
  const counts = roleRewards.map(()=>0);
  for(let value=0;value<200;value++) {
    const label=chooseReward(()=>value);
    const index=roleRewards.findIndex(r=>r.label===label);
    assert.notEqual(index,-1); counts[index]++;
  }
  assert.deepEqual(counts,[100,40,14,6,10,28,2]);
});
test('rejects surplus bytes before choosing, including the one-percent reward', () => {
  const bytes=[200,255,199];
  assert.equal(chooseReward(()=>bytes.shift()),roleRewards[6].label);
  assert.equal(bytes.length,0);
});
