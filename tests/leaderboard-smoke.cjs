const assert=require('node:assert/strict');
const {launch}=require('./browser-harness.cjs');
(async()=>{
 const browser=await launch();
 try{
  const context=await browser.newContext({viewport:{width:1280,height:800}}),errors=[];
  let fail=false;
  await context.route('**/rest/v1/leaderboard_scores?*',async route=>{
   const url=new URL(route.request().url());
   if(fail)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'offline'})});
   assert.equal(url.searchParams.get('limit'),'50');
   const data=url.searchParams.get('mode')==='eq.coop'?[]:[{display_name:'<script>bad',score:12345,wave:25,kills:150,created_at:'2026-10-16T00:00:00Z'}];
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000');await page.locator('#openLeaderboard').click();
  await page.waitForFunction(()=>document.querySelector('#nbBoardRows li'));
  assert.equal(await page.locator('#nbBoardRows script').count(),0);
  assert.ok((await page.locator('#nbBoardRows').innerText()).includes('12.345'));
  await page.screenshot({path:'test-results/leaderboard.png'});
  await page.locator('#nbBoardMode').selectOption('coop');
  await page.waitForFunction(()=>document.querySelector('#nbBoardStatus').textContent.includes('Nenhuma partida'));
  fail=true;await page.locator('#nbBoardRefresh').click();
  await page.waitForFunction(()=>document.querySelector('#nbBoardStatus').textContent.includes('Não foi possível'));
  await page.locator('#nbBoardLocal').click();
  assert.ok((await page.locator('#nbLocalDialog').innerText()).includes('Ranking deste navegador'));
  assert.deepEqual(errors,[]);console.log('PASS leaderboard rendering, safe names, filters, empty/offline states and local history');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
