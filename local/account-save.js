// Versioned account saves. A conflict never silently overwrites either device.
const canonical = value => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export class AccountSave {
  constructor({ userId, storage, api, validate, onStatus = () => {} }) {
    Object.assign(this, { userId, storage, api, validate, onStatus });
    this.key = `nbAccountProgress:${userId}`;
    this.record = null;
    this.conflict = null;
    this.inflight = null;
  }
  persist() { this.storage.setItem(this.key, JSON.stringify(this.record)); }
  status(value) { this.state = value; this.onStatus(value); }
  async load(initial) {
    const cached = this.storage.getItem(this.key);
    if (cached) {
      this.record = JSON.parse(cached);
      this.record.progress = this.validate(this.record.progress);
      if (!Number.isSafeInteger(this.record.revision) || this.record.revision < 0) throw Error('Invalid revision');
    }
    let remote;
    try { remote = await this.api.read(this.userId); }
    catch (error) {
      if (!this.record) throw error;
      this.status('offline'); return this.record.progress;
    }
    if (remote) remote.progress = this.validate(remote.progress);
    if (this.record?.pending && remote && remote.revision !== this.record.revision) {
      if (!same(remote.progress, this.record.progress)) {
        this.conflict = remote; this.status('conflict'); return this.record.progress;
      }
    } else if (this.record?.pending && (remote?.revision || 0) === this.record.revision) {
      this.status('pending'); return this.record.progress;
    }
    this.record = remote ? { progress: remote.progress, revision: remote.revision, pending: false }
      : { progress: this.record?.progress || this.validate(initial), revision: 0, pending: true };
    this.persist(); this.status(this.record.pending ? 'pending' : 'saved');
    return this.record.progress;
  }
  save(progress) {
    const next = this.validate(progress);
    if (same(next, this.record.progress)) return;
    this.record = { ...this.record, progress: next, pending: true };
    this.persist(); this.status(this.conflict ? 'conflict' : 'pending');
  }
  async flush() {
    if (this.inflight) return this.inflight;
    if (!this.record?.pending || this.conflict) return;
    const sent = structuredClone(this.record);
    this.status('saving');
    this.inflight = (async () => {
      try {
        let remote = await this.api.write(this.userId, sent.progress, sent.revision);
        if (!remote) {
          const current = await this.api.read(this.userId);
          if (!current) throw Error('Missing remote save');
          current.progress = this.validate(current.progress);
          if (!same(current.progress, sent.progress)) {
            this.conflict = current; this.status('conflict'); return;
          }
          // A response can be lost after the server committed the write.
          remote = current;
        }
        this.record.revision = remote.revision;
        this.record.pending = !same(this.record.progress, sent.progress);
        this.persist(); this.status(this.record.pending ? 'pending' : 'saved');
      } catch { this.status('offline'); }
      finally { this.inflight = null; }
    })();
    return this.inflight;
  }
  resolve(choice) {
    if (!this.conflict) return;
    this.record = { progress: choice === 'cloud' ? this.conflict.progress : this.record.progress,
      revision: this.conflict.revision, pending: choice !== 'cloud' };
    this.conflict = null; this.persist(); this.status(this.record.pending ? 'pending' : 'saved');
    return this.record.progress;
  }
}

export function progressAPI(client) {
  const checked = result => { if (result.error) throw result.error; return result.data; };
  return {
    async read(id) {
      return checked(await client.from('player_progress').select('progress,revision,updated_at').eq('user_id', id).maybeSingle().abortSignal(AbortSignal.timeout(15000)));
    },
    async write(id, progress, revision) {
      const table = client.from('player_progress');
      const request = revision === 0 ? table.insert({ user_id: id, progress })
        : table.update({ progress }).eq('user_id', id).eq('revision', revision);
      const result = await request.select('revision').maybeSingle().abortSignal(AbortSignal.timeout(15000));
      if (result.error?.code === '23505') return null;
      return checked(result);
    }
  };
}
