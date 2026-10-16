import test from 'node:test';
import assert from 'node:assert/strict';
import { ScoreQueue, scoreEntry } from '../local/leaderboard.js';
import { createRunScoreRecorder } from '../local/run-score.js';
const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002';
const meta = { accountId:a, runId:a, displayName:'Pilot', difficulty:'hell', wave:25, kills:300, coop:false };
test('leaderboard accepts only new identified runs and separates solo/co-op', () => {
  assert.equal(scoreEntry(123,meta).mode, 'solo');
  assert.equal(scoreEntry(123,{...meta,coop:true}).mode, 'coop');
  for (const patch of [{accountId:null},{runId:'legacy'},{difficulty:'unknown'},{wave:-1},{kills:Infinity}]) assert.equal(scoreEntry(123,{...meta,...patch}),null);
  assert.equal(scoreEntry(NaN,meta),null);
});
test('run identity is captured at start and never attributed to a later login', () => {
  let identity = {id:a,name:'First'}, saved;
  const recorder = createRunScoreRecorder({ getIdentity:()=>identity, submit:(_g,_m,_s,row)=>{saved=row;} });
  recorder.begin(); identity={id:b,name:'Second'};
  recorder.finish('death',{score:10,difficulty:'normal',wave:1,kills:1,members:[],coop:true});
  assert.equal(saved.accountId,a); assert.equal(saved.displayName,'First'); assert.equal(saved.coop,true);
});
test('offline queue survives reload, retries idempotently and isolates accounts', async () => {
  const memory = new Map(), sent=[];
  const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
  let user={id:a}, offline=true;
  const deps={storage,getUser:()=>user,send:async row=>{if(offline)throw Error('offline');sent.push(row);}};
  const queue=new ScoreQueue(deps), row=scoreEntry(123,meta);
  queue.enqueue(row); queue.enqueue(row); assert.equal(queue.read(a).length,1);
  await assert.rejects(queue.flush()); assert.equal(queue.read(a).length,1);
  const restored=new ScoreQueue(deps); offline=false; user={id:b};
  await restored.flush(); assert.equal(sent.length,0);
  user={id:a}; await restored.flush(); assert.equal(sent.length,1); assert.equal(restored.read(a).length,0);
});
test('an account change during upload cannot send the next account data', async () => {
  const memory=new Map(); let user={id:a}, release; const sent=[];
  const queue=new ScoreQueue({storage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},getUser:()=>user,send:row=>{sent.push(row);return new Promise(r=>{release=r;});}});
  queue.enqueue(scoreEntry(1,meta)); queue.enqueue(scoreEntry(2,{...meta,runId:b}));
  const promise=queue.flush(); user={id:b}; release(); await promise;
  assert.equal(sent.length,1); assert.equal(queue.read(a).length,1);
});
