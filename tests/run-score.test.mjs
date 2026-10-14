import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunScoreRecorder } from '../local/run-score.js';

const snapshot = { score: 123.8, difficulty: 'hard', wave: 3, kills: 4, members: [{ display_name: 'Player' }] };
test('registra todas as saídas uma única vez por partida', () => {
  for (const reason of ['death', 'leave', 'disconnect', 'exit']) {
    const rows = [];
    const recorder = createRunScoreRecorder({ makeId: () => reason, submit: (...args) => rows.push(args) });
    assert.equal(recorder.finish(reason, snapshot), false);
    recorder.begin();
    assert.equal(recorder.finish(reason, snapshot), true);
    recorder.finish('exit', snapshot); recorder.finish('leave', snapshot);
    assert.equal(rows.length, 1); assert.equal(rows[0][2], 123);
    assert.equal(rows[0][3].reason, reason); assert.equal(rows[0][3].runId, reason);
    assert.equal(rows[0][1], 'score_hard');
    recorder.begin(); recorder.finish(reason, snapshot);
    assert.equal(rows.length, 2);
  }
});
test('não cria ranking vazio e permite repetir uma gravação que falhou', () => {
  const rows = []; let fail = true;
  const recorder = createRunScoreRecorder({ makeId: () => 'id', submit: (...args) => {
    if (fail) throw new Error('Quota exceeded'); rows.push(args);
  } });
  recorder.begin(); assert.equal(recorder.finish('leave', { ...snapshot, score: 0 }), false);
  recorder.begin(); assert.throws(() => recorder.finish('leave', snapshot));
  fail = false; assert.equal(recorder.finish('exit', snapshot), true); assert.equal(rows.length, 1);
});
