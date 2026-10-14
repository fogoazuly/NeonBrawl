import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountSave } from '../local/account-save.js';
const memory = () => {const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
function fixture() {
  const rows=new Map();let offline=false, release=null;
  const api={read:async id=>{if(offline)throw Error('offline');return structuredClone(rows.get(id)||null);},
    write:async(id,progress,revision)=>{
      if(offline)throw Error('offline');if(release)await new Promise(resolve=>release(resolve));
      const old=rows.get(id);if((old?.revision||0)!==revision)return null;
      const row={progress:structuredClone(progress),revision:revision+1};rows.set(id,row);return structuredClone(row);
    }};
  const create=(id,storage=memory())=>new AccountSave({userId:id,storage,api,validate:p=>{
    if(!Number.isSafeInteger(p.gold)||p.gold<0)throw Error('bad save');return structuredClone(p);
  }});
  return {rows,create,offline:v=>offline=v,delay:fn=>release=fn};
}
test('first account save, fresh device download and isolated account keys',async()=>{
  const f=fixture(),a=f.create('a');assert.deepEqual(await a.load({gold:10}),{gold:10});await a.flush();
  const b=f.create('a');assert.deepEqual(await b.load({gold:0}),{gold:10});
  const c=f.create('b');assert.deepEqual(await c.load({gold:0}),{gold:0});await c.flush();
  assert.equal(f.rows.get('a').progress.gold,10);assert.equal(f.rows.get('b').progress.gold,0);
});
test('offline changes survive reload and retry without changing revisions early',async()=>{
  const f=fixture(),storage=memory(),a=f.create('a',storage);await a.load({gold:10});await a.flush();
  f.offline(true);a.save({gold:15});await a.flush();assert.equal(a.state,'offline');
  const b=f.create('a',storage);assert.deepEqual(await b.load({gold:0}),{gold:15});assert.equal(b.record.revision,1);
  f.offline(false);await b.flush();assert.equal(f.rows.get('a').progress.gold,15);assert.equal(b.record.pending,false);
});
test('concurrent device writes preserve local and remote versions until explicit choice',async()=>{
  const f=fixture(),a=f.create('a'),b=f.create('a');await a.load({gold:10});await a.flush();await b.load({gold:0});
  a.save({gold:20});await a.flush();b.save({gold:30});await b.flush();
  assert.equal(b.state,'conflict');assert.equal(b.record.progress.gold,30);assert.equal(f.rows.get('a').progress.gold,20);
  b.resolve('local');await b.flush();assert.equal(f.rows.get('a').progress.gold,30);
  a.save({gold:25});await a.flush();assert.equal(a.state,'conflict');assert.equal(a.resolve('cloud').gold,30);
});
test('changes during upload remain pending and get their own revision',async()=>{
  const f=fixture(),a=f.create('a');await a.load({gold:10});await a.flush();
  let finish;f.delay(resolve=>finish=resolve);a.save({gold:20});const flight=a.flush();
  a.save({gold:25});finish();await flight;assert.equal(a.record.pending,true);assert.equal(a.record.revision,2);
  f.delay(null);await a.flush();assert.equal(f.rows.get('a').progress.gold,25);assert.equal(a.record.revision,3);
});
test('offline initial load and corrupt saves fail without overwriting a cache',async()=>{
  const f=fixture(),storage=memory(),a=f.create('a',storage);f.offline(true);
  await assert.rejects(a.load({gold:0}));assert.equal(storage.getItem(a.key),null);
  f.offline(false);await a.load({gold:10});await assert.rejects(async()=>a.save({gold:-1}));
  assert.equal(a.record.progress.gold,10);
});
test('a lost write acknowledgement does not create a false conflict',async()=>{
  const f=fixture(),a=f.create('a');await a.load({gold:10,upgrades:{a:1,b:2}});
  const write=a.api.write;let lose=true;
  a.api.write=async(...args)=>{const result=await write(...args);if(lose){lose=false;throw Error('lost reply');}return result;};
  await a.flush();assert.equal(a.state,'offline');
  f.rows.get('a').progress={upgrades:{b:2,a:1},gold:10};
  await a.flush();assert.equal(a.state,'saved');assert.equal(a.record.pending,false);assert.equal(a.conflict,null);
});
