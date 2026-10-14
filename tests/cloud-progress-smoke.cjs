const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {launch,instrument,startSolo}=require('./browser-harness.cjs');
(async()=>{
 const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});let browser;
 try{
  const base=await new Promise((resolve,reject)=>{server.stdout.once('data',d=>resolve(String(d).trim().replace('NeonBrawl: ','')));server.once('error',reject);});
  browser=await launch();const rows=new Map(),errors=[];
  const session=id=>{const user={id,email:`${id}@example.test`,aud:'authenticated',role:'authenticated',user_metadata:{},app_metadata:{provider:'email'}};
   return {user,access_token:[{alg:'HS256'},{sub:id,exp:Math.floor(Date.now()/1000)+3600}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')+'.c2ln',refresh_token:'test',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer'};};
  async function device(id){
   const c=await browser.newContext({viewport:{width:1280,height:900}}),network={offline:false};
   await instrument(c,`gameTest.setGold=n=>{persistData.gold=n;_savePD();};`);
   if(id)await c.addInitScript(s=>{if(!localStorage.getItem('nbTestSeeded')){localStorage.setItem('neonbrawl-auth',JSON.stringify(s));localStorage.setItem('nbTestSeeded','yes');}},session(id));
   await c.route('**/runtime-config.js',r=>r.fulfill({contentType:'text/javascript',body:`window.NEONBRAWL_CONFIG={peerPath:'/peerjs',iceServers:[],assets:{cardIcons:false,music:false,samples:false},auth:{url:'https://cloud.example.test',publishableKey:'sb_publishable_test'}};`}));
   await c.route('https://cloud.example.test/**',async r=>{
    const req=r.request(),url=new URL(req.url()),body=req.postDataJSON();let result={};
    if(url.pathname.startsWith('/auth/')){
     if(url.pathname.endsWith('/token'))result=session(body.email?.split('@')[0]||id);
     else if(url.pathname.endsWith('/user'))result=session(id||'a').user;
    }else{
     if(network.offline){await r.abort();return;}
     const token=req.headers().authorization.split(' ')[1],uid=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub;
     assert.equal(url.pathname,'/rest/v1/player_progress');
     const old=rows.get(uid);
     if(req.method()==='POST'){
      assert.equal(body.user_id,uid);
      if(old){await r.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'23505',message:'duplicate'})});return;}
      rows.set(uid,{progress:body.progress,revision:1});
     }else if(req.method()==='PATCH'){
      assert.equal(url.searchParams.get('user_id'),'eq.'+uid);
      if(old&&url.searchParams.get('revision')==='eq.'+old.revision)rows.set(uid,{progress:body.progress,revision:old.revision+1});
      else {await r.fulfill({status:200,contentType:'application/json',body:'[]'});return;}
     }
     result=rows.has(uid)?[rows.get(uid)]:[];
    }
    await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
   });
   const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
   await p.waitForFunction(()=>window.NeonBrawlProgress?.ready());
   return {c,p,network};
  }
  async function login(p,id){await p.locator('#nbAccountBtn').click();await p.locator('#nbAuthEmail').fill(`${id}@example.test`);await p.locator('#nbAuthPassword').fill('password123');await p.locator('#nbAuthSubmit').click();await p.waitForFunction(id=>NeonBrawlProgress.state().owner===id&&NeonBrawlProgress.ready(),id);}
  const one=await device();await one.p.evaluate(()=>gameTest.setGold(123));await login(one.p,'a');await one.p.evaluate(()=>NeonBrawlProgress.flush());
  assert.equal(rows.get('a').progress.gold,123);console.log('PASS first login imports visitor progress');
  const two=await device('a');assert.equal((await two.p.evaluate(()=>gameTest.state())).gold,123);
  await one.p.evaluate(()=>gameTest.setGold(150));await one.p.evaluate(()=>NeonBrawlProgress.flush());
  await two.p.evaluate(()=>gameTest.setGold(200));await two.p.evaluate(()=>NeonBrawlProgress.flush());
  assert.equal(await two.p.evaluate(()=>NeonBrawlProgress.state().status),'conflict');assert.equal(rows.get('a').progress.gold,150);
  await two.p.locator('#nbAccountBtn').click();await two.p.locator('#nbCloudRemote').click();
  assert.equal((await two.p.evaluate(()=>gameTest.state())).gold,150);console.log('PASS fresh browser download and stale-device conflict selection');
  one.network.offline=true;await one.p.evaluate(()=>gameTest.setGold(175));await one.p.evaluate(()=>NeonBrawlProgress.flush());
  await one.p.reload();await one.p.waitForFunction(()=>NeonBrawlProgress?.ready());assert.equal((await one.p.evaluate(()=>gameTest.state())).gold,175);
  one.network.offline=false;await one.p.evaluate(()=>NeonBrawlProgress.flush());assert.equal(rows.get('a').progress.gold,175);console.log('PASS offline progress survives reload and uploads on reconnect');
  const duplicate=await one.c.newPage();await duplicate.goto(base);await duplicate.waitForFunction(()=>document.querySelector('#nbCloudStatus')?.textContent.includes('outra aba'));
  assert.equal(await duplicate.evaluate(()=>NeonBrawlProgress.ready()),false);await duplicate.close();console.log('PASS second tab cannot race the same account');
  await one.p.locator('#nbAccountBtn').click();await one.p.locator('#nbAuthSignOut').click();await one.p.waitForFunction(()=>NeonBrawlProgress.state().owner==='guest'&&NeonBrawlProgress.ready());
  assert.equal((await one.p.evaluate(()=>gameTest.state())).gold,123);
  await one.p.locator('#nbAuthGuest').click();await login(one.p,'b');await one.p.evaluate(()=>NeonBrawlProgress.flush());
  assert.equal((await one.p.evaluate(()=>gameTest.state())).gold,0);assert.equal(rows.get('a').progress.gold,175);console.log('PASS logout restores visitor; another account does not inherit previous account gold');
  await one.p.screenshot({path:'test-results/cloud-progress.png'});
  await one.p.locator('#nbAuthGuest').click();await startSolo(one.p);
  await one.p.evaluate(()=>NeonBrawlAuth.getClient().auth.signOut({scope:'local'}));
  await one.p.waitForFunction(()=>!NeonBrawlAuth.getState().user);
  await one.p.evaluate(()=>gameTest.setGold(88));
  assert.equal(await one.p.evaluate(()=>NeonBrawlProgress.state().owner),'b');
  assert.equal(JSON.parse(await one.p.evaluate(()=>localStorage.getItem('nbAccountProgress:b'))).progress.gold,88);
  await one.p.evaluate(()=>gameTest.quit());await one.p.waitForFunction(()=>NeonBrawlProgress.state().owner==='guest'&&NeonBrawlProgress.ready());
  assert.equal((await one.p.evaluate(()=>gameTest.state())).gold,123);
  await login(one.p,'b');await one.p.evaluate(()=>NeonBrawlProgress.flush());assert.equal(rows.get('b').progress.gold,88);
  console.log('PASS session change during run keeps earnings bound to the original account');
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
