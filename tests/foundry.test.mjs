import test from 'node:test';
import assert from 'node:assert/strict';
import { foundryPhase } from '../local/combat/foundry.js';

test('foundry gives entry grace and a full warning before each burn', () => {
  for (const t of [0, 3.999, NaN]) assert.equal(foundryPhase(t, 0), 'off');
  for (const offset of [0, 6]) {
    const lane = offset / 6;
    assert.equal(foundryPhase(4 + offset, lane), 'warning');
    assert.equal(foundryPhase(5.999 + offset, lane), 'warning');
    assert.equal(foundryPhase(6 + offset, lane), 'active');
    assert.equal(foundryPhase(8 + offset, lane), 'off');
  }
});
test('alternating lanes never burn together, including after a long run', () => {
  for (let t = 0; t < 3600; t += .125) {
    assert.ok(!(foundryPhase(t, 0) === 'active' && foundryPhase(t, 1) === 'active'));
    if (t >= 4) assert.equal(foundryPhase(t, 0), foundryPhase(t + 12, 0));
  }
});
