// One entry per local player's run, independent of which exit path fires.
export function createRunScoreRecorder({ submit, makeId = () => crypto.randomUUID(), getIdentity = () => null }) {
  let runId = null, finished = false, identity = null;
  return {
    begin() { runId = makeId(); finished = false; identity = getIdentity(); },
    finish(reason, { score, difficulty, wave, kills, members, coop = false }) {
      if (!runId || finished) return false;
      if (!Number.isFinite(score) || score <= 0) { finished = true; return false; }
      submit('neonbrawl', 'score_' + difficulty, Math.floor(score), {
        runId, reason, wave, kills, party: members.length, difficulty, members, coop,
        accountId: identity?.id, displayName: identity?.name,
      });
      // Only mark complete after successful storage, allowing retry on failure.
      finished = true;
      return true;
    },
  };
}
