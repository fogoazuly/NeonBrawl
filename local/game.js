import {GrenadePrimer,SupernovaCharge,grenadeRadius,grenadeCore} from './combat/grenade.js';
const grenadePrimer=new GrenadePrimer();
const supernovaCharge=new SupernovaCharge();
import {BurstSalvos,BurstOpening,CelestialTriad,burstSpread} from './combat/burst.js';
const burstSalvos=new BurstSalvos(),burstOpening=new BurstOpening();
const celestialTriad=new CelestialTriad();
let burstSequence=0;
import { RifleRhythm, SteelStorm, ak47Spread } from './combat/ak47.js';
const ak47Rhythm=new RifleRhythm();
const steelStorm=new SteelStorm();
import { chooseLinks, linkIsValid } from './combat/linker.js';
import { advanceOverload, overloadSpawnInterval } from './combat/overload.js';
import { foundryPhase } from './combat/foundry.js';
import { createRunScoreRecorder } from './run-score.js';
import { setupLeaderboard } from './leaderboard.js';
import { PrecisionStreak, lastWordBonus, NeonJudgment } from './combat/pistol.js';
setupLeaderboard();
const pistolPrecision = new PrecisionStreak();
const pistolJudgment = new NeonJudgment();
import { ShotgunSalvos, shotgunPattern, RuptureCharge } from './combat/shotgun.js';
const shotgunSalvos=new ShotgunSalvos();
let shotgunSequence=0;
const ruptureCharge=new RuptureCharge();
import { Rammer } from './combat/rammer.js';
import { createRoomLifecycle } from './multiplayer/rooms.js';
import { createCollisionSystem } from './combat/collision.js';
import { createDamageSystem } from './combat/damage.js';
import { createSceneView, CAM_Y, CAM_Z_OFF } from './rendering/scene.js';
import { createMultiplayerState, MP_PLAYER_SYNC_DT, MP_HOST_SYNC_DT, MP_PING_DT, MP_TIMEOUT, MP_REMOTE_SMOOTH, MP_ENEMY_SMOOTH } from './multiplayer/state.js';
import { createTransport } from './multiplayer/transport.js';
import { encodeSave, decodeSave } from './save-codec.js';
import { setupBackupUI } from './backup-ui.js';
import { setupCloudProgress } from './cloud-progress.js';
import * as THREE from 'three';
// Touch-device detection (drives joystick / spell-button UI + touch listeners).
// Used by the input code so a desktop user opting into low-quality graphics
// doesn't accidentally get the on-screen joystick.
const _nbHasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints||0) > 0;
const realIsMobile = (
  /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|Mobile/i.test(navigator.userAgent) ||
  (window.matchMedia && window.matchMedia('(hover:none) and (pointer:coarse)').matches) ||
  // Small-screen fallback for touch devices the UA/media checks miss. Gated on
  // real touch input and on window.screen (NOT innerWidth) so a zoomed-in or
  // narrow desktop window — whose innerWidth shrinks — isn't misread as mobile.
  (_nbHasTouch && Math.min(window.screen.width, window.screen.height) < 720)
);
// User-selectable graphics tier. Stored as 'nbGfxTier' in localStorage.
// Tiers: 'potato' | 'low' | 'medium' | 'high'. Default 'high' on desktop.
// Real touch devices force 'low' minimum (full effects on a phone are wasted).
function _nbReadGfxTier(){
  try{
    const v=(localStorage.getItem('nbGfxTier')||'').toLowerCase();
    if(v==='potato'||v==='low'||v==='medium'||v==='high') return v;
  }catch(_){}
  return realIsMobile?'low':'high';
}
const gfxTier=_nbReadGfxTier();
// "Downgrade visuals" cliff used by ~170 ternaries (isMobile?lowVal:highVal)
// scattered through the file. Aliasing it to true for the cheap tiers gives
// desktop users the same reduced effects without rewriting every call site.
// Real-touch input gating stays on `realIsMobile`.
const isMobile = realIsMobile || gfxTier==='potato' || gfxTier==='low';
// Fine-grained tier knobs. Visual-quality code that wants a tier-aware dial
// (pixel ratio, particle counts, bloom) reads these directly.
const GFX_PIXEL_RATIO = ({potato:0.55, low:0.85, medium:1.0,  high:1.15})[gfxTier];
const GFX_PARTICLE_MULT = ({potato:0.35, low:0.65, medium:0.85, high:1.0})[gfxTier];
const GFX_BLOOM = gfxTier==='medium' || gfxTier==='high';
const GFX_ORB_LIGHTS = gfxTier==='high';
const GFX_ENEMY_RIG_DETAIL = ({potato:0, low:1, medium:2, high:2})[gfxTier];
const GFX_VFX_BUDGET = {
  potato: {particles:10, shockwaves:1, beams:1, rings:2, bolts:1, lights:0},
  low:    {particles:18, shockwaves:2, beams:2, rings:3, bolts:2, lights:1},
  medium: {particles:30, shockwaves:4, beams:4, rings:6, bolts:4, lights:3},
  high:   {particles:44, shockwaves:6, beams:6, rings:8, bolts:6, lights:5},
}[gfxTier];
const _vfxBudgetUsed = {particles:0, shockwaves:0, beams:0, rings:0, bolts:0, lights:0};
function resetFrameVfxBudget(){
  for(const k in _vfxBudgetUsed) _vfxBudgetUsed[k]=0;
}
function vfxBudgetLeft(kind){
  return Math.max(0, (GFX_VFX_BUDGET[kind] ?? 0) - (_vfxBudgetUsed[kind] || 0));
}
function spendVfxBudget(kind, amount=1){
  if(vfxBudgetLeft(kind) < amount) return false;
  _vfxBudgetUsed[kind] = (_vfxBudgetUsed[kind] || 0) + amount;
  return true;
}

const ARENA_W    = 13;
const ARENA_H    = 13;
const ARENA      = ARENA_H;
const WALL_H     = 2.5;
const PLAYER_SPD = 7.5;
const BULLET_SPD = 22;
const ENEMY_BULLET_SPD = 16.5; // enemy/boss bullets travel slower than player shots so they're reaction-dodgeable
// Base cooldown between primary bullets. Was 0.24 (~4.2 shots/sec) — bumped
// to 0.32 (~3.1 shots/sec) for the reload-balance pass: a slower base RPM
// makes the new 25-bullet mag last ~8 s instead of ~6, giving the reload
// rhythm more breathing room and making fire-rate upgrades feel meaningful
// without trivialising the game.
const FIRE_CD    = 0.32;
const MAX_HP     = 100;
const BULLET_POOL_SIZE = 160; // bumped from 120 for the 6-player lobby cap so high-fire-rate builds across more players don't starve each other for slots
const DOWNED_BLEED_TIME = 22;
const REVIVE_TIME = 2.4;
const REVIVE_RANGE = 2.8;
const REVIVE_HP_PCT = 0.45;

// ── Persistent upgrade tables (10 levels each) ───────────
const PERM_MAX_LVL = 10;
const PERM_UPGRADE_COST = [0,15,30,55,90,140,200,280,380,500,650]; // index = level to reach
// Caps tightened so persistent upgrades don't outscale skill picks:
//   BULLET DMG max +20% (was +50%) — +2% per level, linear.
//   FIRE RATE  max +20% (was +25%) — cooldown shrinks; cd_mult = 1/(1+0.02L)
//                                    so lvl 10 cd = 0.833 (1.20× shots/s).
//   BOSS DMG   max +30% (was +55%) — +3% per level, linear.
// HP / speed / treasure / crit / starting-loadout untouched.
const PERM_DMG_MULT   = [1,1.02,1.04,1.06,1.08,1.10,1.12,1.14,1.16,1.18,1.20];
const PERM_CD_MULT    = [1,0.9804,0.9615,0.9434,0.9259,0.9091,0.8929,0.8772,0.8621,0.8475,0.8333];
const PERM_HP_BONUS   = [0,10,20,30,40,50,60,70,80,90,100];
const PERM_SPD_MULT   = [1,1.03,1.06,1.09,1.12,1.15,1.18,1.21,1.24,1.27,1.30];
const PERM_TREASURE_MULT = [1,1.06,1.12,1.18,1.24,1.30,1.36,1.42,1.48,1.54,1.60];
const PERM_BOSS_DMG_MULT = [1,1.03,1.06,1.09,1.12,1.15,1.18,1.21,1.24,1.27,1.30];
const PERM_CRIT_CHANCE   = [0,0.033,0.066,0.099,0.132,0.165,0.198,0.231,0.264,0.297,0.33];
const PERM_START_COUNTS  = [0,1,2,3];
const PERM_START_BOOSTS  = [0,0,0,0];
const PERM_RUN_REROLLS   = [0,3,5,8];
const PERM_REVIVE_COUNTS = [0,1,1,2];
const PERM_REVIVE_HP     = [0,0.35,0.60,0.50];
const PREMIUM_COST_3     = [0,250,650,1200];
const PERM_DEFS = [
  { id:'dmg',      icon:'💢', name:'BULLET DMG',
    effects:['Base','+2%','+4%','+6%','+8%','+10%','+12%','+14%','+16%','+18%','+20%'] },
  { id:'fireRate', icon:'⚡', name:'FIRE RATE',
    effects:['Base','+2%','+4%','+6%','+8%','+10%','+12%','+14%','+16%','+18%','+20%'] },
  { id:'hp',       icon:'❤️', name:'MAX HEALTH',
    effects:['Base','+10 HP','+20 HP','+30 HP','+40 HP','+50 HP','+60 HP','+70 HP','+80 HP','+90 HP','+100 HP'] },
  { id:'speed',    icon:'💨', name:'MOVE SPEED',
    effects:['Base','+3%','+6%','+9%','+12%','+15%','+18%','+21%','+24%','+27%','+30%'] },
];
const PERM_SHOP_DEFS = [
  { id:'dmg', icon:'💥', name:'BULLET DMG', cat:'OFFENSE', why:'Basic shots stay relevant deeper into a run.',
    effects:['Base','+2%','+4%','+6%','+8%','+10%','+12%','+14%','+16%','+18%','+20%'] },
  { id:'fireRate', icon:'⚡', name:'FIRE RATE', cat:'OFFENSE', why:'More shots means more hits, more crit rolls, and better crowd clear.',
    effects:['Base','+2%','+4%','+6%','+8%','+10%','+12%','+14%','+16%','+18%','+20%'] },
  { id:'crit', icon:'🎯', name:'CRIT CORE', cat:'OFFENSE', why:'Adds burst moments to every direct hit.',
    effects:['Base','3.3% crit','6.6% crit','9.9% crit','13.2% crit','16.5% crit','19.8% crit','23.1% crit','26.4% crit','29.7% crit','33% crit'] },
  { id:'bossHunter', icon:'👑', name:'BOSS HUNTER', cat:'OFFENSE', why:'Specialized damage for boss waves without trivializing normal waves.',
    effects:['Base','+3% boss dmg','+6% boss dmg','+9% boss dmg','+12% boss dmg','+15% boss dmg','+18% boss dmg','+21% boss dmg','+24% boss dmg','+27% boss dmg','+30% boss dmg'] },
  { id:'hp', icon:'❤️', name:'MAX HEALTH', cat:'SURVIVAL', why:'More room for mistakes when elite and boss damage ramps up.',
    effects:['Base','+10 HP','+20 HP','+30 HP','+40 HP','+50 HP','+60 HP','+70 HP','+80 HP','+90 HP','+100 HP'] },
  { id:'speed', icon:'💨', name:'MOVE SPEED', cat:'SURVIVAL', why:'Kite better, dodge patterns cleaner, reach the exit faster.',
    effects:['Base','+3%','+6%','+9%','+12%','+15%','+18%','+21%','+24%','+27%','+30%'] },
  { id:'revive', icon:'🔋', name:'EMERGENCY REBOOT', cat:'PREMIUM', max:3, costs:PREMIUM_COST_3, why:'A limited second chance when a strong run collapses.',
    effects:['None','1 revive at 35% HP','1 revive at 60% HP','2 revives at 50% HP'] },
  { id:'startSkill', icon:'🃏', name:'OPENING LOADOUT', cat:'PREMIUM', max:3, costs:PREMIUM_COST_3, why:'Start runs with build identity immediately.',
    effects:['None','Choose 1 starting skill','Choose 2 starting skills','Choose 3 starting skills'] },
  { id:'reroll', icon:'🎲', name:'TACTICAL REROLL', cat:'PREMIUM', max:3, costs:PREMIUM_COST_3, why:'Fix bad skill offerings and chase the build you want.',
    effects:['None','3 rerolls per run','5 rerolls per run','8 rerolls per run'] },
  { id:'treasure', icon:'💰', name:'TREASURE CONTRACT', cat:'ECONOMY', why:'Earn more gold from every enemy drop.',
    effects:['Base','+6% gold','+12% gold','+18% gold','+24% gold','+30% gold','+36% gold','+42% gold','+48% gold','+54% gold','+60% gold'] },
];

const GOLD_DROP_TABLE = {
  chaser: {chance:0.50,min:1,max:2}, shooter:{chance:0.55,min:1,max:2},
  tank:   {chance:0.75,min:3,max:5}, speeder:{chance:0.45,min:1,max:1},
  bomber: {chance:0.65,min:2,max:3}, sniper: {chance:0.65,min:2,max:3},
  dasher: {chance:0.55,min:1,max:2}, disruptor:{chance:0.60,min:2,max:4},
  boss:   {chance:1.00,min:25,max:35},
};
const CRYSTAL_DROP_TABLE = {
  // Normal enemy drop chances clamped to the 0.35–0.55 band so crystal income
  // matches the new run-shop pricing (which scales by shop round + party size).
  // Min/max amounts and the boss table are unchanged — the boss still always
  // drops a meaty pile of crystals so the shop after each boss feels good.
  chaser: {chance:0.40,min:1,max:2}, shooter:{chance:0.42,min:1,max:2},
  tank:   {chance:0.55,min:3,max:5}, speeder:{chance:0.35,min:1,max:2},
  bomber: {chance:0.50,min:2,max:4}, sniper: {chance:0.50,min:2,max:4},
  dasher: {chance:0.42,min:1,max:3}, disruptor:{chance:0.45,min:2,max:5},
  boss:   {chance:1.00,min:18,max:28},
};
// Base card price by rarity. Final price multiplies by:
//   shopMult    — 1 / 2 / 3 for the wave 4 / 9 / 14 shops
//   playerMult  — 1.0 / 1.43 / 1.69 / 1.94 / 2.17 / 2.37 for 1–6 players (so
//                 per-player purchasing power stays roughly equal — more
//                 players means more enemies and so more crystal income)
//   2 ^ purchases — the same skill doubles each time it's bought IN THIS RUN
//                   (8 → 16 → 32 → 64 → 128 for common). The previous
//                   `1 + skillPickLevel*0.28` formula meant boss / opening
//                   loadout picks already inflated the shop price; this
//                   purchase-counter approach only charges for what the shop
//                   itself sold you, so other sources don't penalise it.
const RUN_SHOP_RARITY_PRICE = { common:8, uncommon:16, rare:36, epic:78, legendary:200, divine:400 };
const RUN_SHOP_REROLL_BASE = 8;
const RUN_SHOP_REROLL_GROWTH = 1.65;
const RUN_SHOP_OFFER_COUNT = 4;
const SHOP_TOTEM_MAX_USES = 3;
const SHOP_TOTEM_POS = {x:4.6,z:0};
// Wave totem spawns just to the right of the exit gate so the player walks
// past it on the way to the next wave. Far enough from the exit center
// (radius 2.0 trigger) that you don't accidentally walk through the exit
// trying to interact. Was middle-of-arena (-4.6, 0) which the player
// rarely passed close enough to actually notice the prompt.
const WAVE_TOTEM_POS = {x:3.6,z:-9.5};
// Boss-totem reward distribution by click count. Bonus is on TOP of the
// default 1 boss-reward card every player gets after a boss kill.
//   uses=0 → 0 bonus cards, 0 bonus relics (vanilla 1 card)
//   uses=1 → 0 bonus cards, 1 bonus relic        (1 card + 1 relic)
//   uses=2 → 1 bonus card,  1 bonus relic        (2 cards + 1 relic)
//   uses=3 → 1 bonus card,  2 bonus relics       (2 cards + 2 relics)
// Cards weight the early/mid risk; relics weight the deeper risk (which
// also has to deal with more bosses + tougher stats).
const SHOP_TOTEM_BONUS_CARDS = [0,0,1,1];
const SHOP_TOTEM_BONUS_RELICS = [0,1,1,2];

// ── Persistent save / load (XOR + checksum) ───────────────

const SAVE_RESET_ID='gold-upgrade-reset-2026-05-12-v1';
const GUN_LOCK_RESET_ID='starter-guns-only-2026-05-24-v2';
// Weapon shop — sequential unlock chain. Katana is always free; each next
// weapon requires its predecessor in `requires` to already be owned. Stored
// in `persistData.weapons` as a {weaponId: true} map alongside upgrades/gold.
const WEAPON_SHOP_DEFS = [
  { id:'katana',  name:'KATANA',  icon:'⚔️', css:'#66eeff', cost:0,    requires:null,
    why:'Wide clean slash. Standard reach, fast cooldown.' },
  { id:'dagger',  name:'DAGGER',  icon:'🗡️', css:'#ffdd66', cost:500,  requires:'katana',
    why:'Long reach stab. Narrow but extended hitbox, heavy damage.' },
  { id:'axe',     name:'AXE',     icon:'🪓', css:'#ff8a3d', cost:1000, requires:'dagger',
    why:'Heavy spin. Hits all enemies around you in a wide circle.' },
  { id:'hook',    name:'HOOK',    icon:'🪝', css:'#5fffd6', cost:1500, requires:'axe',
    why:'Rope hook with swing — fly toward the anchor and orbit it.' },
  { id:'samurai', name:'SAMURAI', icon:'⚡', css:'#ff5c88', cost:2000, requires:'hook',
    why:'Iaijutsu dash slash. Damages everyone in the dash trail.' },
];
const DEFAULT_PERSIST={gold:0,gunKeys:1,freeGunKeyGranted:true,gunLockResetId:GUN_LOCK_RESET_ID,upgrades:{dmg:0,fireRate:0,hp:0,speed:0,crit:0,bossHunter:0,revive:0,startSkill:0,reroll:0,treasure:0},weapons:{katana:true},guns:{pistol:true,shotgun:true},resetId:SAVE_RESET_ID};
let persistData=JSON.parse(JSON.stringify(DEFAULT_PERSIST));
let _cloudSyncTimer=null;
// Must match shared/cloud-save.js's OWNER_KEY format (`pixoCloudOwner:` + GAME_KEY).
// If that prefix is ever renamed there, update this constant in lockstep.
const NB_CLOUD_OWNER_KEY = 'pixoCloudOwner:neonbrawl';
function _scheduleCloudSync(){
  if(_cloudSyncTimer) clearTimeout(_cloudSyncTimer);
  _cloudSyncTimer=setTimeout(()=>{
    _cloudSyncTimer=null;
    const st=window.PixoSupabase?.getState?.();
    if(st?.enabled && st.user && window.PixoCloudSave?.saveCloud){
      try{ localStorage.setItem(NB_CLOUD_OWNER_KEY, st.user.id); }catch(_){}
      try{ window.PixoCloudSave.saveCloud(st.client, st.user); }catch(_){}
    }
  }, 800);
}
function _savePD(){
  localStorage.setItem('_nbpd',encodeSave(persistData));
  window.NeonBrawlProgress?.save(persistData);
  _scheduleCloudSync();
}
function _loadPD(){
  try {
    const raw=localStorage.getItem('_nbpd');
    if(raw) persistData=decodeSave(raw);
  } catch(e) {}
}
_loadPD();
function normalizeStarterGuns(forceLock=false){
  if(forceLock||persistData.gunLockResetId!==GUN_LOCK_RESET_ID){
    persistData.guns={pistol:true,shotgun:true};
    persistData.gunLockResetId=GUN_LOCK_RESET_ID;
    return true;
  }
  persistData.guns={...DEFAULT_PERSIST.guns,...(persistData.guns||{})};
  persistData.guns.pistol=true;
  persistData.guns.shotgun=true;
  return false;
}
function _resetOldSaves(){
  if(persistData.resetId!==SAVE_RESET_ID){
    persistData=JSON.parse(JSON.stringify(DEFAULT_PERSIST));
    _savePD();
    return;
  }
  persistData.upgrades={...DEFAULT_PERSIST.upgrades,...(persistData.upgrades||{})};
  // Clamp every upgrade level to its allowed max. A historical double-click
  // race in the perm-shop buy handler could push a value past max (LV 11/10),
  // which then read as `undefined` in PERM_DMG_MULT / PERM_CD_MULT lookups
  // and broke gameplay. Heal any such save on load.
  for(const def of (typeof PERM_SHOP_DEFS!=='undefined'?PERM_SHOP_DEFS:[])){
    const max=def.max||PERM_MAX_LVL;
    const v=Number(persistData.upgrades[def.id])||0;
    persistData.upgrades[def.id]=Math.max(0,Math.min(max,Math.floor(v)));
  }
  // Weapons map — merge so existing accounts keep anything they previously
  // owned, and so the katana default is always present. Katana is also
  // force-set so a corrupted save can never lock the player out of all melee.
  persistData.weapons={...DEFAULT_PERSIST.weapons,...(persistData.weapons||{})};
  persistData.weapons.katana=true;
  const lockedStarterGuns=normalizeStarterGuns();
  if(!persistData.freeGunKeyGranted){
    persistData.gunKeys=Math.max(0,Math.floor(Number(persistData.gunKeys)||0))+1;
    persistData.freeGunKeyGranted=true;
    _savePD();
  }
  persistData.gunKeys=Math.max(0,Math.floor(Number(persistData.gunKeys)||0));
  persistData.gold=Math.max(0,Math.floor(Number(persistData.gold)||0));
  if(lockedStarterGuns) _savePD();
}

function isWeaponOwned(id){
  if(id==='katana') return true; // always free
  return !!(persistData.weapons && persistData.weapons[id]);
}
function weaponShopDef(id){ return WEAPON_SHOP_DEFS.find(w=>w.id===id) || null; }
function isWeaponLocked(id){
  const def=weaponShopDef(id);
  return !!(def && def.requires && !isWeaponOwned(def.requires));
}
function canBuyWeapon(id){
  if(isWeaponOwned(id)) return false;
  const def=weaponShopDef(id);
  if(!def) return false;
  if(isWeaponLocked(id)) return false;
  return (persistData.gold||0) >= def.cost;
}
function isGunOwned(id){
  if(id==='pistol'||id==='shotgun') return true;
  return !!(persistData.guns&&persistData.guns[id]);
}
function gunRarityFor(id){
  return Object.entries(GUN_CHEST_RARITIES).find(([,r])=>r.ids.includes(id))?.[0] || 'common';
}
function chestAvailableGunIds(){
  return Object.values(GUN_CHEST_RARITIES).flatMap(r=>r.ids).filter(id=>GUNS[id]&&!isGunOwned(id));
}
_resetOldSaves();
function pixoAccountState(){
  const st=window.PixoSupabase?.getState?.();
  return st?.enabled&&st?.user ? st : null;
}
function isPixoAccountMode(){ return !!pixoAccountState(); }
async function refreshAccountWallet(st=pixoAccountState()){
  if(!st) return;
  const { data, error } = await st.client.from('wallets').select('soft_gold').eq('user_id',st.user.id).maybeSingle();
  if(error){ console.warn('[NeonBrawl] wallet load failed', error.message); return; }
  _loadPendingGold(st);
  persistData.gold=Math.max(0,Math.floor(Number(data?.soft_gold)||0))+_pendingGold;
  updateGoldHud();
  if(typeof renderShop==='function') renderShop();
  if(_pendingGold>0) flushPendingGold();
}
// Gold pickups are batched: each drop adds to a local pending counter (persisted to localStorage so
// a closed tab loses nothing) and the HUD updates optimistically; one award-gold call flushes the
// whole batch. Before batching, every pickup was its own edge-function call AND wallet_ledger row —
// a few players generated 120k rows.
let _pendingGold=0,_goldFlushing=false;
const GOLD_FLUSH_AT=60,GOLD_FLUSH_MAX=500; // per-call cap must match the edge function's clamp
function _pendingGoldKey(st){ return '_nbPendingGold_'+st.user.id; }
function _loadPendingGold(st){
  try{ _pendingGold=Math.max(0,Math.floor(Number(localStorage.getItem(_pendingGoldKey(st)))||0)); }catch(_){ _pendingGold=0; }
}
function _savePendingGold(st){
  try{ localStorage.setItem(_pendingGoldKey(st),String(_pendingGold)); }catch(_){}
}
async function flushPendingGold(){
  const st=pixoAccountState();
  if(!st||_goldFlushing||_pendingGold<=0) return;
  const amt=Math.min(_pendingGold,GOLD_FLUSH_MAX);
  _goldFlushing=true;
  try{
    const { data, error } = await st.client.functions.invoke('award-gold',{body:{
      game_key:'neonbrawl',
      amount:amt,
      reason:'drops_batch',
      idempotency_key:`batch:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      meta:{batched:true},
    }});
    if(error){ console.warn('[NeonBrawl] gold award failed', error.message); return; } // pending kept, retried by the interval
    _pendingGold-=amt; _savePendingGold(st);
    persistData.gold=Math.max(0,Math.floor(Number(data?.soft_gold)||0))+_pendingGold;
    updateGoldHud();
  }catch(e){ console.warn('[NeonBrawl] gold award threw', e); }
  finally{ _goldFlushing=false; }
}
setInterval(flushPendingGold,20000);
function grantGold(amount,pos=player?.pos,reason='drop',meta={}){
  const g=Math.max(1,Math.floor(Number(amount)||0));
  const st=pixoAccountState();
  persistData.gold+=g; updateGoldHud();
  if(pos) dmgNum('💰+'+g, _scratchPos.set(pos.x+0.6,0,pos.z+0.6), '#ffd700');
  if(!st){ _savePD(); return; }
  _pendingGold+=g; _savePendingGold(st);
  if(_pendingGold>=GOLD_FLUSH_AT) flushPendingGold();
}
function enemyGoldAmount(baseAmount,teamMultiplier=1){
  return Math.max(1,Math.round(baseAmount*(PERM_TREASURE_MULT[permLevel('treasure')]||1)*teamMultiplier));
}
function awardGunKeysForWave(w){
  const wave=Math.floor(Number(w)||0);
  if(wave<=0||wave%10!==0||runGunKeyAwards[wave]) return;
  runGunKeyAwards[wave]=true;
  persistData.gunKeys=Math.max(0,Math.floor(Number(persistData.gunKeys)||0))+1;
  _savePD();
  annText('WEAPON KEY +1','#ffd45e');
  if(typeof renderShop==='function') renderShop();
}
async function spendAccountGold(amount,reason,meta={}){
  const cost=Math.max(1,Math.floor(Number(amount)||0));
  const st=pixoAccountState();
  if(!st){
    if(persistData.gold<cost) throw new Error('Not enough gold');
    persistData.gold-=cost; _savePD(); updateGoldHud();
    return persistData.gold;
  }
  while(_pendingGold>0){ // server balance must include unflushed pickups before it can cover the spend
    const before=_pendingGold;
    await flushPendingGold();
    if(_pendingGold>=before) break; // flush failing — let the spend attempt surface the real error
  }
  const { data, error } = await st.client.functions.invoke('spend-gold',{body:{
    game_key:'neonbrawl',
    amount:cost,
    reason,
    idempotency_key:`${reason}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    meta,
  }});
  if(error) throw new Error(error.message || 'Spend failed');
  persistData.gold=Math.max(0,Math.floor(Number(data?.soft_gold)||0))+_pendingGold;
  updateGoldHud();
  return persistData.gold;
}
window.PIXO_CLOUD_SAVE_ADAPTER={
  hasLocalSave(){
    try{ return localStorage.getItem('_nbpd') !== null; }
    catch(_){ return false; }
  },
  clearLocalSave(){
    const had = this.hasLocalSave();
    persistData=JSON.parse(JSON.stringify(DEFAULT_PERSIST));
    try{ localStorage.removeItem('_nbpd'); }catch(_){}
    updateGoldHud();
    if(typeof renderShop==='function') renderShop();
    return had;
  },
  exportLocalSave(){
    return {
      version:3,
      resetId:SAVE_RESET_ID,
      upgrades:persistData.upgrades||{},
      weapons:persistData.weapons||{katana:true},
      guns:persistData.guns||{pistol:true,shotgun:true},
      gunKeys:persistData.gunKeys||0,
      freeGunKeyGranted:!!persistData.freeGunKeyGranted,
      gunLockResetId:persistData.gunLockResetId||'',
      note:'NeonBrawl account gold is stored in wallets, not localStorage.',
    };
  },
  importCloudSave(saveData){
    let changed=false;
    if(saveData?.upgrades){
      persistData.upgrades={...DEFAULT_PERSIST.upgrades,...saveData.upgrades};
      changed=true;
    }
    if(saveData?.weapons){
      persistData.weapons={...DEFAULT_PERSIST.weapons,...saveData.weapons};
      persistData.weapons.katana=true; // never let the free starter disappear
      changed=true;
    }
    if(saveData?.guns){
      persistData.guns={...DEFAULT_PERSIST.guns,...saveData.guns};
      persistData.gunLockResetId=saveData.gunLockResetId||'';
      normalizeStarterGuns(saveData.gunLockResetId!==GUN_LOCK_RESET_ID);
      changed=true;
    }
    if(Number.isFinite(Number(saveData?.gunKeys))){
      persistData.gunKeys=Math.max(0,Math.floor(Number(saveData.gunKeys)));
      changed=true;
    }
    if(saveData?.freeGunKeyGranted){
      persistData.freeGunKeyGranted=true;
      changed=true;
    }
    if(changed){
      _savePD(); updateGoldHud();
      if(typeof renderShop==='function') renderShop();
    }
    return changed;
  }
};
function wirePixoAccountEconomy(){
  if(!window.PixoSupabase){ setTimeout(wirePixoAccountEconomy,200); return; }
  window.PixoSupabase.onChange((st)=>{
    if(st.ready&&st.enabled&&st.user) refreshAccountWallet(st).catch(e=>console.warn('[NeonBrawl] wallet refresh threw', e));
    _refreshLocalPlayerName();
  });
}
// Defer initial wiring until the rest of the module has finished evaluating —
// PixoSupabase.onChange() fires its callback synchronously on registration,
// and that callback ends up reading `mp` (which is declared much further down).
// Running on the next microtask sidesteps the TDZ trap so the very first
// _refreshLocalPlayerName call actually succeeds instead of silently catching.
queueMicrotask(wirePixoAccountEconomy);
function _refreshLocalPlayerName(){
  // Re-resolve our display name and propagate it. Handles the case where the
  // supabase user cache populates after hostGame() already locked in "Player 1".
  // Wrapped in try/catch because `mp` may still be in the temporal dead zone if
  // this fires during early page-load init via PixoSupabase.onChange.
  try{
    if(typeof getLocalPlayerName!=='function') return;
    const next=getLocalPlayerName();
    if(mp.names[mp.myId]===next) return;
    mp.names[mp.myId]=next;
    mp.userIds[mp.myId]=getLocalUserId();
    if(typeof updateLobbyUI==='function') updateLobbyUI();
    if(mp.connected&&!mp.soloMode&&typeof broadcastNameUpdate==='function') broadcastNameUpdate(mp.myId);
  }catch(_){}
}
// Cache may also populate from PixoPlayerCard async load; recheck every few seconds.
setInterval(_refreshLocalPlayerName, 4000);
function updateGoldHud(){ document.getElementById('goldHud').textContent='💰 '+persistData.gold; }
function updateCrystalHud(){
  let el=document.getElementById('crystalHud');
  if(!el){
    const right=document.querySelector('.hud-right');
    if(!right) return;
    el=document.createElement('div');
    el.id='crystalHud';
    right.appendChild(el);
  }
  el.textContent='CRYSTAL '+Math.max(0,Math.floor(runCrystals||0));
  const amt=document.getElementById('runShopCrystalAmt');
  if(amt) amt.textContent=Math.max(0,Math.floor(runCrystals||0));
}
function grantRunCrystal(amount,pos=null){
  const c=Math.max(1,Math.floor(Number(amount)||0));
  runCrystals+=c;
  updateCrystalHud();
  if(pos) dmgNum('CRYSTAL +'+c, _scratchPos.set(pos.x-0.55,0,pos.z+0.55), '#69f7ff');
  applyCrystalHeart(c,pos);
  // Vital Shards (economy uncommon): pick up crystals → heal HP. The amount
  // scales with how many crystals just landed, so a big boss drop gives a
  // chunky heal, while small grunt drops trickle HP back.
  const healPerCrystal=CRYSTAL_HEAL_PER[playerSkills.crystalHeal||0]||0;
  if(healPerCrystal>0 && player && !player.dead){
    const gained=healPlayer(c*healPerCrystal);
    if(gained) dmgNum('+'+gained+' HP', _scratchPos.set((pos?pos.x:player.pos.x)+0.55,0,(pos?pos.z:player.pos.z)-0.55), '#88ffaa');
  }
}
function rollCrystalDrop(e){
  if(!e||!e.type) return;
  const d=CRYSTAL_DROP_TABLE[e.type];
  if(!d) return;
  // Crystal Eye (economy common): boosts drop chance multiplicatively.
  const luck=1+(CRYSTAL_LUCK_BONUS[playerSkills.crystalLuck||0]||0);
  if(Math.random()>Math.min(1,d.chance*luck)) return;
  // Crystal Wave event doubles the rolled amount.
  const mult=eventCrystalMult();
  grantRunCrystal(Math.round((d.min+Math.floor(Math.random()*(d.max-d.min+1)))*mult), e.pos);
}

// ── Enemy types ────────────────────────────────────────────
const ETYPES = {
  rammer: {hp:110,spd:2.7,r:0.65,col:0xffbb44,emi:0xff6600,pts:45,role:'NEON RAM'},
  linker: {hp:72,spd:2.0,r:0.5,col:0xcc88ff,emi:0x8833ff,pts:65,role:'LINKER'},
  chaser:  { hp:42,  spd:4.45, r:0.52, col:0xff2244, emi:0xff1133, pts:10, role:'GRUNT' },
  shooter: { hp:38,  spd:2.15, r:0.48, col:0xff8800, emi:0xff6600, pts:20, role:'RIFLEBOT' },
  tank:    { hp:160, spd:1.75, r:0.72, col:0x6688ff, emi:0x3366ff, pts:50, role:'BULWARK' },
  speeder: { hp:22,  spd:8.9, r:0.36, col:0xffff00, emi:0xffdd00, pts:15, role:'SKITTER' },
  // ── Wave 6+ ──────────────────────────────────────────────
  bomber:  { hp:78,  spd:2.25, r:0.66, col:0xff5500, emi:0xff3300, pts:35, role:'BOMBER' }, // slow, explodes on death
  sniper:  { hp:32,  spd:1.7, r:0.42, col:0x00eeff, emi:0x0088ff, pts:30, role:'RAILGUNNER' }, // keeps distance, charged shot
  dasher:  { hp:46,  spd:4.2, r:0.42, col:0xff00cc, emi:0xcc0088, pts:25, role:'RAVAGER' }, // telegraphed high-speed dash
  disruptor:{hp:55,  spd:2.35,r:0.50, col:0x55ff99, emi:0x00cc66, pts:40, role:'DISRUPTOR' },
  // ── Wave 9+ ──────────────────────────────────────────────
  // Healer: slow, sticks behind the pack, pulses an aura that restores HP
  // to nearby enemies. Priority target — leaving it alive lets the wave
  // stalemate. Doesn't fire bullets; movement-only support unit.
  healer:  { hp:64,  spd:1.95,r:0.50, col:0x44ff77, emi:0x00ee88, pts:55, role:'MEDIC' },
  // Shield Bearer: front-line wall. Forward arc reduces incoming player
  // bullet damage to 0 (literally blocked, like a moving wall). Flank or
  // melee through to land hits. Melee, AoE, and orbits bypass the block.
  shieldBearer:{hp:130,spd:1.95,r:0.62, col:0xb8c8ff, emi:0x66aaff, pts:60, role:'AEGIS' },
  // ── Late-game minion archetypes ──────────────────────────
  // Splitter: medium melee that bursts into two fast shards on death.
  splitter:    {hp:95, spd:2.7, r:0.58, col:0xff5599, emi:0xff2277, pts:30, role:'SPLITTER' },
  splitterling:{hp:16, spd:5.4, r:0.32, col:0xff99cc, emi:0xff66aa, pts:6,  role:'SHARD' },
  // Summoner: keeps its distance and periodically conjures trash reinforcements.
  summoner:    {hp:80, spd:1.85,r:0.54, col:0xb066ff, emi:0x8822ff, pts:48, role:'SUMMONER' },
  // Berserker: melee that gets faster and brighter the lower its HP.
  berserker:   {hp:120,spd:2.7, r:0.56, col:0xff7a33, emi:0xff4400, pts:38, role:'BERSERKER' },
  boss:    { hp:900, spd:2.5, r:1.65, col:0xff1133, emi:0xff0022, pts:500 },
};
const BOSS_NAMES=['WARDEN','PHANTOM','APEX','NEXUS','HERALD','GOLIATH','TEMPEST','BLIGHT'];
const BOSS_PROFILES = {
  WARDEN:  {col:0xff3344,emi:0xff0011,hp:1.28,spd:0.82,dmg:1.18,slamCd:[4.2,3.0,2.3],burstCd:[3.4,2.6,2.0],slamR:1.15,burstN:[6,10,14],phase2:['tank','chaser','chaser','shooter'],phase3:['tank','tank','bomber','dasher','shooter'],special:'warden'},
  PHANTOM: {col:0xaa66ff,emi:0x6633ff,hp:0.92,spd:1.28,dmg:1.05,slamCd:[5.0,3.8,2.9],burstCd:[3.0,2.2,1.7],slamR:0.85,burstN:[5,7,9],phase2:['dasher','speeder','sniper'],phase3:['dasher','dasher','speeder','sniper'],special:'phantom'},
  APEX:    {col:0xff5533,emi:0xff2200,hp:1.05,spd:1.34,dmg:1.28,slamCd:[3.4,2.4,1.8],burstCd:[4.0,3.1,2.4],slamR:1.35,burstN:[4,6,8],phase2:['chaser','speeder','dasher','bomber'],phase3:['dasher','dasher','speeder','bomber','tank'],special:'apex'},
  NEXUS:   {col:0x33ddff,emi:0x00aaff,hp:0.98,spd:1.00,dmg:1.12,slamCd:[5.2,4.0,3.2],burstCd:[2.6,1.8,1.25],slamR:0.90,burstN:[10,16,22],phase2:['shooter','sniper','chaser'],phase3:['shooter','shooter','sniper','dasher','bomber'],special:'nexus'},
  HERALD:  {col:0xffcc33,emi:0xff9900,hp:1.12,spd:0.95,dmg:1.00,slamCd:[4.8,3.6,2.8],burstCd:[3.8,2.8,2.2],slamR:1.00,burstN:[6,8,10],phase2:['chaser','tank','sniper','shooter'],phase3:['tank','bomber','sniper','dasher','shooter','chaser'],special:'herald'},
  // Slow, enormous juggernaut. Hits like a truck up close and erupts in
  // concentric ground-pound rings — punishes standing anywhere near it.
  GOLIATH: {col:0xff7a1e,emi:0xff4400,hp:1.55,spd:0.70,dmg:1.32,slamCd:[3.2,2.4,1.8],burstCd:[4.5,3.6,2.8],slamR:1.50,burstN:[3,4,5],phase2:['tank','shieldBearer','bomber'],phase3:['tank','tank','shieldBearer','bomber','chaser'],special:'goliath'},
  // Fast electric striker. Sweeps rotating lightning spokes and snipes the
  // player's position — a glass-cannon you have to chase.
  TEMPEST: {col:0xdfefff,emi:0x66ccff,hp:0.88,spd:1.42,dmg:1.22,slamCd:[4.4,3.4,2.6],burstCd:[3.2,2.4,1.8],slamR:0.80,burstN:[4,6,8],phase2:['speeder','dasher','sniper'],phase3:['speeder','speeder','dasher','sniper','shooter'],special:'tempest'},
  // Toxic area-denial. Blooms scattered spore detonations around the player
  // and floods the arena with reinforcements — control space or drown.
  BLIGHT:  {col:0x7dff3a,emi:0x33cc00,hp:1.22,spd:0.92,dmg:1.00,slamCd:[4.6,3.6,2.8],burstCd:[3.6,2.8,2.2],slamR:1.00,burstN:[6,8,10],phase2:['shooter','chaser','bomber'],phase3:['bomber','bomber','shooter','splitter','chaser'],special:'blight'},
};

const WAVES = [
  [['chaser',5]],
  [['chaser',5],['shooter',2]],
  [['chaser',6],['shooter',3],['tank',1]],
  [['chaser',5],['shooter',4],['tank',2]],
  [['chaser',4],['shooter',3],['tank',2],['speeder',4]],
  [['chaser',5],['shooter',3],['tank',2],['speeder',3],['bomber',2]],
  [['chaser',5],['shooter',4],['tank',2],['speeder',3],['bomber',2],['sniper',2]],
  [['chaser',5],['shooter',4],['tank',2],['speeder',4],['bomber',3],['sniper',2],['dasher',3],['disruptor',2]],
];
// Long-range enemy types — used by the Ranged Hell challenge to filter the
// normal wave roster down to only these.
const RANGED_HELL_TYPES = new Set(['shooter','sniper']);
function getWaveConfig(w){
  let base=_getWaveConfigBase(w);
  if(w>=7)base=[...base,['rammer',Math.min(3,1+Math.floor((w-7)/6))]];
  if(w>=9)base=[...base,['linker',w>=18?2:1]];
  // Bone Tribute (cursed) — enemy spawn count up by the relic's level mult.
  // Applied before challenge-specific filtering so it flows into rangedHell.
  {
    const _btMul=(typeof boneTributeMul==='function')?boneTributeMul():1;
    if(_btMul>1) base = base.map(([t,n])=>[t, Math.max(1,Math.round(n*_btMul))]);
  }
  // Wave Totem spawn-count modifiers (Double Trouble / Mega Swarm).
  const totemMul=(typeof totemSpawnCountMult==='function')?totemSpawnCountMult():1;
  if(totemMul>1) base = base.map(([t,n])=>[t, Math.max(1,Math.round(n*totemMul))]);
  if(waveEvent && waveEvent.type==='challenge' && waveEvent.sub==='rangedHell'){
    // Reroute the close-range enemy budget into the ranged slots so the
    // wave's TOTAL enemy count stays identical. Previously we just filtered
    // close-range types out, which left wave-1 with 0 enemies (it has no
    // ranged in the script) and shrank later waves dramatically. Now a
    // 70-enemy wave still spawns 70 enemies — all of them ranged.
    const totalBudget=base.reduce((s,[,n])=>s+n,0);
    const rangedSlots=base.filter(([type])=>RANGED_HELL_TYPES.has(type));
    if(rangedSlots.length===0){
      // Scripted wave has no ranged at all (typical for wave 1–6). Drop the
      // whole budget into shooters so the player still has a wave to fight.
      return [['shooter', Math.max(1,totalBudget)]];
    }
    const rangedSum=rangedSlots.reduce((s,[,n])=>s+n,0)||1;
    // Distribute totalBudget across the ranged types proportional to their
    // original counts. Round individually; absorb the rounding remainder
    // into the largest slot so the sum lands exactly on totalBudget.
    const out=rangedSlots.map(([type,n])=>[type, Math.max(1, Math.round(n/rangedSum*totalBudget))]);
    const drift=totalBudget - out.reduce((s,[,n])=>s+n,0);
    if(drift!==0){
      let bestI=0;
      for(let i=1;i<out.length;i++) if(out[i][1]>out[bestI][1]) bestI=i;
      out[bestI][1]=Math.max(1, out[bestI][1]+drift);
    }
    return out;
  }
  return base;
}
function _getWaveConfigBase(w){
  if(w<=WAVES.length) return WAVES[w-1];
  const ex=w-WAVES.length;
  // Hard-cap formula gives per-type counts that saturate around wave 18 (so
  // each type stops growing). Soft scaling kicks in once those caps are all
  // hit (ex >= 10, ~wave 18) and adds meaningful chunks of extra enemies
  // forever after. The on-map drip-feed cap (see onMapEnemyCap) handles
  // perf — the wave can queue 200+ enemies without all of them being alive
  // at once. Per-type rates roughly mirror the original growth ratios so
  // chasers stay the bulk and disruptors stay rare.
  const SOFT_START = 10;
  const soft=(rate)=>Math.max(0, Math.floor((ex-SOFT_START)*rate));
  // Healer + Shield Bearer enter from wave 9 / 10 onward. Counts intentionally
  // small — both are priority targets / wall-units and overcrowding makes
  // waves drag. Slot indices stay in the table even when count is 0 so the
  // formula can grow them later.
  const w0 = w; // raw wave number for new-type gating
  return [
    ['chaser',  Math.min(6+Math.floor(ex*1.5), 18)  + soft(0.60)],
    ['shooter', Math.min(3+Math.floor(ex*0.9), 11)  + soft(0.35)],
    ['tank',    Math.min(2+Math.floor(ex*0.6),  8)  + soft(0.22)],
    ['speeder', Math.min(3+Math.floor(ex*0.85),10)  + soft(0.45)],
    ['bomber',  Math.min(2+Math.floor(ex*0.6),  7)  + soft(0.28)],
    ['sniper',  Math.min(2+Math.floor(ex*0.5),  6)  + soft(0.18)],
    ['dasher',  Math.min(2+Math.floor(ex*0.7),  8)  + soft(0.28)],
    ['disruptor',Math.min(1+Math.floor(ex*0.45), 5) + soft(0.15)],
    ['healer',  (w0>=9  ? Math.min(1+Math.floor(ex*0.30), 3) : 0) + soft(0.10)],
    ['shieldBearer',(w0>=10 ? Math.min(1+Math.floor(ex*0.30), 3) : 0) + soft(0.12)],
    // Late-game archetypes (splitterling is never spawned directly — only via splits).
    ['splitter',  (w0>=8  ? Math.min(1+Math.floor(ex*0.30), 4) : 0) + soft(0.16)],
    ['berserker', (w0>=11 ? Math.min(1+Math.floor(ex*0.30), 4) : 0) + soft(0.14)],
    ['summoner',  (w0>=13 ? Math.min(1+Math.floor(ex*0.22), 2) : 0) + soft(0.06)],
  ];
}

// Multiple map layouts — rotated every 3 waves
const MAP_LAYOUTS = [
  // 0 — Symmetrical pillars (original)
  [[3,2.5,3,-5,-9],[3,2.5,3,5,-9],
   [3,2.5,3,-5, 2],[3,2.5,3,5, 2],
   [3,2.5,3,-5, 9],[3,2.5,3,5, 9],
   [5,2,1,   0,-4],[5,2,1,  0, 6]],
  // 1 — Horizontal bars + inner pillars
  [[6,2.5,1.5,0,-8],[6,2.5,1.5,0,3],
   [2,2.5,3,-5,-2],[2,2.5,3,5,-2],
   [2,2.5,2,-5,7],[2,2.5,2,5,7],
   [3,2,1,-5,-11.4]],
  // 2 — Staggered Z pattern
  [[3,2.5,3,-5,-10],[3,2.5,3,5,-5],
   [3,2.5,3,-5,  0],[3,2.5,3,5, 5],
   [3,2.5,3,-5, 10],
   [4,2,1.5,0,-7],[4,2,1.5,0,2]],
  // 3 — Side corridors / fortress walls
  [[1.4,2.5,5.5,-6,-7],[1.4,2.5,5.5,6,-7],
   [1.4,2.5,5.5,-6, 5],[1.4,2.5,5.5,6, 5],
   [4,2,1.4,0,-10],[4,2,1.4,0,1]],
  // 4 — T-intersections
  [[7,2.5,1.5,0,-9],[7,2.5,1.5,0,3],
   [1.5,2.5,5,-5,-5],[1.5,2.5,5,5,-5],
   [1.5,2.5,4,-5,6],[1.5,2.5,4,5,6],
   [3,2,1,0,-4]],
  // 5 - Broken ring
  [[3,2.4,2.2,-4,-8],[3,2.4,2.2,4,-8],
   [2.2,2.4,3.2,-6,-2],[2.2,2.4,3.2,6,-2],
   [3,2.4,2.2,-4,4],[3,2.4,2.2,4,4],
   [2.5,2,1.2,0,-2]],
  // 6 - Twin lanes
  [[1.3,2.5,6,-3.2,-8],[1.3,2.5,6,3.2,-8],
   [1.3,2.5,6,-3.2,5],[1.3,2.5,6,3.2,5],
   [5.5,2,1.2,0,-1.5],[2.2,2,1.2,-6,9],[2.2,2,1.2,6,9]],
  // 7 - Pressure pockets
  [[2.6,2.5,2.6,-6,-10],[2.6,2.5,2.6,6,-10],
   [2.2,2.5,4,0,-5],
   [2.6,2.5,2.6,-6,1],[2.6,2.5,2.6,6,1],
   [4.5,2,1.2,-2.5,8],[4.5,2,1.2,2.5,8]],
];
const MAP_NAMES = ['PILLARS','BARS','STAGGER','FORTRESS','JUNCTION','BROKEN RING','TWIN LANES','POCKETS'];
const MAP_COLORS = [0x0088ff,0x00ffcc,0xaa66ff,0xff3366,0xffcc33,0x66eeff,0xff66cc,0x55ff66];
// Per-map theme: wall emissive, wall-base strip glow, floor emissive, grid [primary, secondary]
const MAP_THEMES = [
  {wall:0x001144, strip:0x0066cc, floor:0x00080f, gridA:0x001a33, gridB:0x000d1a}, // 0 PILLARS     – deep blue
  {wall:0x003322, strip:0x00cc99, floor:0x000e0b, gridA:0x002a1a, gridB:0x001410}, // 1 BARS        – dark teal
  {wall:0x180033, strip:0x8844cc, floor:0x0d0018, gridA:0x1a0033, gridB:0x0d0018}, // 2 STAGGER     – deep purple
  {wall:0x220011, strip:0xcc2244, floor:0x110008, gridA:0x220010, gridB:0x110008}, // 3 FORTRESS    – dark crimson
  {wall:0x1a1200, strip:0xcc9900, floor:0x0d0900, gridA:0x1a1200, gridB:0x0d0900}, // 4 JUNCTION    – dark amber
  {wall:0x001824, strip:0x44aacc, floor:0x000f18, gridA:0x001824, gridB:0x000f14}, // 5 BROKEN RING – steel cyan
  {wall:0x1a0011, strip:0xcc44aa, floor:0x0d0009, gridA:0x1a0012, gridB:0x0d0009}, // 6 TWIN LANES  – deep pink
  {wall:0x001a06, strip:0x33bb44, floor:0x000d03, gridA:0x001a06, gridB:0x000d03}, // 7 POCKETS     – dark green
];

// ── Renderer ──────────────────────────────────────────────
const B=(w,h,d,x,z,opts={})=>({w,h,d,x,z,...opts});
const R=(x,z,r,opts={})=>({shape:'circle',x,z,r,...opts});
const Q=(x,z,w,d,opts={})=>({shape:'rect',x,z,w,d,...opts});
const LEGACY_PRESETS = MAP_LAYOUTS.map((blocks,i)=>({
  id:'legacy_'+i,type:'legacy',name:MAP_NAMES[i],color:MAP_COLORS[i],theme:MAP_THEMES[i],
  blocks:blocks.map(([w,h,d,x,z])=>B(w,h,d,x,z))
}));
const EXTRA_NORMAL_PRESETS = [
  {id:'enc_start_plaza',type:'normal',name:'START PLAZA',color:0x66eeff,theme:{wall:0x003344,strip:0x66eeff,floor:0x14100c,gridA:0x2a241b,gridB:0x1b160f},
    floors:[R(0,0,8.4,{col:0x273023,opacity:0.30}),R(0,0,4.1,{col:0x263846,opacity:0.18}),Q(0,0,15.5,2.2,{col:0x2f3328,opacity:0.22}),Q(0,0,2.2,15.5,{col:0x2f3328,opacity:0.22})],
    blocks:[B(2.8,1.05,0.85,-3.8,-2.6,{cover:true,destructible:true,hp:120}),B(2.8,1.05,0.85,3.8,-2.6,{cover:true,destructible:true,hp:120}),B(2.8,1.05,0.85,-3.8,3.0,{cover:true,destructible:true,hp:120}),B(2.8,1.05,0.85,3.8,3.0,{cover:true,destructible:true,hp:120})],
    hazards:[]},
  {id:'enc_river_forks',type:'normal',name:'RIVER FORKS',color:0x33ddff,theme:{wall:0x001824,strip:0x33ddff,floor:0x000c14,gridA:0x002033,gridB:0x001018},
    floors:[],
    rivers:[{width:2.35,path:[[0,-12.05],[0,12.05]],order:0,y:0},{width:2.15,path:[[-12.05,0],[12.05,0]],order:1,y:0.012}],
    blocks:[B(1.2,1.25,3.4,-8.2,0,{rock:true}),B(1.2,1.25,3.4,8.2,0,{rock:true}),B(3.2,1.25,1.2,0,-8.0,{rock:true}),B(3.2,1.25,1.2,0,8.0,{rock:true})],
    hazards:[Q(0,0,2.45,24.1,{type:'slow',visual:false,mult:0.58,col:0x33ddff}),Q(0,0,24.1,2.25,{type:'slow',visual:false,mult:0.62,col:0x33ddff})]},
  {id:'enc_sunken_isles',type:'normal',name:'SUNKEN ISLES',color:0x44ff99,theme:{wall:0x003322,strip:0x44ff99,floor:0x00140a,gridA:0x00331a,gridB:0x00160a},
    floors:[R(0,-6.3,3.3,{col:0x0b3a24,opacity:0.27}),R(-6.0,1.3,3.2,{col:0x0b3a24,opacity:0.25}),R(6.0,1.3,3.2,{col:0x0b3a24,opacity:0.25}),R(0,6.5,3.4,{col:0x0b3a24,opacity:0.27}),Q(0,-2.5,2.0,7.0,{col:0x44ff99,opacity:0.16}),Q(-3.0,1.2,6.1,1.6,{col:0x44ff99,opacity:0.15}),Q(3.0,1.2,6.1,1.6,{col:0x44ff99,opacity:0.15}),Q(0,4.0,2.0,5.4,{col:0x44ff99,opacity:0.14})],
    blocks:[B(1.4,2.4,3.2,-2.8,-3.4),B(1.4,2.4,3.2,2.8,-3.4),B(1.2,2.3,2.8,-2.4,3.7,{destructible:true,hp:130}),B(1.2,2.3,2.8,2.4,3.7,{destructible:true,hp:130}),B(2.0,2.2,1.0,0,1.2,{destructible:true,breakable:true,hp:150})],
    hazards:[R(-6.0,1.3,2.8,{type:'slow',mult:0.72,col:0x44ff99}),R(6.0,1.3,2.8,{type:'slow',mult:0.72,col:0x44ff99}),Q(0,1.2,2.0,10.5,{type:'slow',mult:0.60,col:0x33ddff})]},
  {id:'enc_grass_maze',type:'normal',name:'SIGNAL GRASS',color:0x55ff55,theme:{wall:0x001a06,strip:0x55ff55,floor:0x000d03,gridA:0x002410,gridB:0x000f06},
    floors:[Q(-6.6,-1.8,4.8,9.8,{col:0x55ff55,opacity:0.16}),Q(6.6,1.8,4.8,9.8,{col:0x55ff55,opacity:0.16}),R(0,-6.2,2.5,{col:0x0b3f1d,opacity:0.22}),R(0,6.2,2.7,{col:0x0b3f1d,opacity:0.22}),Q(0,0,3.0,13.5,{col:0x0f1826,opacity:0.20})],
    blocks:[B(1.0,2.3,6.5,-2.9,-1.6),B(1.0,2.3,6.5,2.9,1.6),B(2.4,2.2,1.0,0,-3.2,{destructible:true,hp:125}),B(2.4,2.2,1.0,0,3.2,{destructible:true,hp:125}),B(1.4,2.2,1.4,-7.6,6.3,{destructible:true,breakable:true,hp:110}),B(1.4,2.2,1.4,7.6,-6.3,{destructible:true,breakable:true,hp:110})],
    hazards:[Q(-6.6,-1.8,4.8,9.8,{type:'grass',col:0x55ff55}),Q(6.6,1.8,4.8,9.8,{type:'grass',col:0x55ff55})]},
  {id:'enc_orbital_ring',type:'normal',name:'ORBITAL RING',color:0xff66cc,theme:{wall:0x1a0011,strip:0xff66cc,floor:0x0d0009,gridA:0x240016,gridB:0x100009},
    floors:[R(0,0,6.2,{col:0x2a0b24,opacity:0.22}),R(0,0,2.0,{col:0xff66cc,opacity:0.16}),Q(0,-7.2,9.4,1.7,{col:0x2a0b24,opacity:0.22}),Q(0,7.2,9.4,1.7,{col:0x2a0b24,opacity:0.22}),Q(-7.2,0,1.7,9.4,{col:0x2a0b24,opacity:0.22}),Q(7.2,0,1.7,9.4,{col:0x2a0b24,opacity:0.22})],
    blocks:[B(2.5,2.2,1.0,0,-4.8,{destructible:true,hp:140}),B(2.5,2.2,1.0,0,4.8,{destructible:true,hp:140}),B(1.0,2.2,2.5,-4.8,0,{destructible:true,hp:140}),B(1.0,2.2,2.5,4.8,0,{destructible:true,hp:140}),B(1.2,2.2,1.2,-7.1,-7.1),B(1.2,2.2,1.2,7.1,-7.1),B(1.2,2.2,1.2,-7.1,7.1),B(1.2,2.2,1.2,7.1,7.1)],
    hazards:[R(0,0,2.0,{type:'damage',dmg:6,col:0xff66cc}),R(0,0,6.2,{type:'slow',mult:0.82,col:0xff66cc})]},
  {id:'enc_foundry_lanes',type:'normal',name:'NEON FOUNDRY',color:0xffaa33,theme:{wall:0x1c1000,strip:0xffaa33,floor:0x0e0800,gridA:0x241400,gridB:0x100800},
    floors:[Q(0,0,4,24,{col:0x33ddcc,opacity:0.09}),Q(-4.5,0,2.4,20,{col:0xffaa33,opacity:0.10}),Q(4.5,0,2.4,20,{col:0xffaa33,opacity:0.10})],
    blocks:[B(2,2.3,3,-7.5,-5),B(2,2.3,3,7.5,5),B(2,2.3,3,-7.5,5),B(2,2.3,3,7.5,-5)],
    hazards:[Q(-4.5,0,2.4,20,{type:'heat',lane:0,dmg:6,col:0xff5533}),Q(4.5,0,2.4,20,{type:'heat',lane:1,dmg:6,col:0xff5533})]},
  {id:'enc_bridge_cross',type:'normal',name:'BRIDGE CROSS',color:0x88ddff,theme:{wall:0x001622,strip:0x88ddff,floor:0x000b11,gridA:0x002333,gridB:0x001018},
    floors:[R(0,-7.2,3.0,{col:0x0a2636,opacity:0.26}),R(0,7.2,3.0,{col:0x0a2636,opacity:0.26}),R(-7.2,0,2.8,{col:0x0a2636,opacity:0.24}),R(7.2,0,2.8,{col:0x0a2636,opacity:0.24}),Q(0,0,3.0,15.8,{col:0x88ddff,opacity:0.13}),Q(0,0,15.8,3.0,{col:0x88ddff,opacity:0.13})],
    blocks:[B(1.2,2.3,3.8,-3.0,-3.0),B(1.2,2.3,3.8,3.0,3.0),B(3.8,2.3,1.2,-3.0,3.0),B(3.8,2.3,1.2,3.0,-3.0),B(1.5,2.2,1.5,0,0,{destructible:true,breakable:true,hp:170})],
    hazards:[Q(-6.0,0,2.0,13.8,{type:'slow',mult:0.62,col:0x33ddff}),Q(6.0,0,2.0,13.8,{type:'slow',mult:0.62,col:0x33ddff}),Q(0,-6.0,13.8,2.0,{type:'slow',mult:0.62,col:0x33ddff}),Q(0,6.0,13.8,2.0,{type:'slow',mult:0.62,col:0x33ddff})]},
  // ── DELTA CROSSING ── wide river, circular grass cover, curved path
  {id:'enc_delta_cross',type:'normal',name:'DELTA CROSSING',color:0x33bbff,
    theme:{wall:0x0a1c2a,strip:0x33bbff,floor:0x06141e,gridA:0x102840,gridB:0x081420},
    // Slightly curved river path for more natural look
    rivers:[{path:[[-14,1.5],[14,1.5]],width:5.4}],
    blocks:[
      // Stone ruins inside NW grass pocket
      B(1.4,2.5,1.4,-7,-9,{}), B(1.2,2.5,1.2,-5,-7,{}),
      // Stone ruins inside NE grass pocket
      B(1.4,2.5,1.4,7,-9,{}),  B(1.2,2.5,1.2,5,-7,{}),
      // Small river rocks (visual cover mid-river, navigable around)
      B(1.0,1.1,1.0,-5.0,1.5,{rock:true}), B(1.0,1.1,1.0,5.0,1.5,{rock:true}),
      B(0.9,1.0,0.9,0,0.8,{rock:true}),
      // S side cover — L-shaped stone walls
      B(3.0,2.4,1.0,-5,7,{}),  B(1.0,2.4,2.0,-6.5,7.5,{}),
      B(3.0,2.4,1.0, 5,7,{}),  B(1.0,2.4,2.0, 6.5,7.5,{}),
      // Destructible back wall
      B(6.0,2.2,1.2,0,9.2,{destructible:true,breakable:true,hp:180}),
    ],
    hazards:[
      // River slow — full width, visual from rivers[] ribbon
      Q(0,1.5,26,5.8,{type:'slow',visual:false,mult:0.50,col:0x33bbff}),
      // Circular grass cover in NW and NE corners — organic shape
      R(-7,-9,4.5,{type:'grass',col:0x55ee55}),
      R( 7,-9,4.5,{type:'grass',col:0x55ee55}),
      // Small central grass patch (a bit of cover in upper-center)
      R(0,-6.5,2.2,{type:'grass',col:0x55ee55}),
    ]},
  {id:'enc_clover_bog',type:'normal',name:'CLOVER BOG',color:0x55ee77,
    theme:{wall:0x052412,strip:0x55ee77,floor:0x07110a,gridA:0x12391d,gridB:0x091a0e},
    floors:[R(-5.4,-4.9,3.4,{col:0x1b5a24,opacity:0.22}),R(5.4,-4.9,3.4,{col:0x1b5a24,opacity:0.22}),R(-5.4,4.9,3.4,{col:0x1b5a24,opacity:0.22}),R(5.4,4.9,3.4,{col:0x1b5a24,opacity:0.22}),Q(0,0,4.0,13.0,{col:0x22552c,opacity:0.12})],
    rivers:[{width:1.55,path:[[0,-11.5],[0,11.5]],order:0,y:0.004}],
    blocks:[B(1.0,2.2,4.0,-2.8,-3.2),B(1.0,2.2,4.0,2.8,3.2),B(4.0,2.2,1.0,-3.4,1.2),B(4.0,2.2,1.0,3.4,-1.2),B(1.4,2.0,1.4,0,0,{destructible:true,breakable:true,hp:140})],
    hazards:[Q(0,0,1.65,23.0,{type:'slow',visual:false,mult:0.66,col:0x33ddff}),R(-5.4,-4.9,3.1,{type:'grass',col:0x55ee55}),R(5.4,-4.9,3.1,{type:'grass',col:0x55ee55}),R(-5.4,4.9,3.1,{type:'grass',col:0x55ee55}),R(5.4,4.9,3.1,{type:'grass',col:0x55ee55})]},
  {id:'enc_switchback',type:'normal',name:'SWITCHBACK',color:0x88ddff,
    theme:{wall:0x061b25,strip:0x88ddff,floor:0x050d13,gridA:0x112b38,gridB:0x08131a},
    floors:[Q(-5.2,-6.2,6.5,2.2,{col:0x88ddff,opacity:0.12}),Q(5.2,0,6.5,2.2,{col:0x88ddff,opacity:0.12}),Q(-5.2,6.2,6.5,2.2,{col:0x88ddff,opacity:0.12}),Q(0,0,2.2,15.0,{col:0x2d4050,opacity:0.14})],
    blocks:[B(7.0,2.4,1.1,0,-4.4),B(7.0,2.4,1.1,0,4.4),B(1.1,2.4,5.0,-4.2,0),B(1.1,2.4,5.0,4.2,0),B(1.6,2.1,1.6,-8.3,-7.2,{destructible:true,breakable:true,hp:120}),B(1.6,2.1,1.6,8.3,7.2,{destructible:true,breakable:true,hp:120})],
    hazards:[Q(0,-9.0,18.0,1.3,{type:'slow',mult:0.75,col:0x88ddff}),Q(0,9.0,18.0,1.3,{type:'slow',mult:0.75,col:0x88ddff})]},
  {id:'enc_crater_garden',type:'normal',name:'CRATER GARDEN',color:0xff6688,
    theme:{wall:0x260711,strip:0xff6688,floor:0x12050a,gridA:0x32111a,gridB:0x16080c},
    floors:[R(0,0,5.8,{col:0xff6688,opacity:0.12}),R(-7.3,-6.4,2.4,{col:0x55202a,opacity:0.20}),R(7.3,6.4,2.4,{col:0x55202a,opacity:0.20}),R(7.1,-6.2,2.2,{col:0x55202a,opacity:0.16}),R(-7.1,6.2,2.2,{col:0x55202a,opacity:0.16})],
    blocks:[B(1.1,2.3,5.8,-3.7,0),B(1.1,2.3,5.8,3.7,0),B(5.0,2.3,1.0,0,-3.7),B(5.0,2.3,1.0,0,3.7),B(1.3,2.0,1.3,0,0,{destructible:true,breakable:true,hp:130})],
    hazards:[R(0,0,2.25,{type:'damage',dmg:5,col:0xff3355}),R(0,0,5.8,{type:'slow',mult:0.86,col:0xff6688})]},
  {id:'enc_tide_gates',type:'normal',name:'TIDE GATES',color:0x33ccff,
    theme:{wall:0x001d2d,strip:0x33ccff,floor:0x041019,gridA:0x0a3048,gridB:0x061721},
    rivers:[{width:1.7,path:[[-11.6,-5.8],[11.6,-5.8]],order:0,y:0},{width:1.7,path:[[-11.6,5.8],[11.6,5.8]],order:1,y:0.012}],
    floors:[Q(0,0,18.0,2.2,{col:0x1d3c4f,opacity:0.14}),R(-7.2,0,2.4,{col:0x173243,opacity:0.20}),R(7.2,0,2.4,{col:0x173243,opacity:0.20})],
    blocks:[B(1.0,2.3,6.4,-5.0,0),B(1.0,2.3,6.4,5.0,0),B(3.2,1.2,1.0,0,-5.8,{bridge:true}),B(3.2,1.2,1.0,0,5.8,{bridge:true}),B(1.5,2.0,1.5,-8.7,0,{destructible:true,breakable:true,hp:120}),B(1.5,2.0,1.5,8.7,0,{destructible:true,breakable:true,hp:120})],
    hazards:[Q(0,-5.8,23.2,1.85,{type:'slow',visual:false,mult:0.58,col:0x33ccff}),Q(0,5.8,23.2,1.85,{type:'slow',visual:false,mult:0.58,col:0x33ccff})]},
  {id:'enc_blackout_grove',type:'normal',name:'BLACKOUT GROVE',color:0x77ff55,
    theme:{wall:0x061806,strip:0x77ff55,floor:0x040b05,gridA:0x102610,gridB:0x071007},
    floors:[Q(0,-7.4,14.0,2.2,{col:0x21421a,opacity:0.16}),Q(0,7.4,14.0,2.2,{col:0x21421a,opacity:0.16}),R(0,0,3.0,{col:0x113311,opacity:0.18})],
    blocks:[B(8.2,2.3,1.0,0,-3.2),B(8.2,2.3,1.0,0,3.2),B(1.0,2.3,4.0,-6.5,0),B(1.0,2.3,4.0,6.5,0),B(2.0,2.0,1.0,0,0,{destructible:true,breakable:true,hp:150})],
    hazards:[Q(0,-7.4,14.0,2.6,{type:'grass',col:0x66ee44}),Q(0,7.4,14.0,2.6,{type:'grass',col:0x66ee44}),R(0,0,3.0,{type:'grass',col:0x66ee44})]},
  {id:'enc_reactor_split',type:'normal',name:'REACTOR SPLIT',color:0xffdd44,
    theme:{wall:0x231b04,strip:0xffdd44,floor:0x100c03,gridA:0x302408,gridB:0x171004},
    floors:[Q(-5.0,0,4.0,20.0,{col:0xffdd44,opacity:0.10}),Q(5.0,0,4.0,20.0,{col:0xffdd44,opacity:0.10}),Q(0,0,2.0,20.0,{col:0xff3333,opacity:0.12}),R(0,-8.2,2.4,{col:0x4d3508,opacity:0.18}),R(0,8.2,2.4,{col:0x4d3508,opacity:0.18})],
    blocks:[B(2.4,2.4,4.8,-2.5,-4.6),B(2.4,2.4,4.8,2.5,4.6),B(2.2,2.4,1.0,-6.8,0),B(2.2,2.4,1.0,6.8,0),B(1.4,2.0,1.4,0,-2.2,{destructible:true,breakable:true,hp:130}),B(1.4,2.0,1.4,0,2.2,{destructible:true,breakable:true,hp:130})],
    hazards:[Q(0,0,1.75,22.5,{type:'damage',dmg:5,col:0xff3333}),Q(-5.0,0,3.6,21.5,{type:'slow',mult:0.84,col:0xffdd44}),Q(5.0,0,3.6,21.5,{type:'slow',mult:0.84,col:0xffdd44})]},
];
const BOSS_PRESETS = [
  {id:'boss_WARDEN',type:'boss',boss:'WARDEN',name:'WARDEN FORTRESS',color:0xff3344,theme:{wall:0x220011,strip:0xff3344,floor:0x100006,gridA:0x260010,gridB:0x110008},
    blocks:[B(8.0,2.5,1.1,0,-5.7,{destructible:true,hp:260}),B(8.0,2.5,1.1,0,5.7,{destructible:true,hp:260}),B(1.2,2.5,5.5,-5.7,0,{destructible:true,hp:220}),B(1.2,2.5,5.5,5.7,0,{destructible:true,hp:220}),B(2.0,2.2,2.0,-3.0,-1.5,{cover:true}),B(2.0,2.2,2.0,3.0,1.5,{cover:true})]},
  {id:'boss_PHANTOM',type:'boss',boss:'PHANTOM',name:'PHANTOM MIRROR',color:0xaa66ff,theme:{wall:0x180033,strip:0xaa66ff,floor:0x0d0018,gridA:0x260050,gridB:0x100020},
    blocks:[B(2.1,2.2,2.1,-7,-7,{cover:true}),B(2.1,2.2,2.1,7,-7,{destructible:true,hp:140}),B(2.1,2.2,2.1,-7,7,{destructible:true,hp:140}),B(2.1,2.2,2.1,7,7,{cover:true})],
    hazards:[{x:0,z:0,w:1.2,d:1.2,dmg:8,col:0xaa66ff}]},
  {id:'boss_APEX',type:'boss',boss:'APEX',name:'APEX CHARGEWAY',color:0xff5533,theme:{wall:0x220011,strip:0xff5533,floor:0x110006,gridA:0x2a1008,gridB:0x120604},
    blocks:[B(1.0,2.5,8.0,-8.2,0),B(1.0,2.5,8.0,8.2,0),B(2.2,2.2,2.2,-3.2,-6.5,{destructible:true,hp:150}),B(2.2,2.2,2.2,3.2,6.5,{destructible:true,hp:150})]},
  {id:'boss_NEXUS',type:'boss',boss:'NEXUS',name:'NEXUS VECTOR',color:0x33ddff,theme:{wall:0x001824,strip:0x33ddff,floor:0x000f18,gridA:0x00334a,gridB:0x001722},
    blocks:[B(1.5,2.1,1.5,-8,0,{cover:true}),B(1.5,2.1,1.5,8,0,{cover:true})]},
  {id:'boss_HERALD',type:'boss',boss:'HERALD',name:'HERALD RITUAL',color:0xffcc33,theme:{wall:0x1a1200,strip:0xffcc33,floor:0x0d0900,gridA:0x2c2100,gridB:0x151000},
    blocks:[B(2,2.2,2,-6,-6,{cover:true}),B(2,2.2,2,6,-6,{destructible:true,hp:120}),B(2,2.2,2,-6,6,{destructible:true,hp:120}),B(2,2.2,2,6,6,{cover:true})],
    hazards:[{x:0,z:0,w:3.2,d:3.2,dmg:7,col:0xffcc33}]},
  // Wide-open pit so there's nowhere to hide from GOLIATH's expanding rings —
  // a few break-walls to duck behind, but no central cover.
  {id:'boss_GOLIATH',type:'boss',boss:'GOLIATH',name:'GOLIATH PIT',color:0xff7a1e,theme:{wall:0x241100,strip:0xff7a1e,floor:0x120800,gridA:0x301600,gridB:0x180a00},
    blocks:[B(2.6,2.4,2.6,-8,-8,{destructible:true,hp:200}),B(2.6,2.4,2.6,8,8,{destructible:true,hp:200}),B(2.6,2.4,2.6,8,-8,{cover:true}),B(2.6,2.4,2.6,-8,8,{cover:true})]},
  // Open lanes for TEMPEST's line-spokes; thin pillars to break line of sight.
  {id:'boss_TEMPEST',type:'boss',boss:'TEMPEST',name:'TEMPEST GRID',color:0xdfefff,theme:{wall:0x0a1626,strip:0x66ccff,floor:0x05101c,gridA:0x123048,gridB:0x081826},
    blocks:[B(1.0,2.6,1.0,-5,-5,{cover:true}),B(1.0,2.6,1.0,5,-5,{cover:true}),B(1.0,2.6,1.0,-5,5,{cover:true}),B(1.0,2.6,1.0,5,5,{cover:true}),B(1.0,2.6,1.0,0,0,{destructible:true,hp:120})]},
  // Cramped, hazard-laced den so BLIGHT's spore fields are hard to escape.
  {id:'boss_BLIGHT',type:'boss',boss:'BLIGHT',name:'BLIGHT HOLLOW',color:0x7dff3a,theme:{wall:0x0a2200,strip:0x7dff3a,floor:0x051200,gridA:0x123000,gridB:0x081a00},
    blocks:[B(2.2,2.2,2.2,-6.5,0,{destructible:true,hp:130}),B(2.2,2.2,2.2,6.5,0,{destructible:true,hp:130}),B(2.0,2.2,2.0,0,-6.5,{cover:true}),B(2.0,2.2,2.0,0,6.5,{cover:true})],
    hazards:[{x:0,z:0,w:2.6,d:2.6,dmg:7,col:0x7dff3a}]},
];
const SHOP_PRESET = {
  id:'shop_floor',type:'shop',name:'SHOP FLOOR',color:0x69f7ff,
  theme:{wall:0x00202a,strip:0x69f7ff,floor:0x020b12,gridA:0x06202b,gridB:0x021018},
  floors:[R(0,0,5.8,{col:0x69f7ff,opacity:0.10}),Q(0,0,3.0,22.0,{col:0x69f7ff,opacity:0.08}),Q(0,0,22.0,3.0,{col:0x69f7ff,opacity:0.08})],
  blocks:[],
  hazards:[],
};
// Wave 1–2 maps with non-rectangular PLAYABLE shapes (carved out of the
// fixed 26x26 square arena by huge interior walls). type:'early' keeps them
// out of the wave 3+ random pool so they're isolated for playtest.
//
// Wave 1 — HOURGLASS: two rectangular chambers (top and bottom) connected
// by a narrow vertical neck through the middle. Two big walls on the
// east-mid and west-mid sides carve the hourglass shape out of the square.
// Player spawns in the bottom chamber; enemies spawn in the top chamber and
// must funnel through the neck (or the player must push up through it).
//
// Wave 2 — L-WING: only the south + west L-shape is playable. The NE
// quadrant is sealed off by one massive wall block, leaving an L-shaped
// arena. Player spawns in the south-east tip, fights through the bend.
//
// Both maps add `spawnZones` so enemies don't spawn inside the carved-off
// areas (the default `randomSpawnPoint` zones would otherwise drop enemies
// in the middle of the big wall).
const EARLY_PRESETS = [
  {id:'wave1_hourglass',type:'normal',name:'HOURGLASS',color:0x44ccff,
    theme:{wall:0x051a26,strip:0x44ccff,floor:0x06141e,gridA:0x102840,gridB:0x081420},
    floors:[
      // Top chamber floor accent.
      Q(0,-8.4,26,9.0,{col:0x33ccff,opacity:0.10}),
      // Bottom chamber floor accent.
      Q(0, 8.4,26,9.0,{col:0x33ccff,opacity:0.10}),
      // The neck — slim highlighted strip down the middle.
      Q(0,0,3.6,7.5,{col:0x88ddff,opacity:0.14}),
    ],
    blocks:[
      // The two big walls that carve the hourglass shape out of the square.
      // Each is 11 wide × 6 deep — together they seal the entire middle row
      // of the arena except for a 4-unit gap (x = -2 to 2) which is the neck.
      // Tall (h=2.8) so they read as room boundaries, not random obstacles.
      B(11.0, 2.8, 6.0, -7.5, 0),  // west-mid wall (x: -13 → -2,  z: -3 → 3)
      B(11.0, 2.8, 6.0,  7.5, 0),  // east-mid wall (x:   2 → 13,  z: -3 → 3)
      // A bit of cover inside the top chamber so the fight has shape.
      B(1.6, 1.5, 1.0, -5, -8, {cover:true,destructible:true,hp:110}),
      B(1.6, 1.5, 1.0,  5, -8, {cover:true,destructible:true,hp:110}),
      // Small landmark in the bottom chamber near the neck entrance.
      B(1.8, 2.0, 1.8, 0, 6, {destructible:true,breakable:true,hp:120}),
    ],
    hazards:[],
    // Enemies must spawn in the TOP chamber, not on top of the big walls.
    spawnZones:[
      {x:0,    z:-12,  w:22,  d:0.8},   // top edge of top chamber
      {x:-10,  z:-7,   w:0.8, d:6.0},   // west edge of top chamber
      {x: 10,  z:-7,   w:0.8, d:6.0},   // east edge of top chamber
    ]},
  {id:'wave2_lwing',type:'normal',name:'L-WING',color:0xffaa66,
    theme:{wall:0x1a0e05,strip:0xffaa66,floor:0x100805,gridA:0x2a1810,gridB:0x140906},
    floors:[
      // West arm floor accent (the vertical leg of the L).
      Q(-6.5,0,12,26,{col:0xffaa66,opacity:0.10}),
      // South arm floor accent (the horizontal leg of the L).
      Q(0,6.5,26,12,{col:0xffaa66,opacity:0.10}),
      // Bend highlight.
      R(0,0,2.8,{col:0xffcc88,opacity:0.16}),
    ],
    blocks:[
      // Keep the NE wall while leaving clearance around the exit at x=0.
      B(11.5, 2.8, 13.0, 7.25, -6.5),
      // Cover inside the playable L.
      B(1.6, 1.5, 1.0, -8, -6, {cover:true,destructible:true,hp:110}),  // west arm
      B(1.6, 1.5, 1.0, -8,  6, {cover:true,destructible:true,hp:110}),  // bend
      B(1.6, 1.5, 1.0,  6,  6, {cover:true,destructible:true,hp:110}),  // south arm
      // Landmark near the bend.
      B(1.8, 2.0, 1.8, -3, 3, {destructible:true,breakable:true,hp:120}),
    ],
    hazards:[],
    // Enemies must spawn inside the L (west arm + south arm), never in the
    // sealed NE quadrant where the big block is.
    spawnZones:[
      {x:-6.5, z:-12, w:12, d:0.8},  // top edge of west arm
      {x:-12,  z:0,   w:0.8, d:24},  // west edge (full height)
      {x:12,   z:6.5, w:0.8, d:12},  // east edge of south arm
      {x:0,    z:12,  w:24, d:0.8},  // bottom edge (full width)
    ]},
];
const CRYSTAL_GARDEN_PRESET={
  id:'enc_crystal_garden',type:'normal',name:'CRYSTAL GARDEN',color:0xbb77ff,
  theme:{wall:0x170c24,strip:0xbb77ff,floor:0x070e16,gridA:0x241238,gridB:0x101824},
  floors:[Q(0,0,4,24,{col:0x66ffdd,opacity:.10}),R(0,0,8,{col:0x663399,opacity:.10}),
    ...[-4.5,4.5].flatMap(x=>[-5,0,5].map(z=>R(x,z,2,{col:0xcc88ff,opacity:.18})))],
  blocks:[...[-4.5,4.5].flatMap(x=>[-5,0,5].map(z=>B(2.4,2.8,3,x,z,{crystal:true,destructible:true,breakable:true,hp:90}))),
    ...[-9,9].flatMap(x=>[-8,8].map(z=>B(1.5,1.4,1.5,x,z,{rock:true})))],
  hazards:[]
};
// Append new arenas so existing multiplayer map indices remain stable.
const ARENA_PRESETS = [...LEGACY_PRESETS,...EXTRA_NORMAL_PRESETS,...EARLY_PRESETS,SHOP_PRESET,...BOSS_PRESETS,CRYSTAL_GARDEN_PRESET];
const NORMAL_PRESET_IDS = ARENA_PRESETS.map((p,i)=>p.type==='normal'?i:null).filter(i=>i!==null);
const SHOP_PRESET_ID = ARENA_PRESETS.findIndex(p=>p.id==='shop_floor');
const BOSS_PRESET_BY_NAME = Object.fromEntries(ARENA_PRESETS.map((p,i)=>p.type==='boss'?[p.boss,i]:null).filter(Boolean));
function bossNameForWave(w){
  return BOSS_NAMES[(Math.floor(w/5)-1+BOSS_NAMES.length)%BOSS_NAMES.length] || 'WARDEN';
}
// Tracks the last normal-wave map the host picked so we never replay the
// same arena two waves in a row. Reset to -1 on initGame so a fresh run
// doesn't carry over the previous run's "avoid" choice.
let _lastNormalMapIdx = -1;
function presetForWave(w){
  // Boss waves always use the boss arena, no randomization.
  if(w%5===0) return BOSS_PRESET_BY_NAME[bossNameForWave(w)] ?? NORMAL_PRESET_IDS[0];
  // Wave 1–2 stay on the basic Start Plaza preset (NORMAL_PRESET_IDS[0]) so
  // first-time players learn controls on a familiar rectangle. The shape-
  // variant maps (HOURGLASS, L-WING) live in the normal pool now so they
  // show up in the wave 3+ random rotation.
  if(w<=2){ _lastNormalMapIdx=NORMAL_PRESET_IDS[0]; return NORMAL_PRESET_IDS[0]; }
  // Wave 3+ randomly pick a normal arena, avoiding back-to-back repeats.
  // Host runs this in nextWave() — sendHostState then broadcasts mapLayout
  // to clients via HOST_STATE so every player loads the same arena.
  if(!NORMAL_PRESET_IDS.length) return 0;
  let idx;
  if(NORMAL_PRESET_IDS.length===1){
    idx=NORMAL_PRESET_IDS[0];
  } else {
    do {
      idx=NORMAL_PRESET_IDS[Math.floor(Math.random()*NORMAL_PRESET_IDS.length)];
    } while(idx===_lastNormalMapIdx);
  }
  _lastNormalMapIdx=idx;
  return idx ?? 0;
}
function randomSpawnPoint(){
  const preset=ARENA_PRESETS[currentMapLayout]||ARENA_PRESETS[0];
  const zones=preset.spawnZones||[
    {x:0,z:-ARENA_H+1.4,w:ARENA_W*1.65,d:0.8},
    {x:-ARENA_W+1.4,z:0,w:0.8,d:ARENA_H*1.45},
    {x:ARENA_W-1.4,z:0,w:0.8,d:ARENA_H*1.45},
    {x:0,z:ARENA_H-3.0,w:ARENA_W*1.2,d:0.8},
  ];
  const z=zones[Math.floor(Math.random()*zones.length)];
  const p={x:z.x+(Math.random()-0.5)*(z.w||1),z:z.z+(Math.random()-0.5)*(z.d||1)};
  return p;
}

const canvas = document.getElementById('c');
const sceneView = createSceneView({ canvas, arenaHeight: ARENA_H, isMobile, realIsMobile,
  pixelRatio: GFX_PIXEL_RATIO, bloom: GFX_BLOOM, orbLighting: GFX_ORB_LIGHTS });
const { scene, camera, playerGlow, muzzleLight, orbLights } = sceneView;
const _fogProj = new THREE.Vector3();

// ── World ─────────────────────────────────────────────────
const obstacleBoxes = []; // {x,z,hw,hd}
const obstacleObjects = []; // THREE.Mesh refs for current layout
const mapDecorObjects = []; // non-collision floor accents for current layout
let mapHazardTime=0;
const mapHazards = [];
const mapHazardObjects = [];
let sceneWallMat=null, sceneFloorMat=null, sceneStripMat=null, sceneGrid=null;
let currentMapLayout = 0;

function buildWorld(){
  const W=ARENA_W*2, H=ARENA_H*2;

  // ── FLOOR: visible stone ground ──────────────────────────
  // Lightened base + emissive so the ground reads as a warm stone rather
  // than near-black (the dark ground made it hard to see player/enemy
  // silhouettes during fights).
  const fm = new THREE.MeshStandardMaterial({
    color:0x6e5b46, emissive:0x141008, emissiveIntensity:0.20,
    roughness:0.95, metalness:0.03
  });
  sceneFloorMat = fm;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W+12, H+12), fm);
  floor.rotation.x = -Math.PI/2; floor.position.y = -0.02;
  floor.receiveShadow = true; scene.add(floor);
  floor.updateMatrix(); floor.matrixAutoUpdate=false;

  // Subtle stone tile seams — also lifted slightly so the lines are visible
  // against the lighter floor.
  const grid = new THREE.GridHelper(Math.max(W,H)+4, 22, 0x3c2f1e, 0x2c2218);
  grid.material.opacity = 0.30; grid.material.transparent = true;
  grid.position.y = 0.004; scene.add(grid);
  grid.updateMatrix(); grid.matrixAutoUpdate=false;
  sceneGrid = grid;

  // ── WALL-BASE GLOW STRIPS ────────────────────────────────
  const sm = new THREE.MeshStandardMaterial({
    color:0x08090f, emissive:0x0088ff, emissiveIntensity:1.60,
    transparent:true, opacity:0.65, depthWrite:false
  });
  sceneStripMat = sm;
  [[W+0.2,0.12,0.28,0,0.06,-ARENA_H+0.14],[W+0.2,0.12,0.28,0,0.06,ARENA_H-0.14],
   [0.28,0.12,H+0.2,-ARENA_W+0.14,0.06,0],[0.28,0.12,H+0.2,ARENA_W-0.14,0.06,0]]
  .forEach(([w,h,d,x,y,z])=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),sm); m.position.set(x,y,z); scene.add(m);
  });

  // ── CLIFF WALLS ──────────────────────────────────────────
  const wm = new THREE.MeshStandardMaterial({
    color:0x354254, emissive:0x0088ff, emissiveIntensity:0.24,
    roughness:0.88, metalness:0.10
  });
  sceneWallMat = wm;
  // Darker cap layer for the wall top (overhang silhouette)
  const capMat = new THREE.MeshStandardMaterial({
    color:0x283341, emissive:0x0066aa, emissiveIntensity:0.16,
    roughness:0.92, metalness:0.06
  });
  function wall(w,h,d,x,z){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wm);
    m.position.set(x,h/2,z); m.castShadow=true; m.receiveShadow=true; scene.add(m);
    // cap overhang
    const cap=new THREE.Mesh(new THREE.BoxGeometry(w+0.6,0.28,d+0.6),capMat);
    cap.position.set(x,h+0.14,z); scene.add(cap);
  }
  wall(W+6, WALL_H+1.2, 2.5, 0, -ARENA_H-1.25);
  wall(W+6, WALL_H+1.2, 2.5, 0,  ARENA_H+1.25);
  wall(2.5, WALL_H+1.2, H+6, -ARENA_W-1.25, 0);
  wall(2.5, WALL_H+1.2, H+6,  ARENA_W+1.25, 0);

  // Corner tower pillars
  const towerMat=new THREE.MeshStandardMaterial({
    color:0x303b4b, emissive:0x0066aa, emissiveIntensity:0.18,
    roughness:0.92, metalness:0.08
  });
  [[-ARENA_W-1.25,-ARENA_H-1.25],[ARENA_W+1.25,-ARENA_H-1.25],
   [-ARENA_W-1.25, ARENA_H+1.25],[ARENA_W+1.25, ARENA_H+1.25]]
  .forEach(([x,z])=>{
    const h=WALL_H+1.8;
    const m=new THREE.Mesh(new THREE.BoxGeometry(3.2,h,3.2),towerMat);
    m.position.set(x,h/2,z); scene.add(m);
    // tower cap
    const tc=new THREE.Mesh(new THREE.BoxGeometry(3.8,0.32,3.8),capMat);
    tc.position.set(x,h+0.16,z); scene.add(tc);
  });

  // ── INITIAL OBSTACLES (layout 0 placeholder) ─────────────
  const om=new THREE.MeshStandardMaterial({
    color:0x2c2620, emissive:0x080604, emissiveIntensity:0.16,
    roughness:0.95, metalness:0.05
  });
  MAP_LAYOUTS[0].forEach(([w,h,d,x,z])=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),om);
    m.position.set(x,h/2,z); m.castShadow=true; m.receiveShadow=true; scene.add(m);
    obstacleObjects.push(m);
    obstacleBoxes.push({x,z,hw:w/2,hd:d/2});
  });

  // Exit zone ring: hidden during combat, revealed above the map when the wave is clear.
  exitRingMat=new THREE.MeshBasicMaterial({color:0x00ffcc,transparent:true,opacity:0,side:THREE.DoubleSide,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending});
  const _er=new THREE.Mesh(new THREE.RingGeometry(1.6,1.9,36),exitRingMat);
  _er.rotation.x=-Math.PI/2; _er.position.set(0,0.12,EXIT_Z); _er.visible=false; _er.renderOrder=120; scene.add(_er);
  exitRingMesh=_er;
  ensureExitPortal();
  closeExit();

  // Corner accent lights
  if(!isMobile){
    [[0x0055ff,-ARENA_W+1,-ARENA_H+1],[0xff0066,ARENA_W-1,-ARENA_H+1],
     [0x00ffcc,-ARENA_W+1,ARENA_H-1],[0xaa00ff,ARENA_W-1,ARENA_H-1]]
    .forEach(([c,x,z])=>{const l=new THREE.PointLight(c,1.6,11); l.position.set(x,1.4,z); scene.add(l);});
  }
}

// Obstacle materials lightened so walls don't disappear into the floor.
// Old base 0x3b4653 read as "near-black blob" against the dark ground; the
// new tone is closer to weathered slate (still cool/neutral, just legible).
const _obstOm = new THREE.MeshStandardMaterial({color:0x6a7a8c,emissive:0x1a3a52,emissiveIntensity:0.28,roughness:0.88,metalness:0.10});
const _mapObstacleMats = MAP_COLORS.map(()=>new THREE.MeshStandardMaterial({
  color:0x6a7888, emissive:0x183448, emissiveIntensity:0.26, roughness:0.88, metalness:0.10
}));
const _bridgeMat = new THREE.MeshStandardMaterial({color:0x6a4f2c,emissive:0x9c6622,emissiveIntensity:0.26,roughness:0.86,metalness:0.10});
const _rockMat   = new THREE.MeshStandardMaterial({color:0x4a4036,emissive:0x0a0805,emissiveIntensity:0.10,roughness:0.96,metalness:0.03});
const _coverMat  = new THREE.MeshStandardMaterial({color:0x31465a,emissive:0x2ccfff,emissiveIntensity:0.35,roughness:0.78,metalness:0.16});
const _breakMat  = new THREE.MeshStandardMaterial({color:0x5a381c,emissive:0xff9a22,emissiveIntensity:0.30,roughness:0.86,metalness:0.06});
const _breakMarkMat = new THREE.MeshBasicMaterial({color:0xffdd66,transparent:true,opacity:0.82,depthWrite:false});
function addFloorStrip(x,z,w,d,col,opacity=0.14){
  if(isMobile) return;
  const mat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);
  mesh.rotation.x=-Math.PI/2;
  mesh.position.set(x,0.018,z);
  scene.add(mesh);
  mapDecorObjects.push(mesh);
}
function makeZoneMesh(zone,col,opacity,y=0.024){
  const geo=zone.shape==='circle'
    ? new THREE.CircleGeometry(zone.r||1,isMobile?32:56)
    : new THREE.PlaneGeometry(zone.w||1,zone.d||1);
  const mat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false,blending:zone.blending??THREE.NormalBlending});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.rotation.x=-Math.PI/2;
  mesh.position.set(zone.x, y, zone.z);
  scene.add(mesh);
  return {mesh,mat};
}
function zoneRandomPoint(zone){
  if(zone.shape==='circle'){
    const a=Math.random()*Math.PI*2;
    const r=Math.sqrt(Math.random())*(zone.r||1);
    return {x:zone.x+Math.cos(a)*r,z:zone.z+Math.sin(a)*r};
  }
  return {x:zone.x+(Math.random()-0.5)*(zone.w||1),z:zone.z+(Math.random()-0.5)*(zone.d||1)};
}
function addZoneDetailMesh(mesh,target){
  scene.add(mesh);
  target.push(mesh);
  return mesh;
}
function decorateZone(zone,kind,target){
  const details=[];
  const isCirc=zone.shape==='circle';
  const ZR=zone.r||1, ZW=zone.w||2, ZD=zone.d||2;
  const flat=(geo,col,op,y,blend=THREE.NormalBlending)=>{
    const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,side:THREE.DoubleSide,depthWrite:false,blending:blend}));
    m.rotation.x=-Math.PI/2; m.position.set(zone.x,y,zone.z);
    addZoneDetailMesh(m,target); return m;
  };
  if(kind==='water'){
    // Shore ring — circles only (rectangle shore extends past zone ends → ugly dark caps)
    if(isCirc){
      flat(new THREE.RingGeometry(ZR*0.90,ZR*1.14,isMobile?28:48),
           0x08345a, 0.82, 0.018);
    }
    // Additive glow highlight (makes water feel lit — works for both circle and rect)
    flat(isCirc?new THREE.CircleGeometry(ZR*0.62,isMobile?20:36)
               :new THREE.PlaneGeometry(ZW*0.64,ZD*0.64),
         0x1680cc, 0.42, 0.036, THREE.AdditiveBlending);
    // Center hotspot
    flat(isCirc?new THREE.CircleGeometry(ZR*0.30,isMobile?14:24)
               :new THREE.PlaneGeometry(ZW*0.30,ZD*0.30),
         0x44bbff, 0.26, 0.042, THREE.AdditiveBlending);
    // Animated shimmer lines
    const lc=isMobile?5:12;
    for(let i=0;i<lc;i++){
      const p=zoneRandomPoint(zone);
      const len=isCirc?ZR*(0.7+Math.random()*0.9):Math.max(ZW,ZD)*(0.28+Math.random()*0.30);
      const line=new THREE.Mesh(new THREE.PlaneGeometry(len,0.040),
        new THREE.MeshBasicMaterial({color:Math.random()<0.5?0x66ddff:0xaaeeff,transparent:true,
          opacity:0.18+Math.random()*0.22,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
      line.rotation.x=-Math.PI/2; line.rotation.z=Math.random()*Math.PI;
      line.position.set(p.x,0.046+i*0.001,p.z);
      line.userData.waterLine=true;
      addZoneDetailMesh(line,target); details.push(line);
    }
  } else if(kind==='grass'){
    // Ground variation: scattered earth/shadow circles (static). Share two
    // materials across all circles in the zone so we aren't creating dozens
    // of unique MeshBasicMaterials per grass patch.
    const pc=isMobile?8:14;
    const grassEarthMatA=new THREE.MeshBasicMaterial({color:0x172e06,transparent:true,opacity:0.62,side:THREE.DoubleSide,depthWrite:false});
    const grassEarthMatB=new THREE.MeshBasicMaterial({color:0x203510,transparent:true,opacity:0.62,side:THREE.DoubleSide,depthWrite:false});
    for(let i=0;i<pc;i++){
      const p=zoneRandomPoint(zone);
      const r=0.16+Math.random()*0.36;
      const m=new THREE.Mesh(new THREE.CircleGeometry(r,6), Math.random()<0.55?grassEarthMatA:grassEarthMatB);
      m.rotation.x=-Math.PI/2; m.position.set(p.x,0.016,p.z);
      addZoneDetailMesh(m,target);
    }
    // Grass tufts. Original count (40 × 3 = 120 transparent meshes per zone
    // on desktop, × multiple zones per map) tanked low-end laptops because
    // every blade is its own transparent draw call. Down-tuned to 16 × 2 =
    // 32 blades per zone on desktop. Materials shared by colour bucket so
    // WebGL state changes drop further.
    const tc=isMobile?12:16;
    const bpT=2;
    const grassMats={};
    const getGrassMat=(col)=>{
      if(!grassMats[col]) grassMats[col]=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.88,side:THREE.DoubleSide,depthWrite:false});
      return grassMats[col];
    };
    const grassPalette=[0x66ee44,0x50cc38,0x88ff66,0x38a82a,0x44dd33];
    for(let ti=0;ti<tc;ti++){
      const p=zoneRandomPoint(zone);
      for(let bi=0;bi<bpT;bi++){
        const bh=0.24+Math.random()*0.30;
        const bw=0.13+Math.random()*0.09;
        const col=grassPalette[Math.floor(Math.random()*grassPalette.length)];
        const blade=new THREE.Mesh(new THREE.PlaneGeometry(bw,bh), getGrassMat(col));
        const ox=(Math.random()-0.5)*0.16, oz=(Math.random()-0.5)*0.16;
        blade.position.set(p.x+ox, bh*0.5, p.z+oz);
        blade.rotation.y=(bi/bpT)*Math.PI+(Math.random()-0.5)*0.5;
        const bz=(Math.random()-0.5)*0.28;
        blade.rotation.z=bz;
        addZoneDetailMesh(blade,target); details.push(blade);
      }
    }
  } else if(kind==='damage'){
    const count=isMobile?6:12;
    for(let i=0;i<count;i++){
      const p=zoneRandomPoint(zone);
      const len=zone.shape==='circle'?(zone.r||1)*(0.7+Math.random()*0.8):(zone.w||zone.d||3)*(0.22+Math.random()*0.28);
      const mat=new THREE.MeshBasicMaterial({color:Math.random()<0.5?0xffdd55:0xff3322,transparent:true,opacity:0.30,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
      const crack=new THREE.Mesh(new THREE.PlaneGeometry(len,0.055),mat);
      crack.rotation.x=-Math.PI/2;
      crack.rotation.z=Math.random()*Math.PI;
      crack.position.set(p.x,0.039+i*0.0006,p.z);
      addZoneDetailMesh(crack,target);
      details.push(crack);
    }
  }
  return details;
}
function addRiverRibbon(river,target){
  const path=(river.path||[]).map(([x,z])=>({x,z}));
  if(path.length<2) return;
  const W=river.width||2.0;
  const yOff=river.y||0;
  const rOrder=river.order||0;
  const mk=(col,op,blend=THREE.NormalBlending)=>
    new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,side:THREE.DoubleSide,depthWrite:false,blending:blend,polygonOffset:true,polygonOffsetFactor:-2-rOrder,polygonOffsetUnits:-2-rOrder});
  // Three bold bands: earth → dark water → bright water center
  const mEarth=mk(0x0e1c08,0.97);   // muddy dark-green earth bank
  const mDeep =mk(0x0c3c6e,0.97);   // deep water (dark navy)
  const mMid  =mk(0x1468a8,0.93);   // mid water (medium blue)
  const mShine=mk(0x22aadd,0.36,THREE.AdditiveBlending); // surface shine
  const mFoam =mk(0x88d8f8,0.44,THREE.AdditiveBlending); // white foam streaks
  const seg=(w,d,cx,cz,ang,mat,y)=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat.clone());
    m.rotation.x=-Math.PI/2; m.rotation.z=-ang; m.position.set(cx,y+yOff,cz);
    m.renderOrder=30+rOrder*10+Math.round(y*1000);
    scene.add(m); target.push(m);
  };
  const circ=(r,cx,cz,mat,y)=>{
    const m=new THREE.Mesh(new THREE.CircleGeometry(r,isMobile?20:36),mat.clone());
    m.rotation.x=-Math.PI/2; m.position.set(cx,y+yOff,cz);
    m.renderOrder=30+rOrder*10+Math.round(y*1000);
    scene.add(m); target.push(m);
  };
  for(let i=0;i<path.length-1;i++){
    const a=path[i],b=path[i+1];
    const dx=b.x-a.x, dz=b.z-a.z;
    const len=Math.hypot(dx,dz); if(len<0.01) continue;
    const ang=Math.atan2(dx,dz), cx=(a.x+b.x)/2, cz=(a.z+b.z)/2;
    const overlap=Math.min(1.8,W*0.55);
    seg(W+1.45, len+overlap,     cx,cz,ang, mEarth, 0.012); // earth bank (widest)
    seg(W+0.18, len+overlap+0.2, cx,cz,ang, mDeep,  0.020); // dark water
    seg(W*0.66,len+overlap+0.4,  cx,cz,ang, mMid,   0.028); // bright center
    seg(W*0.32,len+overlap+0.2,  cx,cz,ang, mShine, 0.038); // specular line
    // Foam perpendicular streaks along the river
    const fc=Math.max(1,Math.floor(len/2.2));
    for(let f=0;f<fc;f++){
      const t=(f+0.5)/fc;
      const px=a.x+dx*t+(Math.random()-0.5)*W*0.28;
      const pz=a.z+dz*t+(Math.random()-0.5)*W*0.28;
      seg(W*0.42,0.042,px,pz,ang+(Math.random()-0.5)*0.30,mFoam,0.046);
    }
  }
  // Seamless joints only. End caps stay flat so full-edge rivers do not show circles.
  for(let i=0;i<path.length;i++){
    const p=path[i];
    const isEnd=i===0||i===path.length-1;
    if(isEnd) continue;
    if(!isEnd) circ((W+1.45)*0.5, p.x,p.z, mEarth, 0.013);
    circ(W*(isEnd?0.62:0.56), p.x,p.z, mDeep, 0.021);
    circ(W*(isEnd?0.43:0.34), p.x,p.z, mMid, 0.029);
    circ(W*(isEnd?0.22:0.18), p.x,p.z, mShine, 0.039);
  }
}
function buildMapDecor(layoutIdx){
  const preset=ARENA_PRESETS[layoutIdx]||ARENA_PRESETS[0];
  const col=preset.color ?? MAP_COLORS[layoutIdx%MAP_COLORS.length];
  addFloorStrip(0,0,0.16,ARENA_H*2-5,col,0.12);
  for(const o of obstacleBoxes){
    addFloorStrip(o.x,o.z,o.hw*2+0.55,o.hd*2+0.55,col,0.06);
  }
  // Render floor decorations with additive blending so dark colors vanish on stone floor
  // and only bright/light accents glow through.
  (preset.floors||[]).forEach(f=>{
    const z=makeZoneMesh({...f,blending:THREE.AdditiveBlending},f.col||col,Math.min(f.opacity??0.16,0.22),0.021);
    mapDecorObjects.push(z.mesh);
  });
  (preset.rivers||[]).forEach(r=>addRiverRibbon(r,mapDecorObjects));
}
function disposeObstacleMesh(mesh){
  scene.remove(mesh);
  mesh.traverse(o=>{if(o.geometry) o.geometry.dispose();});
  // Only breakable blocks own their material; other blocks and marks share it.
  if(mesh.userData.ownsMaterial) mesh.material.dispose();
}
function changeMapLayout(layoutIdx){
  layoutIdx=((layoutIdx%ARENA_PRESETS.length)+ARENA_PRESETS.length)%ARENA_PRESETS.length;
  currentMapLayout=layoutIdx;
  obstacleObjects.forEach(disposeObstacleMesh);
  obstacleObjects.length=0;
  mapDecorObjects.forEach(m=>{scene.remove(m);m.geometry.dispose();m.material.dispose();});
  mapDecorObjects.length=0;
  mapHazardObjects.forEach(m=>{scene.remove(m);m.geometry.dispose();m.material.dispose();});
  mapHazardObjects.length=0;
  mapHazards.length=0;
  mapHazardTime=0;
  obstacleBoxes.length=0;
  const preset=ARENA_PRESETS[layoutIdx]||ARENA_PRESETS[0];

  // Apply map colour theme to walls, floor, and grid
  const theme = preset.theme || MAP_THEMES[layoutIdx % MAP_THEMES.length];
  if(sceneWallMat){
    // Outer cliff wall base — bumped up from the original 0x354254 so the
    // walls don't fade into pitch black under the player's overhead view.
    sceneWallMat.color.setHex(0x5a6a7c);
    sceneWallMat.emissive.setHex(theme.strip);
    sceneWallMat.emissiveIntensity = 0.22;
  }
  if(sceneFloorMat) sceneFloorMat.emissive.setHex(theme.floor);
  if(sceneStripMat) sceneStripMat.emissive.setHex(theme.strip);
  if(sceneGrid){
    scene.remove(sceneGrid);
    sceneGrid.geometry.dispose(); sceneGrid.material.dispose();
    const W=ARENA_W*2, H=ARENA_H*2;
    sceneGrid = new THREE.GridHelper(Math.max(W,H)+4, 22, 0x3c2f1e, 0x2c2218);
    sceneGrid.material.opacity=0.30; sceneGrid.material.transparent=true; sceneGrid.position.y=0.004;
    scene.add(sceneGrid);
    sceneGrid.updateMatrix(); sceneGrid.matrixAutoUpdate=false;
  }

  const mat=_mapObstacleMats[layoutIdx%_mapObstacleMats.length]||_obstOm;
  preset.blocks.forEach((block)=>{
    const {w,h,d,x,z}=Array.isArray(block)?{w:block[0],h:block[1],d:block[2],x:block[3],z:block[4]}:block;
    const isBreakable=!!block.destructible&&(preset.type==='boss'||block.breakable);
    const blockMat=isBreakable?_breakMat:block.bridge?_bridgeMat:block.rock?_rockMat:block.cover?_coverMat:mat;
    const geometry=block.crystal?new THREE.OctahedronGeometry(1).scale(w/2,h/2,d/2):new THREE.BoxGeometry(w,h,d);
    const m=new THREE.Mesh(geometry,blockMat);
    m.position.set(x,h/2,z); m.castShadow=true; m.receiveShadow=true; scene.add(m);
    m.updateMatrix(); m.matrixAutoUpdate=false;
    if(isBreakable){
      m.material=blockMat.clone();
      m.userData.ownsMaterial=true;
      m.material.emissiveIntensity=block.cover?0.45:block.bridge?0.26:0.32;
      if(block.crystal){
        m.material.color.setHex(0xbb88ee);m.material.emissive.setHex(0x9944ff);
        m.material.emissiveIntensity=.65;m.material.roughness=.25;
      }
      if(!block.crystal){
      const mark=new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.35,w*0.76),0.055,Math.max(0.35,d*0.76)),_breakMarkMat);
      mark.position.y=h/2+0.045;
      m.add(mark);
      }
    }
    obstacleObjects.push(m);
    obstacleBoxes.push({x,z,hw:w/2,hd:d/2,crystal:!!block.crystal,destructible:isBreakable,hp:block.hp||120,maxHp:block.hp||120,mesh:m});
  });
  (preset.hazards||[]).forEach(h=>{
    const kind=h.type==='grass'?'grass':h.type==='slow'?'water':'damage';
    let mesh=null, matH=null, details=[];
    if(h.visual!==false){
      const baseCol=kind==='grass'?0x1a4a0a:kind==='water'?0x0d4880:(h.col||preset.color||0xff3355);
      const baseOpacity=h.type==='heat'?0.08:kind==='grass'?0.93:kind==='water'?0.93:0.30;
      const z=makeZoneMesh({...h,blending:kind==='damage'?THREE.AdditiveBlending:THREE.NormalBlending},baseCol,baseOpacity,0.026);
      mesh=z.mesh; matH=z.mat;
      mapHazardObjects.push(mesh);
      details=decorateZone(h,kind,mapHazardObjects);
      if(h.type==='heat')for(const detail of details)detail.visible=false;
    }
    mapHazards.push({...h,mesh,mat:matH,details,kind,t:0});
  });
  buildMapDecor(layoutIdx);
  buildNavBlocked();
}

// ── Player ────────────────────────────────────────────────
function destroyObstacle(o, col=0xffcc33, relay=true){
  if(!o||o._gone) return;
  if(o.crystal)col=0xcc88ff;
  o._gone=true;
  const ox=o.x, oz=o.z;
  if(o.mesh){
    const p=o.mesh.position;
    burst({x:p.x,z:p.z},col,isMobile?10:18);
    spawnShockwave(p.x,p.z,Math.max(o.hw,o.hd)*2.1,col,0.28,0.7);
    disposeObstacleMesh(o.mesh);
    const mi=obstacleObjects.indexOf(o.mesh);
    if(mi>=0) obstacleObjects.splice(mi,1);
  }
  const oi=obstacleBoxes.indexOf(o);
  if(oi>=0) obstacleBoxes.splice(oi,1);
  buildNavBlocked();
  if(relay&&mp?.connected&&mp.isHost&&!mp.soloMode) broadcastMP({type:'BREAK_OBSTACLE',x:Math.round(ox*100)/100,z:Math.round(oz*100)/100,col});
}
function damageObstacle(o,dmg,col=0xffcc33){
  if(!o?.destructible||o._gone) return false;
  o.hp-=dmg;
  if(o.mesh?.material){
    const pct=Math.max(0,o.hp/(o.maxHp||1));
    o.mesh.material.emissiveIntensity=0.35+0.65*(1-pct);
    o.mesh.scale.y=0.75+0.25*pct;
    o.mesh.updateMatrix();
  }
  if(o.hp<=0){ destroyObstacle(o,col); return true; }
  return false;
}
function breakTerrain(pos,r=4,limit=3,col=0xff3355){
  const nearby=obstacleBoxes
    .filter(o=>o.destructible&&!o._gone&&Math.hypot(o.x-pos.x,o.z-pos.z)<r+Math.max(o.hw,o.hd))
    .sort((a,b)=>Math.hypot(a.x-pos.x,a.z-pos.z)-Math.hypot(b.x-pos.x,b.z-pos.z));
  nearby.slice(0,limit).forEach(o=>destroyObstacle(o,col));
}

// Reload / magazine system. The primary weapon now has a 25-round mag; each
// shot consumes 1 round, hitting 0 auto-triggers a RELOAD_TIME reload, and
// pressing R manually reloads (refilling instantly when the timer is done).
// Bonus shots (spread, railBurst, overclockBarrage, bulletHellEngine) are
// part of the same fire EVENT and don't cost extra ammo.
const PRIMARY_FIRE_CATCHUP_MAX = 4;
const MAG_SIZE = 25;
const RELOAD_TIME = 1.5;
// Dynamic accessors so mag-size / reload-speed skills (and a future weapon
// swap that ships with its own base values) all funnel through one spot.
// `playerSkills` is declared further down; the helpers read it at runtime so
// the lexical order is fine — these aren't called at parse time.
function currentMagSize(){
  const gun=(typeof GUNS!=='undefined'&&player)?(GUNS[player.gun]||GUNS.pistol):null;
  const base=gun ? gun.magSize : MAG_SIZE;
  return Math.max(1, Math.round(base * (typeof MAG_SIZE_MULT!=='undefined'
    ? (MAG_SIZE_MULT[playerSkills.magSize||0]||1)
    : 1)));
}
function currentReloadTime(){
  const gun=(typeof GUNS!=='undefined'&&player)?(GUNS[player.gun]||GUNS.pistol):null;
  const base=gun ? gun.reloadTime : RELOAD_TIME;
  return Math.max(0.15, base * (player.gravityExhaustion>0?1.5:1) * (typeof RELOAD_TIME_MULT!=='undefined'
    ? (RELOAD_TIME_MULT[playerSkills.reloadSpeed||0]||1)
    : 1));
}
function weaponReloadTime(){
  const mult=player.gun==='ak47'?ak47Rhythm.reload(skillPickLevel('ak47Tactical')):1;
  return Math.max(.15,currentReloadTime()*mult);
}
function currentFireCd(){
  const gun=(typeof GUNS!=='undefined'&&player)?(GUNS[player.gun]||GUNS.pistol):null;
  return gun ? gun.fireCd : FIRE_CD;
}
const player = {
  pos: new THREE.Vector3(), hp:MAX_HP, maxHp:MAX_HP, overhealShield:0, _bloodGrowthHp:0,
  fireCd:0, invincible:0,
  gravityCharge:0, gravityChargeLatch:false, gravityExhaustion:0,
  ammo:MAG_SIZE, reloadT:0, reloadDur:RELOAD_TIME,
  dashCd:0, dashT:0, dashVX:0, dashVZ:0, dashTrailT:0, dashKinetic:0, kineticCharge:0, speedBoostT:0, repairPulseCd:0,
  meleeDashSpeed:0, meleeDashSpecial:false,
  // Hook swing state — when active, the player is yanked toward (hookSwingX,
  // hookSwingZ) while still accepting WASD input. Position is clamped to the
  // circle of radius hookSwingR around that point so they orbit the hook
  // anchor instead of being released into open space.
  hookSwingT:0, hookSwingX:0, hookSwingZ:0, hookSwingR:0, hookSwingPull:0,
  hookSwingDur:0, hookSwingMode:'', hookVelX:0, hookVelZ:0,
  hookWallInputSign:1, hookOrbitDir:0, hookWallBuffer:0,
  hookInertiaT:0, hookInertiaVX:0, hookInertiaVZ:0,
  hookRope:null, hookRopeMat:null,
  barrierActive:false, barrierCd:0,
  spellCd:0, healFlashT:0, fireRingCd:0, homingBombCd:0, stormCallCd:0,
  meleeWeapon:'katana', meleeCd:0,
  gun:'pistol', minigunSpin:0, railCharge:0, railChargeSfxT:0, railMaxFx:false, railWasCharging:false,
  mesh:null, nameTag:null, dead:false, downed:false, downedT:0, reviveT:0, lastReviveTouch:0, reviverCount:0,
};

// ── Primary guns (ranged weapon) ────────────────────────────
// Each gun overrides the base FIRE_CD / MAG_SIZE / RELOAD_TIME at the
// firing-block call sites and dictates per-shot damage / spread / pellet
// count. Players pick their gun on a dedicated screen BEFORE the melee
// select at the start of every run.
//
//   fireCd          — seconds between shots (lower = faster)
//   magSize         — rounds per magazine (replaces the legacy MAG_SIZE=25)
//   reloadTime      — seconds to reload (replaces RELOAD_TIME=1.5)
//   dmgMult         — multiplier on playerStats.attackDmg (per-pellet for
//                     multi-pellet weapons; total per-trigger DPS is
//                     dmgMult * bulletsPerShot / fireCd)
//   spread          — cone half-angle in radians applied as random jitter
//                     to each bullet's aim vector
//   bulletsPerShot  — number of bullets fired per pulled trigger
//   color / css     — accent colour for the in-game projectile and the
//                     selection card
//   desc            — one-line summary shown on the pick card
const GUNS = {
  gravity: { id:'gravity', name:'GRAVITY CANNON', icon:'🌀', css:'#b87aff', color:0xb87aff,
             kind:'gravity', fireCd:1.6, magSize:3, reloadTime:2.8, dmgMult:3.2, spread:0.02,
             bulletsPerShot:1, bulletSpeed:4, life:2.4, range:7, hitR:0.35, explodeR:3.6, explodeMult:1,
             pullRadius:4.5, pullSpeed:5, bossPullMult:0.18,
             desc:'Aim a gravity field that slows and pulls, then explodes. Reduced pull on bosses; walls block attraction.' },
  pistol:  { id:'pistol',  name:'PISTOL',  icon:'🔫', css:'#00eeff', color:0x00ffff,
             fireCd:0.36, magSize:15, reloadTime:1.5, dmgMult:1.0, spread:0.05,
             bulletsPerShot:1, range:13,
             desc:'Balanced sidearm. Reliable single shot, tight cone.' },
  ak47:    { id:'ak47',    name:'AK47',    icon:'🔫', css:'#ff5555', color:0xff5555,
             fireCd:0.22, magSize:28, reloadTime:1.85, dmgMult:0.92, spread:0.14,
             bulletsPerShot:1, bulletSpeed:30, life:1.45, range:15,
             desc:'Heavy rifle. Stronger rounds, larger mag, faster but looser.' },
  smg:     { id:'smg',     name:'SMG',     icon:'⚙️', css:'#ffaa33', color:0xffaa33,
             fireCd:0.12, magSize:25, reloadTime:1.7, dmgMult:0.45, spread:0.20,
             bulletsPerShot:1, range:9,
             desc:'Spray fire. High RPM, low DMG per round, wide cone.' },
  shotgun: { id:'shotgun', name:'SHOTGUN', icon:'💥', css:'#ff6633', color:0xff6633,
             fireCd:0.85, magSize:8,  reloadTime:2.0, dmgMult:0.46, spread:0.34,
             bulletsPerShot:12, range:9,
             // Distance falloff: pellets do FULL dmgMult inside falloffStart
             // units, linearly drop to falloffMin × dmgMult past falloffEnd.
             // Encourages close-range commitment — past ~9 units a pellet
             // only does 25% of its base damage.
             falloffStart:2.0, falloffEnd:9.0, falloffMin:0.25,
             desc:'12-pellet blast. Heavy up close, falls off at range.' },
  burst:   { id:'burst',   name:'BURST RIFLE', icon:'🔫', css:'#9cff66', color:0x9cff66,
             fireCd:0.48, magSize:16, reloadTime:1.75, dmgMult:0.52, spread:0.075,
             bulletsPerShot:3, bulletSpeed:28, life:1.25, range:13,
             desc:'Three-round burst. Stable mid-range pressure.' },
  grenade: { id:'grenade', name:'GRENADE LAUNCHER', icon:'🧨', css:'#ffb84d', color:0xffb84d,
             fireCd:0.82, magSize:6, reloadTime:2.25, dmgMult:3.0, spread:0.08,
             bulletsPerShot:1, bulletSpeed:10.5, life:2.4, range:8.8, hitR:0.30, explodeR:2.65, explodeMult:0.78, kind:'grenade',
             desc:'Thrown explosive. Arcs, wall-bounces, then detonates.' },
  cryo:    { id:'cryo',    name:'CRYO SPRAYER', icon:'❄️', css:'#8feeff', color:0x8feeff,
             kind:'cryo', fireCd:0.14, magSize:60, reloadTime:2.25, dmgMult:0.32, spread:0,
             bulletsPerShot:1, range:5.8, cone:0.88,
             desc:'Cold cone. Lower damage, slows packed enemies.' },
  railgun: { id:'railgun', name:'RAILGUN', icon:'⚡', css:'#d6f7ff', color:0xd6f7ff,
             kind:'rail', fireCd:1.35, magSize:4, reloadTime:2.45, dmgMult:2.4, spread:0,
             bulletsPerShot:1, chargeMax:2.0, width:0.58, range:22,
             desc:'Hold to charge. Full charge devastates — uncharged still hits hard.' },
  flamethrower:{ id:'flamethrower', name:'FLAMETHROWER', icon:'🔥', css:'#ff7a22', color:0xff7a22,
             kind:'flame', fireCd:0.10, magSize:70, reloadTime:2.4, dmgMult:0.30, spread:0,
             bulletsPerShot:1, range:5.4, cone:0.95,
             desc:'Short cone of fire. Pierces crowds, burns fuel fast.' },
  sniper:  { id:'sniper',  name:'SNIPER',  icon:'🎯', css:'#b8f7ff', color:0xb8f7ff,
             fireCd:1.22, magSize:5, reloadTime:2.15, dmgMult:4.0, spread:0.006,
             bulletsPerShot:1, bulletSpeed:46, life:1.2, range:22, pierceBase:99, hitR:0.18,
             desc:'Slow precision rail. Huge damage and full pierce.' },
  rpg:     { id:'rpg',     name:'RPG',     icon:'🚀', css:'#ff3355', color:0xff3355,
             fireCd:1.15, magSize:4, reloadTime:2.2, dmgMult:3.4, spread:0.04,
             bulletsPerShot:1, bulletSpeed:12, life:2.8, range:14, hitR:0.36, explodeR:2.8, explodeMult:0.72,
             desc:'Slow rocket. Explodes hard, low ammo, slow reload.' },
  laser:   { id:'laser',   name:'LASER RIFLE', icon:'🔆', css:'#44f7ff', color:0x44f7ff,
             kind:'laser', fireCd:0.12, magSize:45, reloadTime:2.0, dmgMult:0.46, spread:0,
             bulletsPerShot:1, range:14.5, width:0.34,
             desc:'Continuous piercing beam. Tracks targets while firing.' },
  minigun: { id:'minigun', name:'MINIGUN', icon:'⚙️', css:'#ffee66', color:0xffee66,
             fireCd:0.20, minFireCd:0.070, ramp:0.42, magSize:90, reloadTime:3.0, dmgMult:0.36, spread:0.20,
             bulletsPerShot:1, bulletSpeed:30, life:1.45, range:11,
             desc:'Ramp-up bullet hose. Massive belt, long reload.' },
  boomerang:{id:'boomerang',name:'BOOMERANG',icon:'🪃', css:'#66ffcc', color:0x66ffcc,
             kind:'boomerang', fireCd:0.72, magSize:8, reloadTime:1.8, dmgMult:1.25, spread:0.06,
             bulletsPerShot:1, bulletSpeed:21, life:2.1, range:8.2, pierceBase:99, hitR:0.32,
             desc:'Returning blade shot. Pierces out and back.' },
};
function getActiveGun(){ return GUNS[player.gun] || GUNS.pistol; }
const GUN_SELECT_ORDER = ['pistol','shotgun','ak47','burst','grenade','cryo','railgun','smg','boomerang','minigun','sniper','rpg','flamethrower','laser','gravity'];
const GUN_CHEST_RARITIES = {
  common:{label:'COMMON',color:'#66ffcc',weight:50,ids:['pistol','shotgun','burst','cryo','smg']},
  rare:{label:'RARE',color:'#66bbff',weight:34,ids:['ak47','grenade','boomerang','flamethrower','sniper']},
  epic:{label:'EPIC',color:'#c96bff',weight:16,ids:['railgun','minigun','rpg','laser','gravity']},
};

const MELEE_WEAPONS = {
  katana:{id:'katana',name:'KATANA',icon:'⚔️',patternIcon:'〰️',color:0x66eeff,css:'#66eeff',range:2.75,arc:1.45,cd:1.0,dmgMult:5.5,stagger:0.18,desc:'Wide clean slash. Normal reach, wide area, fast cooldown.'},
  dagger:{id:'dagger',name:'DAGGER',icon:'🗡️',patternIcon:'📍',color:0xffdd66,css:'#ffdd66',range:2.2,arc:0.72,cd:2.0,dmgMult:11.5,stagger:0.26,desc:'Long reach stab. Narrow but extended hitbox, heavy damage.'},
  axe:{id:'axe',name:'AXE',icon:'🪓',patternIcon:'⭕',color:0xff8a3d,css:'#ff8a3d',range:2.9,arc:Math.PI*2,cd:3.0,dmgMult:12.0,stagger:0.30,area:'circle',desc:'Heavy spin. Hits all enemies around you.'},
  hook:{id:'hook',name:'HOOK',icon:'🪝',patternIcon:'🎯',color:0x5fffd6,css:'#5fffd6',range:10.5,arc:0.24,cd:3.0,dmgMult:12.0,stagger:0.34,area:'hook',desc:'Fires a rope hook, then pulls you to the hit.'},
  samurai:{id:'samurai',name:'SAMURAI',icon:'⚡',patternIcon:'➤',color:0xff5c88,css:'#ff5c88',range:7.1,arc:Math.PI*2,cd:5.0,dmgMult:13.0,stagger:0.24,area:'dash',desc:'Long dash slash. Damages the whole trail.'},
};

function makeMeleeModel(kind){
  const cfg=MELEE_WEAPONS[kind]||MELEE_WEAPONS.katana;
  const g=new THREE.Group();
  if(kind==='axe'){
    const handle=new THREE.Mesh(
      new THREE.CylinderGeometry(0.045,0.06,1.05,7),
      new THREE.MeshStandardMaterial({color:0x24150f,emissive:0x120804,emissiveIntensity:0.18,roughness:0.62,metalness:0.22})
    );
    handle.rotation.x=Math.PI/2;
    handle.position.z=0.24;
    const head=new THREE.Mesh(
      new THREE.BoxGeometry(0.54,0.11,0.32),
      new THREE.MeshStandardMaterial({color:0xffd6b5,emissive:cfg.color,emissiveIntensity:0.56,roughness:0.28,metalness:0.70})
    );
    head.position.z=0.82;
    const edge=new THREE.Mesh(
      new THREE.BoxGeometry(0.66,0.035,0.08),
      new THREE.MeshStandardMaterial({color:0xffffff,emissive:cfg.color,emissiveIntensity:0.92,roughness:0.2,metalness:0.78})
    );
    edge.position.set(0,0.02,0.99);
    g.add(handle,head,edge);
    g.position.set(-0.58,0.38,0.16);
    g.rotation.set(-0.30,-0.42,0.42);
    g.userData.weaponKind=kind;
    return g;
  }
  if(kind==='hook'){
    const handle=new THREE.Mesh(
      new THREE.CylinderGeometry(0.04,0.05,0.52,7),
      new THREE.MeshStandardMaterial({color:0x101515,emissive:cfg.color,emissiveIntensity:0.22,roughness:0.55,metalness:0.34})
    );
    handle.rotation.x=Math.PI/2;
    handle.position.z=-0.06;
    const shaft=new THREE.Mesh(
      new THREE.CylinderGeometry(0.022,0.026,0.66,6),
      new THREE.MeshStandardMaterial({color:0xdffcff,emissive:cfg.color,emissiveIntensity:0.72,roughness:0.22,metalness:0.70})
    );
    shaft.rotation.x=Math.PI/2;
    shaft.position.z=0.38;
    const hook=new THREE.Mesh(
      new THREE.TorusGeometry(0.18,0.026,6,18,Math.PI*1.25),
      new THREE.MeshStandardMaterial({color:0xeaffff,emissive:cfg.color,emissiveIntensity:0.88,roughness:0.2,metalness:0.75})
    );
    hook.rotation.set(0,Math.PI/2,Math.PI*0.15);
    hook.position.z=0.76;
    g.add(handle,shaft,hook);
    g.position.set(-0.58,0.38,0.16);
    g.rotation.set(-0.25,-0.46,0.32);
    g.userData.weaponKind=kind;
    return g;
  }
  const bladeLen=kind==='dagger'?0.62:1.16;
  const finalBladeLen=kind==='samurai'?1.48:bladeLen;
  const bladeW=kind==='dagger'?0.075:0.06;
  const blade=new THREE.Mesh(
    new THREE.BoxGeometry(kind==='samurai'?0.05:bladeW,bladeW,finalBladeLen),
    new THREE.MeshStandardMaterial({color:0xeefbff,emissive:cfg.color,emissiveIntensity:0.62,roughness:0.24,metalness:0.72})
  );
  blade.position.z=finalBladeLen*0.5;
  const guard=new THREE.Mesh(
    new THREE.BoxGeometry(kind==='dagger'?0.24:(kind==='samurai'?0.50:0.42),0.07,0.08),
    new THREE.MeshStandardMaterial({color:0x25202a,emissive:cfg.color,emissiveIntensity:0.24,roughness:0.52,metalness:0.45})
  );
  const grip=new THREE.Mesh(
    new THREE.CylinderGeometry(0.045,0.05,kind==='dagger'?0.38:(kind==='samurai'?0.62:0.48),6),
    new THREE.MeshStandardMaterial({color:0x111111,emissive:0x090909,emissiveIntensity:0.12,roughness:0.65,metalness:0.20})
  );
  grip.rotation.x=Math.PI/2;
  grip.position.z=kind==='dagger'?-0.18:(kind==='samurai'?-0.30:-0.22);
  g.add(blade,guard,grip);
  g.position.set(-0.58,0.38,0.18);
  g.rotation.set(-0.35,kind==='dagger'?-0.48:(kind==='samurai'?-0.28:-0.35),0.30);
  g.userData.weaponKind=kind;
  return g;
}

function setHeldMeleeModel(model, kind){
  if(!model) return;
  const old=model.userData.heldMelee;
  if(old&&old.userData.weaponKind===kind) return;
  if(old){ model.remove(old); old.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();}); }
  const next=makeMeleeModel(kind);
  model.add(next);
  model.userData.heldMelee=next;
}

function buildPlayer(){
  if(player.mesh) scene.remove(player.mesh);
  const g = new THREE.Group();
  const col = PLAYER_COLORS[mp.myId%MAX_PLAYERS];
  playerGlow.color.setHex(col.emi);
  const bMat = new THREE.MeshStandardMaterial({color:col.body,emissive:col.emi,emissiveIntensity:0.7,roughness:0.35,metalness:0.5});
  const body  = new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.58,1.1,14), bMat);
  const hMat  = new THREE.MeshStandardMaterial({color:col.emi,emissive:col.emi,emissiveIntensity:1.0,roughness:0.2});
  const head  = new THREE.Mesh(new THREE.SphereGeometry(0.36,10,10), hMat); head.position.y = 0.88;
  const eyeMat= new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:3});
  const eyeGeo= new THREE.SphereGeometry(0.08,6,6);
  const eyeL  = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set( 0.2,0.92,0.28);
  const eyeR  = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(-0.2,0.92,0.28);
  const gnMat = new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xaaffff,emissiveIntensity:0.6});
  const gun   = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.85,6), gnMat);
  gun.rotation.z = Math.PI/2; gun.position.set(0.9,0.4,0);
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.72,0.90,40),
    new THREE.MeshBasicMaterial({color:0xfff06a,transparent:true,opacity:0.62,depthTest:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending})
  );
  marker.rotation.x = -Math.PI/2;
  marker.position.y = -0.48;
  marker.renderOrder = 160;
  const markerGlow = new THREE.Mesh(
    new THREE.RingGeometry(0.96,1.18,48),
    new THREE.MeshBasicMaterial({color:0xfff06a,transparent:true,opacity:0.18,depthTest:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending})
  );
  markerGlow.rotation.x = -Math.PI/2;
  markerGlow.position.y = -0.49;
  markerGlow.renderOrder = 159;
  g.add(body, head, eyeL, eyeR, gun, marker, markerGlow);
  g.userData.selfMarker = marker;
  g.userData.selfMarkerGlow = markerGlow;
  setHeldMeleeModel(g, player.meleeWeapon);
  g.position.set(player.pos.x, 0.55, player.pos.z);
  scene.add(g); player.mesh = g;
}

// ══════════════════════════════════════════════════════════
// ── ENEMY MESH POOL (pre-allocated, zero runtime alloc) ──
// ══════════════════════════════════════════════════════════
const MAX_ENEMIES = 90; // hard cap for late waves with elites

// Build one shared geometry per type (already done in original, keep)
const ENEMY_GEO = {};
Object.entries(ETYPES).forEach(([type,cfg])=>{
  switch(type){
    case 'linker': ENEMY_GEO[type]=new THREE.OctahedronGeometry(cfg.r*1.3); break;
    case 'rammer': ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*2.1,.9,cfg.r*2.5); break;
    case 'tank':    ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*2.35,1.18,cfg.r*1.95); break;
    case 'shooter': ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*1.65,1.02,cfg.r*1.45); break;
    case 'speeder': ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*1.35,0.82,cfg.r*1.9); break;
    case 'bomber':  ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*1.7,1.08,cfg.r*1.7); break;
    case 'sniper':  ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*1.15,0.78,cfg.r*2.35); break;
    case 'dasher':  ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*1.2,0.78,cfg.r*2.1); break;
    case 'disruptor': ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*1.55,0.95,cfg.r*1.55); break;
    case 'healer':    ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*1.50,1.05,cfg.r*1.40); break;
    case 'shieldBearer':ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*1.65,1.12,cfg.r*1.55); break;
    case 'splitter': ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*1.8,1.12,cfg.r*1.6); break;
    case 'splitterling': ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*1.5,0.8,cfg.r*1.5); break;
    case 'summoner': ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*1.4,1.1,cfg.r*1.4); break;
    case 'berserker':ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*1.7,1.06,cfg.r*1.45); break;
    case 'boss':    ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*1.85,1.45,cfg.r*1.55); break;
    default:        ENEMY_GEO[type]=new THREE.BoxGeometry(cfg.r*1.55,1.02,cfg.r*1.35);
  }
});

// Pre-allocate MAX_ENEMIES material instances (one per pool slot, reused)
const enemyPoolMeshes = [];

const ENEMY_PART_GEO = {
  head:   new THREE.BoxGeometry(0.48,0.36,0.42),
  eye:    new THREE.SphereGeometry(0.055,5,4),
  limb:   new THREE.BoxGeometry(0.16,0.54,0.16),
  leg:    new THREE.BoxGeometry(0.18,0.48,0.18),
  foot:   new THREE.BoxGeometry(0.34,0.12,0.44),
  pod:    new THREE.BoxGeometry(0.34,0.34,0.34),
  visor:  new THREE.BoxGeometry(0.34,0.10,0.055),
  claw:   new THREE.ConeGeometry(0.12,0.34,5),
  barrel: new THREE.CylinderGeometry(0.065,0.085,0.72,6),
  fin:    new THREE.ConeGeometry(0.18,0.58,5),
  ring:   new THREE.TorusGeometry(0.52,0.025,5,22),
  core:   new THREE.IcosahedronGeometry(0.18,0),
  threatHalo: new THREE.RingGeometry(0.92,1.08,34),
  glyph:  new THREE.PlaneGeometry(0.5,0.5),
};

// Role glyph: a billboarded icon floating above each enemy so its archetype
// reads at a glance. Shape is per-type; the mesh is tinted with the enemy's
// emissive colour. Plain melee grunts get none (less clutter).
const ENEMY_GLYPH = {
  shooter:'diamond', sniper:'diamond', bomber:'circle', dasher:'arrow',
  disruptor:'hex', linker:'hex', healer:'cross', shieldBearer:'shield', tank:'chevron',
  summoner:'star',
};
const _glyphTexCache={};
function glyphTexture(shape){
  if(_glyphTexCache[shape]) return _glyphTexCache[shape];
  const s=64,c=document.createElement('canvas'); c.width=c.height=s;
  const x=c.getContext('2d'); x.translate(s/2,s/2);
  x.lineWidth=7; x.lineJoin='round'; x.lineCap='round'; x.strokeStyle='#fff'; x.fillStyle='#fff';
  const R=21; x.beginPath();
  if(shape==='diamond'){ x.moveTo(0,-R);x.lineTo(R,0);x.lineTo(0,R);x.lineTo(-R,0);x.closePath();x.stroke(); }
  else if(shape==='circle'){ x.arc(0,0,R-3,0,Math.PI*2);x.stroke();x.beginPath();x.arc(0,0,4,0,Math.PI*2);x.fill(); }
  else if(shape==='arrow'){ x.moveTo(0,-R);x.lineTo(R*0.82,R*0.5);x.lineTo(0,R*0.12);x.lineTo(-R*0.82,R*0.5);x.closePath();x.fill(); }
  else if(shape==='hex'){ for(let i=0;i<6;i++){const a=Math.PI/6+i*Math.PI/3,px=Math.cos(a)*R,py=Math.sin(a)*R;i?x.lineTo(px,py):x.moveTo(px,py);} x.closePath();x.stroke(); }
  else if(shape==='cross'){ x.fillRect(-6,-R,12,R*2);x.fillRect(-R,-6,R*2,12); }
  else if(shape==='shield'){ x.moveTo(-R*0.78,-R*0.7);x.lineTo(R*0.78,-R*0.7);x.lineTo(R*0.78,R*0.18);x.lineTo(0,R);x.lineTo(-R*0.78,R*0.18);x.closePath();x.stroke(); }
  else if(shape==='chevron'){ x.lineWidth=8;x.moveTo(-R,0);x.lineTo(0,-R*0.72);x.lineTo(R,0);x.moveTo(-R,R*0.55);x.lineTo(0,-R*0.18);x.lineTo(R,R*0.55);x.stroke(); }
  else if(shape==='star'){ for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?R*0.45:R;const px=Math.cos(a)*rr,py=Math.sin(a)*rr;i?x.lineTo(px,py):x.moveTo(px,py);} x.closePath();x.fill(); }
  const t=new THREE.CanvasTexture(c); t.needsUpdate=true; _glyphTexCache[shape]=t; return t;
}

function createEnemyModelSlot(){
  const group=new THREE.Group();
  group.visible=false;
  group.frustumCulled=false;

  const bodyMat=new THREE.MeshStandardMaterial({color:0xff2244,emissive:0xff1133,emissiveIntensity:0.45,roughness:0.38,metalness:0.45});
  const accentMat=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xff6688,emissiveIntensity:0.55,roughness:0.28,metalness:0.55});
  const eyeMat=new THREE.MeshBasicMaterial({color:0xffffff});

  const body=new THREE.Mesh(ENEMY_GEO.chaser,bodyMat);
  const head=new THREE.Mesh(ENEMY_PART_GEO.head,accentMat);
  const eyeL=new THREE.Mesh(ENEMY_PART_GEO.eye,eyeMat);
  const eyeR=new THREE.Mesh(ENEMY_PART_GEO.eye,eyeMat);
  const armL=new THREE.Mesh(ENEMY_PART_GEO.limb,accentMat);
  const armR=new THREE.Mesh(ENEMY_PART_GEO.limb,accentMat);
  const clawL=new THREE.Mesh(ENEMY_PART_GEO.claw,accentMat);
  const clawR=new THREE.Mesh(ENEMY_PART_GEO.claw,accentMat);
  const legL=new THREE.Mesh(ENEMY_PART_GEO.leg,accentMat);
  const legR=new THREE.Mesh(ENEMY_PART_GEO.leg,accentMat);
  const footL=new THREE.Mesh(ENEMY_PART_GEO.foot,accentMat);
  const footR=new THREE.Mesh(ENEMY_PART_GEO.foot,accentMat);
  const podL=new THREE.Mesh(ENEMY_PART_GEO.pod,accentMat);
  const podR=new THREE.Mesh(ENEMY_PART_GEO.pod,accentMat);
  const visor=new THREE.Mesh(ENEMY_PART_GEO.visor,eyeMat);
  const weapon=new THREE.Mesh(ENEMY_PART_GEO.barrel,accentMat);
  const fin=new THREE.Mesh(ENEMY_PART_GEO.fin,accentMat);
  const ring=new THREE.Mesh(ENEMY_PART_GEO.ring,accentMat);
  const core=new THREE.Mesh(ENEMY_PART_GEO.core,eyeMat);
  const threatHalo=new THREE.Mesh(
    ENEMY_PART_GEO.threatHalo,
    new THREE.MeshBasicMaterial({color:0xff3355,transparent:true,opacity:0.32,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending})
  );
  threatHalo.rotation.x=-Math.PI/2;
  threatHalo.position.y=-0.48;
  threatHalo.visible=false;
  threatHalo.renderOrder=72;

  const glyph=new THREE.Mesh(
    ENEMY_PART_GEO.glyph,
    new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending})
  );
  glyph.position.y=1.15;
  glyph.visible=false;
  glyph.renderOrder=80;

  // Champion-only: glowing aura sphere + billboarded HP bar (mini-boss feel).
  const aura=new THREE.Mesh(
    new THREE.SphereGeometry(1,16,12),
    new THREE.MeshBasicMaterial({color:0xff66ff,transparent:true,opacity:0.16,depthWrite:false,blending:THREE.AdditiveBlending})
  );
  aura.visible=false; aura.renderOrder=60;
  const hpbar=new THREE.Group(); hpbar.visible=false; hpbar.position.y=1.85;
  const hpbg=new THREE.Mesh(new THREE.PlaneGeometry(1.4,0.17),
    new THREE.MeshBasicMaterial({color:0x1a0014,transparent:true,opacity:0.72,depthWrite:false,depthTest:false}));
  hpbg.renderOrder=82;
  const hpfill=new THREE.Mesh(new THREE.PlaneGeometry(1.34,0.11),
    new THREE.MeshBasicMaterial({color:0xff44dd,transparent:true,opacity:0.96,depthWrite:false,depthTest:false}));
  hpfill.position.z=0.002; hpfill.renderOrder=83;
  hpbar.add(hpbg,hpfill);

  // Elite marker (colour-independent): a back-side additive shell that reads as
  // a glowing rim around the silhouette, plus a crown of outward spikes. Both
  // hidden for normal enemies; shown by applyEnemyVisual for elites/champions.
  const eliteShell=new THREE.Mesh(
    new THREE.SphereGeometry(0.95,16,12),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.0,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending})
  );
  eliteShell.position.y=0.5; eliteShell.visible=false; eliteShell.renderOrder=58;
  const eliteSpikes=new THREE.Group(); eliteSpikes.visible=false;
  {
    const _sg=new THREE.ConeGeometry(0.11,0.5,4);
    const _up=new THREE.Vector3(0,1,0), _d=new THREE.Vector3();
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2;
      const c=new THREE.Mesh(_sg,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.9,depthWrite:false,blending:THREE.AdditiveBlending}));
      c.position.set(Math.cos(a)*0.55,0.5,Math.sin(a)*0.55);
      c.quaternion.setFromUnitVectors(_up,_d.set(Math.cos(a),0.28,Math.sin(a)).normalize());
      eliteSpikes.add(c);
    }
  }
  eliteSpikes.renderOrder=59;

  // Boss-only: a distinct compound model built per boss (see buildBossModel).
  // Empty until a boss reuses this slot; hidden for normal enemies.
  const bossModel=new THREE.Group(); bossModel.visible=false; bossModel.frustumCulled=false;

  group.add(body,head,eyeL,eyeR,armL,armR,clawL,clawR,legL,legR,footL,footR,podL,podR,visor,weapon,fin,ring,core,threatHalo,glyph,aura,hpbar,eliteShell,eliteSpikes,bossModel);
  group.material=bodyMat;
  group.userData={body,head,eyeL,eyeR,armL,armR,clawL,clawR,legL,legR,footL,footR,podL,podR,visor,weapon,fin,ring,core,threatHalo,glyph,aura,hpbar,hpfill,eliteShell,eliteSpikes,bossModel,bodyMat,accentMat,eyeMat,type:'chaser'};
  scene.add(group);
  return group;
}

function hideEnemyParts(m){
  const p=m.userData;
  [p.head,p.eyeL,p.eyeR,p.armL,p.armR,p.clawL,p.clawR,p.legL,p.legR,p.footL,p.footR,p.podL,p.podR,p.visor,p.weapon,p.fin,p.ring,p.core,p.threatHalo].forEach(part=>{
    part.visible=false;
    part.position.set(0,0,0);
    part.rotation.set(0,0,0);
    part.scale.setScalar(1);
  });
  p.body.position.set(0,0,0);
  p.body.rotation.set(0,0,0);
  p.body.scale.setScalar(1);
  p.head.rotation.set(0,0,0);
  p.weapon.rotation.set(0,0,0);
  p.fin.rotation.set(0,0,0);
  p.ring.rotation.set(0,0,0);
  p.core.rotation.set(0,0,0);
  p.threatHalo.rotation.x=-Math.PI/2;
  p.threatHalo.position.y=-0.48;
  p.legL.rotation.set(0,0,0); p.legR.rotation.set(0,0,0);
  p.footL.rotation.set(0,0,0); p.footR.rotation.set(0,0,0);
}

function simplifyEnemyRigForTier(p,type){
  if(GFX_ENEMY_RIG_DETAIL>=2 || type==='boss') return;
  const keep = new Set(['body','visor']);
  if(type==='rammer'){keep.add('head');keep.add('podL');keep.add('podR');}
  if(type==='linker'){keep.add('core');keep.add('ring');keep.add('podL');keep.add('podR');}
  if(p.threatHalo?.visible) keep.add('threatHalo');
  if(GFX_ENEMY_RIG_DETAIL===1){
    keep.add('head');
    keep.add('eyeL');
    keep.add('eyeR');
    if(type==='shooter'||type==='sniper') keep.add('weapon');
    else if(type==='speeder'||type==='dasher'||type==='berserker') keep.add('fin');
    else if(type==='bomber'||type==='disruptor'||type==='healer'||type==='shieldBearer'||type==='summoner') keep.add('core');
    else if(type==='tank'||type==='splitter') keep.add('ring');
  }
  for(const key of ENEMY_RIG_KEYS){
    if(!keep.has(key) && p[key]) p[key].visible=false;
  }
  if(GFX_ENEMY_RIG_DETAIL<2 && p.glyph) p.glyph.visible=false;
  if(GFX_ENEMY_RIG_DETAIL===0){
    if(p.eliteShell) p.eliteShell.visible=false;
    if(p.eliteSpikes) p.eliteSpikes.visible=false;
    if(p.aura) p.aura.visible=false;
  }
}

function configureEnemyModel(m,type,cfg){
  const p=m.userData;
  p.type=type;
  hideEnemyParts(m);
  p.body.visible=true; // a prior boss in this slot hid it
  p.body.geometry=ENEMY_GEO[type]||ENEMY_GEO.chaser;

  // Role glyph above the head (skipped on potato tier for perf).
  const gshape=ENEMY_GLYPH[type];
  if(p.glyph){
    if(gshape && gfxTier!=='potato'){
      p.glyph.visible=true;
      p.glyph.material.map=glyphTexture(gshape);
      p.glyph.material.color.setHex(cfg.emi||cfg.col||0xffffff);
      p.glyph.material.opacity=0.95;
      p.glyph.material.needsUpdate=true;
      p.glyph.position.set(0,(type==='tank'||type==='shieldBearer')?1.4:1.15,0);
      p.glyph.scale.setScalar(1);
    } else {
      p.glyph.visible=false;
    }
  }
  // Champion aura/HP bar default off; applyEnemyVisual turns them on.
  if(p.aura) p.aura.visible=false;
  if(p.hpbar) p.hpbar.visible=false;

  const eyeZ=0.33;
  p.eyeL.visible=p.eyeR.visible=true;
  p.eyeL.position.set(-0.13,0.56,eyeZ);
  p.eyeR.position.set( 0.13,0.56,eyeZ);
  p.eyeL.scale.setScalar(1);
  p.eyeR.scale.setScalar(1);
  p.visor.visible=true;
  p.visor.position.set(0,0.62,0.39);
  p.legL.visible=p.legR.visible=p.footL.visible=p.footR.visible=true;
  p.legL.position.set(-0.22,-0.20,0.02);
  p.legR.position.set( 0.22,-0.20,0.02);
  p.footL.position.set(-0.22,-0.49,0.13);
  p.footR.position.set( 0.22,-0.49,0.13);
  p.body.position.y=0.13;
  p.body.scale.set(1.05,0.86,1.02);
  if(p.threatHalo){
    const threatColor = type==='sniper'?0x00eeff:type==='dasher'?0xff00cc:type==='bomber'?0xff5500:type==='disruptor'?0x55ff99:type==='boss'?0xffdd66:0xff3355;
    p.threatHalo.visible = type==='sniper'||type==='dasher'||type==='bomber'||type==='disruptor'||type==='boss';
    p.threatHalo.material.color.setHex(threatColor);
    p.threatHalo.material.opacity = type==='boss'?0.30:0.22;
    p.threatHalo.scale.setScalar(type==='boss'?1.95:1.0);
  }

  if(type==='chaser'){
    p.head.visible=p.armL.visible=p.armR.visible=p.clawL.visible=p.clawR.visible=true;
    p.head.position.set(0,0.78,0.02); p.head.scale.set(0.72,0.52,0.68);
    p.armL.position.set(-0.52,0.25,0.02); p.armR.position.set(0.52,0.25,0.02);
    p.armL.rotation.z=0.35; p.armR.rotation.z=-0.35;
    p.clawL.position.set(-0.68,0.02,0.18); p.clawR.position.set(0.68,0.02,0.18);
    p.clawL.rotation.x=Math.PI/2; p.clawR.rotation.x=Math.PI/2;
    p.visor.position.set(0,0.82,0.30); p.visor.scale.set(0.85,0.8,0.9);
  } else if(type==='shooter'){
    p.head.visible=p.weapon.visible=p.ring.visible=p.podL.visible=p.podR.visible=true;
    p.head.position.set(0,0.72,0); p.head.scale.set(0.7,0.7,0.7);
    p.weapon.position.set(0,0.32,0.66); p.weapon.rotation.x=Math.PI/2;
    p.podL.position.set(-0.42,0.32,0.18); p.podR.position.set(0.42,0.32,0.18);
    p.podL.scale.set(0.7,0.7,0.9); p.podR.scale.set(0.7,0.7,0.9);
    p.ring.position.set(0,0.36,0); p.ring.rotation.x=Math.PI/2; p.ring.scale.setScalar(0.95);
    p.eyeL.position.set(-0.11,0.78,0.28); p.eyeR.position.set(0.11,0.78,0.28);
    p.visor.position.set(0,0.78,0.31);
  } else if(type==='rammer'){
    p.head.visible=p.armL.visible=p.armR.visible=p.podL.visible=p.podR.visible=true;
    p.body.scale.set(1.15,.85,1.2);p.body.position.y=.22;
    p.head.position.set(0,.6,.5);p.head.scale.set(1.3,.55,1);
    p.armL.position.set(-.65,.2,.35);p.armR.position.set(.65,.2,.35);
    p.podL.position.set(-.5,.55,.8);p.podR.position.set(.5,.55,.8);
    p.podL.scale.set(.45,.45,1.5);p.podR.scale.set(.45,.45,1.5);
    p.eyeL.position.set(-.2,.67,.87);p.eyeR.position.set(.2,.67,.87);p.visor.position.set(0,.68,.9);
  } else if(type==='tank'){
    p.head.visible=p.armL.visible=p.armR.visible=p.ring.visible=p.podL.visible=p.podR.visible=true;
    p.body.position.y=0.24; p.body.scale.set(1.05,0.9,0.95);
    p.head.position.set(0,0.86,0.06); p.head.scale.set(0.95,0.65,0.85);
    p.armL.position.set(-0.9,0.3,0.05); p.armR.position.set(0.9,0.3,0.05);
    p.armL.scale.set(1.3,1.15,1.3); p.armR.scale.set(1.3,1.15,1.3);
    p.podL.position.set(-0.58,0.76,0.05); p.podR.position.set(0.58,0.76,0.05);
    p.podL.scale.set(1.0,0.65,0.75); p.podR.scale.set(1.0,0.65,0.75);
    p.ring.position.set(0,0.12,0); p.ring.rotation.x=Math.PI/2; p.ring.scale.set(1.45,1.45,1.45);
    p.eyeL.position.set(-0.18,0.88,0.38); p.eyeR.position.set(0.18,0.88,0.38);
    p.visor.position.set(0,0.90,0.43); p.visor.scale.set(1.25,1.1,1);
    p.legL.scale.set(1.35,1.15,1.35); p.legR.scale.set(1.35,1.15,1.35);
    p.footL.scale.set(1.35,1.15,1.35); p.footR.scale.set(1.35,1.15,1.35);
  } else if(type==='speeder'){
    p.fin.visible=p.core.visible=true;
    p.body.position.y=0.18; p.body.scale.set(0.95,0.75,1.15);
    p.fin.position.set(0,0.62,-0.16); p.fin.rotation.x=-Math.PI/2; p.fin.scale.set(0.8,0.8,1.2);
    p.core.position.set(0,0.5,0.26); p.core.scale.setScalar(0.9);
    p.eyeL.position.set(-0.11,0.58,0.32); p.eyeR.position.set(0.11,0.58,0.32);
    p.visor.position.set(0,0.58,0.36); p.legL.scale.set(0.8,0.9,0.8); p.legR.scale.set(0.8,0.9,0.8);
  } else if(type==='bomber'){
    p.head.visible=p.core.visible=p.ring.visible=p.podL.visible=p.podR.visible=true;
    p.head.position.set(0,0.75,0); p.head.scale.set(0.8,0.8,0.8);
    p.core.position.set(0,0.38,0.38); p.core.scale.set(1.2,1.2,1.2);
    p.podL.position.set(-0.36,0.26,-0.02); p.podR.position.set(0.36,0.26,-0.02);
    p.podL.scale.set(0.7,1.0,0.7); p.podR.scale.set(0.7,1.0,0.7);
    p.ring.position.set(0,0.5,0); p.ring.rotation.x=Math.PI/2; p.ring.scale.set(1.05,1.05,1.05);
    p.eyeL.position.set(-0.16,0.8,0.3); p.eyeR.position.set(0.16,0.8,0.3);
    p.visor.position.set(0,0.80,0.34);
  } else if(type==='sniper'){
    p.head.visible=p.weapon.visible=p.fin.visible=p.podL.visible=p.podR.visible=true;
    p.head.position.set(0,0.62,-0.22); p.head.scale.set(0.65,0.65,0.65);
    p.weapon.position.set(0,0.55,0.78); p.weapon.rotation.x=Math.PI/2; p.weapon.scale.set(0.75,0.75,1.55);
    p.podL.position.set(-0.36,0.50,0.06); p.podR.position.set(0.36,0.50,0.06);
    p.podL.scale.set(0.55,0.55,0.75); p.podR.scale.set(0.55,0.55,0.75);
    p.fin.position.set(0,0.46,-0.72); p.fin.rotation.x=-Math.PI/2; p.fin.scale.set(0.55,0.8,1.0);
    p.eyeL.position.set(-0.1,0.66,0.22); p.eyeR.position.set(0.1,0.66,0.22);
    p.visor.position.set(0,0.66,0.27); p.visor.scale.set(0.75,0.75,0.8);
  } else if(type==='dasher'){
    p.fin.visible=p.armL.visible=p.armR.visible=true;
    p.body.position.y=0.18; p.body.scale.set(0.85,0.78,1.18);
    p.fin.position.set(0,0.56,-0.35); p.fin.rotation.x=-Math.PI/2; p.fin.scale.set(0.75,0.75,1.45);
    p.armL.position.set(-0.42,0.28,-0.04); p.armR.position.set(0.42,0.28,-0.04);
    p.armL.rotation.z=-0.9; p.armR.rotation.z=0.9;
    p.eyeL.position.set(-0.1,0.58,0.35); p.eyeR.position.set(0.1,0.58,0.35);
    p.visor.position.set(0,0.58,0.39); p.legL.position.x=-0.18; p.legR.position.x=0.18;
  } else if(type==='disruptor'){
    p.head.visible=p.core.visible=p.ring.visible=p.podL.visible=p.podR.visible=true;
    p.body.position.y=0.18; p.body.scale.set(0.92,0.82,0.92);
    p.head.position.set(0,0.72,0.02); p.head.scale.set(0.72,0.62,0.72);
    p.core.position.set(0,0.35,0.34); p.core.scale.set(0.95,0.95,0.95);
    p.podL.position.set(-0.42,0.22,0.02); p.podR.position.set(0.42,0.22,0.02);
    p.podL.scale.set(0.75,0.75,0.75); p.podR.scale.set(0.75,0.75,0.75);
    p.ring.position.set(0,0.40,0); p.ring.rotation.x=Math.PI/2; p.ring.scale.set(1.02,1.02,1.02);
    p.eyeL.position.set(-0.10,0.74,0.29); p.eyeR.position.set(0.10,0.74,0.29);
    p.visor.position.set(0,0.74,0.33); p.visor.scale.set(0.8,0.8,0.8);
  } else if(type==='linker'){
    p.core.visible=p.ring.visible=p.podL.visible=p.podR.visible=true;
    p.body.scale.set(.8,1.3,.8);
    p.core.position.set(0,.65,0);p.core.scale.set(.8,.8,.8);
    p.podL.position.set(-.65,.45,0);p.podR.position.set(.65,.45,0);
    p.podL.scale.set(.5,1.6,.5);p.podR.scale.set(.5,1.6,.5);
    p.ring.position.set(0,.45,0);p.ring.rotation.x=Math.PI/2;p.ring.scale.set(1.5,1.5,1.5);
  } else if(type==='healer'){
    // Medic — head + core (heart-glow), pulsing ring underneath. No
    // weapon. Healer's signature visual is the spinning ring that grows
    // pulse-by-pulse (animated in the AI tick).
    p.head.visible=p.core.visible=p.ring.visible=p.podL.visible=p.podR.visible=true;
    p.body.position.y=0.18; p.body.scale.set(0.92,0.86,0.92);
    p.head.position.set(0,0.74,0.02); p.head.scale.set(0.70,0.62,0.70);
    p.core.position.set(0,0.40,0.30); p.core.scale.set(1.05,1.05,1.05);
    p.podL.position.set(-0.36,0.30,0.02); p.podR.position.set(0.36,0.30,0.02);
    p.podL.scale.set(0.65,0.70,0.65); p.podR.scale.set(0.65,0.70,0.65);
    p.ring.position.set(0,0.30,0); p.ring.rotation.x=Math.PI/2; p.ring.scale.set(1.30,1.30,1.30);
    p.eyeL.position.set(-0.12,0.78,0.32); p.eyeR.position.set(0.12,0.78,0.32);
    p.visor.position.set(0,0.78,0.36); p.visor.scale.set(0.70,0.70,0.70);
  } else if(type==='shieldBearer'){
    // Aegis — bulky front-loaded silhouette with a big shield-pod up front
    // (uses the existing `core` mesh) and chunky arms holding it. The
    // visual front is +z, matching how applyEnemyAttack and movement set
    // mesh.rotation.y to face the target. Bullet block check reads the
    // same forward vector.
    p.head.visible=p.armL.visible=p.armR.visible=p.core.visible=p.ring.visible=p.podL.visible=p.podR.visible=true;
    p.body.position.y=0.22; p.body.scale.set(1.10,0.96,0.95);
    p.head.position.set(0,0.78,-0.05); p.head.scale.set(0.78,0.65,0.78);
    p.armL.position.set(-0.66,0.40,0.20); p.armR.position.set(0.66,0.40,0.20);
    p.armL.scale.set(1.1,1.05,1.1); p.armR.scale.set(1.1,1.05,1.1);
    p.armL.rotation.z=0.28; p.armR.rotation.z=-0.28;
    // Front shield — big flat plate using the core mesh pushed forward.
    p.core.position.set(0,0.46,0.62); p.core.scale.set(1.85,1.55,0.36);
    p.podL.position.set(-0.40,0.78,-0.05); p.podR.position.set(0.40,0.78,-0.05);
    p.podL.scale.set(0.85,0.55,0.65); p.podR.scale.set(0.85,0.55,0.65);
    p.ring.position.set(0,0.15,0); p.ring.rotation.x=Math.PI/2; p.ring.scale.set(1.20,1.20,1.20);
    p.eyeL.position.set(-0.14,0.82,0.28); p.eyeR.position.set(0.14,0.82,0.28);
    p.visor.position.set(0,0.82,0.32); p.visor.scale.set(1.05,0.95,0.80);
    p.legL.scale.set(1.15,1.05,1.15); p.legR.scale.set(1.15,1.05,1.15);
  } else if(type==='splitter'){
    p.head.visible=p.armL.visible=p.armR.visible=p.clawL.visible=p.clawR.visible=p.ring.visible=true;
    p.head.position.set(0,0.8,0.02); p.head.scale.set(0.92,0.6,0.82);
    p.armL.position.set(-0.6,0.28,0.02); p.armR.position.set(0.6,0.28,0.02);
    p.armL.rotation.z=0.4; p.armR.rotation.z=-0.4;
    p.clawL.position.set(-0.78,0.04,0.2); p.clawR.position.set(0.78,0.04,0.2);
    p.clawL.rotation.x=Math.PI/2; p.clawR.rotation.x=Math.PI/2;
    p.ring.position.set(0,0.32,0); p.ring.rotation.x=Math.PI/2; p.ring.scale.setScalar(1.25);
    p.visor.position.set(0,0.86,0.30); p.visor.scale.set(1.0,0.85,0.9);
  } else if(type==='splitterling'){
    p.head.visible=p.clawL.visible=p.clawR.visible=true;
    p.body.scale.set(1.05,0.7,1.05);
    p.head.position.set(0,0.5,0.02); p.head.scale.set(0.6,0.45,0.58);
    p.clawL.position.set(-0.34,0.0,0.18); p.clawR.position.set(0.34,0.0,0.18);
    p.clawL.rotation.x=Math.PI/2; p.clawR.rotation.x=Math.PI/2;
    p.visor.position.set(0,0.54,0.24); p.visor.scale.set(0.7,0.7,0.8);
  } else if(type==='summoner'){
    p.head.visible=p.ring.visible=p.core.visible=p.podL.visible=p.podR.visible=true;
    p.body.position.y=0.18; p.body.scale.set(0.95,1.05,0.95);
    p.head.position.set(0,0.86,0); p.head.scale.set(0.78,0.78,0.78);
    p.core.position.set(0,0.5,0.0); p.core.scale.setScalar(1.5);
    p.ring.position.set(0,0.5,0); p.ring.rotation.x=Math.PI/2; p.ring.scale.setScalar(1.35);
    p.podL.position.set(-0.46,0.5,0.05); p.podR.position.set(0.46,0.5,0.05);
    p.podL.scale.set(0.7,0.7,0.7); p.podR.scale.set(0.7,0.7,0.7);
    p.eyeL.position.set(-0.11,0.92,0.28); p.eyeR.position.set(0.11,0.92,0.28);
    p.visor.position.set(0,0.9,0.31);
  } else if(type==='berserker'){
    p.head.visible=p.armL.visible=p.armR.visible=p.clawL.visible=p.clawR.visible=p.fin.visible=true;
    p.head.position.set(0,0.82,0.04); p.head.scale.set(0.78,0.56,0.72);
    p.armL.position.set(-0.58,0.3,0.04); p.armR.position.set(0.58,0.3,0.04);
    p.armL.rotation.z=0.5; p.armR.rotation.z=-0.5;
    p.clawL.position.set(-0.8,0.0,0.24); p.clawR.position.set(0.8,0.0,0.24);
    p.clawL.scale.setScalar(1.3); p.clawR.scale.setScalar(1.3);
    p.clawL.rotation.x=Math.PI/2; p.clawR.rotation.x=Math.PI/2;
    p.fin.position.set(0,0.6,-0.3); p.fin.scale.set(0.8,1.0,0.8);
    p.visor.position.set(0,0.86,0.30); p.visor.scale.set(0.95,0.8,0.9);
  } else if(type==='boss'){
    p.head.visible=p.armL.visible=p.armR.visible=p.clawL.visible=p.clawR.visible=p.ring.visible=p.core.visible=p.podL.visible=p.podR.visible=true;
    p.body.position.y=0.42; p.body.scale.set(1.2,1.0,1.1);
    p.head.position.set(0,1.35,0.05); p.head.scale.set(1.45,1.0,1.35);
    p.armL.position.set(-1.45,0.55,0.02); p.armR.position.set(1.45,0.55,0.02);
    p.armL.scale.set(2.0,1.8,2.0); p.armR.scale.set(2.0,1.8,2.0);
    p.armL.rotation.z=0.55; p.armR.rotation.z=-0.55;
    p.clawL.position.set(-1.85,0.14,0.38); p.clawR.position.set(1.85,0.14,0.38);
    p.clawL.scale.set(2.0,2.0,2.0); p.clawR.scale.set(2.0,2.0,2.0);
    p.clawL.rotation.x=Math.PI/2; p.clawR.rotation.x=Math.PI/2;
    p.podL.position.set(-1.1,1.05,0.08); p.podR.position.set(1.1,1.05,0.08);
    p.podL.scale.set(1.7,1.0,1.1); p.podR.scale.set(1.7,1.0,1.1);
    p.ring.position.set(0,0.8,0); p.ring.rotation.x=Math.PI/2; p.ring.scale.set(2.1,2.1,2.1);
    p.core.position.set(0,0.78,0.75); p.core.scale.set(1.6,1.6,1.6);
    p.eyeL.position.set(-0.28,1.42,0.72); p.eyeR.position.set(0.28,1.42,0.72);
    p.eyeL.scale.setScalar(1.5); p.eyeR.scale.setScalar(1.5);
    p.visor.position.set(0,1.42,0.78); p.visor.scale.set(2.1,1.7,1.2);
    p.legL.position.set(-0.42,-0.08,0.03); p.legR.position.set(0.42,-0.08,0.03);
    p.legL.scale.set(2.2,1.75,2.0); p.legR.scale.set(2.2,1.75,2.0);
    p.footL.position.set(-0.42,-0.45,0.25); p.footR.position.set(0.42,-0.45,0.25);
    p.footL.scale.set(2.4,1.65,2.2); p.footR.scale.set(2.4,1.65,2.2);
  }
  // Champion aura / HP bar / boss model default off; applyEnemyVisual enables them.
  if(p.bossModel) p.bossModel.visible=false;
  simplifyEnemyRigForTier(p,type);
  cacheEnemyRigPose(p);
}

// ── Distinct per-boss compound models (mirrors the orb-mesh style) ──────────
function _bossStd(col,emi,ei=0.7){ return new THREE.MeshStandardMaterial({color:col,emissive:emi,emissiveIntensity:ei,roughness:0.35,metalness:0.5}); }
function _bossGlow(col,op=0.5){ return new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false}); }
function buildBossModel(container,special,col,emi){
  while(container.children.length){ const c=container.children.pop(); c.geometry&&c.geometry.dispose&&c.geometry.dispose(); c.material&&c.material.dispose&&c.material.dispose(); }
  const ud=container.userData; ud.spinners=[]; ud.orbit=null; ud.core=null;
  const add=m=>{ container.add(m); return m; };
  if(special==='phantom'){
    ud.scale=0.72; ud.y=1.0;
    ud.core=add(new THREE.Mesh(new THREE.OctahedronGeometry(0.95,0),_bossStd(col,emi,0.95)));
    const r1=add(new THREE.Mesh(new THREE.TorusGeometry(1.5,0.08,6,28),_bossGlow(col,0.8))); r1.rotation.x=Math.PI/2;
    const r2=add(new THREE.Mesh(new THREE.TorusGeometry(1.9,0.05,6,32),_bossGlow(emi,0.6))); r2.rotation.z=Math.PI/3;
    add(new THREE.Mesh(new THREE.SphereGeometry(1.35,12,10),_bossGlow(col,0.12)));
    ud.spinners=[{m:r1,sz:1.4},{m:r2,sx:1.1}];
  } else if(special==='warden'){
    ud.scale=1.18; ud.y=1.0;
    ud.core=add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.4,0),_bossStd(col,emi,0.7)));
    const r1=add(new THREE.Mesh(new THREE.TorusGeometry(2.2,0.18,8,32),_bossGlow(col,0.7))); r1.rotation.x=Math.PI/2;
    const r2=add(new THREE.Mesh(new THREE.TorusGeometry(2.5,0.1,6,32),_bossGlow(emi,0.5))); r2.rotation.x=Math.PI/2.3;
    const plates=[]; for(let i=0;i<4;i++) plates.push(add(new THREE.Mesh(new THREE.BoxGeometry(0.7,0.7,0.7),_bossStd(col,emi,0.5))));
    ud.spinners=[{m:r1,sz:0.5},{m:r2,sz:-0.8}]; ud.orbit={items:plates,rad:2.2,speed:0.6,y:0};
  } else if(special==='apex'){
    ud.scale=1.0; ud.y=0.9;
    const body=add(new THREE.Mesh(new THREE.ConeGeometry(0.95,2.7,6),_bossStd(col,emi,0.8))); body.rotation.x=Math.PI/2; ud.core=body;
    const fL=add(new THREE.Mesh(new THREE.ConeGeometry(0.42,1.5,4),_bossGlow(emi,0.7))); fL.position.set(-0.95,0,-0.4); fL.rotation.z=0.5;
    const fR=add(new THREE.Mesh(new THREE.ConeGeometry(0.42,1.5,4),_bossGlow(emi,0.7))); fR.position.set(0.95,0,-0.4); fR.rotation.z=-0.5;
    const ring=add(new THREE.Mesh(new THREE.TorusGeometry(1.35,0.08,6,28),_bossGlow(col,0.7))); ring.rotation.x=Math.PI/2;
    ud.spinners=[{m:ring,sz:1.6}];
  } else if(special==='nexus'){
    ud.scale=1.05; ud.y=1.0;
    ud.core=add(new THREE.Mesh(new THREE.SphereGeometry(1.2,16,12),_bossStd(col,emi,0.85)));
    const sats=[]; for(let i=0;i<3;i++) sats.push(add(new THREE.Mesh(new THREE.SphereGeometry(0.42,10,8),_bossStd(emi,col,0.95))));
    const ring=add(new THREE.Mesh(new THREE.TorusGeometry(2.0,0.06,6,36),_bossGlow(col,0.6))); ring.rotation.x=Math.PI/2.4;
    ud.spinners=[{m:ring,sz:0.4,sx:0.3}]; ud.orbit={items:sats,rad:2.0,speed:1.5,y:0};
  } else if(special==='goliath'){
    // Hulking armoured titan: heavy faceted core, fixed shoulder pylons, a
    // slow ground ring + lumbering orbiting armour chunks.
    ud.scale=1.34; ud.y=1.1;
    ud.core=add(new THREE.Mesh(new THREE.DodecahedronGeometry(1.5,0),_bossStd(col,emi,0.55)));
    const shL=add(new THREE.Mesh(new THREE.BoxGeometry(0.95,1.25,0.95),_bossStd(col,emi,0.5))); shL.position.set(-1.65,0.4,0);
    const shR=add(new THREE.Mesh(new THREE.BoxGeometry(0.95,1.25,0.95),_bossStd(col,emi,0.5))); shR.position.set(1.65,0.4,0);
    const ring=add(new THREE.Mesh(new THREE.TorusGeometry(2.5,0.16,8,28),_bossGlow(emi,0.6))); ring.rotation.x=Math.PI/2;
    const chunks=[]; for(let i=0;i<6;i++) chunks.push(add(new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5),_bossGlow(col,0.7))));
    ud.spinners=[{m:ring,sz:-0.3}]; ud.orbit={items:chunks,rad:2.5,speed:0.4,y:0};
  } else if(special==='tempest'){
    // Small, fast electric shard: spiky tetra core, fast crackling rings and
    // orbiting spike bolts.
    ud.scale=0.82; ud.y=1.05;
    ud.core=add(new THREE.Mesh(new THREE.TetrahedronGeometry(1.05,0),_bossStd(col,emi,0.4)));
    const r1=add(new THREE.Mesh(new THREE.TorusGeometry(1.6,0.06,6,24),_bossGlow(emi,0.85))); r1.rotation.x=Math.PI/2.2;
    const r2=add(new THREE.Mesh(new THREE.TorusGeometry(1.9,0.05,6,24),_bossGlow(col,0.7))); r2.rotation.z=Math.PI/2.4;
    const spikes=[]; for(let i=0;i<4;i++) spikes.push(add(new THREE.Mesh(new THREE.ConeGeometry(0.18,1.1,4),_bossGlow(emi,0.9))));
    add(new THREE.Mesh(new THREE.SphereGeometry(1.3,12,10),_bossGlow(col,0.12)));
    ud.spinners=[{m:r1,sz:2.0,sx:0.5},{m:r2,sy:-1.6}]; ud.orbit={items:spikes,rad:1.5,speed:2.2,y:0};
  } else if(special==='blight'){
    // Bulbous spore-sac: lumpy core, sickly halo, orbiting spore pods.
    ud.scale=1.08; ud.y=0.95;
    ud.core=add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.3,1),_bossStd(col,emi,0.6)));
    const pods=[]; for(let i=0;i<5;i++) pods.push(add(new THREE.Mesh(new THREE.SphereGeometry(0.5,8,7),_bossStd(emi,col,0.7))));
    const halo=add(new THREE.Mesh(new THREE.TorusGeometry(1.9,0.09,6,28),_bossGlow(col,0.6))); halo.rotation.x=Math.PI/2.2;
    add(new THREE.Mesh(new THREE.SphereGeometry(1.55,12,10),_bossGlow(emi,0.14)));
    ud.spinners=[{m:halo,sz:0.5,sx:0.2}]; ud.orbit={items:pods,rad:1.7,speed:0.8,y:0};
  } else { // herald
    ud.scale=1.05; ud.y=0.8;
    ud.core=add(new THREE.Mesh(new THREE.CylinderGeometry(0.7,1.05,2.7,6),_bossStd(col,emi,0.7)));
    const halo=add(new THREE.Mesh(new THREE.TorusGeometry(1.6,0.1,6,32),_bossGlow(col,0.7))); halo.rotation.x=Math.PI/2; halo.position.y=1.3;
    const runes=[]; for(let i=0;i<5;i++) runes.push(add(new THREE.Mesh(new THREE.BoxGeometry(0.3,0.55,0.1),_bossGlow(emi,0.85))));
    ud.spinners=[{m:halo,sz:0.4}]; ud.orbit={items:runes,rad:1.7,speed:0.9,y:0.4};
  }
  container.scale.setScalar(ud.scale||1);
}
function animateBossModel(e,p,dt,now){
  const c=p.bossModel, ud=c.userData;
  const windUp = (e.specialCd!=null && e.specialCd<0.6) ? (0.6-Math.max(0,e.specialCd))/0.6 : 0;
  c.position.y=(ud.y||1.0)+Math.sin(now*0.003)*0.12;
  if(ud.core){
    ud.core.scale.setScalar(1+0.06*Math.sin(now*0.006)+windUp*0.4);
    ud.core.rotation.y+=dt*0.6;
    if(ud.core.material&&ud.core.material.emissiveIntensity!=null) ud.core.material.emissiveIntensity=0.7+windUp*1.6;
  }
  for(const sp of (ud.spinners||[])){ sp.m.rotation.x+=dt*(sp.sx||0); sp.m.rotation.y+=dt*(sp.sy||0); sp.m.rotation.z+=dt*((sp.sz||0)*(1+windUp*2)); }
  if(ud.orbit){ ud.orbit.t=(ud.orbit.t||0)+dt*ud.orbit.speed; const it=ud.orbit.items,n=it.length; for(let i=0;i<n;i++){ const a=ud.orbit.t+i/n*Math.PI*2; it[i].position.set(Math.cos(a)*ud.orbit.rad,ud.orbit.y||0,Math.sin(a)*ud.orbit.rad); } }
}

const ENEMY_RIG_KEYS = ['body','head','eyeL','eyeR','armL','armR','clawL','clawR','legL','legR','footL','footR','podL','podR','visor','weapon','fin','ring','core'];
function cacheEnemyRigPose(p){
  for(const key of ENEMY_RIG_KEYS){
    const part=p[key]; if(!part) continue;
    part.userData.basePos = part.userData.basePos || new THREE.Vector3();
    part.userData.baseRot = part.userData.baseRot || new THREE.Euler();
    part.userData.baseScale = part.userData.baseScale || new THREE.Vector3();
    part.userData.basePos.copy(part.position);
    part.userData.baseRot.copy(part.rotation);
    part.userData.baseScale.copy(part.scale);
  }
}
function resetEnemyRigPart(part){
  if(!part||!part.userData.basePos) return;
  part.position.copy(part.userData.basePos);
  part.rotation.copy(part.userData.baseRot);
  part.scale.copy(part.userData.baseScale);
}
function triggerEnemyAttack(e,dur=0.24,sync=true){
  if(!e) return;
  e.attackT=Math.max(e.attackT||0,dur);
  e.attackDur=dur;
  e.grassRevealT=Math.max(e.grassRevealT||0,0.9);
  if(sync) e.attackSeq=(e.attackSeq||0)+1;
}
function animateEnemyRig(e,dt,now,moveAmt=0){
  if(!e||!e.mesh||!e.mesh.visible) return;
  const p=e.mesh.userData;
  // Bosses use a bespoke compound model with its own animation.
  if(e.type==='boss'&&p.bossModel&&p.bossModel.visible){
    animateBossModel(e,p,dt,now);
    if(p.threatHalo&&p.threatHalo.visible){ p.threatHalo.rotation.z+=dt*0.6; p.threatHalo.scale.setScalar(1.95); }
    return;
  }
  for(const key of ENEMY_RIG_KEYS) resetEnemyRigPart(p[key]);

  const idx=e.poolIdx||0;
  const isHeavy=e.type==='tank'||e.type==='boss'||e.type==='rammer';
  const isFast=e.type==='speeder'||e.type==='dasher';
  const moveSpeed=dt>0?moveAmt/dt:0;
  const walk=Math.min(1,moveSpeed/Math.max(0.35,(e.spd||1.1)*(isFast?0.45:0.7)));
  const phase=now*(isFast?0.018:isHeavy?0.008:0.012)+idx*0.77;
  const stride=Math.sin(phase)*walk;
  const liftL=Math.max(0,Math.sin(phase))*(isHeavy?0.045:0.075)*walk;
  const liftR=Math.max(0,-Math.sin(phase))*(isHeavy?0.045:0.075)*walk;
  const swing=(isHeavy?0.20:0.34)*stride;

  if(p.body.visible!==false){
    p.body.position.y+=Math.abs(Math.sin(phase))*(isHeavy?0.018:0.03)*walk;
    p.body.rotation.z+=Math.sin(phase*0.5+idx)*(isHeavy?0.018:0.035)*walk;
  }
  if(p.head.visible){
    p.head.position.y+=Math.sin(phase+0.8)*0.018*walk;
    p.head.rotation.y+=Math.sin(phase*0.55)*0.08*walk;
  }
  if(p.legL.visible){
    p.legL.rotation.x+=swing;
    p.legR.rotation.x-=swing;
    p.footL.rotation.x-=swing*0.48;
    p.footR.rotation.x+=swing*0.48;
    p.footL.position.y+=liftL;
    p.footR.position.y+=liftR;
    p.footL.position.z+=Math.max(0,stride)*0.06*walk;
    p.footR.position.z+=Math.max(0,-stride)*0.06*walk;
  }

  const dur=Math.max(0.01,e.attackDur||0.24);
  const atkPhase=Math.max(0,Math.min(1,1-Math.max(0,e.attackT)/dur));
  const atk=e.attackT>0?Math.sin(atkPhase*Math.PI):0;
  if(e.attackT>0) e.attackT=Math.max(0,e.attackT-dt);

  if(p.armL.visible){
    p.armL.rotation.x-=swing*0.45;
    p.armR.rotation.x+=swing*0.45;
    p.armL.rotation.z+=(e.type==='boss'?0.18:0.28)*atk;
    p.armR.rotation.z-=(e.type==='boss'?0.18:0.28)*atk;
  }
  if(p.clawL.visible){
    p.clawL.position.z+=0.16*atk;
    p.clawR.position.z+=0.16*atk;
    p.clawL.rotation.z+=0.5*atk;
    p.clawR.rotation.z-=0.5*atk;
  }
  if(p.weapon.visible){
    p.weapon.position.z+=0.22*atk;
    p.weapon.scale.z=(p.weapon.userData.baseScale?.z||1)*(1+0.35*atk);
  }
  if(p.podL.visible){
    const podPulse=1+0.05*Math.sin(now*0.006+idx);
    p.podL.scale.multiplyScalar(podPulse);
    p.podR.scale.multiplyScalar(podPulse);
    p.podL.position.y+=Math.sin(phase+1.6)*0.014;
    p.podR.position.y+=Math.sin(phase+2.2)*0.014;
  }
  if(p.visor.visible){
    const blink=1+0.10*Math.sin(now*0.01+idx)+0.16*atk;
    p.visor.scale.x=(p.visor.userData.baseScale?.x||1)*blink;
    p.visor.scale.y=(p.visor.userData.baseScale?.y||1)*(1+0.08*atk);
  }
  if(p.eyeL.visible){
    const eyePulse=1+0.12*Math.sin(now*0.011+idx)+0.20*atk;
    p.eyeL.scale.multiplyScalar(eyePulse);
    p.eyeR.scale.multiplyScalar(eyePulse);
  }
  if(p.ring.visible){
    p.ring.userData.spin=(p.ring.userData.spin||0)+dt*(e.type==='boss'?0.9:1.8);
    p.ring.rotation.z+=p.ring.userData.spin;
  }
  if(p.core.visible){
    p.core.userData.spinX=(p.core.userData.spinX||0)+dt*1.7;
    p.core.userData.spinY=(p.core.userData.spinY||0)+dt*2.4;
    p.core.rotation.x+=p.core.userData.spinX;
    p.core.rotation.y+=p.core.userData.spinY;
  }
  if(p.fin.visible) p.fin.rotation.z+=Math.sin(now*0.01+idx)*0.12+atk*0.18;
  if(p.threatHalo?.visible){
    const charge = e.type==='sniper' ? Math.max(0,1-(e.chargeT||0)/0.65)
      : e.type==='dasher' ? ((e.dashCharge||0)>0 ? 0.9 : (e.dashActive||0)>0 ? 1 : 0)
      : e.type==='disruptor' ? ((e.chargeT||0)>0 ? 0.75 : 0)
      : e.type==='bomber' ? Math.max(0,1-Math.min(4,(e._lastDist||4))/4)
      : e.type==='boss' ? 0.35 + (e.phase||1)*0.12
      : 0;
    const signal=Math.max(charge,atk*0.7);
    const baseScale=e.type==='boss'?1.95:1.0;
    const pulse=1+0.06*Math.sin(now*0.008+idx)+signal*0.20;
    p.threatHalo.scale.setScalar(baseScale*pulse);
    p.threatHalo.material.opacity=(e.type==='boss'?0.22:0.18)+signal*0.24;
    p.threatHalo.rotation.z+=dt*(e.type==='boss'?0.6:1.25);
  }
  if(p.glyph?.visible){
    const baseY=(e.type==='tank'||e.type==='shieldBearer')?1.4:1.15;
    p.glyph.position.y=baseY+Math.sin(now*0.004+idx)*0.05;
    p.glyph.quaternion.copy(camera.quaternion); // billboard to camera
  }
  if(p.aura?.visible){
    const ap=1+0.12*Math.sin(now*0.006+idx);
    p.aura.scale.setScalar((e.cfg.r||0.5)*2.6*ap);
  }
  if(p.eliteShell?.visible){
    p.eliteShell.material.opacity=0.16+0.12*Math.sin(now*0.006+idx);
  }
  if(p.eliteSpikes?.visible){
    p.eliteSpikes.rotation.y+=dt*0.9;
    p.eliteSpikes.position.y=Math.sin(now*0.005+idx)*0.04;
  }
  if(p.hpbar?.visible){
    p.hpbar.quaternion.copy(camera.quaternion);
    const f=Math.max(0,Math.min(1,e.hp/(e.maxHp||1)));
    p.hpfill.scale.x=Math.max(0.001,f);
    p.hpfill.position.x=-(1-f)*0.67;
  }
}

for(let i = 0; i < MAX_ENEMIES; i++){
  enemyPoolMeshes.push(createEnemyModelSlot());
}

// Active enemy list — plain objects, no class overhead
const enemies = [];

function acquireEnemySlot(type, x, z){
  for(let i = 0; i < MAX_ENEMIES; i++){
    if(enemyPoolMeshes[i].visible) continue;
    const cfg  = ETYPES[type];
    const mesh = enemyPoolMeshes[i];
    configureEnemyModel(mesh,type,cfg);
    mesh.material.color.setHex(cfg.col);
    mesh.material.emissive.setHex(cfg.emi);
    mesh.material.emissiveIntensity = 0.6;
    mesh.material.transparent=false; mesh.material.opacity=1;
    mesh.material.depthWrite=true;
    mesh.userData.accentMat.color.setHex(cfg.emi);
    mesh.userData.accentMat.emissive.setHex(cfg.emi);
    mesh.userData.accentMat.emissiveIntensity = 0.45;
    mesh.userData.accentMat.transparent=false; mesh.userData.accentMat.opacity=1;
    mesh.userData.accentMat.depthWrite=true;
    mesh.userData.eyeMat.transparent=false; mesh.userData.eyeMat.opacity=1; mesh.userData.eyeMat.depthWrite=true;
    mesh.position.set(x, 0.55, z);
    mesh.visible = true;
    mesh.scale.setScalar(0.001);
    // Role-coloured spawn ring so a new enemy reads before it reaches you.
    if(gfxTier!=='potato' && type!=='boss') spawnShockwave(x, z, 1.7, cfg.emi||cfg.col, 0.4, 0.7);
    return { poolIdx:i, mesh };
  }
  return null;
}

function releaseEnemySlot(e){
  if(linkerBeams)linkerBeams.visible=false;
  slowMap.delete(e.poolIdx); phaseVulnMap.delete(e.poolIdx); poisonMap.delete(e.poolIdx);
  elementTagMap.delete(e.poolIdx); _releaseTagIndicatorFor(e.poolIdx);
  e.mesh.visible = false;
  // Hide boss model + champion extras so the pooled slot is clean when a normal
  // enemy reuses it (configure/applyEnemyVisual re-enable as needed).
  const ud=e.mesh&&e.mesh.userData;
  if(ud){
    if(ud.bossModel) ud.bossModel.visible=false;
    if(ud.aura) ud.aura.visible=false;
    if(ud.hpbar) ud.hpbar.visible=false;
    if(ud.eliteShell) ud.eliteShell.visible=false;
    if(ud.eliteSpikes) ud.eliteSpikes.visible=false;
  }
  if(e.mesh) e.mesh.scale.setScalar(1);
}

// Adaptive enemy difficulty multipliers
function runSkillPower(){
  return Object.values(playerSkills).reduce((sum,lvl)=>sum+(lvl||0),0);
}
function lateWavePressure(w){
  return Math.max(0,w-8);
}
// Per-player-count balance: bumped HP up ~10% across the board and reduced spawn
// count ~12–16% to keep total enemy HP roughly the same (fewer-but-tougher enemies).
// Late waves around 11+ were hitting frame-rate cliffs from sheer mob count; this
// rebalance trades quantity for quality. Entries 5 and 6 extend the table for the
// new 6-player lobby cap.
const PLAYER_COUNT_BALANCE = [
  null,
  {hp:0.88, count:0.70, dmg:0.86, elite:0.62, revive:1.00, bleed:1.00, bossShots:0.84},
  {hp:1.40, count:1.00, dmg:1.00, elite:1.05, revive:1.00, bleed:1.00, bossShots:1.00},
  {hp:1.80, count:1.18, dmg:1.06, elite:1.24, revive:1.18, bleed:0.96, bossShots:1.10},
  {hp:2.22, count:1.36, dmg:1.12, elite:1.42, revive:1.32, bleed:0.92, bossShots:1.22},
  {hp:2.66, count:1.52, dmg:1.16, elite:1.58, revive:1.45, bleed:0.88, bossShots:1.32},
  {hp:3.10, count:1.66, dmg:1.20, elite:1.72, revive:1.55, bleed:0.84, bossShots:1.42},
];
function activePlayerCount(){
  if(mp.soloMode) return 1;
  return Math.max(1,Math.min(MAX_PLAYERS,mpPlayerIds().length||1));
}
function playerBalance(){
  return PLAYER_COUNT_BALANCE[activePlayerCount()]||PLAYER_COUNT_BALANCE[1];
}
function soloEarlyMercy(w){
  if(activePlayerCount()!==1) return 1;
  return w<=1?0.88:w===2?0.93:w===3?0.97:1;
}
// Step multiplier applied to enemy HP and damage. Player power grows in
// discrete jumps at each wave-clear skill pick (especially the bigger
// boss-wave reward), so enemies get a matching discrete bump tied to the
// boss cadence rather than scaling linearly with the wave number.
//   waves 1-4   → 1.0   (no boost yet)
//   waves 5-9   → 1.2   (first boss already fell, players have ~5 picks)
//   waves 10-14 → 1.3
//   waves 15-19 → 1.4
//   waves 20-24 → 1.5
//   …
// This is multiplied with the existing linear scale (which is now softer —
// the step is the main difficulty driver across boss tiers).
function postBossTierMult(w){
  if(w<5) return 1.0;
  return 1.1 + Math.floor(w/5)*0.1;
}
// ── Difficulty (easy/normal/hard/expert/hell). "hard" is the historical
// baseline (all 1.0). The multipliers fold into the scale functions below
// (hp/dmg/spd/count) and the fire-rate / bullet-count sites. `cd` is an
// attack-cooldown multiplier (>1 fires slower, <1 faster); `bullets` only
// ever raises burst counts so easy/normal aren't trivialised. Solo remembers
// the pick via localStorage; in MP the host's choice rides on GAME_START.
const DIFFICULTY = {
  easy:   { hp:0.65, dmg:0.55, spd:0.80, cd:1.50, count:0.80, bullets:1.00, label:'EASY' },
  normal: { hp:0.82, dmg:0.78, spd:0.90, cd:1.20, count:0.90, bullets:1.00, label:'NORMAL' },
  hard:   { hp:1.00, dmg:1.00, spd:1.00, cd:1.00, count:1.00, bullets:1.00, label:'HARD' },
  expert: { hp:1.12, dmg:1.30, spd:1.20, cd:0.82, count:1.15, bullets:1.30, label:'EXPERT' },
  hell:   { hp:1.35, dmg:1.75, spd:2.00, cd:0.62, count:1.35, bullets:1.65, label:'HELL' },
};
let nbDifficulty = 'hard';
try { const _d=localStorage.getItem('nbDifficulty'); if(DIFFICULTY[_d]) nbDifficulty=_d; } catch(_){}
function diffCfg(){ return DIFFICULTY[nbDifficulty] || DIFFICULTY.hard; }
function setNbDifficulty(d){ if(DIFFICULTY[d]){ nbDifficulty=d; try{ localStorage.setItem('nbDifficulty',d); }catch(_){} } }
// Display metadata for the 5 difficulties (order, accent, blurb). Defined here
// so both the lobby UI (early) and the solo picker can read it. The balance
// numbers themselves live in the DIFFICULTY table above.
const NB_DIFF_META = [
  { key:'easy',   emoji:'🌱', col:'#5cff9d', desc:'Relaxed — fewer, weaker, slower foes.' },
  { key:'normal', emoji:'🙂', col:'#66ddff', desc:'A gentler ramp for a calmer run.' },
  { key:'hard',   emoji:'⚔️', col:'#ffd34d', desc:'The classic NeonBrawl balance.' },
  { key:'expert', emoji:'🔥', col:'#ff8a3d', desc:'Tougher, faster — denser enemy fire.' },
  { key:'hell',   emoji:'💀', col:'#ff4466', desc:'Brutal — ~2x speed, relentless fire.' },
];
function nbDiffColor(key){ const m=NB_DIFF_META.find(x=>x.key===key); return m?m.col:'#fff'; }
function diffScale(w){
  const p=runSkillPower();
  const powerPressure=Math.max(0,w-7)*Math.min(p,45)*0.0045;
  // Linear coefficient softened from 0.17 → 0.09 so the post-boss step is
  // the headline difficulty bump and the linear ramp is the gentle filler
  // between bosses. Net wave-30 HP is roughly the same as the old curve.
  return (1+(w-1)*0.09+lateWavePressure(w)*0.055+powerPressure)*postBossTierMult(w)*playerBalance().hp*soloEarlyMercy(w)*1.025*diffCfg().hp;
}
function spdScale(w){
  const p=runSkillPower();
  const powerPressure=Math.max(0,w-8)*Math.min(p,35)*0.0009;
  // Speed isn't part of the boss-tier step — too many fast enemies makes
  // late waves feel chaotic instead of hard. Linear scale unchanged.
  // Difficulty mult is applied AFTER the 1.68 wave cap so hell's ~×2 lands.
  return Math.min((1+(w-1)*0.028+powerPressure)*1.01,1.68)*diffCfg().spd;
}
function dmgScale(w){
  const p=runSkillPower();
  const powerPressure=Math.max(0,w-8)*Math.min(p,40)*0.0018;
  // Damage: linear softened 0.048 → 0.026, step applied. Cap raised so the
  // step still has room to push damage up in long runs (wave 50+).
  // Difficulty mult applied AFTER the 6.50 cap so hell genuinely lands ~×1.75.
  return Math.min((1+(w-1)*0.026+lateWavePressure(w)*0.014+powerPressure)*postBossTierMult(w)*playerBalance().dmg*(activePlayerCount()===1&&w<=3?0.94:1)*1.025,6.50)*diffCfg().dmg;
}
function scaledEnemyCount(type,n,w){
  const bal=playerBalance();
  const pressureTypes=(type==='shooter'||type==='sniper'||type==='dasher')?1.08:1;
  const raw=n*bal.count*(activePlayerCount()>=3?pressureTypes:1)*diffCfg().count;
  if(activePlayerCount()===1) return Math.max(1,Math.floor(raw));
  return Math.max(1,Math.round(raw));
}
function effectiveReviveTime(){
  return REVIVE_TIME*playerBalance().revive;
}
function effectiveBleedTime(){
  return DOWNED_BLEED_TIME*playerBalance().bleed;
}
function bossProjectileMult(){
  return playerBalance().bossShots;
}

// Unified elite system. An enemy is normal, ELITE, or the rarer CHAMPION
// mini-boss. There are NO per-tier colours — elites keep their archetype's own
// body colour and are marked by a rim-outline + spike crown (see applyEnemyVisual).
// Every type also gains a signature elite ability (see the elite-special block
// in the AI). `control` = stagger/knockback resistance (lower = more resistant);
// `size` = persistent mesh scale-up.
const ENEMY_TIERS = {
  elite:    {name:'ELITE',    hp:1.9, spd:1.12, dmg:1.35, pts:2.2, control:0.62, size:1.22},
  champion: {name:'CHAMPION', hp:5.0, spd:1.0,  dmg:1.9,  pts:6.0, control:0.40, size:1.55, col:0xff66ff, emi:0xff00dd},
};

function chooseEnemyTier(type,w){
  if(type==='boss'||type==='splitterling'||w<4) return null;
  const p=runSkillPower();
  // Champion mini-boss: rare, late-game only, and HARD-CAPPED to how many can be
  // alive at once. Big lobbies were getting several 5k-HP champions per wave
  // (the "deal a million damage to clear it" problem) because the chance was
  // multiplied by the party-size elite factor AND rolled on every spawn. Now the
  // per-spawn chance is flat and party size only raises the cap (1, or 2 at 3+).
  if(w>=10){
    const champCap=activePlayerCount()>=3?2:1;
    const liveChamps=enemies.reduce((n,e)=>n+((e&&!e.dead&&e.elite==='champion')?1:0),0);
    if(liveChamps<champCap && Math.random()<Math.min(0.045+(w-10)*0.005,0.12)) return 'champion';
  }
  const powerPressure=Math.max(0,w-7)*Math.min(p,45)*0.0016;
  const chance=Math.min((0.08+(w-4)*0.018+powerPressure)*playerBalance().elite,0.62);
  return Math.random()<chance ? 'elite' : null;
}

function applyEnemyVisual(e){
  const tier=e.elite&&ENEMY_TIERS[e.elite];
  const isChamp = e.elite==='champion';
  const profile=e.bossProfile;
  // Elites keep their archetype's OWN colour (the rim+spike marker is the tell,
  // not colour) — only champion/boss recolour the body.
  const bodyCol=profile?profile.col:(isChamp?tier.col:e.cfg.col);
  const glowCol=profile?profile.emi:(isChamp?tier.emi:e.cfg.emi);
  e.mesh.material.color.setHex(bodyCol);
  e.mesh.material.emissive.setHex(glowCol);
  e.mesh.userData.accentMat.color.setHex(glowCol);
  e.mesh.userData.accentMat.emissive.setHex(glowCol);
  e.mesh.userData.eyeMat.color.setHex(e.type==='boss'?0xfff6cc:isChamp?tier.emi:0xbafcff);
  if(e.mesh.userData.threatHalo){
    e.mesh.userData.threatHalo.visible = e.mesh.userData.threatHalo.visible || e.type==='boss';
    e.mesh.userData.threatHalo.material.color.setHex(glowCol);
  }
  // Persistent size-up for elites/champions.
  e.sizeMult = (tier && tier.size) ? tier.size : 1;
  const ud=e.mesh.userData;
  const isElite = !!tier && e.type!=='boss';
  // Colour-independent elite marker: a pulsing rim-outline shell + spike crown.
  // White on elites (so it reads on any body colour); tinted on champions.
  if(ud.eliteShell){
    ud.eliteShell.visible=isElite && GFX_ENEMY_RIG_DETAIL>=1;
    if(isElite) ud.eliteShell.material.color.setHex(isChamp?glowCol:0xffffff);
  }
  if(ud.eliteSpikes){
    ud.eliteSpikes.visible = isElite && GFX_ENEMY_RIG_DETAIL>=2;
    ud.eliteSpikes.children.forEach(c=>c.material.color.setHex(isChamp?glowCol:0xffffff));
  }
  if(ud.aura){
    ud.aura.visible=isChamp && GFX_ENEMY_RIG_DETAIL>=1;
    if(isChamp){ ud.aura.material.color.setHex(glowCol); ud.aura.scale.setScalar((e.cfg.r||0.5)*2.6); }
  }
  if(ud.hpbar){
    ud.hpbar.visible=isChamp && GFX_ENEMY_RIG_DETAIL>=1;
    if(isChamp) ud.hpfill.material.color.setHex(glowCol);
  }
  // Boss: swap to a distinct compound model and hide the generic rig.
  if(ud.bossModel){
    if(e.type==='boss'){
      const sp=(profile&&profile.special)||'warden';
      if(ud.bossModelKey!==sp){ buildBossModel(ud.bossModel,sp,bodyCol,glowCol); ud.bossModelKey=sp; }
      ud.bossModel.visible=true;
      [ud.body,ud.head,ud.eyeL,ud.eyeR,ud.armL,ud.armR,ud.clawL,ud.clawR,ud.legL,ud.legR,ud.footL,ud.footR,ud.podL,ud.podR,ud.visor,ud.weapon,ud.fin,ud.ring,ud.core].forEach(pt=>{ if(pt) pt.visible=false; });
    } else {
      ud.bossModel.visible=false;
    }
  }
}
function cssHex(c){
  return '#'+(c>>>0).toString(16).padStart(6,'0');
}
function enemyAlert(e,txt,col){
  if(!e||!e.pos) return;
  dmgNum(txt,{x:e.pos.x,y:1.2,z:e.pos.z},cssHex(col),'threat');
}
function bossSpecialLabel(special){
  if(special==='warden') return 'METEOR';
  if(special==='phantom') return 'BLINK';
  if(special==='apex') return 'CHARGE';
  if(special==='nexus') return 'BARRAGE';
  if(special==='herald') return 'SUMMON';
  if(special==='goliath') return 'QUAKE';
  if(special==='tempest') return 'STORM';
  if(special==='blight') return 'BLOOM';
  return 'BOSS';
}

let currentBossTargetPoolIdx = null;

function updateBossBarFromEnemy(boss){
  const bar=document.getElementById('bossBar');
  if(!bar) return;
  if(!boss||boss.dead||boss.hp<=0){
    bar.style.display='none';
    return;
  }
  const profile=boss.bossProfile||BOSS_PROFILES[boss.bossName]||BOSS_PROFILES.WARDEN;
  const hpPct=Math.max(0,Math.min(1,boss.hp/(boss.maxHp||1)));
  const nameEl=document.getElementById('bossName');
  const fill=document.getElementById('bossFill');
  if(nameEl){
    const liveBosses=enemies.filter(e=>e.type==='boss'&&!e.dead&&e.hp>0).length;
    const phase=boss.phase>1?` P${boss.phase}`:'';
    nameEl.textContent=`${boss.bossName||'BOSS'}${phase}${liveBosses>1?` (${liveBosses})`:''}`;
    nameEl.style.color=cssHex(profile.col);
  }
  if(fill){
    fill.style.width=(hpPct*100)+'%';
    fill.style.background=`linear-gradient(90deg,${cssHex(profile.col)},#ffffff)`;
  }
  bar.style.display='block';
}

function updateBossBarFromEnemies(){
  let boss=null;
  if(currentBossTargetPoolIdx!==null){
    boss=enemies.find(e=>e.type==='boss'&&!e.dead&&e.hp>0&&e.poolIdx===currentBossTargetPoolIdx);
    if(!boss) currentBossTargetPoolIdx=null;
  }
  if(!boss){
    boss=enemies.find(e=>e.type==='boss'&&!e.dead&&e.hp>0);
    if(boss&&currentBossTargetPoolIdx===null) currentBossTargetPoolIdx=boss.poolIdx;
  }
  updateBossBarFromEnemy(boss);
}

function enemyControlFactor(e){
  if(e.type==='boss') return 0.45;
  const tier=e.elite&&ENEMY_TIERS[e.elite];
  return tier?tier.control:1;
}
function addEnemyStagger(e,t){
  e.stagger=Math.max(e.stagger||0,t*enemyControlFactor(e));
}
function applyEnemySlow(e,t){
  if(!e||e.dead) return;
  const dur=t*enemyControlFactor(e);
  slowMap.set(e.poolIdx,Math.max(slowMap.get(e.poolIdx)||0,dur));
}
// Element tagging. Any damage source that has an element should call this
// before/after writing damage. If the enemy already has a different element
// tagged within the window, a reaction triggers and the tag is cleared.
// srcDmg is the triggering hit's damage — reactions scale from it.
function tagElement(e, elem, srcDmg){
  if(!e || e.dead || !elem) return;
  if(typeof elementTagMap==='undefined') return;
  const prev=elementTagMap.get(e.poolIdx);
  if(prev && prev.elem && prev.elem!==elem && prev.t>0){
    runElementReaction(e, prev.elem, elem, Math.max(prev.srcDmg||0,srcDmg||0));
    elementTagMap.delete(e.poolIdx);
    // Drop the visual indicator when the tag is consumed by a reaction.
    if(typeof _releaseTagIndicatorFor==='function') _releaseTagIndicatorFor(e.poolIdx);
    return;
  }
  // Lingering Marks — extends the tag window so you have longer to land the
  // second element. eff 3 = +50% (4.5s), eff 5 = +120% (6.6s).
  const lmLvl = playerSkills.lingeringMarks||0;
  const lmMul = [1,1,1,1.5,1.5,2.2][lmLvl] || 1;
  const wasFresh = !prev;
  elementTagMap.set(e.poolIdx, {elem, t:ELEM_TAG_DUR*lmMul, srcDmg:srcDmg||0});
  if(typeof _acquireTagIndicatorFor==='function') _acquireTagIndicatorFor(e, elem);
  // Small element-coloured puff only on a *fresh* tag (skips re-tags with
  // the same element so Imbue Rounds doesn't spam particles).
  if(wasFresh && typeof burst==='function' && ELEM_COLORS[elem]){
    burst({x:e.pos.x, z:e.pos.z}, ELEM_COLORS[elem].hex, isMobile?2:4);
  }
}
function tickElementTags(dt){
  if(typeof elementTagMap==='undefined') return;
  for(const [k,v] of elementTagMap){
    v.t-=dt;
    if(v.t<=0){
      elementTagMap.delete(k);
      if(typeof _releaseTagIndicatorFor==='function') _releaseTagIndicatorFor(k);
    }
  }
  // Keep ring position synced to the tagged enemy each frame, and update
  // opacity/scale so the indicator visually breathes out as the tag decays.
  if(typeof _tagIndicators!=='undefined' && _tagIndicators.length){
    const now=Date.now()*0.004;
    for(const ind of _tagIndicators){
      if(!ind.visible) continue;
      const tag=elementTagMap.get(ind._poolIdx);
      const en=enemies.find(e=>e.poolIdx===ind._poolIdx && !e.dead);
      if(!tag || !en){
        ind.visible=false; ind._poolIdx=-1; continue;
      }
      ind.position.set(en.pos.x, 0.06, en.pos.z);
      const lifeFrac=Math.max(0.15, Math.min(1, tag.t/ELEM_TAG_DUR));
      ind.scale.setScalar(0.95 + 0.18*Math.sin(now*4 + ind._poolIdx));
      if(ind.material) ind.material.opacity = 0.35 + 0.45*lifeFrac;
    }
  }
}
// ── Element-tag visual indicator pool ─────────────────────
// A small additive ring under every currently-tagged enemy, coloured by
// the tag's element. Pooled so we don't allocate per tag.
const _TAG_INDICATOR_CAP = 32;
const _tagIndicators = [];
let _tagIndicatorGeo = null;
function _ensureTagIndicatorGeo(){
  if(_tagIndicatorGeo) return _tagIndicatorGeo;
  if(typeof THREE==='undefined') return null;
  _tagIndicatorGeo = new THREE.RingGeometry(0.48, 0.62, 18);
  return _tagIndicatorGeo;
}
function _acquireTagIndicatorFor(enemy, elem){
  if(!enemy || !enemy.pos || typeof THREE==='undefined' || !scene) return;
  _ensureTagIndicatorGeo();
  // Reuse if this enemy already has one
  for(const ind of _tagIndicators){
    if(ind.visible && ind._poolIdx===enemy.poolIdx){
      const c=ELEM_COLORS[elem]?.hex || 0xffffff;
      if(ind.material) ind.material.color.setHex(c);
      return;
    }
  }
  // Find a free one
  let mesh=_tagIndicators.find(i=>!i.visible);
  if(!mesh && _tagIndicators.length<_TAG_INDICATOR_CAP){
    const mat=new THREE.MeshBasicMaterial({
      color:0xffffff,transparent:true,opacity:0.75,
      side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,
    });
    mesh=new THREE.Mesh(_tagIndicatorGeo,mat);
    mesh.rotation.x=-Math.PI/2;
    scene.add(mesh);
    _tagIndicators.push(mesh);
  }
  if(!mesh) return; // pool exhausted; tag still works, just no visual
  const c=ELEM_COLORS[elem]?.hex || 0xffffff;
  if(mesh.material) mesh.material.color.setHex(c);
  mesh._poolIdx=enemy.poolIdx;
  mesh.position.set(enemy.pos.x,0.06,enemy.pos.z);
  mesh.visible=true;
}
function _releaseTagIndicatorFor(poolIdx){
  if(typeof _tagIndicators==='undefined') return;
  for(const ind of _tagIndicators){
    if(ind._poolIdx===poolIdx){ ind.visible=false; ind._poolIdx=-1; }
  }
}
function _reactionPair(a,b){
  // Normalised pair string so order doesn't matter.
  const arr=[a,b].sort();
  return arr[0]+'+'+arr[1];
}
function runElementReaction(e, prevElem, newElem, srcDmg){
  const pair=_reactionPair(prevElem,newElem);
  // Elemental Mastery — scales every reaction damage / status payload.
  const emLvl = playerSkills.elementalMastery||0;
  const emMul = [1, 1.25, 1.45, 1.45, 1.75, 2.10][emLvl] || 1;
  // Imbue Rounds at lv1 reduces reaction damage when fired by bullets so
  // a rapid-fire spray doesn't snowball. The triggering source patched the
  // bullet damage with a multiplier in _imbuedReactionDmg before calling
  // tagElement — if present, blend it in.
  const imbueMul = (typeof _imbuedReactionDmg==='number' && _imbuedReactionDmg>0) ? _imbuedReactionDmg : 1;
  _imbuedReactionDmg=1; // single-shot consumption
  const baseDmg=Math.max(srcDmg||10, playerStats.attackDmg*0.4)*emMul*imbueMul;
  if(pair==='fire+ice'){
    // VAPOR — burst damage on the target + brief slow. Reads as a "melt".
    const dmg=Math.max(1,Math.round(baseDmg*1.5));
    const idx=enemies.indexOf(e);
    if(idx>=0) damageEnemyIndex(idx,dmg,0xddeeff,0.18,mp.myId,'elemental');
    applyEnemySlow(e,1.2);
    burst(e.pos,0xddffff,isMobile?6:14); burst(e.pos,0xffaa66,isMobile?3:7);
    spawnShockwave(e.pos.x,e.pos.z,1.6,0xddeeff,0.18,0.55);
    dmgNum('VAPOR',_scratchPos.set(e.pos.x,0,e.pos.z),'#ddeeff');
    sElemVapor();
  } else if(pair==='fire+thunder'){
    // PLASMA — chain to up to 3 nearby enemies for 0.9× srcDmg.
    const chainN=3;
    const chainDmg=Math.max(1,Math.round(baseDmg*0.9));
    const idx=enemies.indexOf(e);
    if(idx>=0) damageEnemyIndex(idx,Math.round(chainDmg*0.9),0xffee99,0.10,mp.myId,'elemental');
    burst(e.pos,0xffee44,isMobile?6:14); burst(e.pos,0xff7700,isMobile?3:7);
    flashLight(e.pos,0xffdd44,5.5,5.0,0.13);
    dmgNum('PLASMA',_scratchPos.set(e.pos.x,0,e.pos.z),'#ffee44');
    const candidates=[];
    for(let i=0;i<enemies.length;i++){
      const ne=enemies[i]; if(!ne||ne.dead||ne===e) continue;
      const d=Math.hypot(ne.pos.x-e.pos.x,ne.pos.z-e.pos.z);
      if(d<4.5) candidates.push({enemy:ne,d});
    }
    candidates.sort((a,b)=>a.d-b.d);
    for(let c=0;c<Math.min(chainN,candidates.length);c++){
      const target=candidates[c].enemy;
      const tj=enemies.indexOf(target); if(tj<0||target.dead) continue;
      spawnZapLine(e.pos.x,e.pos.z,target.pos.x,target.pos.z);
      damageEnemyIndex(tj,chainDmg,0xffee44,0.10,mp.myId,'elemental');
    }
    sElemPlasma();
  } else if(pair==='fire+poison'){
    // COMBUST — heavy burst + refresh and amplify the poison DoT.
    const dmg=Math.max(1,Math.round(baseDmg*1.8));
    const idx=enemies.indexOf(e);
    if(idx>=0) damageEnemyIndex(idx,dmg,0xff7711,0.16,mp.myId,'elemental');
    if(!e.dead&&typeof poisonMap!=='undefined'){
      const p=poisonMap.get(e.poolIdx)||{t:0,tick:0,dmg:Math.round(baseDmg*0.18)};
      p.t=Math.max(p.t,4);
      p.dmg=Math.max(p.dmg, Math.round(baseDmg*0.30));
      poisonMap.set(e.poolIdx,p);
    }
    burst(e.pos,0xff5500,isMobile?7:16); burst(e.pos,0x88ff66,isMobile?3:6);
    spawnShockwave(e.pos.x,e.pos.z,1.7,0xff6600,0.22,0.6);
    dmgNum('COMBUST',_scratchPos.set(e.pos.x,0,e.pos.z),'#ff7711');
    sElemCombust();
  } else if(pair==='ice+thunder'){
    // SHATTER — huge burst if currently slowed/frozen; otherwise solid burst.
    const slowed=(slowMap.get(e.poolIdx)||0)>0;
    const dmg=Math.max(1,Math.round(baseDmg*(slowed?2.8:1.8)));
    const idx=enemies.indexOf(e);
    if(idx>=0) damageEnemyIndex(idx,dmg,0xccffff,0.22,mp.myId,'elemental');
    burst(e.pos,0xddeeff,isMobile?8:18); burst(e.pos,0xffff66,isMobile?3:7);
    spawnShockwave(e.pos.x,e.pos.z,1.9,0xddeeff,0.20,0.65);
    flashLight(e.pos,0xffff66,5.5,5.0,0.13);
    dmgNum(slowed?'SHATTER!':'SHATTER',_scratchPos.set(e.pos.x,0,e.pos.z),slowed?'#ffd700':'#ccffff');
    sElemShatter();
  } else if(pair==='ice+poison'){
    // BRITTLE — long slow + amplified DoT.
    applyEnemySlow(e,2.6);
    if(typeof poisonMap!=='undefined'){
      const p=poisonMap.get(e.poolIdx)||{t:0,tick:0,dmg:Math.round(baseDmg*0.22)};
      p.t=Math.max(p.t,5);
      p.dmg=Math.max(p.dmg,Math.round(baseDmg*0.36));
      poisonMap.set(e.poolIdx,p);
    }
    burst(e.pos,0x88ddff,isMobile?6:13); burst(e.pos,0x66ff66,isMobile?3:6);
    spawnShockwave(e.pos.x,e.pos.z,1.5,0x77ddaa,0.18,0.55);
    dmgNum('BRITTLE',_scratchPos.set(e.pos.x,0,e.pos.z),'#88ddee');
    sElemBrittle();
  } else if(pair==='poison+thunder'){
    // CORRODE — spread poison + zap to 3 nearby targets.
    const zapDmg=Math.max(1,Math.round(baseDmg*0.7));
    const idx=enemies.indexOf(e);
    if(idx>=0) damageEnemyIndex(idx,zapDmg,0xaaff66,0.10,mp.myId,'elemental');
    burst(e.pos,0x99ff77,isMobile?6:13); burst(e.pos,0xffff44,isMobile?3:6);
    dmgNum('CORRODE',_scratchPos.set(e.pos.x,0,e.pos.z),'#aaff66');
    const candidates=[];
    for(let i=0;i<enemies.length;i++){
      const ne=enemies[i]; if(!ne||ne.dead||ne===e) continue;
      const d=Math.hypot(ne.pos.x-e.pos.x,ne.pos.z-e.pos.z);
      if(d<3.8) candidates.push({enemy:ne,d});
    }
    candidates.sort((a,b)=>a.d-b.d);
    for(let c=0;c<Math.min(3,candidates.length);c++){
      const tg=candidates[c].enemy;
      const tj=enemies.indexOf(tg); if(tj<0||tg.dead) continue;
      spawnZapLine(e.pos.x,e.pos.z,tg.pos.x,tg.pos.z);
      damageEnemyIndex(tj,Math.round(zapDmg*0.6),0xaaff66,0.08,mp.myId,'elemental');
      if(!tg.dead&&typeof poisonMap!=='undefined'){
        const p=poisonMap.get(tg.poolIdx)||{t:0,tick:0,dmg:Math.round(baseDmg*0.16)};
        p.t=Math.max(p.t,3);
        poisonMap.set(tg.poolIdx,p);
      }
    }
    sElemCorrode();
  }
}
function spawnBossMinions(e,list,rad=4){
  list.forEach((type,i)=>{
    const ang=(i/list.length)*Math.PI*2+Math.random()*0.35;
    spawnEnemy(type,e.pos.x+Math.cos(ang)*rad,e.pos.z+Math.sin(ang)*rad);
  });
}

function spawnEnemy(type, x, z){
  const cfg = ETYPES[type];
  const spawnPos = {x, z};
  projectToNearestOpen(spawnPos, cfg.r, Math.max(4, cfg.r*3));
  if(isBlockedAt(spawnPos.x,spawnPos.z,cfg.r)){
    // Large solid map sections can exceed the local projection search radius.
    let nearest=null,bestDistance=Infinity;
    for(let sx=-ARENA_W+cfg.r;sx<=ARENA_W-cfg.r;sx+=0.5){
      for(let sz=-ARENA_H+cfg.r;sz<=ARENA_H-cfg.r;sz+=0.5){
        const distance=(sx-x)**2+(sz-z)**2;
        if(distance>=bestDistance||isBlockedAt(sx,sz,cfg.r)) continue;
        nearest={x:sx,z:sz};bestDistance=distance;
      }
    }
    if(!nearest) return;
    spawnPos.x=nearest.x;spawnPos.z=nearest.z;
  }
  const slot = acquireEnemySlot(type, spawnPos.x, spawnPos.z);
  if(!slot) return;
  const hs = diffScale(waveNum);
  // Promotion totem — force-elite 50% of spawns. Skips boss type and
  // anything that already rolled elite naturally.
  let elite = chooseEnemyTier(type,waveNum);
  // Promotion totem force-elites half the spawns — always the ELITE tier, never
  // a champion (champions stay rare, rolled only by chooseEnemyTier).
  if(!elite && type!=='boss' && typeof totemForcedElite==='function' && totemForcedElite()) elite='elite';
  // Elite Surge challenge: every non-boss spawn that didn't already roll a tier
  // comes in as an elite for the whole wave.
  if(!elite && type!=='boss' && waveEvent && waveEvent.type==='challenge' && waveEvent.sub==='eliteSurge') elite='elite';
  const tier = elite&&ENEMY_TIERS[elite];
  const hpMult = tier?tier.hp:1;
  const spdMult = tier?tier.spd:1;
  const dmgMult = tier?tier.dmg:1;
  const defendBoost = miniObjective?.type==='defend' && !miniObjective.complete && type!=='boss';
  // Wave Totem multipliers — host-decided, applied here so every spawn gets
  // the same modifier without per-frame checks.
  const totemHp = (typeof totemEnemyHpMult==='function')?totemEnemyHpMult():1;
  const totemSpd= (typeof totemEnemySpdMult==='function')?totemEnemySpdMult():1;
  const totemDmg= (typeof totemEnemyDmgMult==='function')?totemEnemyDmgMult():1;
  let maxHp = Math.max(1, Math.round(cfg.hp*hs*hpMult*(defendBoost?1.85:1)*totemHp));
  // Champions are mini-bosses: enforce a high HP floor so even a light-type
  // champion (chaser/speeder) is clearly tankier than a normal tank, not just
  // a recolour. Scales with wave like everything else.
  if(elite==='champion') maxHp = Math.max(maxHp, Math.round(340*hs*totemHp));
  const enemy = {
    type, elite, eliteName:tier?tier.name:'',
    poolIdx:slot.poolIdx, mesh:slot.mesh, cfg,
    hp: maxHp, maxHp,
    spd: cfg.spd*spdScale(waveNum)*spdMult*(defendBoost?1.12:1)*totemSpd,
    dmgMult: dmgScale(waveNum)*dmgMult*(defendBoost?1.25:1)*totemDmg,
    scoreMult: tier?tier.pts:1,
    pos: new THREE.Vector3(spawnPos.x, 0, spawnPos.z),
    fireCd: 1 + Math.random()*1.5,
    stagger: 0, dead: false,
    avoidX: 0, avoidZ: 0,
    stuckT: 0,
    prevX: spawnPos.x, prevZ: spawnPos.z, stuckCheck: 0,
    detourT: 0, detourX: 0, detourZ: 0,
    hitFlashT: 0, spawnAnim: 0.4,
    attackT: 0, attackDur: 0.24, attackSeq: 0,
    chargeT: 0,
    ram:type==='rammer'?new Rammer():null,
    dashT: 2+Math.random()*2, dashCharge: 0, dashActive: 0, dashDX: 0, dashDZ: 0,
    elitePulseCd: 1.4+Math.random()*1.2,
    eliteCd: 2.6+Math.random()*1.6, // cooldown for the type's signature elite ability
    grassZone: null, grassAlpha: 1, grassRevealT: 0, grassExitRevealT: 0,
  };
  applyEnemyVisual(enemy);
  enemies.push(enemy);
  if(elite&&waveNum>=6){
    // Elites keep their own colour, so the spawn pop uses the enemy's tint;
    // champions use their magenta.
    const popCol = tier.emi || cfg.emi || cfg.col;
    dmgNum(tier.name,_scratchPos.set(spawnPos.x,0,spawnPos.z), '#ffffff');
    impactPulse(spawnPos,popCol,1.7,isMobile?4:8);
    if(elite==='champion'){
      sElite();   // only the rare CHAMPION keeps an audio cue — plain elite spawns are silent now (several per round mid-game made it spammy)
      annText('CHAMPION'+(cfg.role?' · '+cfg.role:''),cssHex(tier.emi));
      impactPulse(spawnPos,tier.emi,3.0,isMobile?6:14);
      spawnShockwave(spawnPos.x,spawnPos.z,3.4,tier.emi,0.5,0.9);
    }
  }
}

let waveEnemyTotal = 0;
let waveSpawned    = false;
let miniObjective = null;

function clearEnemiesForObjective(){
  enemies.forEach(e=>{ e.dead=true; releaseEnemySlot(e); });
  enemies.length=0;
  currentBossTargetPoolIdx=null;
  for(const b of bulletPool) if(b.active&&!b.isPlayer) releaseBullet(b);
  updateBossBarFromEnemy(null);
  updateHUD();
}
function disposeMiniObjective(){
  if(miniObjective?.meshes){
    miniObjective.meshes.forEach(m=>{
      scene.remove(m);
      m.traverse?.(o=>{ o.geometry?.dispose?.(); o.material?.dispose?.(); });
      m.geometry?.dispose?.(); m.material?.dispose?.();
    });
  }
  miniObjective=null;
}
function objectiveTypeForWave(w){
  if(w<=2||w%5===0) return 'clear';
  const normalWave=w-Math.floor(w/5);
  if(normalWave<8 || normalWave%4!==0) return 'clear';
  const roll=Math.random();
  return ['spawners','defend','survive'][Math.floor(roll*3)%3];
}
function objMat(col,op=0.72){
  return new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
}
function addObjectiveRing(x,z,r,col){
  const m=new THREE.Mesh(new THREE.RingGeometry(r*0.74,r,36),objMat(col,0.56));
  m.rotation.x=-Math.PI/2; m.position.set(x,0.09,z); m.renderOrder=95; scene.add(m);
  miniObjective.meshes.push(m); return m;
}
function addObjectiveNode(x,z,col){
  const g=new THREE.Group(); g.frustumCulled=false; g.renderOrder=96;
  const base=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.7,0.35,8),objMat(col,0.78)); base.position.y=0.18;
  const core=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.62,0.62),objMat(0xffffff,0.72)); core.position.y=0.62; core.rotation.y=Math.PI/4;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.74,0.035,5,24),objMat(col,0.55)); ring.rotation.x=Math.PI/2; ring.position.y=0.38;
  g.add(base,core,ring); g.position.set(x,0,z);
  g.traverse(o=>{o.renderOrder=96;});
  scene.add(g); miniObjective.meshes.push(g); return g;
}
// ── Tunables for the Overload-the-Relays + Collect-the-Cells objectives ──
const RELAY_POSITIONS=[{x:-6.6,z:-4.4},{x:6.6,z:-4.4},{x:0,z:5.0}]; // hacked one at a time, in order
const RELAY_CAPTURE_R=2.6;     // stand within this radius to hack the active relay
const RELAY_CAPTURE_TIME=3.0;  // seconds of standing to capture one relay
const CELL_TOTAL=10;
const CELL_INTERVAL=1.5;       // seconds after a pickup before the next cell appears
const CELL_PICKUP_R=1.25;
const OBJ_SPAWN_CAP=isMobile?12:20; // soft cap on objective-spawned enemies on screen
const OBJECTIVE_WALL_CLEARANCE=1.0;
function objectiveSpotIsFree(x,z){
  const r=OBJECTIVE_WALL_CLEARANCE;
  return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<=ARENA_W-r&&Math.abs(z)<=ARENA_H-r&&
    !obstacleBoxes.some(o=>!o._gone&&Math.abs(x-o.x)<o.hw+r&&Math.abs(z-o.z)<o.hd+r);
}
function freeObjectiveSpot(preferred, reserved=[]){
  const available=(x,z)=>objectiveSpotIsFree(x,z)&&reserved.every(p=>Math.hypot(p.x-x,p.z-z)>=4);
  // Match cell snapshot precision before checking clearance on the host.
  preferred={x:Math.round(preferred.x*100)/100,z:Math.round(preferred.z*100)/100};
  if(available(preferred.x,preferred.z))return {x:preferred.x,z:preferred.z};
  let best=null,bestDistance=Infinity;
  // Bounded fallback: never accept a wall just because random retries ran out.
  for(let x=-ARENA_W+1;x<=ARENA_W-1;x+=0.5){
    for(let z=-ARENA_H+1;z<=ARENA_H-1;z+=0.5){
      const distance=(x-preferred.x)**2+(z-preferred.z)**2;
      if(distance<bestDistance&&available(x,z)){best={x,z};bestDistance=distance;}
    }
  }
  return best;
}
function addCellMesh(x,z){
  const g=new THREE.Group(); g.frustumCulled=false; g.renderOrder=96;
  const core=new THREE.Mesh(new THREE.OctahedronGeometry(0.4), objMat(0x66ffcc,0.92)); core.position.y=0.72;
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.5,0.82,24), objMat(0x66ffcc,0.5)); ring.rotation.x=-Math.PI/2; ring.position.y=0.06;
  g.add(core,ring); g.position.set(x,0,z);
  g.traverse(o=>{o.renderOrder=96;});
  scene.add(g); miniObjective.meshes.push(g); return g;
}
// Drop a normal enemy at a random arena edge — keeps pressure up while a
// relays/cells objective is unfinished (those waves spawn enemies indefinitely).
function spawnObjectiveEnemy(){
  if(enemies.length>=OBJ_SPAWN_CAP) return;
  const m=ARENA_W-1.5, e=Math.floor(Math.random()*4);
  let x,z;
  if(e===0){ x=-m; z=(Math.random()*2-1)*m; }
  else if(e===1){ x=m; z=(Math.random()*2-1)*m; }
  else if(e===2){ x=(Math.random()*2-1)*m; z=-m; }
  else { x=(Math.random()*2-1)*m; z=m; }
  const type=waveNum>=8&&Math.random()<0.35?'speeder':(waveNum>=6&&Math.random()<0.25?'bomber':'chaser');
  const objective=miniObjective;
  spawnWarningCircle(x,z,1.4,0xffaa00,0.4,()=>{
    if(miniObjective===objective&&!objective?.complete&&gState==='playing')spawnEnemy(type,x,z);
  });
}
function playersNearObjective(x,z,r){
  const list=[];
  if(isLivingPlayerState(player)&&Math.hypot(player.pos.x-x,player.pos.z-z)<=r) list.push(player);
  for(const rp of Object.values(mp.remotePlayers)){
    if(isLivingPlayerState(rp)&&Math.hypot(rp.pos.x-x,rp.pos.z-z)<=r) list.push(rp);
  }
  return list;
}
function objectiveDamageEnemies(x,z,r,dmg,col=0x00ffcc){
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i]; if(!e||e.dead) continue;
    if(Math.hypot(e.pos.x-x,e.pos.z-z)<=r+e.cfg.r){
      e.hp-=dmg; e.hitFlashT=0.12; addEnemyStagger(e,0.16);
      showHitNumber(e,dmg,cssHex(col),mp.myId,'skill');
      if(e.hp<=0) killEnemy(e);
    }
  }
}
function setupMiniObjective(w, forcedType=null, visualOnly=false){
  disposeMiniObjective();
  const type=forcedType||objectiveTypeForWave(w);
  miniObjective={wave:w,type,complete:false,visualOnly,meshes:[],t:0};
  if(type==='clear') return;
  if(type==='spawners'){
    const hp=120+w*14;
    miniObjective.spawners=[{x:-6.4,z:-4.4,hp,maxHp:hp,alive:true,cd:1.2,mesh:null,armed:false},{x:6.4,z:4.4,hp,maxHp:hp,alive:true,cd:1.8,mesh:null,armed:false}];
    miniObjective.spawners.forEach(s=>{ s.mesh=addObjectiveNode(s.x,s.z,0xffaa00); });
    if(!visualOnly) annText('OBJECTIVE: BREACH SPAWNERS','#ffaa00');
  } else if(type==='defend'){
    const hp=260+w*22;
    miniObjective.reactor={x:0,z:0,hp,maxHp:hp,mesh:addObjectiveNode(0,0,0x00ffcc)};
    miniObjective.timer=Math.min(48,30+w*1.4);
    miniObjective.charge=0; miniObjective.pulseCd=2.0;
    miniObjective.chargeRing=addObjectiveRing(0,0,1.15,0xffffff);
    miniObjective.chargeRing.material.opacity=0.20;
    miniObjective.blastRing=addObjectiveRing(0,0,8.8,0x00ffcc);
    miniObjective.blastRing.material.opacity=0.14;
    if(!visualOnly) annText('OBJECTIVE: CHARGE THE REACTOR','#00ffcc');
  } else if(type==='survive'){
    miniObjective.timer=Math.min(55,32+w*1.5);
    miniObjective.safePath=[{x:0,z:0},{x:-5.5,z:-4.6},{x:5.5,z:-4.6},{x:4.8,z:4.9},{x:-4.8,z:4.9}];
    miniObjective.safe={r:4.4,hitCd:0,zones:[
      {x:-4.2,z:-2.6,target:1,moveT:0,ring:null},
      {x:4.2,z:2.6,target:3,moveT:2.8,ring:null}
    ]};
    miniObjective.safe.zones.forEach(z=>{ z.ring=addObjectiveRing(z.x,z.z,miniObjective.safe.r,0xff66cc); });
    if(!visualOnly) annText('OBJECTIVE: STAY INSIDE A STORM EYE','#ff66cc');
  } else if(type==='overload'){
    const positions=[];
    for(const preferred of RELAY_POSITIONS){
      const spot=freeObjectiveSpot(preferred,positions);
      if(!spot){miniObjective.type='clear';return;}
      positions.push(spot);
    }
    miniObjective.overload={spawnCd:1.2,terminals:positions.map(p=>({...p,arm:0,remaining:18,state:'idle',
      node:addObjectiveNode(p.x,p.z,0xffaa33),ring:addObjectiveRing(p.x,p.z,1.8,0xffaa33)}))};
    updateOverloadVisuals(miniObjective);
    if(!visualOnly)annText('OVERLOAD: STAND NEAR TERMINALS TO START','#ffaa33');
  } else if(type==='relays'){
    // 3 relays hacked one at a time; only the active one is shown. Enemies pour
    // in until all are captured (host-driven; clients see it via the snapshot).
    const positions=RELAY_POSITIONS.map(freeObjectiveSpot);
    if(positions.some(p=>!p)){miniObjective.type='clear';return;}
    const p0=positions[0];
    miniObjective.relays={ positions,index:0, captured:0, progress:0, spawnCd:1.2,
      node:addObjectiveNode(p0.x,p0.z,0x66ddff), ring:addObjectiveRing(p0.x,p0.z,RELAY_CAPTURE_R,0x66ddff) };
    miniObjective.relays.ring.material.opacity=0.18;
    if(!visualOnly) annText('OBJECTIVE: HACK THE RELAYS','#66ddff');
  } else if(type==='cells'){
    // One cell at a time; 3s after each pickup the next appears. 10 to win,
    // enemies spawning the whole time. One reused mesh, hidden between cells.
    miniObjective.cells={ collected:0, total:CELL_TOTAL, active:false, posX:0, posZ:0, spawnCd:0.6, enemyCd:1.0, node:addCellMesh(0,0) };
    miniObjective.cells.node.visible=false;
    if(!visualOnly) annText('OBJECTIVE: COLLECT THE CELLS','#66ffcc');
  }
}
function updateOverloadVisuals(o){
  for(const t of o.overload.terminals){
    const color=t.state==='done'?0x66ffcc:t.state==='active'?0xff5533:0xffaa33;
    t.ring.material.color.setHex(color);
    t.ring.material.opacity=t.state==='active'?0.65:t.state==='done'?0.25:0.2+t.arm*0.2;
    t.ring.scale.setScalar(t.state==='active'?0.65+0.35*(1-t.remaining/18):1);
    t.node.scale.setScalar(t.state==='done'?0.65:t.state==='active'?1.15:1);
    t.node.traverse(m=>{if(m.material?.color)m.material.color.setHex(color);});
  }
}
function miniObjectiveStatus(){
  const o=miniObjective;
  if(!o||o.type==='clear'||o.complete) return '';
  if(o.type==='spawners'){
    const left=o.spawners.filter(s=>s.alive).length;
    const armed=o.spawners.some(s=>s.alive&&s.armed);
    return `OBJ ${armed?'BREACH':'ENTER RING'} ${o.spawners.length-left}/${o.spawners.length}`;
  }
  if(o.type==='defend'){
    const hp=Math.max(0,Math.round(o.reactor.hp/o.reactor.maxHp*100));
    return `OBJ REACTOR ${Math.ceil(o.timer)}s HP ${hp}% CHG ${Math.round((o.charge||0)*100)}%`;
  }
  if(o.type==='survive') return `OBJ STORM EYES ${Math.ceil(o.timer)}s`;
  if(o.type==='relays') return `OBJ RELAYS ${o.relays.captured}/${RELAY_POSITIONS.length}${o.relays.progress>0&&o.relays.progress<1?` ${Math.round(o.relays.progress*100)}%`:''}`;
  if(o.type==='overload')return 'OBJ OVERLOAD '+o.overload.terminals.map((t,i)=>`${i+1}:${t.state==='done'?'OK':t.state==='active'?Math.ceil(t.remaining)+'s':Math.round(t.arm/2*100)+'%'}`).join(' ');
  if(o.type==='cells') return `OBJ CELLS ${o.cells.collected}/${o.cells.total}`;
  return '';
}
function completeMiniObjective(){
  if(!miniObjective||miniObjective.complete) return;
  miniObjective.complete=true;
  miniObjective.meshes.forEach(m=>m.visible=false);
  annText('OBJECTIVE COMPLETE','#00ff88');
  clearEnemiesForObjective();
}
function miniObjectiveBlocksWaveClear(){
  const o=miniObjective;
  if(!o||o.complete) return false;
  if(o.type==='spawners') return !!o.spawners?.some(s=>s.alive);
  // Relays/cells spawn enemies indefinitely and only end when the objective is done.
  if(o.type==='relays'||o.type==='cells'||o.type==='overload') return true;
  return false;
}
function livingPlayerNear(x,z,r){
  if(isLivingPlayerState(player)&&Math.hypot(player.pos.x-x,player.pos.z-z)<=r) return true;
  for(const rp of Object.values(mp.remotePlayers)){
    if(isLivingPlayerState(rp)&&Math.hypot(rp.pos.x-x,rp.pos.z-z)<=r) return true;
  }
  return false;
}
function updateMiniObjective(dt, now){
  const o=miniObjective;
  if(!o||o.visualOnly||o.complete||o.type==='clear'||gState!=='playing'||waveTransition||waveClear) return;
  o.t+=dt;
  if(o.type==='spawners'){
    for(const s of o.spawners){
      if(!s.alive) continue;
      s.armed=playersNearObjective(s.x,s.z,SPAWNER_ARM_RADIUS).length>0;
      s.cd-=dt;
      if(s.mesh){
        s.mesh.rotation.y+=dt*(s.armed?4.2:1.8);
        s.mesh.scale.setScalar(0.92+0.12*Math.sin(now*0.01)+(s.armed?0.22:0));
      }
      if(s.cd<=0){
        s.cd=s.armed ? 4.4+Math.random()*1.3 : 2.6+Math.random()*1.0;
        const type=waveNum>=8&&Math.random()<0.35?'speeder':(waveNum>=6&&Math.random()<0.25?'bomber':'chaser');
        spawnWarningCircle(s.x,s.z,1.4,0xffaa00,0.45,()=>spawnEnemy(type,s.x+(Math.random()-0.5)*1.2,s.z+(Math.random()-0.5)*1.2));
      }
    }
    if(o.spawners.every(s=>!s.alive)) completeMiniObjective();
  } else if(o.type==='defend'){
    o.timer-=dt;
    const helpers=playersNearObjective(o.reactor.x,o.reactor.z,3.0).length;
    if(helpers>0){
      o.charge=Math.min(1,(o.charge||0)+dt*(0.13+helpers*0.085));
      o.reactor.hp=Math.min(o.reactor.maxHp,o.reactor.hp+dt*(2.2+helpers*1.4));
    } else {
      o.charge=Math.max(0,(o.charge||0)-dt*0.035);
    }
    let pressure=0;
    for(const e of enemies){
      if(e.dead) continue;
      const d=Math.hypot(e.pos.x-o.reactor.x,e.pos.z-o.reactor.z);
      if(d<2.2+e.cfg.r) pressure+=dt*(e.type==='tank'?4:e.type==='boss'?9:2.2);
    }
    if(pressure>0){
      o.reactor.hp-=pressure;
      if(o.reactor.mesh) o.reactor.mesh.scale.setScalar(1+Math.min(0.25,pressure*0.03)+(o.charge||0)*0.22);
    } else if(o.reactor.mesh) o.reactor.mesh.scale.setScalar(1+(o.charge||0)*0.22);
    if(o.reactor.mesh) o.reactor.mesh.rotation.y+=dt*1.2;
    if(o.chargeRing){
      o.chargeRing.visible=true;
      o.chargeRing.material.opacity=0.18+0.62*(o.charge||0)+0.08*Math.sin(now*0.018);
      o.chargeRing.scale.setScalar(0.55+(o.charge||0)*2.35);
      o.chargeRing.rotation.z-=dt*(1.4+4.0*(o.charge||0));
    }
    if(o.blastRing){
      o.blastRing.visible=true;
      o.blastRing.material.opacity=0.10+0.20*(o.charge||0)+0.06*Math.max(0,Math.sin(now*0.012));
      o.blastRing.scale.setScalar(1+0.025*Math.sin(now*0.01));
    }
    o.pulseCd-=dt;
    if((o.charge||0)>=1&&o.pulseCd<=0){
      o.charge=0; o.pulseCd=1.8;
      spawnShockwave(o.reactor.x,o.reactor.z,8.8,0x00ffcc,0.34,0.95);
      objectiveDamageEnemies(o.reactor.x,o.reactor.z,8.8,Math.round(130+waveNum*9),0x00ffcc);
      burst({x:o.reactor.x,z:o.reactor.z},0x00ffcc,isMobile?10:18);
      sSlam();
    }
    if(o.reactor.hp<=0){
      annText('REACTOR LOST - CLEAR ENEMIES','#ff5577');
      // Mark the mini event as failed so claimWaveEventReward skips the
      // bonus pick. Without this, walking through the exit after reactor
      // death still awarded the +1 card (or — in the buggy old path —
      // failed silently because miniObjective got swapped to 'clear').
      if(waveEvent && waveEvent.type==='mini') waveEvent.failed=true;
      disposeMiniObjective();
      setupMiniObjective(waveNum,'clear');
      return;
    }
    if(o.timer<=0) completeMiniObjective();
  } else if(o.type==='survive'){
    o.timer-=dt;
    const s=o.safe;
    if(s){
      const zones=s.zones||[s];
      zones.forEach((z,idx)=>{
        z.moveT=(z.moveT||0)+dt;
        if(z.moveT>5.6){
          z.moveT=0; z.target=((z.target||0)+1+idx)%o.safePath.length;
          const p=o.safePath[z.target];
          spawnWarningCircle(p.x,p.z,s.r||z.r||4.4,0xff66cc,0.7,null);
        }
        const p=o.safePath[z.target||0];
        z.x+=(p.x-z.x)*(1-Math.exp(-0.45*dt));
        z.z+=(p.z-z.z)*(1-Math.exp(-0.45*dt));
        const ring=z.ring||o.ring;
        if(ring){
          ring.position.x=z.x; ring.position.z=z.z;
          ring.rotation.z+=dt*(0.8+idx*0.18);
          ring.material.opacity=0.52+0.20*Math.sin(now*0.006+idx*1.7);
        }
      });
      s.hitCd=Math.max(0,(s.hitCd||0)-dt);
      const outsideDmg=7+Math.floor(waveNum*0.35);
      const insideAny=(p)=>zones.some(z=>Math.hypot(p.pos.x-z.x,p.pos.z-z.z)<=((s.r||z.r)||4.4));
      const outside=(p)=>isLivingPlayerState(p)&&!insideAny(p);
      if(outside(player)&&s.hitCd<=0){
        hurtPlayer(outsideDmg);
        spawnShockwave(player.pos.x,player.pos.z,1.0,0xff66cc,0.16,0.5);
      }
      if(mp.isHost&&!mp.soloMode&&s.hitCd<=0){
        for(const [id,rp] of Object.entries(mp.remotePlayers)){
          if(outside(rp)){
            const c=mp.conns.get(+id);
            if(c&&c.open) c.send(JSON.stringify({type:'HURT',targetId:+id,dmg:outsideDmg}));
          }
        }
      }
      if(s.hitCd<=0) s.hitCd=0.85;
    }
    if(o.timer<=0) completeMiniObjective();
  } else if(o.type==='overload'){
    const terminals=o.overload.terminals;
    for(const t of terminals){
      const before=t.state;
      advanceOverload(t,dt,livingPlayerNear(t.x,t.z,1.8));
      if(t.state!==before){
        spawnShockwave(t.x,t.z,2.2,t.state==='done'?0x66ffcc:0xffaa33,0.4,0.8);
        if(t.state==='active')annText('TERMINAL ONLINE — SURVIVE 18s','#ffaa33');
      }
    }
    updateOverloadVisuals(o);
    if(terminals.every(t=>t.state==='done')){completeMiniObjective();return;}
    o.overload.spawnCd-=dt;
    if(o.overload.spawnCd<=0){
      o.overload.spawnCd=overloadSpawnInterval(terminals);
      spawnObjectiveEnemy();
    }
  } else if(o.type==='relays'){
    const r=o.relays;
    r.spawnCd-=dt; if(r.spawnCd<=0){ r.spawnCd=1.8+Math.random()*0.8; spawnObjectiveEnemy(); }
    const pos=r.positions[r.index];
    const near=playersNearObjective(pos.x,pos.z,RELAY_CAPTURE_R).length;
    if(near>0) r.progress=Math.min(1,r.progress+dt/RELAY_CAPTURE_TIME*(1+0.45*(near-1)));
    else r.progress=Math.max(0,r.progress-dt*0.4); // slow decay when nobody's on it
    if(r.node){ r.node.rotation.y+=dt*(near>0?4.5:1.8); r.node.scale.setScalar(0.92+0.1*Math.sin(now*0.01)+(near>0?0.2:0)); }
    if(r.ring){ r.ring.material.opacity=0.18+0.62*r.progress; r.ring.scale.setScalar(0.6+r.progress*0.9); r.ring.rotation.z-=dt*(1.2+3*r.progress); }
    if(r.progress>=1){
      r.captured++; r.progress=0;
      spawnShockwave(pos.x,pos.z,2.6,0x66ddff,0.3,0.85); burst({x:pos.x,z:pos.z},0x66ddff,isMobile?8:16); sBuffPick();
      if(r.captured>=RELAY_POSITIONS.length){ completeMiniObjective(); return; }
      r.index++;
      const np=r.positions[r.index];
      if(r.node){ r.node.position.set(np.x,0,np.z); r.node.visible=true; }
      if(r.ring) r.ring.position.set(np.x,0.09,np.z);
      annText(`RELAY ${r.captured}/${RELAY_POSITIONS.length} HACKED`,'#66ddff');
    }
  } else if(o.type==='cells'){
    const c=o.cells;
    c.enemyCd-=dt; if(c.enemyCd<=0){ c.enemyCd=2.0+Math.random()*0.7; spawnObjectiveEnemy(); }
    if(c.active){
      if(c.node){ if(c.node.children[0]) c.node.children[0].position.y=0.72+Math.sin(now*0.006)*0.12; c.node.rotation.y+=dt*2.2; }
      if(livingPlayerNear(c.posX,c.posZ,CELL_PICKUP_R)){
        c.collected++; c.active=false; c.spawnCd=CELL_INTERVAL;
        if(c.node) c.node.visible=false;
        spawnShockwave(c.posX,c.posZ,1.6,0x66ffcc,0.24,0.7); burst({x:c.posX,z:c.posZ},0x66ffcc,isMobile?6:12); sBuffPick();
        annText(`CELL ${c.collected}/${c.total}`,'#66ffcc');
        if(c.collected>=c.total){ completeMiniObjective(); return; }
      }
    } else if(c.collected<c.total){
      c.spawnCd-=dt;
      if(c.spawnCd<=0){
        // Next cell at a random spot, kept a little away from the player so they have to move to it.
        let x,z,tries=0;
        do{ x=(Math.random()*2-1)*(ARENA_W-2.5); z=(Math.random()*2-1)*(ARENA_H-2.5); tries++; }
        while(tries<8 && (!objectiveSpotIsFree(x,z)||(isLivingPlayerState(player)&&Math.hypot(player.pos.x-x,player.pos.z-z)<4.5)));
        const spot=freeObjectiveSpot({x,z});
        if(!spot){c.spawnCd=CELL_INTERVAL;return;}
        c.posX=spot.x; c.posZ=spot.z; c.active=true;
        if(c.node){ c.node.position.set(spot.x,0,spot.z); c.node.visible=true; }
      }
    }
  }
}
// Engagement ring around each spawner. Players inside this radius "arm" the
// spawner so damage will register. Bigger ring = easier to keep firing while
// kiting around the nest.
const SPAWNER_ARM_RADIUS = 2.9;
// Generic spawner damage. ANY damage source (bullet / melee / spell / AoE /
// summon) should route through here so the nest can't ignore non-bullet hits.
function damageMiniObjectiveAt(x, z, dmg, hitR = 1.1, srcColor = 0xffaa00){
  const o = miniObjective;
  if(!o || o.visualOnly || o.complete || o.type !== 'spawners') return false;
  let landed = false;
  for(const s of o.spawners){
    if(!s.alive) continue;
    if(Math.hypot(x - s.x, z - s.z) > hitR) continue;
    const armed = playersNearObjective(s.x, s.z, SPAWNER_ARM_RADIUS).length > 0;
    s.armed = armed;
    if(!armed){
      dmgNum('SHIELD', _scratchPos.set(s.x, 0, s.z), '#ffaa00');
      spawnShockwave(s.x, s.z, 1.4, 0xffaa00, 0.14, 0.45);
      landed = true;
      continue;
    }
    const applied = Math.max(18, Math.round((dmg || 20) * 0.75));
    s.hp -= applied;
    dmgNum('-' + applied, _scratchPos.set(s.x, 0, s.z), cssHex(srcColor));
    burst({x:s.x, z:s.z}, srcColor, isMobile ? 4 : 8);
    if(s.mesh) s.mesh.scale.setScalar(0.85 + 0.25 * Math.max(0, s.hp / s.maxHp));
    if(s.hp <= 0){
      s.alive = false;
      if(s.mesh) s.mesh.visible = false;
      spawnShockwave(s.x, s.z, 2.2, 0xffaa00, 0.22, 0.8);
    }
    landed = true;
  }
  if(landed) updateHUD();
  return landed;
}
function damageMiniObjectiveWithBullet(b){
  if(!b.isPlayer || b.visualOnly) return false;
  return damageMiniObjectiveAt(b.pos.x, b.pos.z, b.dmg || 20, 1.1, 0xffaa00);
}
// Beam/cone guns (laser, rail, flame, cryo) sweep enemies with their own segment/cone tests and
// never pass through the pooled-bullet loop, so they used to be unable to breach spawner nests.
// These mirror those weapons' enemy hit tests against the spawner positions.
function damageMiniObjectiveAlongSegment(sx, sz, dx, dz, len, halfWidth, dmg, color){
  const o = miniObjective;
  if(!o || o.complete || o.type !== 'spawners') return false;
  const ex = sx + dx * len, ez = sz + dz * len;
  let landed = false;
  for(const s of o.spawners){
    if(!s.alive) continue;
    if(segmentPointDistance(s.x, s.z, sx, sz, ex, ez) <= halfWidth + 0.85){
      landed = damageMiniObjectiveAt(s.x, s.z, dmg, 0.9, color) || landed;
    }
  }
  return landed;
}
function damageMiniObjectiveInCone(x, z, dx, dz, range, cone, dmg, color){
  const o = miniObjective;
  if(!o || o.complete || o.type !== 'spawners') return false;
  const minDot = Math.cos(cone * 0.5);
  let landed = false;
  for(const s of o.spawners){
    if(!s.alive) continue;
    const ox = s.x - x, oz = s.z - z;
    const d = Math.hypot(ox, oz);
    if(d > range + 0.85) continue;
    const dot = d > 0.0001 ? (ox * dx + oz * dz) / d : 1;
    if(dot < minDot && d > 0.9) continue; // point-blank always counts, matching the enemy cone test's forgiveness
    landed = damageMiniObjectiveAt(s.x, s.z, dmg, 0.9, color) || landed;
  }
  return landed;
}
function miniObjectiveSnapshot(){
  const o=miniObjective;
  if(!o) return {type:'clear',wave:waveNum};
  const snap={type:o.type,wave:o.wave,complete:!!o.complete,timer:o.timer?Math.round(o.timer*10)/10:0};
  if(o.spawners) snap.spawners=o.spawners.map(s=>({hp:Math.round(s.hp),maxHp:s.maxHp,alive:s.alive,armed:!!s.armed}));
  if(o.reactor) snap.reactor={hp:Math.round(o.reactor.hp),maxHp:o.reactor.maxHp,charge:Math.round((o.charge||0)*100)/100};
  if(o.safe){
    snap.safe={r:o.safe.r,hitCd:o.safe.hitCd||0};
    if(o.safe.zones) snap.safe.zones=o.safe.zones.map(z=>({x:Math.round(z.x*100)/100,z:Math.round(z.z*100)/100,target:z.target||0,moveT:Math.round((z.moveT||0)*10)/10}));
    else { snap.safe.x=Math.round(o.safe.x*100)/100; snap.safe.z=Math.round(o.safe.z*100)/100; }
  }
  if(o.overload)snap.overload=o.overload.terminals.map(({x,z,arm,remaining,state})=>({x,z,arm,remaining,state}));
  if(o.relays) snap.relays={positions:o.relays.positions.map(p=>({...p})),index:o.relays.index,captured:o.relays.captured,progress:Math.round((o.relays.progress||0)*100)/100};
  if(o.cells) snap.cells={collected:o.cells.collected,active:!!o.cells.active,x:Math.round((o.cells.posX||0)*100)/100,z:Math.round((o.cells.posZ||0)*100)/100};
  return snap;
}
function applyMiniObjectiveSnapshot(snap){
  if(!snap||snap.type==='clear'){
    if(miniObjective&&!miniObjective.visualOnly) return;
    disposeMiniObjective();
    updateHUD();
    return;
  }
  if(!miniObjective||!miniObjective.visualOnly||miniObjective.wave!==snap.wave||miniObjective.type!==snap.type){
    setupMiniObjective(snap.wave||waveNum,snap.type,true);
  }
  if(!miniObjective) return;
  miniObjective.complete=!!snap.complete;
  if(Number.isFinite(snap.timer)) miniObjective.timer=snap.timer;
  if(snap.spawners&&miniObjective.spawners){
    snap.spawners.forEach((s,i)=>{
      const sp=miniObjective.spawners[i]; if(!sp) return;
      sp.hp=s.hp; sp.maxHp=s.maxHp; sp.alive=s.alive; sp.armed=!!s.armed;
      if(sp.mesh){ sp.mesh.visible=sp.alive&&!snap.complete; sp.mesh.scale.setScalar(0.85+0.25*Math.max(0,sp.hp/(sp.maxHp||1))+(sp.armed?0.18:0)); }
    });
  }
  if(snap.reactor&&miniObjective.reactor){
    miniObjective.reactor.hp=snap.reactor.hp; miniObjective.reactor.maxHp=snap.reactor.maxHp;
    miniObjective.charge=snap.reactor.charge||0;
    if(miniObjective.reactor.mesh) miniObjective.reactor.mesh.scale.setScalar(1+(miniObjective.charge||0)*0.22);
    if(miniObjective.chargeRing){
      miniObjective.chargeRing.material.opacity=0.18+0.62*(miniObjective.charge||0);
      miniObjective.chargeRing.scale.setScalar(0.55+(miniObjective.charge||0)*2.35);
    }
    if(miniObjective.blastRing){
      miniObjective.blastRing.material.opacity=0.10+0.20*(miniObjective.charge||0);
    }
  }
  if(snap.safe&&miniObjective.safe){
    miniObjective.safe.r=snap.safe.r||miniObjective.safe.r;
    if(snap.safe.zones&&miniObjective.safe.zones){
      snap.safe.zones.forEach((sz,i)=>{
        const z=miniObjective.safe.zones[i]; if(!z) return;
        z.x=sz.x; z.z=sz.z; z.target=sz.target||z.target||0; z.moveT=sz.moveT||0;
        if(z.ring){
          z.ring.position.x=z.x;
          z.ring.position.z=z.z;
          z.ring.scale.setScalar((miniObjective.safe.r||4.4)/4.4);
        }
      });
    } else {
      miniObjective.safe.x=snap.safe.x; miniObjective.safe.z=snap.safe.z;
      if(miniObjective.ring){
        miniObjective.ring.position.x=miniObjective.safe.x;
        miniObjective.ring.position.z=miniObjective.safe.z;
        miniObjective.ring.scale.setScalar((miniObjective.safe.r||4.4)/4.4);
      }
    }
  }
  if(snap.overload&&miniObjective.overload&&snap.overload.length===3){
    snap.overload.forEach((data,i)=>{
      const t=miniObjective.overload.terminals[i];
      if(!Number.isFinite(data.x)||!Number.isFinite(data.z))return;
      Object.assign(t,{x:data.x,z:data.z,arm:data.arm,remaining:data.remaining,state:data.state});
      t.node.position.set(t.x,0,t.z);t.ring.position.set(t.x,0.09,t.z);
    });
    updateOverloadVisuals(miniObjective);
  }
  if(snap.relays&&miniObjective.relays){
    const r=miniObjective.relays;
    if(Array.isArray(snap.relays.positions)&&snap.relays.positions.length===RELAY_POSITIONS.length&&snap.relays.positions.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.z)))r.positions=snap.relays.positions.map(p=>({...p}));
    r.index=snap.relays.index; r.captured=snap.relays.captured; r.progress=snap.relays.progress||0;
    const pos=r.positions[Math.min(r.index,r.positions.length-1)];
    const show=!snap.complete && r.captured<RELAY_POSITIONS.length;
    if(r.node){ r.node.position.set(pos.x,0,pos.z); r.node.visible=show; }
    if(r.ring){ r.ring.position.set(pos.x,0.09,pos.z); r.ring.material.opacity=0.18+0.62*r.progress; r.ring.scale.setScalar(0.6+r.progress*0.9); r.ring.visible=show; }
  }
  if(snap.cells&&miniObjective.cells){
    const c=miniObjective.cells;
    c.collected=snap.cells.collected; c.active=!!snap.cells.active; c.posX=snap.cells.x; c.posZ=snap.cells.z;
    if(c.node){ if(c.active&&!snap.complete){ c.node.position.set(c.posX,0,c.posZ); c.node.visible=true; } else c.node.visible=false; }
  }
  if(miniObjective.meshes) miniObjective.meshes.forEach(m=>{ if(snap.complete) m.visible=false; });
  updateHUD();
}

function spawnBoss(w,bossIndex=0,bossTotal=1,totemMult=1){
  const cfg=ETYPES['boss'];
  const bName=bossNameForWave(w);
  const profile=BOSS_PROFILES[bName]||BOSS_PROFILES.WARDEN;
  const hs=diffScale(w)*(2.1+Math.min(runSkillPower()*0.018,0.6));
  // Boss HP is host-authoritative, so honour ANY player's Heavy Crown (incl. a
  // client's) — otherwise a client's crown silently does nothing to boss HP.
  const _crownLvl=_anyPlayerRelicLevel('heavyCrown');
  const crownHp=_crownLvl>0?RELIC_LEVELS.heavyCrown.bossHpMul[_crownLvl]:1;
  // Per-encounter escalation: each successive boss in the run (1st at w5, 2nd
  // at w10, ...) gets +6% hp/dmg on top of the wave scaling, so the sequence
  // keeps climbing regardless of each archetype's flavour multipliers — and
  // the second loop of bosses outpaces the first. Speed already steps up via
  // the +floor(w/5)*0.12 term below.
  const bossEscal=1+Math.max(0,Math.floor(w/5)-1)*0.06;
  const bossHp=Math.round(cfg.hp*hs*profile.hp*totemMult*crownHp*bossEscal);
  const ang=(bossIndex/Math.max(1,bossTotal))*Math.PI*2;
  const spreadR=Math.min(8.2,3.6+bossTotal*0.28);
  const spawnPos=bossTotal>1
    ? {x:Math.cos(ang)*spreadR,z:-1.2+Math.sin(ang)*spreadR*0.82}
    : {x:0,z:-ARENA_H+3};
  projectToNearestOpen(spawnPos,cfg.r,Math.max(5,cfg.r*3));
  const slot=acquireEnemySlot('boss',spawnPos.x,spawnPos.z);
  if(!slot) return;
  const boss={
    type:'boss',poolIdx:slot.poolIdx,mesh:slot.mesh,cfg,
    hp:bossHp,maxHp:bossHp,spd:(cfg.spd+Math.floor(w/5)*0.12)*spdScale(w)*profile.spd,
    dmgMult:dmgScale(w)*1.65*profile.dmg*totemMult*bossEscal,pos:new THREE.Vector3(spawnPos.x,0,spawnPos.z),
    fireCd:0.5,stagger:0,dead:false,avoidX:0,avoidZ:0,stuckT:0,
    prevX:spawnPos.x,prevZ:spawnPos.z,stuckCheck:0,hitFlashT:0,spawnAnim:0.6,
    attackT:0,attackDur:0.28,attackSeq:0,
    detourT:0,detourX:0,detourZ:0,
    chargeT:0,dashT:0,dashCharge:0,dashActive:0,dashDX:0,dashDZ:0,
    phase:1,slamCd:2.0,burstCd:3.0,bossName:bName,bossProfile:profile,spawnedMinions:false,
    bossIntensity:Math.min(4,Math.floor((Math.floor(w/5)-1)/2)), // pattern density step: rises every 2 boss encounters

    elitePulseCd:1.8,specialCd:2.2+Math.random(),summonCd:4.0+Math.random()*1.5,burstSpin:0,
  };
  applyEnemyVisual(boss);
  enemies.push(boss);
  if(currentBossTargetPoolIdx===null) currentBossTargetPoolIdx=boss.poolIdx;
  updateBossBarFromEnemies();
  bossIntro(bName,profile.col);
  screenFlash(cssHex(profile.col),0.5);
  shakeAmt=Math.max(shakeAmt,0.6);
  musicStart(w,true);
}

// Concurrent on-map enemy cap. Solo wave 1-5 starts at 22, grows by 0.8 per
// wave past 5, caps the growth at +28 (so solo never has more than 50
// enemies alive at once). Party-size multiplier follows the same income
// math as the run shop — more players = more enemies allowed alive.
// This cap is a perf safety net; uncapped soft scaling on `getWaveConfig`
// queues enemies indefinitely and we drip-feed them in as on-map ones die.
function onMapEnemyCap(w){
  const baseCap=22;
  const softGrowth=Math.min(28, Math.max(0, w-5)*0.8);
  const cap=baseCap+softGrowth;
  const solo=PLAYER_COUNT_BALANCE[1];
  const playerMult=solo ? playerBalance().count/solo.count : 1;
  return Math.max(8, Math.round(cap*playerMult));
}

// Wave-spawn batch refill. Queue is built by spawnWave and drained in
// chunks: every WAVE_SPAWN_INTERVAL seconds we top the live-enemy count
// back up to the on-map cap with whatever's queued. Between batches, kills
// stay un-replaced — gives players a deliberate breathing window after
// clearing a wave's batch. If the player kills 30 enemies in a single
// burst, the next batch (5 s later) spawns 30 at once to refill.
let _waveSpawnQueue=[];
let _waveSpawnTimer=0;
const WAVE_SPAWN_INTERVAL=5.0; // seconds between batches

function tickWaveSpawnQueue(dt){
  if(_waveSpawnQueue.length===0) return;
  if(gState!=='playing') return;
  _waveSpawnTimer+=dt;
  if(_waveSpawnTimer<WAVE_SPAWN_INTERVAL) return;
  _waveSpawnTimer=0;
  const cap=onMapEnemyCap(waveNum);
  let alive=0;
  for(const e of enemies) if(!e.dead) alive++;
  while(_waveSpawnQueue.length>0 && alive<cap){
    const item=_waveSpawnQueue.shift();
    spawnEnemy(item.type,item.sx,item.sz);
    alive++;
  }
  if(_waveSpawnQueue.length===0) waveSpawned=true;
}

// Wave events fire on ~50% of non-boss waves. Mini-objective waves now ONLY
// happen as one of the event types. Shop waves don't go through spawnWave —
// they're handled by startRunShopRound — so we only need to skip boss waves.
// Flat event pool. Mini / bounty / challenge sub-types are individual entries
// so every distinct event has the same ~8.3% pick weight (12 entries × 50%
// roll = ~4.2% per wave, ~8.3% conditional on an event firing).
// Wave events roll CATEGORY-first by weight, then pick a sub-event uniformly
// within the chosen category — so a category's odds don't depend on how many
// sub-events it has. Weights: mini 15%, bounty 20%, challenge 30%, bonus 20%,
// nothing 15%. "Bonus" groups loot / crystal / mutation.
const WAVE_EVENT_CATEGORIES = [
  { chance: 0.15, events: [ {type:'mini',sub:'spawners'}, {type:'mini',sub:'survive'}, {type:'mini',sub:'relays'}, {type:'mini',sub:'cells'}, {type:'mini',sub:'overload'} ] },
  { chance: 0.20, events: [ {type:'bounty',sub:'noDamage'}, {type:'bounty',sub:'fastClear'}, {type:'bounty',sub:'noDeaths'}, {type:'bounty',sub:'noBullet'} ] },
  { chance: 0.30, events: [ {type:'challenge',sub:'speedDemon'}, {type:'challenge',sub:'meteorStorm'}, {type:'challenge',sub:'rangedHell'}, {type:'challenge',sub:'fogOfWar'}, {type:'challenge',sub:'vampireNight'}, {type:'challenge',sub:'plagueField'}, {type:'challenge',sub:'eliteSurge'} ] },
  { chance: 0.20, events: [ {type:'loot'}, {type:'crystal'}, {type:'mutation'}, {type:'doublePick'} ] },
  // remaining 0.15 → no event
];
function rollWaveEvent(w){
  if(w%5===0) return null;
  let r=Math.random();
  for(const cat of WAVE_EVENT_CATEGORIES){
    if(r < cat.chance){
      const eligible=cat.events.filter(e=>(e.sub!=='meteorStorm'||w>25)&&(e.sub!=='overload'||w>=8));
      const e=eligible[Math.floor(Math.random()*eligible.length)];
      // Shallow clone so each wave gets its own mutable flags (complete/failed/_claimed).
      return Object.assign({},e);
    }
    r -= cat.chance;
  }
  return null; // nothing (the remaining 15%)
}
const WAVE_EVENT_LABELS = {
  mini:      { title:'★ MINI OBJECTIVE',   color:'#ffaa00', sub:{ spawners:'BREACH THE SPAWNERS', survive:'STAY IN THE STORM EYE', relays:'CAPTURE ALL 3 RELAYS', cells:'COLLECT ALL 10 CELLS', overload:'HOLD NEAR EACH TERMINAL 2s · SURVIVE ITS CHARGE' } },
  loot:      { title:'★ LOOT WAVE',        color:'#ffd166', desc:'Clear the wave for a bonus card' },
  bounty:    { title:'★ BOUNTY WAVE',      color:'#ff66cc', sub:{ noDamage:'NO DAMAGE TAKEN', fastClear:'CLEAR IN UNDER 60s', noDeaths:'STAY UP — NO DEATHS', noBullet:'NO GUNFIRE — MELEE & SKILLS ONLY' } },
  challenge: { title:'★ CHALLENGE WAVE',   color:'#ff5577', sub:{ speedDemon:'ENEMIES MOVE 2× FASTER', meteorStorm:'METEORS RAIN — KEEP MOVING', rangedHell:'LONG-RANGE ENEMIES · +50% FIRE RATE', fogOfWar:'VISIBILITY HEAVILY REDUCED', vampireNight:'ENEMIES HEAL ON HIT', plagueField:'NO HEALING — DAMAGE STAYS', eliteSurge:'EVERY ENEMY SPAWNS AS AN ELITE' } },
  crystal:   { title:'★ CRYSTAL WAVE',     color:'#88e8ff', desc:'Crystal drops ×2' },
  mutation:  { title:'★ MUTATION WAVE',    color:'#cc66ff', desc:'Wave clear: choose 1 of 5 cards' },
  doublePick:{ title:'★ DOUBLE PICK',      color:'#ffd166', desc:'Wave clear: keep 2 of the 3 skill cards' },
};
// Switches the panel between "popped" (centered, large) and "docked" (small,
// off to the side). Driven via inline styles + the CSS transition declared
// on the panel itself. Called from announceWaveEvent on wave start, and
// auto-flips to docked after ~2.2s.
let _wepDockTimer=null;
function _applyWepStyle(dock){
  const el=document.getElementById('waveEventPanel'); if(!el) return;
  el.dataset.dock=dock?'1':'0';
  const title=document.getElementById('wepTitle');
  const obj=document.getElementById('wepObjective');
  const prog=document.getElementById('wepProgress');
  const status=document.getElementById('wepStatus');
  if(dock){
    // Docked: small, top-right, doesn't block view.
    el.style.left='auto';
    el.style.right='14px';
    el.style.top='128px';
    el.style.transform='none';
    el.style.padding='8px 12px 9px';
    el.style.minWidth='184px';
    el.style.maxWidth='260px';
    el.style.fontSize='11.5px';
    el.style.opacity='1';
    if(title) title.style.fontSize='12.5px';
    if(obj) obj.style.fontSize='11px';
    if(prog) prog.style.fontSize='10.5px';
    if(status) status.style.fontSize='10px';
  } else {
    // Popped: large, centered, attention-getting on wave start.
    el.style.left='50%';
    el.style.right='auto';
    el.style.top='38%';
    el.style.transform='translate(-50%,-50%)';
    el.style.padding='18px 28px 20px';
    el.style.minWidth='320px';
    el.style.maxWidth='440px';
    el.style.fontSize='18px';
    el.style.opacity='1';
    if(title) title.style.fontSize='22px';
    if(obj) obj.style.fontSize='16px';
    if(prog) prog.style.fontSize='14px';
    if(status) status.style.fontSize='12px';
  }
}
function announceWaveEvent(){
  if(!waveEvent) return;
  const info=WAVE_EVENT_LABELS[waveEvent.type]; if(!info) return;
  // No annText flash — the panel itself pops big at screen-center to
  // announce, then shrinks/docks. annText was firing a second after wave
  // start and felt jarring; the panel timing is now under our control.
  if(typeof sEventCue==='function') sEventCue();
  const el=document.getElementById('waveEventPanel');
  if(el){
    el.style.display='block';
    // Render content first so the popped panel is already populated.
    renderWaveEventBanner();
    // Apply popped style on next frame so the CSS transition fires from
    // the prior docked/hidden state to the popped state.
    requestAnimationFrame(()=>requestAnimationFrame(()=>_applyWepStyle(false)));
    // Auto-dock after a beat so it stops covering the action.
    if(_wepDockTimer){ clearTimeout(_wepDockTimer); }
    _wepDockTimer=setTimeout(()=>_applyWepStyle(true), 2200);
  }
}
// Re-paints panel content every ~180ms while an event is active. Only the
// dynamic bits change; the popped/docked positioning is set by _applyWepStyle
// and survives re-renders.
function renderWaveEventBanner(){
  const el=document.getElementById('waveEventPanel'); if(!el) return;
  if(!waveEvent){ el.style.display='none'; if(_wepDockTimer){ clearTimeout(_wepDockTimer); _wepDockTimer=null; } return; }
  const info=WAVE_EVENT_LABELS[waveEvent.type]; if(!info){ el.style.display='none'; return; }
  const titleEl=document.getElementById('wepTitleText');
  const statusEl=document.getElementById('wepStatus');
  const objEl=document.getElementById('wepObjective');
  const progEl=document.getElementById('wepProgress');
  if(!titleEl||!objEl) return;
  el.style.display='block';
  el.style.borderColor=info.color;
  titleEl.style.color=info.color;
  titleEl.textContent=info.title;
  // Objective body — what the player needs to do or what's special.
  const body=info.desc || info.sub?.[waveEvent.sub] || '';
  objEl.textContent=body;
  // Status pill + progress line. progText is only populated for events with
  // *distinct* live state — duplicating the objective text in the progress
  // row (the original "Crystal drops ×2 / Crystal drops ×2" stutter) reads
  // as a bug.
  let statusText='ACTIVE', statusColor=info.color, progText='';
  if(waveEvent.type==='bounty'){
    if(waveEvent.failed){ statusText='FAILED'; statusColor='#ff5577'; }
    else if(waveEvent.sub==='fastClear'){
      const remain=Math.max(0,BOUNTY_FAST_CLEAR_TIME-waveFightTime);
      progText=`Time left: ${remain.toFixed(1)}s`;
      if(remain<=10) statusColor='#ffaa44';
    } else if(waveEvent.sub==='noDamage'){
      progText=`Damage taken: ${_waveEventDamageTaken|0}`;
    } else if(waveEvent.sub==='noDeaths'){
      progText=_waveEventDeathLocal?'You went down':'No deaths so far';
    } else if(waveEvent.sub==='noBullet'){
      progText='No gunfire so far';
    }
  } else if(waveEvent.type==='mini'){
    if(miniObjective){
      if(miniObjective.complete){ statusText='COMPLETE'; statusColor='#66ff99'; }
      else if(miniObjective.spawners){
        const left=miniObjective.spawners.filter(s=>s.alive).length;
        progText=`Spawners left: ${left}/${miniObjective.spawners.length}`;
      } else if(miniObjective.reactor){
        const hpPct=Math.max(0,Math.round(miniObjective.reactor.hp/miniObjective.reactor.maxHp*100));
        progText=`Reactor ${hpPct}% — ${Math.ceil(miniObjective.timer||0)}s left`;
      } else if(miniObjective.relays){
        const r=miniObjective.relays;
        progText=`Relays ${r.captured}/${RELAY_POSITIONS.length} — ${Math.round(r.progress*100)}%`;
      } else if(miniObjective.cells){
        progText=`Cells ${miniObjective.cells.collected}/${miniObjective.cells.total}`;
      } else if(miniObjective.timer!=null){
        progText=`Hold for ${Math.ceil(miniObjective.timer)}s`;
      }
    }
  } else if(waveEvent.type==='mutation'){
    statusText='PENDING';
  } else if(waveEvent.type==='loot'){
    statusText='PENDING';
  } else if(waveEvent.type==='crystal'){
    statusText='ACTIVE';
  }
  statusEl.textContent=statusText;
  statusEl.style.color=statusColor;
  statusEl.style.borderColor=statusColor;
  if(progText){
    progEl.style.display='block';
    progEl.textContent=progText;
    progEl.style.color=statusColor;
  } else {
    progEl.style.display='none';
    progEl.textContent='';
  }
}
function evaluateBountyTick(){
  if(!waveEvent||waveEvent.type!=='bounty'||waveEvent.failed) return;
  if(waveEvent.sub==='noDamage' && _waveEventDamageTaken>0) waveEvent.failed=true;
  else if(waveEvent.sub==='noDeaths' && _waveEventDeathLocal) waveEvent.failed=true;
  else if(waveEvent.sub==='fastClear' && waveFightTime>=BOUNTY_FAST_CLEAR_TIME) waveEvent.failed=true;
}
// No-Bullet bounty: firing a gun once enemies are out (past a short grace so a
// held LMB carried into the wave doesn't insta-fail) ends the bounty. Called
// from the player's gun-fire commit points only.
const NOBULLET_BUFFER=1.5;
function noteWaveEventGunFire(){
  if(waveEvent && waveEvent.type==='bounty' && waveEvent.sub==='noBullet' && !waveEvent.failed && waveFightTime>NOBULLET_BUFFER){
    waveEvent.failed=true;
    annText('BOUNTY FAILED — YOU FIRED','#ff5577');
  }
}
// Meteor Storm challenge: tracker for periodic random meteor drops during
// the wave. _meteorStormCd ticks down each frame; on 0 we schedule a
// telegraphed meteor anywhere on the play area and reset the cooldown.
let _meteorStormCd=0;
// Heavy rain: every ~0.35–0.55s a small barrage of meteors drops. With ~2
// per tick that's ~4–6 meteors per second across the arena — frantic enough
// that standing still gets you killed, but with ~0.7s telegraph circles the
// player can read the danger and weave through.
const METEOR_STORM_INTERVAL=[0.24,0.38];
const METEOR_STORM_PER_TICK=[3,5]; // min..max meteors per tick
const METEOR_STORM_RADIUS=2.05;
const METEOR_STORM_BASE_DMG=14;
const METEOR_STORM_TELEGRAPH=0.62;
function tickMeteorStormChallenge(dt){
  if(!waveEvent || waveEvent.type!=='challenge' || waveEvent.sub!=='meteorStorm') return;
  if(waveClear || waveTransition || gState!=='playing') return;
  // Local-only damage to the local player — each client runs its own drops
  // in MP so everyone gets to dodge their own pattern.
  _meteorStormCd-=dt;
  if(_meteorStormCd>0) return;
  const [mn,mx]=METEOR_STORM_INTERVAL;
  _meteorStormCd=mn+Math.random()*(mx-mn);
  const [pmn,pmx]=METEOR_STORM_PER_TICK;
  const count=pmn+Math.floor(Math.random()*(pmx-pmn+1));
  for(let i=0;i<count;i++){
    // Mix of player-tracking + fully random so the rain looks chaotic but
    // still pressures the player. Each meteor in the tick rolls independently.
    let tx, tz;
    if(Math.random()<0.68 && player && !player.dead){
      const r=1.0+Math.random()*6.2, ang=Math.random()*Math.PI*2;
      tx=player.pos.x+Math.cos(ang)*r;
      tz=player.pos.z+Math.sin(ang)*r;
    } else {
      tx=(Math.random()*2-1)*(ARENA_W-1.5);
      tz=(Math.random()*2-1)*(ARENA_H-1.5);
    }
    spawnMeteorStormStrike(tx,tz);
  }
}
function spawnMeteorStormStrike(x,z){
  const r=METEOR_STORM_RADIUS;
  const dmg=METEOR_STORM_BASE_DMG+Math.floor(waveNum*1.0);
  // Reuse the existing meteor VFX + telegraph; the warning circle is the
  // dodge cue. Shorter telegraph than the spell because there are many.
  spawnSkyMeteorVfx(x,z,r,0xff5577,METEOR_STORM_TELEGRAPH);
  sMeteorFall();
  spawnWarningCircle(x,z,r,0xff5577,METEOR_STORM_TELEGRAPH,()=>{
    spawnShockwave(x,z,r,0xff5577,0.26,0.78);
    burst({x,z},0xff5577,isMobile?6:14);
    burst({x,z},0xffaa55,isMobile?3:6);
    shakeAmt=Math.max(shakeAmt,0.12);
    sExplosion();
    // Damage the LOCAL player only — each client runs its own meteor drops.
    if(player && !player.dead && Math.hypot(player.pos.x-x,player.pos.z-z)<=r){
      hurtPlayer(dmg);
    }
  }, false);
}

function isWaveEventRewarded(){
  if(!waveEvent) return false;
  if(waveEvent.type==='loot') return true;
  // crystal / mutation / doublePick apply their reward live — crystal ×2 drops,
  // mutation 5-card offer, doublePick lets you keep 2 of the wave-clear offering's
  // 3 cards (handled in _continuePickChain). None need a post-clear bonus card.
  if(waveEvent.type==='crystal' || waveEvent.type==='mutation') return false;
  // Challenge events — clearing the wave is the win condition. Player picks
  // relic OR card via showChallengeReward (handled in claimWaveEventReward).
  if(waveEvent.type==='challenge') return true;
  // mini → reward unless explicitly failed (reactor died). Clearing the wave
  // counts as success even if defend timer / survive timer didn't fully run
  // out — players who killed every enemy fast still earned the reward.
  if(waveEvent.type==='mini') return !waveEvent.failed;
  if(waveEvent.type==='bounty') return !waveEvent.failed;
  return false;
}
// Challenge events grant a relic-OR-card chooser instead of just a card.
// Set when wave clears with the challenge intact; afterBuffSelect drains it
// after the normal wave-clear pick by showing showChallengeRewardChoice.
let _challengeRewardPending=false;
// Cursed Shrine — scheduled after waves 6, 16, 26, ... and drained by afterBuffSelect.
let _cursedShrinePending=false;
// Wave Totem — one random between-wave world offer. If any player accepts it,
// _pendingTotemMod becomes the next wave's team-wide modifier.
let _waveTotemOfferPending=false;
let _pendingTotemMod=null;
let _activeTotemMod=null;
let _waveTotemOfferId=null;
let _waveTotemAccepted=false;
const WAVE_TOTEM_OFFERS = [
  { id:'doubleTrouble', name:'DOUBLE TROUBLE', icon:'💀', desc:'Next wave: enemy count ×2.\nReward: bonus skill card.',           color:'#ff66cc' },
  { id:'haste',         name:'HASTE',          icon:'💨', desc:'Next wave: enemies move 1.5× faster.\nReward: crystals ×2.',       color:'#66ddff' },
  { id:'ironSkin',      name:'IRON SKIN',      icon:'🛡️', desc:'Next wave: enemy HP ×1.5.\nReward: gold drops ×1.5.',              color:'#aaccff' },
  { id:'sharpClaws',    name:'SHARP CLAWS',    icon:'🗡️', desc:'Next wave: enemy damage ×1.5.\nReward: bonus skill card.',         color:'#ff5577' },
  { id:'promotion',     name:'PROMOTION',      icon:'⭐', desc:'Next wave: half the enemies become elite.\nReward: bonus skill card.', color:'#ffd700' },
  { id:'megaSwarm',     name:'MEGA SWARM',     icon:'🌀', desc:'Next wave: enemy count ×3, HP ×0.6.\nReward: crystals ×3.',        color:'#aa66ff' },
  { id:'skip',          name:'SKIP',           icon:'✋', desc:'Walk past the totem. Nothing changes.',                            color:'#888888' },
];
function waveTotemOfferById(id){
  return WAVE_TOTEM_OFFERS.find(o=>o.id===id) || null;
}
function randomWaveTotemOfferId(){
  const pool=WAVE_TOTEM_OFFERS.filter(o=>o.id!=='skip');
  return pool[Math.floor(Math.random()*pool.length)]?.id || null;
}
function shouldOpenCursedShrineAfterWave(w){
  return w>=6 && (w-6)%10===0;
}
function resetWaveTotemOffer(){
  _waveTotemOfferPending=false;
  _waveTotemOfferId=null;
  _waveTotemAccepted=false;
  setWaveTotemWorldVisible(false);
}
function rollWaveTotemAfterClear(){
  if(!mp.soloMode&&!mp.isHost) return;
  resetWaveTotemOffer();
  // Skip only when the totem can't meaningfully apply to the next wave
  // (next is shop / boss) or when a competing menu is already queued
  // (cursed shrine). Wave events used to be a hard block too, which dropped
  // the effective appearance rate from 30% to ~9% — the player rarely saw
  // a totem in practice. Letting them coexist with wave events restores
  // the spec'd 30% feel.
  if(shouldOpenRunShopAfterWave() || ((waveNum+1)%5===0) || shouldOpenCursedShrineAfterWave(waveNum)) return;
  if(Math.random()>=0.30) return;
  _waveTotemOfferId=randomWaveTotemOfferId();
  _waveTotemOfferPending=!!_waveTotemOfferId;
  _waveTotemAccepted=false;
  setWaveTotemWorldVisible(_waveTotemOfferPending&&gState==='playing'&&waveClear);
  if(_waveTotemOfferPending){
    const opt=waveTotemOfferById(_waveTotemOfferId);
    if(opt) annText('WAVE TOTEM APPEARS - '+opt.name,opt.color);
    broadcastWaveTotemState();
  }
}
function waveTotemSnapshot(){
  return {id:_waveTotemOfferId,pending:_waveTotemOfferPending,accepted:_waveTotemAccepted,active:_activeTotemMod};
}
function applyWaveTotemSnapshot(s){
  const wasPending=_waveTotemOfferPending;
  _waveTotemOfferId=s?.id||null;
  _waveTotemOfferPending=!!s?.pending;
  _waveTotemAccepted=!!s?.accepted;
  _activeTotemMod=s&&Object.prototype.hasOwnProperty.call(s,'active') ? (s.active||null) : null;
  setWaveTotemWorldVisible(_waveTotemOfferPending&&gState==='playing'&&waveClear);
  if(!wasPending&&_waveTotemOfferPending){
    const opt=waveTotemOfferById(_waveTotemOfferId);
    if(opt) annText('WAVE TOTEM APPEARS - '+opt.name,opt.color);
  }
}
function broadcastWaveTotemState(){
  if(!mp.isHost||mp.soloMode) return;
  broadcastMP({type:'WAVE_TOTEM_STATE',state:waveTotemSnapshot()});
}
function claimWaveEventReward(){
  if(!waveEvent || waveEvent._claimed) return;
  // Mutation/crystal apply their reward during the wave (5-card offer, x2 drops)
  // and need no post-clear bonus pick. Loot/mini/bounty give a bonus card pick,
  // challenge grants a relic-or-card choice.
  if(isWaveEventRewarded()){
    if(waveEvent.type==='challenge'){
      _challengeRewardPending=true;
    } else if(waveEvent.type==='bounty' && waveEvent.sub==='noDamage'){
      _eventEpicReward=true; // hardest bounty (no damage taken) -> guaranteed EPIC skill card
    } else {
      _eventBonusPicksLeft+=1;
    }
    waveEvent._claimed=true;
    // Mark the defend/survive mini-objective as complete so the docked panel
    // flips to "COMPLETE" rather than staying on "ACTIVE" after wave clear.
    if(waveEvent.type==='mini' && miniObjective && !miniObjective.complete && miniObjective.type!=='clear'){
      miniObjective.complete=true;
    }
  }
}
// 2-card chooser shown after the normal wave-clear pick when a challenge
// wave was beaten. Picking RELIC opens a single relic offer; picking CARD
// queues one bonus skill pick that runs through afterBuffSelect again.
function showChallengeRewardChoice(){
  _buffSelectPhase='challenge';
  gState='buffselect';
  const el=document.getElementById('buffSelect');
  const title=document.getElementById('buffTitle');
  const sub=document.getElementById('buffSubtitle');
  const cards=document.getElementById('buffCards');
  if(!el||!cards){ _challengeRewardPending=false; afterBuffSelect(); return; }
  el.style.display='flex';
  cards.classList.remove('choosing-card');
  cards.innerHTML='';
  if(title) title.textContent='★ CHALLENGE CLEARED';
  if(sub) sub.textContent='PICK YOUR REWARD';
  const opts=[
    {id:'relic', name:'RELIC',      icon:'🔮', desc:'Pick from 3 unowned relics',  color:'#ff3344'},
    {id:'card',  name:'SKILL CARD', icon:'🃏', desc:'Roll a fresh 3-card offer',    color:'#66ddff'},
  ];
  opts.forEach((opt,i)=>{
    const card=document.createElement('div');
    card.className='buff-card boss-buff-card';
    card.style.setProperty('--cat-color',opt.color);
    card.style.animationDelay=`${i*70}ms, ${340+i*70}ms`;
    card.innerHTML=`
      <div class="buff-card-cat">CHALLENGE - REWARD</div>
      ${cardIconHtml(opt.id,opt.icon)}
      <div class="buff-card-name">${opt.name}</div>
      <div class="buff-card-desc">${hl(opt.desc)}</div>`;
    card.addEventListener('click',()=>pickCardWithFx(card,()=>{
      _challengeRewardPending=false;
      cards.innerHTML='';
      if(opt.id==='relic') showChallengeRelicPick();
      else {
        // Route through the same _eventBonusPicksLeft + skill flow used by
        // the other +1-card events.
        _eventBonusPicksLeft+=1;
        _currentOffering=[];
        _offeringPicked.clear();
        _skillPickContext='challenge';
        afterBuffSelect();
      }
    }));
    cards.appendChild(card);
  });
}
function showChallengeRelicPick(){
  _buffSelectPhase='challenge_relic';
  gState='buffselect';
  const el=document.getElementById('buffSelect');
  const title=document.getElementById('buffTitle');
  const sub=document.getElementById('buffSubtitle');
  const cards=document.getElementById('buffCards');
  if(!el||!cards){ afterBuffSelect(); return; }
  el.style.display='flex';
  cards.classList.remove('choosing-card');
  cards.innerHTML='';
  const choices=(typeof getRelicChoices==='function') ? getRelicChoices(3) : [];
  if(!choices.length){
    // No relics left to roll — fall back to a free card.
    _eventBonusPicksLeft+=1;
    _currentOffering=[];
    _offeringPicked.clear();
    _skillPickContext='challenge';
    afterBuffSelect();
    return;
  }
  if(title) title.textContent='★ CHALLENGE RELIC';
  if(sub) sub.textContent='CHOOSE A RELIC';
  choices.forEach((id,i)=>{
    const def=RELIC_DEFS[id];
    const cat=def.cursed?'CURSED RELIC':'RELIC - CHALLENGE';
    const card=document.createElement('div');
    card.className='buff-card boss-buff-card';
    card.style.setProperty('--cat-color','#ff3344');
    card.style.animationDelay=`${i*70}ms, ${340+i*70}ms`;
    card.innerHTML=`
      <div class="buff-card-cat">${cat}</div>
      ${cardIconHtml(id,def.icon)}
      <div class="buff-card-name">${relicDisplayName(id)}</div>
      <div class="buff-card-desc">${hl(relicNextDesc(id))}</div>`;
    card.addEventListener('click',()=>pickCardWithFx(card,()=>{
      applyRelic(id);
      annText(relicDisplayName(id),'#ff3344');
      updateHUD();
      if(typeof updateSkillHUD==='function') updateSkillHUD();
      el.style.display='none';
      afterBuffSelect();
    }));
    cards.appendChild(card);
  });
}
// ── Cursed Shrine ──────────────────────────────────────────
// Cursed Shrine menu shown after scheduled curse waves. Player picks one of:
// free common card, or 25/50/75% HP-cap tribute for uncommon/rare/epic card.
// HP penalties are temporary and the bar shows a grey
// strikethrough section of the lost cap until the timer expires.
const SHRINE_OFFERS=[
  { id:'walk',      name:'WALK AWAY',  icon:'🚶',  desc:'Nothing happens. The shrine fades.', color:'#888888',  cost:0,    waves:0, rarity:null },
  { id:'tribute',   name:'TRIBUTE',    icon:'🪙',  desc:'No cost. Receive a random COMMON skill card.', color:'#9fb7c8', cost:0,    waves:0, rarity:'common' },
  { id:'sacrifice', name:'SACRIFICE',  icon:'🩸',  desc:'-25% MAX HP for 3 waves. Receive an UNCOMMON skill card.', color:'#44ff88', cost:0.25, waves:3, rarity:'uncommon' },
  { id:'bargain',   name:'BARGAIN',    icon:'⚖️', desc:'-50% MAX HP for 5 waves. Receive a RARE skill card.',     color:'#44aaff', cost:0.50, waves:5, rarity:'rare' },
  { id:'pact',      name:'PACT',       icon:'🔥',  desc:'-75% MAX HP for 5 waves. Receive an EPIC skill card.',    color:'#cc66ff', cost:0.75, waves:5, rarity:'epic' },
  { id:'curse',     name:'TAKE A CURSE',icon:'☠️', desc:'Gain a random CURSED relic. No other reward.',           color:'#ff5577', cost:0,    waves:0, rarity:'cursed' },
];
const SHRINE_ICON_KEYS={
  tribute:'healDrop',
  sacrifice:'vampire',
  bargain:'heavyCrown',
  pact:'bloodContract',
};
function shrineSkillAvailable(rarity){
  return Object.keys(SKILL_DEFS).some(id=>skillEligible(id)&&skillRarity(id)===rarity&&skillPickLevel(id)<skillMaxLevel(id));
}
function showCursedShrine(){
  _buffSelectPhase='shrine';
  gState='buffselect';
  const el=document.getElementById('buffSelect');
  const title=document.getElementById('buffTitle');
  const sub=document.getElementById('buffSubtitle');
  const cards=document.getElementById('buffCards');
  if(!el||!cards){ _cursedShrinePending=false; afterBuffSelect(); return; }
  el.style.display='flex';
  cards.classList.remove('choosing-card');
  cards.innerHTML='';
  if(title) title.textContent='💀 CURSED SHRINE';
  if(sub) sub.textContent='THE SHRINE WHISPERS — CHOOSE YOUR OFFER';
  const offers=SHRINE_OFFERS.filter(opt=>opt.id!=='walk'&&opt.id!=='curse');
  if(!offers.some(opt=>shrineSkillAvailable(opt.rarity))){
    _cursedShrinePending=false;el.style.display='none';afterBuffSelect();return;
  }
  offers.forEach((opt,i)=>{
    const available=shrineSkillAvailable(opt.rarity);
    const card=document.createElement('div');
    card.className='buff-card boss-buff-card';
    card.style.setProperty('--cat-color',opt.color);
    card.style.animationDelay=`${i*70}ms, ${340+i*70}ms`;
    card.innerHTML=`
      <div class="buff-card-cat">CURSED SHRINE</div>
      ${cardIconHtml(opt.id,opt.icon,'buff-card-icon',{iconKey:SHRINE_ICON_KEYS[opt.id]})}
      <div class="buff-card-name">${opt.name}</div>
      <div class="buff-card-desc">${available?hl(opt.desc):'ALL SKILLS OF THIS RARITY ARE MAXED'}</div>`;
    if(!available){card.setAttribute('aria-disabled','true');card.style.opacity='0.45';card.style.cursor='not-allowed';}
    card.addEventListener('click',()=>{if(!available)return;pickCardWithFx(card,()=>{
      _cursedShrinePending=false;
      cards.innerHTML='';
      processCursedShrineChoice(opt);
    });});
    cards.appendChild(card);
  });
}
function processCursedShrineChoice(opt){
  if(opt.rarity&&opt.rarity!=='cursed'&&!shrineSkillAvailable(opt.rarity)){
    showCursedShrine();return;
  }
  // HP-cap tribute first so the green/grey rebalance happens before any
  // healing UI later in the chain.
  if(opt.cost>0 && opt.waves>0){
    applyCurseHp(opt.cost, opt.waves);
    annText('CURSE ACCEPTED','#ff5577');
  }
  if(opt.rarity==='cursed'){
    showShrineCursedRelicPick();
    return;
  }
  if(opt.rarity){
    showShrineCardPick(opt.rarity);
    return;
  }
  // Walk Away
  document.getElementById('buffSelect').style.display='none';
  afterBuffSelect();
}
function showShrineCardPick(rarity, titleText, subText){
  _buffSelectPhase='shrineCard';
  gState='buffselect';
  const el=document.getElementById('buffSelect');
  const title=document.getElementById('buffTitle');
  const sub=document.getElementById('buffSubtitle');
  const cards=document.getElementById('buffCards');
  if(!el||!cards){ afterBuffSelect(); return; }
  el.style.display='flex';
  cards.classList.remove('choosing-card');
  cards.innerHTML='';
  const choices=(typeof weightedSkillPick==='function')?weightedSkillPick(3,{onlyRarity:rarity}):[];
  if(!choices.length){ el.style.display='none'; afterBuffSelect(); return; }
  if(title) title.textContent=titleText || '💀 SHRINE OFFERING';
  if(sub)   sub.textContent=subText || `CHOOSE A ${rarity.toUpperCase()} SKILL`;
  const info=RARITY_INFO[rarity]||RARITY_INFO.common;
  choices.forEach((id,i)=>{
    const def=SKILL_DEFS[id];
    const cur=skillPickLevel(id), next=cur+1;
    const catInfo=SKILL_CAT_INFO[SKILL_CATEGORY[id]]||{label:'GENERAL',color:'#888888'};
    const card=document.createElement('div');
    card.className='buff-card boss-buff-card';
    card.style.setProperty('--cat-color', info.color||catInfo.color);
    card.style.animationDelay=`${i*70}ms, ${340+i*70}ms`;
    card.innerHTML=`
      <div class="buff-card-cat">${info.label} - ${catInfo.label}</div>
      ${cardIconHtml(id,def.icon)}
      <div class="buff-card-name">${def.name}</div>
      <div class="buff-card-desc">${hl(skillDesc(id,next))}</div>
      ${levelDotsHtml(cur,next,skillMaxLevel(id))}`;
    card.addEventListener('click',()=>pickCardWithFx(card,()=>{
      applySkill(id);
      el.style.display='none';
      afterBuffSelect();
    }));
    cards.appendChild(card);
  });
}
function showShrineCursedRelicPick(){
  _buffSelectPhase='shrineCurse';
  gState='buffselect';
  const el=document.getElementById('buffSelect');
  const title=document.getElementById('buffTitle');
  const sub=document.getElementById('buffSubtitle');
  const cards=document.getElementById('buffCards');
  if(!el||!cards){ afterBuffSelect(); return; }
  el.style.display='flex';
  cards.classList.remove('choosing-card');
  cards.innerHTML='';
  const choices=getCursedRelicChoices(3);
  if(!choices.length){ el.style.display='none'; afterBuffSelect(); return; }
  if(title) title.textContent='💀 CURSED OFFERING';
  if(sub)   sub.textContent='CHOOSE A CURSED RELIC';
  choices.forEach((id,i)=>{
    const def=RELIC_DEFS[id];
    const card=document.createElement('div');
    card.className='buff-card boss-buff-card';
    card.style.setProperty('--cat-color','#ff5577');
    card.style.animationDelay=`${i*70}ms, ${340+i*70}ms`;
    card.innerHTML=`
      <div class="buff-card-cat">CURSED RELIC</div>
      ${cardIconHtml(id,def.icon)}
      <div class="buff-card-name">${relicDisplayName(id)}</div>
      <div class="buff-card-desc">${hl(relicNextDesc(id))}</div>`;
    card.addEventListener('click',()=>pickCardWithFx(card,()=>{
      applyRelic(id);
      annText(relicDisplayName(id),'#ff5577');
      updateHUD();
      if(typeof updateSkillHUD==='function') updateSkillHUD();
      el.style.display='none';
      afterBuffSelect();
    }));
    cards.appendChild(card);
  });
}

// ── Wave Totem ─────────────────────────────────────────────
// Between-wave menu. ~30% chance after a normal wave clear when the next
// wave is also normal. Picks a stacking risk/reward modifier for the next
// wave. Reward delivered after that wave clears.
function showWaveTotemOffer(){
  _buffSelectPhase='totem';
  gState='buffselect';
  const el=document.getElementById('buffSelect');
  const title=document.getElementById('buffTitle');
  const sub=document.getElementById('buffSubtitle');
  const cards=document.getElementById('buffCards');
  if(!el||!cards){ _waveTotemOfferPending=false; afterBuffSelect(); return; }
  el.style.display='flex';
  cards.classList.remove('choosing-card');
  cards.innerHTML='';
  if(title) title.textContent='🗿 WAVE TOTEM';
  if(sub)   sub.textContent='ACCEPT A TRIAL — STRONGER WAVE, BIGGER PAYOFF';
  WAVE_TOTEM_OFFERS.forEach((opt,i)=>{
    const card=document.createElement('div');
    card.className='buff-card boss-buff-card';
    card.style.setProperty('--cat-color',opt.color);
    card.style.animationDelay=`${i*70}ms, ${340+i*70}ms`;
    card.innerHTML=`
      <div class="buff-card-cat">WAVE TOTEM</div>
      ${cardIconHtml(opt.id,opt.icon)}
      <div class="buff-card-name">${opt.name}</div>
      <div class="buff-card-desc" style="white-space:pre-line">${opt.desc}</div>`;
    card.addEventListener('click',()=>pickCardWithFx(card,()=>{
      _waveTotemOfferPending=false;
      _pendingTotemMod = (opt.id==='skip') ? null : opt.id;
      if(_pendingTotemMod) annText('TOTEM ACCEPTED — '+opt.name,opt.color);
      el.style.display='none';
      afterBuffSelect();
    }));
    cards.appendChild(card);
  });
}
// Effect helpers for the active modifier.
function totemEnemySpdMult(){
  if(_activeTotemMod==='haste') return 1.5;
  return 1;
}
function totemEnemyHpMult(){
  if(_activeTotemMod==='ironSkin') return 1.5;
  if(_activeTotemMod==='megaSwarm') return 0.6;
  return 1;
}
function totemEnemyDmgMult(){
  if(_activeTotemMod==='sharpClaws') return 1.5;
  return 1;
}
function totemSpawnCountMult(){
  if(_activeTotemMod==='doubleTrouble') return 2;
  if(_activeTotemMod==='megaSwarm') return 3;
  return 1;
}
function totemCrystalMult(){
  if(_activeTotemMod==='haste') return 2;
  if(_activeTotemMod==='megaSwarm') return 3;
  return 1;
}
function totemGoldMult(){
  if(_activeTotemMod==='ironSkin') return 1.5;
  return 1;
}
function totemForcedElite(){
  // Returns true 50% of the time for spawn-time elite override on Promotion.
  return _activeTotemMod==='promotion' && Math.random()<0.50;
}
function deliverTotemReward(){
  if(!_activeTotemMod) return;
  // Per-modifier reward. Some are during-wave (crystal/gold mult — already
  // applied through totemCrystalMult / totemGoldMult), some grant a bonus
  // card pick at clear time. Card-pick mods route through the existing
  // _eventBonusPicksLeft chain so the user sees a familiar "bonus pick"
  // flow with a totem-flavoured title.
  if(_activeTotemMod==='doubleTrouble' || _activeTotemMod==='sharpClaws' || _activeTotemMod==='promotion'){
    _eventBonusPicksLeft += 1;
    _skillPickContext = 'mini'; // reuse "OBJECTIVE REWARD" title flavour
  }
  annText('TOTEM TRIAL CLEARED','#ffd700');
  _activeTotemMod=null;
}

function resetWaveEventTracking(){
  _waveEventDamageTaken=0;
  _waveEventDeathLocal=false;
  // Stagger first meteor by 2–3s so the wave intro can play out before the
  // sky starts falling.
  _meteorStormCd=0.18+Math.random()*0.18;
}

function spawnWave(w){
  // Mini-objective is now opt-in via the wave-event roll. Only set it up when
  // the wave was tagged as a 'mini' event (host-decided, synced via HOST_STATE).
  if(waveEvent && waveEvent.type==='mini'){
    setupMiniObjective(w, waveEvent.sub || 'spawners');
  } else {
    disposeMiniObjective();
  }
  // Pre-set timer to the interval so the first batch fires on the very next
  // tickWaveSpawnQueue call — the wave intro (delay before spawnWave runs)
  // is the only grace period now; we don't need additional spawn-queue lag.
  _waveSpawnQueue=[]; _waveSpawnTimer=WAVE_SPAWN_INTERVAL;
  if(w%5===0){
    const uses=Math.max(0,Math.min(SHOP_TOTEM_MAX_USES,shopTotemUses|0));
    const bossCount=Math.pow(2,uses);
    const bossMult=Math.pow(1.2,uses);
    for(let bi=0;bi<bossCount;bi++) spawnBoss(w,bi,bossCount,bossMult);
    waveEnemyTotal=bossCount;
    // Bank one bonus boss-reward pick per totem click. Captured BEFORE the
    // reset below — once shopTotemUses is back to 0, this is the only
    // record of how many times the totem fired during the last shop.
    bossBonusPicksLeft=SHOP_TOTEM_BONUS_CARDS[uses]||0;
    bossBonusRelicsLeft=SHOP_TOTEM_BONUS_RELICS[uses]||0;
    shopTotemUses=0; shopTotemBreakChance=0.5; shopTotemDestroyed=false;
    if(!mp.soloMode&&mp.isHost) broadcastShopTotemState();
    waveSpawned=true;
    return;
  }
  getWaveConfig(w).forEach(([type,n])=>{
    const spawnN=scaledEnemyCount(type,n,w);
    for(let i=0;i<spawnN;i++){
      const p=randomSpawnPoint();
      _waveSpawnQueue.push({type,sx:p.x,sz:p.z});
    }
  });
  waveEnemyTotal=_waveSpawnQueue.length;
  waveSpawned=_waveSpawnQueue.length===0;
}

// ── Navigation – flow-field pathfinding ───────────────────
// Pre-baked blocked grid (obstacle-expanded by agent radius) +
// multi-source Dijkstra outward from all live player positions.
// Every NAV_FREQ seconds the flow field is rebuilt; each passable
// cell stores a unit-vector pointing toward the nearest player via
// the shortest obstacle-free path.  Enemies read their cell and
// follow the gradient — they never get stuck.

const NAV_STEP    = 0.5;
const GNAV_W      = Math.ceil(ARENA_W*2/NAV_STEP); // 36 columns
const GNAV_H      = Math.ceil(ARENA_H*2/NAV_STEP); // 64 rows
const NAV_AGENT_R = 0.90;  // baked clearance for regular enemies; local steering handles larger bosses
const NAV_FREQ    = 0.25;  // flow-field rebuild interval (s)

const _navBlk  = new Uint8Array(GNAV_W*GNAV_H);
const _navFX   = new Float32Array(GNAV_W*GNAV_H);
const _navFZ   = new Float32Array(GNAV_W*GNAV_H);
const _navDst  = new Float32Array(GNAV_W*GNAV_H);
let   navTimer = 0;

const _ND = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
const _NC = [1.414,1,1.414,1,1,1.414,1,1.414];

function _ni(gx,gz){ return gz*GNAV_W+gx; }
function _wc(x,z){
  return {
    gx: Math.max(0,Math.min(GNAV_W-1,(x+ARENA_W)/NAV_STEP|0)),
    gz: Math.max(0,Math.min(GNAV_H-1,(z+ARENA_H)/NAV_STEP|0))
  };
}

function _navCanStep(gx,gz,dx,dz){
  const ngx=gx+dx, ngz=gz+dz;
  if(ngx<0||ngx>=GNAV_W||ngz<0||ngz>=GNAV_H) return false;
  if(_navBlk[_ni(ngx,ngz)]) return false;
  if(dx&&dz&&(_navBlk[_ni(gx+dx,gz)]||_navBlk[_ni(gx,gz+dz)])) return false;
  return true;
}

function nearestWalkableNavIndex(x,z,maxR=8){
  const {gx,gz}=_wc(x,z);
  let best=-1,bestD=1e9;
  for(let r=0;r<=maxR;r++){
    for(let dz=-r;dz<=r;dz++){
      for(let dx=-r;dx<=r;dx++){
        if(Math.abs(dx)!==r&&Math.abs(dz)!==r) continue;
        const nx=gx+dx,nz=gz+dz;
        if(nx<0||nx>=GNAV_W||nz<0||nz>=GNAV_H) continue;
        const idx=_ni(nx,nz);
        if(_navBlk[idx]) continue;
        const wx=-ARENA_W+(nx+0.5)*NAV_STEP;
        const wz=-ARENA_H+(nz+0.5)*NAV_STEP;
        const d=(wx-x)*(wx-x)+(wz-z)*(wz-z);
        if(d<bestD){bestD=d;best=idx;}
      }
    }
    if(best!==-1) return best;
  }
  return -1;
}

function buildNavBlocked(){
  for(let gz=0;gz<GNAV_H;gz++){
    for(let gx=0;gx<GNAV_W;gx++){
      const wx=-ARENA_W+(gx+0.5)*NAV_STEP;
      const wz=-ARENA_H+(gz+0.5)*NAV_STEP;
      let b=Math.abs(wx)>ARENA_W-NAV_AGENT_R||Math.abs(wz)>ARENA_H-NAV_AGENT_R;
      if(!b) for(const o of obstacleBoxes){
        if(boxOverlap(wx,wz,NAV_AGENT_R,o.x,o.z,o.hw,o.hd)){b=true;break;}
      }
      _navBlk[_ni(gx,gz)]=b?1:0;
    }
  }
}

function buildFlowField(sources){
  _navDst.fill(1e9);
  _navFX.fill(0); _navFZ.fill(0);
  // Min-heap Dijkstra from all source cells simultaneously
  const H=[];
  const hPush=(c,i)=>{
    H.push([c,i]); let k=H.length-1;
    while(k>0){const p=(k-1)>>1;if(H[p][0]>H[k][0]){const t=H[p];H[p]=H[k];H[k]=t;k=p;}else break;}
  };
  const hPop=()=>{
    const top=H[0]; const last=H.pop();
    if(H.length){H[0]=last;let k=0;for(;;){let s=k,l=(k<<1)+1,r=l+1;if(l<H.length&&H[l][0]<H[s][0])s=l;if(r<H.length&&H[r][0]<H[s][0])s=r;if(s===k)break;const t=H[s];H[s]=H[k];H[k]=t;k=s;}}
    return top;
  };
  for(const src of sources){
    const idx=nearestWalkableNavIndex(src.x,src.z);
    if(idx!==-1&&_navDst[idx]>0){_navDst[idx]=0;hPush(0,idx);}
  }
  while(H.length){
    const [cost,cur]=hPop();
    if(cost>_navDst[cur]) continue;
    const cgx=cur%GNAV_W, cgz=cur/GNAV_W|0;
    for(let di=0;di<8;di++){
      const sx=_ND[di][0], sz=_ND[di][1];
      if(!_navCanStep(cgx,cgz,sx,sz)) continue;
      const ni=_ni(cgx+sx,cgz+sz);
      const nc=cost+_NC[di];
      if(nc<_navDst[ni]){_navDst[ni]=nc;hPush(nc,ni);}
    }
  }
  // Build flow vectors: each cell points toward the lowest-dist neighbour
  for(let gz=0;gz<GNAV_H;gz++){
    for(let gx=0;gx<GNAV_W;gx++){
      const idx=_ni(gx,gz); if(_navBlk[idx]||_navDst[idx]>=1e9) continue;
      let best=_navDst[idx],bx=0,bz=0;
      for(let di=0;di<8;di++){
        const sx=_ND[di][0],sz=_ND[di][1];
        if(!_navCanStep(gx,gz,sx,sz)) continue;
        const ni=_ni(gx+sx,gz+sz);
        if(_navDst[ni]<best){best=_navDst[ni];bx=sx;bz=sz;}
      }
      const l=Math.hypot(bx,bz)||1; _navFX[idx]=bx/l; _navFZ[idx]=bz/l;
    }
  }
}

function getNavFlow(x,z){
  const {gx,gz}=_wc(x,z); const idx=_ni(gx,gz);
  if(_navDst[idx]>=1e9) return {fx:0,fz:0,ok:false};
  return {fx:_navFX[idx],fz:_navFZ[idx],ok:true};
}

// Robust nav lookup: large enemies (tank/bomber) can be pushed by resolveObst into
// a nav-blocked cell. Instead of returning ok:false (which causes dumb direct movement),
// scan the 5×5 neighbourhood for the passable cell closest to the player and steer toward it.
function getNavFlowRobust(x,z){
  const {gx,gz}=_wc(x,z);
  const idx=_ni(gx,gz);
  if(_navDst[idx]<1e9) return {fx:_navFX[idx],fz:_navFZ[idx],ok:true};
  // Current cell blocked — find nearest reachable neighbour
  let best=1e9,tx=x,tz=z;
  for(let dgx=-2;dgx<=2;dgx++){
    for(let dgz=-2;dgz<=2;dgz++){
      const ngx=gx+dgx, ngz=gz+dgz;
      if(ngx<0||ngx>=GNAV_W||ngz<0||ngz>=GNAV_H) continue;
      const ni=_ni(ngx,ngz);
      if(!_navBlk[ni]&&_navDst[ni]<best){
        best=_navDst[ni];
        tx=-ARENA_W+(ngx+0.5)*NAV_STEP;
        tz=-ARENA_H+(ngz+0.5)*NAV_STEP;
      }
    }
  }
  if(best===1e9) return {fx:0,fz:0,ok:false};
  const ddx=tx-x, ddz=tz-z, dl=Math.hypot(ddx,ddz);
  if(dl<0.001) return getNavFlow(tx,tz);
  return {fx:ddx/dl,fz:ddz/dl,ok:true};
}

// ── Collision ─────────────────────────────────────────────
const { boxOverlap, isBlockedAt, rayBoxHitDistance, rayBoxHitInfo, firstObstacleHitDistance, rayArenaHitInfo, firstSolidHitInfo, reflectedRaySegments, lineBlockedByObstacle, projectToNearestOpen, wallAvoidVector, canMoveAlong, steerScore, openSteer, chooseDetourDirection, clamp, resolveObst } = createCollisionSystem({
  arenaWidth: ARENA_W, arenaHeight: ARENA_H, obstacleBoxes,
});

// ── Bullet pool ───────────────────────────────────────────
const bGeoP = new THREE.BoxGeometry(0.065,0.065,0.68); // elongated along Z, oriented on fire — pistol default
const bMatP = new THREE.MeshBasicMaterial({color:0x00ffff,transparent:true,opacity:0.96,blending:THREE.AdditiveBlending});
const bGeoE = new THREE.SphereGeometry(0.26,8,6); // bigger, rounder orb so enemy fire is easy to spot
const bMatE = new THREE.MeshBasicMaterial({color:0xff4422}); // solid (no additive) so it stays opaque over bright backgrounds instead of washing out
// Per-gun bullet visuals. fireBullet picks the right pair via player.gun
// (own shots) or the explicit `bulletStyle` arg (relayed remote shots).
//   PISTOL  — long cyan tracer (the legacy bullet look).
//   SMG     — shorter, thinner amber dart so the high-RPM stream reads as
//             "smaller cheaper rounds" instead of a wall of pistol bolts.
//   SHOTGUN — small red-orange pellets; spherical so the 12-shot fan
//             reads as buckshot, not "12 darts."
const BULLET_STYLES = {
  pistol:  { geo: bGeoP, mat: bMatP, color:0x00ffff },
  ak47:    { geo: new THREE.BoxGeometry(0.06,0.06,0.64),
             mat: new THREE.MeshBasicMaterial({color:0xff5555,transparent:true,opacity:0.96,blending:THREE.AdditiveBlending}), color:0xff5555 },
  burst:   { geo: new THREE.BoxGeometry(0.055,0.055,0.58),
             mat: new THREE.MeshBasicMaterial({color:0x9cff66,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending}), color:0x9cff66 },
  grenade: { geo: new THREE.SphereGeometry(0.32,10,8),
             mat: new THREE.MeshBasicMaterial({color:0xffb84d,transparent:true,opacity:0.96,blending:THREE.AdditiveBlending}), color:0xffb84d },
  smg:     { geo: new THREE.BoxGeometry(0.05,0.05,0.46),
             mat: new THREE.MeshBasicMaterial({color:0xffcc44,transparent:true,opacity:0.94,blending:THREE.AdditiveBlending}), color:0xffcc44 },
  shotgun: { geo: new THREE.SphereGeometry(0.13,6,5),
             mat: new THREE.MeshBasicMaterial({color:0xff7733,transparent:true,opacity:0.96,blending:THREE.AdditiveBlending}), color:0xff7733 },
  sniper:  { geo: new THREE.BoxGeometry(0.045,0.045,1.24),
             mat: new THREE.MeshBasicMaterial({color:0xb8f7ff,transparent:true,opacity:0.98,blending:THREE.AdditiveBlending}), color:0xb8f7ff },
  rpg:     { geo: new THREE.ConeGeometry(0.30,1.10,12),
             mat: new THREE.MeshBasicMaterial({color:0xff3355,transparent:true,opacity:0.96,blending:THREE.AdditiveBlending}), color:0xff3355 },
  minigun: { geo: new THREE.BoxGeometry(0.042,0.042,0.42),
             mat: new THREE.MeshBasicMaterial({color:0xffee66,transparent:true,opacity:0.92,blending:THREE.AdditiveBlending}), color:0xffee66 },
  boomerang:{geo: new THREE.TorusGeometry(0.38,0.06,6,22,Math.PI*1.55),
             mat: new THREE.MeshBasicMaterial({color:0x66ffcc,transparent:true,opacity:0.96,blending:THREE.AdditiveBlending}), color:0x66ffcc },
  gravity:{geo:new THREE.SphereGeometry(0.36,12,8),
           mat:new THREE.MeshBasicMaterial({color:0xb87aff}),blackMat:new THREE.MeshBasicMaterial({color:0x08000f}),color:0xb87aff},
  flamethrower:{ geo: new THREE.SphereGeometry(0.11,6,5),
             mat: new THREE.MeshBasicMaterial({color:0xff7a22,transparent:true,opacity:0.82,blending:THREE.AdditiveBlending}), color:0xff7a22 },
  laser:   { geo: new THREE.BoxGeometry(0.04,0.04,0.76),
             mat: new THREE.MeshBasicMaterial({color:0x44f7ff,transparent:true,opacity:0.96,blending:THREE.AdditiveBlending}), color:0x44f7ff },
};

function makeRocketGeometry(){
  const g=new THREE.Group();
  const bodyMat=new THREE.MeshBasicMaterial({color:0xff3355,transparent:true,opacity:0.96,blending:THREE.AdditiveBlending});
  const headMat=new THREE.MeshBasicMaterial({color:0xfff0aa,transparent:true,opacity:0.98,blending:THREE.AdditiveBlending});
  const finMat=new THREE.MeshBasicMaterial({color:0xff8833,transparent:true,opacity:0.90,blending:THREE.AdditiveBlending});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.20,0.86,12),bodyMat);
  const head=new THREE.Mesh(new THREE.ConeGeometry(0.20,0.42,12),headMat);
  const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.18,0.20,10),finMat);
  body.rotation.x=Math.PI/2;
  head.rotation.x=Math.PI/2; head.position.z=0.62;
  tail.rotation.x=Math.PI/2; tail.position.z=-0.54;
  for(const a of [0,Math.PI*0.5,Math.PI,Math.PI*1.5]){
    const fin=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.20,0.22),finMat);
    fin.position.set(Math.cos(a)*0.18,Math.sin(a)*0.18,-0.48);
    fin.rotation.z=a;
    g.add(fin);
  }
  g.add(body,head,tail);
  g.traverse(o=>{ if(o.material){ o.material.depthWrite=false; } });
  return g;
}

const bulletPool = [];
const PIERCE_DMG_LOSS_PER_HIT = 0.12;
const PIERCE_DMG_LOSS_CAP = 0.40;
function pierceFalloffMult(hitIndex){
  return 1-Math.min(PIERCE_DMG_LOSS_CAP, Math.max(0,hitIndex||0)*PIERCE_DMG_LOSS_PER_HIT);
}
for(let i = 0; i < BULLET_POOL_SIZE; i++){
  const isP  = i < BULLET_POOL_SIZE*0.7;
  const mesh = new THREE.Group();
  const body = new THREE.Mesh(isP?bGeoP:bGeoE, isP?bMatP:bMatE);
  mesh.add(body);
  mesh.visible = false; mesh.frustumCulled = false; scene.add(mesh);
  bulletPool.push({ mesh, active:false, isPlayer:isP,
    pos:new THREE.Vector3(), dir:new THREE.Vector3(), spd:0, life:0, dmg:0, pierce:0, bounceLeft:0,
    netId:null, visualOnly:false, ownerPerm:null, ownerId:null, visualColor:isP?0x00ffff:0xff6600,
    body, rocket:null, trail:null, bulletKind:'bullet', hitR:0.22, explodeR:0, explodeMult:0, boomerang:false, returning:false,
    grenadeY:0.55, grenadeVY:0, groundBounceLeft:0, grenadeGroundT:0, grenadeArmed:false,
    originX:0, originZ:0, maxRange:0, travelDist:0, hitSet:null, pierceHits:0, delay:0,
    // Distance-falloff fields. fallOrigin{x,z} captures where the bullet was
    // fired; falloffStart / falloffEnd / falloffMin define a linear curve
    // applied at hit time. null falloffStart = no falloff (e.g. pistol/SMG).
    fallOX:0, fallOZ:0, falloffStart:0, falloffEnd:0, falloffMin:1 });
}

let enemyBulletNetSeq = 1;

function fireBullet(pos, dir, isPlayer, dmg, pierce=0, visualOnly=false, ownerPerm=null, ownerId=mp.myId, bulletStyle=null, bulletOpts=null){
  let slot = null;
  for(let i = 0; i < bulletPool.length; i++){
    const b = bulletPool[i];
    if(!b.active && b.isPlayer===isPlayer){ slot=b; break; }
  }
  if(!slot){
    for(let i = 0; i < bulletPool.length; i++){
      if(!bulletPool[i].active){ slot=bulletPool[i]; break; }
    }
  }
  if(!slot) return;
  if(isPlayer&&!ownerPerm){
    ownerPerm=localAttackModifiers();
  }
  slot.active=true; slot.isPlayer=isPlayer;
  if(slot.gravityRing) slot.gravityRing.visible=false;
  slot.visualOnly=visualOnly;
  slot.netId=(!isPlayer&&mp.connected&&mp.isHost&&!mp.soloMode) ? enemyBulletNetSeq++ : null;
  let gunCfg=null;
  if(isPlayer){
    // Style selection: explicit arg wins (used when host receives a
    // relayed FIRE message that names the remote's gun); otherwise fall
    // back to the LOCAL player's gun (this player's own shots), and to
    // 'pistol' if nothing else fits — keeps remote bullets from blanking
    // out when they arrive before the gun-ready broadcast has set
    // remotePlayers[id].gun.
    const styleKey = bulletStyle || (!visualOnly && player ? player.gun : null) || 'pistol';
    const style = BULLET_STYLES[styleKey] || BULLET_STYLES.pistol;
    gunCfg = GUNS[styleKey] || null;
    if(slot.rocket) slot.rocket.visible=false;
    slot.body.visible=true;
    slot.body.material = style.mat;
    slot.body.geometry = style.geo;
    slot.visualColor = style.color || 0x00ffff;
  } else {
    if(slot.rocket) slot.rocket.visible=false;
    slot.body.visible=true;
    slot.body.material = bMatE;
    slot.body.geometry = bGeoE;
    slot.visualColor = 0xff6600;
  }
  slot.pos.set(pos.x,0,pos.z);
  slot.mesh.position.set(pos.x,0.55,pos.z);
  slot.dir.copy(dir).normalize();
  if(isPlayer){
    slot.mesh.rotation.y=Math.atan2(slot.dir.x,slot.dir.z);
    slot.mesh.scale.setScalar(HEAVY_SCALE[playerSkills.heavyRounds||0]);
  } else {
    slot.mesh.rotation.set(0,0,0);
    slot.mesh.scale.setScalar(1);
  }
  slot.spd=isPlayer?BULLET_SPD:ENEMY_BULLET_SPD; slot.life=isPlayer?2.2:2.9; slot.dmg=dmg; slot.pierce=pierce; slot.ownerPerm=ownerPerm; slot.ownerId=isPlayer?ownerId:null;
  slot.pistolShot=null; slot.pistolRicochet=0; slot.judgmentCharge=false;
  slot.shotgunSalvo=isPlayer&&gunCfg?.id==='shotgun'&&typeof bulletOpts?.shotgunSalvo==='string'&&!visualOnly&&(mp.soloMode||mp.isHost)?shotgunSalvos.acquire(ownerId,bulletOpts.shotgunSalvo):null;
  slot.burstSalvo=isPlayer&&gunCfg?.id==='burst'&&typeof bulletOpts?.burstSalvo==='string'&&!visualOnly&&(mp.soloMode||mp.isHost)?burstSalvos.acquire(ownerId,bulletOpts.burstSalvo):null;
  slot.burstIndex=bulletOpts?.burstIndex;
  slot.triadCharging=!!(slot.burstSalvo&&ownerPerm?.burstAscension&&!bulletOpts?.triad);
  slot.ruptureCharging=!!(slot.shotgunSalvo&&ownerPerm?.shotgunAscension&&!bulletOpts?.rupture);
  slot.bounceLeft=isPlayer ? BOUNCE_MAX[ownerPerm?.bounce ?? (playerSkills.bounce||0)] : 0;
  slot.mesh.rotation.x=0;
  slot.bulletKind='bullet'; slot.hitR=0.22; slot.explodeR=0; slot.explodeMult=0; slot.boomerang=false; slot.returning=false; slot.pierceHits=0;
  // Reset per-shot enemy-ally pierce flags so a recycled bullet doesn't leak
  // a previous sniper round's piercing.
  slot.piercesAllies=false;
  if(slot._summonHitSet) slot._summonHitSet.clear();
  slot.grenadeQuick=!!bulletOpts?.grenadeQuick;
  slot.supernova=!!(ownerPerm?.grenadeAscension&&bulletOpts?.supernova);
  slot.supernovaCharging=!!(ownerPerm?.grenadeAscension&&bulletOpts?.grenadePrimary&&!slot.supernova);
  slot.grenadeY=0.55; slot.grenadeVY=0; slot.groundBounceLeft=0; slot.grenadeGroundT=0; slot.grenadeArmed=false;
  slot.originX=pos.x; slot.originZ=pos.z; slot.maxRange=0; slot.travelDist=0; if(slot.hitSet) slot.hitSet.clear(); else slot.hitSet=new Set();
  slot.delay=Math.max(0,Number(bulletOpts?.delay)||0);
  if(isPlayer&&gunCfg){
    if(gunCfg.id==='pistol'&&bulletOpts?.pistolShot){
      slot.judgmentCharge=!!(ownerPerm?.pistolAscension&&bulletOpts.pistolPrimary&&!bulletOpts.pistolJudgment&&!visualOnly&&(mp.soloMode||mp.isHost));
      slot.pistolRicochet=Math.max(0,Math.min(4,ownerPerm?.pistolRicochet||0));
      slot.bounceLeft+=slot.pistolRicochet;
      if(bulletOpts?.pistolShot){
        const precisionLevel=Math.max(0,Math.min(3,ownerPerm?.pistolPrecision||0));
        slot.dmg*=pistolPrecision.multiplier(ownerId,precisionLevel);
        if(bulletOpts.pistolPrimary&&precisionLevel&&!visualOnly&&(mp.soloMode||mp.isHost))slot.pistolShot=pistolPrecision.begin(ownerId);
        if(bulletOpts.pistolLast){
          const bonus=lastWordBonus(Math.max(0,Math.min(3,ownerPerm?.pistolLastWord||0)));
          slot.dmg*=bonus.damage;slot.pierce+=bonus.pierce;
          if(bonus.pierce){slot.body.material=BULLET_STYLES.sniper.mat;slot.visualColor=0xffdd66;slot.mesh.scale.multiplyScalar(1.35);}
        }
        if(ownerPerm?.pistolAscension&&bulletOpts.pistolJudgment){
          slot.dmg*=2;slot.pierce+=3;
          slot.body.material=BULLET_STYLES.sniper.mat;slot.visualColor=0xe8baff;
          slot.mesh.scale.multiplyScalar(1.5);
        }
        slot.dmg=Math.max(1,Math.round(slot.dmg));
      }
    }
    slot.spd=gunCfg.bulletSpeed||BULLET_SPD;
    slot.life=gunCfg.life||2.2;
    slot.hitR=gunCfg.hitR||0.22;
    if(gunCfg.pierceBase) slot.pierce=Math.max(slot.pierce,gunCfg.pierceBase);
    if(gunCfg.explodeR){ slot.explodeR=gunCfg.explodeR; slot.explodeMult=gunCfg.explodeMult||0.65; }
    // Bullet range — every gun now declares a max travel distance. Long Shot
    // skill (BULLET_RANGE_MULT) scales it. Grenade/boomerang already use
    // maxRange for their own arc/return logic, so we don't overwrite those.
    if(gunCfg.range && !gunCfg.kind){
      const rangeMul=(typeof BULLET_RANGE_MULT!=='undefined' && isPlayer)
        ? (BULLET_RANGE_MULT[playerSkills.longShot||0]||1) : 1;
      slot.maxRange = gunCfg.range * rangeMul;
    }
    if(gunCfg.kind==='boomerang'){
      slot.bulletKind='boomerang'; slot.boomerang=true; slot.maxRange=gunCfg.range||8;
      slot.bounceLeft=0; slot.mesh.rotation.x=Math.PI/2;
    }
    if(gunCfg.kind==='gravity'){
      slot.bulletKind='gravity'; slot.bounceLeft=0;
      for(let i=0;i<8&&isBlockedAt(slot.pos.x,slot.pos.z,slot.hitR);i++){
        slot.pos.x-=slot.dir.x*0.15;slot.pos.z-=slot.dir.z*0.15;
      }
      slot.maxRange=gunCfg.range*(BULLET_RANGE_MULT[ownerPerm?.longShot??playerSkills.longShot??0]||1);
      if(Number.isFinite(bulletOpts?.gravityTravel))slot.maxRange=Math.max(0,Math.min(slot.maxRange,bulletOpts.gravityTravel));
      slot.life=Math.max(slot.life,slot.maxRange/slot.spd+0.65);
      const gp=ownerPerm||{};
      const charge=gp.gravityDivine?Math.max(0,Math.min(1,Number(bulletOpts?.gravityCharge)||0)):0;
      slot.gravityGlobal=charge>=1;
      slot.gravityTravelling=slot.gravityGlobal;
      slot.gravityRadius=gunCfg.pullRadius*(1+.2*Math.max(0,Math.min(4,gp.gravityRadius||0)))*(1+1.5*charge);
      slot.gravityCollapse=Math.max(0,Math.min(3,gp.gravityCollapse||0));
      slot.life+=.6*Math.max(0,Math.min(3,gp.gravityPersistence||0));
      slot.dmg*=slot.gravityGlobal?10:1+3*charge;
      slot.explodeR*=1+1.5*charge;
      if(slot.gravityGlobal){
        slot.body.material=BULLET_STYLES.gravity.blackMat;
        // The global field activates only after the projectile reaches arena center.
        slot.gravityRadius=Math.hypot(ARENA_W*2,ARENA_H*2)+2;slot.explodeR=slot.gravityRadius;
        slot.life=5+.6*Math.max(0,Math.min(3,gp.gravityPersistence||0));slot.spd=18;
      }
      slot.mesh.scale.multiplyScalar(slot.gravityGlobal?3:1+charge);
      if(!slot.gravityRing){
        slot.gravityRing=new THREE.Mesh(new THREE.RingGeometry(0.97,1,48),new THREE.MeshBasicMaterial({color:gunCfg.color,transparent:true,opacity:0.48,side:THREE.DoubleSide,depthWrite:false}));
        slot.gravityRing.rotation.x=-Math.PI/2;scene.add(slot.gravityRing);
      }
      slot.gravityRing.scale.setScalar(slot.gravityGlobal?6:slot.gravityRadius);
      slot.gravityRing.position.set(pos.x,0.08,pos.z);slot.gravityRing.visible=slot.delay<=0;
    }
    if(gunCfg.id==='rpg'){
      slot.bulletKind='rocket';
      // RPG range is enforced via maxRange (above was overwritten because
      // gunCfg.kind is undefined for rpg). Apply the long-shot multiplier
      // explicitly here so rockets respect the skill too.
      const _rpgRangeMul=(typeof BULLET_RANGE_MULT!=='undefined' && isPlayer)
        ? (BULLET_RANGE_MULT[playerSkills.longShot||0]||1) : 1;
      slot.maxRange = (gunCfg.range || 14) * _rpgRangeMul;
      if(!slot.rocket){ slot.rocket=makeRocketGeometry(); slot.mesh.add(slot.rocket); }
      slot.body.visible=false;
      slot.rocket.visible=true;
      slot.mesh.rotation.x=0;
    }
    if(gunCfg.kind==='grenade'){
      const skillBounce=slot.bounceLeft||0;
      slot.bulletKind='grenade';
      slot.explodeR*=grenadeRadius(ownerPerm?.grenadeRadius)*(slot.supernova?1.5:1);
      if(slot.supernova){slot.visualColor=0xffe4aa;slot.body.material=BULLET_STYLES.sniper.mat;}
      slot.bounceLeft=2;
      slot.groundBounceLeft=skillBounce;
      slot.maxRange=Math.max(1.4,Math.min(gunCfg.range||8.8,Number(bulletOpts?.grenadeTravel)||gunCfg.range||8.8));
      slot.travelDist=0;
      slot.grenadeY=0.74;
      slot.grenadeVY=5.8;
      slot.mesh.position.y=slot.grenadeY;
      slot.mesh.scale.setScalar(HEAVY_SCALE[playerSkills.heavyRounds||0]*1.35);
      slot.mesh.rotation.x=Math.PI/2;
    }
  }
  // Set falloff here so local and remote pellets use the same range rules.
  slot.fallOX=pos.x; slot.fallOZ=pos.z;
  slot.falloffStart=gunCfg?.falloffStart||0; slot.falloffEnd=gunCfg?.falloffEnd||0; slot.falloffMin=gunCfg?.falloffMin??1;
  slot.mesh.visible=slot.delay<=0;
  if(isPlayer&&!visualOnly&&!isMobile&&slot.delay<=0) flashLight(pos,slot.visualColor||0x00ffff,2.8,4.5,0.08);
  return slot;
}
function releaseBullet(slot){
  if(slot.active)pistolPrecision.finish(slot.pistolShot,false);
  burstSalvos.release(slot.burstSalvo);slot.burstSalvo=null;slot.burstIndex=null;slot.triadCharging=false;
  shotgunSalvos.release(slot.shotgunSalvo);slot.shotgunSalvo=null;slot.ruptureCharging=false;
  slot.pistolShot=null;slot.pistolRicochet=0;slot.judgmentCharge=false;
  if(slot.gravityRing) slot.gravityRing.visible=false;
  slot.active=false; slot.mesh.visible=false; slot.mesh.scale.setScalar(1);
  slot.netId=null; slot.visualOnly=false; slot.ownerPerm=null; slot.ownerId=null;
  slot.visualColor=slot.isPlayer?0x00ffff:0xff6600;
  if(slot.rocket) slot.rocket.visible=false;
  if(slot.body) slot.body.visible=true;
  if(slot.trail) clearTrail(slot.trail); // reset the enemy-bullet trail so a reused slot doesn't draw a streak from its old path
  slot.bulletKind='bullet'; slot.hitR=0.22; slot.explodeR=0; slot.explodeMult=0;
  slot.grenadeY=0.55; slot.grenadeVY=0; slot.groundBounceLeft=0; slot.grenadeGroundT=0; slot.grenadeArmed=false;
  slot.boomerang=false; slot.returning=false; slot.originX=0; slot.originZ=0; slot.maxRange=0; slot.travelDist=0; slot.pierceHits=0; slot.delay=0;
  slot.fallOX=0; slot.fallOZ=0; slot.falloffStart=0; slot.falloffEnd=0; slot.falloffMin=1;
  if(slot.hitSet) slot.hitSet.clear();
}

function aimPistolRicochet(b,nx,nz){
  if(!b.pistolRicochet)return;
  let target=null,best=14;
  for(const e of enemies){
    if(e.dead||b.hitSet?.has(e))continue;
    const dx=e.pos.x-b.pos.x,dz=e.pos.z-b.pos.z,d=Math.hypot(dx,dz);
    if(d<.01||d>=best||dx*nx+dz*nz<=0||lineBlockedByObstacle(b.pos.x,b.pos.z,e.pos.x,e.pos.z,.12))continue;
    target=e;best=d;
  }
  if(target)b.dir.set(target.pos.x-b.pos.x,0,target.pos.z-b.pos.z).normalize();
  b.mesh.rotation.y=Math.atan2(b.dir.x,b.dir.z);
}

// Uses the same authoritative projectile path as other guns. Guest replicas
// only render the field; the host moves enemies and applies the explosion.
const activeGravityFields=[];
function gravityFieldForEnemy(e){
  let local=null;
  for(const b of activeGravityFields){
    const dx=b.pos.x-e.pos.x,dz=b.pos.z-e.pos.z,d=Math.hypot(dx,dz);
    if(d>b.gravityRadius)continue;
    if(b.gravityGlobal)return b;
    if(d>.001&&obstacleBoxes.some(o=>rayAabbT(e.pos.x,e.pos.z,dx/d,dz/d,o,.05)<d))continue;
    local=b;
  }
  return local;
}
function tickGravityBullet(b,dt){
  const cfg=GUNS.gravity;
  if(b.gravityGlobal){
    const distance=Math.hypot(b.pos.x,b.pos.z);
    const step=Math.min(distance,18*dt);
    if(distance>0){b.pos.x*=1-step/distance;b.pos.z*=1-step/distance;}
    b.mesh.position.set(b.pos.x,0.65,b.pos.z);
    b.mesh.rotation.y+=dt*3;
    if(b.gravityRing){b.gravityRing.visible=true;b.gravityRing.position.set(b.pos.x,.08,b.pos.z);}
    // Travel ignores walls and does not consume the field's active lifetime.
    if(distance>step)return;
    if(b.gravityTravelling){
      b.gravityTravelling=false;b.spd=0;
      spawnShockwave(0,0,Math.max(ARENA_W,ARENA_H)*2,0xe3baff,.8,.22);
    }
  }
  const distance=Math.min(b.spd*dt,Math.max(0,b.maxRange-b.travelDist));
  const steps=Math.max(1,Math.ceil(distance/0.15));
  for(let i=0;!b.gravityGlobal&&i<steps;i++){
    const x=b.pos.x+b.dir.x*distance/steps,z=b.pos.z+b.dir.z*distance/steps;
    if(Math.abs(x)>ARENA_W-b.hitR||Math.abs(z)>ARENA_H-b.hitR||isBlockedAt(x,z,b.hitR)){b.spd=0;break;}
    b.pos.x=x;b.pos.z=z;b.travelDist+=distance/steps;
  }
  b.mesh.position.set(b.pos.x,0.65+Math.sin(b.life*8)*0.12,b.pos.z);
  b.mesh.rotation.y+=dt*3;
  if(b.gravityRing){b.gravityRing.visible=true;b.gravityRing.position.set(b.pos.x,0.08,b.pos.z);}
  if(!b.visualOnly&&(mp.soloMode||mp.isHost)){
    for(const e of enemies){
      if(e.dead)continue;
      const dx=b.pos.x-e.pos.x,dz=b.pos.z-e.pos.z,d=Math.hypot(dx,dz);
      if(d<0.1||(d>(b.gravityRadius||cfg.pullRadius)&&e.gravitySource!==b))continue;
      // Partial charges respect walls; the divine global field pulls through them.
      if(!b.gravityGlobal&&obstacleBoxes.some(o=>rayAabbT(e.pos.x,e.pos.z,dx/d,dz/d,o,0.05)<d))continue;
      const speed=b.gravityGlobal?Math.hypot(ARENA_W,ARENA_H)/2:cfg.pullSpeed*(e.type==='boss'?cfg.bossPullMult:1);
      const step=Math.min(d,dt*speed);
      const x=e.pos.x+dx/d*step,z=e.pos.z+dz/d*step;
      if(Math.abs(x)>ARENA_W-e.cfg.r||Math.abs(z)>ARENA_H-e.cfg.r||(!b.gravityGlobal&&isBlockedAt(x,z,e.cfg.r)))continue;
      e.pos.x=x;e.pos.z=z;e.mesh.position.x=x;e.mesh.position.z=z;
    }
  }
  b.life-=dt;
  if(b.life<=0){
    if(!mp.soloMode&&!mp.isHost)b.visualOnly=true;
    if(b.gravityCollapse){
      const count=enemies.filter(e=>!e.dead&&Math.hypot(e.pos.x-b.pos.x,e.pos.z-b.pos.z)<=(b.gravityRadius||cfg.pullRadius)).length;
      b.dmg*=1+Math.min(5,count)*[0,.08,.12,.16][b.gravityCollapse];
    }
    explodePlayerBullet(b,cfg.color);releaseBullet(b);
  }
}

const GRAVITY_CHARGE_SECONDS=12;
let gravityChargeHud=null,gravityChargePreview=null;
function cancelGravityCharge(){player.gravityCharge=0;player.gravityChargeLatch=false;if(gravityChargePreview)gravityChargePreview.visible=false;}
function fireSpreadShots(gun,fx,fz,pdmg,pierceLvl,extra={}){
  const angles=[.22,.38,.52,.64,.74];
  for(let i=0;i<Math.min(5,playerSkills.spread||0);i++){
    const a=angles[i]*(i%2===0?1:-1),c=Math.cos(a),s=Math.sin(a);
    const dx=fx*c-fz*s,dz=fx*s+fz*c;
    const dmg=Math.max(1,Math.round(pdmg*.45));
    const opts=gun.kind==='gravity'?{gravityTravel:gravityAimTravel(gun,player.pos.x,player.pos.z),...extra}:gun.kind==='grenade'?{grenadeTravel:grenadeAimTravel(gun,player.pos.x,player.pos.z),...extra}:gun.id==='pistol'?{...extra,pistolPrimary:false}:gun.id==='shotgun'?extra:null;
    const b=fireBullet(player.pos,_scratchDir.set(dx,0,dz),true,dmg,pierceLvl,false,null,mp.myId,null,opts);
    if(b)sendFireMP(player.pos.x,player.pos.z,dx,dz,dmg,pierceLvl,opts);
  }
}
function updateGravityAscension(dt,wantFire,cooldownMult=1){
  const enabled=player.gun==='gravity'&&playerSkills.gravityAscension;
  if(!enabled||player.dead||gState!=='playing'||waveClear||waveTransition){cancelGravityCharge();return !!enabled;}
  if(player.gravityChargeLatch){if(!wantFire)player.gravityChargeLatch=false;return true;}
  if(player.gravityExhaustion>0){player.gravityCharge=0;return false;}
  if(player.reloadT>0||player.ammo<=0||player.fireCd>0){player.gravityCharge=0;return true;}
  if(wantFire)player.gravityCharge=Math.min(GRAVITY_CHARGE_SECONDS,player.gravityCharge+dt);
  const full=player.gravityCharge>=GRAVITY_CHARGE_SECONDS;
  if((full||!wantFire)&&player.gravityCharge>0){
    const charge=player.gravityCharge/GRAVITY_CHARGE_SECONDS,gun=GUNS.gravity,d=meleeAimDir();
    const x=player.pos.x+d.x*.95,z=player.pos.z+d.z*.95;
    const opts={gravityCharge:charge,gravityTravel:gravityAimTravel(gun,x,z)};
    const dmg=Math.max(1,Math.round(playerStats.attackDmg*BULLET_PWR_MULT[playerSkills.bulletPower||0]*crystalPowerMult()*gun.dmgMult));
    const b=fireBullet({x,z},_scratchDir.set(d.x,0,d.z),true,dmg,0,false,null,mp.myId,'gravity',opts);
    if(!b){cancelGravityCharge();return true;}
    fireSpreadShots(gun,d.x,d.z,dmg,0,{gravityCharge:charge});
    if(full)player.gravityExhaustion=10;
    if(!hasRelic('infiniteMag')){player.ammo--;if(player.ammo<=0){player.reloadDur=weaponReloadTime();player.reloadT=player.reloadDur;sReloadStart();}}
    player.fireCd=gun.fireCd*cooldownMult*(player.gravityExhaustion>0?1.5:1);
    sendFireMP(x,z,d.x,d.z,dmg,0,opts);noteWaveEventGunFire();playGunShootSfx('gravity');updateAmmoHud();
    player.gravityCharge=0;player.gravityChargeLatch=full&&wantFire;
  }
  return true;
}
let supernovaHud=null;
function updateSupernovaHud(){
  if(!supernovaHud){supernovaHud=document.createElement('div');supernovaHud.id='supernovaHud';document.body.appendChild(supernovaHud);}
  supernovaHud.style.display=gState==='playing'&&!player.dead&&player.gun==='grenade'&&playerSkills.grenadeAscension?'block':'none';
  supernovaHud.textContent=supernovaCharge.ready?'SUPERNOVA • READY • NEXT SHOT: DAMAGE ×3 • BLAST +50%':'SUPERNOVA • '+supernovaCharge.hits+' / 8 group explosions';
}
let triadHud=null;
function updateTriadHud(){
  if(!triadHud){triadHud=document.createElement('div');triadHud.id='triadHud';document.body.appendChild(triadHud);}
  triadHud.style.display=gState==='playing'&&!player.dead&&player.gun==='burst'&&playerSkills.burstAscension?'block':'none';
  triadHud.textContent=celestialTriad.ready?'CELESTIAL TRIAD • READY • NEXT BURST: DAMAGE ×3 • PIERCE +3':'CELESTIAL TRIAD • '+celestialTriad.hits+' / 6 complete bursts';
}
let steelStormHud=null;
function updateSteelStormHud(){
  if(!steelStormHud){steelStormHud=document.createElement('div');steelStormHud.id='steelStormHud';document.body.appendChild(steelStormHud);}
  steelStormHud.style.display=gState==='playing'&&!player.dead&&player.gun==='ak47'&&playerSkills.ak47Ascension?'block':'none';
  steelStormHud.textContent=steelStorm.rounds>0?'STEEL STORM • '+steelStorm.rounds+' empowered shots • DAMAGE ×2 • PIERCE +2':'STEEL STORM • '+steelStorm.charge+' / 40 shots • keep firing';
}
let ruptureHud=null;
function updateRuptureHud(){
  if(!ruptureHud){ruptureHud=document.createElement('div');ruptureHud.id='ruptureHud';document.body.appendChild(ruptureHud);}
  const active=gState==='playing'&&!player.dead&&player.gun==='shotgun'&&playerSkills.shotgunAscension;
  ruptureHud.style.display=active?'block':'none';
  ruptureHud.textContent=ruptureCharge.ready?'RUPTURE • READY — NEXT SHOT RELEASES SHOCKWAVE':'RUPTURE • '+ruptureCharge.hits+' / 8 close-range hits';
}
function fireRupture(x,z,dx,dz,dmg,ownerId,perm,visualOnly=false){
  if(![x,z,dx,dz,dmg].every(Number.isFinite))return;
  const length=Math.hypot(dx,dz);if(length<.001)return;dx/=length;dz/=length;
  if(spendVfxBudget('shockwaves')){
    const sw=_acquireShockwaveSlot();sw.active=true;sw.maxR=10;sw.t=0;sw.dur=.35;sw.opacity=.9;sw.spin=0;
    sw.mesh.geometry=_ruptureWaveGeo;sw.mesh.rotation.z=-Math.atan2(dz,dx);
    sw.mat.color.setHex(0xffcc88);sw.mat.opacity=.9;sw.mesh.position.set(x,.1,z);sw.mesh.scale.setScalar(1.2);sw.mesh.visible=true;shockwaves.push(sw);
  }
  if(!visualOnly){
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i];if(e.dead)continue;
      const ex=e.pos.x-x,ez=e.pos.z-z,d=Math.hypot(ex,ez);
      if(d>10+e.cfg.r||(ex*dx+ez*dz)/(d||1)<Math.cos(.6)||lineBlockedByObstacle(x,z,e.pos.x,e.pos.z,.1))continue;
      damageEnemyWithSource(i,dmg,0xffcc88,.4,ownerId,perm,'bullet');
    }
  }
}
function armRifleReload(){
  if(player.gun==='ak47'&&playerSkills.ak47Tactical&&!player.dead){
    ak47Rhythm.kill();dmgNum('RELOAD READY',player.pos,'#ffaa66');
  }
}
function startManualReload(){
  if(gState!=='playing'||nbPaused||!player||player.dead||player.reloadT>0)return;
  if(player.ammo>=currentMagSize()&&!(player.gun==='pistol'&&playerSkills.pistolAscension&&pistolJudgment.ready))return;
  player.reloadDur=weaponReloadTime();player.reloadT=player.reloadDur;player.ammo=0;sReloadStart();
}
function registerJudgmentHit(b){
  if(!b.judgmentCharge)return;
  b.judgmentCharge=false; // Piercing still counts as just one primary hit.
  if(b.ownerId===mp.myId)pistolJudgment.hit();
  else if(mp.isHost){
    const conn=mp.conns.get(b.ownerId);
    if(conn?.open)conn.send(JSON.stringify({type:'PISTOL_CHARGE',targetId:b.ownerId}));
  }
}
let pistolJudgmentHud=null;
function updatePistolJudgmentHud(){
  if(!pistolJudgmentHud){
    pistolJudgmentHud=document.createElement('button');pistolJudgmentHud.type='button';pistolJudgmentHud.id='pistolJudgmentHud';
    pistolJudgmentHud.addEventListener('click',()=>{if(pistolJudgment.ready)startManualReload();});
    document.body.appendChild(pistolJudgmentHud);
  }
  const active=gState==='playing'&&!player.dead&&player.gun==='pistol'&&playerSkills.pistolAscension;
  pistolJudgmentHud.style.display=active?'block':'none';
  pistolJudgmentHud.textContent=pistolJudgment.rounds>0?'NEON JUDGMENT • '+pistolJudgment.rounds+' empowered rounds • DAMAGE ×2 • PIERCE +3':pistolJudgment.ready?'NEON JUDGMENT • READY — RELOAD / TAP TO ASCEND':'NEON JUDGMENT • '+pistolJudgment.hits+' / 30 hits';
}
function updateGravityChargeHud(){
  if(!gravityChargeHud){gravityChargeHud=document.createElement('div');gravityChargeHud.id='gravityChargeHud';document.body.appendChild(gravityChargeHud);}
  const active=gState==='playing'&&!player.dead&&player.gun==='gravity'&&playerSkills.gravityAscension;
  if(!active)cancelGravityCharge();
  gravityChargeHud.style.display=active?'block':'none';
  const p=Math.min(1,player.gravityCharge/GRAVITY_CHARGE_SECONDS);
  gravityChargeHud.textContent=player.gravityExhaustion>0?'EXHAUSTION '+player.gravityExhaustion.toFixed(1)+'s • MOVE −35% • FIRE / RELOAD +50%':p>0?'DIVINE ASCENSION • '+player.gravityCharge.toFixed(1)+' / 12s • DAMAGE ×'+(1+3*p).toFixed(1)+' • RADIUS ×'+(1+1.5*p).toFixed(1):'DIVINE ASCENSION • Hold attack 12s for a global black hole';
  gravityChargeHud.style.setProperty('--charge',Math.round(p*100)+'%');
  if(active&&p>0){
    if(!gravityChargePreview){gravityChargePreview=new THREE.Mesh(new THREE.RingGeometry(.98,1,64),new THREE.MeshBasicMaterial({color:0xe3baff,transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false}));gravityChargePreview.rotation.x=-Math.PI/2;scene.add(gravityChargePreview);}
    const d=meleeAimDir(),travel=gravityAimTravel(GUNS.gravity,player.pos.x,player.pos.z);
    gravityChargePreview.position.set(player.pos.x+d.x*travel,.09,player.pos.z+d.z*travel);
    gravityChargePreview.scale.setScalar(GUNS.gravity.pullRadius*(1+.2*skillPickLevel('eventHorizon'))*(1+1.5*p));gravityChargePreview.visible=true;
  }else if(gravityChargePreview)gravityChargePreview.visible=false;
}

// ── Particles (pooled) ────────────────────────────────────
const PART_POOL = isMobile ? 60 : 110;
const partPool  = [];
// ── Trail helpers (ribbon mesh — additive, tapers head→tail) ─────────
const TRAIL_PTS=isMobile?14:20;
const TRAIL_MIN_DIST=0.09;
const TRAIL_HALF_W=0.24;
// Short motion trail on enemy bullets — telegraphs the line of fire so the
// player can read trajectory and dodge by reaction. Kept short + thin so dense
// boss patterns don't clutter the screen or cost much.
const ENEMY_BULLET_TRAIL_PTS=isMobile?5:8;
const ENEMY_BULLET_TRAIL_COL=0xff6633;
const ENEMY_BULLET_TRAIL_W=0.55;
function createTrail(color, renderOrder=0, alwaysOnTop=false, maxPts=TRAIL_PTS){
  // 3 verts per cross-section: left edge, center, right edge
  // This gives a cross-section gradient: edge=black, center=full color (glow core)
  const nv=maxPts*3;
  const buf=new Float32Array(nv*3);
  const colBuf=new Float32Array(nv*3);
  const idx=[];
  for(let i=0;i<maxPts-1;i++){
    const b=i*3;
    // left-center quad
    idx.push(b,b+1,b+3, b+1,b+4,b+3);
    // center-right quad
    idx.push(b+1,b+2,b+4, b+2,b+5,b+4);
  }
  const geo=new THREE.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute('position',new THREE.BufferAttribute(buf,3));
  geo.setAttribute('color',new THREE.BufferAttribute(colBuf,3));
  geo.setDrawRange(0,0);
  const mat=new THREE.MeshBasicMaterial({
    vertexColors:true,transparent:true,opacity:0.92,
    blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide
  });
  if(alwaysOnTop) mat.depthTest=false;
  const mesh=new THREE.Mesh(geo,mat);
  mesh.frustumCulled=false;
  if(renderOrder) mesh.renderOrder=renderOrder;
  scene.add(mesh);
  const r=(color>>16&0xff)/255,g=(color>>8&0xff)/255,b=(color&0xff)/255;
  return {mesh,geo,mat,buf,colBuf,r,g,b,hist:[],maxPts};
}
function updateTrail(tr,x,y,z){
  if(!tr) return;
  const now=performance.now()*0.001;
  if(tr.maxAge){
    const maxAge=tr.maxAge;
    while(tr.hist.length&&now-(tr.hist[tr.hist.length-1][3]||now)>maxAge) tr.hist.pop();
  }
  if(x!=null&&y!=null&&z!=null){
    const minDist=tr.minDist||TRAIL_MIN_DIST;
    if(!tr.hist.length||Math.hypot(x-tr.hist[0][0],y-tr.hist[0][1],z-tr.hist[0][2])>=minDist){
      tr.hist.unshift([x,y,z,now]);
      if(tr.hist.length>tr.maxPts) tr.hist.pop();
    }
  }
  const n=tr.hist.length;
  if(n<2){tr.geo.setDrawRange(0,0);return;}
  const widthScale=tr.widthScale||1;
  const bright=tr.brightnessScale||1;
  const edgeBright=tr.edgeBrightnessScale||0.35;
  const centerWhite=tr.centerWhite||0;
  for(let i=0;i<n;i++){
    const px=tr.hist[i][0],py=tr.hist[i][1],pz=tr.hist[i][2];
    let pdx,pdz;
    if(i<n-1){pdx=tr.hist[i][0]-tr.hist[i+1][0];pdz=tr.hist[i][2]-tr.hist[i+1][2];}
    else{pdx=tr.hist[i-1][0]-tr.hist[i][0];pdz=tr.hist[i-1][2]-tr.hist[i][2];}
    const pl=Math.hypot(pdx,pdz)||1; pdx/=pl; pdz/=pl;
    const nx=-pdz, nz=pdx;
    const t=i/Math.max(1,n-1);
    const ageFade=tr.maxAge?Math.max(0,1-(now-(tr.hist[i][3]||now))/tr.maxAge):1;
    const hw=TRAIL_HALF_W*widthScale*(1-t)*Math.pow(ageFade,0.55); // taper to 0 at tail
    const fade=Math.min(1.45,Math.pow(1-t,1.0)*Math.pow(ageFade,1.55)*bright);
    const vi=i*3;
    // left edge (dark)
    tr.buf[vi*3]=px-nx*hw;   tr.buf[vi*3+1]=py; tr.buf[vi*3+2]=pz-nz*hw;
    // center (bright)
    tr.buf[vi*3+3]=px;        tr.buf[vi*3+4]=py; tr.buf[vi*3+5]=pz;
    // right edge (dark)
    tr.buf[vi*3+6]=px+nx*hw;  tr.buf[vi*3+7]=py; tr.buf[vi*3+8]=pz+nz*hw;
    // edge color: dimmer
    const edgeFade=fade*edgeBright;
    const cr=Math.min(1,tr.r*fade+centerWhite*fade);
    const cg=Math.min(1,tr.g*fade+centerWhite*fade);
    const cb=Math.min(1,tr.b*fade+centerWhite*fade);
    tr.colBuf[vi*3  ]=tr.r*edgeFade; tr.colBuf[vi*3+1]=tr.g*edgeFade; tr.colBuf[vi*3+2]=tr.b*edgeFade;
    tr.colBuf[vi*3+3]=cr;            tr.colBuf[vi*3+4]=cg;            tr.colBuf[vi*3+5]=cb;
    tr.colBuf[vi*3+6]=tr.r*edgeFade; tr.colBuf[vi*3+7]=tr.g*edgeFade; tr.colBuf[vi*3+8]=tr.b*edgeFade;
  }
  tr.geo.attributes.position.needsUpdate=true;
  tr.geo.attributes.color.needsUpdate=true;
  tr.geo.setDrawRange(0,(n-1)*12);
}
function clearTrail(tr){
  if(!tr) return;
  tr.hist.length=0; tr.geo.setDrawRange(0,0);
}
function disposeTrail(tr){
  if(!tr) return;
  scene.remove(tr.mesh); tr.geo.dispose(); tr.mat.dispose();
}

function ensureMoveTrail(holder, id=mp.myId){
  if(!holder) return null;
  if(holder.moveTrail) return holder.moveTrail;
  const col=PLAYER_COLORS[(id||0)%MAX_PLAYERS]||PLAYER_COLORS[0];
  holder.moveTrail=createTrail(col.emi||0x44aaff, 84, false, isMobile?70:120);
  holder.moveTrail.mat.opacity=0.82;
  holder.moveTrail.maxAge=1.5;
  holder.moveTrail.minDist=0.075;
  holder.moveTrail.widthScale=0.68;
  holder.moveTrail.brightnessScale=1.45;
  holder.moveTrail.edgeBrightnessScale=0.32;
  holder.moveTrail.centerWhite=0.38;
  if(!holder.moveGlow) holder.moveGlow=createMoveGlow(col.emi||0x44aaff);
  holder.moveTrailIdle=0;
  holder.moveSparkT=0;
  return holder.moveTrail;
}
function createMoveGlow(color){
  const geo=new THREE.RingGeometry(0.34,0.78,34);
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.rotation.x=-Math.PI/2;
  mesh.position.y=0.055;
  mesh.renderOrder=90; // above the river ribbon ceiling (~86) so the move ring isn't hidden under water
  mesh.frustumCulled=false;
  scene.add(mesh);
  return mesh;
}
function spawnMoveSpark(x,z,dx,dz,col){
  if(isMobile||typeof getPartMat!=='function') return;
  const len=Math.hypot(dx,dz)||1;
  const nx=-dz/len, nz=dx/len;
  for(let i=0;i<partPool.length;i++){
    const p=partPool[i]; if(p.active) continue;
    const side=(Math.random()<0.5?-1:1)*(0.16+Math.random()*0.22);
    p.active=true; p.mesh.material=getPartMat(col);
    p.mesh.position.set(x-dx/len*0.34+nx*side,0.14,z-dz/len*0.34+nz*side);
    p.mesh.visible=true;
    p.vx=-dx/len*(0.7+Math.random()*1.1)+nx*side*1.6;
    p.vz=-dz/len*(0.7+Math.random()*1.1)+nz*side*1.6;
    p.vy=0.9+Math.random()*1.9;
    p.spinX=(Math.random()-0.5)*9; p.spinY=(Math.random()-0.5)*9;
    p.grow=0.08+Math.random()*0.15;
    p.life=p.maxLife=0.18+Math.random()*0.18;
    return;
  }
}
function updateMoveTrail(holder, id, x, z, moved, dt){
  if(!holder) return;
  updateFadingMoveTrails(holder);
  let tr=ensureMoveTrail(holder,id);
  if(!tr) return;
  const lastX=holder.moveTrailX??x;
  const lastZ=holder.moveTrailZ??z;
  const dx=x-lastX, dz=z-lastZ;
  const speed=dt>0?moved/dt:0;
  if(moved>0.025){
    if(holder.moveTrailIdle>0.12&&tr.hist.length>1){
      holder.moveTrailFades=holder.moveTrailFades||[];
      holder.moveTrailFades.unshift(tr);
      while(holder.moveTrailFades.length>3) disposeTrail(holder.moveTrailFades.pop());
      holder.moveTrail=null;
      tr=ensureMoveTrail(holder,id);
    }
    holder.moveTrailIdle=0;
    updateTrail(tr,x,0.135,z);
    holder.moveSparkT=(holder.moveSparkT||0)-dt;
    if(holder.moveSparkT<=0&&speed>2.6){
      holder.moveSparkT=0.07+Math.random()*0.035;
      const col=PLAYER_COLORS[(id||0)%MAX_PLAYERS]?.emi||0x44aaff;
      spawnMoveSpark(x,z,dx,dz,col);
    }
    if(holder.moveGlow){
      const pulse=Math.min(1,speed/8);
      holder.moveGlow.visible=true;
      holder.moveGlow.position.x=x; holder.moveGlow.position.z=z;
      holder.moveGlow.material.opacity=0.10+0.28*pulse;
      holder.moveGlow.scale.setScalar(0.82+0.34*pulse+Math.sin(performance.now()*0.014)*0.035);
    }
  } else {
    holder.moveTrailIdle=(holder.moveTrailIdle||0)+dt;
    updateTrail(tr,null,null,null);
    if(holder.moveGlow){
      holder.moveGlow.material.opacity=Math.max(0,holder.moveGlow.material.opacity-dt*2.8);
      if(holder.moveGlow.material.opacity<=0.01) holder.moveGlow.visible=false;
    }
  }
  holder.moveTrailX=x; holder.moveTrailZ=z;
}
function updateFadingMoveTrails(holder){
  if(!holder?.moveTrailFades?.length) return;
  for(let i=holder.moveTrailFades.length-1;i>=0;i--){
    const tr=holder.moveTrailFades[i];
    updateTrail(tr,null,null,null);
    if(tr.hist.length<2){
      disposeTrail(tr);
      holder.moveTrailFades.splice(i,1);
    }
  }
}
function disposeMoveTrail(holder){
  if(!holder) return;
  if(holder.moveTrail){
    disposeTrail(holder.moveTrail);
    holder.moveTrail=null;
  }
  if(holder.moveTrailFades?.length){
    holder.moveTrailFades.forEach(disposeTrail);
    holder.moveTrailFades.length=0;
  }
  if(holder.moveGlow){
    scene.remove(holder.moveGlow);
    holder.moveGlow.geometry.dispose();
    holder.moveGlow.material.dispose();
    holder.moveGlow=null;
  }
}
function clearMoveTrailVisual(holder){
  if(!holder) return;
  if(holder.moveTrail) clearTrail(holder.moveTrail);
  if(holder.moveTrailFades?.length) holder.moveTrailFades.forEach(clearTrail);
  if(holder.moveGlow){
    holder.moveGlow.material.opacity=0;
    holder.moveGlow.visible=false;
  }
}

// ── Spell projectile pool (energy balls for Nova, etc.) ──
const SPELL_POOL = 40;
const spellBalls = [];
const _spGeo = new THREE.SphereGeometry(0.28, 8, 6);
const _spAuraGeo = new THREE.SphereGeometry(0.46, 8, 6);
for(let i=0;i<SPELL_POOL;i++){
  const mat=new THREE.MeshBasicMaterial({color:0xcc33ff,transparent:true,opacity:0.96,blending:THREE.AdditiveBlending});
  const auraMat=new THREE.MeshBasicMaterial({color:0xff66ff,transparent:true,opacity:0.26,blending:THREE.AdditiveBlending,depthWrite:false});
  const mesh=new THREE.Mesh(_spGeo,mat);
  const aura=new THREE.Mesh(_spAuraGeo,auraMat);
  mesh.add(aura);
  mesh.visible=false; mesh.frustumCulled=false; scene.add(mesh);
  spellBalls.push({mesh,mat,auraMat,active:false,vx:0,vz:0,dmg:0,life:0,hitSet:null,trail:createTrail(0xcc33ff)});
}
function fireSpellBall(pos,dir,dmg,col=0xcc33ff,spd=5){
  for(let i=0;i<spellBalls.length;i++){
    const s=spellBalls[i]; if(s.active) continue;
    s.active=true; s.mesh.visible=true;
    clearTrail(s.trail);
    s.mat.color.setHex(col); s.auraMat.color.setHex(col); s.mesh.scale.setScalar(1);
    s.mesh.position.set(pos.x,0.6,pos.z);
    const len=Math.sqrt(dir.x*dir.x+dir.z*dir.z)||1;
    s.vx=dir.x/len*spd; s.vz=dir.z/len*spd;
    s.dmg=dmg; s.life=2.5; s.hitSet=new Set(); return;
  }
}
// ── Damage rings (Fire Ring spell) ───────────────────────
// Pooled like shockwaves: geometry is fixed, only color/opacity/scale vary, so
// we reuse mesh+material slots instead of building + disposing two rings per cast.
const damageRings = [];
const RING_SEGS = isMobile ? 28 : 40;
const _damageRingPool = [];
const _drGeo = new THREE.RingGeometry(0.78,1.0,RING_SEGS); // outer edge = maxR at scale=maxR
const _drGlowGeo = new THREE.RingGeometry(0.55,1.08,RING_SEGS);
function _makeDamageRingSlot(){
  const mat=new THREE.MeshBasicMaterial({color:0xff5500,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const mesh=new THREE.Mesh(_drGeo,mat); mesh.rotation.x=-Math.PI/2; mesh.visible=false; scene.add(mesh);
  const glowMat=new THREE.MeshBasicMaterial({color:0xff5500,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const glowMesh=new THREE.Mesh(_drGlowGeo,glowMat); glowMesh.rotation.x=-Math.PI/2; glowMesh.visible=false; scene.add(glowMesh);
  const slot={mesh,mat,glowMesh,glowMat,active:false,maxR:1,dmg:0,dur:1.2,t:0,prevR:0,hitSet:new Set(),spawnerHit:null};
  _damageRingPool.push(slot); return slot;
}
function _acquireDamageRingSlot(){ return _damageRingPool.find(s=>!s.active) || _makeDamageRingSlot(); }
function _releaseDamageRingSlot(dr){ dr.active=false; dr.mesh.visible=false; dr.glowMesh.visible=false; dr.mat.opacity=0; dr.glowMat.opacity=0; }
function spawnDamageRing(x,z,maxR,dmg,col=0xff5500,dur=1.2){
  const dr=_acquireDamageRingSlot();
  dr.active=true; dr.maxR=maxR; dr.dmg=dmg; dr.dur=dur; dr.t=0; dr.prevR=0;
  dr.hitSet.clear(); dr.spawnerHit=null;
  dr.mat.color.setHex(col); dr.mat.opacity=0.95;
  dr.glowMat.color.setHex(col); dr.glowMat.opacity=0.24;
  dr.mesh.scale.setScalar(0.001); dr.mesh.rotation.z=0; dr.mesh.position.set(x,0.06,z); dr.mesh.visible=true;
  dr.glowMesh.scale.setScalar(0.001); dr.glowMesh.rotation.z=0; dr.glowMesh.position.set(x,0.04,z); dr.glowMesh.visible=true;
  flashLight({x,z},col,4.8,8,0.25);
  damageRings.push(dr);
}
// ── Homing bombs ─────────────────────────────────────────
// Pooled: mesh, aura child, materials and trail are reused; only position /
// velocity / dmg reset per spawn. Mirrors the shockwave + damage-ring pools.
const homingBombs = [];
const _hbGeo = new THREE.SphereGeometry(0.18,6,5);
const _hbAuraGeo = new THREE.SphereGeometry(0.34,6,5);
const _homingBombPool = [];
function _makeHomingBombSlot(){
  const mat=new THREE.MeshBasicMaterial({color:0xff3300,transparent:true,opacity:0.98,blending:THREE.AdditiveBlending});
  const mesh=new THREE.Mesh(_hbGeo,mat);
  const auraMat=new THREE.MeshBasicMaterial({color:0xffaa00,transparent:true,opacity:0.22,blending:THREE.AdditiveBlending,depthWrite:false});
  const aura=new THREE.Mesh(_hbAuraGeo,auraMat);
  mesh.add(aura); mesh.frustumCulled=false; mesh.visible=false; scene.add(mesh);
  const slot={mesh,mat,aura,auraMat,active:false,pos:{x:0,z:0},dmg:0,explR:0,life:0,vx:0,vz:0,trail:createTrail(0xff3300)};
  _homingBombPool.push(slot); return slot;
}
function _acquireHomingBombSlot(){ return _homingBombPool.find(s=>!s.active) || _makeHomingBombSlot(); }
function _releaseHomingBombSlot(hb){ hb.active=false; hb.mesh.visible=false; clearTrail(hb.trail); }
function spawnHomingBomb(pos,dmg,explR){
  const hb=_acquireHomingBombSlot();
  hb.active=true; hb.dmg=dmg; hb.explR=explR; hb.life=5.0;
  hb.pos.x=pos.x; hb.pos.z=pos.z;
  hb.vx=(Math.random()-0.5)*2; hb.vz=(Math.random()-0.5)*2;
  hb.mesh.rotation.set(0,0,0); hb.mesh.position.set(pos.x,0.5,pos.z); hb.mesh.visible=true;
  clearTrail(hb.trail);
  homingBombs.push(hb);
}
// ── Shockwave rings (explosive rounds) ───────────────────
const shockwaves = [];
const _shockwavePool = [];
const _shockwaveGeo = new THREE.RingGeometry(0.05, 0.24, isMobile?20:32);
const _ruptureWaveGeo=new THREE.RingGeometry(.90,1,isMobile?24:48,1,-.6,1.2);
function _makeShockwaveSlot(){
  const mat = new THREE.MeshBasicMaterial({color:0xff8800,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const mesh = new THREE.Mesh(_shockwaveGeo, mat);
  mesh.rotation.x = -Math.PI/2;
  mesh.visible=false;
  mesh.frustumCulled=false;
  // River ribbons render at order 30 + rOrder*10 + round(y*1000), which can hit
  // ~86 on multi-band maps (e.g. map 2 with order:1 foam streaks at y=0.046).
  // Push ground VFX above that ceiling so they stay visible inside rivers.
  mesh.renderOrder=100;
  scene.add(mesh);
  const slot={mesh,mat,active:false,maxR:1,t:0,dur:0.3,opacity:0.9,spin:1};
  _shockwavePool.push(slot);
  return slot;
}
for(let i=0;i<(isMobile?36:72);i++) _makeShockwaveSlot();
function _acquireShockwaveSlot(){ return _shockwavePool.find(s=>!s.active) || _makeShockwaveSlot(); }
function _releaseShockwaveSlot(sw){ sw.active=false; sw.mesh.visible=false; sw.mat.opacity=0; }
function spawnShockwave(x, z, maxR, col=0xff8800, dur=0.30, opacity=0.9){
  if(!spendVfxBudget('shockwaves')) return null;
  const sw=_acquireShockwaveSlot();
  sw.mesh.geometry=_shockwaveGeo;
  sw.active=true; sw.maxR=maxR; sw.t=0; sw.dur=dur; sw.opacity=opacity;
  sw.spin=(Math.random()<0.5?-1:1)*(0.8+Math.random()*1.4);
  sw.mat.color.setHex(col); sw.mat.opacity=opacity;
  sw.mesh.position.set(x,0.06,z);
  sw.mesh.scale.setScalar(Math.max(0.001,maxR*0.12));
  sw.mesh.visible=true;
  shockwaves.push(sw);
  flashLight({x,z},col,Math.min(7,maxR*1.3),Math.max(4,maxR*1.7),Math.min(0.35,dur*1.2));
}

const warningZones = [];
const _warningCirclePool = [];
const _warningLinePool = [];
const _warningCircleGeo = new THREE.RingGeometry(0.82,1.0,isMobile?36:64);
const _warningLineGeo = new THREE.PlaneGeometry(1,1);
function relayWarning(msg){
  if(mp?.connected && mp.isHost && !mp.soloMode) broadcastMP(msg);
}
function _makeWarningSlot(kind){
  const mat=new THREE.MeshBasicMaterial({color:0xff3355,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const mesh=new THREE.Mesh(kind==='circle'?_warningCircleGeo:_warningLineGeo,mat);
  mesh.rotation.x=-Math.PI/2;
  mesh.visible=false;
  mesh.frustumCulled=false;
  mesh.renderOrder=100; // telegraph rings draw above the river/terrain hints
  scene.add(mesh);
  const slot={kind,mesh,mat,active:false,x:0,z:0,r:1,width:1,len:1,t:0,dur:0.75,opacity:0.72,onDone:null};
  (kind==='circle'?_warningCirclePool:_warningLinePool).push(slot);
  return slot;
}
for(let i=0;i<(isMobile?16:28);i++){ _makeWarningSlot('circle'); _makeWarningSlot('line'); }
function _acquireWarningSlot(kind){
  const pool=kind==='circle'?_warningCirclePool:_warningLinePool;
  return pool.find(w=>!w.active) || _makeWarningSlot(kind);
}
function _releaseWarningSlot(w){
  w.active=false;
  w.mesh.visible=false;
  w.mat.opacity=0;
  w.onDone=null;
}
function spawnWarningCircle(x,z,r,col=0xff3355,dur=0.75,onDone=null,relay=true){
  const w=_acquireWarningSlot('circle');
  Object.assign(w,{active:true,x,z,r,t:0,dur,opacity:0.72,onDone});
  w.mat.color.setHex(col); w.mat.opacity=0.72;
  w.mesh.position.set(x,0.075,z);
  w.mesh.rotation.set(-Math.PI/2,0,0);
  w.mesh.scale.setScalar(Math.max(0.001,r*0.72));
  w.mesh.visible=true;
  warningZones.push(w);
  if(relay) relayWarning({type:'WARN_CIRCLE',x:Math.round(x*100)/100,z:Math.round(z*100)/100,r:Math.round(r*100)/100,col,dur});
  return w.mesh;
}
function spawnWarningLine(x,z,ang,len,width=0.7,col=0xff3355,dur=0.65,onDone=null,relay=true){
  const w=_acquireWarningSlot('line');
  Object.assign(w,{active:true,x,z,width,len,t:0,dur,opacity:0.46,onDone});
  w.mat.color.setHex(col); w.mat.opacity=0.46;
  w.mesh.rotation.set(-Math.PI/2,0,ang);
  w.mesh.position.set(x+Math.sin(ang)*len*0.5,0.07,z+Math.cos(ang)*len*0.5);
  w.mesh.scale.set(width,len,1);
  w.mesh.visible=true;
  warningZones.push(w);
  if(relay) relayWarning({type:'WARN_LINE',x:Math.round(x*100)/100,z:Math.round(z*100)/100,ang,len,width,col,dur});
  return w.mesh;
}
function updateWarningZones(dt){
  for(let i=warningZones.length-1;i>=0;i--){
    const w=warningZones[i];
    w.t+=dt;
    const p=Math.min(1,w.t/w.dur);
    w.mat.opacity=w.opacity*(0.45+0.55*Math.sin(p*Math.PI*5)**2)*(1-p*0.25);
    if(w.kind==='circle') w.mesh.scale.setScalar(w.r*(0.72+p*0.32));
    else w.mesh.scale.x=w.width*(1+Math.sin(p*Math.PI*6)*0.12);
    if(w.t>=w.dur){
      const cb=w.onDone;
      _releaseWarningSlot(w);
      warningZones.splice(i,1);
      if(cb) cb();
    }
  }
}

const skillVfx = [];

function spawnSkillRingAura(x,z,r,col=0x66ffee,dur=0.48,opacity=0.55){
  if(!spendVfxBudget('rings')) return null;
  const geo=new THREE.RingGeometry(0.82,1.0,isMobile?28:44);
  const mat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.rotation.x=-Math.PI/2;
  mesh.position.set(x,0.085,z);
  mesh.frustumCulled=false;
  scene.add(mesh);
  skillVfx.push({kind:'ring',mesh,mat,x,z,r,t:0,dur,opacity,spin:(Math.random()<0.5?-1:1)*(1.2+Math.random()*1.6)});
  return mesh;
}

// Layered energy beam. Replaces the old single flat PlaneGeometry that read
// as "rectangle box". Three stacked layers stretched along the aim vector:
//   - outer halo  (wide, very low opacity, distant glow)
//   - body        (mid-width, additive-blend coloured core)
//   - hot core    (thin white-hot streak inside)
// Plus a "muzzle blast" at the origin and a "tip burst" at the far end so
// the beam has a clear start AND end emphasis. Each layer fades on its own
// curve in updateSkillVfx so the whole thing reads as a slim laser flash
// instead of a static prism.
function spawnSkillBeam(x,z,dx,dz,len,width,col=0x66eeff,dur=0.28,opacity=0.52){
  if(!spendVfxBudget('beams')) return null;
  const dl=Math.hypot(dx,dz)||1;
  dx/=dl; dz/=dl;
  const ang=-Math.atan2(dx,dz);
  const cx=x+dx*len*0.5, cz=z+dz*len*0.5;
  // Build a flat tube along the aim. CylinderGeometry's local +Y aligns
  // along the beam after rotation.x=-PI/2 + rotation.z=ang trick.
  const mkLayer=(w,h,c,op)=>{
    const g=new THREE.CylinderGeometry(w*0.5,w*0.5,len,isMobile?6:10,1,true);
    const m=new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:op,side:THREE.DoubleSide,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending});
    const mesh=new THREE.Mesh(g,m);
    // Lay the cylinder flat on the XZ plane, then rotate around vertical
    // axis (Y) so the long edge follows the aim vector.
    mesh.rotation.x=Math.PI/2;
    mesh.rotation.z=ang;
    mesh.position.set(cx,h,cz);
    mesh.renderOrder=112;
    mesh.frustumCulled=false;
    scene.add(mesh);
    return {mesh,mat:m};
  };
  const halo=mkLayer(width*1.65,0.095,col,opacity*0.42);
  const body=mkLayer(width*0.88,0.110,col,opacity);
  const core=mkLayer(width*0.32,0.125,0xffffff,Math.min(0.98,opacity*1.55));
  // Muzzle ring at the origin gives a clear "fired from here" punch.
  const muzzleG=new THREE.RingGeometry(width*0.20,width*0.95,isMobile?16:28);
  const muzzleM=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:opacity*1.25,side:THREE.DoubleSide,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending});
  const muzzle=new THREE.Mesh(muzzleG,muzzleM);
  muzzle.rotation.x=-Math.PI/2;
  muzzle.position.set(x,0.10,z);
  muzzle.frustumCulled=false; muzzle.renderOrder=113;
  scene.add(muzzle);
  // Tip burst at the far end signals where the beam ends.
  const tipG=new THREE.CircleGeometry(width*0.85,isMobile?14:22);
  const tipM=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:opacity*1.10,side:THREE.DoubleSide,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending});
  const tip=new THREE.Mesh(tipG,tipM);
  tip.rotation.x=-Math.PI/2;
  tip.position.set(x+dx*len,0.10,z+dz*len);
  tip.frustumCulled=false; tip.renderOrder=113;
  scene.add(tip);
  // Caps the existing skillVfx update loop knows about — we pack the new
  // multi-layer beam into a single skillVfx entry of kind 'beam'.
  skillVfx.push({kind:'beam',layers:[halo,body,core],muzzle:{mesh:muzzle,mat:muzzleM},tip:{mesh:tip,mat:tipM},
                 baseOpacity:[opacity*0.42,opacity,Math.min(0.98,opacity*1.55)],
                 muzzleBaseOpacity:opacity*1.25, tipBaseOpacity:opacity*1.10,
                 x,z,dx,dz,len,t:0,dur,width,attack:Math.min(0.055,dur*0.34),
                 // Legacy single-mesh handle for any caller that still expects .mesh / .mat.
                 mesh:body.mesh, mat:body.mat, opacity});
  // Quick spark burst at the origin so it feels like the beam DISCHARGED
  // rather than appeared. Particle pool, very cheap.
  burst({x,z},col,isMobile?3:6);
  flashLight({x,z},col,2.5,4,0.10);
  return body.mesh;
}

function makeFlameConeGeometry(len,startWidth,endWidth){
  const geo=new THREE.BufferGeometry();
  const y=0;
  const pos=new Float32Array([
    -startWidth*0.5,y,0,
     startWidth*0.5,y,0,
     endWidth*0.5,y,len,
    -endWidth*0.5,y,len,
  ]);
  const uv=new Float32Array([0,0, 1,0, 1,1, 0,1]);
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  geo.setIndex([0,1,2,0,2,3]);
  geo.computeVertexNormals();
  return geo;
}
function spawnFlameCone(x,z,dx,dz,len,startWidth,endWidth,col=0xff7a22,dur=0.13,opacity=0.42){
  if(!spendVfxBudget('beams')) return null;
  const dl=Math.hypot(dx,dz)||1;
  dx/=dl; dz/=dl;
  const ang=Math.atan2(dx,dz);
  const mkLayer=(sw,ew,h,c,op)=>{
    const g=makeFlameConeGeometry(len,sw,ew);
    const m=new THREE.MeshBasicMaterial({
      color:c,transparent:true,opacity:op,side:THREE.DoubleSide,
      depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending
    });
    const mesh=new THREE.Mesh(g,m);
    mesh.rotation.y=ang;
    mesh.position.set(x,h,z);
    mesh.renderOrder=112;
    mesh.frustumCulled=false;
    scene.add(mesh);
    return {mesh,mat:m};
  };
  const halo=mkLayer(startWidth*1.65,endWidth*1.22,0.086,col,opacity*0.32);
  const body=mkLayer(startWidth,endWidth,0.104,col,opacity);
  const core=mkLayer(startWidth*0.36,endWidth*0.46,0.122,0xffeeaa,Math.min(0.92,opacity*0.82));
  const muzzleG=new THREE.CircleGeometry(Math.max(0.16,startWidth*0.72),isMobile?12:18);
  const muzzleM=new THREE.MeshBasicMaterial({color:0xffee88,transparent:true,opacity:opacity*1.15,side:THREE.DoubleSide,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending});
  const muzzle=new THREE.Mesh(muzzleG,muzzleM);
  muzzle.rotation.x=-Math.PI/2;
  muzzle.position.set(x,0.13,z);
  muzzle.renderOrder=113;
  muzzle.frustumCulled=false;
  scene.add(muzzle);
  skillVfx.push({kind:'flameCone',layers:[halo,body,core],muzzle:{mesh:muzzle,mat:muzzleM},
                 baseOpacity:[opacity*0.32,opacity,Math.min(0.92,opacity*0.82)],
                 muzzleBaseOpacity:opacity*1.15,t:0,dur,attack:Math.min(0.045,dur*0.35),mesh:body.mesh,mat:body.mat,opacity});
  burst({x,z},col,isMobile?2:4);
  return body.mesh;
}

function spawnSkyMeteorVfx(x,z,r,col=0xff66ff,dur=0.58){
  const startX=x-2.1, startZ=z+2.6;
  const geo=new THREE.OctahedronGeometry(0.42,0);
  const mat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.98,blending:THREE.AdditiveBlending,depthWrite:false});
  const mesh=new THREE.Mesh(geo,mat);
  const aura=new THREE.Mesh(new THREE.SphereGeometry(0.72,8,6),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.18,blending:THREE.AdditiveBlending,depthWrite:false}));
  mesh.add(aura);
  // Draw the falling meteor + its trail above the river (renderOrder ~86) so the
  // strike isn't swallowed by water hazards as it nears the ground.
  mesh.renderOrder=100; aura.renderOrder=100;
  mesh.position.set(startX,7.2,startZ);
  mesh.frustumCulled=false;
  scene.add(mesh);
  const pts=[new THREE.Vector3(startX,7.2,startZ),new THREE.Vector3((startX+x)/2,3.7,(startZ+z)/2),new THREE.Vector3(x,0.42,z)];
  const trail=spawnBoltTube(pts,col,isMobile?0.04:0.06,Math.max(80,dur*1000),0.55);
  if(trail) trail.renderOrder=100;
  skillVfx.push({kind:'meteor',mesh,mat,x,z,startX,startZ,t:0,dur,col,r,trail});
  return mesh;
}

function spawnSkyBeamVfx(x,z,r=1.2,col=0xfff2aa,dur=0.42){
  const geo=new THREE.CylinderGeometry(r*0.35,r*0.55,7.5,isMobile?10:16,1,true);
  const mat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.45,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.position.set(x,3.8,z);
  mesh.frustumCulled=false;
  scene.add(mesh);
  skillVfx.push({kind:'pillar',mesh,mat,t:0,dur,opacity:0.45});
  spawnSkillRingAura(x,z,r*1.5,col,dur,0.55);
  return mesh;
}

function spawnFactoryGateVfx(x,z,onOpen=null,dur=0.95){
  const group=new THREE.Group();
  group.frustumCulled=false;
  group.position.set(x,0,z);
  const ringMat=new THREE.MeshBasicMaterial({color:0xffdd44,transparent:true,opacity:0.72,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const coreMat=new THREE.MeshBasicMaterial({color:0xffaa22,transparent:true,opacity:0.20,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const gate=new THREE.Mesh(new THREE.TorusGeometry(1.25,0.08,isMobile?8:12,isMobile?36:56),ringMat);
  gate.rotation.y=Math.PI/2;
  gate.position.y=1.25;
  const gate2=new THREE.Mesh(new THREE.TorusGeometry(1.02,0.035,isMobile?8:10,isMobile?28:44),ringMat.clone());
  gate2.rotation.y=Math.PI/2;
  gate2.position.y=1.25;
  const core=new THREE.Mesh(new THREE.CircleGeometry(0.96,isMobile?28:44),coreMat);
  core.rotation.y=Math.PI/2;
  core.position.y=1.25;
  const floor=new THREE.Mesh(new THREE.RingGeometry(0.55,1.9,isMobile?28:48),ringMat.clone());
  floor.rotation.x=-Math.PI/2;
  floor.position.y=0.06;
  group.add(gate,gate2,core,floor);
  scene.add(group);
  flashLight({x,z},0xffdd44,7.5,9,0.55);
  skillVfx.push({kind:'gate',group,mesh:group,mats:[ringMat,gate2.material,coreMat,floor.material],t:0,dur,opened:false,onOpen});
  spawnSkillRingAura(x,z,2.2,0xffdd44,0.75,0.58);
  return group;
}

function disposeSkillVfx(v){
  if(!v) return;
  if(v.kind==='gate'){
    scene.remove(v.group);
    v.group?.traverse(o=>{ o.geometry?.dispose?.(); o.material?.dispose?.(); });
  } else if((v.kind==='beam'||v.kind==='flameCone')&&v.layers){
    for(const L of v.layers){
      scene.remove(L.mesh); L.mesh?.geometry?.dispose?.(); L.mat?.dispose?.();
    }
    if(v.muzzle){ scene.remove(v.muzzle.mesh); v.muzzle.mesh?.geometry?.dispose?.(); v.muzzle.mat?.dispose?.(); }
    if(v.tip){ scene.remove(v.tip.mesh); v.tip.mesh?.geometry?.dispose?.(); v.tip.mat?.dispose?.(); }
  } else {
    scene.remove(v.mesh);
    v.mesh?.traverse?.(o=>{ if(o!==v.mesh){ o.geometry?.dispose?.(); o.material?.dispose?.(); } });
    v.mesh?.geometry?.dispose?.();
    v.mat?.dispose?.();
  }
}

function updateSkillVfx(dt){
  for(let i=skillVfx.length-1;i>=0;i--){
    const v=skillVfx[i];
    v.t+=dt;
    const p=Math.min(1,v.t/v.dur);
    if(v.kind==='ring'){
      v.mesh.scale.setScalar(v.r*(0.2+0.95*(1-Math.pow(1-p,2))));
      v.mesh.rotation.z+=v.spin*dt;
      v.mat.opacity=v.opacity*(1-p);
    } else if(v.kind==='beam'){
      // Layered beam: each layer fades on its own curve so the bright core
      // collapses first while the outer halo lingers — gives the "flash"
      // feel. Width pulses outward, slight rotation jitter on outer halo
      // for energy crackle.
      if(v.layers){
        const attack=Math.min(1,v.t/Math.max(0.001,v.attack||0.05));
        const grow=1-Math.pow(1-attack,3);
        const fadeStart=Math.min(0.42,(v.attack||0.05)/v.dur+0.10);
        const fp=p<=fadeStart ? 0 : (p-fadeStart)/(1-fadeStart);
        const layerFade=[Math.pow(1-fp,0.72), Math.pow(1-fp,0.95), Math.pow(1-fp,1.45)];
        const layerPulse=0.62+grow*0.38+Math.sin(p*Math.PI)*0.24;
        if(Number.isFinite(v.x)){
          const cx=v.x+v.dx*v.len*0.5*grow, cz=v.z+v.dz*v.len*0.5*grow;
          for(const L of v.layers) L.mesh.position.set(cx,L.mesh.position.y,cz);
          if(v.tip) v.tip.mesh.position.set(v.x+v.dx*v.len*grow,0.10,v.z+v.dz*v.len*grow);
        }
        for(let li=0;li<v.layers.length;li++){
          const L=v.layers[li];
          // Cylinder local +Y is the beam length; we don't scale that.
          // .x and .z scale the cross-section circle (the "width").
          L.mesh.scale.y=Math.max(0.02,grow);
          L.mesh.scale.x=L.mesh.scale.z=layerPulse*(li===0?1.04+Math.sin(v.t*42)*0.05:1);
          L.mat.opacity=v.baseOpacity[li]*layerFade[li];
        }
        if(v.muzzle){
          v.muzzle.mesh.scale.setScalar(0.62+grow*0.38+Math.sin(p*Math.PI*1.4)*0.34);
          v.muzzle.mat.opacity=v.muzzleBaseOpacity*Math.pow(1-fp,0.58);
        }
        if(v.tip){
          v.tip.mesh.scale.setScalar((0.45+grow*0.35)+Math.sin(p*Math.PI)*0.55);
          v.tip.mat.opacity=v.tipBaseOpacity*Math.pow(1-fp,0.72)*grow;
        }
      } else {
        // Legacy single-mesh beams (defensive — nothing in the codebase
        // pushes this shape any more, but keep the math here so a future
        // caller without `layers` doesn't blow up the update loop).
        v.mesh.scale.x=1+Math.sin(p*Math.PI)*0.35;
        v.mat.opacity=v.opacity*Math.pow(1-p,1.15);
      }
    } else if(v.kind==='flameCone'){
      const attack=Math.min(1,v.t/Math.max(0.001,v.attack||0.04));
      const grow=1-Math.pow(1-attack,3);
      const fadeStart=Math.min(0.36,(v.attack||0.04)/v.dur+0.06);
      const fp=p<=fadeStart ? 0 : (p-fadeStart)/(1-fadeStart);
      const flamePulse=0.72+grow*0.28+Math.sin(p*Math.PI)*0.12;
      const flameFade=Math.pow(1-fp,0.62);
      for(let li=0;li<v.layers.length;li++){
        const L=v.layers[li];
        L.mesh.scale.x=flamePulse*(li===0?1.06:1);
        L.mesh.scale.z=Math.max(0.02,grow*(1+Math.sin(p*Math.PI)*0.05));
        L.mat.opacity=v.baseOpacity[li]*flameFade*(li===2?Math.pow(1-fp,0.44):1);
      }
      if(v.muzzle){
        v.muzzle.mesh.scale.setScalar(0.66+grow*0.24+Math.sin(p*Math.PI)*0.42);
        v.muzzle.mat.opacity=v.muzzleBaseOpacity*Math.pow(1-fp,0.50);
      }
    } else if(v.kind==='meteor'){
      const e=1-Math.pow(1-p,2.8);
      v.mesh.position.set(
        v.startX+(v.x-v.startX)*e,
        7.2+(0.42-7.2)*e,
        v.startZ+(v.z-v.startZ)*e
      );
      v.mesh.rotation.x+=dt*7;
      v.mesh.rotation.y+=dt*10;
      v.mat.opacity=0.98*(1-p*0.55);
    } else if(v.kind==='pillar'){
      v.mesh.scale.x=v.mesh.scale.z=0.7+Math.sin(p*Math.PI)*0.7;
      v.mat.opacity=v.opacity*(1-p);
    } else if(v.kind==='gate'){
      const openP=Math.min(1,p*1.6);
      v.group.scale.setScalar(0.35+openP*0.85);
      v.group.rotation.y+=dt*1.8;
      v.group.children.forEach((c,idx)=>{
        c.rotation.z+=(idx%2?1:-1)*dt*(2.0+idx);
      });
      const fade=p>0.82 ? (1-p)/(1-0.82) : 1;
      v.mats.forEach((m,idx)=>{ m.opacity=(idx===2?0.20:0.72)*Math.max(0,fade); });
      if(!v.opened&&p>=0.12){
        v.opened=true;
        if(v.onOpen) v.onOpen();
      }
    }
    if(v.t>=v.dur){
      disposeSkillVfx(v);
      skillVfx.splice(i,1);
      continue;
      if(false){
        // Layered beam owns multiple meshes — tear them all down or the
        // halo / core / muzzle / tip leak as scene children.
        for(const L of v.layers){
          scene.remove(L.mesh); L.mesh.geometry?.dispose?.(); L.mat?.dispose?.();
        }
        if(v.muzzle){ scene.remove(v.muzzle.mesh); v.muzzle.mesh.geometry?.dispose?.(); v.muzzle.mat?.dispose?.(); }
        if(v.tip){ scene.remove(v.tip.mesh); v.tip.mesh.geometry?.dispose?.(); v.tip.mat?.dispose?.(); }
      } else {
        scene.remove(v.mesh);
        v.mesh.traverse?.(o=>{ if(o!==v.mesh){ o.geometry?.dispose?.(); o.material?.dispose?.(); } });
        v.mesh.geometry?.dispose?.();
        v.mat?.dispose?.();
      }
      skillVfx.splice(i,1);
    }
  }
}

// ── Traveling blade waves (bladeWave epic skill) ─────────────
// A crescent slash-arc that *moves forward* from the player along the melee
// aim, dealing damage to each enemy exactly once as it passes through.
// Unlike spawnSkillBeam (which is a static beam fading in place), this is a
// projectile-style wave — the player sees the slash advance across the
// arena. Each wave entry tracks its own travel distance and a hit-set so
// enemies aren't double-tapped.
const bladeWaves = [];
function disposeBladeWave(w){
  if(!w) return;
  scene.remove(w.mesh); w.mesh?.geometry?.dispose?.(); w.mat?.dispose?.();
  scene.remove(w.edge); w.edge?.geometry?.dispose?.(); w.edgeMat?.dispose?.();
  scene.remove(w.trail); w.trail?.geometry?.dispose?.(); w.trailMat?.dispose?.();
  if(w.afterimages){
    for(const a of w.afterimages){
      scene.remove(a.mesh); a.mesh?.geometry?.dispose?.(); a.mat?.dispose?.();
    }
  }
}
function makeBladeWaveGeometry(innerR, outerR, arc, seg=28, tip=0){
  const verts=[], idx=[], alpha=[];
  for(let i=0;i<=seg;i++){
    const t=-arc*0.5+(arc*i/seg);
    const st=Math.sin(t), ct=Math.cos(t);
    const sweep=1-Math.abs(i/seg-0.5)*2;
    const inner=innerR-tip*sweep*0.24;
    const outer=outerR+tip*sweep;
    verts.push(st*inner,0,ct*inner, st*outer,0,ct*outer);
    alpha.push(0.10+sweep*0.70, 0.35+sweep*0.65);
    if(i<seg){
      const a=i*2;
      idx.push(a,a+1,a+2, a+1,a+3,a+2);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geo.setAttribute('aAlpha',new THREE.Float32BufferAttribute(alpha,1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
function makeBladeWaveMaterial(col, opacity){
  return new THREE.ShaderMaterial({
    transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    uniforms:{uColor:{value:new THREE.Color(col)},uOpacity:{value:opacity}},
    vertexShader:`attribute float aAlpha; varying float vAlpha; void main(){ vAlpha=aAlpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform vec3 uColor; uniform float uOpacity; varying float vAlpha; void main(){ gl_FragColor=vec4(uColor,uOpacity*vAlpha); }`
  });
}
function spawnBladeWave(x,z,dx,dz,len,width,col,dmg,dur=0.55,ownerId=mp.myId){
  const dl=Math.hypot(dx,dz)||1;
  dx/=dl; dz/=dl;
  const ang=Math.atan2(dx,dz);
  // Outer crescent — the body of the slash. RingGeometry with theta args
  // makes a partial arc; thetaStart=-arc/2 + thetaLength=arc centres it on
  // local +X (which we then rotate to point along the aim).
  const arc=Math.PI*1.02;
  const innerR=Math.max(0.20,width*0.56);
  const outerR=Math.max(innerR+0.16,width*1.28);
  const geo=makeBladeWaveGeometry(innerR,outerR,arc,isMobile?22:40,width*0.38);
  const mat=makeBladeWaveMaterial(col,0.88);
  const mesh=new THREE.Mesh(geo,mat);
  mesh.rotation.y=ang;
  // After x=-PI/2 rotation, ring's +X axis becomes world +X. To make the
  // arc face the aim vector (dx, dz), spin around z so +X points there.
  mesh.position.set(x,0.20,z);
  mesh.frustumCulled=false;
  mesh.renderOrder=114;
  scene.add(mesh);
  // Inner white-hot edge — narrower arc, brighter, follows the same orient.
  const edgeGeo=makeBladeWaveGeometry(width*1.02,width*1.10,arc*0.68,isMobile?16:28,width*0.22);
  const edgeMat=makeBladeWaveMaterial(0xffffff,0.92);
  const edge=new THREE.Mesh(edgeGeo,edgeMat);
  edge.rotation.y=ang;
  edge.position.set(x,0.215,z);
  edge.frustumCulled=false;
  edge.renderOrder=115;
  scene.add(edge);
  const trailGeo=makeBladeWaveGeometry(width*0.38,width*0.52,arc*0.38,isMobile?10:16,width*0.16);
  const trailMat=makeBladeWaveMaterial(col,0.46);
  const trail=new THREE.Mesh(trailGeo,trailMat);
  trail.rotation.y=ang;
  trail.position.set(x-dx*0.28,0.19,z-dz*0.28);
  trail.frustumCulled=false;
  trail.renderOrder=113;
  scene.add(trail);
  const afterimages=[];
  for(let i=0;i<(isMobile?2:3);i++){
    const ag=makeBladeWaveGeometry(innerR*0.94,outerR*(0.94-i*0.05),arc*(0.92-i*0.08),isMobile?12:18,width*0.22);
    const am=makeBladeWaveMaterial(i===0?0xffffff:col,0);
    const aMesh=new THREE.Mesh(ag,am);
    aMesh.rotation.y=ang;
    aMesh.position.set(x,0.185-i*0.012,z);
    aMesh.scale.setScalar(1.04+i*0.08);
    aMesh.frustumCulled=false;
    aMesh.renderOrder=110-i;
    scene.add(aMesh);
    afterimages.push({mesh:aMesh,mat:am,delay:0.075+i*0.055,base:0.26-i*0.055,scale:1.04+i*0.08});
  }
  bladeWaves.push({mesh,mat,edge,edgeMat,trail,trailMat,afterimages,x,z,dx,dz,len,width,col,dmg,ang,
                   travelled:0,t:0,dur,hit:new Set(),ownerId});
  // Spawn punch at the swing origin.
  burst({x,z},col,isMobile?4:8);
  spawnShockwave(x,z,width*1.15,col,0.16,0.42);
  flashLight({x,z},col,3.2,4.8,0.12);
}
function updateBladeWaves(dt){
  for(let i=bladeWaves.length-1;i>=0;i--){
    const w=bladeWaves[i];
    w.t+=dt;
    const p=Math.min(1,w.t/w.dur);
    // Travel: ease-out so the wave starts fast then decelerates near the
    // far end (reads as a "swung" slash that loses energy, not a constant
    // sliding strip). Total distance over dur = len.
    const eased=1-Math.pow(1-p,1.8);
    w.travelled=w.len*eased;
    const cx=w.x+w.dx*w.travelled;
    const cz=w.z+w.dz*w.travelled;
    w.mesh.position.set(cx,0.20,cz);
    w.edge.position.set(cx,0.215,cz);
    w.trail.position.set(cx-w.dx*w.width*0.42,0.19,cz-w.dz*w.width*0.42);
    for(const a of w.afterimages||[]){
      const lagT=Math.max(0,w.t-a.delay);
      const lagP=Math.min(1,lagT/w.dur);
      const lagTravel=w.len*(1-Math.pow(1-lagP,1.8));
      const ax=w.x+w.dx*lagTravel;
      const az=w.z+w.dz*lagTravel;
      a.mesh.position.set(ax,0.185,az);
      a.mesh.scale.setScalar(a.scale+Math.sin(lagP*Math.PI)*0.14);
      a.mat.uniforms.uOpacity.value=a.base*Math.max(0,1-p)*Math.min(1,lagT/0.08);
    }
    // Subtle width pulse over lifetime so the slash feels alive.
    const pulse=1+Math.sin(p*Math.PI)*0.10;
    w.mesh.scale.setScalar(pulse);
    w.edge.scale.setScalar(pulse);
    w.trail.scale.setScalar(0.92+pulse*0.10);
    // Fade out near the end of life.
    const fade=p>0.70 ? (1-p)/(1-0.70) : 1;
    w.mat.uniforms.uOpacity.value=0.88*fade;
    w.edgeMat.uniforms.uOpacity.value=0.92*fade;
    w.trailMat.uniforms.uOpacity.value=0.42*fade*(0.65+Math.sin(p*Math.PI)*0.35);
    // Per-frame damage: enemies within `width` of the wave's current
    // position get hit ONCE. Hit-set keyed on poolIdx so the same enemy
    // can't be re-damaged as the wave drifts over them across frames.
    const hitRadius=w.width*1.08;
    for(let j=enemies.length-1;j>=0;j--){
      const e=enemies[j]; if(!e||e.dead) continue;
      if(w.hit.has(e.poolIdx)) continue;
      if(Math.hypot(e.pos.x-cx,e.pos.z-cz)<hitRadius+e.cfg.r){
        damageEnemyIndex(j,w.dmg,w.col,0.12,w.ownerId,'melee');
        w.hit.add(e.poolIdx);
        burst({x:e.pos.x,z:e.pos.z},w.col,isMobile?2:4);
      }
    }
    if(w.t>=w.dur){
      disposeBladeWave(w);
      bladeWaves.splice(i,1);
    }
  }
}

const slashVfx = [];
// In-flight hook projectiles. Each entry: {proj, rope, ropeMat, color,
// fromX, fromZ, tx, tz, t, dur, onLand} — animated by updateFlyingHooks().
const flyingHooks = [];
const hookedEnemies = [];
const _hookUp  = new THREE.Vector3(0,1,0);
const _hookDir = new THREE.Vector3();
// Short directional slash used by the Blade Sentinel. It participates in the
// same animation/disposal list as player melee effects.
function spawnSlashVfx(x,z,angle,color,radius=0.55,dur=0.20){
  const arc=1.8;
  const geo=new THREE.RingGeometry(radius*0.55,radius,isMobile?16:24,1,-arc/2,arc);
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.85,
    side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.rotation.x=-Math.PI/2;
  mesh.rotation.z=angle-Math.PI/2;
  mesh.position.set(x,0.18,z);
  scene.add(mesh);
  slashVfx.push({mesh,mat,t:0,dur,baseRot:mesh.rotation.z,spin:3,opacity:mat.opacity});
}
function spawnSwordSlash(x,z,r,lvl=1){
  const count=lvl>=4?3:2;
  for(let i=0;i<count;i++){
    const arcLen=(lvl>=5?1.45:1.25)+i*0.12;
    const inner=r*(0.38+i*0.05);
    const outer=r*(0.72+i*0.07);
    const geo=new THREE.RingGeometry(inner,outer,isMobile?24:40,1,-arcLen*0.5,arcLen);
    const mat=new THREE.MeshBasicMaterial({
      color:i===0?0xf7fbff:0x66eeff,
      transparent:true,opacity:i===0?0.86:0.58,
      side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending
    });
    const mesh=new THREE.Mesh(geo,mat);
    mesh.rotation.x=-Math.PI/2;
    mesh.rotation.z=(i/count)*Math.PI*2+(lvl>=5?0.55:0);
    mesh.position.set(x,0.12+i*0.018,z);
    mesh.frustumCulled=false;
    scene.add(mesh);
    slashVfx.push({mesh,mat,t:0,dur:0.28+i*0.035,baseRot:mesh.rotation.z,spin:(i%2?1:-1)*(8+lvl*1.2),opacity:mat.opacity});
  }
  spawnShockwave(x,z,r*0.72,0x66eeff,0.18,0.50);
  flashLight({x,z},0x99f7ff,3.0+lvl*0.35,5+r*0.5,0.13);
  burst({x,z},0xdffcff,isMobile?5:9);
}

const reviveZones = new Map();
function makeReviveZone(id){
  const ringMat=new THREE.MeshBasicMaterial({color:0x00ffcc,transparent:true,opacity:0.28,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const fillMat=new THREE.MeshBasicMaterial({color:0x44ff88,transparent:true,opacity:0.18,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.94,1.0,isMobile?36:56),ringMat);
  const fill=new THREE.Mesh(new THREE.CircleGeometry(0.92,isMobile?36:56),fillMat);
  ring.rotation.x=fill.rotation.x=-Math.PI/2;
  ring.position.y=0.07; fill.position.y=0.055;
  const group=new THREE.Group();
  group.add(fill,ring);
  group.visible=false;
  scene.add(group);
  const zone={id,group,ring,fill,ringMat,fillMat,progress:0,active:false};
  reviveZones.set(id,zone);
  return zone;
}
function disposeReviveZone(id){
  const z=reviveZones.get(id); if(!z) return;
  scene.remove(z.group);
  z.ring.geometry.dispose(); z.ringMat.dispose();
  z.fill.geometry.dispose(); z.fillMat.dispose();
  reviveZones.delete(id);
}
function setReviveZone(id,x,z,progress,active){
  const zone=reviveZones.get(id)||makeReviveZone(id);
  const r=effectiveReviveRange();
  zone.group.visible=true;
  zone.group.position.set(x,0,z);
  zone.group.scale.setScalar(r);
  zone.ring.rotation.z+=0.025+(active?0.035:0);
  zone.ringMat.opacity=active?0.55:0.24;
  zone.fillMat.opacity=active?0.24:0.09;
  zone.fill.scale.setScalar(Math.max(0.02,progress));
  zone.fillMat.color.setHex(progress>=0.98?0xffffff:0x44ff88);
  zone.ringMat.color.setHex(active?0x44ff88:0x00ffcc);
}
function updateReviveZones(){
  const seen=new Set();
  const reviveTime=effectiveReviveTime();
  if(player.downed){
    seen.add(mp.myId);
    const active=performance.now()-(player.lastReviveTouch||0)<260 || Object.values(mp.remotePlayers).some(rp=>!rp.dead&&!rp.downed&&Math.hypot(rp.pos.x-player.pos.x,rp.pos.z-player.pos.z)<=effectiveReviveRange());
    setReviveZone(mp.myId,player.pos.x,player.pos.z,player.reviveT/reviveTime,active);
    if(mp.connected) placeReviveCdTag(mp.myId,player.pos.x,1.85,player.pos.z,player.downedT,player.reviverCount||0);
  }
  for(const [id,rp] of Object.entries(mp.remotePlayers)){
    if(!rp.downed) continue;
    seen.add(+id);
    const localNear=!player.dead&&!player.downed&&Math.hypot(player.pos.x-rp.pos.x,player.pos.z-rp.pos.z)<=effectiveReviveRange();
    setReviveZone(+id,rp.pos.x,rp.pos.z,Math.max(0,Math.min(1,(rp.reviveT||0)/reviveTime)),localNear);
    const tp=rp.renderPos||rp.pos;
    placeReviveCdTag(+id,tp.x,1.85,tp.z,rp.downedT||0,rp.reviverCount||0);
  }
  for(const id of [...reviveZones.keys()]){
    if(!seen.has(id)) reviveZones.get(id).group.visible=false;
  }
  for(const [id,el] of reviveCdTags){ if(!seen.has(id)) el.style.display='none'; }
}
const reviveCdTags=new Map();
function getReviveCdTag(id){
  const layer=document.getElementById('nameLayer'); if(!layer) return null;
  let el=reviveCdTags.get(id);
  if(!el){ el=document.createElement('div'); el.className='revive-cd-tag'; layer.appendChild(el); reviveCdTags.set(id,el); }
  return el;
}
function placeReviveCdTag(id,x,y,z,secs,reviverCount){
  const el=getReviveCdTag(id); if(!el) return;
  if(gState!=='playing'){ el.style.display='none'; return; }
  _scratchProj.set(x,y,z).project(camera);
  if(_scratchProj.z<-1||_scratchProj.z>1){ el.style.display='none'; return; }
  const reviving=reviverCount>0;
  const s=Math.max(0,Math.ceil(secs));
  el.textContent=(reviving?'\u{1F6DF} ':'\u{1F480} ')+s+'s'+(reviverCount>1?` x${reviverCount}`:'');
  el.classList.toggle('reviving',reviving);
  el.classList.toggle('critical',!reviving&&secs<=6);
  el.style.display='block';
  const rect=_canvasRect||canvas.getBoundingClientRect();
  el.style.left=((_scratchProj.x*0.5+0.5)*rect.width+rect.left)+'px';
  el.style.top =((-_scratchProj.y*0.5+0.5)*rect.height+rect.top)+'px';
}
// Hide every revive zone + floating countdown immediately. updateReviveZones
// only runs while playing, so when the run ends these would otherwise freeze
// on screen over the game-over/losing overlay.
function hideReviveUI(){
  for(const [,el] of reviveCdTags) el.style.display='none';
  for(const [,z] of reviveZones) if(z&&z.group) z.group.visible=false;
}
function impactPulse(pos,col,maxR=1.2,n=6){
  if(!isMobile) spawnShockwave(pos.x,pos.z,maxR,col,0.22,0.8);
  burst(pos,col,n);
}
const pGeo      = new THREE.IcosahedronGeometry(0.085,0);
const pMats     = {};
function getPartMat(col){
  if(!pMats[col]) pMats[col]=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.92,blending:THREE.AdditiveBlending,depthWrite:false});
  return pMats[col];
}
for(let i = 0; i < PART_POOL; i++){
  const mesh = new THREE.Mesh(pGeo, getPartMat(0x00ffcc));
  mesh.visible=false; mesh.frustumCulled=false; scene.add(mesh);
  partPool.push({mesh,active:false,vx:0,vy:0,vz:0,life:0,maxLife:1,spinX:0,spinY:0,grow:0});
}

const vfxLights = [];
if(!isMobile){
  // Pool of reusable flash lights. Every light here is permanently in the
  // scene, so each one adds per-fragment cost to EVERY lit material in forward
  // rendering — 12 was a big constant tax for little gain (rarely >4 flashes at
  // once). 6 keeps punchy flashes while roughly halving that lighting cost.
  for(let i=0;i<6;i++){
    const l=new THREE.PointLight(0xffffff,0,8);
    scene.add(l);
    vfxLights.push({light:l,t:0,dur:1,intensity:0});
  }
}
function flashLight(pos,col,intensity=4,range=7,dur=0.18){
  if(!vfxLights.length) return;
  if(!spendVfxBudget('lights')) return;
  const slot=vfxLights.find(v=>v.t<=0)||vfxLights[0];
  slot.light.color.setHex(col);
  slot.light.position.set(pos.x,0.85,pos.z);
  slot.light.distance=range*0.72;
  slot.light.intensity=intensity*0.36;
  slot.t=slot.dur=dur;
  slot.intensity=intensity*0.36;
}

function spawnBoltTube(points,col=0x44aaff,radius=0.055,dur=150,opacity=0.9){
  if(!spendVfxBudget('bolts')) return null;
  const curve=new THREE.CatmullRomCurve3(points);
  const geo=new THREE.TubeGeometry(curve,Math.max(4,points.length*2),radius,4,false);
  const mat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.frustumCulled=false;
  scene.add(mesh);
  setTimeout(()=>{scene.remove(mesh);geo.dispose();mat.dispose();},dur);
  return mesh;
}

function spawnStormZap(x,z){
  const segs=isMobile?5:8;
  const pts=[];
  const topY=5.5;
  for(let i=0;i<=segs;i++){
    const t=i/segs;
    const y=topY*(1-t);
    const offX=(i>0&&i<segs)?(Math.random()-0.5)*1.4:0;
    const offZ=(i>0&&i<segs)?(Math.random()-0.5)*1.4:0;
    const px=x+offX, pz=z+offZ;
    pts.push(new THREE.Vector3(px,y,pz));
  }
  spawnBoltTube(pts,0xffff55,isMobile?0.055:0.075,135,0.9);
  flashLight({x,z},0xffff55,4.5,6,0.14);
  spawnShockwave(x,z,1.4,0xffff55,0.16,0.7);
}

function spawnZapLine(x1,z1,x2,z2){
  const segs=isMobile?5:8;
  const pts=[];
  const dx=x2-x1, dz=z2-z1;
  const len=Math.hypot(dx,dz);
  const nx=len>0?-dz/len:0, nz=len>0?dx/len:0;
  for(let i=0;i<=segs;i++){
    const t=i/segs;
    const off=(i>0&&i<segs)?(Math.random()-0.5)*Math.min(len*0.35,2.5):0;
    const px=x1+dx*t+nx*off, pz=z1+dz*t+nz*off;
    pts.push(new THREE.Vector3(px,1.0,pz));
  }
  spawnBoltTube(pts,0x44aaff,isMobile?0.05:0.065,125,0.9);
  flashLight({x:x2,z:z2},0x44aaff,3.6,5,0.13);
  spawnShockwave(x2,z2,1.0,0x44aaff,0.15,0.75);
}

// ── Skill-proc VFX gating ───────────────────────────────────────────────
// Keeps the new skill feedback cheap: heavier ring/beam effects are skipped on
// the lowest gfx tier, and high-frequency procs are rate-limited so they can't
// spam meshes (which would tank FPS). Purely cosmetic — never gates gameplay.
const _skillFxT = {};
function skillFxThrottle(key, ms){
  const now = performance.now();
  if((_skillFxT[key]||0) > now) return false;
  _skillFxT[key] = now + ms;
  return true;
}
function fxHeavyOK(){ return gfxTier!=='potato'; }

function burst(pos, col, n=10){
  // Tier-aware scale: potato strips ~65% of particles, low ~35%, etc. Mobile
  // caps still apply on top so mobile never spawns more than 6 per burst.
  n = Math.max(1, Math.round(n * GFX_PARTICLE_MULT));
  const max = isMobile ? Math.min(n,6) : Math.min(n,10);
  const budget = vfxBudgetLeft('particles');
  if(budget<=0) return;
  const target = Math.min(max,budget);
  let spawned = 0;
  for(let i = 0; i < partPool.length && spawned < target; i++){
    const p = partPool[i]; if(p.active) continue;
    p.active=true; p.mesh.material=getPartMat(col);
    p.mesh.position.set(pos.x,0.55,pos.z); p.mesh.visible=true;
    const spd=2.8+Math.random()*7.5, ang=Math.random()*Math.PI*2;
    const lift=1.8+Math.random()*7;
    p.vx=Math.cos(ang)*spd; p.vy=lift; p.vz=Math.sin(ang)*spd;
    p.spinX=(Math.random()-0.5)*10; p.spinY=(Math.random()-0.5)*12;
    p.grow=0.7+Math.random()*0.8;
    p.life=p.maxLife=0.42+Math.random()*0.62;
    spawned++;
  }
  _vfxBudgetUsed.particles += spawned;
}

// ── Roguelike skill system ────────────────────────────────
const playerStats = { maxHp:MAX_HP, baseMaxHp:MAX_HP, maxHpPenalty:0, attackDmg:25 };
const playerSkills = {}; // id -> effective power level 1-5
const playerSkillPicks = {}; // id -> visible card level / rarity cap
const playerRelics = {}; // run-only relic flags; selection UI will be added later
const RELIC_DEFS = {
  glassReactor:{name:'Glass Reactor',icon:'💠',desc:'+80% all damage, -35% max HP'},
  heavyCrown:{name:'Heavy Crown',icon:'👑',desc:'+1 boss reward pick, boss HP +35%'},
  bloodContract:{name:'Blood Contract',icon:'🩸',desc:'Shop prices -40%; buying cards cuts max HP cap by 8%'},
  berserkerGrip:{name:'Berserker Grip',icon:'✊',desc:'Melee damage +120%, dash cooldown +30%'},
  gamblerChip:{name:'Gambler Chip',icon:'🎲',desc:'Rerolls can be free, but reroll prices start higher'},
  luckyDebt:{name:'Lucky Debt',icon:'🍀',desc:'Better rarity odds, shop prices +35%'},
  lastStandCore:{name:'Last Stand Core',icon:'🔥',desc:'+100% damage above 50% HP; healing above 50% is halved'},
  orbEngine:{name:'Orb Engine',icon:'🪐',desc:'+50% orb count, -20% orb damage'},
  quantumDash:{name:'Quantum Dash',icon:'💨',desc:'Dash distance x2, dash cooldown x1.5'},
  fateGambit:{name:'Fate Gambit',icon:'🎴',desc:'80% extra card pick once; 20% skips the reward'},
  regenHeart:{name:'Regen Heart',icon:'❤️‍🩹',desc:'+15% max HP regenerated per second, but max HP -50%'},
  infiniteMag:{name:'Infinite Reserve',icon:'♾️',desc:'Never reload, never run out of ammo; fire rate -50%'},
  hasteAura:{name:'Haste Aura',icon:'🌀',desc:'+30% move speed for everyone (you, teammates, enemies)'},
  vampirePact:{name:'Vampire Pact',icon:'🧛',desc:'Heal damage you deal; disables other regen and lifesteal'},
  // Cursed relics — pure debuffs, no upside. Filtered out of the normal
  // relic pool; only offered at the Cursed Shrine.
  envy:        {name:'Envy',         icon:'😈', desc:'Teammates deal -50% damage. You unchanged.',         cursed:true},
  greedyCrown: {name:'Greedy Crown', icon:'🥇', desc:'All loot drops can only be picked up by YOU.',       cursed:true},
  heavyBoots:  {name:'Heavy Boots',  icon:'🦶', desc:'All players have ×2 dash cooldown.',                 cursed:true},
  linkedPain:  {name:'Linked Pain',  icon:'🔗', desc:'When you take damage, teammates take 25% of it too.', cursed:true},
  boneTribute: {name:'Bone Tribute', icon:'💀', desc:'Enemy spawn count +50% for the rest of the run.',    cursed:true},
  brittleBones:{name:'Brittle Bones',icon:'🧊', desc:'All players take +30% damage.',                       cursed:true},
};
// ── 3-level relic values ──────────────────────────────────
// Every relic now has 3 levels. Picking the same relic again upgrades it.
// Pick weight in offers prefers UPGRADES to existing relics over completely
// new ones when the player already owns several maxed-1 relics. Index 0 is
// the not-owned baseline; index 1-3 are the level values.
const RELIC_LEVELS = {
  // ── Normal pool ─────────────
  glassReactor: {
    desc:['','+50% all damage, -25% max HP','+80% all damage, -35% max HP','+120% all damage, -45% max HP'],
    dmg:[1,1.50,1.80,2.20], hpMul:[1,0.75,0.65,0.55],
  },
  heavyCrown: {
    desc:['','+1 boss reward pick, boss HP +25%','+1 boss reward pick, boss HP +35%','+2 boss reward picks, boss HP +50%'],
    bossPickBonus:[0,1,1,2], bossHpMul:[1,1.25,1.35,1.50],
  },
  bloodContract: {
    desc:['','Shop -25%; cards cut max HP -6%','Shop -40%; cards cut max HP -8%','Shop -55%; cards cut max HP -10%'],
    shopMul:[1,0.75,0.60,0.45], hpCutPct:[0,0.06,0.08,0.10],
  },
  berserkerGrip: {
    desc:['','Melee +70%, dash CD +20%','Melee +120%, dash CD +30%','Melee +180%, dash CD +45%'],
    meleeMul:[1,1.70,2.20,2.80], dashCdMul:[1,1.20,1.30,1.45],
  },
  gamblerChip: {
    desc:['','25% rerolls free, prices +30%','40% rerolls free, prices +50%','60% rerolls free, prices +75%'],
    freeChance:[0,0.25,0.40,0.60], priceMul:[1,1.30,1.50,1.75],
  },
  luckyDebt: {
    desc:['','+25% rarity bias, shop +20%','+50% rarity bias, shop +35%','+90% rarity bias, shop +60%'],
    rarityBias:[1,1.25,1.50,1.90], shopMul:[1,1.20,1.35,1.60],
  },
  lastStandCore: {
    desc:['','+60% damage >50% HP; healing halved','+100% damage >50% HP; healing halved','+150% damage >50% HP; healing blocked'],
    dmg:[1,1.60,2.00,2.50], healMul:[1,0.5,0.5,0.0],
  },
  orbEngine: {
    desc:['','+1 orb per type, -15% orb dmg','+2 orbs per type, -20% orb dmg','+3 orbs per type, -30% orb dmg'],
    extraOrbs:[0,1,2,3], orbDmgMul:[1,0.85,0.80,0.70],
  },
  quantumDash: {
    desc:['','Dash dist ×1.5, dash CD ×1.25','Dash dist ×2, dash CD ×1.5','Dash dist ×2.5, dash CD ×1.75'],
    distMul:[1,1.5,2.0,2.5], cdMul:[1,1.25,1.50,1.75],
  },
  fateGambit: {
    // L1: 80% chance to get 2 cards; L2: 70% chance to get 3 cards;
    // L3: 60% chance to get 4 cards. The remainder is a "skip" — no card.
    // Triggers once per pick offering (skill/boss). On success the wave
    // becomes a streak that auto-picks bonus cards until extraCards drains.
    desc:[
      '',
      '80% chance: get 2 cards total / 20% skip',
      '70% chance: get 3 cards total / 30% skip',
      '60% chance: get 4 cards total / 40% skip',
    ],
    successChance:[0,0.80,0.70,0.60],
    cardCount:    [0, 2,    3,    4],
  },
  regenHeart: {
    desc:['','+10% max HP/sec, -35% max HP','+15% max HP/sec, -50% max HP','+25% max HP/sec, -65% max HP'],
    regenPct:[0,0.10,0.15,0.25], hpMul:[1,0.65,0.50,0.35],
  },
  infiniteMag: {
    desc:['','Never reload, fire rate -60%','Never reload, fire rate -50%','Never reload, fire rate -35%'],
    fireMul:[1,2.50,2.00,1.55],
  },
  hasteAura: {
    desc:['','+20% move speed for everyone','+30% move speed for everyone','+45% move speed for everyone'],
    spdMul:[1,1.20,1.30,1.45],
  },
  vampirePact: {
    desc:['','Heal 10% of damage you deal; disables regen + lifesteal cards','Heal 20% of damage you deal; disables regen + lifesteal cards','Heal 30% of damage you deal; ALL OTHER HEALING DISABLED'],
    rate:[0,0.10,0.20,0.30],
  },
  // ── Cursed pool ─────────────
  envy: {
    desc:['','Teammates deal -30% damage','Teammates deal -50% damage','Teammates deal -75% damage'],
    teamDmgMul:[1,0.70,0.50,0.25],
  },
  greedyCrown: {
    desc:['','Only YOU can pick heal bags','Only YOU can pick heal bags + buff drops','Only YOU can pick anything (incl. gold)'],
    scope:[null,'heal','heal+buff','all'],
  },
  heavyBoots: {
    desc:['','All players dash CD ×1.5','All players dash CD ×2','All players dash CD ×2.5'],
    cdMul:[1,1.50,2.00,2.50],
  },
  linkedPain: {
    desc:['','Teammates take 15% of your damage','Teammates take 25% of your damage','Teammates take 40% of your damage'],
    sharePct:[0,0.15,0.25,0.40],
  },
  boneTribute: {
    desc:['','Enemy count +25% for the run','Enemy count +50% for the run','Enemy count +80% for the run'],
    countMul:[1,1.25,1.50,1.80],
  },
  brittleBones: {
    desc:['','All players take +20% damage','All players take +30% damage','All players take +50% damage'],
    dmgMul:[1,1.20,1.30,1.50],
  },
};
function hasRelic(id){ return (playerRelics[id]|0) > 0; }
function relicLevel(id){ return playerRelics[id]|0; }
function relicLevelOf(playerObj,id){
  if(!playerObj || !playerObj.relics) return 0;
  const v=playerObj.relics[id];
  // Boolean-true legacy clients send `true` instead of a number; treat as L1.
  if(v===true) return 1;
  return (v|0);
}
function _anyPlayerRelicLevel(id){
  let lvl=relicLevel(id);
  if(typeof mp!=='undefined' && mp.remotePlayers){
    for(const rp of Object.values(mp.remotePlayers)){
      const v=rp?.relics?.[id];
      const n=(v===true)?1:(v|0);
      if(n>lvl) lvl=n;
    }
  }
  return lvl;
}
function applyRelic(id){
  if(!RELIC_DEFS[id]) return false;
  const cur=relicLevel(id);
  if(cur>=3) return false;
  playerRelics[id]=cur+1;
  recalcPlayerMaxHp(false);
  if(id==='infiniteMag'){
    // Top off the mag and cancel any in-flight reload — the relic means we
    // never reload again, so a stuck reloadT would leave the player unable
    // to shoot for no visible reason.
    player.ammo=currentMagSize();
    player.reloadT=0;
  }
  if(id==='regenHeart'){
    annText('❤️‍🩹 REGEN HEART','#ff66aa');
    burst(player.pos,0xff66aa,isMobile?6:12);
    spawnSkillRingAura(player.pos.x,player.pos.z,1.4,0xff66aa,0.42,0.7);
  }
  if(id==='hasteAura'){
    annText('🌀 HASTE AURA','#66ffee');
    spawnSkillRingAura(player.pos.x,player.pos.z,1.6,0x66ffee,0.42,0.75);
  }
  if(id==='vampirePact'){
    annText('🧛 VAMPIRE PACT','#cc2244');
    burst(player.pos,0xcc2244,isMobile?6:14);
    spawnShockwave(player.pos.x,player.pos.z,1.2,0xcc2244,0.22,0.7);
  }
  rebuildFireballs(); rebuildIceOrbs(); rebuildThunderOrbs(); rebuildPoisonOrbs();
  if(typeof renderCursedRelicPanel==='function') renderCursedRelicPanel();
  return true;
}
function relicMaxHpMult(){
  let mult=1;
  if(hasRelic('glassReactor')) mult*=RELIC_LEVELS.glassReactor.hpMul[relicLevel('glassReactor')];
  if(hasRelic('regenHeart'))   mult*=RELIC_LEVELS.regenHeart.hpMul[relicLevel('regenHeart')];
  // Cursed Shrine temporary HP-cap reduction. _curseHpPct is the fraction of
  // base maxHp REMOVED (0.25 / 0.50 / 0.75). Decays to 0 after the wave count.
  if(player && player._curseHpPct>0) mult*=Math.max(0.10, 1-player._curseHpPct);
  return mult;
}
function applyCurseHp(pct, waves){
  if(!player) return;
  player._curseHpPct = Math.max(player._curseHpPct||0, pct);
  player._curseHpWaves = Math.max(player._curseHpWaves||0, waves);
  recalcPlayerMaxHp(false); // recalc + clamp current HP down to new cap
  refreshHP();
}
function tickCurseHpOnWaveClear(){
  if(!player || !(player._curseHpWaves>0)) return;
  player._curseHpWaves--;
  if(player._curseHpWaves<=0){
    player._curseHpPct = 0;
    player._curseHpWaves = 0;
    recalcPlayerMaxHp(true); // restore cap, heal up to the recovered amount
    refreshHP();
    annText('CURSE LIFTED','#aaffcc');
  }
}
// Vampire Pact disables every other heal-on-damage / regen path. Helper used
// by leech (kills), melee lifesteal, summon heal pulses, Soul Link Army, etc.
function regenSourcesBlocked(){ return hasRelic('vampirePact'); }
// Vampire Pact level 3 — hard-blocks every healPlayer call AND the regenHeart
// tick. Only the lifesteal-on-damage in recordDamageDealt still heals. L1/L2
// keep the looser "only block regen/lifesteal cards" behaviour via
// regenSourcesBlocked. Helper centralises the level read so all heal sites
// agree on what to gate.
function vampirePactHardBlock(){ return relicLevel('vampirePact') >= 3; }
function vampirePactRate(){
  return hasRelic('vampirePact') ? RELIC_LEVELS.vampirePact.rate[relicLevel('vampirePact')] : 0;
}
// Haste Aura broadcasts itself: if ANY player in the lobby owns it, every
// entity on every client moves 30% faster (player, allies, enemies). Remote
// relic state is sent in PLAYER_STATE so all clients agree on the multiplier.
function hasteAuraActive(){
  if(hasRelic('hasteAura')) return true;
  if(typeof mp!=='undefined' && mp.remotePlayers){
    for(const rp of Object.values(mp.remotePlayers)){
      if(rp?.relics?.hasteAura) return true;
    }
  }
  return false;
}
function hasteAuraMult(){
  const lvl=_anyPlayerRelicLevel('hasteAura');
  return lvl>0 ? RELIC_LEVELS.hasteAura.spdMul[lvl] : 1;
}
// Cursed-relic awareness helpers. Each scans the local player AND every
// remote player's relics (synced via PLAYER_STATE) so one cursed pickup
// debuffs the whole team.
function _anyPlayerHasRelic(id){
  if(hasRelic(id)) return true;
  if(typeof mp!=='undefined' && mp.remotePlayers){
    for(const rp of Object.values(mp.remotePlayers)){
      if(rp?.relics?.[id]) return true;
    }
  }
  return false;
}
function _onlyHolderIs(id, myId){
  return hasRelic(id) ? true : !_anyPlayerHasRelic(id);
}
function envyDamageMult(){
  // Envy: NON-holders deal reduced damage. The holder is unaffected.
  if(hasRelic('envy')) return 1;
  const lvl=_anyPlayerRelicLevel('envy');
  return lvl>0 ? RELIC_LEVELS.envy.teamDmgMul[lvl] : 1;
}
function greedyCrownBlocksMe(){
  // True if SOMEONE ELSE owns the Crown — they get the pickups, I get none.
  // Scope (heal-only / +buff / all) is decided by their level — read it at
  // pickup sites that care.
  return _anyPlayerRelicLevel('greedyCrown')>0 && !hasRelic('greedyCrown');
}
function greedyCrownActiveScope(){
  // Returns 'none' | 'heal' | 'heal+buff' | 'all'. The scope of whoever
  // holds Crown (max level wins if multiple). Used by pickup sites to gate
  // selectively.
  const lvl=_anyPlayerRelicLevel('greedyCrown');
  if(lvl<=0) return 'none';
  return RELIC_LEVELS.greedyCrown.scope[lvl] || 'heal';
}
function heavyBootsActive(){ return _anyPlayerRelicLevel('heavyBoots')>0; }
function heavyBootsCdMul(){
  const lvl=_anyPlayerRelicLevel('heavyBoots');
  return lvl>0 ? RELIC_LEVELS.heavyBoots.cdMul[lvl] : 1;
}
function brittleBonesMul(){
  const lvl=_anyPlayerRelicLevel('brittleBones');
  return lvl>0 ? RELIC_LEVELS.brittleBones.dmgMul[lvl] : 1;
}
function boneTributeMul(){
  const lvl=_anyPlayerRelicLevel('boneTribute');
  return lvl>0 ? RELIC_LEVELS.boneTribute.countMul[lvl] : 1;
}
function boneTributeActive(){ return _anyPlayerRelicLevel('boneTribute')>0; }
function linkedPainShareLocal(){
  // Local player's share only — multiple holders don't stack (max level).
  const lvl=relicLevel('linkedPain');
  return lvl>0 ? RELIC_LEVELS.linkedPain.sharePct[lvl] : 0;
}
function recalcPlayerMaxHp(healDelta=true){
  const old=playerStats.maxHp||MAX_HP;
  const raw=Math.max(1,Math.round((playerStats.baseMaxHp||MAX_HP)*relicMaxHpMult()));
  const next=Math.max(1,raw-(playerStats.maxHpPenalty||0));
  playerStats.maxHp=next;
  player.maxHp=next;
  if(player.overhealShield) player.overhealShield=Math.min(player.overhealShield,next);
  if(player.dead||player.downed) player.hp=0;
  else if(healDelta&&next>old) player.hp=Math.min(next,(player.hp??0)+(next-old));
  else player.hp=Math.min(next,player.hp??next);
  refreshHP();
}
function addPlayerMaxHp(amount,healDelta=true){
  playerStats.baseMaxHp=(playerStats.baseMaxHp||MAX_HP)+amount;
  recalcPlayerMaxHp(healDelta);
}
function addOverhealShield(amount){
  if(!player||player.dead||amount<=0) return 0;
  const cap=Math.max(1,playerStats.maxHp||MAX_HP);
  const before=player.overhealShield||0;
  player.overhealShield=Math.min(cap,before+amount);
  const gained=Math.max(0,player.overhealShield-before);
  if(gained){
    refreshHP();
    dmgNum('SHIELD +'+Math.round(gained),player.pos,'#8fdcff');
  }
  return gained;
}
function absorbOverhealShield(dmg){
  const shield=Math.max(0,player.overhealShield||0);
  if(!shield||dmg<=0) return dmg;
  const blocked=Math.min(shield,dmg);
  player.overhealShield=Math.max(0,shield-blocked);
  refreshHP();
  dmgNum('SHIELD -'+Math.round(blocked),player.pos,'#8fdcff');
  if(blocked>=dmg){
    player.invincible=0.18;
    shakeAmt=Math.max(shakeAmt,0.18);
    sBarrierH();
    return 0;
  }
  return Math.max(0,dmg-blocked);
}
function applyBloodGrowthKill(){
  const lvl=playerSkills.bloodGrowth||0;
  const add=BLOOD_GROWTH_HP[lvl]||0;
  const cap=BLOOD_GROWTH_CAP[lvl]||0;
  if(!add||!cap) return;
  const cur=player._bloodGrowthHp||0;
  if(cur>=cap) return;
  const gained=Math.min(add,cap-cur);
  player._bloodGrowthHp=cur+gained;
  addPlayerMaxHp(gained);
  dmgNum('MAX HP +'+gained,player.pos,'#66ffaa');
}
function applyCrystalHeart(c,pos=null){
  const lvl=playerSkills.crystalHeart||0;
  const per=CRYSTAL_HEART_HP[lvl]||0;
  if(!per||!c) return;
  const gained=c*per;
  addPlayerMaxHp(gained);
  if(pos) dmgNum('MAX HP +'+gained.toFixed(1),_scratchPos.set(pos.x-0.25,0,pos.z-0.55),'#88e8ff');
}
function applyBossPlateReward(){
  const lvl=playerSkills.bossPlate||0;
  const pct=BOSS_PLATE_PCT[lvl]||0;
  if(!pct||!player||player.dead) return;
  const gained=Math.max(1,Math.round((playerStats.maxHp||MAX_HP)*pct));
  addPlayerMaxHp(gained,false);
  const healed=healPlayer(gained);
  dmgNum('BOSS PLATE +'+gained+' HP',player.pos,'#88ccff');
  if(healed) spawnSkillRingAura(player.pos.x,player.pos.z,1.9,0x88ccff,0.34,0.55);
}
function relicDamageMult(){
  let mult=1;
  if(hasRelic('glassReactor')) mult*=RELIC_LEVELS.glassReactor.dmg[relicLevel('glassReactor')];
  if(hasRelic('lastStandCore')&&player.hp>playerStats.maxHp*0.5){
    mult*=RELIC_LEVELS.lastStandCore.dmg[relicLevel('lastStandCore')];
  }
  // Buff Cache "DMG" buff scales every damage path that flows through here.
  if(typeof buffDamageMult==='function') mult*=buffDamageMult();
  // Envy (cursed) — non-holders deal reduced damage.
  if(typeof envyDamageMult==='function') mult*=envyDamageMult();
  return mult;
}
function relicShopPriceMult(){
  let mult=1;
  if(hasRelic('bloodContract')) mult*=RELIC_LEVELS.bloodContract.shopMul[relicLevel('bloodContract')];
  if(hasRelic('luckyDebt'))     mult*=RELIC_LEVELS.luckyDebt.shopMul[relicLevel('luckyDebt')];
  return mult;
}
function applyBloodContractCost(){
  if(!hasRelic('bloodContract')) return;
  const pct=RELIC_LEVELS.bloodContract.hpCutPct[relicLevel('bloodContract')];
  playerStats.maxHpPenalty=(playerStats.maxHpPenalty||0)+Math.max(1,Math.round((playerStats.maxHp||MAX_HP)*pct));
  recalcPlayerMaxHp(false);
}
function resetRelics(){
  Object.keys(playerRelics).forEach(k=>delete playerRelics[k]);
  playerStats.maxHpPenalty=0;
  _resetRelicPickState();
  if(typeof renderCursedRelicPanel==='function') renderCursedRelicPanel();
}
// Global attack-stat scale: 1.0 at base 25 dmg, scales for +3 ATK cards and PERM_DMG_MULT.
// Multiply this into any damage source that uses a hardcoded base so the +3 stat card
// (and the permanent damage upgrade) propagate uniformly across bullets / melee / orbs /
// spells / movement skills / summons.
// Multiplier applied to ALL player-damage so the Crystal Force epic scales
// the whole kit, not just primary bullets. Orbs / spells / summons / mines /
// dash skills / blink / kinetic / fire ring / homing bomb / storm call /
// lightning all flow through atkScale(), so baking it in there covers them
// in one shot. Bullets and melee don't use atkScale so they get the mult
// explicitly at their own callsites.
function crystalPowerMult(){
  const lvl=playerSkills.crystalPower||0;
  const per100=(typeof CRYSTAL_POWER_P100!=='undefined' ? CRYSTAL_POWER_P100[lvl]||0 : 0);
  if(per100<=0) return 1;
  // Cap the bonus so a hoard of crystals can't snowball into infinite DMG.
  // The cap is per-level: lvl 1 → +30%, lvl 2 → +60%.
  const cap=(typeof CRYSTAL_POWER_CAP!=='undefined' ? CRYSTAL_POWER_CAP[lvl]||0 : 0);
  const raw=Math.max(0,runCrystals||0)/100*per100;
  const bonus=cap>0 ? Math.min(raw,cap) : raw;
  return 1+bonus;
}
function atkScale(){ return (playerStats.attackDmg/25)*crystalPowerMult(); }

const SKILL_DEFS = {
  shotgunAscension:{name:'Rupture',icon:'🌋',requiresGun:'shotgun',desc:['','','','','','Hit at close range with 8 blasts. Next shot also releases a 10m frontal shockwave: 12× pellet damage and 0.4s stagger. Walls block it. Pellets keep all card bonuses; the empowered blast cannot recharge Rupture.']},
  grenadeAscension:{name:'Supernova',icon:'☀️',requiresGun:'grenade',desc:['','','','','','Hit 2 or more enemies with one primary grenade explosion, 8 times. Your next shot deals triple damage with +50% base blast radius, including extra grenades. Extra and empowered grenades cannot charge it. Reload preserves charge.']},
  grenadeRadius:{name:'Blast Envelope',icon:'💥',requiresGun:'grenade',desc:['','Grenade explosion radius +15%','Grenade explosion radius +25%','','Grenade explosion radius +35%','Grenade explosion radius +45%']},
  grenadeCore:{name:'Epicenter',icon:'🎯',requiresGun:'grenade',desc:['','Grenade explosions deal +30% damage within the inner 40% of their radius.','','Inner blast damage +50%.','','Inner blast damage +70%.']},
  grenadePrimer:{name:'Hot Chamber',icon:'🔥',requiresGun:'grenade',desc:['','After reloading, the next shot deals +25% damage and its grounded fuse lasts 0.5s instead of 1s. Includes extra grenades. Switching weapon cancels it.','','Next shot deals +40% damage with the short grounded fuse.','','Next shot deals +55% damage with the short grounded fuse.']},
  burstAscension:{name:'Celestial Triad',icon:'🌠',requiresGun:'burst',desc:['','','','','','Land all 3 primary rounds on one target in 6 bursts. Your next burst deals triple damage and pierces 3 more enemies, including extra projectiles. Each burst charges once; empowered bursts cannot recharge. Reload preserves charge.']},
  burstControl:{name:'Tight Formation',icon:'🎯',requiresGun:'burst',desc:['','Burst Rifle: 20% less dispersion','Burst Rifle: 30% less dispersion','','Burst Rifle: 40% less dispersion','Burst Rifle: 50% less dispersion']},
  burstConvergence:{name:'Triple Impact',icon:'💥',requiresGun:'burst',desc:['','Hit one target with all 3 primary rounds of a burst: the completing hit deals +50% damage. Extra projectiles do not count.','','Completing hit deals +80% damage.','','Completing hit deals +110% damage.']},
  burstOpening:{name:'Fresh Magazine',icon:'🔄',requiresGun:'burst',desc:['','After completing a reload, your next burst deals +25% damage, including extra projectiles. Weapon switch cancels it.','','Next burst deals +40% damage.','','Next burst deals +55% damage.']},
  ak47Ascension:{name:'Steel Storm',icon:'🌩️',requiresGun:'ak47',desc:['','','','','','Fire 40 primary shots to empower the next 12: damage ×2 and pierce +2, including extra projectiles. Empowered shots cannot recharge it. Reload preserves charge; a 3s firing gap or weapon switch resets it.']},
  ak47Control:{name:'Recoil Control',icon:'🎯',requiresGun:'ak47',desc:['','AK47: 15% less dispersion','AK47: 25% less dispersion','','AK47: 35% less dispersion','AK47: 45% less dispersion']},
  ak47Momentum:{name:'Sustained Fire',icon:'🔥',requiresGun:'ak47',desc:['','Each consecutive primary shot adds 2% damage, up to +20%. Resets on reload or a 0.7s firing gap.','','3% per shot, up to +30%.','','4% per shot, up to +40%.']},
  ak47Tactical:{name:'Combat Reload',icon:'🔄',requiresGun:'ak47',desc:['','A kill while holding AK47 makes the next reload started within 4s take 20% less time. Does not stack.','','30% less reload time.','','40% less reload time.']},
  shotgunImpact:{name:'Brutal Impact',icon:'💥',requiresGun:'shotgun',desc:['','Within 3m of muzzle: push enemies 0.45m and stagger 0.12s, once per target per blast. Bosses and elites resist.','','Push 0.65m and stagger 0.18s','','Push 0.85m and stagger 0.24s']},
  shotgunRain:{name:'Lead Rain',icon:'🌧️',requiresGun:'shotgun',desc:['','Shotgun: +2 pellets, +10% dispersion','Shotgun: +4 pellets, +20% dispersion','','Shotgun: +6 pellets, +30% dispersion','Shotgun: +8 pellets, +40% dispersion']},
  shotgunFocus:{name:'Point Blank',icon:'🎯',requiresGun:'shotgun',desc:['','Each pellet hitting the same target adds +4% damage to later pellets in that blast (max +32%).','','+6% per earlier hit (max +48%)','','+8% per earlier hit (max +64%)']},
  pistolRicochet:{name:'Ricochet',icon:'↪️',requiresGun:'pistol',desc:['','Pistol: +1 wall bounce, redirects toward a visible enemy within 14m','Pistol: +2 aimed wall bounces','','Pistol: +3 aimed wall bounces','Pistol: +4 aimed wall bounces']},
  pistolPrecision:{name:'Precise Shot',icon:'🎯',requiresGun:'pistol',desc:['','Pistol: consecutive primary hits grant +4% damage each (max +20%). A missed primary resets the bonus.','','Pistol: +6% per consecutive primary hit (max +30%)','','Pistol: +8% per consecutive primary hit (max +40%)']},
  pistolAscension:{name:'Neon Judgment',icon:'⚖️',requiresGun:'pistol',desc:['','','','','','Land 30 primary shots, then reload: one magazine deals 2× damage and pierces +3 enemies. Bonus shots inherit the effect. Empowered shots cannot charge it. Reloading discards remaining empowered rounds. Infinite Reserve: press Reload when ready.']},
  pistolLastWord:{name:'Last Word',icon:'💥',requiresGun:'pistol',desc:['','Pistol: last round deals +60% damage and pierces +1 enemy. Includes bonus shots; requires consuming ammo.','','Pistol: last round +90% damage and +2 pierce','','Pistol: last round +120% damage and +3 pierce']},
  eventHorizon:{name:'Event Horizon',icon:'🌀',requiresGun:'gravity',desc:['','Gravity Cannon: +20% pull radius','Gravity Cannon: +40% pull radius','','Gravity Cannon: +60% pull radius','Gravity Cannon: +80% pull radius']},
  unstableCollapse:{name:'Unstable Collapse',icon:'💥',requiresGun:'gravity',desc:['','Gravity Cannon: +8% explosion damage per enemy in the field (max +40%)','','Gravity Cannon: +12% per enemy (max +60%)','','Gravity Cannon: +16% per enemy (max +80%)']},
  persistentSingularity:{name:'Persistent Singularity',icon:'🌌',requiresGun:'gravity',desc:['','Gravity Cannon: field lasts +0.6s','','Gravity Cannon: field lasts +1.2s','','Gravity Cannon: field lasts +1.8s']},
  gravityAscension:{name:'Absolute Singularity',icon:'🕳️',requiresGun:'gravity',desc:['','','','','','Hold attack: up to 4× damage and 2.5× radius. At 12s, launch a black hole to arena center (10× damage), pulling all enemies through walls, including bosses. Then 10s: -35% movement, +50% firing interval and reload time; charging disabled. Early release has no penalty.']},
  spread:    { name:'Spread Pattern',  icon:'↔️', desc:['','+1 side pattern / wider cones','+2 side patterns (pierce fades)','+3 side patterns / wider beams','+4 side patterns','+5 side patterns'] },
  rapidFire: { name:'Rapid Fire',      icon:'⚡', desc:['','15% faster','28% faster','40% faster','50% faster','60% faster'] },
  fireball:  { name:'Fireball Orb',    icon:'🔥', desc:['','1 orbiting fireball','2 orbiting fireballs','3 orbiting fireballs','4 orbiting fireballs','4 fireballs, 2× speed'] },
  iceOrb:    { name:'Ice Orb',         icon:'❄️', desc:['','1 ice orb (slows)','2 ice orbs','3 ice orbs','4 ice orbs','4 ice orbs, 2× speed'] },
  thunderOrb:{ name:'Thunder Orb',     icon:'🌩️', desc:['','1 thunder orb (stuns)','2 thunder orbs','3 thunder orbs','4 thunder orbs','4 thunder orbs, 2× speed'] },
  poisonOrb: { name:'Poison Orb',      icon:'☠️', desc:['','1 poison orb (DoT)','2 poison orbs','3 poison orbs','4 poison orbs','4 poison orbs, 2× speed'] },
  lightning: { name:'Chain Lightning', icon:'⛈️', desc:['','1 target / 4s','1 target / 3s','2 targets / 3s','3 targets / 2s','4 targets / 1.5s'] },
  pierce:    { name:'Pierce',          icon:'🏹', desc:['','Pierce 1; -12% DMG/hit','Pierce 2 enemies','Pierce 3 enemies','Pierce 4 enemies','Full pierce (-40% cap)'] },
  explosive: { name:'Explosive Payload',icon:'💥', desc:['','Compatible hits blast','Small blast','Medium blast','Large blast','Massive blast'] },
  barrier:   { name:'Barrier',         icon:'🛡️', desc:['','Block 1 hit / 8s','Block 1 hit / 7s','Block 1 hit / 5s','Block 1 hit / 4s','Block 1 hit / 3s'] },
  leech:       { name:'Vampiric',      icon:'🩸', desc:['','Your kills heal +3 HP','Your kills heal +6 HP','Your kills heal +9 HP','Your kills heal +12 HP','Your kills heal +15 HP'] },
  bounce:      { name:'Ricochet',      icon:'↩️', desc:['','Compatible shots bounce 1×','Bounce 2×','Bounce 3×','Bounce 4×','Bounce 5×'] },
  spellCard:   { name:'Nova Spell',    icon:'🃏', desc:['','Auto: 8-ball nova (6s)','Auto: 12-ball nova (5s)','Auto: 16-ball nova (4s)','Auto: 20-ball nova (3.5s)','Auto: 24-ball nova (3s)'] },
  heavyRounds: { name:'Heavy Payload', icon:'🔵', desc:['','Shots/beams/explosions bigger','Larger payload radius','Wide payload radius','Huge payload radius','Massive payload radius'] },
  orbSpeed:    { name:'Orb Speed',     icon:'🌀', desc:['','Orbs 30% faster','65% faster','×2.05 speed','×2.5 speed','×3 speed'] },
  orbPower:    { name:'Orb Power',     icon:'💫', desc:['','Orbs +25% DMG','+55% DMG','+85% DMG','+115% DMG','+145% DMG'] },
  orbSize:     { name:'Orb Size',      icon:'⭕', desc:['','Orbs 22% bigger','46% bigger','72% bigger','102% bigger','165% bigger'] },
  orbPulse:    { name:'Orbit Pulse',   icon:'🫧', desc:['','Orbit radius breathes wider','Wider pulsing orbit','Large pulsing orbit','Huge pulsing orbit','Fast mega pulse'] },
  bulletPower: { name:'Weapon Power',  icon:'🎯', desc:['','+25% weapon DMG','+55% DMG','+85% DMG','+115% DMG','+145% DMG'] },
  fireRing:    { name:'Fire Ring',     icon:'🔥', desc:['','Expanding fire ring (5.5s)','Wider ring (5s)','Strong ring (4.5s)','Large ring (4s)','Massive ring (3.5s)'] },
  homingBomb:  { name:'Homing Bomb',   icon:'💣', desc:['','1 homing bomb (4.5s)','Bigger bomb (4s)','2 bombs (3.5s)','3 bombs (3s)','4 bombs (2.5s)'] },
  spellPower:  { name:'Spell Power',   icon:'✨', desc:['','+30% spell DMG','+62% DMG','+95% DMG','+128% DMG','+160% DMG'] },
  spellHaste:  { name:'Spell Haste',   icon:'⏩', desc:['','Spells 12% faster','22% faster','32% faster','42% faster','50% faster'] },
  stormCall:   { name:'Storm Call',    icon:'⚡', desc:['','Strike farthest enemy (3.5s)','Stronger bolt (3s)','2 targets, heavy bolt (2.5s)','2 targets (2s)','3 targets (1.5s)'] },
};

// ── Skill categories ──────────────────────────────────────
Object.assign(SKILL_DEFS, {
  meleePower: { name:'Blade Power', icon:'🗡️', desc:['','Melee +35% DMG','+70% DMG','+105% DMG','+145% DMG','+190% DMG'] },
  meleeReach: { name:'Wide Edge', icon:'🌙', desc:['','Melee range +20%','+40% range','+60% range','+80% range','+100% range'] },
  meleeHaste: { name:'Quick Sheath', icon:'⏱️', desc:['','Melee CD -12%','CD -22%','CD -32%','CD -40%','CD -48%'] },
  meleeLeech: { name:'Blood Edge', icon:'🩸', desc:['','Melee lifesteal','More lifesteal','Strong lifesteal','Heavy lifesteal','Vampire blade'] },
});

Object.assign(SKILL_DEFS, {
  dashMastery: { name:'Dash Mastery',  icon:'💨', desc:['','Dash recharges faster','Longer dash, faster recharge','Dash gains stronger burst','Very short recharge','Chain dashes rapidly'] },
  afterimage:  { name:'Afterimage',    icon:'🌫️', desc:['','Dash leaves delayed trail blasts','Stronger trail blasts','Wider blast path','Faster detonations','Deadly echo explosions'] },
  phaseStep:   { name:'Phase Step',    icon:'👻', desc:['','Dash phases through danger','Tagged enemies are slowed','Tagged enemies take more damage','Longer safety window','Heavy phase weaken'] },
  blinkStrike: { name:'Blink Strike',  icon:'🌟', desc:['','Dash-end sword slash AoE','Wider slash circle','Stronger blade wave','Double crescent burst','Execution blade storm'] },
  kineticCharge:{name:'Kinetic Charge',icon:'🌪️', desc:['','Movement charges dash burst','Charges faster','Bigger charged burst','Higher charged damage','Full-charge shockwave'] },
  adrenaline:  { name:'Adrenaline',    icon:'💉', desc:['','Constant speed boost','Stronger passive speed','+32% speed, kills reduce dash','More dash refund on kill','+55% speed, heavy dash refund'] },
  laserDrone:  { name:'Laser Drone',   icon:'🛸', desc:['','Summons a roaming laser drone','Drones spawn faster','Drone lasers fire faster','Drones last longer','Overcharged drone swarm'] },
  guardianTurret:{ name:'Guardian Walker', icon:'🏯', desc:['','Summons a walking 4-leg turret','Walker lasts longer','Walker fires faster','Stronger walker shots','Mobile turret network'] },
  mineLayer:   { name:'Mine Layer',    icon:'🧨', desc:['','Dash drops mines','Mines hit harder','Drops more often','Bigger explosions','Minefield specialist'] },
  repairDrone: { name:'Repair Drone',  icon:'🩹', desc:['','Summons a healing support bot','Stronger periodic heal','Also boosts revive range','Faster healing cycle','Emergency heal pulse'] },
});
Object.assign(SKILL_DEFS, {
  shieldBot:      { name:'Shield Bot',     icon:'🤖', desc:['','Summons a high-HP guard','More guard HP','Sturdier guard, harder body-checks','Longer guard uptime','Heavy protector bot'] },
  bladeSentinel:  { name:'Blade Sentinel', icon:'⚔️', desc:['','Summons a melee attacker','Sentinel hits harder','Faster hunter unit','Longer sentinel uptime','Heavy blade ally'] },
  summonDuration: { name:'Ally Durability',icon:'🛡️', desc:['','+10% summon HP & duration','+20% HP & duration','+30% HP & duration','+40% HP & duration','+50% HP & duration'] },
  summonPower:    { name:'Ally Power',     icon:'💪', desc:['','+20% summon ATK, size & HP','+45% ATK, bigger','+70% ATK, much bigger','+85% ATK, large','×2.00 ATK & size'] },
  summonHaste:    { name:'Summon Haste',   icon:'⏩', desc:['','Summons spawn/respawn 10% faster','17% faster','24% faster','29% faster','32% faster'] },
});
Object.assign(SKILL_DEFS, {
  factoryGate:     { name:'Factory Gate',      icon:'🏭', desc:['','','','','','Deploys 1 max-level unit of each summon; Haste speeds the gate'] },
  soulLinkArmy:    { name:'Soul Link Army',    icon:'🔗', desc:['','','','','','Summons absorb damage and heal you by army size'] },
  crimsonCyclone:  { name:'Crimson Cyclone',   icon:'🌪️', desc:['','','','','','Melee creates a spinning blade aura around you'] },
  phantomDuelist:  { name:'Phantom Duelist',   icon:'👥', desc:['','','','','','Melee echoes in four 90° slash directions'] },
  starfallDash:    { name:'Starfall Dash',     icon:'☄️', desc:['','','','','','Dash calls a heavy meteor at the landing point'] },
  echoStep:        { name:'Echo Step',         icon:'👣', desc:['','','','','','Dash paths become stronger delayed explosive trails'] },
  orbGalaxy:       { name:'Split Orb',         icon:'✴️', desc:['','','','','','Orbs deal 80% damage but every orb becomes two'] },
  gravityCore:     { name:'Gravity Core',      icon:'🧲', desc:['','','','','','Orbs strongly pull enemies into a damaging orbit ring'] },
  archmageLoop:    { name:'Archmage Loop',     icon:'🔁', desc:['','','','','','Spells can rapidly trigger another owned spell for free'] },
  celestialVerdict:{ name:'Celestial Verdict', icon:'🌠', desc:['','','','','','A sky beam periodically executes the strongest target'] },
  bulletHellEngine:{ name:'Bullet Hell Engine',icon:'🔫', desc:['','','','','','Every 5 shots releases a mirrored bullet storm'] },
  executionRounds: { name:'Execution Rounds',  icon:'🎯', desc:['','','','','','Bullets execute non-boss enemies under 25% HP'] },
});

Object.assign(SKILL_DEFS, {
  railBurst:       { name:'Rail Burst',       icon:'⚡', desc:['','','','Every 7 shots fires a piercing rail beam','','Every 5 shots fires a stronger rail beam'] },
  overclockBarrage:{ name:'Overclock Barrage',icon:'💥', desc:['','','','Every 8 shots adds a forward burst','','Every 6 shots adds a bigger burst'] },
  twinOrbit:       { name:'Twin Orbit',       icon:'🪐', desc:['','','','+1 orb to every owned basic orb','','+2 orbs to every owned basic orb'] },
  orbitStorm:      { name:'Orbit Storm',      icon:'💫', desc:['','','','Periodic damage pulse along your orbit ring','','Faster, stronger orbit pulse'] },
  elementalWake:   { name:'Elemental Wake',   icon:'🌊', desc:['','','','Active orbs release small shockwaves','','Larger, stronger orb shockwaves'] },
  meteorRite:      { name:'Meteor Rite',      icon:'☄️', desc:['','','','Periodically drops a meteor on a nearby enemy','','Faster, heavier meteor'] },
  arcaneTempo:     { name:'Arcane Tempo',     icon:'⏩', desc:['','','','Owned spell cooldowns tick faster','','Spell cooldowns tick much faster'] },
  bladeWave:       { name:'Blade Wave',       icon:'🌙', desc:['','','','Melee sends a cutting wave forward','','Wider, stronger cutting wave'] },
  guardBreaker:    { name:'Guard Breaker',    icon:'🔨', desc:['','','','Melee gains damage, stagger, and knockback','','Higher melee damage, stagger, and knockback'] },
  duelGuard:       { name:'Duel Guard',       icon:'🛡️', desc:['','','','Melee hits grant protection and regen','','Longer protection and stronger regen'] },
  secondSkin:      { name:'Second Skin',      icon:'🩹', desc:['','','','Take 25% less damage and heal 5 after hits','','Take 50% less damage and heal 10 after hits'] },
});

Object.assign(SKILL_DEFS, {
  critLuck:   { name:'Crit Edge',    icon:'🍀', desc:['','+7.5% crit chance','+15% crit chance','+19% crit chance','+22.5% crit chance','+30% crit chance'] },
  luckRarity: { name:'Luck of Draw', icon:'🎲', desc:['','Card offerings ×1.3 toward higher rarity','×1.7 rarity bias','×2.15 rarity bias','×2.65 rarity bias','×3.2 rarity bias'] },
  healDrop:   { name:'Loot Goblin',  icon:'💚', desc:['','Kills can drop team healing orbs (10%)','7% orb drop, heals 15% max HP','10% orb drop, heals 20% max HP','14% orb drop, heals 25% max HP','18% orb drop, heals 30% max HP'] },
  luckyDraw:  { name:'Lucky Draw',   icon:'🎰', desc:['','','','20% chance to refresh offering once','','40% chance to refresh offering once'] },
  pickStreak: { name:'Lucky Streak', icon:'🌟', desc:['','','','','','50% chance to pick another card from the same offering'] },
  lootDrop:   { name:'Buff Cache',   icon:'🎁', desc:['','','','Kills 15% chance to drop a random buff (10s)','','Kills 30% chance to drop a buff'] },
});

// ── New offensive / utility skills ───────────────────────
Object.assign(SKILL_DEFS, {
  detonate:    { name:'Chain Detonate', icon:'💥', desc:['','Kills explode (1.6m, 35% dmg)','Bigger explosion (1.9m, 45% dmg)','Bigger explosion (2.2m, 55% dmg)','Wider chain (2.6m, 68% dmg)','Massive chain (3.0m, 80% dmg)'] },
  roundSurge:  { name:'Round Surge',    icon:'➕', desc:['','10% chance: hit fires +1 bullet','15% chance: +1 bullet','20% chance: +1 bullet','25% chance: +1 bullet','30% chance: +1 bullet'] },
  orbMastery:  { name:'Orb Mastery',    icon:'🌟', desc:['','Orbs +35% DMG and +25% speed','+55% DMG, +40% speed','+75% DMG, +60% speed','+100% DMG, +80% speed','+130% DMG, ×2 speed'] },
});

// ── Survival pad-out (was just 3 cards) ──────────────────
Object.assign(SKILL_DEFS, {
  steadyPulse: { name:'Steady Pulse',     icon:'💗', desc:['','+5 HP regen on wave clear','+10 HP regen on wave clear','+15 HP regen on wave clear','+20 HP regen on wave clear','+25 HP regen on wave clear'] },
  ironPlate:   { name:'Iron Plate',       icon:'🛡️', desc:['','-5% damage taken','-10% damage taken','','-15% damage taken','-20% damage taken'] },
  berserkerHeart:{ name:"Berserker's Heart", icon:'❤️‍🔥', desc:['','Below 30% HP: -25% damage taken','','Below 30% HP: -40% damage taken','','Below 30% HP: -55% damage taken'] },
  vitalCore: { name:'Vital Core', icon:'❤️', desc:['','+20 max HP','+40 max HP','+60 max HP','+80 max HP','+100 max HP'] },
  bloodGrowth: { name:'Blood Growth', icon:'🩸', desc:['','Kills grant +0.5 max HP (cap +10)','Kills grant +1 max HP (cap +20)','','Kills grant +1.5 max HP (cap +30)','Kills grant +2 max HP (cap +40)'] },
  bossPlate: { name:'Boss Plate', icon:'🛡️', desc:['','After each boss: +8% max HP and heal','','After each boss: +14% max HP and heal','','After each boss: +20% max HP and heal'] },
  overhealFrame: { name:'Overheal Frame', icon:'💠', desc:['','Overheal becomes shield (12%)','','Overheal becomes shield (24%)','','Overheal becomes shield (36%)'] },
  crystalHeart: { name:'Crystal Heart', icon:'💎', desc:['','','','Crystals grant +0.1 max HP','','Crystals grant +0.2 max HP'] },
});
// ── Bullet pad-out ───────────────────────────────────────
Object.assign(SKILL_DEFS, {
  magneticRounds:{ name:'Magnetic Rounds', icon:'🧲', desc:['','','','Bullets curve toward nearest enemy','','Bullets curve harder + longer'] },
  hollowPoint:   { name:'Hollow Point',    icon:'🔻', desc:['','+35% dmg vs healthy targets (>75% HP)','+55% dmg vs healthy targets','','+75% dmg vs healthy targets','+95% dmg vs healthy targets'] },
});
// ── Spell pad-out ────────────────────────────────────────
Object.assign(SKILL_DEFS, {
  iceSpike: { name:'Ice Spike', icon:'🧊', desc:['','','','Spike random enemy every 4s (1.5s freeze)','','Spike random enemy every 2.5s (2s freeze)'] },
});
// ── Economy pad-out ──────────────────────────────────────
Object.assign(SKILL_DEFS, {
  crystalLining:{ name:'Crystal Lining', icon:'💠', desc:['','+1 crystal per kill','+2 crystals per kill','','+3 crystals per kill','+4 crystals per kill'] },
});
// ── Melee pad-out ────────────────────────────────────────
Object.assign(SKILL_DEFS, {
  sweepStep:   { name:'Sweep Step',     icon:'👣', desc:['','Each swing dashes 0.5m forward','Each swing dashes 0.8m forward','','Each swing dashes 1.2m forward','Each swing dashes 1.6m forward'] },
  bloodthirst: { name:'Bloodthirst',    icon:'🩸', desc:['','','','Kills (3s) stack +30% melee dmg (×3 cap)','','Kills (3s) stack +80% melee dmg (×3 cap)'] },
  bladeDance:  { name:'Blade Dance',    icon:'💃', desc:['','','','Every 3rd swing: wider arc + 50% DMG','','Every 2nd swing: wider arc + 75% DMG'] },
  stonebreaker:{ name:'Stonebreaker',   icon:'🪨', desc:['','','','','','+50% melee crit; crits heal 5% max HP'] },
});
// ── Elemental build path ─────────────────────────────────
// These cards turn the existing element-reaction system into a real build
// path. Lingering Marks holds the tag longer so you can land the second
// element. Elemental Mastery scales reaction damage. Imbue Rounds turns
// your regular bullets into rotating elemental triggers.
Object.assign(SKILL_DEFS, {
  elementalMastery: { name:'Elemental Mastery', icon:'🌈', desc:['','Reactions deal +25% dmg','+45% dmg','','+75% dmg','+110% dmg'] },
  lingeringMarks:   { name:'Lingering Marks',   icon:'🕯️', desc:['','','','Element tags last +50% longer','','Element tags last +120% longer'] },
  imbueRounds:      { name:'Imbue Rounds',      icon:'🌀', desc:['','','','60% bullets tag a random element (reactions 65%)','','100% bullets tag a random element (reactions full)'] },
});
// ── Bullet range card ────────────────────────────────────
// Every gun now has a max travel distance; Long Shot scales it so snipers
// reach further and pistols can actually keep up with the arena's far wall.
// Applies to projectile guns AND beam/cone weapons (laser, railgun, cryo,
// flamethrower) — the gun's `range` is multiplied at fire time.
Object.assign(SKILL_DEFS, {
  longShot: { name:'Long Shot', icon:'🏹', desc:['','+20% bullet range','+40% bullet range','','+65% bullet range','+95% bullet range'] },
});
const BULLET_RANGE_MULT = [1, 1.20, 1.40, 1.40, 1.65, 1.95];

// ── Weapon-handling + Economy skills ─────────────────────
// Two bullet-category cards for the new mag/reload system, six economy
// cards that lean into the crystal currency. Indexed-by-effective-level
// multiplier arrays live further down where the other PERM tables are.
Object.assign(SKILL_DEFS, {
  magSize:     { name:'Heavy Mag',     icon:'📦', desc:['','+15% mag size','+30% mag size','','+50% mag size','+75% mag size'] },
  reloadSpeed: { name:'Quick Hands',   icon:'🔁', desc:['','Reload 12% faster','22% faster','','32% faster','42% faster'] },
  crystalLuck: { name:'Crystal Eye',   icon:'💎', desc:['','+10% crystal drops','+20% drops','+30% drops','+40% drops','+50% drops'] },
  crystalHeal: { name:'Vital Shards',  icon:'💚', desc:['','+1 HP per crystal','+2 HP per crystal','','+3 HP per crystal','+4 HP per crystal'] },
  frugalShop:  { name:'Frugal Trader', icon:'💸', desc:['','Shop prices -10%','','Shop prices -20%','','Shop prices -30%'] },
  shopOffer:   { name:'Black Market',  icon:'🛒', desc:['','+1 shop card','','+2 shop cards','','+3 shop cards'] },
  crystalPower:{ name:'Crystal Force', icon:'💠', desc:['','','','+2% DMG per 100 crystals (cap +30%)','','+4% DMG per 100 (cap +60%)'] },
  crystalSurge:{ name:'Crystal Tithe', icon:'🌟', desc:['','','','Wave start: +5% bonus crystals','','Wave start: +10% bonus crystals'] },
});

// Per-effective-level multiplier tables for the new skills. Index 0 is the
// "not picked" baseline. Some slots aren't reachable by certain rarities
// (uncommon picks resolve to effective levels 1,2,4,5 — index 3 unused, etc.)
// but we keep the arrays length-6 for uniformity.
const MAG_SIZE_MULT       = [1,    1.15, 1.30, 1.45, 1.50, 1.75];
const RELOAD_TIME_MULT    = [1,    0.88, 0.78, 0.72, 0.68, 0.58];
const CRYSTAL_LUCK_BONUS  = [0,    0.10, 0.20, 0.30, 0.40, 0.50];
const CRYSTAL_HEAL_PER    = [0,    1,    2,    2,    3,    4];
const SHOP_DISCOUNT_PCT   = [0,    0.10, 0.10, 0.20, 0.20, 0.30];
const SHOP_OFFER_BONUS    = [0,    1,    1,    2,    2,    3];
// Per-100-crystal increment AND total cap by effective level. Epic resolves
// to indices 3 / 5 — so lvl 1 = +2% per 100 (max +30%), lvl 2 = +4% per 100
// (max +60%). Other indices kept for layout symmetry but unreachable.
const CRYSTAL_POWER_P100  = [0,    0.01, 0.015, 0.02, 0.03, 0.04];
const CRYSTAL_POWER_CAP   = [0,    0.15, 0.20,  0.30, 0.45, 0.60];
const CRYSTAL_SURGE_PCT   = [0,    0.03, 0.04, 0.05, 0.07, 0.10];
const VITAL_CORE_HP       = [0,    20,   40,    60,   80,   100];
const BLOOD_GROWTH_HP     = [0,    0.5,  1.0,   1.0,  1.5,  2.0];
const BLOOD_GROWTH_CAP    = [0,    10,   20,    20,   30,   40];
const CRYSTAL_HEART_HP    = [0,    0,    0,     0.1,  0.1,  0.2];
const BOSS_PLATE_PCT      = [0,    0.08, 0.08,  0.14, 0.14, 0.20];
const OVERHEAL_SHIELD_PCT = [0,    0.12, 0.12,  0.24, 0.24, 0.36];

const SKILL_CATEGORY = {
  eventHorizon:'bullet',unstableCollapse:'bullet',persistentSingularity:'bullet',gravityAscension:'bullet',
  grenadeAscension:'bullet',grenadeRadius:'bullet',grenadeCore:'bullet',grenadePrimer:'bullet',
  burstAscension:'bullet',burstControl:'bullet',burstConvergence:'bullet',burstOpening:'bullet',
  ak47Ascension:'bullet',ak47Control:'bullet',ak47Momentum:'bullet',ak47Tactical:'bullet',
  pistolRicochet:'bullet',pistolPrecision:'bullet',pistolLastWord:'bullet',pistolAscension:'bullet',shotgunImpact:'bullet',shotgunRain:'bullet',shotgunFocus:'bullet',shotgunAscension:'bullet',
  spread:'bullet', rapidFire:'bullet', pierce:'bullet', explosive:'bullet',
  bounce:'bullet', heavyRounds:'bullet', bulletPower:'bullet', railBurst:'bullet', overclockBarrage:'bullet',
  fireball:'orb',  iceOrb:'orb',  thunderOrb:'orb', poisonOrb:'orb',
  orbSpeed:'orb',  orbPower:'orb', orbSize:'orb', orbPulse:'orb', twinOrbit:'orb', orbitStorm:'orb', elementalWake:'orb',
  spellCard:'spell', fireRing:'spell', homingBomb:'spell',
  stormCall:'spell', lightning:'spell', spellPower:'spell', spellHaste:'spell', meteorRite:'spell', arcaneTempo:'spell',
  meleePower:'melee', meleeReach:'melee', meleeHaste:'melee', meleeLeech:'melee', bladeWave:'melee', guardBreaker:'melee', duelGuard:'melee',
  barrier:'survival', leech:'survival', secondSkin:'survival',
  dashMastery:'movement', afterimage:'movement', phaseStep:'movement', blinkStrike:'movement', kineticCharge:'movement', adrenaline:'movement',
  laserDrone:'summon', guardianTurret:'summon', mineLayer:'summon', repairDrone:'summon',
  shieldBot:'summon', bladeSentinel:'summon',
  summonDuration:'summon', summonPower:'summon', summonHaste:'summon',
  factoryGate:'summon', soulLinkArmy:'summon',
  crimsonCyclone:'melee', phantomDuelist:'melee',
  starfallDash:'movement', echoStep:'movement',
  orbGalaxy:'orb', gravityCore:'orb',
  archmageLoop:'spell', celestialVerdict:'spell',
  bulletHellEngine:'bullet', executionRounds:'bullet',
  critLuck:'luck', luckRarity:'luck', healDrop:'luck', luckyDraw:'luck', pickStreak:'luck', lootDrop:'luck',
  detonate:'bullet', roundSurge:'bullet', orbMastery:'orb',
  // pad-out
  steadyPulse:'survival', ironPlate:'survival', berserkerHeart:'survival',
  vitalCore:'survival', bloodGrowth:'survival', bossPlate:'survival', overhealFrame:'survival', crystalHeart:'survival',
  magneticRounds:'bullet', hollowPoint:'bullet',
  iceSpike:'spell',
  crystalLining:'economy',
  sweepStep:'melee', bloodthirst:'melee', bladeDance:'melee', stonebreaker:'melee',
  // Elemental cards use the spell category so they sit near the other
  // reaction-driving skills (Fire Ring, Storm Call, Ice Spike).
  elementalMastery:'spell', lingeringMarks:'spell', imbueRounds:'bullet',
  longShot:'bullet',
  // Weapon-handling — mag/reload cards live with the rest of the gun stack.
  magSize:'bullet', reloadSpeed:'bullet',
  // Economy — crystal/run-shop synergy bucket.
  crystalLuck:'economy', shopOffer:'economy', crystalHeal:'economy',
  crystalPower:'economy', frugalShop:'economy', crystalSurge:'economy',
};
const SKILL_CAT_INFO = {
  bullet:   {label:'BULLET',   color:'#00eeff'},
  orb:      {label:'ORB',      color:'#ff8800'},
  spell:    {label:'SPELL',    color:'#cc33ff'},
  survival: {label:'SURVIVAL', color:'#44ff88'},
  movement: {label:'MOVEMENT', color:'#44aaff'},
  summon:   {label:'SUMMON',   color:'#ffdd44'},
  melee:    {label:'MELEE',    color:'#ffcc55'},
  luck:     {label:'LUCK',     color:'#ffee77'},
  economy:  {label:'ECONOMY',  color:'#69f7ff'},
};
const RARITY_ORDER = {common:0, uncommon:1, rare:2, epic:3, legendary:4, divine:5};
const RARITY_INFO = {
  // weight is the per-skill RNG weight in mixed-rarity weighted picks (normal waves).
  // For onlyRarity picks (boss waves), all picks share the same weight so the relative
  // scaling cancels out — only the relative `skillWeights` per-skill bias matters there.
  // Normal-wave offering odds with these weights: ~5% chance an epic appears in the
  // 3-card offering, ~1% chance a legendary appears.
  common:    {label:'COMMON',    max:5, weight:1.00,  color:'#9fb7c8'},
  uncommon:  {label:'UNCOMMON',  max:4, weight:0.62,  color:'#44ff88'},
  rare:      {label:'RARE',      max:3, weight:0.28,  color:'#44aaff'},
  epic:      {label:'EPIC',      max:2, weight:0.02,  color:'#cc66ff'},
  legendary: {label:'LEGENDARY', max:1, weight:0.005, color:'#ffd700'},
  divine: {label:'DIVINE ASCENSION', max:1, weight:0.001, color:'#fff1ff'},
};
const SKILL_RARITY = {
  grenadeAscension:'divine',grenadeRadius:'uncommon',grenadeCore:'rare',grenadePrimer:'rare',
  burstAscension:'divine',burstControl:'uncommon',burstConvergence:'rare',burstOpening:'rare',
  ak47Ascension:'divine',ak47Control:'uncommon',ak47Momentum:'rare',ak47Tactical:'rare',
  eventHorizon:'uncommon', unstableCollapse:'rare', persistentSingularity:'rare', gravityAscension:'divine',
  pistolRicochet:'uncommon',pistolPrecision:'rare',pistolLastWord:'rare',pistolAscension:'divine',shotgunImpact:'rare',shotgunRain:'uncommon',shotgunFocus:'rare',shotgunAscension:'divine',
  bulletPower:'common', rapidFire:'common', pierce:'common', orbPower:'common', orbSpeed:'common',
  spellPower:'common', spellHaste:'common', meleePower:'common', meleeReach:'common', meleeHaste:'common', summonHaste:'common',
  spread:'uncommon', explosive:'uncommon', bounce:'uncommon', heavyRounds:'uncommon',
  fireball:'uncommon', iceOrb:'uncommon', poisonOrb:'uncommon', barrier:'uncommon', leech:'uncommon',
  dashMastery:'uncommon', repairDrone:'uncommon', summonPower:'uncommon', summonDuration:'uncommon',
  thunderOrb:'rare', orbSize:'rare', orbPulse:'rare', lightning:'rare', spellCard:'rare',
  fireRing:'rare', homingBomb:'rare', meleeLeech:'rare', phaseStep:'rare', afterimage:'rare',
  mineLayer:'rare', laserDrone:'rare', shieldBot:'rare',
  stormCall:'epic', blinkStrike:'epic', kineticCharge:'epic', adrenaline:'epic',
  guardianTurret:'epic', bladeSentinel:'epic', railBurst:'epic', overclockBarrage:'epic',
  twinOrbit:'epic', orbitStorm:'epic', elementalWake:'epic', meteorRite:'epic', arcaneTempo:'epic',
  bladeWave:'epic', guardBreaker:'epic', duelGuard:'epic', secondSkin:'epic',
  factoryGate:'legendary', soulLinkArmy:'legendary',
  crimsonCyclone:'legendary', phantomDuelist:'legendary',
  starfallDash:'legendary', echoStep:'legendary',
  orbGalaxy:'legendary', gravityCore:'legendary',
  archmageLoop:'legendary', celestialVerdict:'legendary',
  bulletHellEngine:'legendary', executionRounds:'legendary',
  // Luck category
  luckRarity:'common', critLuck:'uncommon', healDrop:'rare', luckyDraw:'epic', pickStreak:'legendary',
  lootDrop:'epic',
  // Weapon handling
  magSize:'uncommon', reloadSpeed:'uncommon',
  // Economy
  crystalLuck:'common', crystalHeal:'uncommon',
  shopOffer:'rare', frugalShop:'rare',
  crystalPower:'epic', crystalSurge:'epic',
  // New: bullet/orb upgrades
  detonate:'rare', roundSurge:'rare', orbMastery:'rare',
  // Survival pad-out
  steadyPulse:'common', vitalCore:'common',
  ironPlate:'uncommon', bloodGrowth:'uncommon',
  berserkerHeart:'rare', bossPlate:'rare', overhealFrame:'rare',
  crystalHeart:'epic',
  // Bullet pad-out
  magneticRounds:'rare', hollowPoint:'uncommon',
  // Spell pad-out
  iceSpike:'rare',
  // Economy pad-out
  crystalLining:'uncommon',
  // Melee pad-out
  sweepStep:'uncommon', bloodthirst:'rare', bladeDance:'rare', stonebreaker:'legendary',
  // Elemental build
  elementalMastery:'uncommon', lingeringMarks:'rare', imbueRounds:'epic',
  // Range
  longShot:'uncommon',
};
function skillEligible(id){
  const def=SKILL_DEFS[id];
  return !!def&&(!def.requiresGun||player.gun===def.requiresGun)&&(!def.requiresMelee||player.meleeWeapon===def.requiresMelee);
}
function skillRarity(id){ return SKILL_RARITY[id] || 'common'; }
function skillMaxLevel(id){ return RARITY_INFO[skillRarity(id)]?.max || 5; }
function skillPickLevel(id){ return playerSkillPicks[id] || 0; }
function skillEffectiveLevel(id, pickLevel=skillPickLevel(id)){
  const max=skillMaxLevel(id);
  const maps={
    5:[0,1,2,3,4,5],
    4:[0,1,2,4,5],
    3:[0,1,3,5],
    2:[0,3,5],
    1:[0,5],
  };
  return maps[max]?.[Math.max(0,Math.min(max,pickLevel))] || pickLevel;
}
function skillDesc(id, pickLevel){
  const def=SKILL_DEFS[id]; if(!def) return '';
  const desc=def.desc||[];
  const eff=skillEffectiveLevel(id,pickLevel);
  // First-pick override: when a higher-rarity skill jumps the player straight
  // to an effective level >1 (e.g. epic pick 1 → eff 3), prefer the lowest
  // non-empty desc up to eff so the card explains what the skill IS rather
  // than the lv3 increment. Without this, Guardian Walker pick 1 reads
  // "Walker fires faster" — describing an upgrade, not the unit itself.
  if(pickLevel<=1){
    for(let i=1;i<eff;i++){
      if(desc[i]) return desc[i];
    }
  }
  if(desc[eff]) return desc[eff];
  // desc[eff] empty: walk back, then forward, for any non-empty entry. Covers
  // legendaries whose only filled slot is desc[5].
  for(let i=eff-1;i>=1;i--) if(desc[i]) return desc[i];
  for(let i=eff+1;i<desc.length;i++) if(desc[i]) return desc[i];
  return desc[pickLevel] || '';
}
// Per-run skill weights (reset on new game)
const skillWeights = {};
let factoryGateCd=0, gravityCoreT=0, celestialVerdictCd=0, archmageLoopCd=0, bulletHellShots=0, soulLinkHealT=0;
let railBurstShots=0, overclockBarrageShots=0, orbitStormCd=0, elementalWakeCd=0, meteorRiteCd=0;
let crimsonCycloneT=0, crimsonCycloneTick=0;
// Bloodthirst (melee) — stack count + remaining buff window (seconds). Set
// in killEnemy when a kill is attributed to a melee swing, decayed in update.
let _meleeSwingActive=false;
let iceSpikeCd=0;

function weightedSkillPick(n, opts={}){
  const only=opts.onlyRarity;
  const maxR=opts.maxRarity || 'divine';
  const maxOrder=RARITY_ORDER[maxR] ?? RARITY_ORDER.legendary;
  // Optional exclude list — used by per-slot rarity rolling (e.g. boss
  // offering) so the same skill id can't appear twice in the same offer.
  const excludeSet=opts.exclude ? new Set(opts.exclude) : null;
  let avail=Object.keys(SKILL_DEFS).filter(id=>{
    if(!skillEligible(id))return false;
    if(excludeSet&&excludeSet.has(id)) return false;
    const rarity=skillRarity(id);
    if(only&&rarity!==only) return false;
    if(!only&&(RARITY_ORDER[rarity]??0)>maxOrder) return false;
    return skillPickLevel(id)<skillMaxLevel(id);
  });
  if(!avail.length&&opts.fallbackMaxRarity){
    const fallbackOrder=RARITY_ORDER[opts.fallbackMaxRarity] ?? RARITY_ORDER.rare;
    avail=Object.keys(SKILL_DEFS).filter(id=>skillEligible(id)&&(!excludeSet||!excludeSet.has(id))&&(RARITY_ORDER[skillRarity(id)]??0)<=fallbackOrder&&skillPickLevel(id)<skillMaxLevel(id));
  }
  // Luck of Draw (common): multiplies epic/legendary weights so higher rarities surface
  // more often in normal weighted picks. For onlyRarity (boss) picks, every entry shares
  // the same multiplier so relative weights cancel — no behavior change there.
  const _luckMult = LUCK_RARITY_MULT[playerSkills.luckRarity||0] || 1;
  const pool=[...avail], poolW=avail.map(id=>{
    const r=skillRarity(id);
    const rWeight=RARITY_INFO[r]?.weight||1;
    let luckBoost=(r==='epic'||r==='legendary'||r==='divine')?_luckMult:1;
    if(hasRelic('luckyDebt')){
      const _ldBias = RELIC_LEVELS.luckyDebt.rarityBias[relicLevel('luckyDebt')];
      if(r==='rare') luckBoost*=1 + 0.25*_ldBias;
      else if(r==='epic') luckBoost*=1 + 1.20*_ldBias;
      else if(r==='legendary') luckBoost*=1 + 2.00*_ldBias;
    }
    return (skillWeights[id]||1.0)*rWeight*luckBoost;
  });
  const chosen=[];
  for(let i=0;i<n&&pool.length>0;i++){
    let total=poolW.reduce((a,b)=>a+b,0);
    if(total<=0){ poolW.fill(1); total=poolW.length; }
    let r=Math.random()*total, idx=0;
    while(idx<pool.length-1&&r>poolW[idx]){r-=poolW[idx];idx++;}
    chosen.push(pool[idx]); pool.splice(idx,1); poolW.splice(idx,1);
  }
  return chosen;
}

const STATUS_BUFFS = [
  { id:'maxhp', name:'+20 Max HP',    icon:'❤️', fn(){ addPlayerMaxHp(20); } },
  { id:'atk',   name:'+3 Attack',      icon:'⚔️', fn(){ playerStats.attackDmg+=3; } },
  { id:'heal',  name:'Recover 40 HP', icon:'💊', fn(){ healPlayer(40); } },
];

const LEECH_HP     = [0,3,6,9,12,15];
const MELEE_DMG_MULT = [1,1.35,1.70,2.05,2.45,2.90];
const MELEE_RANGE_MULT = [1,1.20,1.40,1.60,1.80,2.00];
const MELEE_ARC_MULT = [1,1.08,1.16,1.24,1.32,1.42];
const MELEE_CD_MULT = [1,0.88,0.78,0.68,0.60,0.52];
const MELEE_LIFESTEAL = [0,0.04,0.07,0.10,0.13,0.16];
const MELEE_LIFESTEAL_CAP = [0,8,12,18,24,32];
const BARRIER_CD   = [0,8,7,5,4,3];
function meleeStatsFor(weapon, opts={}){
  const base=MELEE_WEAPONS[weapon]||MELEE_WEAPONS.katana;
  const dmgLvl=playerSkills.meleePower||0;
  const rangeLvl=playerSkills.meleeReach||0;
  const hasteLvl=playerSkills.meleeHaste||0;
  const leechLvl=playerSkills.meleeLeech||0;
  const guardRank=epicRank('guardBreaker');
  const guardDmg=[1,1.24,1.48][guardRank]||1;
  const guardStagger=[1,1.25,1.55][guardRank]||1;
  const relicDmg=hasRelic('berserkerGrip')?RELIC_LEVELS.berserkerGrip.meleeMul[relicLevel('berserkerGrip')]:1;
  return {
    ...base,
    range:Number.isFinite(opts.range)?opts.range:base.range*(MELEE_RANGE_MULT[rangeLvl]||1),
    arc:Number.isFinite(opts.arc)?opts.arc:Math.min(Math.PI*1.7,base.arc*(MELEE_ARC_MULT[rangeLvl]||1)),
    cd:Number.isFinite(opts.cd)?opts.cd:base.cd*(MELEE_CD_MULT[hasteLvl]||1),
    dmgMult:Number.isFinite(opts.dmgMult)?opts.dmgMult:base.dmgMult*(MELEE_DMG_MULT[dmgLvl]||1)*guardDmg*relicDmg,
    stagger:(base.stagger||0.16)*guardStagger,
    lifeSteal:Number.isFinite(opts.lifeSteal)?opts.lifeSteal:(MELEE_LIFESTEAL[leechLvl]||0),
    lifeStealCap:Number.isFinite(opts.lifeStealCap)?opts.lifeStealCap:(MELEE_LIFESTEAL_CAP[leechLvl]||0),
  };
}
const HEAVY_SCALE  = [1,1.35,1.70,2.10,2.55,3.0];  // bullet mesh scale
const HEAVY_R      = [0,0.08,0.16,0.24,0.32,0.40]; // extra hit radius
const ORB_SPD_MULT = [1,1.30,1.65,2.05,2.50,3.0];  // multiplied onto base orbit speed
const ORB_PWR_MULT = [1,1.25,1.55,1.85,2.15,2.45]; // multiplied onto base orb damage
// Orb Mastery rare — buffs orb damage AND speed together. Effective-level
// indexed so rare picks land at lv 1 / 3 / 5.
const ORB_MASTERY_PWR = [1,1.35,1.55,1.75,2.00,2.30];
const ORB_MASTERY_SPD = [1,1.25,1.40,1.60,1.80,2.00];
function orbDamageMult(){
  let mult=playerSkills.orbGalaxy ? 0.8 : 1;
  if(hasRelic('orbEngine')) mult*=RELIC_LEVELS.orbEngine.orbDmgMul[relicLevel('orbEngine')];
  mult*=ORB_MASTERY_PWR[playerSkills.orbMastery||0]||1;
  return mult;
}
function orbSpeedMult(){
  return ORB_SPD_MULT[playerSkills.orbSpeed||0]*(ORB_MASTERY_SPD[playerSkills.orbMastery||0]||1);
}
const ORB_SIZE_SCL = [1,1.22,1.46,1.72,2.02,2.65]; // orb mesh scale
const ORB_SIZE_R   = [0,0.12,0.26,0.42,0.60,1.18]; // extra hit radius
const ORB_PULSE_AMP = [0,0.55,1.2,2.0,2.90,4.0]; // orbit radius breathing amplitude
const ORB_PULSE_RATE = [0,0.0018,0.0020,0.0022,0.0024,0.0028];
const BOUNCE_MAX   = [0,1,2,3,4,5];
const SPELLCARD_N  = [0,8,12,16,20,24];
const SPELLCARD_CD = [0,6,5,4,3.5,3];
const LIGHTNING_INTERVAL = [0,4,3,3,2,1.5];
const LIGHTNING_DMG      = [0,45,70,100,130,160];
// Bullet / Spell power modifiers
const BULLET_PWR_MULT = [1,1.25,1.55,1.85,2.15,2.45];
const SPELL_PWR_MULT  = [1,1.30,1.62,1.95,2.28,2.60];
const SPELL_CD_MULT   = [1,0.88,0.78,0.68,0.58,0.50];
// Fire Ring spell
const FIRERING_DMG    = [0,60,95,140,195,255];
const FIRERING_R      = [0,5.0,7.0,9.0,12.0,15.0];
const FIRERING_CD_BASE= [0,5.5,5.0,4.5,4.0,3.5];
// Homing Bomb spell
const HOMING_N        = [0,1,1,2,3,4];
const HOMING_DMG      = [0,70,100,140,190,250];
const HOMING_EXPLR    = [0,2.0,2.5,3.0,3.5,4.2];
const HOMING_CD_BASE  = [0,4.5,4.0,3.5,3.0,2.5];
// Storm Call spell
const STORMCALL_DMG     = [0,55,90,130,175,225];
const STORMCALL_CD_BASE = [0,3.5,3.0,2.5,2.0,1.5];
const STORMCALL_TARGETS = [0,1,1,2,2,3];
const LIGHTNING_TARGETS  = [0,1,1,2,3,4];
const FIREBALL_COUNT = [0,1,2,3,4,4];
const FIREBALL_SPD   = [0,1.8,1.8,1.8,1.8,3.6];
const FIREBALL_ORBIT = 4.0;
function orbOrbitRadius(nowMs, skills=playerSkills){
  const lvl=skills.orbPulse||0;
  if(!lvl) return FIREBALL_ORBIT;
  const amp=ORB_PULSE_AMP[lvl]||0;
  const rate=ORB_PULSE_RATE[lvl]||ORB_PULSE_RATE[1];
  return Math.max(2.2, FIREBALL_ORBIT + Math.sin(nowMs*rate)*amp);
}
function orbPulseRadius(nowMs, skills=playerSkills){
  return orbOrbitRadius(nowMs, skills);
}
const EXPLOSIVE_R    = [0,1.2,1.8,2.4,3.0,3.8];
const DASH_CD       = [1.25,1.05,0.88,0.72,0.58,0.45];
const DASH_DUR      = [0.16,0.17,0.18,0.19,0.20,0.21];
const DASH_SPEED    = [22,23,24.5,26,28,30];
const AFTER_DMG     = [0,100,140,185,240,320];
const AFTER_R       = [0,1.25,1.42,1.62,1.85,2.12];
const AFTER_DELAY   = [0,0.38,0.34,0.30,0.26,0.22];
const PHASE_SLOW    = [0,0.85,1.15,1.50,1.85,2.25];
const PHASE_VULN    = [0,0.12,0.16,0.21,0.27,0.35];
const BLINK_DMG     = [0,95,135,185,250,340];
const BLINK_RANGE   = [0,2.8,3.3,3.9,4.5,5.2];
const BLINK_BURST_R = [0,1.05,1.18,1.35,1.55,1.85];
const KINETIC_DMG   = [0,90,125,170,230,310];
const KINETIC_R     = [0,1.35,1.55,1.80,2.10,2.50];
const KINETIC_DIST  = [0,16,14,12,10,8.5];
const ADREN_SPEED   = [1,1.15,1.22,1.32,1.42,1.55];
const DRONE_COUNT   = [0,1,2,2,3,3];
const DRONE_CD      = [0,0.85,0.85,0.62,0.62,0.42];
const DRONE_DMG     = [0,24,26,32,34,46];
const TURRET_CD     = [0,10,9,8,7,6];
const TURRET_COUNT  = [0,3,4,5,6,7];
const TURRET_DUR    = [0,45,48,52,56,60];
const TURRET_FIRE_CD= [0,0.72,0.64,0.48,0.42,0.38];
const TURRET_DMG    = [0,22,28,34,46,52];
const MINE_DMG      = [0,70,100,120,155,190];
const MINE_R        = [0,1.7,1.9,2.1,2.45,2.8];
const REPAIR_HEAL   = [0,12,18,24,32,42];
const REPAIR_TICK   = [0,3.8,3.4,3.0,2.6,2.2];
// Summon HP
const DRONE_HP         = [0, 55,  65,  80,  95,  115];
const TURRET_HP        = [0, 110, 140, 180, 225, 280];
const SHIELDBOT_COUNT  = [0, 1, 1, 1, 1, 1];
const SHIELDBOT_HP     = [0, 220, 290, 370, 470, 620];
const SHIELDBOT_DMG    = [0, 8, 12, 16, 22, 30];
const SHIELDBOT_RESPAWN_BASE = 13.0;
const SHIELDBOT_LIFE   = [0, 42, 46, 50, 55, 60];
const SENTINEL_COUNT   = [0, 1, 1, 1, 1, 1];
const SENTINEL_DMG     = [0, 30, 45, 58, 75, 100];
const SENTINEL_SPD     = [0, 5.5, 6.5, 7.5, 8.5, 10.0];
const SENTINEL_HP      = [0, 70,  90, 115, 145, 180];
const SENTINEL_RESPAWN_BASE = 8.0;
const SENTINEL_LIFE    = [0, 28, 32, 36, 40, 45];
const DRONE_SPAWN_CD   = [0, 8.0, 7.4, 6.8, 6.2, 5.5];
const DRONE_LIFE       = [0, 30, 34, 38, 42, 48];
const REPAIR_COUNT     = [0, 1, 1, 1, 1, 1];
const REPAIR_HP        = [0, 34, 42, 52, 64, 78];
const REPAIR_SPAWN_CD  = [0, 11, 10, 9, 8, 7];
const REPAIR_LIFE      = [0, 36, 40, 44, 50, 56];
// Enhance card multipliers
// Summon scaling capped after a balance pass — the wall-of-allies build was
// borderline untouchable with the old +75% duration / +145% power maxes.
// Durability tops out at +50%; Power at ×2.00.
const SUMMON_DUR_MULT   = [1, 1.10, 1.20, 1.30, 1.40, 1.50];
const SUMMON_PWR_MULT   = [1, 1.20, 1.45, 1.70, 1.85, 2.00];
// Summon Haste nerf — original values cut respawn time by up to 65%, which
// combined with the rest of the summon stack made the player borderline
// untouchable behind a wall of allies. Halved the effective speed-up so
// summons are still useful but not a body-block fortress.
const SUMMON_HASTE_MULT = [1, 0.90, 0.83, 0.76, 0.71, 0.68];
const SUMMON_ACTIVE_CAP = 10;
const SUMMON_LIFE_CAP = 30;

// ── Luck skills ───────────────────────────────────────────
const CRIT_LUCK_BONUS    = [0, 0.075, 0.150, 0.190, 0.225, 0.300];
const LUCK_RARITY_MULT   = [1, 1.30,  1.70,  2.15,  2.65,  3.20];
const HEAL_DROP_CHANCE   = [0, 0.04,  0.07,  0.10,  0.14,  0.18];
// Heal as fraction of the picker's max HP (computed at pickup time, so high-HP
// builds get more from the same bag).
const HEAL_DROP_PCT      = [0, 0.10,  0.15,  0.20,  0.25,  0.30];
const LUCKY_DRAW_CHANCE  = [0, 0,     0,     0.20,  0,     0.40]; // epic: idx 3 & 5
const PICK_STREAK_CHANCE = [0, 0,     0,     0,     0,     0.50]; // legendary: idx 5
const SUMMON_CONTACT_DMG = 28;

// Orbital skill shared constants
const ORB_COUNT = [0,1,2,3,4,4];
const ORB_SPD   = [0,1.6,1.6,1.6,1.6,3.2];
const ORB_RENDER_ORDER = 112;
const ORB_TRAIL_RENDER_ORDER = 111;

// Per-type orb geometries (distinct shapes make each skill feel unique)
const ORB_GEOS = {
  fireball:   new THREE.SphereGeometry(0.32,8,6),
  iceOrb:     new THREE.IcosahedronGeometry(0.28,0),
  thunderOrb: new THREE.TetrahedronGeometry(0.30,0),
  poisonOrb:  new THREE.SphereGeometry(0.20,5,4),
};

// Fireball orbital meshes
const fireballMeshes = [];
let fireballAngle = 0;
const fireballHitCd = new Map();

// Ice orb
const iceOrbMeshes = [];
let iceOrbAngle = Math.PI/3;
const iceHitCd = new Map();
const slowMap = new Map(); // poolIdx -> remaining slow time
const phaseVulnMap = new Map(); // poolIdx -> {t, mult}
// Elemental tag state — enemy.elemTag holds last applied element + ttl. When a
// second different element arrives within the ttl window, runElementReaction
// fires the appropriate pair effect and clears the tag.
const elementTagMap = new Map(); // poolIdx -> { elem, t, srcDmg, indicator? }
const ELEM_TAG_DUR = 3.0;
// Imbue Rounds — set briefly by the bullet hit handler before calling
// tagElement so runElementReaction can scale a bullet-triggered reaction
// down (the player gets multiple reactions per second otherwise). Reset
// after one use.
let _imbuedReactionDmg = 1;
const IMBUE_ELEMS = ['fire','ice','thunder','poison'];
const ELEM_COLORS = {
  fire:   { hex:0xff5500, css:'#ff7733' },
  ice:    { hex:0x88ddff, css:'#aaeaff' },
  thunder:{ hex:0xffff44, css:'#fff066' },
  poison: { hex:0x66ff66, css:'#88ff88' },
};

// Thunder orb
const thunderOrbMeshes = [];
let thunderOrbAngle = Math.PI*2/3;
const thunderHitCd = new Map();

// Poison orb
const poisonOrbMeshes = [];
let poisonOrbAngle = Math.PI;
const poisonHitCd = new Map();
const poisonMap = new Map(); // poolIdx -> {t, tick, dmg}

const afterimageZones = [];

// Lightning
let lightningT = 0;

// Barrier shield mesh
let barrierMesh = null;

function _orbMat(c,op){ return new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false}); }
function _applyOrbLayer(g){
  g.renderOrder=ORB_RENDER_ORDER;
  g.traverse(o=>{
    o.renderOrder=ORB_RENDER_ORDER;
    o.frustumCulled=false;
    if(o.material){
      const mats=Array.isArray(o.material)?o.material:[o.material];
      mats.forEach(m=>{ m.depthWrite=false; m.depthTest=false; });
    }
  });
}
function createOrbTrail(color){ return createTrail(color, ORB_TRAIL_RENDER_ORDER, true); }
function _buildOrbMesh(skillId, color){
  const g = new THREE.Group(); g.frustumCulled=false;
  if(skillId==='fireball'){
    const core  = new THREE.Mesh(new THREE.SphereGeometry(0.32,9,7),       _orbMat(color,0.98));
    const hot   = new THREE.Mesh(new THREE.SphereGeometry(0.16,6,5),       _orbMat(0xffff99,0.65));
    const ring  = new THREE.Mesh(new THREE.TorusGeometry(0.40,0.055,5,22), _orbMat(0xffaa00,0.70));
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.36,0.030,4,16), _orbMat(0xff6600,0.45));
    const aura  = new THREE.Mesh(new THREE.SphereGeometry(0.62,8,6),       _orbMat(color,0.14));
    ring.rotation.x=Math.PI/2; ring2.rotation.z=Math.PI/3;
    g.add(core,hot,ring,ring2,aura);
    g.userData={aura,ring,ring2,hot,type:'fireball'};
  } else if(skillId==='iceOrb'){
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.30,0),     _orbMat(color,0.88));
    const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17,0),     _orbMat(0xffffff,0.72));
    const ring  = new THREE.Mesh(new THREE.TorusGeometry(0.36,0.040,4,18), _orbMat(0xccffff,0.58));
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.28,0.025,4,14), _orbMat(0x88ddff,0.38));
    const aura  = new THREE.Mesh(new THREE.SphereGeometry(0.58,8,6),       _orbMat(color,0.12));
    ring.rotation.z=Math.PI/2.5; ring2.rotation.x=Math.PI/2.8;
    g.add(shell,inner,ring,ring2,aura);
    g.userData={aura,ring,ring2,inner,type:'iceOrb'};
  } else if(skillId==='thunderOrb'){
    const core  = new THREE.Mesh(new THREE.OctahedronGeometry(0.28,0),      _orbMat(color,0.92));
    const inner = new THREE.Mesh(new THREE.TetrahedronGeometry(0.18,0),     _orbMat(0xffffff,0.70));
    const ring  = new THREE.Mesh(new THREE.TorusGeometry(0.38,0.040,4,14), _orbMat(0xffffff,0.60));
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.30,0.028,3,12), _orbMat(color,0.44));
    const aura  = new THREE.Mesh(new THREE.SphereGeometry(0.60,7,6),       _orbMat(color,0.16));
    ring.rotation.x=Math.PI/4; ring2.rotation.y=Math.PI/3;
    g.add(core,inner,ring,ring2,aura);
    g.userData={aura,ring,ring2,inner,type:'thunderOrb'};
  } else { // poisonOrb
    const core    = new THREE.Mesh(new THREE.SphereGeometry(0.22,6,5),       _orbMat(color,0.95));
    const nucleus = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12,0),    _orbMat(0xaaffaa,0.68));
    const ring    = new THREE.Mesh(new THREE.TorusGeometry(0.32,0.058,5,18), _orbMat(0x33ff44,0.55));
    const ring2   = new THREE.Mesh(new THREE.TorusGeometry(0.25,0.030,4,14), _orbMat(0x88ff88,0.35));
    const aura    = new THREE.Mesh(new THREE.SphereGeometry(0.62,7,5),       _orbMat(color,0.13));
    ring.rotation.x=Math.PI/2; ring2.rotation.z=Math.PI/4;
    g.add(core,nucleus,ring,ring2,aura);
    g.userData={aura,ring,ring2,nucleus,type:'poisonOrb'};
  }
  _applyOrbLayer(g);
  return g;
}

function _buildOrbs(meshArr, hitCdMap, skillId, color){
  meshArr.forEach(m=>{
    disposeTrail(m.userData.trail);
    m.traverse(o=>{ o.geometry?.dispose?.(); o.material?.dispose?.(); });
    scene.remove(m);
  });
  meshArr.length=0; hitCdMap.clear();
  if(orbLights) orbLights[skillId].intensity=0;
  const baseCount=ORB_COUNT[playerSkills[skillId]||0]||0;
  const twinBonus=baseCount>0?epicRank('twinOrbit'):0; // 0 / +1 / +2
  const splitMult=baseCount>0&&playerSkills.orbGalaxy?2:1;
  // Orb Engine — +N extra orbs per type instead of a flat ×1.5 mult.
  const oeExtra = (baseCount>0 && hasRelic('orbEngine'))
    ? (RELIC_LEVELS.orbEngine.extraOrbs[relicLevel('orbEngine')]||0) : 0;
  const count=Math.min(hasRelic('orbEngine')?18:12,Math.ceil((baseCount+twinBonus)*splitMult + oeExtra));
  for(let i=0;i<count;i++){
    const m=_buildOrbMesh(skillId,color);
    scene.add(m);
    m.userData.trail=createOrbTrail(color);
    meshArr.push(m);
  }
}
function rebuildFireballs(){ _buildOrbs(fireballMeshes,fireballHitCd,'fireball',0xff5500); }
function rebuildIceOrbs(){    _buildOrbs(iceOrbMeshes,iceHitCd,'iceOrb',0x88ddff); }
function rebuildThunderOrbs(){ _buildOrbs(thunderOrbMeshes,thunderHitCd,'thunderOrb',0xffff44); }
function rebuildPoisonOrbs(){ _buildOrbs(poisonOrbMeshes,poisonHitCd,'poisonOrb',0x55ee44); }

const ghostPool = [];
const GHOST_POOL_SIZE = 28;
function initGhostPool(){
  for(const g of ghostPool){ scene.remove(g); g.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();}); }
  ghostPool.length=0;
  for(let i=0;i<GHOST_POOL_SIZE;i++){
    const g=new THREE.Group(); g.frustumCulled=false;
    const bMat=new THREE.MeshBasicMaterial({color:0x44aaff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
    const hMat=new THREE.MeshBasicMaterial({color:0x88ddff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
    const body=new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.58,1.1,14),bMat);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.36,8,8),hMat); head.position.y=0.88;
    g.add(body,head);
    g.userData={bMat,hMat,t:0,dur:0.35};
    g.visible=false;
    scene.add(g);
    ghostPool.push(g);
  }
}
function sendDashGhostMP(x,z,rotY,id=mp.myId){
  if(!mp.connected||mp.soloMode) return;
  const msg={
    type:'DASH_GHOST',id,
    x:Math.round(x*100)/100,z:Math.round(z*100)/100,
    rot:Math.round((rotY||0)*100)/100,
  };
  if(mp.isHost) broadcastMP(msg);
  else sendToHost(msg);
}

function spawnDashGhost(x,z,rotY,id=mp.myId,relay=true){
  if(!ghostPool.length) initGhostPool();
  const g=ghostPool.find(gh=>!gh.visible||gh.userData.t<=0);
  if(!g) return;
  const col=PLAYER_COLORS[(id||0)%MAX_PLAYERS];
  g.userData.bMat.color.setHex(col.body);
  g.userData.hMat.color.setHex(col.emi);
  g.position.set(x,0.55,z); g.rotation.y=rotY;
  g.userData.t=g.userData.dur; g.visible=true;
  g.userData.bMat.opacity=0.50;
  g.userData.hMat.opacity=0.46;
  if(relay) sendDashGhostMP(x,z,rotY,id);
}

function buildBarrierVisual(){
  if(barrierMesh){
    barrierMesh.traverse(o=>{ o.geometry?.dispose?.(); o.material?.dispose?.(); });
    scene.remove(barrierMesh);barrierMesh=null;
  }
  if(!(playerSkills.barrier||0)) return;
  const mat = new THREE.MeshBasicMaterial({color:0x44aaff,transparent:true,opacity:0.20,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  barrierMesh = new THREE.Mesh(new THREE.SphereGeometry(1.1,10,8),mat);
  const ringMat=new THREE.MeshBasicMaterial({color:0x88ddff,transparent:true,opacity:0.42,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const r1=new THREE.Mesh(new THREE.TorusGeometry(1.12,0.025,6,42),ringMat);
  const r2=new THREE.Mesh(new THREE.TorusGeometry(1.0,0.018,6,42),ringMat.clone());
  r1.rotation.x=Math.PI/2; r2.rotation.z=Math.PI/2.6;
  barrierMesh.add(r1,r2);
  barrierMesh.visible = false; scene.add(barrierMesh);
}

const summonDrones = [];
const turrets = [];
const mines = [];
let turretSpawnCd = 0;
let mineDropCd = 0;
const droneGeo     = new THREE.OctahedronGeometry(0.28,0);
const turretGeo    = new THREE.CylinderGeometry(0.34,0.42,0.7,8);
const mineGeo      = new THREE.CylinderGeometry(0.34,0.42,0.16,8);
const shieldBotGeo = new THREE.IcosahedronGeometry(0.22,0);
const sentinelGeo  = new THREE.TetrahedronGeometry(0.32,0);
const shieldBots   = [];
let shieldBotSpawnCd = 0;
const sentinels    = [];
let sentinelSpawnCd = 0;
const sentinelHitLocks = new Map();
const repairDrones = [];
let repairDroneSpawnCd = 0;
let droneSpawnCd = 0;

function getSummonHpMult(){
  return SUMMON_DUR_MULT[playerSkills.summonDuration||0] * SUMMON_PWR_MULT[playerSkills.summonPower||0];
}
function getSummonDmgMult(){
  return SUMMON_PWR_MULT[playerSkills.summonPower||0];
}
function getSummonCdMult(){
  return SUMMON_HASTE_MULT[playerSkills.summonHaste||0];
}
function getSummonDurMult(){
  return SUMMON_DUR_MULT[playerSkills.summonDuration||0];
}
function summonLife(baseLife){
  return Math.min(SUMMON_LIFE_CAP, baseLife*getSummonDurMult());
}
function getSummonSizeMult(){
  return Math.sqrt(getSummonDmgMult());
}

function nearestEnemy(x,z,maxDist=999){
  let best=null,bestDist=maxDist;
  for(let i=0;i<enemies.length;i++){
    const e=enemies[i]; if(!e||e.dead) continue;
    const d=Math.hypot(e.pos.x-x,e.pos.z-z);
    if(d<bestDist){best={enemy:e,idx:i,dist:d};bestDist=d;}
  }
  return best;
}

// ── Enemy spatial hash (bullet broadphase) ───────────────
// Rebuilt once per frame right before the bullet pass — enemies are done moving
// by then, so positions stay stable for the whole pass and the grid matches
// exactly what a full scan would read. Each enemy is inserted into every cell
// its body circle touches, so a radius query can never miss a large boss.
// queryEnemyGrid() fills a caller-supplied scratch array (no per-call alloc)
// with the enemies whose cells overlap the query box, de-duped via a per-query
// stamp. This only NARROWS the candidate set: the exact distance test and every
// downstream hit effect stay byte-identical to the old O(bullets*enemies) scan.
// Soundness: two overlapping circles have overlapping bounding boxes, and any
// cell the overlap region touches is in both the enemy's and the query's cell
// set — so there are no false negatives.
const EGRID_CELL = 3.0;
const _egrid = new Map(); // "cx,cz" -> enemy[]
let _egridStamp = 0;
function rebuildEnemyGrid(){
  _egrid.clear();
  for(let i=0;i<enemies.length;i++){
    const e=enemies[i]; if(!e||e.dead) continue;
    e._gi=i; // frame-start live index — used only to order candidates for the tie-break
    const r=(e.cfg&&e.cfg.r)||0.5;
    const minx=Math.floor((e.pos.x-r)/EGRID_CELL), maxx=Math.floor((e.pos.x+r)/EGRID_CELL);
    const minz=Math.floor((e.pos.z-r)/EGRID_CELL), maxz=Math.floor((e.pos.z+r)/EGRID_CELL);
    for(let cx=minx;cx<=maxx;cx++) for(let cz=minz;cz<=maxz;cz++){
      const k=cx+','+cz; let arr=_egrid.get(k); if(!arr){arr=[];_egrid.set(k,arr);} arr.push(e);
    }
  }
}
function queryEnemyGrid(x,z,r,out){
  out.length=0; const stamp=++_egridStamp;
  const minx=Math.floor((x-r)/EGRID_CELL), maxx=Math.floor((x+r)/EGRID_CELL);
  const minz=Math.floor((z-r)/EGRID_CELL), maxz=Math.floor((z+r)/EGRID_CELL);
  for(let cx=minx;cx<=maxx;cx++) for(let cz=minz;cz<=maxz;cz++){
    const arr=_egrid.get(cx+','+cz); if(!arr) continue;
    for(let m=0;m<arr.length;m++){ const e=arr[m]; if(e._qs===stamp) continue; e._qs=stamp; out.push(e); }
  }
  return out;
}
const _bulletCands = []; // scratch reused by the per-bullet collision query
const _magnetCands = []; // scratch reused by the magnetic-rounds seek

function epicRank(id){
  const lvl=playerSkills[id]||0;
  return lvl>=5 ? 2 : (lvl>0 ? 1 : 0);
}

function damageEnemiesInCircle(x,z,r,dmg,color=0xffdd44,stagger=0.1,source='skill'){
  let hits=0;
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i]; if(!e||e.dead) continue;
    if(Math.hypot(e.pos.x-x,e.pos.z-z)<=r+e.cfg.r){
      if(damageEnemyIndex(i,dmg,color,stagger,mp.myId,source)) hits++;
      else hits++;
    }
  }
  return hits;
}

function damageEnemiesInLine(x,z,dx,dz,len,width,dmg,color=0xffdd44,stagger=0.1,source='skill'){
  const dl=Math.hypot(dx,dz)||1;
  dx/=dl; dz/=dl;
  const tx=x+dx*len, tz=z+dz*len;
  let hits=0;
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i]; if(!e||e.dead) continue;
    if(segmentPointDistance(e.pos.x,e.pos.z,x,z,tx,tz)<=width*0.5+e.cfg.r){
      if(damageEnemyIndex(i,dmg,color,stagger,mp.myId,source)) hits++;
      else hits++;
    }
  }
  return hits;
}

function ownerWorldPos(ownerId){
  if(ownerId===mp.myId) return player.pos;
  const rp=mp.remotePlayers[ownerId];
  return rp?.renderPos || rp?.pos || player.pos;
}

function damageEnemyWithSource(idx, base, color=0xffdd44, stagger=0.08, ownerId=mp.myId, sourcePerm=null, source='skill'){
  const e=enemies[idx]; if(!e||e.dead) return false;
  const hitDmg=playerDamageAmount(e,base,sourcePerm);
  e.hp-=hitDmg; e.hitFlashT=0.12; addEnemyStagger(e,stagger);
  showHitNumber(e,hitDmg,cssHex(color),ownerId,source);
  if(e.hp<=0){ killEnemy(e); return true; }
  return false;
}

function bulletExplosionRadius(b){
  const expRank=b.ownerPerm?.explosive ?? (playerSkills.explosive||0);
  const heavyRank=b.ownerPerm?.heavyRounds ?? (playerSkills.heavyRounds||0);
  return (b.explodeR||0)+EXPLOSIVE_R[expRank]*0.35+(HEAVY_R[heavyRank]||0)*2.0;
}

function armPlayerGrenade(b, color=0xffb84d){
  if(!b||!b.explodeR) return false;
  if(b.grenadeArmed) return true;
  b.grenadeArmed=true;
  b.grenadeGroundT=b.grenadeQuick ? 0.5 : 1.0;
  b.grenadeY=0.18;
  b.grenadeVY=0;
  b.spd=0;
  b.bounceLeft=0;
  b.groundBounceLeft=0;
  b.life=Math.max(b.life,1.08);
  const r=bulletExplosionRadius(b);
  spawnWarningCircle(b.pos.x,b.pos.z,r,color,b.grenadeGroundT,null,false);
  spawnShockwave(b.pos.x,b.pos.z,Math.min(1.25,r*0.32),color,0.18,0.34);
  burst(b.pos,color,isMobile?4:8);
  if(b.isPlayer) sGrenadeArm();
  return true;
}

function bounceGrenadeOffEnemy(b,e,color=0xffb84d){
  if(!b||b.bulletKind!=='grenade'||b.grenadeArmed||!e) return false;
  let nx=b.pos.x-e.pos.x, nz=b.pos.z-e.pos.z;
  let nl=Math.hypot(nx,nz);
  if(nl<0.001){ nx=-b.dir.x; nz=-b.dir.z; nl=Math.hypot(nx,nz)||1; }
  nx/=nl; nz/=nl;
  const dot=b.dir.x*nx+b.dir.z*nz;
  if(dot<0){
    b.dir.x-=2*dot*nx;
    b.dir.z-=2*dot*nz;
  } else {
    b.dir.x=nx;
    b.dir.z=nz;
  }
  const dl=Math.hypot(b.dir.x,b.dir.z)||1;
  b.dir.x/=dl; b.dir.z/=dl;
  const push=(e.cfg?.r||0.55)+(b.hitR||0.22)+0.16;
  b.pos.x=e.pos.x+nx*push;
  b.pos.z=e.pos.z+nz*push;
  b.spd=Math.max(4,b.spd*0.78);
  b.grenadeVY=Math.max(b.grenadeVY,2.4);
  if(b.hitSet) b.hitSet.add(e);
  impactPulse(b.pos,color,0.72,isMobile?3:5);
  burst(b.pos,color,isMobile?2:5);
  if(b.isPlayer) sBounce();
  return true;
}

function explodePlayerBullet(b, color=0xff6600, skipIdx=-1){
  if(!b.explodeR) return;
  const r=bulletExplosionRadius(b);
  burst(b.pos,color,isMobile?14:24);
  burst(b.pos,0xffdd88,isMobile?7:14);
  spawnShockwave(b.pos.x,b.pos.z,r,color,0.22,0.78);
  spawnShockwave(b.pos.x,b.pos.z,Math.max(0.45,r*0.42),0xfff0aa,0.14,0.48);
  sGrenadeBoom();
  shakeAmt=Math.max(shakeAmt,0.18);
  if(b.visualOnly) return;
  let hitCount=0;
  for(let i=enemies.length-1;i>=0;i--){
    if(i===skipIdx) continue;
    const e=enemies[i]; if(!e||e.dead) continue;
    const d=Math.hypot(e.pos.x-b.pos.x,e.pos.z-b.pos.z);
    if(d<=r+e.cfg.r){
      hitCount++;
      const fall=1-Math.min(0.65,d/Math.max(1,r))*0.55;
      damageEnemyWithSource(i,Math.max(1,Math.round((b.dmg||20)*(b.explodeMult||0.65)*fall*(b.bulletKind==='grenade'?grenadeCore(b.ownerPerm?.grenadeCore,d,r):1))),color,0.18,b.ownerId??mp.myId,b.ownerPerm,'bullet');
    }
  }
  if(b.bulletKind==='grenade'&&b.supernovaCharging&&hitCount>=2){
    b.supernovaCharging=false;
    if(b.ownerId===mp.myId)supernovaCharge.hit();
    else if(mp.isHost){const c=mp.conns.get(b.ownerId);if(c?.open)c.send(JSON.stringify({type:'SUPERNOVA_CHARGE',targetId:b.ownerId}));}
  }
  // Spawner damage from explosions (grenade / RPG / volatile-bullet). Without
  // this hook the splash carved through enemies around the nest but the nest
  // itself absorbed nothing.
  if(miniObjective?.type==='spawners' && !miniObjective.complete && b.isPlayer){
    for(const sp of (miniObjective.spawners||[])){
      if(!sp.alive) continue;
      const d=Math.hypot(sp.x-b.pos.x,sp.z-b.pos.z);
      if(d<=r+0.6){
        const fall=1-Math.min(0.65,d/Math.max(1,r))*0.55;
        damageMiniObjectiveAt(sp.x,sp.z,Math.max(1,Math.round((b.dmg||20)*(b.explodeMult||0.65)*fall*(b.bulletKind==='grenade'?grenadeCore(b.ownerPerm?.grenadeCore,d,r):1))),0.5,color);
      }
    }
  }
}

function damageEnemyIndex(idx, dmg, color=0xffdd44, stagger=0.08, ownerId=mp.myId, source='skill'){
  const e=enemies[idx]; if(!e||e.dead) return false;
  let safeDmg=dmg*relicDamageMult();
  if(e.type==='boss') safeDmg=Math.min(safeDmg,Math.max(60,e.maxHp*0.055));
  else safeDmg=Math.min(safeDmg,Math.max(45,e.maxHp*0.42));
  // Crit roll for every damage path that flows through here (melee, movement skills,
  // summons, mines, cyclone, meteor rite, etc.). The bullet / orb / spell paths apply
  // crit via playerDamageAmount and write to e.hp directly without calling this
  // function, so there's no double-crit. Crit fires AFTER the safe cap to match the
  // bullet path (which has no cap). rollCrit folds in the Crit Edge luck skill bonus.
  const crit=rollCrit();
  if(crit) safeDmg*=1.85;
  const hitDmg=Math.max(1,Math.round(safeDmg));
  e.hp-=hitDmg; e.hitFlashT=0.12; addEnemyStagger(e,stagger);
  e._lastCrit=crit;
  // ownerId is forwarded so relayed attacks (a client's MELEE_ATTACK landing on
  // the host) credit the original player, not the host. Without this, melee /
  // summon / movement damage from non-host players was attributed to host.
  showHitNumber(e,hitDmg,'#'+color.toString(16).padStart(6,'0'),ownerId,source);
  // showHitNumber sets enemy._lastHitOwner=ownerId, so killEnemy will read the
  // correct owner from there for kill / drop attribution. No need to thread it.
  if(e.hp<=0){ killEnemy(e); return true; }
  return false;
}

function knockEnemyOutOfMelee(e, originX, originZ, minDist, power=1){
  if(!e||e.dead) return;
  if(e.type==='boss') power*=0.35;
  let dx=e.pos.x-originX, dz=e.pos.z-originZ;
  let d=Math.hypot(dx,dz);
  if(d<0.001){
    const a=Math.random()*Math.PI*2;
    dx=Math.sin(a); dz=Math.cos(a); d=1;
  }
  const nx=dx/d, nz=dz/d;
  const target=Math.max(d,minDist);
  const push=(target-d)*power + 0.35*power;
  e.pos.x+=nx*push;
  e.pos.z+=nz*push;
  if(e.vel){ e.vel.x=(e.vel.x||0)+nx*push*3.0; e.vel.z=(e.vel.z||0)+nz*push*3.0; }
  clamp(e.pos,e.cfg.r);
  resolveObst(e.pos,e.cfg.r);
}

function _sMat(c,op){ const m=new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthTest:true,depthWrite:false}); m._base=op; return m; }
function prepSummonRender(g,order=90){
  g.renderOrder=order;
  g.traverse(o=>{
    o.renderOrder=order;
    if(o.material){
      o.material.depthTest=true;
      o.material.depthWrite=false;
      if(o.material.polygonOffset!==undefined){
        o.material.polygonOffset=true;
        o.material.polygonOffsetFactor=-5;
        o.material.polygonOffsetUnits=-5;
      }
    }
  });
}
function buildDroneMesh(sizeMult){
  const g=new THREE.Group(); g.frustumCulled=false;
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.20,0.34),_sMat(0xffdd44,0.92));
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.14,0.34,5),_sMat(0xffffff,0.78));
  nose.rotation.x=Math.PI/2; nose.position.z=0.31;
  const wingL=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.035,0.12),_sMat(0xffaa00,0.72)); wingL.position.x=-0.38;
  const wingR=wingL.clone(); wingR.position.x=0.38;
  const core=new THREE.Mesh(new THREE.SphereGeometry(0.10,6,5),_sMat(0xffffff,0.90));
  core.position.y=0.02;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.34,0.025,4,18),_sMat(0xffaa00,0.62));
  ring.rotation.x=Math.PI/2;
  // Aura sphere removed — additive-blending transparent ball was a per-summon
  // overdraw hit that compounded with summon count. Identity is preserved by
  // the ring + body colour.
  g.add(body,nose,wingL,wingR,core,ring);
  g.scale.setScalar(sizeMult);
  g.userData={body,nose,wingL,wingR,core,ring,type:'laserDrone',animSeed:Math.random()*20};
  prepSummonRender(g);
  cacheSummonRigPose(g);
  return g;
}
function buildTurretMesh(sizeMult){
  const g=new THREE.Group(); g.frustumCulled=false;
  const base=new THREE.Mesh(new THREE.BoxGeometry(0.78,0.20,0.62),_sMat(0x6f4a16,0.82)); base.position.y=-0.02;
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.64,0.38,0.56),_sMat(0xffdd44,0.92)); body.position.y=0.21;
  const armor=new THREE.Mesh(new THREE.BoxGeometry(0.78,0.12,0.42),_sMat(0xffcc33,0.68)); armor.position.set(0,0.35,-0.02);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(0.27,9,6),_sMat(0xffcc00,0.88)); dome.position.y=0.50;
  const eye=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.055,0.035),_sMat(0xffffff,0.96)); eye.position.set(0,0.52,0.28);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.065,0.085,0.56,7),_sMat(0xffffff,0.84));
  barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.39,0.50);
  const barrelTip=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.11,0.13,7),_sMat(0xffffdd,0.88));
  barrelTip.rotation.x=Math.PI/2; barrelTip.position.set(0,0.39,0.80);
  const legGeo=new THREE.BoxGeometry(0.11,0.30,0.11);
  const footGeo=new THREE.BoxGeometry(0.22,0.09,0.28);
  const legMat=_sMat(0x7a4d12,0.76);
  const footMat=_sMat(0x5a3a10,0.84);
  const leg1=new THREE.Mesh(legGeo,legMat); leg1.position.set(-0.31,-0.24,-0.22);
  const leg2=leg1.clone(); leg2.position.x=0.38;
  leg2.position.x=0.31;
  const leg3=leg1.clone(); leg3.position.z=0.22;
  const leg4=leg2.clone(); leg4.position.z=0.28;
  leg4.position.z=0.22;
  const foot1=new THREE.Mesh(footGeo,footMat); foot1.position.set(-0.31,-0.40,-0.27);
  const foot2=foot1.clone(); foot2.position.x=0.38;
  foot2.position.x=0.31;
  const foot3=foot1.clone(); foot3.position.z=0.27;
  const foot4=foot2.clone(); foot4.position.z=0.34;
  foot4.position.z=0.27;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.50,0.026,4,28),_sMat(0xffaa00,0.54));
  ring.rotation.x=Math.PI/2; ring.position.y=0.07;
  // Aura sphere removed — see buildDroneMesh.
  g.add(base,body,armor,dome,eye,barrel,barrelTip,leg1,leg2,leg3,leg4,ring);
  g.scale.setScalar(sizeMult);
  g.userData={base,body,armor,dome,eye,barrel,barrelTip,leg1,leg2,leg3,leg4,ring,type:'guardianTurret',animSeed:Math.random()*20};
  prepSummonRender(g);
  cacheSummonRigPose(g);
  return g;
}
function buildShieldBotMesh(sizeMult){
  const g=new THREE.Group(); g.frustumCulled=false;
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.50,0.72,0.28),_sMat(0x3366ff,0.86)); body.position.y=0.02;
  const chest=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.42,0.08),_sMat(0x88aaff,0.55)); chest.position.set(0,0.07,0.18);
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.24,0.24),_sMat(0x66aaff,0.88)); head.position.y=0.52;
  const eye=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.045,0.035),_sMat(0xffffff,0.96)); eye.position.set(0,0.55,0.15);
  const shield=new THREE.Mesh(new THREE.BoxGeometry(0.48,0.62,0.10),_sMat(0xaaddff,0.64)); shield.position.set(-0.45,0.05,0.05);
  const shoulder=new THREE.Mesh(new THREE.BoxGeometry(0.78,0.12,0.18),_sMat(0x4488ff,0.72)); shoulder.position.y=0.34;
  const legL=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.32,0.12),_sMat(0x2244bb,0.74)); legL.position.set(-0.16,-0.28,0.00);
  const legR=legL.clone(); legR.position.x=0.16;
  const footL=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.10,0.28),_sMat(0x2244bb,0.78)); footL.position.set(-0.16,-0.42,0.03);
  const footR=footL.clone(); footR.position.x=0.16;
  const inner=new THREE.Mesh(new THREE.SphereGeometry(0.11,6,5),_sMat(0xffffff,0.55)); inner.position.set(0,0.08,0.24);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.43,0.026,4,20),_sMat(0x88aaff,0.42));
  ring.rotation.x=Math.PI/2; ring.position.y=-0.35;
  // Aura sphere removed — see buildDroneMesh.
  g.add(body,chest,head,eye,shield,shoulder,legL,legR,footL,footR,inner,ring);
  g.scale.setScalar(sizeMult);
  g.userData={body,chest,head,eye,shield,shoulder,legL,legR,footL,footR,inner,ring,type:'shieldBot',animSeed:Math.random()*20};
  prepSummonRender(g);
  cacheSummonRigPose(g);
  return g;
}
function buildSentinelMesh(sizeMult){
  const g=new THREE.Group(); g.frustumCulled=false;
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.28,0.60,7),_sMat(0xff4488,0.88)); body.position.y=0.03;
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.16,7,6),_sMat(0xff88aa,0.84)); head.position.y=0.46;
  const armL=new THREE.Mesh(new THREE.BoxGeometry(0.11,0.42,0.10),_sMat(0xff77aa,0.72)); armL.position.set(-0.28,0.10,0);
  const armR=armL.clone(); armR.position.x=0.28; armR.rotation.z=-0.45;
  const blade=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.88,0.06),_sMat(0xffffff,0.86));
  blade.position.set(0.48,0.27,0); blade.rotation.z=-0.62;
  const hilt=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.07,0.08),_sMat(0xff2266,0.78)); hilt.position.set(0.28,-0.02,0); hilt.rotation.z=-0.62;
  const legL=new THREE.Mesh(new THREE.BoxGeometry(0.11,0.32,0.10),_sMat(0xcc225f,0.72)); legL.position.set(-0.11,-0.45,0);
  const legR=legL.clone(); legR.position.x=0.11;
  const inner=new THREE.Mesh(new THREE.TetrahedronGeometry(0.14,0),_sMat(0xffffff,0.56)); inner.position.set(0,0.05,0.20);
  // Aura sphere removed — see buildDroneMesh.
  g.add(body,head,armL,armR,blade,hilt,legL,legR,inner);
  g.scale.setScalar(sizeMult);
  g.userData={body,head,armL,armR,blade,hilt,legL,legR,inner,type:'bladeSentinel',animSeed:Math.random()*20};
  prepSummonRender(g);
  cacheSummonRigPose(g);
  return g;
}
function buildRepairDroneMesh(sizeMult){
  const g=new THREE.Group(); g.frustumCulled=false;
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.26,0.30),_sMat(0x44ff88,0.90));
  const core=new THREE.Mesh(new THREE.SphereGeometry(0.10,6,5),_sMat(0xffffff,0.90)); core.position.y=0.03;
  const crossH=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.055,0.035),_sMat(0xffffff,0.82)); crossH.position.z=0.18;
  const crossV=new THREE.Mesh(new THREE.BoxGeometry(0.055,0.22,0.035),_sMat(0xffffff,0.82)); crossV.position.z=0.18;
  const podL=new THREE.Mesh(new THREE.SphereGeometry(0.09,5,4),_sMat(0x00ffcc,0.70)); podL.position.set(-0.28,0,0);
  const podR=podL.clone(); podR.position.x=0.28;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.33,0.024,4,18),_sMat(0x00ffcc,0.58));
  ring.rotation.x=Math.PI/2;
  // Aura sphere removed — see buildDroneMesh.
  g.add(body,core,crossH,crossV,podL,podR,ring);
  g.scale.setScalar(sizeMult);
  g.userData={body,core,crossH,crossV,podL,podR,ring,type:'repairDrone',animSeed:Math.random()*20};
  prepSummonRender(g);
  cacheSummonRigPose(g);
  return g;
}

const SUMMON_RIG_KEYS = ['body','nose','wingL','wingR','core','ring','aura','base','dome','barrel','barrelTip','leg1','leg2','leg3','leg4','chest','head','eye','shield','shoulder','legL','legR','footL','footR','inner','armL','armR','blade','hilt','crossH','crossV','podL','podR'];
function cacheSummonRigPose(g){
  const p=g.userData;
  for(const key of SUMMON_RIG_KEYS){
    const part=p[key]; if(!part) continue;
    part.userData.basePos = part.userData.basePos || new THREE.Vector3();
    part.userData.baseRot = part.userData.baseRot || new THREE.Euler();
    part.userData.baseScale = part.userData.baseScale || new THREE.Vector3();
    part.userData.basePos.copy(part.position);
    part.userData.baseRot.copy(part.rotation);
    part.userData.baseScale.copy(part.scale);
  }
}
function resetSummonRigPose(g){
  const p=g.userData;
  for(const key of SUMMON_RIG_KEYS){
    const part=p[key]; if(!part||!part.userData.basePos) continue;
    part.position.copy(part.userData.basePos);
    part.rotation.copy(part.userData.baseRot);
    part.scale.copy(part.userData.baseScale);
  }
}
function faceSummon(mesh,dx,dz,dt,turnRate=10){
  if(!mesh||Math.hypot(dx,dz)<0.01) return;
  mesh.rotation.y=angleLerp(mesh.rotation.y,Math.atan2(dx,dz),1-Math.exp(-turnRate*dt));
}
function triggerSummonAttack(mesh,dur=0.22,sync=true){
  if(!mesh) return;
  mesh.userData.attackT=Math.max(mesh.userData.attackT||0,dur);
  mesh.userData.attackDur=dur;
  if(sync) mesh.userData.attackSeq=(mesh.userData.attackSeq||0)+1;
}
function spinSummonPart(part,axis,delta){
  if(!part) return;
  part.userData.spin=(part.userData.spin||0)+delta;
  part.rotation[axis]+=part.userData.spin;
}
function animateSummonRig(type,mesh,dt,now,moveAmt=0){
  if(!mesh) return;
  resetSummonRigPose(mesh);
  const p=mesh.userData;
  const phase=now*0.011+(p.animSeed||0);
  const speed=dt>0?moveAmt/dt:0;
  const walk=Math.min(1,speed/3.2);
  const dur=Math.max(0.01,p.attackDur||0.22);
  const atkPhase=Math.max(0,Math.min(1,1-Math.max(0,p.attackT||0)/dur));
  const atk=(p.attackT||0)>0?Math.sin(atkPhase*Math.PI):0;
  if(p.attackT>0) p.attackT=Math.max(0,p.attackT-dt);

  if(type==='laserDrone'){
    const flap=Math.sin(phase*2.4)*0.55;
    if(p.body){ p.body.rotation.x+=Math.sin(phase)*0.05; p.body.position.y+=Math.sin(phase*1.5)*0.025; }
    if(p.nose) p.nose.position.z+=0.06*atk;
    if(p.wingL){ p.wingL.rotation.z+=flap; p.wingR.rotation.z-=flap; }
    spinSummonPart(p.core,'y',dt*6.5);
    spinSummonPart(p.ring,'z',dt*4.0);
  } else if(type==='repairDrone'){
    if(p.body){ p.body.rotation.z+=Math.sin(phase)*0.07; p.body.position.y+=Math.sin(phase*1.4)*0.025; }
    if(p.podL){ p.podL.position.y+=Math.sin(phase*2.2)*0.045; p.podR.position.y-=Math.sin(phase*2.2)*0.045; }
    if(p.crossH){ p.crossH.scale.x*=1+0.18*atk; p.crossV.scale.y*=1+0.18*atk; }
    spinSummonPart(p.core,'y',dt*5.0);
    spinSummonPart(p.ring,'z',dt*3.2);
  } else if(type==='guardianTurret'){
    const stride=Math.sin(phase*1.55)*walk;
    if(p.base){ p.base.position.y+=Math.abs(stride)*0.025; p.base.rotation.z+=stride*0.025; }
    if(p.body){ p.body.position.y+=Math.abs(stride)*0.035+0.025*atk; p.body.rotation.z+=stride*0.035; }
    if(p.dome) p.dome.rotation.y+=Math.sin(phase)*0.08;
    if(p.eye) p.eye.scale.x*=1+0.20*atk;
    if(p.barrel){ p.barrel.position.z-=0.16*atk; p.barrel.scale.y*=1+0.16*atk; }
    if(p.barrelTip) p.barrelTip.position.z-=0.24*atk;
    if(p.leg1){
      p.leg1.rotation.x+=stride*0.62; p.leg4.rotation.x+=stride*0.62;
      p.leg2.rotation.x-=stride*0.62; p.leg3.rotation.x-=stride*0.62;
    }
    if(p.foot1){
      p.foot1.position.y+=Math.max(0,stride)*0.055; p.foot4.position.y+=Math.max(0,stride)*0.055;
      p.foot2.position.y+=Math.max(0,-stride)*0.055; p.foot3.position.y+=Math.max(0,-stride)*0.055;
    }
    spinSummonPart(p.ring,'z',dt*2.3);
  } else if(type==='shieldBot'){
    const stride=Math.sin(phase*1.4)*walk;
    if(p.body){ p.body.position.y+=Math.abs(stride)*0.035; p.body.rotation.z+=stride*0.035; }
    if(p.head) p.head.rotation.y+=Math.sin(phase*0.7)*0.08;
    if(p.legL){ p.legL.rotation.x+=stride*0.48; p.legR.rotation.x-=stride*0.48; }
    if(p.footL){ p.footL.position.y+=Math.max(0,stride)*0.055; p.footR.position.y+=Math.max(0,-stride)*0.055; }
    if(p.shield){ p.shield.position.z+=0.10*atk; p.shield.rotation.y-=0.22*atk; }
    spinSummonPart(p.inner,'y',dt*-5.2);
    spinSummonPart(p.ring,'z',dt*1.8);
  } else if(type==='bladeSentinel'){
    const stride=Math.sin(phase*1.8)*walk;
    if(p.body){ p.body.position.y+=Math.abs(stride)*0.035; p.body.rotation.z+=stride*0.05; }
    if(p.head) p.head.rotation.y+=Math.sin(phase)*0.10;
    if(p.legL){ p.legL.rotation.x+=stride*0.65; p.legR.rotation.x-=stride*0.65; }
    if(p.armL){ p.armL.rotation.x-=stride*0.25; p.armR.rotation.x+=stride*0.25; }
    if(p.blade){ p.blade.rotation.z-=1.10*atk; p.blade.position.z+=0.16*atk; }
    if(p.hilt){ p.hilt.rotation.z-=0.85*atk; p.hilt.position.z+=0.10*atk; }
    spinSummonPart(p.inner,'y',dt*-8.0);
  }
}

function spawnDrone(){
  const lvl=playerSkills.laserDrone||0; if(!lvl) return;
  if(summonDrones.length>=SUMMON_ACTIVE_CAP) return;
  const hpMult=getSummonHpMult(), sizeMult=getSummonSizeMult();
  const m=buildDroneMesh(sizeMult);
  const maxHp=Math.round((DRONE_HP[lvl]||55)*hpMult);
  const ang=Math.random()*Math.PI*2, r=1.2+Math.random()*0.9;
  const x=player.pos.x+Math.cos(ang)*r, z=player.pos.z+Math.sin(ang)*r;
  m.position.set(x,0.85,z);
  m.userData.fireCd=0; m.userData.trail=createTrail(0xffdd44);
  m.userData.hp=maxHp; m.userData.maxHp=maxHp;
  m.userData.pos={x,z}; m.userData.vel={x:0,z:0}; m.userData.life=summonLife(DRONE_LIFE[lvl]);
  scene.add(m); summonDrones.push(m);
  impactPulse(player.pos,0xffdd44,0.6,3);
}
function spawnShieldBot(){
  const lvl=playerSkills.shieldBot||0; if(!lvl) return;
  if(shieldBots.length>=SUMMON_ACTIVE_CAP) return;
  const hpMult=getSummonHpMult(), sizeMult=getSummonSizeMult();
  const maxHp=Math.round(SHIELDBOT_HP[lvl]*hpMult);
  const m=buildShieldBotMesh(sizeMult);
  scene.add(m);
  const ang=Math.random()*Math.PI*2, r=1.25;
  const x=player.pos.x+Math.cos(ang)*r, z=player.pos.z+Math.sin(ang)*r;
  m.position.set(x,0.65,z);
  shieldBots.push({mesh:m, pos:{x,z}, vel:{x:0,z:0}, hp:maxHp, maxHp, life:summonLife(SHIELDBOT_LIFE[lvl]), attackCd:0});
  impactPulse(player.pos,0x4488ff,0.8,4);
}
function spawnRepairDrone(){
  const lvl=playerSkills.repairDrone||0; if(!lvl) return;
  if(repairDrones.length>=SUMMON_ACTIVE_CAP) return;
  const hpMult=getSummonHpMult(), sizeMult=getSummonSizeMult();
  const m=buildRepairDroneMesh(sizeMult);
  const maxHp=Math.round(REPAIR_HP[lvl]*hpMult);
  const ang=Math.random()*Math.PI*2, r=1.3;
  const x=player.pos.x+Math.cos(ang)*r, z=player.pos.z+Math.sin(ang)*r;
  m.position.set(x,1.0,z);
  m.userData.hp=maxHp; m.userData.maxHp=maxHp; m.userData.trail=createTrail(0x44ff88);
  m.userData.pos={x,z}; m.userData.vel={x:0,z:0}; m.userData.life=summonLife(REPAIR_LIFE[lvl]); m.userData.healCd=0.7;
  scene.add(m); repairDrones.push(m);
  impactPulse(player.pos,0x44ff88,0.6,3);
}

function _disposeGroup(m){ m.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();}); }
function clearSummons(){
  summonDrones.forEach(m=>{disposeTrail(m.userData.trail); scene.remove(m); _disposeGroup(m);});
  summonDrones.length=0; droneSpawnCd=0;
  repairDrones.forEach(m=>{disposeTrail(m.userData.trail); scene.remove(m); _disposeGroup(m);});
  repairDrones.length=0; repairDroneSpawnCd=0;
  for(const t of turrets){scene.remove(t.mesh); _disposeGroup(t.mesh);}
  turrets.length=0;
  for(const m of mines){scene.remove(m.mesh); m.mesh.material.dispose();}
  mines.length=0;
  shieldBots.forEach(b=>{ scene.remove(b.mesh); _disposeGroup(b.mesh); });
  shieldBots.length=0; shieldBotSpawnCd=0;
  sentinels.forEach(s=>{ scene.remove(s.mesh); _disposeGroup(s.mesh); });
  sentinels.length=0;
  sentinelHitLocks.clear();
  turretSpawnCd=0; mineDropCd=0; sentinelSpawnCd=0;
}

function clearMapSpellsAndAllies(){
  // Drop any in-flight blade waves so they don't keep travelling into the
  // next wave / shop / boss arena.
  for(let i=bladeWaves.length-1;i>=0;i--){
    const w=bladeWaves[i];
    disposeBladeWave(w);
  }
  bladeWaves.length=0;
  for(const s of spellBalls) if(s.active){s.active=false;s.mesh.visible=false;clearTrail(s.trail);}
  for(let i=damageRings.length-1;i>=0;i--){ _releaseDamageRingSlot(damageRings[i]); }
  damageRings.length=0;
  for(let i=homingBombs.length-1;i>=0;i--){ _releaseHomingBombSlot(homingBombs[i]); }
  homingBombs.length=0;
  for(let i=shockwaves.length-1;i>=0;i--){
    _releaseShockwaveSlot(shockwaves[i]);
  }
  shockwaves.length=0;
  for(let i=slashVfx.length-1;i>=0;i--){
    const s=slashVfx[i];
    scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mat.dispose();
  }
  slashVfx.length=0;
  // Dispose any in-flight hook projectiles too — their onLand callbacks are
  // dropped silently (no swing / damage on a dead match).
  for(let i=flyingHooks.length-1;i>=0;i--){
    const f=flyingHooks[i];
    scene.remove(f.rope); f.rope.geometry.dispose(); f.ropeMat.dispose();
    scene.remove(f.proj); f.proj.geometry.dispose(); f.proj.material.dispose();
  }
  flyingHooks.length=0;
  disposeActiveHookRope();
  hookedEnemies.length=0;
  for(let i=warningZones.length-1;i>=0;i--){
    _releaseWarningSlot(warningZones[i]);
  }
  warningZones.length=0;
  for(let i=skillVfx.length-1;i>=0;i--){
    const v=skillVfx[i];
    disposeSkillVfx(v);
  }
  skillVfx.length=0;
  for(let i=afterimageZones.length-1;i>=0;i--){
    const z=afterimageZones[i];
    scene.remove(z.mesh); z.mesh.geometry.dispose(); z.mat.dispose();
  }
  afterimageZones.length=0;
  slowMap.clear(); phaseVulnMap.clear(); poisonMap.clear();
  elementTagMap.clear(); _tagIndicators.forEach(ind=>ind.visible=false);
  clearSummons();
}

function spawnTurret(){
  const lvl=playerSkills.guardianTurret||0; if(!lvl) return;
  if(turrets.length>=SUMMON_ACTIVE_CAP) return;
  const hpMult=getSummonHpMult();
  const sizeMult=getSummonSizeMult();
  const maxHp=Math.round(TURRET_HP[lvl]*hpMult);
  const mesh=buildTurretMesh(sizeMult);
  const ang=Math.random()*Math.PI*2, r=1.15;
  const x=player.pos.x+Math.cos(ang)*r, z=player.pos.z+Math.sin(ang)*r;
  mesh.position.set(x,0.50*sizeMult,z); scene.add(mesh);
  turrets.push({mesh, pos:{x,z}, vel:{x:0,z:0}, life:summonLife(TURRET_DUR[lvl]), fireCd:0, hp:maxHp, maxHp});
  impactPulse({x,z},0xffdd44,0.9,4);
}

function spawnMine(x=player.pos.x,z=player.pos.z){
  const lvl=playerSkills.mineLayer||0; if(!lvl) return;
  const mat=new THREE.MeshBasicMaterial({color:0xffaa00,transparent:true,opacity:0.86,blending:THREE.AdditiveBlending});
  const mesh=new THREE.Mesh(mineGeo,mat);
  mesh.position.set(x,0.08,z); scene.add(mesh);
  mines.push({mesh,pos:{x,z},armed:0.18,life:45});
}

function explodeMine(mineIndex){
  const lvl=playerSkills.mineLayer||0;
  const m=mines[mineIndex]; if(!m) return;
  const r=MINE_R[lvl], dmg=Math.round(MINE_DMG[lvl]*atkScale());
  burst(m.pos,0xffaa00,isMobile?8:14); spawnShockwave(m.pos.x,m.pos.z,r,0xffaa00,0.26,0.75);
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i]; if(!e||e.dead) continue;
    if(Math.hypot(e.pos.x-m.pos.x,e.pos.z-m.pos.z)<r+e.cfg.r) damageEnemyIndex(i,dmg,0xffaa00,0.16,mp.myId,'summon');
  }
  scene.remove(m.mesh); m.mesh.material.dispose();
  mines.splice(mineIndex,1);
}

function spawnSentinel(){
  const lvl=playerSkills.bladeSentinel||0; if(!lvl) return;
  if(sentinels.length>=SUMMON_ACTIVE_CAP) return;
  const hpMult=getSummonHpMult();
  const sizeMult=getSummonSizeMult();
  const maxHp=Math.round(SENTINEL_HP[lvl]*hpMult);
  const m=buildSentinelMesh(sizeMult);
  const ang=Math.random()*Math.PI*2;
  const x=player.pos.x+Math.cos(ang)*1.2, z=player.pos.z+Math.sin(ang)*1.2;
  m.position.set(x,0.4,z); scene.add(m);
  sentinels.push({mesh:m, pos:{x,z}, hp:maxHp, maxHp, vel:{x:0,z:0}, attackCd:0.35, life:summonLife(SENTINEL_LIFE[lvl])});
  impactPulse({x,z},0xff4488,0.7,3);
}

function steerSummon(unit, targetX, targetZ, speed, dt, stopDist=0.25){
  const dx=targetX-unit.pos.x, dz=targetZ-unit.pos.z;
  const d=Math.hypot(dx,dz);
  if(d>stopDist){
    unit.vel=unit.vel||{x:0,z:0};
    const tx=dx/d*speed, tz=dz/d*speed;
    unit.vel.x+=(tx-unit.vel.x)*Math.min(1,dt*6);
    unit.vel.z+=(tz-unit.vel.z)*Math.min(1,dt*6);
    unit.pos.x+=unit.vel.x*dt; unit.pos.z+=unit.vel.z*dt;
    clamp(unit.pos,0.35); resolveObst(unit.pos,0.35);
  } else if(unit.vel){
    unit.vel.x*=Math.pow(0.15,dt); unit.vel.z*=Math.pow(0.15,dt);
  }
}

function activeAllyBodies(){
  const out=[];
  for(const m of summonDrones) out.push({unit:m.userData,r:0.48});
  for(const m of repairDrones) out.push({unit:m.userData,r:0.44});
  for(const t of turrets) out.push({unit:t,r:0.62});
  for(const b of shieldBots) out.push({unit:b,r:0.58});
  for(const s of sentinels) out.push({unit:s,r:0.50});
  return out;
}
function resolveAllySeparation(unit,radius=0.5){
  if(!unit?.pos) return;
  const allies=activeAllyBodies();
  for(const other of allies){
    const o=other.unit;
    if(!o||o===unit||!o.pos) continue;
    const dx=unit.pos.x-o.pos.x, dz=unit.pos.z-o.pos.z;
    const d=Math.hypot(dx,dz)||0.001;
    const minD=radius+other.r;
    if(d<minD){
      const push=(minD-d)*0.5;
      const nx=dx/d, nz=dz/d;
      unit.pos.x+=nx*push; unit.pos.z+=nz*push;
      o.pos.x-=nx*push*0.55; o.pos.z-=nz*push*0.55;
      unit.vel=unit.vel||{x:0,z:0}; o.vel=o.vel||{x:0,z:0};
      unit.vel.x+=nx*push*2.2; unit.vel.z+=nz*push*2.2;
      o.vel.x-=nx*push*1.3; o.vel.z-=nz*push*1.3;
    }
  }
  clamp(unit.pos,radius); resolveObst(unit.pos,radius);
}
function resolveAllyEnemyBody(unit,radius=0.55){
  if(!unit?.pos) return false;
  let touched=false;
  for(const e of enemies){
    if(e.dead) continue;
    const dx=unit.pos.x-e.pos.x, dz=unit.pos.z-e.pos.z;
    const d=Math.hypot(dx,dz)||0.001;
    const minD=radius+e.cfg.r;
    if(d<minD){
      touched=true;
      const nx=dx/d, nz=dz/d;
      const push=(minD-d)*0.55;
      unit.pos.x+=nx*push; unit.pos.z+=nz*push;
      unit.vel=unit.vel||{x:0,z:0};
      unit.vel.x+=nx*push*2.0; unit.vel.z+=nz*push*2.0;
      if(mp.soloMode||mp.isHost){
        e.pos.x-=nx*push*0.35; e.pos.z-=nz*push*0.35;
        clamp(e.pos,e.cfg.r); resolveObst(e.pos,e.cfg.r);
      }
    }
  }
  clamp(unit.pos,radius); resolveObst(unit.pos,radius);
  return touched;
}

function updateSummons(dt, now){
  if(player.dead) return;
  const dmgMult=getSummonDmgMult();
  const cdMult=getSummonCdMult();

  // ── Laser Drones ──────────────────────────────────────────
  const droneLvl=playerSkills.laserDrone||0;
  if(droneLvl){
    droneSpawnCd-=dt;
    if(droneSpawnCd<=0){
      droneSpawnCd=DRONE_SPAWN_CD[droneLvl]*cdMult;
      spawnDrone();
    }
  }
  // Update existing drones regardless of skill ownership — Factory Gate can
  // spawn drones even when the player has no laserDrone, and previously those
  // would freeze in place because the entire update block was gated on droneLvl.
  if(droneLvl||summonDrones.length){
    const effDroneLvl = droneLvl || 5;
    for(let i=summonDrones.length-1;i>=0;i--){
      const m=summonDrones[i];
      const state=m.userData;
      state.life-=dt;
      const target=nearestEnemy(state.pos.x,state.pos.z,10);
      if(target){
        const dx=target.enemy.pos.x-state.pos.x, dz=target.enemy.pos.z-state.pos.z;
        const d=Math.hypot(dx,dz)||1;
        const keep=2.8+(target.enemy?.cfg?.r||0.5);
        steerSummon(state,target.enemy.pos.x-dx/d*keep,target.enemy.pos.z-dz/d*keep,5.4,dt,0.35);
      } else {
        const slot=i-summonDrones.length/2;
        steerSummon(state,player.pos.x+slot*0.65,player.pos.z+1.8,4.8,dt,0.35);
      }
      resolveAllySeparation(state,0.48);
      const touchingEnemy=resolveAllyEnemyBody(state,0.38);
      const x=state.pos.x, z=state.pos.z;
      const moveDx=x-m.position.x, moveDz=z-m.position.z;
      if(target) faceSummon(m,target.enemy.pos.x-x,target.enemy.pos.z-z,dt,12);
      else faceSummon(m,moveDx,moveDz,dt,9);
      m.position.set(x,0.85+Math.sin(now*0.006+i)*0.18,z);
      animateSummonRig('laserDrone',m,dt,now,Math.hypot(moveDx,moveDz));
      updateTrail(m.userData.trail,x,m.position.y,z);
      if(touchingEnemy) m.userData.hp-=SUMMON_CONTACT_DMG*dt;
      if(m.userData.hp<=0||state.life<=0){
        disposeTrail(m.userData.trail); scene.remove(m); _disposeGroup(m); summonDrones.splice(i,1);
        burst({x,z},0xffdd44,6);
        continue;
      }
      { const hf=m.userData.hp/m.userData.maxHp; m.traverse(o=>{ if(o.material&&o.material._base) o.material.opacity=o.material._base*(0.38+0.62*hf); }); }
      m.userData.fireCd-=dt;
      if(m.userData.fireCd<=0){
        const tgt=nearestEnemy(x,z,9);
        if(tgt){
          m.userData.fireCd=DRONE_CD[effDroneLvl]*cdMult;
          triggerSummonAttack(m,0.18);
          spawnZapLine(x,z,tgt.enemy.pos.x,tgt.enemy.pos.z);
          damageEnemyIndex(tgt.idx,Math.round(DRONE_DMG[effDroneLvl]*dmgMult*atkScale()),0xffdd44,0.06,mp.myId,'summon');
        }
      }
    }
  }

  // ── Repair Drones ─────────────────────────────────────────
  const repairLvl=playerSkills.repairDrone||0;
  if(repairLvl){
    repairDroneSpawnCd-=dt;
    if(repairDroneSpawnCd<=0){
      repairDroneSpawnCd=REPAIR_SPAWN_CD[repairLvl]*cdMult;
      spawnRepairDrone();
    }
  }
  if(repairLvl||repairDrones.length){
    const effRepairLvl = repairLvl || 5;
    for(let i=repairDrones.length-1;i>=0;i--){
      const m=repairDrones[i];
      const state=m.userData;
      state.life-=dt;
      const slot=i-repairDrones.length/2;
      steerSummon(state,player.pos.x+slot*0.6,player.pos.z+1.25,5.1,dt,0.25);
      resolveAllySeparation(state,0.44);
      const touchingEnemy=resolveAllyEnemyBody(state,0.44);
      const x=state.pos.x, z=state.pos.z;
      const moveDx=x-m.position.x, moveDz=z-m.position.z;
      faceSummon(m,player.pos.x-x,player.pos.z-z,dt,9);
      m.position.set(x,1.1+Math.sin(now*0.007+i)*0.20,z);
      animateSummonRig('repairDrone',m,dt,now,Math.hypot(moveDx,moveDz));
      if(m.userData.core) m.userData.core.material.opacity=0.60+0.38*Math.abs(Math.sin(now*0.012+i));
      updateTrail(m.userData.trail,x,m.position.y,z);
      state.healCd-=dt;
      // AFK-heal fix: only tick the heal when there's at least one live enemy
      // on the map. Without this guard, sitting between waves with the drone
      // active would fully heal the player every cycle — trivialising HP-
      // pressure builds (Glass Reactor, Cursed Shrine HP curses, etc.).
      const _liveEnemies = enemies.some(e=>!e.dead);
      if(state.healCd<=0&&_liveEnemies&&player.hp<playerStats.maxHp&&!regenSourcesBlocked()){
        state.healCd=REPAIR_TICK[effRepairLvl];
        triggerSummonAttack(m,0.32);
        healPlayer(Math.round(REPAIR_HEAL[effRepairLvl]));
        dmgNum('+'+Math.round(REPAIR_HEAL[effRepairLvl])+' HP',player.pos,'#44ff88');
        spawnZapLine(x,z,player.pos.x,player.pos.z);
      }
      if(effRepairLvl>=5&&_liveEnemies&&player.hp<playerStats.maxHp*0.32&&!regenSourcesBlocked()){
        player.repairPulseCd=Math.max(0,(player.repairPulseCd||0)-dt);
        if(player.repairPulseCd<=0){
          player.repairPulseCd=10;
          healPlayer(Math.round(playerStats.maxHp*0.18));
          burst(player.pos,0x44ff88,isMobile?8:16); impactPulse(player.pos,0x44ff88,1.8,isMobile?5:10);
        }
      }
      if(touchingEnemy) m.userData.hp-=SUMMON_CONTACT_DMG*dt;
      if(m.userData.hp<=0||state.life<=0){
        disposeTrail(m.userData.trail); scene.remove(m); _disposeGroup(m); repairDrones.splice(i,1);
        burst({x,z},0x44ff88,6);
        continue;
      }
      { const hf=m.userData.hp/m.userData.maxHp; m.traverse(o=>{ if(o.material&&o.material._base) o.material.opacity=o.material._base*(0.38+0.62*hf); }); }
    }
  }

  // ── Guardian Turrets ──────────────────────────────────────
  const turretLvl=playerSkills.guardianTurret||0;
  if(turretLvl){
    turretSpawnCd-=dt;
    if(turretSpawnCd<=0){ turretSpawnCd=TURRET_CD[turretLvl]*cdMult; spawnTurret(); }
  }
  const effTurretLvl = turretLvl || 5; // fallback for Factory Gate spawns
  for(let i=turrets.length-1;i>=0;i--){
    const t=turrets[i]; t.life-=dt; t.fireCd-=dt;
    const turretTarget=nearestEnemy(t.pos.x,t.pos.z,10);
    if(turretTarget){
      const dx=turretTarget.enemy.pos.x-t.pos.x, dz=turretTarget.enemy.pos.z-t.pos.z;
      const d=Math.hypot(dx,dz)||1;
      const keep=4.2+(turretTarget.enemy?.cfg?.r||0.5);
      if(d>keep+0.9) steerSummon(t,turretTarget.enemy.pos.x-dx/d*keep,turretTarget.enemy.pos.z-dz/d*keep,3.25,dt,0.35);
      else if(d<keep-1.1) steerSummon(t,t.pos.x-dx/d*1.8,t.pos.z-dz/d*1.8,2.8,dt,0.1);
      else {
        t.vel=t.vel||{x:0,z:0};
        t.vel.x+=( -dz/d*1.25-t.vel.x)*Math.min(1,dt*3);
        t.vel.z+=(  dx/d*1.25-t.vel.z)*Math.min(1,dt*3);
        t.pos.x+=t.vel.x*dt; t.pos.z+=t.vel.z*dt;
        clamp(t.pos,0.62); resolveObst(t.pos,0.62);
      }
    } else {
      const slot=i-turrets.length/2;
      steerSummon(t,player.pos.x+slot*0.85,player.pos.z+1.7,3.35,dt,0.35);
    }
    resolveAllySeparation(t,0.62);
    const touchingEnemy=resolveAllyEnemyBody(t,0.62);
    const moveDx=t.pos.x-t.mesh.position.x, moveDz=t.pos.z-t.mesh.position.z;
    if(turretTarget) faceSummon(t.mesh,turretTarget.enemy.pos.x-t.pos.x,turretTarget.enemy.pos.z-t.pos.z,dt,14);
    else faceSummon(t.mesh,moveDx,moveDz,dt,9);
    t.mesh.position.set(t.pos.x,0.50*getSummonSizeMult(),t.pos.z);
    animateSummonRig('guardianTurret',t.mesh,dt,now,Math.hypot(moveDx,moveDz));
    if(touchingEnemy) t.hp-=SUMMON_CONTACT_DMG*dt;
    { const hf=t.hp/t.maxHp; t.mesh.traverse(o=>{ if(o.material&&o.material._base) o.material.opacity=o.material._base*(0.35+0.65*hf); }); }
    if(t.life<=0||t.hp<=0){
      if(t.hp<=0) burst(t.pos,0xffdd44,6);
      scene.remove(t.mesh); _disposeGroup(t.mesh); turrets.splice(i,1); continue;
    }
    if(t.fireCd<=0){
      const tgt=turretTarget;
      if(tgt){
        t.fireCd=TURRET_FIRE_CD[effTurretLvl]*cdMult;
        triggerSummonAttack(t.mesh,0.18);
        fireBullet({x:t.pos.x,z:t.pos.z},_scratchDir.set(tgt.enemy.pos.x-t.pos.x,0,tgt.enemy.pos.z-t.pos.z),true,Math.round(TURRET_DMG[effTurretLvl]*dmgMult*atkScale()),0,false);
        burst(t.pos,0xffdd44,2);
      }
    }
  }

  // ── Mines ─────────────────────────────────────────────────
  for(let i=mines.length-1;i>=0;i--){
    const m=mines[i]; m.life-=dt; m.armed-=dt; m.mesh.rotation.y+=dt*2;
    if(m.life<=0){explodeMine(i); continue;}
    if(m.armed<=0&&nearestEnemy(m.pos.x,m.pos.z,2.7)) explodeMine(i);
  }

  // ── Shield Bots ──────────────────────────────────────────
  const sbLvl=playerSkills.shieldBot||0;
  if(sbLvl){
    shieldBotSpawnCd-=dt;
    if(shieldBotSpawnCd<=0){
      shieldBotSpawnCd=SHIELDBOT_RESPAWN_BASE*cdMult;
      spawnShieldBot();
    }
  }
  if(sbLvl||shieldBots.length){
    const effSbLvl = sbLvl || 5;
    for(let i=shieldBots.length-1;i>=0;i--){
      const b=shieldBots[i];
      b.life-=dt;
      const tgt=nearestEnemy(b.pos.x,b.pos.z,4.5);
      if(tgt){
        const dx=tgt.enemy.pos.x-b.pos.x, dz=tgt.enemy.pos.z-b.pos.z;
        const d=Math.hypot(dx,dz)||1;
        const guardRange=0.70+(tgt.enemy?.cfg?.r||0.5);
        steerSummon(b,tgt.enemy.pos.x-dx/d*guardRange,tgt.enemy.pos.z-dz/d*guardRange,3.1,dt,0.25);
      }
      else steerSummon(b,player.pos.x+(i%2?0.95:-0.95),player.pos.z+0.85,3.6,dt,0.35);
      resolveAllySeparation(b,0.58);
      const touchingEnemy=resolveAllyEnemyBody(b,0.58);
      const x=b.pos.x, z=b.pos.z;
      b.pos.x=x; b.pos.z=z;
      const moveDx=x-b.mesh.position.x, moveDz=z-b.mesh.position.z;
      if(tgt) faceSummon(b.mesh,tgt.enemy.pos.x-x,tgt.enemy.pos.z-z,dt,9);
      else faceSummon(b.mesh,moveDx,moveDz,dt,8);
      b.mesh.position.set(x,0.65+Math.sin(now*0.005+i)*0.15,z);
      animateSummonRig('shieldBot',b.mesh,dt,now,Math.hypot(moveDx,moveDz));
      for(const e of enemies){ if(e.dead) continue;
        if(Math.hypot(e.pos.x-x,e.pos.z-z)<0.75+e.cfg.r){
          b.hp-=SUMMON_CONTACT_DMG*dt;
          b.attackCd=Math.max(0,b.attackCd-dt);
          if(b.attackCd<=0){
            triggerSummonAttack(b.mesh,0.30);
            const idx=enemies.indexOf(e);
            if(idx>=0) damageEnemyIndex(idx,Math.round(SHIELDBOT_DMG[effSbLvl]*dmgMult*atkScale()),0x4488ff,0.2,mp.myId,'summon');
            b.attackCd=1.2;
          }
          break;
        }
      }
      if(touchingEnemy) b.hp-=SUMMON_CONTACT_DMG*dt*0.35;
      { const hf=b.hp/b.maxHp; b.mesh.traverse(o=>{ if(o.material&&o.material._base) o.material.opacity=o.material._base*(0.35+0.65*hf); });
        if(b.mesh.userData.eye) b.mesh.userData.eye.material.opacity=(0.55+0.45*Math.abs(Math.sin(now*0.025+i)))*hf; }
      if(b.hp<=0||b.life<=0){
        scene.remove(b.mesh); _disposeGroup(b.mesh); shieldBots.splice(i,1);
        burst({x,z},0x4488ff,6);
      }
    }
  }

  // ── Blade Sentinels ──────────────────────────────────────
  const senLvl=playerSkills.bladeSentinel||0;
  if(senLvl){
    for(const [key,t] of sentinelHitLocks){
      const nt=t-dt;
      if(nt<=0) sentinelHitLocks.delete(key);
      else sentinelHitLocks.set(key,nt);
    }
    // Active cap is enforced in spawnSentinel; existing sentinels expire by life timer.
    sentinelSpawnCd-=dt;
    if(sentinelSpawnCd<=0){
      sentinelSpawnCd=SENTINEL_RESPAWN_BASE*cdMult;
      spawnSentinel();
    }
  }
  if(senLvl||sentinels.length){
    const effSenLvl = senLvl || 5;
    for(let i=sentinels.length-1;i>=0;i--){
      const s=sentinels[i];
      s.life-=dt;
      const tgt=nearestEnemy(s.pos.x,s.pos.z,12);
      if(tgt){
        const dx=tgt.enemy.pos.x-s.pos.x, dz=tgt.enemy.pos.z-s.pos.z;
        const dl=Math.hypot(dx,dz)||1;
        const spd=SENTINEL_SPD[effSenLvl];
        if(dl>0.92){
          s.vel.x=s.vel.x*0.88+(dx/dl)*spd*0.12;
          s.vel.z=s.vel.z*0.88+(dz/dl)*spd*0.12;
        } else {
          s.vel.x*=0.72; s.vel.z*=0.72;
        }
      } else {
        const dx=player.pos.x-s.pos.x, dz=player.pos.z-s.pos.z;
        const dl=Math.hypot(dx,dz)||1;
        if(dl>1.8){ s.vel.x=(dx/dl)*3; s.vel.z=(dz/dl)*3; }
        else { s.vel.x*=0.85; s.vel.z*=0.85; }
      }
      s.pos.x+=s.vel.x*dt; s.pos.z+=s.vel.z*dt;
      resolveAllySeparation(s,0.50);
      const touchingEnemy=resolveAllyEnemyBody(s,0.50);
      let meleeTarget=tgt;
      const meleeReach=(e)=>0.78+((e?.cfg?.r)||0.5);
      if(!meleeTarget||Math.hypot(meleeTarget.enemy.pos.x-s.pos.x,meleeTarget.enemy.pos.z-s.pos.z)>meleeReach(meleeTarget.enemy)){
        meleeTarget=nearestEnemy(s.pos.x,s.pos.z,2.6);
        if(meleeTarget&&Math.hypot(meleeTarget.enemy.pos.x-s.pos.x,meleeTarget.enemy.pos.z-s.pos.z)>meleeReach(meleeTarget.enemy)) meleeTarget=null;
      }
      const targetLockKey=meleeTarget?.enemy?.poolIdx;
      const targetReady=targetLockKey===undefined || (sentinelHitLocks.get(targetLockKey)||0)<=0;
      if(meleeTarget&&s.attackCd<=0&&targetReady){
        const mdx=meleeTarget.enemy.pos.x-s.pos.x, mdz=meleeTarget.enemy.pos.z-s.pos.z;
        const mdl=Math.hypot(mdx,mdz)||1;
        triggerSummonAttack(s.mesh,0.28);
        damageEnemyIndex(meleeTarget.idx,Math.round(SENTINEL_DMG[effSenLvl]*dmgMult*atkScale()),0xff4488,0.14,mp.myId,'summon');
        sentinelHitLocks.set(targetLockKey,meleeTarget.enemy.type==='boss'?0.85:0.52);
        burst(meleeTarget.enemy.pos,0xff4488,4);
        spawnSlashVfx(s.pos.x+mdx*0.5,s.pos.z+mdz*0.5,Math.atan2(mdx,mdz),0xff4488,0.55,0.20);
        s.vel.x=-(mdx/mdl)*3.2; s.vel.z=-(mdz/mdl)*3.2;
        s.attackCd=meleeTarget.enemy.type==='boss'?0.95:0.62;
      }
      const moveDx=s.pos.x-s.mesh.position.x, moveDz=s.pos.z-s.mesh.position.z;
      if(meleeTarget) faceSummon(s.mesh,meleeTarget.enemy.pos.x-s.pos.x,meleeTarget.enemy.pos.z-s.pos.z,dt,13);
      else if(tgt) faceSummon(s.mesh,tgt.enemy.pos.x-s.pos.x,tgt.enemy.pos.z-s.pos.z,dt,13);
      else faceSummon(s.mesh,moveDx,moveDz,dt,10);
      s.mesh.position.set(s.pos.x,0.4+Math.min(Math.abs(s.vel.x+s.vel.z)*0.04,0.3),s.pos.z);
      animateSummonRig('bladeSentinel',s.mesh,dt,now,Math.hypot(moveDx,moveDz));
      s.attackCd=Math.max(0,s.attackCd-dt);
      if(touchingEnemy) s.hp-=SUMMON_CONTACT_DMG*dt;
      { const hf=s.hp/s.maxHp; s.mesh.traverse(o=>{ if(o.material&&o.material._base) o.material.opacity=o.material._base*(0.35+0.65*hf); }); }
      if(s.hp<=0||s.life<=0){
        scene.remove(s.mesh); _disposeGroup(s.mesh); sentinels.splice(i,1);
        burst(s.pos,0xff4488,6);
      }
    }
  }
}

// ── Multiplayer ───────────────────────────────────────────
const PLAYER_COLORS = [
  {body:0x00ccaa,emi:0x00ffcc,hex:'#00ffcc'},
  {body:0xcc0099,emi:0xff00cc,hex:'#ff00cc'},
  {body:0xaaaa00,emi:0xffdd00,hex:'#ffdd00'},
  {body:0xcc4400,emi:0xff6600,hex:'#ff6600'},
  {body:0x66cc33,emi:0xaaff66,hex:'#aaff66'},
  {body:0x3366cc,emi:0x66aaff,hex:'#66aaff'},
];
const MAX_PLAYERS = PLAYER_COLORS.length; // lobby cap — also gates spawn/balance entries
const SPAWN_POS = [[0,ARENA_H-2],[-2,ARENA_H-2],[2,ARENA_H-2],[-4,ARENA_H-2],[4,ARENA_H-2],[-6,ARENA_H-2]];

const mp = createMultiplayerState();
const { broadcastMP, sendToHost, getPeerConfig } = createTransport(mp, {
  getPeerConfig: () => window.NeonBrawlServices.getPeerConfig(),
});

function blankContribution(){
  return {damage:0,taken:0,healing:0,kills:0,revives:0};
}
let waveContribution = blankContribution();
let waveReviveAssistTargets = new Set();
let lastContributionSnapshot = null;
let lastContributionWave = 0;
let runSummarySelectedId = 0;

const DAMAGE_SOURCE_META = {
  bullet:    {label:'BULLET',    color:'#38dfff'},
  melee:     {label:'MELEE',     color:'#ff7a33'},
  orb:       {label:'ORB',       color:'#b46bff'},
  spell:     {label:'SPELL',     color:'#ffd45e'},
  elemental: {label:'ELEMENT',   color:'#66ffcc'},
  summon:    {label:'SUMMON',    color:'#ffcc55'},
  movement:  {label:'MOVEMENT',  color:'#33ffcc'},
  relic:     {label:'RELIC',     color:'#ff3355'},
  skill:     {label:'SKILL',     color:'#e7f1ff'},
};
const DAMAGE_SOURCE_ORDER = ['bullet','melee','orb','spell','elemental','summon','movement','relic','skill'];
let runStats = null;

function blankRunStats(){
  return {
    damage:{bullet:0,melee:0,orb:0,spell:0,elemental:0,summon:0,movement:0,relic:0,skill:0},
    startedAt:performance.now(),
  };
}
function resetRunStats(){
  runStats=blankRunStats();
  lastContributionSnapshot=null;
  lastContributionWave=0;
  runSummarySelectedId=mp.myId||0;
}
function normalizeDamageSource(source){
  return DAMAGE_SOURCE_META[source] ? source : 'skill';
}
function recordRunDamageSource(amount, source){
  if(!runStats) resetRunStats();
  const key=normalizeDamageSource(source);
  runStats.damage[key]=(runStats.damage[key]||0)+Math.max(0,Math.round(amount||0));
}
function escHtml(s){
  return String(s??'').replace(/[&<>"']/g,ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
}

function cloneContribution(s){
  return {
    damage:Math.round(s?.damage||0),
    taken:Math.round(s?.taken||0),
    healing:Math.round(s?.healing||0),
    kills:Math.round(s?.kills||0),
    revives:Math.round(s?.revives||0),
  };
}
function mergeContribution(a,b){
  const out=cloneContribution(a);
  for(const k of ['damage','taken','healing','kills','revives']) out[k]=Math.max(out[k]||0,Math.round(b?.[k]||0));
  return out;
}
function resetWaveContribution(){
  waveContribution=blankContribution();
  waveReviveAssistTargets=new Set();
  if(mp.isHost) mp.contribStats={};
  hideContributionPanel();
}
function addContribution(id,key,val=1){
  id=Number.isFinite(+id)?+id:mp.myId;
  const n=Math.max(0,Math.round(val||0));
  if(!n) return;
  if(id===mp.myId) waveContribution[key]=(waveContribution[key]||0)+n;
  if(mp.isHost){
    const cur=mp.contribStats[id]||blankContribution();
    cur[key]=(cur[key]||0)+n;
    mp.contribStats[id]=cur;
  }
}
function recordDamageDealt(amount,ownerId=mp.myId,source='skill'){
  addContribution(ownerId,'damage',amount);
  if(ownerId===mp.myId) recordRunDamageSource(amount,source);
  // Vampire Pact relic: lifesteal a percentage of every damage you (the local
  // player) deal. Centralised here so every source path that already reports
  // damage automatically gets vampire heal — bullets, melee, orbs, spells,
  // summons (via owner), AoE blasts. Bypasses healPlayer's lastStandCore
  // halving because vampire pact is meant to be the heal source.
  if(ownerId===mp.myId && hasRelic('vampirePact') && !player.dead && !healingChallengeBlocked() && amount>0){
    const heal=Math.max(1,Math.round(amount*vampirePactRate()));
    const _maxHp=playerStats.maxHp||MAX_HP;
    if(player.hp<_maxHp){
      const before=player.hp;
      player.hp=Math.min(_maxHp,player.hp+heal);
      const gained=player.hp-before;
      if(gained>0){ refreshHP(); addContribution(mp.myId,'healing',gained); }
    }
  }
}
function recordDamageTaken(amount){ addContribution(mp.myId,'taken',amount); }
function recordHealing(amount){ addContribution(mp.myId,'healing',amount); }
function recordKill(ownerId=mp.myId){ addContribution(ownerId,'kills',1); }
function recordReviveAssist(targetId){
  const key=String(targetId);
  if(waveReviveAssistTargets.has(key)) return;
  waveReviveAssistTargets.add(key);
  addContribution(mp.myId,'revives',1);
}
function healingChallengeBlocked(){
  return waveEvent?.type==='challenge'&&waveEvent.sub==='plagueField';
}
function normalHealingMultiplier(){
  if(player.dead||player.downed||healingChallengeBlocked()||vampirePactHardBlock()) return 0;
  return hasRelic('lastStandCore')&&player.hp>playerStats.maxHp*0.5
    ? RELIC_LEVELS.lastStandCore.healMul[relicLevel('lastStandCore')] : 1;
}
function healPlayer(amount){
  if(!amount||player.dead) return 0;
  // Vampire Pact L3 — no heal source other than the lifesteal hook in
  // recordDamageDealt is allowed (that path writes player.hp directly and
  // bypasses healPlayer). Catches heal bags, buff-cache heals, steady
  // pulse, second skin, leech-on-kill, etc.
  const multiplier=normalHealingMultiplier();
  if(multiplier<=0) return 0;
  const rawHeal=Math.max(0,Math.round(amount*multiplier));
  const before=player.hp;
  const maxHp=playerStats.maxHp||MAX_HP;
  const overheal=Math.max(0,before+rawHeal-maxHp);
  player.hp=Math.min(maxHp,player.hp+rawHeal);
  const gained=Math.max(0,player.hp-before);
  if(gained) recordHealing(gained);
  const shieldPct=OVERHEAL_SHIELD_PCT[playerSkills.overhealFrame||0]||0;
  if(overheal>0&&shieldPct>0) addOverhealShield(Math.max(1,Math.round(overheal*shieldPct)));
  refreshHP();
  return gained;
}
function mergeRemoteContribution(id,stats){
  if(!mp.isHost||!stats) return;
  mp.contribStats[id]=mergeContribution(mp.contribStats[id],stats);
}
function contributionSnapshot(){
  const idSet=new Set((mp.connected?mpPlayerIds():[mp.myId]).filter(id=>id>=0&&id<MAX_PLAYERS));
  // Include any id we've tracked stats for, even if mp.remotePlayers was cleaned up.
  if(mp.isHost){
    for(const k of Object.keys(mp.contribStats)){
      const n=+k; if(n>=0&&n<MAX_PLAYERS) idSet.add(n);
    }
  }
  const ids=[...idSet].sort((a,b)=>a-b);
  const snap={};
  for(const id of ids){
    const own=id===mp.myId?waveContribution:null;
    snap[id]=mergeContribution(mp.contribStats[id],own);
  }
  return snap;
}
function formatStat(n){ return Math.round(n||0).toLocaleString(); }
function showContributionPanel(snapshot,w=waveNum){
  if(mp.soloMode||!mp.connected) return;
  lastContributionSnapshot={};
  for(const id of Object.keys(snapshot||{})) lastContributionSnapshot[id]=cloneContribution(snapshot[id]);
  lastContributionWave=w;
  const panel=document.getElementById('contribPanel');
  const grid=document.getElementById('contribGrid');
  const wave=document.getElementById('contribWave');
  if(!panel||!grid) return;
  const ids=Object.keys(snapshot||{}).map(Number).sort((a,b)=>a-b);
  if(!ids.length) return;
  const keys=[
    ['damage','DMG'],
    ['taken','TAKEN'],
    ['healing','HEAL'],
    ['kills','KILL'],
    ['revives','REV'],
  ];
  const best={};
  for(const [k] of keys) best[k]=Math.max(...ids.map(id=>snapshot[id]?.[k]||0));
  if(wave) wave.textContent=`LEVEL ${w}`;
  grid.innerHTML='';
  ['PLAYER',...keys.map(x=>x[1])].forEach(t=>{
    const c=document.createElement('div');
    c.className='contrib-cell contrib-headcell';
    c.textContent=t;
    grid.appendChild(c);
  });
  for(const id of ids){
    const st=cloneContribution(snapshot[id]);
    const name=document.createElement('div');
    name.className='contrib-cell name';
    name.innerHTML=`<span class="contrib-dot" style="color:${PLAYER_COLORS[id%MAX_PLAYERS].hex};background:${PLAYER_COLORS[id%MAX_PLAYERS].hex}"></span><span class="contrib-pname">${playerDisplayName(id)}</span>`;
    grid.appendChild(name);
    for(const [k] of keys){
      const c=document.createElement('div');
      c.className='contrib-cell'+(best[k]>0&&st[k]===best[k]?' contrib-best':'');
      c.textContent=formatStat(st[k]);
      grid.appendChild(c);
    }
  }
  panel.style.display='block';
  requestAnimationFrame(()=>panel.classList.add('show'));
  clearTimeout(panel._hideT);
}
function hideContributionPanel(){
  const panel=document.getElementById('contribPanel');
  if(!panel) return;
  panel.classList.remove('show');
  clearTimeout(panel._hideT);
  panel._hideT=setTimeout(()=>{ if(!panel.classList.contains('show')) panel.style.display='none'; },240);
}

function smoothNetPos(renderPos, targetPos, dt, rate, snapDist = 7){
  const dx = targetPos.x - renderPos.x;
  const dz = targetPos.z - renderPos.z;
  if(dx * dx + dz * dz > snapDist * snapDist){
    renderPos.x = targetPos.x;
    renderPos.z = targetPos.z;
    return;
  }
  const t = 1 - Math.exp(-rate * dt);
  renderPos.x += dx * t;
  renderPos.z += dz * t;
}

function angleLerp(a, b, t){
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if(d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function setMpStatus(txt){ const el=document.getElementById('mpStatus'); if(el) el.textContent=txt; }
function showReconnectToast(msg){ const el=document.getElementById('reconnectToast'); if(el){el.textContent=msg;el.style.display=msg?'block':'none';} }

function defaultPlayerName(id){ return `P${(+id||0)+1}`; }
function cleanPlayerName(name,id=mp.myId){
  const s=String(name||'').replace(/[^\p{L}\p{N} _-]/gu,'').trim().slice(0,14);
  return s || defaultPlayerName(id);
}
function getLocalPlayerName(){
  // Auto-derive: signed-in user → profile.display_name; guest → "P<n>".
  const slot = (+mp.myId || 0);
  const nm = (window.PixoPlayerCard && window.PixoPlayerCard.localName(slot)) || defaultPlayerName(slot);
  return cleanPlayerName(nm, slot);
}
function getLocalUserId(){
  return (window.PixoPlayerCard && window.PixoPlayerCard.localUserId()) || null;
}
function setPlayerName(id,name){
  const next=cleanPlayerName(name,id);
  if(mp.names[id]===next) return;
  mp.names[id]=next;
  const rp=mp.remotePlayers[id];
  if(rp) rp.name=mp.names[id];
  updateLobbyUI();
}
function playerDisplayName(id){
  return mp.names[id] || mp.remotePlayers[id]?.name || defaultPlayerName(id);
}
function lobbyPlayerIds(){
  if(!mp.connected) return [];
  const ids=new Set([mp.myId]);
  Object.keys(mp.names).forEach(id=>ids.add(+id));
  Object.keys(mp.remotePlayers).forEach(id=>ids.add(+id));
  if(mp.isHost) ids.add(0);
  return [...ids].filter(id=>id>=0&&id<MAX_PLAYERS).sort((a,b)=>a-b);
}
function broadcastNameUpdate(id){
  if(!mp.connected) return;
  const msg={type:'PLAYER_NAME',id,name:playerDisplayName(id)};
  if(mp.isHost) broadcastMP(msg);
  else sendToHost(msg);
}
function updateLobbyUI(){
  const connected=!!mp.connected;
  const play=document.getElementById('playBtn');
  const host=document.getElementById('hostBtn');
  const joinChoice=document.getElementById('joinChoiceBtn');
  const lobby=document.getElementById('roomLobby');
  const roomTitle=document.getElementById('roomLobbyTitle');
  const roomCode=document.getElementById('roomCodeDisplay');
  const copyBtn=document.getElementById('copyRoomBtn');
  if(play){
    play.disabled=connected;
    play.style.display=connected?'none':'';
  }
  if(joinChoice) joinChoice.style.display=connected?'none':'';
  if(lobby) lobby.style.display=connected?'block':'none';
  // Tell the player they're still in a room even on the main menu (where the
  // PLAY SOLO button is hidden): recolor + relabel the MULTIPLAYER card.
  const mpCard=document.getElementById('nbBtnMP');
  if(mpCard){
    mpCard.classList.toggle('in-room', connected);
    mpCard.textContent = connected ? (`🌐 IN ROOM ${mp.roomCode||''}`).trim() : '🌐 MULTIPLAYER';
  }
  if(connected) nbCloseJoinPopup();
  if(roomTitle) roomTitle.textContent=connected ? `ROOM ${mp.roomCode||''}` : 'ROOM';
  if(roomCode) roomCode.textContent=connected ? (mp.roomCode||roomCode.textContent||'') : '';
  if(copyBtn) copyBtn.style.display=connected&&mp.roomCode?'inline-flex':'none';
  if(host){
    host.disabled=connected&&!mp.isHost;
    host.textContent=connected ? (mp.isHost?'START GAME':'WAITING FOR HOST') : 'HOST GAME';
  }
  // Refresh our own userId in case the user just signed in.
  mp.userIds[mp.myId] = getLocalUserId();
  // Show INVITE FRIEND button to host once a room code exists.
  const inviteBtn = document.getElementById('inviteFriendBtn');
  if (inviteBtn) inviteBtn.style.display = (connected && mp.isHost && mp.roomCode) ? '' : 'none';
  const roster=document.getElementById('roomRoster');
  if(roster){
    roster.innerHTML='';
    const active=new Set(lobbyPlayerIds());
    for(let id=0;id<MAX_PLAYERS;id++){
      const row=document.createElement('div');
      row.className='room-player'+(active.has(id)?'':' empty');
      const dot=document.createElement('div');
      dot.className='room-dot';
      dot.style.color=PLAYER_COLORS[id].hex;
      dot.style.background=active.has(id)?PLAYER_COLORS[id].hex:'transparent';
      const nm=document.createElement('div');
      nm.className='room-player-name';
      const displayName = active.has(id) ? playerDisplayName(id) : 'Empty';
      nm.textContent = displayName;
      // Clickable name → action menu (Add Friend / View Player Card).
      // Self gets a glow instead of a chip; empty slots are inert.
      if (active.has(id) && window.PixoPlayerCard) {
        if (id === mp.myId) {
          window.PixoPlayerCard.markSelf(nm);
        } else {
          window.PixoPlayerCard.attachClickable(nm, mp.userIds[id] || null, { displayName });
        }
      }
      const role=document.createElement('div');
      role.className='room-player-role';
      role.textContent = id===0?'HOST':`P${id+1}`;
      row.append(dot, nm, role);
      roster.appendChild(row);
    }
  }
  // Difficulty: read-only label for everyone; host also gets the segmented
  // picker. The host's choice rides on LOBBY_CFG (live) + GAME_START (on start).
  const diffShow=document.getElementById('roomDiffShow');
  const diffSeg=document.getElementById('roomDiffSeg');
  const cur=DIFFICULTY[mp.hostDifficulty]?mp.hostDifficulty:'hard';
  if(diffShow){
    diffShow.textContent=(DIFFICULTY[cur]?.label)||'HARD';
    diffShow.style.color=nbDiffColor(cur);
    diffShow.style.textShadow='0 0 10px '+nbDiffColor(cur)+'66';
  }
  if(diffSeg){
    diffSeg.style.display=mp.isHost?'':'none';
    if(mp.isHost){
      diffSeg.innerHTML='';
      NB_DIFF_META.forEach(m=>{
        const b=document.createElement('button');
        b.type='button';
        b.textContent=DIFFICULTY[m.key].label;
        b.style.setProperty('--dc',m.col);
        if(m.key===cur) b.classList.add('active');
        b.addEventListener('click',()=>setLobbyDifficulty(m.key));
        diffSeg.appendChild(b);
      });
    }
  }
  updatePips();
}
// Host-only: change the lobby difficulty, announce it to joiners, refresh UI.
function setLobbyDifficulty(d){
  if(!DIFFICULTY[d] || !mp.isHost) return;
  mp.hostDifficulty=d;
  setNbDifficulty(d); // also remember it for the host's next solo run
  if(mp.connected) broadcastMP({type:'LOBBY_CFG',difficulty:d});
  updateLobbyUI();
}

async function copyRoomCode(){
  const code=(mp.roomCode||document.getElementById('roomCodeDisplay').textContent||'').trim();
  if(!code)return;
  const btn=document.getElementById('copyRoomBtn');
  try{
    if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
    else{const ta=document.createElement('textarea');ta.value=code;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}
    if(btn){btn.classList.add('copied');btn.textContent='✓';setTimeout(()=>{btn.classList.remove('copied');btn.textContent='';},900);}
    setMpStatus(`Copied room code: ${code}`);
  }catch(e){
    if(btn){btn.classList.add('failed');btn.textContent='!';setTimeout(()=>{btn.classList.remove('failed');btn.textContent='';},900);}
    setMpStatus('Copy failed');
  }
}
window.copyRoomCode=copyRoomCode;

function updatePips(){
  for(let i=0;i<MAX_PLAYERS;i++){
    const el=document.getElementById('pip'+i); if(!el) continue;
    const on = i===mp.myId || mp.remotePlayers[i]!==undefined;
    el.classList.toggle('on',on);
    el.style.background = on ? PLAYER_COLORS[i].hex : 'transparent';
  }
}

function buildRemotePlayer(id,name=null){
  if(mp.remotePlayers[id]){
    if(name) setPlayerName(id,name);
    return;
  }
  if(name) mp.names[id]=cleanPlayerName(name,id);
  const col=PLAYER_COLORS[id%MAX_PLAYERS];
  const g=new THREE.Group();
  const bMat=new THREE.MeshStandardMaterial({color:col.body,emissive:col.emi,emissiveIntensity:0.7,roughness:0.35,metalness:0.5});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.58,1.1,10),bMat);
  const hMat=new THREE.MeshStandardMaterial({color:col.emi,emissive:col.emi,emissiveIntensity:1.0,roughness:0.2});
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.36,8,8),hMat); head.position.y=0.88;
  const eyeMat=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:2.8});
  const eyeGeo=new THREE.SphereGeometry(0.075,5,5);
  const eyeL=new THREE.Mesh(eyeGeo,eyeMat); eyeL.position.set(0.18,0.92,0.30);
  const eyeR=new THREE.Mesh(eyeGeo,eyeMat); eyeR.position.set(-0.18,0.92,0.30);
  const gunMat=new THREE.MeshStandardMaterial({color:0xffffff,emissive:col.emi,emissiveIntensity:0.55,roughness:0.3});
  const gun=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.78,6),gunMat);
  gun.rotation.z=Math.PI/2; gun.position.set(0.82,0.42,0);
  g.add(body,head,eyeL,eyeR,gun);
  setHeldMeleeModel(g,'katana');
  g.visible=false; scene.add(g);
  mp.remotePlayers[id]={
    mesh:g,pos:new THREE.Vector3(),renderPos:new THREE.Vector3(),
    hp:MAX_HP,dead:false,downed:false,downedT:0,reviveT:0,reviverCount:0,rot:0,renderRot:0,hasState:false,
    name:playerDisplayName(id), nameTag:null, lastSeen:performance.now(),
    skills:{}, relics:{}, skillVisuals:{orbs:{},summons:{}}, meleeWeapon:'katana', gun:'pistol'
  };
  // Initialize stats slot so this player appears in the wave summary even if
  // they joined late and no PLAYER_STATE with stats has been merged yet.
  if(mp.isHost && !mp.contribStats[id]) mp.contribStats[id]=blankContribution();
  updateLobbyUI();
}

function removeRemotePlayer(id){
  const rp=mp.remotePlayers[id]; if(!rp) return;
  disposeRemoteSkillVisuals(rp);
  disposeMoveTrail(rp);
  disposeReviveZone(+id);
  if(rp.nameTag) rp.nameTag.remove();
  scene.remove(rp.mesh); delete mp.remotePlayers[id]; updatePips();
  updateLobbyUI();
}

function removeDisconnectedPlayer(id,status='left',notify=true){
  id=+id;
  if(id===mp.myId) return;
  const conn=mp.conns.get(id);
  if(conn){ try{ if(conn.open) conn.close(); }catch(e){} }
  mp.conns.delete(id);
  delete mp.names[id];
  delete mp.userIds[id];
  delete mp.buffReady[id];
  delete mp.gunReady[id];
  delete mp.meleeReady[id];
  delete mp.rematchReady[id];
  // Drop accumulated wave contributions for the departed player so the
  // post-wave summary doesn't keep showing them as a phantom row. The
  // recent contributionSnapshot change unions contribStats keys into the
  // displayed ids, which made this leak visible.
  if(mp.isHost && mp.contribStats) delete mp.contribStats[id];
  removeRemotePlayer(id);
  if(mp.isHost&&notify) broadcastMP(JSON.stringify({type:'PLAYER_LEAVE',id}));
  setMpStatus(`Player ${id+1} ${status}`);
  updateLobbyUI();
  if(mp.isHost&&gState==='buffwait'){
    showBuffWaiting();
    broadcastBuffReadyState();
    if(allBuffReady()) markBuffReady(mp.myId);
  }
  if(mp.isHost&&gState==='meleeselect'){
    showMeleeSelect();
    broadcastMeleeReadyState();
    if(allMeleeReady()) markMeleeReady(mp.myId,player.meleeWeapon);
  }
  if(mp.isHost&&gState==='rematchwait'){
    showRematchWaiting();
    broadcastRematchReadyState();
    if(allRematchReady()) markRematchReady(mp.myId);
  }
  if(mp.isHost&&gState==='gunselect'){
    showGunSelect();
    broadcastGunReadyState();
    if(allGunReady()) markGunReady(mp.myId,player.gun);
  }
  // Exit-ready has no dedicated gState (gState stays 'playing' the whole time you're waiting at the
  // portal) — gate on exitOpen instead, mirroring markExitReady's own auto-advance tail.
  if(mp.isHost&&exitOpen&&!mp.exitStartQueued){
    broadcastExitReadyState(mp.exitMode);
    if(allExitReady()){
      mp.exitStartQueued=true;
      broadcastMP({type:'EXIT_GO',wave:waveNum,mode:mp.exitMode});
      setTimeout(()=>completeExitTransition(mp.exitMode),120);
    }
  }
}

function getNameTag(id){
  const layer=document.getElementById('nameLayer');
  if(!layer) return null;
  if(id===mp.myId){
    if(!player.nameTag){
      player.nameTag=document.createElement('div');
      player.nameTag.className='player-name-tag';
      layer.appendChild(player.nameTag);
    }
    return player.nameTag;
  }
  const rp=mp.remotePlayers[id];
  if(!rp) return null;
  if(!rp.nameTag){
    rp.nameTag=document.createElement('div');
    rp.nameTag.className='player-name-tag';
    layer.appendChild(rp.nameTag);
  }
  return rp.nameTag;
}
function placeNameTag(id,x,y,z,visible=true){
  const tag=getNameTag(id);
  if(!tag) return;
  tag.textContent=playerDisplayName(id);
  tag.style.color=PLAYER_COLORS[id%MAX_PLAYERS].hex;
  if(!visible||gState!=='playing'){tag.style.display='none';return;}
  _scratchProj.set(x,y,z).project(camera);
  if(_scratchProj.z<-1||_scratchProj.z>1){tag.style.display='none';return;}
  tag.style.display='block';
  // #nameLayer lives inside #ui (`position:fixed; inset:0`) so its top-left is
  // at viewport (0,0). The canvas itself is offset right+down by the chrome
  // bars, so canvas-pixel coords have to be shifted into viewport space.
  const rect=_canvasRect||canvas.getBoundingClientRect();
  tag.style.left=((_scratchProj.x*0.5+0.5)*rect.width  + rect.left)+'px';
  tag.style.top =((-_scratchProj.y*0.5+0.5)*rect.height + rect.top )+'px';
}
function updatePlayerNameTags(){
  if(gState!=='playing'){
    if(player.nameTag) player.nameTag.style.display='none';
    for(const rp of Object.values(mp.remotePlayers)) if(rp.nameTag) rp.nameTag.style.display='none';
    return;
  }
  if(mp.connected){
    placeNameTag(mp.myId,player.pos.x,2.35,player.pos.z,!player.dead||player.downed);
  } else if(player.nameTag) player.nameTag.style.display='none';
  for(const [id,rp] of Object.entries(mp.remotePlayers)){
    const visible=rp.mesh?.visible&&(!rp.dead||rp.downed);
    const p=rp.renderPos||rp.pos;
    placeNameTag(+id,p.x,rp.downed?1.35:2.35,p.z,visible);
  }
}

function sendPresencePing(){
  if(!mp.connected) return;
  const msg={type:'PING',id:mp.myId,name:playerDisplayName(mp.myId),userId:getLocalUserId()};
  if(mp.isHost) broadcastMP(msg);
  else sendToHost(msg);
}

function updateMultiplayerPresence(dt){
  if(!mp.connected) return;
  const now=performance.now();
  mp.pingT+=dt;
  if(mp.pingT>=MP_PING_DT){
    mp.pingT=0;
    sendPresencePing();
  }
  if(mp.isHost){
    for(const [id,rp] of Object.entries(mp.remotePlayers)){
      const conn=mp.conns.get(+id);
      const stale=now-(rp.lastSeen||now)>MP_TIMEOUT*1000;
      if(stale||!conn||conn.open===false) removeDisconnectedPlayer(+id,'disconnected');
    }
  } else if(mp.lastHostSeen && !document.hidden && now-mp.lastHostSeen>MP_TIMEOUT*1000){
    // Skip the timeout-eject when the tab is backgrounded — perf.now()
    // keeps ticking but no MP messages arrive, so we'd kick the player to
    // the menu on every tab-blur of MP_TIMEOUT or more. The visibility
    // listener below rebases lastHostSeen when the tab returns so the
    // first frame back doesn't trip the timeout either.
    returnToMenuAfterDisconnect('Host disconnected');
  }
}
// Rebase the host-seen timestamp on tab return so a fresh frame doesn't
// fire the disconnect check before any PING has had a chance to arrive.
if(typeof document!=='undefined' && !document._nbVisHooked){
  document._nbVisHooked = true;
  document.addEventListener('visibilitychange', ()=>{
    if(!document.hidden && typeof mp!=='undefined' && mp.lastHostSeen){
      mp.lastHostSeen = performance.now();
    }
  });
}

const REMOTE_ORB_DEFS = [
  {id:'fireball',color:0xff5500},
  {id:'iceOrb',color:0x88ddff},
  {id:'thunderOrb',color:0xffff44},
  {id:'poisonOrb',color:0x55ee44},
];
const REMOTE_SUMMON_DEFS = [
  {id:'laserDrone',color:0xffdd44,make:()=>buildDroneMesh(0.82),count:lvl=>Math.min(3,DRONE_COUNT[lvl]||1),height:0.82,trail:0xffdd44},
  {id:'repairDrone',color:0x44ff88,make:()=>buildRepairDroneMesh(0.76),count:()=>1,height:1.02,trail:0x44ff88},
  {id:'guardianTurret',color:0xffdd44,make:()=>buildTurretMesh(0.74),count:lvl=>lvl>=4?2:1,height:0.28},
  {id:'mineLayer',color:0xffaa00,make:()=>new THREE.Mesh(mineGeo,new THREE.MeshBasicMaterial({color:0xffaa00,transparent:true,opacity:0.70,blending:THREE.AdditiveBlending})),count:()=>0,height:0.08},
  {id:'shieldBot',color:0x4488ff,make:()=>buildShieldBotMesh(0.82),count:()=>1,height:0.62},
  {id:'bladeSentinel',color:0xff4488,make:()=>buildSentinelMesh(0.82),count:()=>1,height:0.42},
];

function remoteEpicRank(skills, id){
  const lvl=skills?.[id]||0;
  return lvl>=5 ? 2 : (lvl>0 ? 1 : 0);
}
function remoteOrbCount(skillId, skills={}, relics={}){
  const baseCount=ORB_COUNT[skills[skillId]||0]||0;
  if(!baseCount) return 0;
  const twinBonus=remoteEpicRank(skills,'twinOrbit');
  const splitMult=skills.orbGalaxy?2:1;
  const relicMult=relics.orbEngine?1.5:1;
  return Math.min(relics.orbEngine?18:12,Math.ceil((baseCount+twinBonus)*splitMult*relicMult));
}
function remoteOrbVisualScale(skillId, now, i, skills={}){
  const sizeMult=ORB_SIZE_SCL[skills.orbSize||0]||1;
  if(skillId==='fireball') return (0.88+0.12*Math.sin(now*0.009+i*1.3))*sizeMult;
  if(skillId==='iceOrb') return (0.90+0.10*Math.sin(now*0.007+i*2.1))*sizeMult;
  if(skillId==='thunderOrb') return (0.85+0.15*Math.abs(Math.sin(now*0.012+i)))*sizeMult;
  if(skillId==='poisonOrb') return (0.82+0.18*Math.sin(now*0.005+i*2.5))*sizeMult;
  return (0.88+0.10*Math.sin(now*0.008+i))*sizeMult;
}
function remoteSummonSizeMult(skills={}){
  return Math.sqrt(SUMMON_PWR_MULT[skills.summonPower||0]||1);
}

function disposeRemoteSkillVisuals(rp){
  if(!rp?.skillVisuals) return;
  for(const list of Object.values(rp.skillVisuals.orbs||{})){
    for(const m of list){ disposeTrail(m.userData.trail); scene.remove(m); m.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();}); }
  }
  for(const list of Object.values(rp.skillVisuals.summons||{})){
    for(const m of list){ if(m.userData.trail) disposeTrail(m.userData.trail); scene.remove(m); _disposeGroup(m); }
  }
  rp.skillVisuals={orbs:{},summons:{}};
}

function setRemoteVisualCount(list, count, makeFn, trailColor=null, trailFactory=createTrail){
  while(list.length<count){
    const m=makeFn();
    m.userData.remoteBaseScale=m.scale?.x||1;
    if(trailColor!==null) m.userData.trail=trailFactory(trailColor);
    m.visible=false; scene.add(m); list.push(m);
  }
  while(list.length>count){
    const m=list.pop();
    if(m.userData.trail) disposeTrail(m.userData.trail);
    scene.remove(m); m.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();});
  }
}

function syncRemoteSkillVisuals(rp){
  rp.skillVisuals=rp.skillVisuals||{orbs:{},summons:{}};
  const skills=rp.skills||{};
  const relics=rp.relics||{};
  for(const def of REMOTE_ORB_DEFS){
    const count=remoteOrbCount(def.id,skills,relics);
    const list=rp.skillVisuals.orbs[def.id]||(rp.skillVisuals.orbs[def.id]=[]);
    setRemoteVisualCount(list,count,()=>_buildOrbMesh(def.id,def.color),def.color,createOrbTrail);
  }
  for(const def of REMOTE_SUMMON_DEFS){
    const synced=Array.isArray(rp.summons?.[def.id])?rp.summons[def.id]:null;
    const count=synced?synced.length:0;
    const list=rp.skillVisuals.summons[def.id]||(rp.skillVisuals.summons[def.id]=[]);
    setRemoteVisualCount(list,count,def.make,def.trail??null);
  }
}

function updateRemoteSkillVisuals(dt, now){
  for(const rp of Object.values(mp.remotePlayers)){
    syncRemoteSkillVisuals(rp);
    const visible=rp.mesh?.visible&&!rp.dead&&!rp.downed;
    const px=rp.renderPos?.x??rp.pos.x, pz=rp.renderPos?.z??rp.pos.z;
    const skills=rp.skills||{};
    const summonSize=remoteSummonSizeMult(skills);
    let orbitSeed=0;
    for(const def of REMOTE_ORB_DEFS){
      const list=rp.skillVisuals.orbs[def.id]||[];
      const lvl=skills[def.id]||0;
      const spd=(def.id==='fireball'?FIREBALL_SPD[lvl]:ORB_SPD[lvl])*(ORB_SPD_MULT[skills.orbSpeed||0]||1);
      const step=list.length?Math.PI*2/list.length:0;
      const orbitR=orbOrbitRadius(now, skills);
      for(let i=0;i<list.length;i++){
        const m=list[i]; m.visible=visible;
        if(!visible) continue;
        const ang=now*0.001*spd+i*step+orbitSeed;
        const x=px+Math.cos(ang)*orbitR, z=pz+Math.sin(ang)*orbitR;
        m.position.set(x,0.62+Math.sin(now*0.006+i)*0.18,z);
        m.scale.setScalar(remoteOrbVisualScale(def.id,now,i,skills));
        m.rotation.x+=dt*2.5; m.rotation.y+=dt*3.5;
        if(m.userData.trail) updateTrail(m.userData.trail,x,m.position.y,z);
      }
      orbitSeed+=0.7;
    }
    for(const def of REMOTE_SUMMON_DEFS){
      const list=rp.skillVisuals.summons[def.id]||[];
      const synced=Array.isArray(rp.summons?.[def.id])?rp.summons[def.id]:null;
      const step=list.length?Math.PI*2/list.length:0;
      for(let i=0;i<list.length;i++){
        const m=list[i]; m.visible=visible;
        if(!visible) continue;
        if(!synced||!synced[i]){ m.visible=false; continue; }
        const target=synced[i];
        if(!m.userData.renderPos) m.userData.renderPos={x:target.x,z:target.z,ready:false};
        if(!m.userData.renderPos.ready||Math.hypot(m.userData.renderPos.x-target.x,m.userData.renderPos.z-target.z)>5){
          m.userData.renderPos.x=target.x; m.userData.renderPos.z=target.z; m.userData.renderPos.ready=true;
        } else {
          m.userData.renderPos.x+=(target.x-m.userData.renderPos.x)*Math.min(1,dt*16);
          m.userData.renderPos.z+=(target.z-m.userData.renderPos.z)*Math.min(1,dt*16);
        }
        const x=m.userData.renderPos.x, z=m.userData.renderPos.z;
        const moveDx=x-m.position.x, moveDz=z-m.position.z;
        m.scale.setScalar((m.userData.remoteBaseScale||1)*summonSize);
        if((target.a||0)!==(m.userData.seenAttackSeq||0)){
          m.userData.seenAttackSeq=target.a||0;
          triggerSummonAttack(m,target.d||0.22,false);
        }
        const aim=nearestEnemy(x,z,def.id==='guardianTurret'?10:def.id==='bladeSentinel'?8:5);
        if(aim&&(def.id==='guardianTurret'||def.id==='bladeSentinel'||def.id==='shieldBot'||def.id==='laserDrone')){
          faceSummon(m,aim.enemy.pos.x-x,aim.enemy.pos.z-z,dt,def.id==='guardianTurret'?14:10);
        } else if(def.id!=='repairDrone') {
          faceSummon(m,moveDx,moveDz,dt,8);
        } else {
          faceSummon(m,px-x,pz-z,dt,8);
        }
        m.position.set(x,def.height+Math.sin(now*0.006+i)*0.08,z);
        animateSummonRig(def.id,m,dt,now,Math.hypot(moveDx,moveDz));
        if(m.userData.trail) updateTrail(m.userData.trail,x,m.position.y,z);
      }
    }
  }
}

function isLivingPlayerState(p){
  return !!p && !p.dead && !p.downed;
}

function getNearestPlayer(ex,ez){
  let best=null;
  if(isLivingPlayerState(player)){
    best={x:player.pos.x,z:player.pos.z,
          dist:Math.hypot(player.pos.x-ex,player.pos.z-ez),
          isLocal:true,id:mp.myId};
  }
  for(const [sid,rp] of Object.entries(mp.remotePlayers)){
    if(!isLivingPlayerState(rp)) continue;
    const d=Math.hypot(rp.pos.x-ex,rp.pos.z-ez);
    if(!best||d<best.dist) best={x:rp.pos.x,z:rp.pos.z,dist:d,isLocal:false,id:+sid};
  }
  return best;
}

function _summonPos(ref){
  return ref?.pos || ref?.userData?.pos || {x:0,z:0};
}

function _summonMesh(ref, type){
  if(ref?.mesh) return ref.mesh;
  if(type==='laserDrone') return summonDrones.find(m=>m.userData===ref)||null;
  if(type==='repairDrone') return repairDrones.find(m=>m.userData===ref)||null;
  return null;
}

function _summonTarget(ref, type, ex, ez, radius=0.65){
  if(!ref||ref.hp<=0) return null;
  const p=_summonPos(ref);
  return {x:p.x,z:p.z,dist:Math.hypot(p.x-ex,p.z-ez),isLocal:false,isSummon:true,summonRef:ref,summonType:type,id:-1,radius};
}

function _pickCloserSummon(best, cand, bias){
  if(!best) return cand || null;
  if(cand&&cand.dist < best.dist*bias) return cand;
  return best;
}

function getSummonHitTarget(x,z,hitR=0.22){
  let best=null;
  const consider=(cand)=>{
    if(!cand) return;
    const d=Math.hypot(cand.x-x,cand.z-z);
    if(d<cand.radius+hitR&&(!best||d<best.dist)) best={...cand,dist:d};
  };
  for(const m of summonDrones) consider(_summonTarget(m.userData,'laserDrone',x,z,0.62));
  for(const m of repairDrones) consider(_summonTarget(m.userData,'repairDrone',x,z,0.58));
  for(const t of turrets) consider(_summonTarget(t,'turret',x,z,0.75));
  for(const b of shieldBots) consider(_summonTarget(b,'shieldBot',x,z,0.72));
  for(const s of sentinels) consider(_summonTarget(s,'sentinel',x,z,0.62));
  return best;
}

function tickRammer(e,dt,tgt){
  const ram=e.ram;
  const controlled=!!e.gravitySource||e.stagger>.1;
  if(e.stagger>0&&(controlled||ram.phase!=='idle'))e.stagger=Math.max(0,e.stagger-dt);
  return ram.tick(dt,{
    dx:tgt.x-e.pos.x,dz:tgt.z-e.pos.z,distance:tgt.dist,
    canStart:e.spawnAnim<=0&&!lineBlockedByObstacle(e.pos.x,e.pos.z,tgt.x,tgt.z,.1),
    controlled,speed:14*Math.min(1.25,Math.max(1,e.spd/e.cfg.spd))*((slowMap.get(e.poolIdx)||0)>0?.35:1),
    warn(dx,dz){spawnWarningLine(e.pos.x,e.pos.z,Math.atan2(dx,dz),12,e.cfg.r*2,0xffbb44,.9);enemyAlert(e,'CHARGE',0xffbb44);},
    crash(){enemyAlert(e,'EXPOSED',0xffffff);impactPulse(e.pos,0xffbb44,1.5,isMobile?4:8);},
    move(dx,dz,distance){
      let moved=0;
      while(moved<distance-.0001){
        const step=Math.min(.12,distance-moved),x=e.pos.x+dx*step,z=e.pos.z+dz*step;
        if(isBlockedAt(x,z,e.cfg.r))return {distance:moved,blocked:true};
        e.pos.x=x;e.pos.z=z;moved+=step;
        const target=getEnemyTarget(x,z),key=target?.isSummon?target.summonRef:target?.id;
        if(target&&target.dist<e.cfg.r+(target.radius||.6)&&!ram.hit.has(key)&&!lineBlockedByObstacle(x,z,target.x,target.z,.05)){
          ram.hit.add(key);dealDmgToTarget(target,Math.round(24*e.dmgMult));triggerEnemyAttack(e,.2);
        }
      }
      return {distance:moved,blocked:false};
    }
  });
}
function getEnemyTarget(ex, ez){
  let best = getNearestPlayer(ex, ez);
  // Mobile allies are valid targets too. Repair drones are fragile but can draw fire
  // when they hover closer than the player.
  for(const m of summonDrones)
    best=_pickCloserSummon(best,_summonTarget(m.userData,'laserDrone',ex,ez,0.62),0.82);
  for(const m of repairDrones)
    best=_pickCloserSummon(best,_summonTarget(m.userData,'repairDrone',ex,ez,0.58),0.95);
  // Turrets: stationary ally, enemies switch to it if significantly closer
  for(const t of turrets){
    best=_pickCloserSummon(best,_summonTarget(t,'turret',ex,ez,0.75),0.68);
  }
  // Shield bots: high-HP guards that draw pressure when they step forward
  for(const b of shieldBots){ if(b.dead) continue;
    best=_pickCloserSummon(best,_summonTarget(b,'shieldBot',ex,ez,0.72),0.78);
  }
  // Sentinels: actively move toward enemies, fair targets
  for(const s of sentinels){ if(s.dead) continue;
    best=_pickCloserSummon(best,_summonTarget(s,'sentinel',ex,ez,0.62),0.82);
  }
  return best;
}

function applyHostEnemyState(data){
  if(!data) return;
  const activeSet=new Set(data.map(e=>e.pidx));
  for(let i=enemies.length-1;i>=0;i--){
    if(!activeSet.has(enemies[i].poolIdx)){releaseEnemySlot(enemies[i]);enemies.splice(i,1);}
  }
  const byPoolIdx=new Map(enemies.map(e=>[e.poolIdx,e]));
  for(const ed of data){
    let e=byPoolIdx.get(ed.pidx);
    if(!e){
      const slot=acquireEnemySlot(ed.type,ed.x,ed.z); if(!slot) continue;
      const cfg=ETYPES[ed.type];
      e={type:ed.type,poolIdx:ed.pidx,mesh:slot.mesh,cfg,
         hp:ed.hp,maxHp:ed.maxHp||cfg.hp,pos:new THREE.Vector3(ed.x,0,ed.z),
         netX:ed.x,netZ:ed.z,netVX:ed.vx||0,netVZ:ed.vz||0,netExtrapT:0,netReady:true,
         elite:ed.elite||null,eliteName:ed.eliteName||'',
         bossName:ed.bossName||'',bossProfile:ed.bossName?BOSS_PROFILES[ed.bossName]:null,
         dead:false,fireCd:1,stagger:0,avoidX:0,avoidZ:0,stuckT:0,prevX:ed.x,prevZ:ed.z,stuckCheck:0,
         detourT:0,detourX:0,detourZ:0,
         hitFlashT:0,spawnAnim:0.4,
         attackT:0,attackDur:ed.atd||0.24,attackSeq:ed.atq||0,seenAttackSeq:ed.atq||0,
         spd:cfg.spd,dmgMult:1,chargeT:0,
         dashT:2,dashActive:0,dashDX:0,dashDZ:0};
      enemies.push(e);
      byPoolIdx.set(e.poolIdx,e);
      applyEnemyVisual(e);
      e.mesh.scale.setScalar(1);
    } else {
      e.netX=ed.x; e.netZ=ed.z; e.netVX=ed.vx||0; e.netVZ=ed.vz||0; e.netExtrapT=0; e.netReady=true; e.hp=ed.hp;
      if(Math.hypot(e.pos.x-ed.x,e.pos.z-ed.z)>5.5) e.pos.set(ed.x,0,ed.z);
      if(ed.bossName&&e.bossName!==ed.bossName){e.bossName=ed.bossName;e.bossProfile=BOSS_PROFILES[ed.bossName]||null;applyEnemyVisual(e);}
      if(e.elite!==ed.elite){e.elite=ed.elite||null;e.eliteName=ed.eliteName||'';applyEnemyVisual(e);}
      if((ed.atq||0)!==(e.seenAttackSeq||0)){e.seenAttackSeq=ed.atq||0;triggerEnemyAttack(e,ed.atd||0.24,false);}
      e.mesh.material.emissiveIntensity=0.38*(ed.hp/(ed.maxHp||e.cfg.hp))+0.16;
      if(e.mesh.scale.x<0.5) e.mesh.scale.setScalar(1);
    }
    e.linkSourceId=Number.isInteger(ed.linkSourceId)?ed.linkSourceId:null;
    if(e.type==='rammer')e.ram={phase:ed.ramPhase||'idle',dx:ed.ramDX||0,dz:ed.ramDZ||1};
  }
}

function applyHostEnemyBulletState(data){
  if(!Array.isArray(data)) data=[];
  const activeSet=new Set(data.map(b=>b.id));
  for(const b of bulletPool){
    if(b.active&&!b.isPlayer&&b.netId&&!activeSet.has(b.netId)) releaseBullet(b);
  }
  for(const bd of data){
    let b=bulletPool.find(x=>x.active&&!x.isPlayer&&x.netId===bd.id);
    if(!b){
      b=bulletPool.find(x=>!x.active&&!x.isPlayer)||bulletPool.find(x=>!x.active);
      if(!b) continue;
      b.active=true; b.isPlayer=false; b.visualOnly=true; b.netId=bd.id;
      // The rendered mesh is b.body (b.mesh is a Group); set material/geometry there
      // so a synced enemy bullet that reuses a former player slot doesn't stay cyan.
      if(b.rocket) b.rocket.visible=false;
      b.body.material=bMatE; b.body.geometry=bGeoE; b.body.visible=true;
      b.mesh.scale.setScalar(1); b.mesh.visible=true;
      burst({x:bd.x,z:bd.z},0xff6600,isMobile?2:4);
      b.pos.set(bd.x,0,bd.z);
    } else {
      const dx=bd.x-b.pos.x, dz=bd.z-b.pos.z;
      if(dx*dx+dz*dz>9) b.pos.set(bd.x,0,bd.z);
      else { b.pos.x+=dx*0.45; b.pos.z+=dz*0.45; }
    }
    b.dir.set(bd.dx,0,bd.dz).normalize();
    b.mesh.position.set(b.pos.x,0.55,b.pos.z);
    b.mesh.rotation.set(0,0,0);
    b.spd=bd.spd||BULLET_SPD;
    b.life=bd.life||1;
    b.dmg=bd.dmg||0;
    b.pierce=0;
    b.bounceLeft=0;
  }
}

function sendHostState(){
  if(!mp.connected||!mp.isHost) return;
  const _nowMs=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
  broadcastMP({
    type:'HOST_STATE',
    enemies:enemies.filter(e=>!e.dead).map(e=>{
      let vx=0,vz=0;
      if(e._lastSendT){
        const ddt=(_nowMs-e._lastSendT)/1000;
        if(ddt>0.02&&ddt<1.0){
          vx=(e.pos.x-(e._lastSendX||e.pos.x))/ddt;
          vz=(e.pos.z-(e._lastSendZ||e.pos.z))/ddt;
          const vmag=Math.hypot(vx,vz);
          // cap at ~14u/s — prevents knockback teleports from producing runaway extrapolation
          if(vmag>14){ vx=vx*14/vmag; vz=vz*14/vmag; }
        }
      }
      if(e.type==='rammer'&&e.ram.phase!=='idle'&&e.ram.phase!=='rush'){vx=0;vz=0;}
      e._lastSendX=e.pos.x; e._lastSendZ=e.pos.z; e._lastSendT=_nowMs;
      return {
        pidx:e.poolIdx,x:Math.round(e.pos.x*100)/100,z:Math.round(e.pos.z*100)/100,
        vx:Math.round(vx*100)/100,vz:Math.round(vz*100)/100,
        type:e.type,hp:e.hp,maxHp:e.maxHp,elite:e.elite||null,eliteName:e.eliteName||'',bossName:e.bossName||'',
        ramPhase:e.ram?.phase,ramDX:e.ram?.dx,ramDZ:e.ram?.dz,
        linkSourceId:e.linkSource?.poolIdx??null,
        atq:e.attackSeq||0,atd:Math.round((e.attackDur||0.24)*100)/100,
      };
    }),
    enemyBullets:bulletPool.filter(b=>b.active&&!b.isPlayer&&b.netId).map(b=>({
      id:b.netId,
      x:Math.round(b.pos.x*100)/100,
      z:Math.round(b.pos.z*100)/100,
      dx:Math.round(b.dir.x*1000)/1000,
      dz:Math.round(b.dir.z*1000)/1000,
      life:Math.round(b.life*100)/100,
      dmg:b.dmg,
      spd:b.spd,
    })),
    wave:waveNum,score,waveClear,waveSpawned,mapLayout:currentMapLayout,mapHazardTime,
    objective:miniObjectiveSnapshot(),
    event:waveEvent ? {type:waveEvent.type, sub:waveEvent.sub||null, failed:!!waveEvent.failed, complete:!!waveEvent.complete} : null,
    totem:waveTotemSnapshot(),
  });
}

function collectSummonVisualState(){
  const pack=(arr, getPos, getMesh=null)=>arr.map(item=>{
    const p=getPos(item);
    const mesh=getMesh?getMesh(item):item;
    return {
      x:Math.round(p.x*100)/100,
      z:Math.round(p.z*100)/100,
      a:mesh?.userData?.attackSeq||0,
      d:Math.round((mesh?.userData?.attackDur||0.22)*100)/100
    };
  });
  return {
    laserDrone:pack(summonDrones,m=>m.userData.pos,m=>m),
    repairDrone:pack(repairDrones,m=>m.userData.pos,m=>m),
    guardianTurret:pack(turrets,t=>t.pos,t=>t.mesh),
    mineLayer:pack(mines,m=>m.pos),
    shieldBot:pack(shieldBots,b=>b.pos,b=>b.mesh),
    bladeSentinel:pack(sentinels,s=>s.pos,s=>s.mesh),
  };
}

function sendPlayerState(){
  if(!mp.connected) return;
  const msg=JSON.stringify({
    type:'PLAYER_STATE',id:mp.myId,
    name:playerDisplayName(mp.myId),
    x:Math.round(player.pos.x*100)/100,z:Math.round(player.pos.z*100)/100,
    rot:player.mesh?Math.round(player.mesh.rotation.y*100)/100:0,
    hp:player.hp,dead:player.dead,downed:player.downed,downedT:Math.round(player.downedT*10)/10,reviveT:Math.round(player.reviveT*100)/100,reviverN:player.downed?(player.reviverCount||0):0,
    meleeWeapon:player.meleeWeapon,gun:player.gun,
    skills:{...playerSkills},
    relics:{...playerRelics},
    summons:collectSummonVisualState(),
    stats:cloneContribution(waveContribution),
    dsrc:runStats?{...runStats.damage}:null, // per-source damage breakdown for the run summary
  });
  if(mp.isHost) broadcastMP(msg); else sendToHost(msg);
}

function localAttackModifiers(){
  return {crit:permLevel('crit'),bossHunter:permLevel('bossHunter'),
    executionRounds:!!playerSkills.executionRounds,critLuck:playerSkills.critLuck||0,
    relicDmg:relicDamageMult(),hollowPoint:playerSkills.hollowPoint||0,
    explosive:playerSkills.explosive||0,heavyRounds:playerSkills.heavyRounds||0,
    bounce:playerSkills.bounce||0,longShot:playerSkills.longShot||0,
    grenadeRadius:skillPickLevel('grenadeRadius'),grenadeCore:skillPickLevel('grenadeCore'),grenadeAscension:!!playerSkills.grenadeAscension,
    burstConvergence:skillPickLevel('burstConvergence'),burstAscension:!!playerSkills.burstAscension,
    pistolRicochet:skillPickLevel('pistolRicochet'),pistolPrecision:skillPickLevel('pistolPrecision'),pistolLastWord:skillPickLevel('pistolLastWord'),pistolAscension:!!playerSkills.pistolAscension,shotgunImpact:skillPickLevel('shotgunImpact'),shotgunFocus:skillPickLevel('shotgunFocus'),shotgunAscension:!!playerSkills.shotgunAscension,
    gravityRadius:skillPickLevel('eventHorizon'),gravityCollapse:skillPickLevel('unstableCollapse'),
    gravityPersistence:skillPickLevel('persistentSingularity'),gravityDivine:!!playerSkills.gravityAscension};
}
function sendFireMP(x,z,dx,dz,dmg=25,pierce=0,extra=null){
  if(!mp.connected) return;
  const msg={type:'FIRE',id:mp.myId,x,z,dx,dz,dmg,pierce,gun:player?.gun||'pistol',supernova:!!extra?.supernova,grenadePrimary:!!extra?.grenadePrimary,grenadeQuick:!!extra?.grenadeQuick,grenadeTravel:extra?.grenadeTravel||0,gravityTravel:extra?.gravityTravel,gravityCharge:extra?.gravityCharge,delay:extra?.delay||0,pistolShot:!!extra?.pistolShot,pistolPrimary:!!extra?.pistolPrimary,pistolLast:!!extra?.pistolLast,pistolJudgment:!!extra?.pistolJudgment,triad:!!extra?.triad,burstSalvo:extra?.burstSalvo,burstIndex:extra?.burstIndex,shotgunSalvo:extra?.shotgunSalvo,rupture:!!extra?.rupture,perm:localAttackModifiers()};
  if(mp.isHost) broadcastMP(JSON.stringify(msg));
  else sendToHost(JSON.stringify(msg));
}

function sendSpecialGunMP(gun,x,z,dx,dz,dmg=20,extra=null){
  if(!mp.connected) return;
  const msg={
    type:'GUN_SPECIAL',id:mp.myId,gun:gun.id,x,z,dx,dz,dmg,
    spread:playerSkills.spread||0,heavyRounds:playerSkills.heavyRounds||0,explosive:playerSkills.explosive||0,charge:extra?.charge||0,
    perm:localAttackModifiers()
  };
  if(mp.isHost) broadcastMP(JSON.stringify(msg));
  else sendToHost(JSON.stringify(msg));
}

function damageEnemiesInConeWithSource(x,z,dx,dz,range,cone,dmg,color,stagger,ownerId,sourcePerm,expRank=null,blockWalls=false,hitSet=null){
  const dl=Math.hypot(dx,dz)||1; dx/=dl; dz/=dl;
  const minDot=Math.cos(cone*0.5);
  const targets=[];
  let hits=0;
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i]; if(!e||e.dead) continue;
    if(hitSet?.has(e.poolIdx)) continue;
    const ex=e.pos.x-x, ez=e.pos.z-z;
    const d=Math.hypot(ex,ez);
    if(d>range+e.cfg.r) continue;
    const dot=(ex/(d||1))*dx+(ez/(d||1))*dz;
    if((dot>=minDot || d<1.0+e.cfg.r)&&(!blockWalls||!lineBlockedByObstacle(x,z,e.pos.x,e.pos.z,e.cfg.r*0.35))) targets.push({e,d});
  }
  targets.sort((a,b)=>a.d-b.d);
  const expLvl=expRank===null ? (playerSkills.explosive||0) : expRank;
  for(const t of targets){
    const e=t.e; if(!e||e.dead) continue;
    const idx=enemies.indexOf(e); if(idx<0) continue;
    const adjDmg=Math.max(1,Math.round(dmg*pierceFalloffMult(hits)));
    damageEnemyWithSource(idx,adjDmg,color,stagger,ownerId,sourcePerm,'bullet');
    if(hitSet) hitSet.add(e.poolIdx);
    hits++;
    if(expLvl>0&&Math.random()<0.18){
      damageEnemiesInCircle(e.pos.x,e.pos.z,EXPLOSIVE_R[expLvl]*0.45,Math.round(adjDmg*0.28),0xff7722,0.08);
    }
  }
  return hits;
}

function applySpecialGunFire(gun,x,z,dx,dz,dmg,ownerId=mp.myId,visualOnly=false,relay=true,sourcePerm=null,mods=null){
  const dl=Math.hypot(dx,dz)||1; dx/=dl; dz/=dl;
  // Local fire used to pass sourcePerm=null, and playerDamageAmount only applies Execution Rounds
  // from an explicit sourcePerm — so your own beams never executed while a teammate's relayed
  // identical shot (which carries msg.perm) did. Snapshot the local perms the same way sendFireMP does.
  if(!sourcePerm && ownerId===mp.myId){
    sourcePerm=localAttackModifiers();
  }
  const heavy=HEAVY_R[mods?.heavyRounds ?? (playerSkills.heavyRounds||0)]||0;
  const spreadLvl=mods?.spread ?? (playerSkills.spread||0);
  const expRank=mods?.explosive ?? (playerSkills.explosive||0);
  const bounceLvl=sourcePerm?.bounce ?? (playerSkills.bounce||0);
  const bounceCount=BOUNCE_MAX[bounceLvl]||0;
  // Long Shot scales beam/cone/charge-weapon range alongside projectiles.
  // Owner-perm path lets a teammate's shot reflect their longShot level when
  // their fire is relayed via FIRE_BEAM messages; falls back to local skill.
  const longShotLvl = sourcePerm?.longShot ?? (playerSkills.longShot||0);
  const rangeMul = BULLET_RANGE_MULT[longShotLvl] || 1;
  if(gun.kind==='flame'){
    const range=((gun.range||5)+heavy*2.1)*rangeMul;
    const cone=(gun.cone||0.9)+spreadLvl*0.08+heavy*0.18;
    const segments=reflectedRaySegments(x,z,dx,dz,range,bounceCount,0.12);
    const hitSet=new Set();
    for(const seg of segments){
      const rawLen=seg.len*0.98;
      const startOff=Math.min(0.42,Math.max(0.05,rawLen*0.20));
      const len=Math.max(0.12,rawLen-startOff);
      const startWidth=0.36+heavy*0.22;
      const endWidth=Math.min(8.8,Math.max(2.8,len*Math.tan(cone*0.5)*2.05));
      spawnFlameCone(seg.x+seg.dx*startOff,seg.z+seg.dz*startOff,seg.dx,seg.dz,len,startWidth,endWidth,gun.color,0.22,0.42);
      for(let i=0;i<(isMobile?1:3);i++){
        const a=(Math.random()-0.5)*cone;
        const ca=Math.cos(a), sa=Math.sin(a);
        const sparkDist=Math.min(len,1.0+Math.random()*seg.len*0.8);
        const px=seg.x+(seg.dx*ca-seg.dz*sa)*sparkDist;
        const pz=seg.z+(seg.dx*sa+seg.dz*ca)*sparkDist;
        burst({x:px,z:pz},i%2?0xffdd55:gun.color,isMobile?1:2);
      }
      if(!visualOnly){
        const before=new Set(hitSet);
        damageEnemiesInConeWithSource(seg.x,seg.z,seg.dx,seg.dz,seg.len,cone,dmg,gun.color,0.05,ownerId,sourcePerm,expRank,true,hitSet);
        damageMiniObjectiveInCone(seg.x,seg.z,seg.dx,seg.dz,seg.len,cone,dmg,gun.color);
        if(ownerId===mp.myId){
          for(const e of enemies){
            if(e.dead||before.has(e.poolIdx)||!hitSet.has(e.poolIdx)) continue;
            tagElement(e,'fire',dmg);
          }
        }
      }
    }
    flashLight({x:x+dx*1.2,z:z+dz*1.2},gun.color,3.8,5.5,0.10);
  } else if(gun.kind==='cryo'){
    const range=((gun.range||5.8)+heavy*1.8)*rangeMul;
    const cone=(gun.cone||0.85)+spreadLvl*0.06+heavy*0.14;
    const segments=reflectedRaySegments(x,z,dx,dz,range,bounceCount,0.12);
    const hitSet=new Set();
    for(const seg of segments){
      const rawLen=seg.len*0.98;
      const startOff=Math.min(0.40,Math.max(0.05,rawLen*0.18));
      const len=Math.max(0.12,rawLen-startOff);
      const startWidth=0.32+heavy*0.18;
      const endWidth=Math.min(7.2,Math.max(2.4,len*Math.tan(cone*0.5)*1.85));
      spawnFlameCone(seg.x+seg.dx*startOff,seg.z+seg.dz*startOff,seg.dx,seg.dz,len,startWidth,endWidth,gun.color,0.22,0.34);
      if(!visualOnly){
        const before=new Set(hitSet);
        damageEnemiesInConeWithSource(seg.x,seg.z,seg.dx,seg.dz,seg.len,cone,dmg,gun.color,0.12,ownerId,sourcePerm,expRank,true,hitSet);
        damageMiniObjectiveInCone(seg.x,seg.z,seg.dx,seg.dz,seg.len,cone,dmg,gun.color);
        for(const e of enemies){
          if(e.dead||before.has(e.poolIdx)||!hitSet.has(e.poolIdx)) continue;
          slowMap.set(e.poolIdx,Math.max(slowMap.get(e.poolIdx)||0,0.48));
          burst(e.pos,gun.color,isMobile?1:3);
          if(ownerId===mp.myId) tagElement(e,'ice',dmg);
        }
      }
    }
    flashLight({x:x+dx*1.2,z:z+dz*1.2},gun.color,3.4,5.2,0.10);
  } else if(gun.kind==='laser'){
    const width=(gun.width||0.32)+heavy*0.55;
    const len=((gun.range||14)+heavy*4)*rangeMul;
    const fireBeam=(bdx,bdz,bdmg,op=0.56)=>{
      const hitSet=new Set();
      const segments=reflectedRaySegments(x,z,bdx,bdz,len,bounceCount,width*0.5);
      for(const seg of segments){
        const startOff=Math.min(0.65,Math.max(0.08,seg.len*0.35));
        spawnSkillBeam(seg.x+seg.dx*startOff,seg.z+seg.dz*startOff,seg.dx,seg.dz,Math.max(0.12,seg.len-startOff),width,gun.color,0.22,op);
        if(visualOnly) continue;
        const tx=seg.x+seg.dx*seg.len, tz=seg.z+seg.dz*seg.len;
        const targets=[];
        for(let i=enemies.length-1;i>=0;i--){
          const e=enemies[i]; if(!e||e.dead) continue;
          if(hitSet.has(e.poolIdx)) continue;
          if(segmentPointDistance(e.pos.x,e.pos.z,seg.x,seg.z,tx,tz)<=width*0.5+e.cfg.r&&!lineBlockedByObstacle(seg.x,seg.z,e.pos.x,e.pos.z,width*0.5)){
            const d=(e.pos.x-seg.x)*seg.dx+(e.pos.z-seg.z)*seg.dz;
            targets.push({e,d});
          }
        }
        targets.sort((a,b)=>a.d-b.d);
        targets.forEach((t,hitIdx)=>{
          const idx=enemies.indexOf(t.e); if(idx<0||t.e.dead) return;
          const applied=Math.max(1,Math.round(bdmg*pierceFalloffMult(hitIdx)));
          damageEnemyWithSource(idx,applied,gun.color,0.04,ownerId,sourcePerm,'bullet');
          hitSet.add(t.e.poolIdx);
          if(expRank>0&&Math.random()<0.18){ // same Explosive Payload proc the cone weapons get
            damageEnemiesInCircle(t.e.pos.x,t.e.pos.z,EXPLOSIVE_R[expRank]*0.45,Math.round(applied*0.28),0xff7722,0.08);
          }
        });
        damageMiniObjectiveAlongSegment(seg.x,seg.z,seg.dx,seg.dz,seg.len,width*0.5,bdmg,gun.color);
      }
    };
    fireBeam(dx,dz,dmg);
    for(let si=0;si<spreadLvl;si++){
      const off=(si%2===0?1:-1)*(0.12+Math.floor(si/2)*0.10);
      const ca=Math.cos(off), sa=Math.sin(off);
      fireBeam(dx*ca-dz*sa,dx*sa+dz*ca,Math.round(dmg*0.6),0.30);
    }
    flashLight({x:x+dx*1.5,z:z+dz*1.5},gun.color,4.2,6,0.09);
  } else if(gun.kind==='rail'){
    const chargeScale=Math.max(0,Math.min(1,mods?.charge||0));
    const width=(gun.width||0.55)*(0.48+chargeScale*0.78)+heavy*0.42;
    const len=((gun.range||22)+heavy*3)*rangeMul;
    const fireRail=(bdx,bdz,bdmg,op=0.82)=>{
      const segments=reflectedRaySegments(x,z,bdx,bdz,len,bounceCount,width*0.45);
      const hitSet=new Set();
      for(const seg of segments){
        const startOff=Math.min(0.55,Math.max(0.05,seg.len*0.16));
        spawnSkillBeam(seg.x+seg.dx*startOff,seg.z+seg.dz*startOff,seg.dx,seg.dz,Math.max(0.14,seg.len-startOff),width,gun.color,0.18,op);
        if(visualOnly) continue;
        const tx=seg.x+seg.dx*seg.len, tz=seg.z+seg.dz*seg.len;
        const targets=[];
        for(let i=enemies.length-1;i>=0;i--){
          const e=enemies[i]; if(e.dead||hitSet.has(e.poolIdx)) continue;
          if(lineBlockedByObstacle(seg.x,seg.z,e.pos.x,e.pos.z,e.cfg.r*0.25)) continue;
          const dist=segmentPointDistance(e.pos.x,e.pos.z,seg.x,seg.z,tx,tz);
          if(dist<width+e.cfg.r) targets.push({idx:i,e,along:(e.pos.x-seg.x)*seg.dx+(e.pos.z-seg.z)*seg.dz});
        }
        targets.sort((a,b)=>a.along-b.along);
        targets.forEach((t,hitIdx)=>{
          if(t.e.dead) return;
          hitSet.add(t.e.poolIdx);
          const applied=Math.max(1,Math.round(bdmg*pierceFalloffMult(hitIdx)));
          damageEnemyWithSource(t.idx,applied,gun.color,0.22,ownerId,sourcePerm,'bullet');
          burst(t.e.pos,gun.color,isMobile?3:8);
          if(expRank>0&&Math.random()<0.18){ // same Explosive Payload proc the cone weapons get
            damageEnemiesInCircle(t.e.pos.x,t.e.pos.z,EXPLOSIVE_R[expRank]*0.45,Math.round(applied*0.28),0xff7722,0.08);
          }
        });
        damageMiniObjectiveAlongSegment(seg.x,seg.z,seg.dx,seg.dz,seg.len,width,bdmg,gun.color);
      }
    };
    fireRail(dx,dz,dmg);
    // Spread Pattern side rails — same angles as the laser's side beams, 60% damage.
    for(let si=0;si<spreadLvl;si++){
      const off=(si%2===0?1:-1)*(0.12+Math.floor(si/2)*0.10);
      const ca=Math.cos(off), sa=Math.sin(off);
      fireRail(dx*ca-dz*sa,dx*sa+dz*ca,Math.round(dmg*0.6),0.34);
    }
    flashLight({x:x+dx*1.5,z:z+dz*1.5},gun.color,6.0,7.0,0.16);
  }
  if(relay&&mp.connected&&!mp.soloMode){
    sendSpecialGunMP(gun,Math.round(x*100)/100,Math.round(z*100)/100,Math.round(dx*1000)/1000,Math.round(dz*1000)/1000,dmg,mods);
  }
}

// Every-N-shots epics (Rail Burst / Overclock Barrage / Bullet Hell Engine), shared by the normal
// fire loop AND the railgun's separate charge-release path — the railgun previously never advanced
// these counters, so all three epics were dead while it was equipped.
function tickShotCounterEpics(fx,fz,pdmg,pierceLvl){
  const railRank=epicRank('railBurst');
  if(railRank){
    railBurstShots++;
    const railNeed=[0,7,5][railRank]||7;
    if(railBurstShots>=railNeed){
      railBurstShots=0;
      const len=[0,13,16][railRank], width=[0,0.62,0.86][railRank];
      const rdmg=Math.round(pdmg*[0,2.1,3.2][railRank]);
      spawnZapLine(player.pos.x,player.pos.z,player.pos.x+fx*len,player.pos.z+fz*len);
      spawnSkillBeam(player.pos.x,player.pos.z,fx,fz,len,width,0x66eeff,0.26,0.62);
      damageEnemiesInLine(player.pos.x,player.pos.z,fx,fz,len,width,rdmg,0x66eeff,0.18,'bullet');
      flashLight(player.pos,0x66eeff,5.5,7,0.14);
      sRailBurst();
    }
  }
  const barrageRank=epicRank('overclockBarrage');
  if(barrageRank){
    overclockBarrageShots++;
    const barrageNeed=[0,8,6][barrageRank]||8;
    if(overclockBarrageShots>=barrageNeed){
      overclockBarrageShots=0;
      const shots=barrageRank===2?5:3;
      for(let bi=0;bi<shots;bi++){
        const off=(bi-(shots-1)/2)*0.18;
        const ca=Math.cos(off), sa=Math.sin(off);
        const sdx=fx*ca-fz*sa, sdz=fx*sa+fz*ca;
        const bdmg=Math.round(pdmg*(barrageRank===2?0.72:0.62));
        fireBullet({x:player.pos.x+sdx*0.45,z:player.pos.z+sdz*0.45},_scratchDir.set(sdx,0,sdz),true,bdmg,pierceLvl);
        sendFireMP(
          Math.round((player.pos.x+sdx*0.45)*100)/100,
          Math.round((player.pos.z+sdz*0.45)*100)/100,
          Math.round(sdx*1000)/1000,
          Math.round(sdz*1000)/1000,
          bdmg,
          pierceLvl
        );
      }
      spawnShockwave(player.pos.x,player.pos.z,1.15,0xff8844,0.16,0.5);
      spawnSkillRingAura(player.pos.x,player.pos.z,1.35,0xff8844,0.28,0.38);
      sOverclock();
    }
  }
  if(playerSkills.bulletHellEngine){
    bulletHellShots++;
    if(bulletHellShots>=5){
      bulletHellShots=0;
      spawnBulletHellStorm(pdmg,pierceLvl);
    }
  }
}

function spawnBulletHellStorm(baseDmg, pierceLvl){
  const stormN=isMobile?8:12;
  for(let bi=0;bi<stormN;bi++){
    const a=(bi/stormN)*Math.PI*2;
    const sdx=Math.sin(a), sdz=Math.cos(a);
    const bdmg=Math.round(baseDmg*0.62);
    fireBullet({x:player.pos.x+sdx*0.7,z:player.pos.z+sdz*0.7},_scratchDir.set(sdx,0,sdz),true,bdmg,pierceLvl);
    sendFireMP(
      Math.round((player.pos.x+sdx*0.7)*100)/100,
      Math.round((player.pos.z+sdz*0.7)*100)/100,
      Math.round(sdx*1000)/1000,
      Math.round(sdz*1000)/1000,
      bdmg,
      pierceLvl
    );
  }
  spawnShockwave(player.pos.x,player.pos.z,1.45,0x00ffff,0.18,0.62);
  spawnSkillRingAura(player.pos.x,player.pos.z,2.0,0x00ffff,0.42,0.48);
  sRailBurst();
}

function meleeAimDir(){
  if(realIsMobile&&joy.R.act&&Math.hypot(joy.R.dx,joy.R.dy)>0.2){
    const l=Math.hypot(joy.R.dx,joy.R.dy)||1;
    return {x:joy.R.dx/l,z:joy.R.dy/l};
  }
  if(!realIsMobile&&mouse.hasWorld){
    const dx=mouse.world.x-player.pos.x,dz=mouse.world.z-player.pos.z;
    const l=Math.hypot(dx,dz);
    if(l>0.16) return {x:dx/l,z:dz/l};
  }
  if(player.mesh) return {x:Math.sin(player.mesh.rotation.y),z:Math.cos(player.mesh.rotation.y)};
  return {x:0,z:-1};
}

function gravityAimTravel(gun,x,z){
  const cap=gun.range*(BULLET_RANGE_MULT[playerSkills.longShot||0]||1);
  return !realIsMobile&&mouse.hasWorld?Math.min(cap,Math.hypot(mouse.world.x-x,mouse.world.z-z)):cap;
}
function grenadeAimTravel(gun, originX, originZ){
  const cap=Math.max(1.4,gun.range||((gun.bulletSpeed||10.5)*0.84));
  // Aim to the cursor distance on any device with a mouse. Gate on realIsMobile,
  // not isMobile — isMobile is also true on low/potato graphics tiers, which
  // would otherwise force every grenade to max range on a low-spec desktop.
  if(!realIsMobile&&mouse.hasWorld){
    return Math.max(1.4,Math.min(cap,Math.hypot(mouse.world.x-originX,mouse.world.z-originZ)));
  }
  return cap;
}

function spawnMeleeSlashVfx(weapon,x,z,dx,dz,opts={}){
  const cfg=meleeStatsFor(weapon,opts);
  // Swing sound — plays once per slash spawn, so it covers both the local
  // player's swing and remote players' relayed MELEE_VFX broadcasts.
  sMeleeSwing(cfg.id);
  const angle=Math.atan2(dx,dz);
  // Ring is centred on the PLAYER (x, z) so its inner→outer radius mirrors the
  // real hit zone (0 → cfg.range from the player). Previously the ring was
  // pushed 48% along the attack direction, which made the indicator extend
  // well past the actual damage area and miss the close-range enemies that
  // were still being hit. Shockwave/flash/burst stay at the mid-arc point so
  // the explosion FX still feels centred on the impact zone.
  const inner=cfg.id==='dagger'?cfg.range*0.22:cfg.range*0.30;
  const outer=cfg.range;
  const arc=cfg.arc;
  const geo=new THREE.RingGeometry(inner,outer,isMobile?22:38,1,-arc*0.5,arc);
  const mat=new THREE.MeshBasicMaterial({
    color:cfg.id==='dagger'?0xffdd66:0x9ef7ff,
    transparent:true,opacity:0.78,
    side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending
  });
  const mesh=new THREE.Mesh(geo,mat);
  mesh.rotation.x=-Math.PI/2;
  // After the X-rotation lays the ring flat on the XZ plane, the arc-centre
  // direction (originally +X in the ring's local frame) ends up at world
  // (cos θz, 0, -sin θz). To make it match the aim vector (dx, dz) we need
  // θz = atan2(dx, dz) - π/2 (= angle - π/2). The previous `-angle + π/2`
  // pointed the indicator 180° opposite the aim — the bug was masked while the
  // ring was offset 48% forward, but became visible once the ring was re-centred
  // on the player.
  // The slash update applies `rotation.z = baseRot + spin*t`, so by t=dur the
  // arc has swept `spin*dur` radians. Without compensation the sweep starts
  // ON the aim and ends past it, putting the visual midpoint a half-sweep off
  // to the side. Subtract `spin*dur*0.5` from the starting rotation so the
  // midpoint of the swing lands on the aim direction and matches the damage
  // cone (which is tested directly against the raw aim vector).
  const dur=cfg.id==='dagger'?0.18:0.24;
  const spin=cfg.id==='dagger'?2.5:5.5;
  const aimRot=angle-Math.PI/2;
  mesh.rotation.z=aimRot - spin*dur*0.5;
  mesh.position.set(x,0.16,z);
  mesh.frustumCulled=false;
  // River ribbons use renderOrder 30 + rOrder*10 + round(y*1000), which peaks
  // around ~86 on multi-band rivers (map 2 has order:1 foam streaks at y=0.046).
  // 50 was below that ceiling so the slash still vanished inside river hazards.
  // 100 keeps every melee VFX above all current river segments.
  mesh.renderOrder=100;
  scene.add(mesh);
  slashVfx.push({mesh,mat,t:0,dur,baseRot:mesh.rotation.z,spin,opacity:mat.opacity});
  // Shockwave / impact FX stay slightly forward of the player so they punch
  // out from the mid-arc, not from the feet.
  const cx=x+dx*cfg.range*0.48;
  const cz=z+dz*cfg.range*0.48;
  spawnShockwave(cx,cz,cfg.range*(cfg.id==='dagger'?0.36:0.52),cfg.color,0.14,0.42);
  flashLight({x:cx,z:cz},cfg.color,2.6,4.5,0.11);
  burst({x:cx,z:cz},cfg.color,isMobile?3:7);
}

function segmentPointDistance(px,pz,ax,az,bx,bz){
  const abx=bx-ax, abz=bz-az;
  const len2=abx*abx+abz*abz;
  if(len2<=0.0001) return Math.hypot(px-ax,pz-az);
  const t=Math.max(0,Math.min(1,((px-ax)*abx+(pz-az)*abz)/len2));
  return Math.hypot(px-(ax+abx*t),pz-(az+abz*t));
}

function rayAabbT(x,z,dx,dz,o,pad=0.25){
  let tMin=0, tMax=Infinity;
  const minX=o.x-o.hw-pad, maxX=o.x+o.hw+pad;
  const minZ=o.z-o.hd-pad, maxZ=o.z+o.hd+pad;
  if(Math.abs(dx)<0.0001){
    if(x<minX||x>maxX) return Infinity;
  } else {
    const tx1=(minX-x)/dx, tx2=(maxX-x)/dx;
    tMin=Math.max(tMin,Math.min(tx1,tx2));
    tMax=Math.min(tMax,Math.max(tx1,tx2));
  }
  if(Math.abs(dz)<0.0001){
    if(z<minZ||z>maxZ) return Infinity;
  } else {
    const tz1=(minZ-z)/dz, tz2=(maxZ-z)/dz;
    tMin=Math.max(tMin,Math.min(tz1,tz2));
    tMax=Math.min(tMax,Math.max(tz1,tz2));
  }
  return tMax>=tMin&&tMax>=0 ? Math.max(0,tMin) : Infinity;
}

function findHookTarget(x,z,dx,dz,range){
  const width=0.52;
  let bestT=range, best={x:x+dx*range,z:z+dz*range,enemyIndex:null,hit:false,kind:'air'};
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i]; if(!e||e.dead) continue;
    const ex=e.pos.x-x, ez=e.pos.z-z;
    const t=ex*dx+ez*dz;
    if(t<0||t>bestT) continue;
    const perp=Math.hypot(ex-dx*t,ez-dz*t);
    if(perp<=width+e.cfg.r){
      bestT=t;
      best={x:e.pos.x,z:e.pos.z,enemyIndex:i,hit:true,kind:'enemy'};
    }
  }
  for(const o of obstacleBoxes){
    const t=rayAabbT(x,z,dx,dz,o,0.18);
    if(t>0.18&&t<bestT){
      bestT=t;
      best={x:x+dx*t,z:z+dz*t,enemyIndex:null,hit:true,kind:'wall'};
    }
  }
  const tx=dx>0 ? (ARENA_W-0.8-x)/dx : (dx<0 ? (-ARENA_W+0.8-x)/dx : Infinity);
  const tz=dz>0 ? (ARENA_H-0.8-z)/dz : (dz<0 ? (-ARENA_H+0.8-z)/dz : Infinity);
  const wallT=Math.min(tx>0?tx:Infinity,tz>0?tz:Infinity);
  if(wallT<bestT){
    bestT=wallT;
    best={x:x+dx*wallT,z:z+dz*wallT,enemyIndex:null,hit:true,kind:'wall'};
  }
  return best;
}

function isHookHeavyEnemy(e){
  return !!e && (e.type==='tank'||e.type==='boss');
}

function startMeleeDashTo(tx,tz,speed=24,maxDur=0.5){
  if(!Number.isFinite(tx)||!Number.isFinite(tz)) return;
  const dx=tx-player.pos.x, dz=tz-player.pos.z;
  const dist=Math.hypot(dx,dz);
  if(dist<0.18) return;
  player.dashVX=dx/dist;
  player.dashVZ=dz/dist;
  player.dashT=Math.min(maxDur,dist/speed);
  player.dashTrailT=0;
  player.meleeDashSpeed=speed;
  player.meleeDashSpecial=true;
  player.dashKinetic=0;
}

function disposeActiveHookRope(){
  if(player.hookRope){
    scene.remove(player.hookRope);
    player.hookRope.geometry?.dispose?.();
    player.hookRopeMat?.dispose?.();
  }
  player.hookRope=null;
  player.hookRopeMat=null;
}
function startActiveHookRope(color=0x5fffd6){
  disposeActiveHookRope();
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.88,depthWrite:false,blending:THREE.AdditiveBlending});
  const rope=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,1,isMobile?5:8,1,true),mat);
  rope.frustumCulled=false;
  rope.renderOrder=104;
  scene.add(rope);
  player.hookRope=rope;
  player.hookRopeMat=mat;
  updateActiveHookRope();
}
function updateActiveHookRope(){
  if(!player.hookRope) return;
  const sx=player.pos.x, sz=player.pos.z;
  const tx=player.hookSwingX, tz=player.hookSwingZ;
  _hookDir.set(tx-sx,0,tz-sz);
  const len=_hookDir.length();
  if(len<0.05){ player.hookRope.visible=false; return; }
  player.hookRope.visible=true;
  _hookDir.normalize();
  player.hookRope.position.set((sx+tx)*0.5,0.66,(sz+tz)*0.5);
  player.hookRope.quaternion.setFromUnitVectors(_hookUp,_hookDir);
  player.hookRope.scale.set(1,len,1);
  if(player.hookRopeMat){
    const pulse=0.76+0.12*Math.sin(Date.now()*0.028);
    player.hookRopeMat.opacity=pulse;
  }
}

// Hook tether: heavy targets yank the player in, while wall hooks become a
// fixed-radius A/D orbit around the anchor.
function startHookSwing(tx,tz,maxRange,mode='heavy'){
  if(!Number.isFinite(tx)||!Number.isFinite(tz)) return;
  const dist=Math.hypot(tx-player.pos.x,tz-player.pos.z);
  if(dist<0.18) return;
  player.hookSwingX=tx;
  player.hookSwingZ=tz;
  // Leash = current rope length, capped to the weapon's reach.
  player.hookSwingR=Math.min(dist,maxRange);
  player.hookSwingMode=mode;
  player.hookVelX=0; player.hookVelZ=0;
  player.hookWallInputSign=mode==='wall'&&tz<player.pos.z?-1:1;
  player.hookOrbitDir=0;
  player.hookWallBuffer=mode==='wall'?0.24:0;
  // 0.75 s of pull-feel — long enough for the ramp to peak (~0.52 s) and
  // hold the peak briefly so the player feels the fling, short enough that
  // the swing doesn't outstay its welcome.
  player.hookSwingDur=mode==='wall'?1.0:0.58;
  player.hookSwingT=mode==='wall'?1:player.hookSwingDur;
  // Legacy field kept so any unrelated readers don't fail — the actual
  // per-frame pull speed is now computed from the elapsed swing time.
  player.hookSwingPull=22;
  // Clear any in-progress dash so it doesn't fight the swing.
  player.dashT=0;
  player.meleeDashSpecial=false;
  player.meleeDashSpeed=0;
  if(mode==='wall') startActiveHookRope(MELEE_WEAPONS.hook.color);
}

function startHookedEnemyPull(e, ownerId, dmgColor){
  if(!e||e.dead) return;
  hookedEnemies.push({enemy:e,ownerId,t:0,dur:0.42,color:dmgColor});
}

function finishHookSwingWithInertia(){
  const v=Math.hypot(player.hookVelX||0,player.hookVelZ||0);
  if(v>1.2){
    const cap=18;
    const k=Math.min(1,cap/v);
    player.hookInertiaVX=player.hookVelX*k*0.72;
    player.hookInertiaVZ=player.hookVelZ*k*0.72;
    player.hookInertiaT=0.34;
  }
  player.hookSwingT=0;
  player.hookSwingMode='';
  player.hookOrbitDir=0;
  player.hookWallBuffer=0;
  player.hookVelX=0; player.hookVelZ=0;
  disposeActiveHookRope();
}

function updateHookedEnemies(dt){
  for(let i=hookedEnemies.length-1;i>=0;i--){
    const h=hookedEnemies[i];
    const e=h.enemy;
    if(!e||e.dead){hookedEnemies.splice(i,1);continue;}
    h.t+=dt;
    const target=ownerWorldPos(h.ownerId);
    const dx=target.x-e.pos.x, dz=target.z-e.pos.z;
    const d=Math.hypot(dx,dz)||1;
    const pullSpd=22+Math.min(18,h.t*45);
    const step=Math.min(d,pullSpd*dt);
    e.pos.x+=(dx/d)*step;
    e.pos.z+=(dz/d)*step;
    clamp(e.pos,e.cfg.r); resolveObst(e.pos,e.cfg.r);
    addEnemyStagger(e,0.08);
    if(!isMobile&&Math.random()<0.22) burst(e.pos,h.color||0x5fffd6,1);
    if(d<1.05+e.cfg.r||h.t>=h.dur) hookedEnemies.splice(i,1);
  }
}

function spawnCircleMeleeVfx(cfg,x,z){
  sMeleeSwing('axe');
  // Damage area — faint persistent ring that shows the FULL reach. Wider band
  // (45% → 100% of range, instead of the previous 18% → 100%) so the swept
  // zone reads as both long (outer reach) AND wide (band thickness).
  const ringInner=Math.max(0.2,cfg.range*0.45);
  const ringOuter=cfg.range;
  const baseGeo=new THREE.RingGeometry(ringInner,ringOuter,isMobile?30:52,1);
  const baseMat=new THREE.MeshBasicMaterial({color:cfg.color,transparent:true,opacity:0.34,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const baseMesh=new THREE.Mesh(baseGeo,baseMat);
  baseMesh.rotation.x=-Math.PI/2;
  baseMesh.position.set(x,0.17,z);
  baseMesh.frustumCulled=false;
  baseMesh.renderOrder=100;
  scene.add(baseMesh);
  slashVfx.push({mesh:baseMesh,mat:baseMat,t:0,dur:0.38,baseRot:0,spin:1.6,opacity:baseMat.opacity});

  // Sweeping axe-blade arc — bright slice that whips around the player twice
  // over the lifetime, giving the "axe spinning around me" feel rather than a
  // static ring. Same radial band as the base so the bright slice always lies
  // exactly along the damage zone.
  const sweepArc=Math.PI*0.55; // ~99° bright slice
  const sweepGeo=new THREE.RingGeometry(ringInner,ringOuter,isMobile?18:30,1,-sweepArc*0.5,sweepArc);
  const sweepMat=new THREE.MeshBasicMaterial({color:cfg.color,transparent:true,opacity:0.95,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const sweepMesh=new THREE.Mesh(sweepGeo,sweepMat);
  sweepMesh.rotation.x=-Math.PI/2;
  sweepMesh.position.set(x,0.19,z);
  sweepMesh.frustumCulled=false;
  sweepMesh.renderOrder=101;
  scene.add(sweepMesh);
  // ~2 full rotations across the 0.34s slash duration → blade-whip feel.
  slashVfx.push({mesh:sweepMesh,mat:sweepMat,t:0,dur:0.34,baseRot:0,spin:Math.PI*5.6,opacity:0.95});

  // A second, narrower counter-slice on the opposite side so it really looks
  // like a double-headed axe whirling rather than a single arc.
  const tipGeo=new THREE.RingGeometry(ringInner,ringOuter,isMobile?14:22,1,-sweepArc*0.25,sweepArc*0.5);
  const tipMat=new THREE.MeshBasicMaterial({color:0xfff1d8,transparent:true,opacity:0.85,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const tipMesh=new THREE.Mesh(tipGeo,tipMat);
  tipMesh.rotation.x=-Math.PI/2;
  tipMesh.position.set(x,0.20,z);
  tipMesh.rotation.z=Math.PI; // opposite side at spawn
  tipMesh.frustumCulled=false;
  tipMesh.renderOrder=102;
  scene.add(tipMesh);
  slashVfx.push({mesh:tipMesh,mat:tipMat,t:0,dur:0.34,baseRot:Math.PI,spin:Math.PI*5.6,opacity:0.85});

  spawnShockwave(x,z,cfg.range*0.62,cfg.color,0.18,0.58);
  flashLight({x,z},cfg.color,3.0,5.2,0.12);
  burst({x,z},cfg.color,isMobile?6:14);
}

// Build a thick taut rope mesh from a chain of curve points. Used by the
// impact phase once the projectile has landed.
function _buildHookRopeMesh(points, color){
  const curve=new THREE.CatmullRomCurve3(points);
  const geo=new THREE.TubeGeometry(curve,isMobile?12:24,0.075,6,false);
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.88,depthWrite:false,blending:THREE.AdditiveBlending});
  const rope=new THREE.Mesh(geo,mat); rope.frustumCulled=false;
  return {rope,mat};
}

// Phase 1: hook *flies* from player to target. Spawns a small projectile mesh
// + a thin rope that grows alongside it. When the projectile lands we call
// `onLand` (impact VFX + swing + damage) on the same frame the rope goes taut.
function spawnHookFlight(cfg, fromX, fromZ, tx, tz, onLand){
  sHookShoot();
  // Travel time scales gently with distance so short hooks still feel snappy.
  const dist=Math.hypot(tx-fromX,tz-fromZ);
  const dur=Math.min(0.45, 0.10 + dist*0.030);

  // Projectile: small bright hook-torus oriented toward the target.
  const proj=new THREE.Mesh(
    new THREE.TorusGeometry(0.18,0.05,6,16,Math.PI*1.25),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.95,depthWrite:false,blending:THREE.AdditiveBlending})
  );
  proj.position.set(fromX,0.62,fromZ);
  proj.rotation.set(0,Math.atan2(tx-fromX,tz-fromZ),0);
  proj.frustumCulled=false;
  scene.add(proj);

  // Rope during flight: thin cylinder we stretch each frame between player
  // and the projectile. Default cylinder is along local +Y; we set its
  // quaternion so +Y points along the rope direction, then scale Y to length.
  const ropeMat=new THREE.MeshBasicMaterial({color:cfg.color,transparent:true,opacity:0.78,depthWrite:false,blending:THREE.AdditiveBlending});
  const ropeGeo=new THREE.CylinderGeometry(0.05,0.05,1,isMobile?5:8,1,true);
  const rope=new THREE.Mesh(ropeGeo,ropeMat); rope.frustumCulled=false;
  scene.add(rope);

  flyingHooks.push({proj,rope,ropeMat,color:cfg.color,fromX,fromZ,tx,tz,t:0,dur,onLand,landed:false});
}

// Phase 2: hook is anchored. The thick taut rope + impact effects play, and
// the swing starts on the firing client.
function spawnHookImpactVfx(cfg, fromX, fromZ, tx, tz, dur=0.42){
  // Sagged elastic rope from player to anchor (same look as before).
  const mx=(fromX+tx)*0.5, mz=(fromZ+tz)*0.5;
  const dist=Math.hypot(tx-fromX,tz-fromZ);
  const perpX=-(tz-fromZ)/(dist||1), perpZ=(tx-fromX)/(dist||1);
  const sag=Math.min(0.55,0.18+dist*0.04);
  const wobble=(Math.random()*2-1)*0.18;
  const points=[
    new THREE.Vector3(fromX,0.62,fromZ),
    new THREE.Vector3(mx+perpX*wobble,0.62-sag*0.35,mz+perpZ*wobble),
    new THREE.Vector3(mx,0.62-sag,mz),
    new THREE.Vector3(mx-perpX*wobble,0.62-sag*0.35,mz-perpZ*wobble),
    new THREE.Vector3(tx,0.62,tz),
  ];
  const {rope,mat}=_buildHookRopeMesh(points,cfg.color);
  scene.add(rope);
  slashVfx.push({mesh:rope,mat,t:0,dur,baseRot:0,spin:0,opacity:mat.opacity,elastic:true});

  // Beefier hook tip ring at the anchor (the old impact look).
  const tipMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.95,depthWrite:false,blending:THREE.AdditiveBlending});
  const tip=new THREE.Mesh(new THREE.TorusGeometry(0.26,0.06,6,18,Math.PI*1.25),tipMat);
  tip.position.set(tx,0.62,tz);
  tip.rotation.set(0,Math.atan2(tx-fromX,tz-fromZ),0);
  tip.frustumCulled=false;
  scene.add(tip);
  slashVfx.push({mesh:tip,mat:tipMat,t:0,dur:0.32,baseRot:tip.rotation.z,spin:7,opacity:tipMat.opacity});

  spawnShockwave(tx,tz,1.1,cfg.color,0.14,0.42);
  burst({x:tx,z:tz},cfg.color,isMobile?5:11);
}

// Frame update for in-flight projectiles. Moves the hook tip from origin to
// anchor along a quarter-arc (ease-out), stretches the rope between them, and
// triggers `onLand` once the trip is finished.
function updateFlyingHooks(dt){
  for(let i=flyingHooks.length-1;i>=0;i--){
    const f=flyingHooks[i];
    f.t+=dt;
    const p=Math.min(1,f.t/f.dur);
    // Ease-out so the projectile decelerates as it nears the anchor — gives
    // it a satisfying "lock onto target" feel rather than a constant slide.
    const eased=1-Math.pow(1-p,2.2);
    const cx=f.fromX + (f.tx-f.fromX)*eased;
    const cz=f.fromZ + (f.tz-f.fromZ)*eased;
    f.proj.position.set(cx,0.62,cz);

    // Stretch the rope between player and projectile.
    _hookDir.set(cx-f.fromX,0,cz-f.fromZ);
    const len=_hookDir.length();
    if(len>0.01){
      _hookDir.normalize();
      f.rope.position.set((f.fromX+cx)*0.5,0.62,(f.fromZ+cz)*0.5);
      f.rope.quaternion.setFromUnitVectors(_hookUp,_hookDir);
      f.rope.scale.set(1,len,1);
    }
    // Subtle thickness pulse during flight so it doesn't feel stiff.
    const pulse=1+Math.sin(p*Math.PI*2)*0.08;
    f.rope.scale.x=f.rope.scale.z=pulse;

    if(p>=1 && !f.landed){
      f.landed=true;
      // Clean up flight visuals — the impact VFX spawns a new permanent-ish
      // rope so we don't need the cylinder anymore.
      scene.remove(f.rope);  f.rope.geometry.dispose();  f.ropeMat.dispose();
      scene.remove(f.proj);  f.proj.geometry.dispose(); f.proj.material.dispose();
      flyingHooks.splice(i,1);
      try{ f.onLand && f.onLand(); }catch(e){ console.warn('[hook] onLand threw',e); }
    }
  }
}

function spawnSamuraiMeleeVfx(cfg,x,z,tx,tz){
  sMeleeSwing('samurai');
  const dx=tx-x, dz=tz-z;
  const len=Math.hypot(dx,dz);
  if(len<0.1) return;
  // Layered slash: a thick coloured streak along the dash trail, a thinner
  // white-hot core on top, plus short parallel "speed-lines" offset to the
  // sides so it reads as a high-velocity blade-cut.
  //
  // KEY: every streak is a unit cylinder anchored at the player end (`y=0`
  // after geometry translate) and rotated so its local +Y points toward the
  // destination. Each frame the slashVfx animator scales .y from 0 → fullLen,
  // so the streak visibly extends *from the player toward the destination*
  // instead of appearing as a static line — that's the directional feel the
  // previous TubeGeometry version was missing.
  const dirVec=new THREE.Vector3(dx,0,dz).normalize();

  const mkStreak=(radius, color, opacity, dur, growDur, yLift)=>{
    const g=new THREE.CylinderGeometry(radius,radius,1,isMobile?6:10,1,true);
    g.translate(0,0.5,0); // origin at the bottom face → grows along +Y
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});
    const m=new THREE.Mesh(g,mat);
    m.position.set(x, yLift, z);
    m.quaternion.setFromUnitVectors(_hookUp, dirVec);
    m.scale.set(1,0.0001,1); // start collapsed at the player
    m.frustumCulled=false;
    m.renderOrder=100; // keep above river ribbons (peak ~86 on multi-band maps)
    scene.add(m);
    slashVfx.push({mesh:m,mat,t:0,dur,baseRot:0,spin:0,opacity,extend:true,fullLen:len,growDur,scaleXZ:1});
  };

  // Outer coloured glow band
  mkStreak(0.22, cfg.color, 0.75, 0.40, 0.09, 0.18);
  // White-hot inner core
  mkStreak(0.07, 0xffffff,  0.95, 0.26, 0.07, 0.19);

  // Speed-lines: two short parallel streaks offset perpendicular to the cut.
  // They grow the same way — from the player-side end out toward the cut's
  // forward direction, just over a shorter length and slightly later.
  const perpX=-dz/len, perpZ=dx/len;
  for(const sign of [-1,1]){
    const offset=0.45;
    const sl=0.55 + Math.random()*0.30; // shorter than the main cut
    const a=Math.random()*(1-sl);       // staggered start along the cut
    const sx=x+dx*a + perpX*offset*sign;
    const sz=z+dz*a + perpZ*offset*sign;
    const slGeoCyl=new THREE.CylinderGeometry(0.045,0.045,1,isMobile?5:8,1,true);
    slGeoCyl.translate(0,0.5,0);
    const slMat=new THREE.MeshBasicMaterial({color:cfg.color,transparent:true,opacity:0.85,depthWrite:false,blending:THREE.AdditiveBlending});
    const slMesh=new THREE.Mesh(slGeoCyl,slMat);
    slMesh.position.set(sx,0.16,sz);
    slMesh.quaternion.setFromUnitVectors(_hookUp,dirVec);
    slMesh.scale.set(1,0.0001,1);
    slMesh.frustumCulled=false;
    slMesh.renderOrder=100;
    scene.add(slMesh);
    slashVfx.push({mesh:slMesh,mat:slMat,t:0,dur:0.30,baseRot:0,spin:0,opacity:0.85,extend:true,fullLen:sl*len,growDur:0.08,scaleXZ:1});
  }

  // Draw-cut arc at the destination — a small bright crescent perpendicular
  // to the slash direction (like the iaijutsu finish at sheath).
  const ang=Math.atan2(dx,dz);
  const finishGeo=new THREE.RingGeometry(0.85,1.35,isMobile?14:22,1,-0.55,1.10);
  const finishMat=new THREE.MeshBasicMaterial({color:cfg.color,transparent:true,opacity:0.92,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const finish=new THREE.Mesh(finishGeo,finishMat);
  finish.rotation.x=-Math.PI/2;
  finish.rotation.z=ang-Math.PI/2; // matches the slash-arc rotation used elsewhere
  finish.position.set(tx,0.20,tz);
  finish.frustumCulled=false;
  finish.renderOrder=102;
  scene.add(finish);
  slashVfx.push({mesh:finish,mat:finishMat,t:0,dur:0.30,baseRot:finish.rotation.z,spin:Math.PI*2.2,opacity:0.92,elastic:false});

  // Punch flashes at start/end + a particle puff at the exit point.
  spawnShockwave(x,z,1.0,cfg.color,0.10,0.32);
  spawnShockwave(tx,tz,1.4,cfg.color,0.14,0.42);
  flashLight({x:tx,z:tz},cfg.color,3.6,6.5,0.13);
  burst({x:tx,z:tz},cfg.color,isMobile?8:18);
  // A few small bursts scattered along the cut for petal/dust feel.
  const puffs=isMobile?2:4;
  for(let i=1;i<=puffs;i++){
    const f=i/(puffs+1);
    burst({x:x+dx*f,z:z+dz*f},cfg.color,isMobile?1:2);
  }
}

function performMeleeAttack(weapon, opts={}){
  const cfg=meleeStatsFor(weapon,opts);
  const x=Number.isFinite(opts.x)?opts.x:player.pos.x;
  const z=Number.isFinite(opts.z)?opts.z:player.pos.z;
  let dx=Number.isFinite(opts.dx)?opts.dx:0;
  let dz=Number.isFinite(opts.dz)?opts.dz:0;
  const dl=Math.hypot(dx,dz)||1;
  dx/=dl; dz/=dl;
  const ownerId=Number.isFinite(opts.ownerId)?opts.ownerId:mp.myId;
  // Crystal Force multiplier applies to the OWNER's local melee — opts.dmg is
  // only set when the host received this melee via relay (and in that case
  // the sender already baked their crystalPowerMult into opts.dmg, so don't
  // double-apply).
  // Mark this melee swing as the current damage source so killEnemy can
  // attribute kills to it (for Bloodthirst stacking). Cleared after the
  // melee hit phase below.
  if(ownerId===mp.myId) _meleeSwingActive=true;
  // Bloodthirst (rare) — recent melee kills stack a melee-only damage buff.
  // Stack count and timer are tracked on the player; ticked down in update().
  let _bloodthirstMul=1;
  if(ownerId===mp.myId && (playerSkills.bloodthirst||0)>0 && (player._btT||0)>0){
    const _btLvl=playerSkills.bloodthirst;
    const _per=[0,0.30,0.30,0.55,0.55,0.80][_btLvl]||0;
    _bloodthirstMul=1 + _per*Math.min(3,player._btStacks||0);
  }
  // Blade Dance (rare) — every Nth swing is wider arc + bonus dmg. eff 3 →
  // every 3rd, eff 5 → every 2nd.
  let _bladeArcMul=1, _bladeDmgMul=1;
  if(ownerId===mp.myId && (playerSkills.bladeDance||0)>0){
    const _bdLvl=playerSkills.bladeDance;
    const _every=[0,3,3,3,2,2][_bdLvl]||3;
    const _dmgBonus=[0,0.50,0.50,0.50,0.75,0.75][_bdLvl]||0;
    player._bdSwingCount=(player._bdSwingCount||0)+1;
    if(player._bdSwingCount%_every===0){
      _bladeArcMul=1.55; _bladeDmgMul=1+_dmgBonus;
      // Empowered swing — wide bright crescent so the bonus hit reads.
      spawnSkillBeam(x,z,dx,dz,(cfg.range||2.2)*1.45,(cfg.range||2.2)*0.95,cfg.color||0x66eeff,0.22,0.5);
    }
  }
  // Stonebreaker (legendary) — +50% melee crit chance via the transient
  // _critChanceBonus + a heal on crit (handled below per hit).
  if(ownerId===mp.myId && playerSkills.stonebreaker) _critChanceBonus=0.50;
  const dmg=Math.round(opts.dmg || playerStats.attackDmg*cfg.dmgMult*crystalPowerMult()*_bloodthirstMul*_bladeDmgMul);
  const localMotion=opts.localMotion===true || (!opts.visualOnly&&ownerId===mp.myId);
  const relayExtra={};
  const halfArc=cfg.arc*0.5*_bladeArcMul;
  // Sweep Step (uncommon) — nudge the local player forward along the swing
  // direction. Skip for relayed/visual-only swings so we don't desync teammates.
  if(localMotion && ownerId===mp.myId && (playerSkills.sweepStep||0)>0 && player && !player.dead){
    const _ssLvl=playerSkills.sweepStep;
    const _ssDist=[0,0.50,0.80,0.80,1.20,1.60][_ssLvl]||0;
    if(_ssDist>0){
      const _sx=player.pos.x, _sz=player.pos.z;
      player.pos.x += dx*_ssDist;
      player.pos.z += dz*_ssDist;
      clamp(player.pos, 0.35);
      resolveObst(player.pos, 0.35);
      // Forward dash streak so the sweep reads as movement, not a teleport.
      if(fxHeavyOK()) spawnSkillBeam(_sx,_sz,dx,dz,_ssDist+1.0,0.6,cfg.color||0x66eeff,0.2,0.4);
    }
  }
  const guardBreakerRank=Number.isFinite(opts.guardBreakerRank)?opts.guardBreakerRank:(ownerId===mp.myId?epicRank('guardBreaker'):0);
  const applyGuardBreakerKnock=(e)=>{
    if(!guardBreakerRank||!e||e.dead) return;
    knockEnemyOutOfMelee(e,x,z,cfg.range+e.cfg.r+0.22,[0,0.8,1.2][guardBreakerRank]||0.8);
  };
  let hitAny=false;
  let hitDamage=0;
  if(cfg.area==='circle'){
    spawnCircleMeleeVfx(cfg,x,z);
    if(!opts.visualOnly){
      for(let i=enemies.length-1;i>=0;i--){
        const e=enemies[i]; if(!e||e.dead) continue;
        if(Math.hypot(e.pos.x-x,e.pos.z-z)<=cfg.range+e.cfg.r){
          damageEnemyIndex(i,dmg,cfg.color,cfg.stagger,ownerId,'melee');
          applyGuardBreakerKnock(e);
          hitAny=true;
          hitDamage+=dmg;
        }
      }
    }
  } else if(cfg.area==='hook'){
    const target=(Number.isFinite(opts.targetX)&&Number.isFinite(opts.targetZ)&&opts.visualOnly)
      ? {x:opts.targetX,z:opts.targetZ,enemyIndex:null,hit:true,kind:opts.targetKind||'wall'}
      : findHookTarget(x,z,dx,dz,cfg.range);
    relayExtra.targetX=Math.round(target.x*100)/100;
    relayExtra.targetZ=Math.round(target.z*100)/100;
    relayExtra.targetKind=target.kind||'air';
    // Akshan-E flow: fire a projectile (rope grows toward target), and only
    // *after it lands* do we play the impact VFX, deal damage, and start the
    // swing. Capture everything we need in the closure so the deferred call
    // doesn't have to re-look-up indices that could have shifted.
    const fromX=x, fromZ=z, lockedTargetX=target.x, lockedTargetZ=target.z;
    const hitIndex = (!opts.visualOnly && target.enemyIndex!==null) ? target.enemyIndex : null;
    const lockedEnemy = (hitIndex!==null) ? enemies[hitIndex] : null;
    const targetKind=target.kind||'air';
    spawnHookFlight(cfg, fromX, fromZ, lockedTargetX, lockedTargetZ, ()=>{
      spawnHookImpactVfx(cfg, fromX, fromZ, lockedTargetX, lockedTargetZ, targetKind==='wall'?1.08:0.42);
      if(targetKind==='wall') sHookWall();
      if(localMotion && target.hit){
        if(targetKind==='wall') startHookSwing(lockedTargetX, lockedTargetZ, cfg.range, 'wall');
        else if(!lockedEnemy || isHookHeavyEnemy(lockedEnemy)) startHookSwing(lockedTargetX, lockedTargetZ, cfg.range, 'heavy');
      }
      if(hitIndex!==null && lockedEnemy && !lockedEnemy.dead){
        // The enemies array index may have shifted while the hook was in
        // flight — re-find the same enemy by reference.
        const idx=enemies.indexOf(lockedEnemy);
        if(idx>=0){
          damageEnemyIndex(idx,dmg,cfg.color,cfg.stagger,ownerId,'melee');
          applyGuardBreakerKnock(lockedEnemy);
          if(!isHookHeavyEnemy(lockedEnemy)) startHookedEnemyPull(lockedEnemy,ownerId,cfg.color);
        }
      }
    });
    // Track hit for SFX / lifesteal accounting — the visuals are deferred but
    // the gameplay outcome is committed at fire time (target was locked).
    if(hitIndex!==null){ hitAny=true; hitDamage+=dmg; }
  } else if(cfg.area==='dash'){
    const dashRange=Number.isFinite(opts.range)?opts.range:cfg.range;
    const tx=Number.isFinite(opts.targetX)?opts.targetX:x+dx*dashRange;
    const tz=Number.isFinite(opts.targetZ)?opts.targetZ:z+dz*dashRange;
    relayExtra.targetX=Math.round(tx*100)/100;
    relayExtra.targetZ=Math.round(tz*100)/100;
    spawnSamuraiMeleeVfx(cfg,x,z,tx,tz);
    if(localMotion) startMeleeDashTo(tx,tz,24,0.42);
    if(!opts.visualOnly){
      const hitR=0.92;
      for(let i=enemies.length-1;i>=0;i--){
        const e=enemies[i]; if(!e||e.dead) continue;
        if(segmentPointDistance(e.pos.x,e.pos.z,x,z,tx,tz)<=hitR+e.cfg.r){
          damageEnemyIndex(i,dmg,cfg.color,cfg.stagger,ownerId,'melee');
          applyGuardBreakerKnock(e);
          hitAny=true;
          hitDamage+=dmg;
        }
      }
    }
  } else {
  spawnMeleeSlashVfx(cfg.id,x,z,dx,dz,cfg);
  if(!opts.visualOnly){
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i]; if(!e||e.dead) continue;
    const ex=e.pos.x-x, ez=e.pos.z-z;
    const dist=Math.hypot(ex,ez);
    if(dist>cfg.range+e.cfg.r) continue;
    const ndx=ex/(dist||1), ndz=ez/(dist||1);
    const ang=Math.acos(Math.max(-1,Math.min(1,ndx*dx+ndz*dz)));
    if(ang<=halfArc || dist<0.72+e.cfg.r){
      damageEnemyIndex(i,dmg,cfg.color,cfg.stagger,ownerId,'melee');
      applyGuardBreakerKnock(e);
      hitAny=true;
      hitDamage+=dmg;
    }
  }
  }
  }
  // Clear the transient crit bonus the Stonebreaker block above set. This
  // must run regardless of visualOnly so we don't leak elevated crit into
  // the next non-melee damage source.
  _critChanceBonus=0;
  // End-of-swing flag clear for Bloodthirst kill attribution.
  if(ownerId===mp.myId) _meleeSwingActive=false;
  if(opts.visualOnly) return;
  // Mini-objective spawner hit. Melee hits used to bypass the spawner because
  // damageMiniObjectiveWithBullet only ran on bullets. Run a generic range
  // check from the swing origin (covers slash / circle / dash / hook).
  if((mp.soloMode||mp.isHost) && miniObjective?.type==='spawners' && !miniObjective.complete){
    const meleeRange=cfg.range+0.5;
    if(damageMiniObjectiveAt(x+dx*meleeRange*0.45, z+dz*meleeRange*0.45, dmg, meleeRange*0.85, cfg.color)){
      hitAny=true;
    }
  }
  // Stonebreaker heal on melee crit — heal 5% maxHP per crit landed this
  // swing. damageEnemyIndex stamps e._lastCrit on each hit; collect.
  if(hitAny && ownerId===mp.myId && playerSkills.stonebreaker){
    let stonebreakerCrits=0;
    for(const e of enemies){ if(e && e._lastCrit){ stonebreakerCrits++; e._lastCrit=false; } }
    if(stonebreakerCrits>0){
      // Crit pop so the "shatter" lands visually (heal number shows separately).
      burst(player.pos,0xffd700,isMobile?4:8);
      if(fxHeavyOK()) spawnSkillRingAura(player.pos.x,player.pos.z,1.25,0xffd700,0.3,0.5);
    }
    if(stonebreakerCrits>0 && !regenSourcesBlocked()){
      const heal=Math.max(1,Math.round(playerStats.maxHp*0.05*stonebreakerCrits));
      const gained=healPlayer(heal);
      if(gained) dmgNum('+'+gained+' HP',player.pos,'#ffd700');
    }
  }
  // Single impact accent per swing — avoids stacking N copies when one swing
  // catches multiple enemies (which would clip the audio).
  if(hitAny) sMeleeHit();
  if(hitAny&&cfg.lifeSteal>0&&hitDamage>0&&!(ownerId===mp.myId&&regenSourcesBlocked())){
    const healAmt=Math.max(1,Math.min(cfg.lifeStealCap||999,Math.round(hitDamage*cfg.lifeSteal)));
    if(ownerId===mp.myId){
      const gained=healPlayer(healAmt);
      if(gained) dmgNum('+'+gained+' HP',player.pos,'#ff6688');
    } else if(mp.isHost&&mp.connected&&!mp.soloMode){
      const c=mp.conns.get(ownerId);
      if(c&&c.open) c.send(JSON.stringify({type:'HEAL',targetId:ownerId,amount:healAmt,color:'#ff6688'}));
    }
  }
  if(ownerId===mp.myId&&playerSkills.bladeWave&&!opts.echo){
    const rank=epicRank('bladeWave');
    const len=cfg.range+[0,3.4,5.0][rank];
    const width=[0,1.28,1.72][rank];
    const waveDmg=Math.round(dmg*[0,0.62,0.92][rank]);
    // Travel duration controls the wave speed. rank 1: ~0.55s = quick
    // dart; rank 2: ~0.65s = slightly longer arc travel (wider, hits more
    // along the way). Enemies in the path each take one hit as the wave
    // sweeps over them — handled inside updateBladeWaves.
    const dur=[0,0.55,0.65][rank]||0.55;
    spawnBladeWave(x,z,dx,dz,len,width,cfg.color,waveDmg,dur,ownerId);
  }
  if(ownerId===mp.myId&&playerSkills.duelGuard&&hitAny){
    const rank=epicRank('duelGuard');
    player.invincible=Math.max(player.invincible,[0,0.30,0.48][rank]);
    spawnShockwave(player.pos.x,player.pos.z,1.15,cfg.color,0.12,0.42);
    spawnSkillRingAura(player.pos.x,player.pos.z,1.35,cfg.color,0.36,0.46);
    sDuelGuard();
    const healAmt=Math.round(playerStats.maxHp*([0,0.03,0.05][rank]||0)+([0,20,40][rank]||0));
    const gained=regenSourcesBlocked()?0:healPlayer(healAmt);
    if(gained) dmgNum('+'+gained+' HP',player.pos,'#88ffdd');
  }
  if(ownerId===mp.myId&&playerSkills.crimsonCyclone){
    crimsonCycloneT=3.2;
    crimsonCycloneTick=0;
    spawnSkillRingAura(player.pos.x,player.pos.z,2.45,0xff3366,0.62,0.44);
  }
  if(ownerId===mp.myId&&playerSkills.phantomDuelist&&!opts.echo){
    for(let pi=0;pi<4;pi++){
      const ang=pi*Math.PI/2;
      const ex=dx*Math.cos(ang)-dz*Math.sin(ang);
      const ez=dx*Math.sin(ang)+dz*Math.cos(ang);
      setTimeout(()=>performMeleeAttack(cfg.id,{x,z,dx:ex,dz:ez,dmg:Math.round(dmg*0.58),range:cfg.range,arc:cfg.arc,ownerId:mp.myId,visualOnly:false,relay:false,echo:true}),95+pi*35);
    }
  }
  if(opts.relay!==false&&mp.connected&&!mp.soloMode){
    const msg={type:'MELEE_ATTACK',id:mp.myId,weapon:cfg.id,x:Math.round(x*100)/100,z:Math.round(z*100)/100,dx:Math.round(dx*1000)/1000,dz:Math.round(dz*1000)/1000,dmg,range:cfg.range,arc:cfg.arc,lifeSteal:cfg.lifeSteal,lifeStealCap:cfg.lifeStealCap,guardBreakerRank,...relayExtra};
    if(mp.isHost) broadcastMP({...msg,type:'MELEE_VFX'});
    else sendToHost(msg);
  }
}

function useMeleeAttack(){
  if(nbPaused||gState!=='playing'||player.dead||player.downed||player.meleeCd>0) return;
  const cfg=meleeStatsFor(player.meleeWeapon);
  const d=meleeAimDir();
  player.meleeCd=cfg.cd;
  if(player.mesh) player.mesh.rotation.y=Math.atan2(d.x,d.z);
  if(mp.connected&&!mp.soloMode&&!mp.isHost){
    performMeleeAttack(cfg.id,{x:player.pos.x,z:player.pos.z,dx:d.x,dz:d.z,range:cfg.range,arc:cfg.arc,visualOnly:true,relay:false,localMotion:true});
    sendToHost({type:'MELEE_ATTACK',id:mp.myId,weapon:cfg.id,x:Math.round(player.pos.x*100)/100,z:Math.round(player.pos.z*100)/100,dx:Math.round(d.x*1000)/1000,dz:Math.round(d.z*1000)/1000,dmg:Math.round(playerStats.attackDmg*cfg.dmgMult*crystalPowerMult()),range:cfg.range,arc:cfg.arc,lifeSteal:cfg.lifeSteal,lifeStealCap:cfg.lifeStealCap,guardBreakerRank:epicRank('guardBreaker')});
  } else {
    performMeleeAttack(cfg.id,{x:player.pos.x,z:player.pos.z,dx:d.x,dz:d.z,ownerId:mp.myId});
  }
}

function sendReviveTouch(targetId){
  if(!mp.connected||targetId===mp.myId) return;
  recordReviveAssist(targetId);
  const msg={type:'REVIVE_TOUCH',from:mp.myId,targetId};
  if(mp.isHost){
    const conn=mp.conns.get(targetId);
    if(conn&&conn.open) conn.send(JSON.stringify(msg));
  } else {
    sendToHost(msg);
  }
}

function mpPlayerIds(){
  if(!mp.isHost&&Array.isArray(mp.buffPlayers)&&mp.buffPlayers.length) return [...mp.buffPlayers].sort((a,b)=>a-b);
  const ids=new Set([mp.myId]);
  Object.keys(mp.remotePlayers).forEach(id=>ids.add(+id));
  if(mp.isHost) ids.add(0);
  return [...ids].sort((a,b)=>a-b);
}

function meleePlayerIds(){
  if(!mp.isHost&&Array.isArray(mp.meleePlayers)&&mp.meleePlayers.length) return [...mp.meleePlayers].sort((a,b)=>a-b);
  return mpPlayerIds();
}

// Visual level-progression dots used in place of "LVL N → N+1" text on skill
// cards. `cur` is the player's current level (0–5), `next` is what this pick
// would bump them to. The (next-1)th dot is highlighted in gold so the user
// can see exactly which slot is about to fill.
function levelDotsHtml(cur, next, max=5){
  let html='<div class="buff-card-dots">';
  for(let i=1;i<=max;i++){
    if(i<next) html += '<span class="lvl-dot on"></span>';
    else if(i===next) html += '<span class="lvl-dot new"></span>';
    else html += '<span class="lvl-dot"></span>';
  }
  html += '</div>';
  return html;
}

const CARD_ICON_POS = {
  pistol:[0,0], shotgun:[1,0], ak47:[2,0], burst:[3,0], grenade:[4,0], railgun:[5,0],
  katana:[0,1], dagger:[1,1], axe:[2,1], hook:[3,1], samurai:[4,1], boomerang:[5,1],
  fireOrb:[0,2], iceOrb:[1,2], thunderOrb:[2,2], poisonOrb:[3,2], barrier:[4,2], vampire:[5,2],
  spread:[0,3], explosive:[1,3], heavy:[2,3], healDrop:[3,3], dash:[4,3], factoryGate:[5,3],
};
const CARD_CATEGORY_ICON = {
  bullet:'spread', orb:'fireOrb', spell:'thunderOrb', melee:'katana',
  survival:'barrier', movement:'dash', summon:'factoryGate', luck:'healDrop', economy:'healDrop',
};
const CARD_ICON_ALIAS = {
  pistol:'pistol', shotgun:'shotgun', ak47:'ak47', burst:'burst', grenade:'grenade', railgun:'railgun',
  smg:'burst', cryo:'iceOrb', flamethrower:'fireOrb', sniper:'railgun', rpg:'explosive',
  laser:'railgun', minigun:'grenade', boomerang:'boomerang', gravity:'emoji',
  eventHorizon:'emoji',unstableCollapse:'emoji',persistentSingularity:'emoji',gravityAscension:'emoji',
  grenadeAscension:'emoji',grenadeRadius:'emoji',grenadeCore:'emoji',grenadePrimer:'emoji',
  burstAscension:'emoji',burstControl:'emoji',burstConvergence:'emoji',burstOpening:'emoji',
  ak47Ascension:'emoji',ak47Control:'emoji',ak47Momentum:'emoji',ak47Tactical:'emoji',
  pistolRicochet:'emoji',pistolPrecision:'emoji',pistolLastWord:'emoji',pistolAscension:'emoji',shotgunImpact:'emoji',shotgunRain:'emoji',shotgunFocus:'emoji',shotgunAscension:'emoji',
  katana:'katana', dagger:'dagger', axe:'axe', hook:'hook', samurai:'samurai',
  atk:'heavy', heal:'healDrop', hp:'barrier', maxhp:'barrier', maxHp:'barrier', speed:'dash',
  dmg:'heavy', fireRate:'burst', crit:'spread', bossHunter:'heavy', revive:'healDrop',
  startSkill:'factoryGate', reroll:'spread', treasure:'healDrop',
  glassReactor:'heavy', heavyCrown:'barrier', bloodContract:'vampire',
  berserkerGrip:'axe', gamblerChip:'spread', luckyDebt:'healDrop', lastStandCore:'fireOrb',
  orbEngine:'fireOrb', quantumDash:'dash', fateGambit:'spread',
  envy:'vampire', greedyCrown:'heavyCrown', heavyBoots:'dash',
  linkedPain:'soulLinkArmy', boneTribute:'factoryGate', brittleBones:'iceOrb',
  tribute:'healDrop', sacrifice:'vampire', bargain:'heavyCrown', pact:'bloodContract',
  spread:'spread', rapidFire:'burst', fireball:'fireOrb', iceOrb:'iceOrb',
  thunderOrb:'thunderOrb', poisonOrb:'poisonOrb', lightning:'thunderOrb',
  pierce:'spread', explosive:'explosive', barrier:'barrier', leech:'vampire',
  bounce:'boomerang', spellCard:'thunderOrb', heavyRounds:'heavy',
  orbSpeed:'fireOrb', orbPower:'fireOrb', orbSize:'heavy', orbPulse:'fireOrb',
  bulletPower:'heavy', fireRing:'fireOrb', homingBomb:'explosive',
  spellPower:'thunderOrb', spellHaste:'emoji', stormCall:'thunderOrb',
  meleePower:'katana', meleeReach:'samurai', meleeHaste:'dagger', meleeLeech:'vampire',
  dashMastery:'dash', afterimage:'dash', phaseStep:'emoji', blinkStrike:'samurai',
  kineticCharge:'emoji', adrenaline:'emoji', laserDrone:'railgun', guardianTurret:'factoryGate',
  mineLayer:'explosive', repairDrone:'healDrop', shieldBot:'barrier', bladeSentinel:'katana',
  summonDuration:'barrier', summonPower:'heavy', summonHaste:'dash',
  factoryGate:'factoryGate', soulLinkArmy:'emoji', crimsonCyclone:'axe',
  phantomDuelist:'katana', starfallDash:'explosive', echoStep:'dash',
  orbGalaxy:'emoji', gravityCore:'thunderOrb', archmageLoop:'emoji',
  celestialVerdict:'emoji', bulletHellEngine:'spread', executionRounds:'emoji',
  railBurst:'railgun', overclockBarrage:'burst', twinOrbit:'fireOrb',
  orbitStorm:'thunderOrb', elementalWake:'emoji', meteorRite:'explosive',
  arcaneTempo:'emoji', bladeWave:'samurai', guardBreaker:'axe', duelGuard:'barrier',
  secondSkin:'barrier', critLuck:'emoji',
  luckRarity:'emoji', healDrop:'healDrop', luckyDraw:'emoji', pickStreak:'emoji', lootDrop:'emoji',
  detonate:'explosive', roundSurge:'burst', orbMastery:'fireOrb',
  steadyPulse:'healDrop', ironPlate:'barrier', berserkerHeart:'emoji',
  vitalCore:'barrier', bloodGrowth:'vampire', bossPlate:'barrier', overhealFrame:'barrier', crystalHeart:'emoji',
  magneticRounds:'emoji', hollowPoint:'heavy', iceSpike:'iceOrb',
  crystalLining:'emoji', elementalMastery:'emoji', lingeringMarks:'emoji', imbueRounds:'emoji',
  sweepStep:'dash', bloodthirst:'vampire', bladeDance:'samurai', stonebreaker:'axe',
  magSize:'heavy', reloadSpeed:'dash', crystalLuck:'emoji', crystalHeal:'healDrop',
  frugalShop:'emoji', shopOffer:'emoji', crystalPower:'emoji', crystalSurge:'emoji',
};
function cardIconKey(id, def=null){
  if(def&&def.iconKey) return def.iconKey;
  if(CARD_ICON_ALIAS[id]) return CARD_ICON_ALIAS[id];
  const cat = (typeof SKILL_CATEGORY !== 'undefined') ? SKILL_CATEGORY[id] : '';
  return CARD_CATEGORY_ICON[cat] || 'heavy';
}
// Colourise a card description: numbers/percentages/multipliers pop gold,
// key game terms pop cyan. Plain-text only — if the string already contains
// markup we leave it untouched so we never corrupt existing HTML/colours.
const _HL_TERMS = /\b(HP|health|regen|damage|crit(?:ical)?|fire ?rate|speed|shield|armou?r|fire|ice|frost|poison|thunder|lightning|reload|ammo|magazine|mag|heals?|healing|revive|dash|range|pierce|piercing|explo(?:de|sion)|burn|slow|stun|knockback|lifesteal|leech|gold|keys?|wave|boss|elite|summons?|all(?:y|ies)|drone|turret|sentinel|bullet|orb|spell|melee|crystal)\b/gi;
function hl(text){
  if(text==null) return '';
  let s=String(text);
  if(s.indexOf('<')>=0) return s; // already has markup — don't touch
  s=s.replace(/([+\-]?\d+(?:\.\d+)?(?:%|x|×|s)?)/g, '<span class="kw-num">$1</span>');
  s=s.replace(_HL_TERMS, m=>`<span class="kw-term">${m}</span>`);
  return s;
}
function cardIconHtml(id, fallback='', cls='buff-card-icon', def=null){
  if(skillRarity(id)==='divine')cls+=' divine-icon';
  const pos = window.NEONBRAWL_CONFIG.assets.cardIcons && CARD_ICON_POS[cardIconKey(id, def)];
  if(!pos) return `<div class="${cls}">${fallback||'✦'}</div>`;
  const x = (pos[0] * 20).toFixed(4).replace(/\.?0+$/,'');
  const y = (pos[1] * (100 / 3)).toFixed(4).replace(/\.?0+$/,'');
  return `<div class="${cls} card-art-icon" style="--icon-pos-x:${x}%;--icon-pos-y:${y}%"></div>`;
}

function pickCardWithFx(card, done){
  const wrap=card?.parentElement;
  if(card&&wrap){
    if(wrap.classList.contains('choosing-card')) return;
    const cardRect=card.getBoundingClientRect();
    const wrapRect=wrap.getBoundingClientRect();
    const centerX=wrapRect.left+wrapRect.width/2;
    const centerY=wrapRect.top+wrapRect.height/2;
    card.style.setProperty('--pick-x', `${centerX-(cardRect.left+cardRect.width/2)}px`);
    card.style.setProperty('--pick-y', `${centerY-(cardRect.top+cardRect.height/2)}px`);
    [...wrap.children].forEach(child=>{
      if(child===card||!child.classList?.contains('buff-card')) return;
      const r=child.getBoundingClientRect();
      const dir=(r.left+r.width/2)<(cardRect.left+cardRect.width/2)?-1:1;
      child.style.setProperty('--exit-x', `${dir*(window.innerWidth*0.22+80)}px`);
      child.style.setProperty('--exit-y', `${20+Math.random()*24}px`);
    });
    wrap.classList.add('choosing-card');
    card.classList.add('picked');
    const pickRun=runGeneration,pickState=gState;
    setTimeout(()=>{
      if(runGeneration!==pickRun||gState!==pickState||!card.isConnected||card.parentElement!==wrap) return;
      done();
    },650);
  } else {
    done();
  }
}
function removeBuffRerollButtons(){
  document.querySelectorAll('#buffCards .buff-reroll-btn').forEach(btn=>btn.remove());
}

// ── Gun (primary weapon) select — runs BEFORE melee select on a fresh run.
// MP-synced via mp.gunReady; once everyone has locked in, the host broadcasts
// GUN_START and the lobby flows into showMeleeSelect.
function showGunSelect(){
  gState='gunselect';
  const el=document.getElementById('gunSelect');
  const sub=document.getElementById('gunSubtitle');
  const cards=document.getElementById('gunCards');
  if(!el||!cards) return;
  const ids=gunPlayerIds();
  const readyCount=ids.filter(id=>mp.gunReady[id]).length;
  if(sub) sub.textContent=mp.soloMode||!mp.gunReady[mp.myId]
    ? 'Pick your primary gun for this run. Unlock more from shop chests.'
    : `${readyCount}/${ids.length} players locked in.`;
  cards.classList.remove('choosing-card');
  cards.innerHTML='';
  GUN_SELECT_ORDER.map(id=>GUNS[id]).filter(g=>g&&isGunOwned(g.id)).forEach((g,i)=>{
    const card=document.createElement('button');
    card.className='buff-card';
    card.type='button';
    card.style.setProperty('--cat-color',g.css);
    card.style.animationDelay=`${i*70}ms, ${340+i*70}ms`;
    const pelletStr=g.bulletsPerShot>1?` ×${g.bulletsPerShot}`:'';
    card.innerHTML=`
      ${cardIconHtml(g.id,g.icon)}
      <div class="buff-card-name">${g.name}</div>
      <div class="buff-card-desc">${hl(g.desc)}</div>
      <div class="stat-row">
        <span class="stat-pill"><span class="ic">💥</span>×${g.dmgMult.toFixed(2)}${pelletStr}</span>
        <span class="stat-pill"><span class="ic">⏱️</span>${g.fireCd.toFixed(2)}s</span>
        <span class="stat-pill"><span class="ic">📦</span>${g.magSize}</span>
      </div>`;
    card.addEventListener('click',()=>pickCardWithFx(card,()=>selectGun(g.id)));
    cards.appendChild(card);
  });
  el.style.display='flex';
}
function hideGunSelect(){
  const el=document.getElementById('gunSelect'); if(el) el.style.display='none';
}
function gunPlayerIds(){
  if(!mp.isHost&&Array.isArray(mp.gunPlayers)&&mp.gunPlayers.length) return [...mp.gunPlayers].sort((a,b)=>a-b);
  return mpPlayerIds();
}
function allGunReady(){
  const ids=gunPlayerIds();
  return ids.length>0&&ids.every(id=>mp.gunReady[id]);
}
function broadcastGunReadyState(){
  if(!mp.isHost||mp.soloMode) return;
  broadcastMP({type:'GUN_READY_STATE',ready:mp.gunReady,players:gunPlayerIds()});
}
function updateGunWaitingView(){
  const el=document.getElementById('gunSelect');
  const sub=document.getElementById('gunSubtitle');
  const cards=document.getElementById('gunCards');
  if(!el||!cards) return false;
  const ids=gunPlayerIds();
  const readyCount=ids.filter(id=>mp.gunReady[id]).length;
  if(sub) sub.textContent=`${readyCount}/${ids.length} players locked in.`;
  const picked=cards.querySelector('.picked');
  if(!picked) return false;
  el.style.display='flex';
  return true;
}
function refreshGunSelectStatus(){
  const el=document.getElementById('gunSelect');
  if(!el||el.style.display==='none') return false;
  const sub=document.getElementById('gunSubtitle');
  const ids=gunPlayerIds();
  const readyCount=ids.filter(id=>mp.gunReady[id]).length;
  if(sub){
    sub.textContent=mp.gunReady[mp.myId]
      ? `${readyCount}/${ids.length} players locked in.`
      : `Pick your primary gun for this run. ${readyCount}/${ids.length} players locked in.`;
  }
  return true;
}
function markGunReady(id, gunId='pistol'){
  mp.gunReady[id]=gunId;
  if(id===mp.myId){
    player.gun=gunId;
  } else if(mp.remotePlayers[id]){
    mp.remotePlayers[id].gun=gunId;
  }
  if(mp.isHost&&!mp.soloMode){
    if(!refreshGunSelectStatus()) showGunSelect();
    broadcastGunReadyState();
    if(allGunReady()&&!mp.gunStartQueued){
      mp.gunStartQueued=true;
      setTimeout(()=>{
        hideGunSelect();
        broadcastMP({type:'GUN_START',guns:mp.gunReady});
        showMeleeSelect();
        mp.gunStartQueued=false;
      },350);
    }
  }
}
function selectGun(id){
  const gunId=GUNS[id]&&isGunOwned(id)?id:'pistol';
  player.gun=gunId;
  // Refill the mag with the newly-picked gun's capacity so the player starts
  // wave 1 with a fresh magazine sized for the weapon they chose.
  player.ammo=currentMagSize();
  player.reloadT=0;
  player.reloadDur=currentReloadTime();
  mp.gunReady[mp.myId]=gunId;
  if(mp.soloMode||!mp.connected){
    hideGunSelect();
    showMeleeSelect();
  } else if(mp.isHost){
    markGunReady(mp.myId,gunId);
  } else {
    updateGunWaitingView();
    sendToHost({type:'GUN_READY',id:mp.myId,gun:gunId});
  }
}

function showMeleeSelect(){
  gState='meleeselect';
  const el=document.getElementById('meleeSelect');
  const sub=document.getElementById('meleeSubtitle');
  const cards=document.getElementById('meleeCards');
  const ids=meleePlayerIds();
  const readyCount=ids.filter(id=>mp.meleeReady[id]).length;
  if(sub) sub.textContent=mp.soloMode||!mp.meleeReady[mp.myId]
    ? 'Pick one weapon for this run. Press F in-game to strike.'
    : `${readyCount}/${ids.length} players locked in. Wave 1 starts when everyone chooses.`;
  if(!cards||!el) return;
  cards.classList.remove('choosing-card');
  cards.innerHTML='';
  // Only show weapons the player has unlocked in the shop. Katana is always
  // free, so guests / fresh accounts still see at least one option here.
  const ownedWeaponList = Object.values(MELEE_WEAPONS).filter(w => isWeaponOwned(w.id));
  ownedWeaponList.forEach((w,i)=>{
    const card=document.createElement('button');
    card.className='buff-card';
    card.type='button';
    card.style.setProperty('--cat-color',w.css);
    card.style.animationDelay=`${i*70}ms, ${340+i*70}ms`;
    // Weapon glyph (katana ⚔️ wide cleave, dagger 🗡️ point thrust), the name,
    // and an icon-stat row: 💥 damage multiplier, ⏱️ cooldown, hit-pattern
    // glyph (〰️ wide arc vs 📍 narrow pierce). No prose description.
    const glyph    = w.icon || (w.id==='katana' ? '⚔️' : '🗡️');
    const patternG = w.patternIcon || (w.id==='katana' ? '〰️' : '📍');
    card.innerHTML=`
      ${cardIconHtml(w.id,glyph)}
      <div class="buff-card-name">${w.name}</div>
      <div class="buff-card-desc">${hl(w.desc)}</div>
      <div class="stat-row">
        <span class="stat-pill"><span class="ic">💥</span>×${w.dmgMult}</span>
        <span class="stat-pill"><span class="ic">⏱️</span>${w.cd}s</span>
        <span class="stat-pill"><span class="ic">${patternG}</span></span>
      </div>`;
    card.addEventListener('click',()=>pickCardWithFx(card,()=>selectMeleeWeapon(w.id)));
    cards.appendChild(card);
  });
  el.style.display='flex';
}

function hideMeleeSelect(){
  const el=document.getElementById('meleeSelect');
  if(el) el.style.display='none';
}

function broadcastMeleeReadyState(){
  if(!mp.isHost||mp.soloMode) return;
  broadcastMP({type:'MELEE_READY_STATE',ready:mp.meleeReady,players:meleePlayerIds()});
}

function allMeleeReady(){
  const ids=meleePlayerIds();
  return ids.length>0&&ids.every(id=>mp.meleeReady[id]);
}

function updateMeleeWaitingView(){
  const el=document.getElementById('meleeSelect');
  const sub=document.getElementById('meleeSubtitle');
  const cards=document.getElementById('meleeCards');
  if(!el||!cards) return false;
  const ids=meleePlayerIds();
  const readyCount=ids.filter(id=>mp.meleeReady[id]).length;
  if(sub) sub.textContent=`${readyCount}/${ids.length} players locked in. Wave 1 starts when everyone chooses.`;
  const picked=cards.querySelector('.picked');
  if(!picked) return false;
  el.style.display='flex';
  return true;
}
function refreshMeleeSelectStatus(){
  const el=document.getElementById('meleeSelect');
  if(!el||el.style.display==='none') return false;
  const sub=document.getElementById('meleeSubtitle');
  const ids=meleePlayerIds();
  const readyCount=ids.filter(id=>mp.meleeReady[id]).length;
  if(sub){
    sub.textContent=mp.meleeReady[mp.myId]
      ? `${readyCount}/${ids.length} players locked in. Wave 1 starts when everyone chooses.`
      : `Pick one weapon for this run. ${readyCount}/${ids.length} players locked in.`;
  }
  return true;
}

function markMeleeReady(id, weapon='katana'){
  mp.meleeReady[id]=weapon;
  if(id===mp.myId){
    player.meleeWeapon=weapon;
    if(player.mesh) setHeldMeleeModel(player.mesh,weapon);
  } else if(mp.remotePlayers[id]){
    mp.remotePlayers[id].meleeWeapon=weapon;
    setHeldMeleeModel(mp.remotePlayers[id].mesh,weapon);
  }
  if(mp.isHost&&!mp.soloMode){
    if(!refreshMeleeSelectStatus()) showMeleeSelect();
    broadcastMeleeReadyState();
    if(allMeleeReady()&&!mp.meleeStartQueued){
      mp.meleeStartQueued=true;
      setTimeout(()=>{
        hideMeleeSelect();
        broadcastMP({type:'MELEE_START',weapons:mp.meleeReady});
        beginOpeningLoadoutOrWave();
        mp.meleeStartQueued=false;
      },350);
    }
  }
}

function selectMeleeWeapon(id){
  const weapon=MELEE_WEAPONS[id]?id:'katana';
  player.meleeWeapon=weapon;
  player.meleeCd=0;
  if(player.mesh) setHeldMeleeModel(player.mesh,weapon);
  mp.meleeReady[mp.myId]=weapon;
  if(mp.soloMode||!mp.connected){
    hideMeleeSelect();
    beginOpeningLoadoutOrWave();
  } else if(mp.isHost){
    markMeleeReady(mp.myId,weapon);
  } else {
    updateMeleeWaitingView();
    sendToHost({type:'MELEE_READY',id:mp.myId,weapon});
  }
}

function showBuffWaiting(){
  gState='buffwait';
  const el=document.getElementById('buffSelect');
  const title=document.getElementById('buffTitle');
  const sub=document.getElementById('buffSubtitle');
  const cards=document.getElementById('buffCards');
  const ids=mpPlayerIds();
  const readyCount=ids.filter(id=>mp.buffReady[id]).length;
  title.textContent='WAITING FOR TEAM';
  sub.textContent=`${readyCount}/${ids.length} PLAYERS READY`;
  removeBuffRerollButtons();
  // Always rebuild the cards as ready-status rows. The previous "keep the
  // picked card visible" early-return left the just-picked skill card
  // stuck on screen during the wait phase (and into the shop transition),
  // which the player read as "you didn't actually move on." pickCardWithFx
  // has already played its 0.65 s animation by the time we get here, so
  // there's nothing to preserve.
  cards.classList.remove('choosing-card');
  cards.innerHTML='';
  ids.forEach(id=>{
    const row=document.createElement('div');
    row.className='buff-card';
    row.style.setProperty('--cat-color',mp.buffReady[id]?'#44ff88':'#8890aa');
    row.style.minHeight='82px';
    row.innerHTML=`<div class="buff-card-name">P${id+1}</div><div class="buff-card-desc">${mp.buffReady[id]?'READY':'PICKING...'}</div>`;
    cards.appendChild(row);
  });
  el.style.display='flex';
}

function broadcastBuffReadyState(){
  if(!mp.isHost||mp.soloMode) return;
  broadcastMP({type:'BUFF_READY_STATE',ready:mp.buffReady,players:mpPlayerIds(),wave:waveNum});
}

function allBuffReady(){
  const ids=mpPlayerIds();
  return ids.length>0&&ids.every(id=>mp.buffReady[id]);
}

function markBuffReady(id){
  mp.buffReady[id]=true;
  if(mp.isHost){
    if(mp.buffReady[mp.myId]||gState==='buffwait') showBuffWaiting();
    broadcastBuffReadyState();
    if(allBuffReady()&&!mp.buffStartQueued){
      mp.buffStartQueued=true;
      const goShop=shouldOpenRunShopAfterWave();
      const readyRun=runGeneration,readyWave=waveNum,readyPeer=mp.peer;
      document.getElementById('buffSelect').style.display='none';
      setTimeout(()=>{
        if(runGeneration!==readyRun||waveNum!==readyWave||mp.peer!==readyPeer||
          !mp.isHost||gState!=='buffwait'||!mp.buffStartQueued) return;
        mp.buffReady={};
        mp.buffPlayers=null;
        mp.buffStartQueued=false;
        if(goShop){
          startRunShopRound();
          if(!mp.soloMode) broadcastMP({type:'RUN_SHOP_START',wave:waveNum});
        } else {
          nextWave();
        }
      },350);
    }
  }
}

function rematchPlayerIds(){
  if(!mp.isHost&&Array.isArray(mp.rematchPlayers)&&mp.rematchPlayers.length) return [...mp.rematchPlayers].sort((a,b)=>a-b);
  return mpPlayerIds();
}

function showRematchWaiting(){
  gState='rematchwait';
  document.getElementById('gameover').style.display='none';
  const el=document.getElementById('buffSelect');
  const title=document.getElementById('buffTitle');
  const sub=document.getElementById('buffSubtitle');
  const cards=document.getElementById('buffCards');
  // #buffCards is shared with the buff/skill pick UI; the last pick leaves
  // .choosing-card on it which triggers a cardExit fade-out animation on any
  // .buff-card:not(.picked) child. Without clearing it, the rematch status
  // cards we render below would render then immediately fade to opacity:0.
  cards.classList.remove('choosing-card');
  const ids=rematchPlayerIds();
  const readyCount=ids.filter(id=>mp.rematchReady[id]).length;
  title.textContent='REMATCH READY';
  sub.textContent=`${readyCount}/${ids.length} PLAYERS READY`;
  cards.innerHTML='';
  ids.forEach(id=>{
    const row=document.createElement('div');
    row.className='buff-card';
    row.style.setProperty('--cat-color',mp.rematchReady[id]?'#44ff88':'#8890aa');
    row.style.minHeight='82px';
    row.innerHTML=`<div class="buff-card-name">P${id+1}</div><div class="buff-card-desc">${mp.rematchReady[id]?'READY':'WAITING...'}</div>`;
    cards.appendChild(row);
  });
  el.style.display='flex';
}

function broadcastRematchReadyState(){
  if(!mp.isHost||mp.soloMode) return;
  broadcastMP({type:'REMATCH_READY_STATE',ready:mp.rematchReady,players:rematchPlayerIds()});
}

function allRematchReady(){
  const ids=rematchPlayerIds();
  return ids.length>0&&ids.every(id=>mp.rematchReady[id]);
}

function markRematchReady(id){
  mp.rematchReady[id]=true;
  if(mp.isHost){
    if(mp.rematchReady[mp.myId]||gState==='rematchwait') showRematchWaiting();
    broadcastRematchReadyState();
    if(allRematchReady()&&!mp.rematchStartQueued){
      mp.rematchStartQueued=true;
      const rematchRun=runGeneration,rematchPeer=mp.peer;
      setTimeout(()=>{
        if(runGeneration!==rematchRun||mp.peer!==rematchPeer||!mp.connected||gState!=='rematchwait') return;
        mp.rematchReady={};
        mp.rematchPlayers=null;
        mp.rematchStartQueued=false;
        document.getElementById('buffSelect').style.display='none';
        initGame();
      },350);
    }
  }
}

function requestRematch(){
  initAC();
  document.getElementById('deadOverlay').style.display='none';
  if(mp.soloMode||!mp.connected){ initGame(); return; }
  mp.rematchReady[mp.myId]=true;
  showRematchWaiting();
  if(mp.isHost) markRematchReady(mp.myId);
  else sendToHost({type:'REMATCH_READY',id:mp.myId});
}

function effectiveReviveRange(skills=playerSkills){
  return REVIVE_RANGE + (skills.repairDrone>=3 ? 0.8 : 0);
}

function updateReviveAssist(dt){
  if(mp.soloMode||player.dead||player.downed) return;
  const reviveTime=effectiveReviveTime();
  for(const [id,rp] of Object.entries(mp.remotePlayers)){
    if(!rp.downed) continue;
    if(Math.hypot(rp.pos.x-player.pos.x,rp.pos.z-player.pos.z)<=effectiveReviveRange()){
      rp.reviveT=Math.min(reviveTime,(rp.reviveT||0)+dt);
      mp.revivePingT=Math.max(0,mp.revivePingT-dt);
      if(mp.revivePingT<=0){
        sendReviveTouch(+id);
        mp.revivePingT=0.12;
      }
      break;
    }
  }
}

function teamIsWiped(){
  if(mp.soloMode) return player.dead&&!player.downed;
  const localOut=player.dead||player.downed;
  const remoteOut=Object.values(mp.remotePlayers).every(rp=>rp.dead||rp.downed);
  return localOut&&remoteOut;
}

function checkTeamWipe(){
  if(mp.soloMode||gState!=='playing') return;
  if(teamIsWiped()){
    if(mp.isHost) broadcastMP(JSON.stringify({type:'GAME_OVER_ALL'}));
    document.getElementById('deadOverlay').style.display='none';
    gameOver();
  }
}

function handleIncomingMP(msg, fromId){
  switch(msg.type){
    case 'PLAYER_JOIN':
      buildRemotePlayer(msg.id,msg.name);
      setPlayerName(msg.id,msg.name);
      if(typeof msg.userId !== 'undefined') mp.userIds[msg.id] = msg.userId || null;
      updateLobbyUI();
      setMpStatus(`${msg.count}/${MAX_PLAYERS} players`); break;
    case 'PLAYER_LEAVE':
      removeDisconnectedPlayer(msg.id,'left',false);
      if(gState==='buffwait') showBuffWaiting();
      if(gState==='rematchwait') showRematchWaiting();
      setMpStatus(`Player ${msg.id+1} left`); break;
    case 'PEER_LEAVE':
      if(mp.isHost) removeDisconnectedPlayer(fromId>=0?fromId:msg.id,'left');
      break;
    case 'HOST_LEFT':
      if(!mp.isHost) returnToMenuAfterDisconnect('Host disconnected');
      break;
    case 'PING':
      if(msg.id===mp.myId) break;
      if(msg.id===0&&!mp.isHost){
        mp.lastHostSeen=performance.now();
        if(msg.name) setPlayerName(0,msg.name);
        if(typeof msg.userId !== 'undefined') mp.userIds[0] = msg.userId || null;
      } else {
        let rp=mp.remotePlayers[msg.id];
        if(!rp){buildRemotePlayer(msg.id,msg.name);rp=mp.remotePlayers[msg.id];}
        if(rp) rp.lastSeen=performance.now();
        if(msg.name) setPlayerName(msg.id,msg.name);
        if(typeof msg.userId !== 'undefined') mp.userIds[msg.id] = msg.userId || null;
      }
      // Host fans out client PINGs to peer clients so userId / display-name
      // changes propagate across the whole mesh, not just to the host.
      if(mp.isHost && fromId>=0) broadcastMP(msg, fromId);
      updateLobbyUI();
      break;
    case 'PLAYER_NAME':
      setPlayerName(msg.id,msg.name);
      if(typeof msg.userId !== 'undefined') mp.userIds[msg.id] = msg.userId || null;
      if(mp.isHost) broadcastMP(JSON.stringify({type:'PLAYER_NAME',id:msg.id,name:playerDisplayName(msg.id),userId:mp.userIds[msg.id]||null}), fromId);
      break;
    case 'LOBBY_CFG':
      // Host announced a lobby setting (difficulty) before start; reflect it.
      if(!mp.isHost && DIFFICULTY[msg.difficulty]){ mp.hostDifficulty=msg.difficulty; updateLobbyUI(); }
      break;
    case 'GAME_START':
      if(!mp.isHost){
        if(msg.names) mp.names={...mp.names,...msg.names};
        if(msg.userIds) mp.userIds={...mp.userIds,...msg.userIds};
        if(DIFFICULTY[msg.difficulty]) mp.hostDifficulty=msg.difficulty;
        startAsClient(msg.spawnMap?.[mp.myId]||msg.spawnPos,msg.mapLayout);
      } break;
    case 'PLAYER_STATE': {
      let rp=mp.remotePlayers[msg.id];
      if(!rp){buildRemotePlayer(msg.id);rp=mp.remotePlayers[msg.id];}
      if(!rp) break;
      rp.pos.set(msg.x,0,msg.z);
      if(!rp.hasState){rp.renderPos.copy(rp.pos); rp.renderRot=msg.rot||0; rp.hasState=true;}
      rp.hp=msg.hp; rp.dead=msg.dead; rp.downed=!!msg.downed; rp.downedT=msg.downedT||0; rp.reviveT=msg.reviveT||0; rp.reviverCount=msg.reviverN||0; rp.rot=msg.rot;
      rp.lastSeen=performance.now();
      if(msg.name) setPlayerName(msg.id,msg.name);
      if(msg.meleeWeapon&&rp.meleeWeapon!==msg.meleeWeapon){
        rp.meleeWeapon=msg.meleeWeapon;
        setHeldMeleeModel(rp.mesh,msg.meleeWeapon);
      }
      if(msg.gun) rp.gun=msg.gun;
      rp.skills=msg.skills||rp.skills||{};
      rp.relics=msg.relics||rp.relics||{};
      if(msg.dsrc) rp.dsrc=msg.dsrc;
      if(typeof renderCursedRelicPanel==='function') renderCursedRelicPanel();
      rp.summons=msg.summons||rp.summons||{};
      if(mp.isHost&&msg.stats) mergeRemoteContribution(msg.id,msg.stats);
      if(mp.isHost) broadcastMP(JSON.stringify(msg), fromId);
      if(mp.isHost) checkTeamWipe();
      break;
    }
    case 'GUN_READY':
      if(mp.isHost) markGunReady(fromId>=0?fromId:msg.id, msg.gun||'pistol');
      break;
    case 'GUN_READY_STATE':
      if(!mp.isHost){
        mp.gunReady={...(msg.ready||{})};
        mp.gunPlayers=Array.isArray(msg.players)?msg.players:null;
        if(gState==='gunselect'&&!refreshGunSelectStatus()) showGunSelect();
      }
      break;
    case 'GUN_START':
      if(!mp.isHost){
        mp.gunReady={...(msg.guns||mp.gunReady)};
        // Apply each player's chosen gun locally so the firing rules /
        // remote-bullet visuals stay correct.
        for(const [id,gunId] of Object.entries(mp.gunReady)){
          if(+id===mp.myId){ player.gun=gunId; player.ammo=currentMagSize(); player.reloadDur=currentReloadTime(); }
          else if(mp.remotePlayers[id]){ mp.remotePlayers[id].gun=gunId; }
        }
        hideGunSelect();
        showMeleeSelect();
      }
      break;
    case 'MELEE_READY':
      if(mp.isHost) markMeleeReady(fromId>=0?fromId:msg.id,msg.weapon||'katana');
      break;
    case 'MELEE_READY_STATE':
      if(!mp.isHost){
        mp.meleeReady={...(msg.ready||{})};
        mp.meleePlayers=Array.isArray(msg.players)?msg.players:null;
        if(gState==='meleeselect'&&!refreshMeleeSelectStatus()) showMeleeSelect();
      }
      break;
    case 'MELEE_START':
      if(!mp.isHost){
        mp.meleeReady={...(msg.weapons||mp.meleeReady)};
        for(const [id,weapon] of Object.entries(mp.meleeReady)){
          if(+id===mp.myId) continue;
          const rp=mp.remotePlayers[id];
          if(rp){ rp.meleeWeapon=weapon; setHeldMeleeModel(rp.mesh,weapon); }
        }
        hideMeleeSelect();
        beginOpeningLoadoutOrWave();
      }
      break;
    case 'MELEE_ATTACK': {
      if(mp.isHost){
        performMeleeAttack(msg.weapon||'katana',{x:msg.x,z:msg.z,dx:msg.dx,dz:msg.dz,dmg:msg.dmg,range:msg.range,arc:msg.arc,lifeSteal:msg.lifeSteal,lifeStealCap:msg.lifeStealCap,guardBreakerRank:msg.guardBreakerRank,targetX:msg.targetX,targetZ:msg.targetZ,targetKind:msg.targetKind,ownerId:msg.id,visualOnly:false,relay:false});
        broadcastMP({type:'MELEE_VFX',id:msg.id,weapon:msg.weapon||'katana',x:msg.x,z:msg.z,dx:msg.dx,dz:msg.dz,range:msg.range,arc:msg.arc,targetX:msg.targetX,targetZ:msg.targetZ}, fromId);
      }
      break;
    }
    case 'MELEE_VFX':
      if(msg.id!==mp.myId) performMeleeAttack(msg.weapon||'katana',{x:msg.x,z:msg.z,dx:msg.dx,dz:msg.dz,range:msg.range,arc:msg.arc,targetX:msg.targetX,targetZ:msg.targetZ,targetKind:msg.targetKind,ownerId:msg.id,visualOnly:true,relay:false});
      break;
    case 'HOST_STATE':
      if(!mp.isHost){
        mp.lastHostSeen=performance.now();
        const prevWave=waveNum, prevClear=waveClear;
        if(Number.isFinite(msg.mapLayout)&&msg.mapLayout!==currentMapLayout){
          changeMapLayout(msg.mapLayout);
        }
        if(Number.isFinite(msg.mapHazardTime))mapHazardTime=Math.max(0,msg.mapHazardTime);
        applyHostEnemyState(msg.enemies);
        updateBossBarFromEnemies();
        applyHostEnemyBulletState(msg.enemyBullets);
        applyMiniObjectiveSnapshot(msg.objective);
        // Apply wave event snapshot. Clients track their own bounty (no-damage
        // / no-deaths fail locally) so server-side data only carries type/sub
        // and the announce/banner state.
        {
          const ev=msg.event||null;
          const wasType=waveEvent?waveEvent.type:null;
          if(ev){
            if(!waveEvent||waveEvent.type!==ev.type||waveEvent.sub!==ev.sub){
              waveEvent={type:ev.type,sub:ev.sub||null,complete:!!ev.complete,failed:false};
              if(wasType!==ev.type) setTimeout(announceWaveEvent,200);
            } else {
              waveEvent.complete=!!ev.complete;
              if(ev.failed) waveEvent.failed=true;
            }
          } else if(waveEvent){
            waveEvent=null;
            renderWaveEventBanner();
          }
        }
        applyWaveTotemSnapshot(msg.totem||null);
        if(msg.wave!==prevWave&&msg.wave>prevWave){
          currentBossTargetPoolIdx=null;
          updateBossBarFromEnemy(null);
          clearMapSpellsAndAllies();
          resetWaveContribution();
          annText(`⚡ LEVEL ${msg.wave}`,'#ffd700');
          mp.buffReady={};
          mp.buffPlayers=null;
          mp.buffStartQueued=false;
          resetExitReady();
          document.getElementById('buffSelect').style.display='none';
          closeRunShopUI(); setRunShopWorldVisible(false); setWaveTotemWorldVisible(false);
          closeExit();
          gState='playing';
          // A transient MP timeout earlier could have shown the menu overlay
          // and set gState='menu'. When the next wave message arrives we
          // restore gState='playing' but used to leave the menu DOM up,
          // creating the "blurred-but-playable" bug. Force-hide here.
          { const _m=document.getElementById('menu'); if(_m) _m.style.display='none'; }
          _waveEndSfxDone=false; // arm the clear fanfare for this new wave (client)
          musicStart(msg.wave, msg.wave%5===0); // client BGM: boss track on boss waves, normal otherwise (host triggers its own on boss spawn)
          // If a boss wave just started, capture the current shopTotemUses
          // count (synced via SHOP_TOTEM_STATE during the previous shop) as
          // bonus boss-reward picks BEFORE the next totem state broadcast
          // resets shopTotemUses to 0.
          if(msg.wave%5===0){
            const uses=Math.max(0,Math.min(SHOP_TOTEM_MAX_USES,shopTotemUses|0));
            bossBonusPicksLeft=SHOP_TOTEM_BONUS_CARDS[uses]||0;
            bossBonusRelicsLeft=SHOP_TOTEM_BONUS_RELICS[uses]||0;
          }
          player.pos.set(0, 0, ARENA_H-2);
          if(player.mesh){ player.mesh.position.x=0; player.mesh.position.z=ARENA_H-2; }
        }
        // Shop round owns its own exit lifecycle (opens in startRunShopRound,
        // closes in finishRunShopRound on each client locally). Don't let the
        // host's waveClear flag — which flips back to false when the host
        // walks through their own shop exit — yank the exit gate out from
        // under other clients who haven't reached it yet.
        if(gState!=='shopround'){
          if(msg.waveClear&&!prevClear){ resetExitReady(); reviveLocalForWaveClear(); awardGunKeysForWave(msg.wave); openExit(); }
          if(msg.waveClear&&!prevClear&&msg.contrib) showContributionPanel(msg.contrib,msg.wave);
          if(!msg.waveClear&&prevClear){ closeExit(); }
        }
        waveNum=msg.wave; score=msg.score; waveClear=msg.waveClear; waveSpawned=msg.waveSpawned;
        updateHUD();
      } break;
    case 'WARN_CIRCLE':
      spawnWarningCircle(msg.x,msg.z,msg.r,msg.col||0xff3355,msg.dur||0.75,null,false);
      break;
    case 'WARN_LINE':
      spawnWarningLine(msg.x,msg.z,msg.ang||0,msg.len||5,msg.width||0.7,msg.col||0xff3355,msg.dur||0.65,null,false);
      break;
    case 'CONTRIB_SNAPSHOT':
      showContributionPanel(msg.stats||{},msg.wave||waveNum);
      break;
    case 'BREAK_OBSTACLE': {
      const o=obstacleBoxes.find(b=>b.destructible&&!b._gone&&Math.hypot(b.x-msg.x,b.z-msg.z)<0.35);
      if(o) destroyObstacle(o,msg.col||0xffcc33,false);
      break;
    }
    case 'SUPERNOVA_CHARGE':
      if(!mp.isHost&&msg.targetId===mp.myId&&playerSkills.grenadeAscension)supernovaCharge.hit();
      break;
    case 'TRIAD_CHARGE':
      if(!mp.isHost&&msg.targetId===mp.myId&&playerSkills.burstAscension)celestialTriad.hit();
      break;
    case 'AK47_RELOAD_READY':
      if(!mp.isHost&&msg.targetId===mp.myId)armRifleReload();
      break;
    case 'RUPTURE_CHARGE':
      if(!mp.isHost&&msg.targetId===mp.myId&&playerSkills.shotgunAscension)ruptureCharge.hit();
      break;
    case 'RUPTURE':
      if(msg.perm?.shotgunAscension){
        if(mp.isHost){fireRupture(msg.x,msg.z,msg.dx,msg.dz,msg.dmg,msg.id,msg.perm,false);broadcastMP(msg,fromId);}
        else if(msg.id!==mp.myId)fireRupture(msg.x,msg.z,msg.dx,msg.dz,msg.dmg,msg.id,msg.perm,true);
      }
      break;
    case 'PISTOL_CHARGE':
      if(!mp.isHost&&msg.targetId===mp.myId&&playerSkills.pistolAscension)pistolJudgment.hit();
      break;
    case 'FIRE':
      if(mp.isHost){
        // Pass msg.gun so the host's local render of this remote shot uses
        // the right bullet visual; the host then re-broadcasts the same
        // msg.gun out to peers.
        fireBullet({x:msg.x,z:msg.z},_scratchDir.set(msg.dx,0,msg.dz),true,msg.dmg||25,msg.pierce||0,false,msg.perm||null,msg.id,msg.gun||'pistol',{supernova:!!msg.supernova,grenadePrimary:!!msg.grenadePrimary,grenadeQuick:!!msg.grenadeQuick,grenadeTravel:msg.grenadeTravel||0,gravityTravel:msg.gravityTravel,gravityCharge:msg.gravityCharge,delay:msg.delay||0,pistolShot:!!msg.pistolShot,pistolPrimary:!!msg.pistolPrimary,pistolLast:!!msg.pistolLast,pistolJudgment:!!msg.pistolJudgment,triad:!!msg.triad,burstSalvo:typeof msg.burstSalvo==='string'?msg.burstSalvo.slice(0,64):undefined,burstIndex:msg.burstIndex,shotgunSalvo:typeof msg.shotgunSalvo==='string'?msg.shotgunSalvo.slice(0,64):undefined,rupture:!!msg.rupture});
        if(!(msg.delay>0)) burst({x:msg.x,z:msg.z},PLAYER_COLORS[msg.id%MAX_PLAYERS].body,isMobile?2:4);
        playRemoteGunSfx(msg.gun||'pistol');
        broadcastMP(JSON.stringify(msg), fromId); // forward to all other clients
      } else if(msg.id !== mp.myId){
        fireBullet({x:msg.x,z:msg.z},_scratchDir.set(msg.dx,0,msg.dz),true,msg.dmg||25,msg.pierce||0,true,msg.perm||null,msg.id,msg.gun||'pistol',{supernova:!!msg.supernova,grenadePrimary:!!msg.grenadePrimary,grenadeQuick:!!msg.grenadeQuick,grenadeTravel:msg.grenadeTravel||0,gravityTravel:msg.gravityTravel,gravityCharge:msg.gravityCharge,delay:msg.delay||0,pistolShot:!!msg.pistolShot,pistolPrimary:!!msg.pistolPrimary,pistolLast:!!msg.pistolLast,pistolJudgment:!!msg.pistolJudgment,triad:!!msg.triad,burstSalvo:typeof msg.burstSalvo==='string'?msg.burstSalvo.slice(0,64):undefined,burstIndex:msg.burstIndex,shotgunSalvo:typeof msg.shotgunSalvo==='string'?msg.shotgunSalvo.slice(0,64):undefined,rupture:!!msg.rupture});
        if(!(msg.delay>0)) burst({x:msg.x,z:msg.z},PLAYER_COLORS[msg.id%MAX_PLAYERS].body,isMobile?2:4);
        playRemoteGunSfx(msg.gun||'pistol');
      }
      break;
    case 'GUN_SPECIAL': {
      const gun=GUNS[msg.gun]||GUNS.pistol;
      const mods={spread:msg.spread||0,heavyRounds:msg.heavyRounds||0,explosive:msg.explosive||0,charge:msg.charge||0};
      if(mp.isHost){
        applySpecialGunFire(gun,msg.x,msg.z,msg.dx,msg.dz,msg.dmg||20,msg.id,false,false,msg.perm||null,mods);
        playRemoteGunSfx(msg.gun||'pistol');
        broadcastMP(JSON.stringify(msg), fromId);
      } else if(msg.id!==mp.myId){
        applySpecialGunFire(gun,msg.x,msg.z,msg.dx,msg.dz,msg.dmg||20,msg.id,true,false,msg.perm||null,mods);
        playRemoteGunSfx(msg.gun||'pistol');
      }
      break;
    }
    case 'AFTERIMAGE_ZONE': {
      const lvl=Math.max(1,Math.min(5,msg.lvl|0));
      if(mp.isHost){
        if(msg.id!==mp.myId){
          spawnAfterimageCharge(msg.x,msg.z,lvl,{relay:false});
          broadcastMP(JSON.stringify({type:'AFTERIMAGE_ZONE',id:msg.id,x:msg.x,z:msg.z,lvl}), fromId);
        }
      } else if(msg.id!==mp.myId){
        spawnAfterimageCharge(msg.x,msg.z,lvl,{visualOnly:true,relay:false});
      }
      break;
    }
    case 'BLINK_STRIKE': {
      const lvl=Math.max(1,Math.min(5,msg.lvl|0));
      if(mp.isHost){
        if(msg.id!==mp.myId){
          performBlinkStrike(msg.x,msg.z,lvl,{relay:false});
          broadcastMP(JSON.stringify({type:'BLINK_STRIKE',id:msg.id,x:msg.x,z:msg.z,lvl}), fromId);
        }
      } else if(msg.id!==mp.myId){
        performBlinkStrike(msg.x,msg.z,lvl,{visualOnly:true,relay:false});
      }
      break;
    }
    case 'DASH_GHOST': {
      const id=Number.isFinite(msg.id)?msg.id:+msg.id;
      if(id===mp.myId) break;
      if(mp.isHost){
        spawnDashGhost(msg.x,msg.z,msg.rot||0,id,false);
        broadcastMP(JSON.stringify({type:'DASH_GHOST',id,x:msg.x,z:msg.z,rot:msg.rot||0}), fromId);
      } else {
        spawnDashGhost(msg.x,msg.z,msg.rot||0,id,false);
      }
      playRemoteDashSfx(id);
      break;
    }
    case 'KILL_ENEMY': {
      if(mp.isHost) broadcastMP(JSON.stringify(msg), fromId);
      const idx=enemies.findIndex(e=>e.poolIdx===msg.pidx&&!e.dead);
      if(idx!==-1) killEnemy(idx,true); break;
    }
    case 'HURT':
      if(mp.isHost){
        if(msg.targetId===mp.myId) hurtPlayer(msg.dmg);
        else { const c=mp.conns.get(msg.targetId); if(c&&c.open) c.send(JSON.stringify(msg)); }
      } else {
        if(msg.targetId===mp.myId) hurtPlayer(msg.dmg);
      }
      break;
    case 'HEAL':
      if(mp.isHost){
        if(msg.targetId===mp.myId) healPlayer(msg.amount||0);
        else { const c=mp.conns.get(msg.targetId); if(c&&c.open) c.send(JSON.stringify(msg)); }
      } else if(msg.targetId===mp.myId){
        const gained=healPlayer(msg.amount||0);
        if(gained) dmgNum('+'+gained+' HP',player.pos,msg.color||'#ff6688');
      }
      break;
    case 'REVIVE_TOUCH':
      if(msg.targetId===mp.myId){
        player.lastReviveTouch=performance.now();
      } else if(mp.isHost){
        const c=mp.conns.get(msg.targetId);
        if(c&&c.open) c.send(JSON.stringify(msg));
      }
      break;
    case 'BUFF_READY':
      if(mp.isHost&&msg.wave===waveNum) markBuffReady(fromId);
      break;
    case 'BUFF_READY_STATE':
      if(!mp.isHost&&msg.wave===waveNum){
        mp.buffReady={...(msg.ready||{})};
        mp.buffPlayers=Array.isArray(msg.players)?msg.players:null;
        if(gState==='buffwait') showBuffWaiting();
      }
      break;
    case 'RUN_SHOP_START':
      if(!mp.isHost&&msg.wave===waveNum){
        mp.buffReady={};
        mp.buffPlayers=null;
        mp.buffStartQueued=false;
        resetExitReady();
        document.getElementById('buffSelect').style.display='none';
        startRunShopRound();
      }
      break;
    case 'EXIT_READY':
      if(mp.isHost&&msg.wave===waveNum) markExitReady(fromId,msg.mode||'wave');
      break;
    case 'EXIT_READY_STATE':
      if(!mp.isHost&&msg.wave===waveNum){
        mp.exitReady={...(msg.ready||{})};
        mp.exitPlayers=Array.isArray(msg.players)?msg.players:null;
        mp.exitMode=msg.mode||mp.exitMode||'wave';
        updateExitReadyPrompt();
      }
      break;
    case 'EXIT_GO':
      if(!mp.isHost&&msg.wave===waveNum) completeExitTransition(msg.mode||'wave');
      break;
    case 'SHOP_TOTEM_CLICK':
      if(mp.isHost&&msg.wave===waveNum) activateShopTotem();
      break;
    case 'SHOP_TOTEM_STATE':
      if(!mp.isHost&&msg.wave===waveNum) syncShopTotemState(msg);
      break;
    case 'WAVE_TOTEM_ACCEPT':
      if(mp.isHost&&msg.wave===waveNum&&msg.id===_waveTotemOfferId) activateWaveTotem();
      break;
    case 'WAVE_TOTEM_STATE':
      if(!mp.isHost) applyWaveTotemSnapshot(msg.state||msg);
      break;
    case 'REMATCH_READY':
      if(mp.isHost) markRematchReady(fromId);
      break;
    case 'REMATCH_READY_STATE':
      if(!mp.isHost){
        mp.rematchReady={...(msg.ready||{})};
        mp.rematchPlayers=Array.isArray(msg.players)?msg.players:null;
        if(gState==='rematchwait') showRematchWaiting();
      }
      break;
    case 'GOLD_DROP':
      if(greedyCrownBlocksMe() && greedyCrownActiveScope()==='all') break;
      grantGold(Number.isFinite(msg.baseAmount)?enemyGoldAmount(msg.baseAmount,msg.teamMultiplier??1):msg.amount, player.pos, 'coop_drop', { source:'remote_drop' });
      break;
    case 'HEAL_BAG_SPAWN':
      spawnHealBag(msg.x, msg.z, msg.pct, msg.id, true);
      // Host echoes spawn to other peers so non-host kills (or future sources) propagate
      if(mp.isHost) broadcastMP(msg, fromId);
      break;
    case 'HEAL_BAG_PICKUP':
      removeHealBagById(msg.id);
      if(mp.isHost) broadcastMP(msg, fromId);
      break;
    case 'BUFF_DROP_SPAWN':
      spawnBuffDrop(msg.x, msg.z, msg.t, msg.id, true);
      if(mp.isHost) broadcastMP(msg, fromId);
      break;
    case 'BUFF_DROP_PICKUP':
      removeBuffDropById(msg.id);
      if(mp.isHost) broadcastMP(msg, fromId);
      break;
    case 'GAME_OVER_ALL':
      document.getElementById('deadOverlay').style.display='none';
      if(gState==='playing') gameOver(); break;
    case 'WAVE_CLEAR_REVIVE':
      reviveLocalForWaveClear();
      break;
  }
}

function startAsClient(spawnPos,mapLayout=0){
  resetGameplayInput();
  player.gravityExhaustion=0;
  player._regenAcc=0;
  player._curseHpPct=0;player._curseHpWaves=0;
  runGeneration++;
  pistolPrecision.reset();
  pistolJudgment.reset();
  shotgunSalvos.reset();
  ruptureCharge.reset();
  ak47Rhythm.reset();
  steelStorm.reset();
  burstSalvos.reset();burstOpening.reset();celestialTriad.reset();grenadePrimer.reset();supernovaCharge.reset();
  runScore.begin();
  // Clear any stale input state from the previous run. If the player held LMB
  // or a movement key when game-over fired, the corresponding browser
  // mouseup/keyup may have been swallowed (modal focus, tab blur), leaving
  // `mouse.down=true` or a stuck `keys[...]` entry. That would carry over and
  // either lock firing or move the player on its own next run.
  mouse.down=false;
  for(const k of Object.keys(keys)) delete keys[k];
  _dashTapped=false; _spellTapped=false;
  for(const b of bulletPool) if(b.active) releaseBullet(b);
  resetWaveContribution();
  enemies.forEach(e=>{e.dead=true;releaseEnemySlot(e);}); enemies.length=0;
  _waveSpawnQueue.length=0; _waveSpawnTimer=0;
  for(const p of partPool){if(p.active){p.active=false;p.mesh.visible=false;}}
  for(const s of spellBalls) if(s.active){s.active=false;s.mesh.visible=false;clearTrail(s.trail);}
  for(let i=damageRings.length-1;i>=0;i--){ _releaseDamageRingSlot(damageRings[i]); }
  damageRings.length=0;
  for(let i=homingBombs.length-1;i>=0;i--){ _releaseHomingBombSlot(homingBombs[i]); }
  homingBombs.length=0;
  for(let i=afterimageZones.length-1;i>=0;i--){
    const z=afterimageZones[i];
    scene.remove(z.mesh); z.mesh.geometry.dispose(); z.mat.dispose();
  }
  afterimageZones.length=0;
  clearSummons();
  Object.keys(playerSkills).forEach(k=>delete playerSkills[k]);
  Object.keys(playerSkillPicks).forEach(k=>delete playerSkillPicks[k]);
  Object.keys(skillWeights).forEach(k=>delete skillWeights[k]);
  resetRelics();
  resetLegendaryTimers();
  const _pu=persistData.upgrades;
  playerStats.baseMaxHp=MAX_HP+PERM_HP_BONUS[_pu.hp||0];
  recalcPlayerMaxHp(false);
  playerStats.attackDmg=Math.round(25*Math.round(100*PERM_DMG_MULT[_pu.dmg||0])/100);
  setupRunPerms();
  const sp=spawnPos||SPAWN_POS[mp.myId%MAX_PLAYERS];
  player.pos.set(sp[0],0,sp[1]); player.hp=playerStats.maxHp; player.maxHp=playerStats.maxHp; player.overhealShield=0; player._bloodGrowthHp=0; player.dead=false;
  player.downed=false; player.downedT=0; player.reviveT=0; player.lastReviveTouch=0;
  player.fireCd=0; player.minigunSpin=0; player.railCharge=0; player.railChargeSfxT=0; player.railMaxFx=false; player.railWasCharging=false; player.gun='pistol'; player.invincible=0; player.barrierActive=false; player.barrierCd=0;
  player.ammo=currentMagSize(); player.reloadT=0; player.reloadDur=currentReloadTime();
  player.dashCd=0; player.dashT=0; player.dashKinetic=0; player.kineticCharge=0; player.speedBoostT=0; player.repairPulseCd=0; player.meleeDashSpeed=0; player.meleeDashSpecial=false; player.hookSwingT=0; player.hookSwingMode=''; player.hookOrbitDir=0; player.hookWallBuffer=0; player.hookInertiaT=0;
  disposeActiveHookRope();
  if(player.moveTrail) clearTrail(player.moveTrail);
  player.spellCd=0; player.fireRingCd=0; player.homingBombCd=0; player.stormCallCd=0;
  player.meleeWeapon='katana'; player.meleeCd=0;
  initGhostPool();
  buildPlayer();
  nbDifficulty = mp.hostDifficulty || 'hard';
  waveNum=0; score=0; killCount=0; streak=0; streakT=0;
  resetRunStats();
  runCrystals=0; runShopRerollCost=RUN_SHOP_REROLL_BASE; runShopDoneWave=0; runShopCards=[]; runShopPurchases={}; runGunKeyAwards={}; bossBonusPicksLeft=0; bossBonusRelicsLeft=0;
  waveClear=false; waveSpawned=false; waveTransition=false; waveEnemyTotal=0; waveFightTime=0;
  waveEvent=null; _eventBonusPicksLeft=0; _eventEpicReward=false; _challengeRewardPending=false; _cursedShrinePending=false; _waveTotemOfferPending=false; _waveTotemOfferId=null; _waveTotemAccepted=false; _pendingTotemMod=null; _activeTotemMod=null; if(player){player._curseHpPct=0;player._curseHpWaves=0;} resetWaveEventTracking(); renderWaveEventBanner();
  _bossClearPending=false; _firstSkillPickDone=false; currentBossTargetPoolIdx=null;
  disposeMiniObjective();
  mp.syncT=0; mp.hostSyncT=0; mp.buffReady={}; mp.buffPlayers=null; mp.buffStartQueued=false;
  mp.exitReady={}; mp.exitPlayers=null; mp.exitStartQueued=false; mp.exitMode='';
  mp.gunReady={}; mp.gunPlayers=null; mp.gunStartQueued=false;
  mp.meleeReady={}; mp.meleePlayers=null; mp.meleeStartQueued=false;
  mp.rematchReady={}; mp.rematchPlayers=null; mp.rematchStartQueued=false;
  changeMapLayout(Number.isFinite(mapLayout)?mapLayout:0);
  gState='playing';
  document.getElementById('menu').style.display='none';
  document.getElementById('gameover').style.display='none';
  document.getElementById('deadOverlay').style.display='none';
  document.getElementById('buffSelect').style.display='none';
  document.getElementById('meleeSelect').style.display='none';
  const _gunSel=document.getElementById('gunSelect'); if(_gunSel) _gunSel.style.display='none';
  closeRunShopUI(); setRunShopWorldVisible(false); setWaveTotemWorldVisible(false);
  document.getElementById('bossBar').style.display='none';
  document.getElementById('exitArrow').style.display='none';
  document.getElementById('spellCd').style.display='none';
  document.getElementById('ringCd').style.display='none';
  document.getElementById('bombCd').style.display='none';
  document.getElementById('stormCd').style.display='none';
  document.getElementById('lightningCd').style.display='none';
  document.getElementById('spellBtn').style.display='none';
  document.getElementById('turretCdEl').style.display='none';
  document.getElementById('droneCdEl').style.display='none';
  document.getElementById('shieldBotCdEl').style.display='none';
  document.getElementById('sentinelCdEl').style.display='none';
  document.getElementById('repairCdEl').style.display='none';
  document.getElementById('summonSep').style.display='none';
  document.getElementById('hud').style.display='block';
  if(realIsMobile){ for(const _tb of ['dashBtn','meleeBtn','useBtn']) document.getElementById(_tb).style.display='flex'; } // re-show after a disconnect hid them
  camera.position.set(0, CAM_Y, ARENA_H-2+CAM_Z_OFF); camera.lookAt(0,0,ARENA_H-2);
  refreshHP(); updateHUD(); updateSkillHUD(); updateGoldHud(); updateCrystalHud();
  // Gun pick precedes melee pick — once gun-all-ready fires, the GUN_START
  // broadcast flows the lobby into showMeleeSelect for everyone.
  showGunSelect();
}

// The room module owns peers and timers. The coordinator owns UI/entities.
const { hostGame, joinGame, leaveRoom, notifyRoomExit } = createRoomLifecycle({
  mp, maxPlayers: MAX_PLAYERS, getPeerConfig,
  createPeer: (...args) => new Peer(...args),
  transport: { broadcastMP, sendToHost },
  identity: {
    name: getLocalPlayerName, userId: getLocalUserId,
    cleanName: cleanPlayerName, displayName: playerDisplayName,
  },
  players: {
    build: buildRemotePlayer, remove: removeRemotePlayer,
    disconnected: removeDisconnectedPlayer, handleMessage: handleIncomingMP,
    blankContribution, broadcastName: broadcastNameUpdate,
  },
  ui: {
    status: setMpStatus, refresh: updateLobbyUI, reconnect: showReconnectToast,
    disconnected: returnToMenuAfterDisconnect,
    clearInput: () => { document.getElementById('roomInput').value=''; },
  },
  isDifficulty: difficulty => !!DIFFICULTY[difficulty],
  beforeLeave: () => recordRunScore('leave'),
});

function returnToMenuAfterDisconnect(status='Disconnected'){
  recordRunScore('disconnect');
  hideReviveUI();
  hideContributionPanel();
  const _brs=document.getElementById('bossRunSummary'); if(_brs){ _brs.classList.remove('show'); _brs.innerHTML=''; }
  document.getElementById('hud').style.display='none';
  document.getElementById('gameover').style.display='none';
  document.getElementById('deadOverlay').style.display='none';
  document.getElementById('buffSelect').style.display='none';
  document.getElementById('meleeSelect').style.display='none';
  const _gunSel=document.getElementById('gunSelect'); if(_gunSel) _gunSel.style.display='none';
  closeRunShopUI(); setRunShopWorldVisible(false); setWaveTotemWorldVisible(false);
  document.getElementById('bossBar').style.display='none';
  document.getElementById('exitArrow').style.display='none';
  document.getElementById('menu').style.display='flex';
  nbMenuScreen(mp && mp.connected ? 'MP' : 'Main');
  document.getElementById('spellBtn').style.display='none';
  document.getElementById('dashBtn').style.display='none';
  document.getElementById('meleeBtn').style.display='none';
  document.getElementById('useBtn').style.display='none';
  gState='menu';
  playBgm('menu');
  leaveRoom(status);
}

// ── Roguelike buff selection ──────────────────────────────
let _buffSelectPhase='status';
// Pick-chain state for the Lucky Streak (legendary) + Lucky Draw (epic) luck skills.
// _currentOffering holds the skill IDs shown on screen; _offeringPicked tracks which
// ones the player has already taken from this offering (consumed). When the offering
// is exhausted or pickStreak fails, luckyDraw rolls to refresh the offering.
let _currentOffering=[];
const _offeringPicked=new Set();
let _luckyDrawUsed=false;
let _rewardPickCount=0;
// _relicFateExtras counts how many EXTRA picks the offer chain still owes.
// L1 success → 1 extra (2 total picks), L2 → 2 extras (3 total), L3 → 3 extras
// (4 total). _relicFateSkip wipes the whole reward when the chance fails.
let _relicFateActive=false, _relicFateExtras=0, _relicFateSkip=false;
function _resetPickChain(){ _currentOffering=[]; _offeringPicked.clear(); _luckyDrawUsed=false; }
function _resetFateRollOnly(){ _relicFateActive=false; _relicFateExtras=0; _relicFateSkip=false; }
function _resetRelicPickState(){ _rewardPickCount=0; _resetFateRollOnly(); }
function _resetOfferingOnly(){ _currentOffering=[]; _offeringPicked.clear(); }
function _phaseUsesFateGambit(phase){ return phase==='skill'||phase==='boss'; }
function _ensureRelicPickState(phase){
  if(_relicFateActive||!hasRelic('fateGambit')||!_phaseUsesFateGambit(phase)) return;
  _relicFateActive=true;
  const lvl=relicLevel('fateGambit');
  const successChance = RELIC_LEVELS.fateGambit.successChance[lvl] || 0;
  const cardCount     = RELIC_LEVELS.fateGambit.cardCount[lvl]     || 1;
  if(Math.random() >= successChance){
    _relicFateSkip = true;
  } else {
    // Subtract 1 because the normal offer counts as the first card.
    _relicFateExtras = Math.max(0, cardCount - 1);
  }
}
function _recordRewardPick(){ _rewardPickCount++; }
// Source of the *next* skill-pick offer — set by the caller before
// showBuffSelect('skill') so the title can reflect why the card is being
// offered. Reset to 'wave' after each pick so a stale source can't leak
// into the next wave's normal reward.
let _skillPickContext='wave';
const SKILL_PICK_TITLES={
  wave:      { title:'WAVE CLEAR REWARD',     sub:'CHOOSE A SKILL' },
  loot:      { title:'LOOT WAVE REWARD',      sub:'BONUS CARD FROM LOOT WAVE' },
  doublePick:{ title:'DOUBLE PICK',           sub:'KEEP A SECOND CARD FROM THIS OFFERING' },
  mini:      { title:'OBJECTIVE REWARD',      sub:'BONUS CARD FOR COMPLETING THE OBJECTIVE' },
  bounty:    { title:'BOUNTY REWARD',         sub:'BONUS CARD FOR WINNING THE BOUNTY' },
  challenge: { title:'CHALLENGE REWARD',      sub:'BONUS CARD FROM THE CHALLENGE WAVE' },
  streak:    { title:'LUCKY STREAK',          sub:'EXTRA CARD FROM YOUR LUCKY STREAK' },
  draw:      { title:'LUCKY DRAW',            sub:'OFFERING REFRESHED — PICK AGAIN' },
  fate:      { title:'FATE GAMBIT',           sub:'EXTRA CARD FROM FATE GAMBIT' },
  opening:   { title:'OPENING LOADOUT',       sub:'CHOOSE YOUR STARTING SKILL' },
};
// Returns true if the chain continued (showBuffSelect was re-invoked) — caller should
// then NOT call afterBuffSelect / hide UI. Returns false if the chain ended.
function _continuePickChain(phase){
  // Double Pick bonus event: the wave-clear skill offering lets you KEEP TWO of
  // its three cards. Grant exactly one extra pick from the SAME offering (the
  // first pick is filtered out on re-render), once per wave. Runs before the
  // Fate Gambit/streak rolls so the "2 of the same 3" set is preserved rather
  // than getting refreshed out from under the player.
  if(waveEvent && waveEvent.type==='doublePick' && !waveEvent._doublePickUsed){
    const remainingDP=_currentOffering.filter(x => !_offeringPicked.has(x));
    if(remainingDP.length>0){
      waveEvent._doublePickUsed=true;
      annText('DOUBLE PICK','#ffd166');
      _skillPickContext='doublePick';
      showBuffSelect(phase);
      return true;
    }
  }
  // Fate Gambit chain comes FIRST — it can grant 1-3 extra picks per level
  // and runs before the regular reward-cap so a level-3 Fate Gambit can
  // actually deliver all 4 cards even if _rewardPickCount has climbed.
  if(_relicFateExtras>0){
    _relicFateExtras--;
    _resetOfferingOnly();
    annText('FATE GAMBIT','#ffee77');
    _skillPickContext='fate';
    showBuffSelect(phase);
    return true;
  }
  if(_rewardPickCount>=3){
    _resetPickChain();
    _resetFateRollOnly();
    return false;
  }
  const remaining = _currentOffering.filter(x => !_offeringPicked.has(x));
  const streakChance = PICK_STREAK_CHANCE[playerSkills.pickStreak||0] || 0;
  // Streak: pick another card from the SAME offering (no refresh).
  if(remaining.length>0 && streakChance>0 && Math.random()<streakChance){
    annText('LUCKY STREAK','#ffee77');
    _skillPickContext='streak';
    showBuffSelect(phase);
    return true;
  }
  // Offering exhausted or streak failed — roll luckyDraw to refresh.
  const luckyChance = LUCKY_DRAW_CHANCE[playerSkills.luckyDraw||0] || 0;
  if(!_luckyDrawUsed && luckyChance>0 && Math.random()<luckyChance){
    _luckyDrawUsed=true;
    _resetOfferingOnly();
    annText('LUCKY DRAW','#ffee77');
    _skillPickContext='draw';
    showBuffSelect(phase);
    return true;
  }
  _resetPickChain();
  _resetFateRollOnly();
  return false;
}

function getSkillChoices(){
  // Normal-wave picks: epic / legendary CAN appear, but at the very low rates set by
  // RARITY_INFO weights (~5% chance of an epic per offering, ~1% of a legendary).
  // If no epic / legendary roll succeeds, this falls back to weighted common/uncommon/rare naturally.
  // Mutation Wave event widens the *first* offer this wave to 5 cards. The
  // _mutationConsumed flag prevents bonus-pick re-opens from also showing 5.
  const isMut = eventMutationActive() && !(waveEvent && waveEvent._mutationConsumed);
  if(isMut && waveEvent) waveEvent._mutationConsumed=true;
  return weightedSkillPick(isMut ? 5 : 3);
}

function getFirstSkillChoices(){
  return weightedSkillPick(3,{maxRarity:'rare',fallbackMaxRarity:'legendary'});
}

function getBossSkillChoices(){
  const bossIndex=Math.max(1,Math.floor(waveNum/5));
  // Per-card legendary chance: 10% at boss 1, +5% per boss tier (wave 5 →
  // 10%, wave 10 → 15%, wave 15 → 20%, …) capped at 30%. luckyDebt relic
  // adds another +10% on top.
  // Previously the whole offering rolled ONCE — either all-legendary or
  // all-epic. Now EACH of the 4 (or 5 w/ heavyCrown) slots rolls on its
  // own, so a player can see a mix like "2 legendary + 2 epic" in one
  // offering instead of homogenous slates.
  const baseChance=Math.min(0.30,0.10+(bossIndex-1)*0.05);
  const legendaryChance=hasRelic('luckyDebt')?Math.min(0.50,baseChance+0.10):baseChance;
  const offerCount = 4 + (hasRelic('heavyCrown') ? (RELIC_LEVELS.heavyCrown.bossPickBonus[relicLevel('heavyCrown')]||1) : 0);
  const chosen=[];
  const hasDivine=Object.keys(SKILL_DEFS).some(id=>skillEligible(id)&&skillRarity(id)==='divine'&&skillPickLevel(id)<skillMaxLevel(id));
  for(let slot=0;slot<offerCount;slot++){
    if(hasDivine&&Math.random()<Math.min(.03,.01*bossIndex)){
      const divine=weightedSkillPick(1,{onlyRarity:'divine',exclude:chosen});
      if(divine.length){chosen.push(divine[0]);continue;}
    }
    const primary=Math.random()<legendaryChance?'legendary':'epic';
    const fallback=primary==='legendary'?'epic':'legendary';
    let pick=weightedSkillPick(1,{onlyRarity:primary,exclude:chosen});
    if(!pick.length) pick=weightedSkillPick(1,{onlyRarity:fallback,exclude:chosen});
    if(!pick.length) break; // both pools exhausted (rare — player maxed everything)
    chosen.push(pick[0]);
  }
  return chosen;
}

function getRelicChoices(n=3){
  // Normal relic pool — cursed relics are mixed in here (no longer shrine-only).
  // Every relic (cursed included) has 3 levels and is eligible until maxed.
  const pool=Object.keys(RELIC_DEFS).filter(id=>relicLevel(id)<3);
  const choices=[];
  while(choices.length<n&&pool.length){
    const idx=Math.floor(Math.random()*pool.length);
    choices.push(pool[idx]);
    pool.splice(idx,1);
  }
  return choices;
}
function getCursedRelicChoices(n=3){
  const pool=Object.keys(RELIC_DEFS).filter(id=>RELIC_DEFS[id].cursed && relicLevel(id)<3);
  const choices=[];
  while(choices.length<n&&pool.length){
    const idx=Math.floor(Math.random()*pool.length);
    choices.push(pool[idx]);
    pool.splice(idx,1);
  }
  return choices;
}
// Resolve the description string for the relic at its NEXT level (the one
// you'd receive if you picked it now). Falls back to RELIC_DEFS.desc for
// any relic that hasn't been migrated to RELIC_LEVELS yet.
function relicNextDesc(id){
  const cur=relicLevel(id);
  const next=Math.min(3,cur+1);
  const lvData=RELIC_LEVELS[id];
  if(lvData && lvData.desc && lvData.desc[next]) return lvData.desc[next];
  return RELIC_DEFS[id]?.desc || '';
}
function relicDisplayName(id){
  const cur=relicLevel(id), next=Math.min(3,cur+1);
  const base=RELIC_DEFS[id]?.name || id;
  if(next>1) return base + ' '+['','I','II','III'][next];
  return base;
}

function completeBossReward(){
  bossBonusPicksLeft=0;
  bossBonusRelicsLeft=0;
  _resetPickChain();
  _resetRelicPickState();
  const el=document.getElementById('buffSelect');
  if(el) el.style.display='none';
  openExit();
  gState='playing';
  // Defensive menu hide — see same-named fix in HOST_STATE handler.
  { const _m=document.getElementById('menu'); if(_m) _m.style.display='none'; }
}

function continueTotemBossRewards(){
  if(_rewardPickCount>=3) bossBonusPicksLeft=0;
  if(bossBonusPicksLeft>0){
    bossBonusPicksLeft--;
    _resetPickChain();
    _resetFateRollOnly();
    annText(bossBonusPicksLeft>0
      ? `★ BOSS BONUS — ${bossBonusPicksLeft+1} PICKS LEFT`
      : '★ BOSS BONUS — FINAL PICK',
      '#ff3344');
    showBuffSelect('boss');
    return true;
  }
  if(bossBonusRelicsLeft>0){
    _resetPickChain();
    _resetFateRollOnly();
    showRelicSelect();
    return true;
  }
  return false;
}

function showRelicSelect(){
  _buffSelectPhase='relic';
  gState='buffselect';
  const el=document.getElementById('buffSelect');
  const title=document.getElementById('buffTitle');
  const sub=document.getElementById('buffSubtitle');
  const cards=document.getElementById('buffCards');
  if(!el||!cards) return completeBossReward();
  el.style.display='flex';
  cards.classList.remove('choosing-card');
  cards.innerHTML='';
  const choices=getRelicChoices(3);
  if(!choices.length) return completeBossReward();
  title.textContent='TOTEM RELIC';
  sub.textContent=bossBonusRelicsLeft>1
    ? `CHOOSE A RELIC — ${bossBonusRelicsLeft} RELICS LEFT`
    : 'CHOOSE A RELIC';
  choices.forEach((id,i)=>{
    const def=RELIC_DEFS[id];
    const cat=def.cursed?'CURSED RELIC':'RELIC - TOTEM';
    const card=document.createElement('div');
    card.className='buff-card boss-buff-card';
    card.style.setProperty('--cat-color','#ff3344');
    card.style.animationDelay=`${i*70}ms, ${340+i*70}ms`;
    card.innerHTML=`
      <div class="buff-card-cat">${cat}</div>
      ${cardIconHtml(id,def.icon)}
      <div class="buff-card-name">${relicDisplayName(id)}</div>
      <div class="buff-card-desc">${hl(relicNextDesc(id))}</div>`;
    card.addEventListener('click',()=>pickCardWithFx(card,()=>{
      applyRelic(id);
      bossBonusRelicsLeft=Math.max(0,bossBonusRelicsLeft-1);
      annText(relicDisplayName(id),'#ff3344');
      updateHUD();
      updateSkillHUD();
      if(bossBonusRelicsLeft>0) showRelicSelect();
      else completeBossReward();
    }));
    cards.appendChild(card);
  });
}

function addRerollButton(cards, phase){
  if(runRerolls<=0) return;
  const btn=document.createElement('button');
  btn.type='button';
  btn.className='buff-reroll-btn';
  btn.textContent=`🎲 REROLL (${runRerolls})`;
  btn.addEventListener('click',(ev)=>{
    ev.preventDefault();
    ev.stopPropagation();
    if(gState!=='buffselect'||cards.classList.contains('choosing-card')) return;
    if(runRerolls<=0) return;
    playSample('reroll');
    const free=hasRelic('gamblerChip')&&Math.random()<(RELIC_LEVELS.gamblerChip.freeChance[relicLevel('gamblerChip')]||0);
    if(!free) runRerolls--;
    else annText('FREE REROLL','#ffee77');
    _resetPickChain();
    showBuffSelect(phase);
  });
  cards.appendChild(btn);
}

function shouldOpenRunShopAfterWave(){
  return waveNum>0 && waveNum%5===4 && runShopDoneWave!==waveNum;
}
function rollRunShopCards(){
  const result=[];
  const rarityWeights=[
    ['common',42],['uncommon',28],['rare',18],['epic',9],['legendary',3],['divine',.3],
  ];
  // Black Market (economy rare): +N extra cards per offer.
  const offerCount=RUN_SHOP_OFFER_COUNT+(SHOP_OFFER_BONUS[playerSkills.shopOffer||0]||0);
  let guard=0;
  while(result.length<offerCount && guard++<80){
    const weights=rarityWeights.map(([key,w])=>{
      if(!hasRelic('luckyDebt')) return [key,w];
      if(key==='rare') return [key,w*1.25];
      if(key==='epic') return [key,w*2.2];
      if(key==='legendary') return [key,w*3.0];
      return [key,w];
    });
    let r=Math.random()*weights.reduce((a,b)=>a+b[1],0), rarity='common';
    for(const [key,w] of weights){
      if(r<=w){ rarity=key; break; }
      r-=w;
    }
    let pool=Object.keys(SKILL_DEFS).filter(id=>skillEligible(id)&&skillRarity(id)===rarity && skillPickLevel(id)<skillMaxLevel(id) && !result.includes(id));
    if(!pool.length) pool=Object.keys(SKILL_DEFS).filter(id=>skillEligible(id)&&skillPickLevel(id)<skillMaxLevel(id) && !result.includes(id));
    if(!pool.length) break;
    result.push(pool[Math.floor(Math.random()*pool.length)]);
  }
  runShopCards=result;
}
// Shop-round index (1, 2, 3 for the wave 4 / 9 / 14 shops). Each later shop
// charges proportionally more so crystals saved early aren't trivially
// powerful late.
function runShopRoundIndex(){
  return Math.max(1, Math.floor((waveNum||0)/5) + 1);
}
// Party-size multiplier. Enemy spawn count scales by playerBalance().count
// (0.70 solo → 1.36 with 4 players → up to 1.66 with 6). Since every player
// gets their own copy of every crystal drop, per-player income scales with
// the same factor. Dividing by the solo value (0.70) normalises so solo runs
// pay the listed base prices and larger parties pay proportionally more.
function runShopPlayerMult(){
  const bal=playerBalance();
  const solo=PLAYER_COUNT_BALANCE[1];
  if(!bal||!solo) return 1;
  return bal.count/solo.count;
}
function runShopCardPrice(id){
  const rarity=skillRarity(id);
  const base=RUN_SHOP_RARITY_PRICE[rarity]||20;
  const purchases=runShopPurchases[id]||0;
  // Doubling per repeat purchase IN THIS RUN. Boss-reward / opening-loadout
  // picks don't bump this — only shop buys do — so picking the same card
  // outside the shop never silently inflates the shop price.
  const stackMult=Math.pow(2,purchases);
  // Frugal Trader (economy rare): flat percentage discount applied AFTER
  // every other modifier. Capped just under 100% so prices can never hit 0.
  const discount=Math.min(0.95, SHOP_DISCOUNT_PCT[playerSkills.frugalShop||0]||0);
  return Math.max(1,Math.round(base*runShopRoundIndex()*runShopPlayerMult()*stackMult*relicShopPriceMult()*(1-discount)));
}
function ensureRunShopOverlay(){
  let el=document.getElementById('runShop');
  if(el) return el;
  el=document.createElement('div');
  el.id='runShop';
  el.innerHTML=`
    <div id="runShopPanel">
      <div id="runShopHead">
        <div>
          <div id="runShopTitle">BOSS PREP SHOP</div>
          <div id="runShopSub">Spend run crystals on skill cards. Press X to close, then reach the exit when ready.</div>
        </div>
        <div id="runShopHeadRight">
          <div id="runShopBal">CRYSTAL <span id="runShopCrystalAmt">0</span></div>
          <button id="runShopClose" type="button">X CLOSE</button>
        </div>
      </div>
      <div id="runShopCards"></div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#runShopClose').addEventListener('click',closeRunShopUI);
  return el;
}
function ensureShopPrompt(){
  let el=document.getElementById('shopPrompt');
  if(el) return el;
  el=document.createElement('div');
  el.id='shopPrompt';
  el.textContent='PRESS E - BOSS PREP SHOP';
  document.body.appendChild(el);
  return el;
}
function renderRunShop(){
  const el=ensureRunShopOverlay();
  const list=el.querySelector('#runShopCards');
  const amt=el.querySelector('#runShopCrystalAmt');
  if(amt) amt.textContent=Math.max(0,Math.floor(runCrystals||0));
  list.innerHTML='';
  for(const id of runShopCards){
    const def=SKILL_DEFS[id], rarity=skillRarity(id), info=RARITY_INFO[rarity]||RARITY_INFO.common;
    const cur=skillPickLevel(id), max=skillMaxLevel(id), next=Math.min(max,cur+1);
    const cat=SKILL_CAT_INFO[SKILL_CATEGORY[id]]||SKILL_CAT_INFO.survival;
    const price=runShopCardPrice(id);
    const canBuy=runCrystals>=price && cur<max;
    const card=document.createElement('div');
    card.className='run-shop-card';
    card.style.setProperty('--cat-color',info.color||cat.color);
    card.innerHTML=`
      <div class="run-shop-rarity">${info.label} - ${cat.label}</div>
      ${cardIconHtml(id,def.icon,'run-shop-icon')}
      <div class="run-shop-name">${def.name}</div>
      <div class="run-shop-desc">${hl(skillDesc(id,next)||'Upgrade this skill')}</div>
      ${levelDotsHtml(cur,next,max)}
      <div class="run-shop-price">${price} CRYSTAL</div>
      <button class="run-shop-buy" type="button"${canBuy?'':' disabled'}>${cur>=max?'MAXED':canBuy?'BUY CARD':'NEED '+Math.max(0,price-runCrystals)}</button>`;
    card.querySelector('.run-shop-buy').addEventListener('click',()=>{
      // Recompute against the current price — `price` was captured at render
      // time but `runShopPurchases` may have changed if the same card was
      // bought from another offer this same shop view. Avoids the (rare)
      // case of double-clicking before re-render and buying at the old price.
      const livePrice=runShopCardPrice(id);
      if(runCrystals<livePrice || skillPickLevel(id)>=skillMaxLevel(id)) return;
      playSample('buy');
      runCrystals-=livePrice;
      runShopPurchases[id]=(runShopPurchases[id]||0)+1;
      applySkill(id);
      applyBloodContractCost();
      updateCrystalHud();
      updateSkillHUD();
      annText(def.name,'#69f7ff');
      renderRunShop();
    });
    list.appendChild(card);
  }
  const reroll=document.createElement('div');
  reroll.className='run-shop-card';
  reroll.style.setProperty('--cat-color','#69f7ff');
  reroll.innerHTML=`
    <div class="run-shop-rarity">SHOP</div>
    ${cardIconHtml('reroll','', 'run-shop-icon')}
    <div class="run-shop-name">REROLL STOCK</div>
    <div class="run-shop-desc">Refresh all shop cards. The price rises each time this round.</div>
    <div class="run-shop-price">${runShopRerollCost} CRYSTAL</div>
    <button class="run-shop-reroll" type="button"${runCrystals>=runShopRerollCost?'':' disabled'}>🎲 REROLL</button>`;
  reroll.querySelector('.run-shop-reroll').addEventListener('click',()=>{
    if(runCrystals<runShopRerollCost) return;
    playSample('reroll');
    const free=hasRelic('gamblerChip')&&Math.random()<(RELIC_LEVELS.gamblerChip.freeChance[relicLevel('gamblerChip')]||0);
    if(!free){
      runCrystals-=runShopRerollCost;
      runShopRerollCost=Math.ceil(runShopRerollCost*RUN_SHOP_REROLL_GROWTH+2);
    } else {
      annText('FREE SHOP REROLL','#ffee77');
    }
    rollRunShopCards();
    updateCrystalHud();
    renderRunShop();
  });
  list.appendChild(reroll);
}
// True while the run-shop card overlay is up. Left-click is then routed to the
// shop UI only — the player shouldn't keep firing in the background.
let _runShopUIOpen=false;
function openRunShopUI(){
  if(gState!=='shopround') return;
  resetGameplayInput();
  ensureRunShopOverlay().style.display='flex';
  _runShopUIOpen=true;
  mouse.down=false; // drop any held fire so opening the shop doesn't keep shooting
  renderRunShop();
}
function closeRunShopUI(){
  const el=document.getElementById('runShop');
  if(el) el.style.display='none';
  _runShopUIOpen=false;
}
function ensureRunShopMesh(){
  if(runShopMesh) return;
  const g=new THREE.Group();
  const base=new THREE.Mesh(
    new THREE.CylinderGeometry(0.9,1.15,0.28,6),
    new THREE.MeshBasicMaterial({color:0x0a2030})
  );
  base.position.y=0.14; g.add(base);
  const core=new THREE.Mesh(
    new THREE.OctahedronGeometry(0.62,0),
    new THREE.MeshBasicMaterial({color:0x69f7ff,transparent:true,opacity:0.82,blending:THREE.AdditiveBlending})
  );
  core.position.y=1.1; g.add(core); g.userData.core=core;
  const ring=new THREE.Mesh(
    new THREE.TorusGeometry(1.05,0.035,8,42),
    new THREE.MeshBasicMaterial({color:0x69f7ff,transparent:true,opacity:0.72,blending:THREE.AdditiveBlending})
  );
  ring.rotation.x=Math.PI/2; ring.position.y=0.32; g.add(ring); g.userData.ring=ring;
  // No dynamic PointLight (see wave-totem note) — additive/emissive glow only.
  g.position.set(0,0,0);
  g.visible=false;
  scene.add(g);
  runShopMesh=g;
}
function ensureShopTotemMesh(){
  if(shopTotemMesh) return;
  const g=new THREE.Group();
  const baseMat=new THREE.MeshBasicMaterial({color:0x240018});
  const glowMat=new THREE.MeshBasicMaterial({color:0xff44cc,transparent:true,opacity:0.72,blending:THREE.AdditiveBlending});
  const base=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.72,0.38,6),baseMat);
  base.position.y=0.19; g.add(base);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.38,1.1,6),new THREE.MeshBasicMaterial({color:0x55113e}));
  body.position.y=0.88; g.add(body); g.userData.body=body;
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(0.34,0),glowMat);
  gem.position.y=1.58; g.add(gem); g.userData.gem=gem;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.72,0.035,8,34),glowMat.clone());
  ring.rotation.x=Math.PI/2; ring.position.y=0.08; g.add(ring); g.userData.ring=ring;
  // No dynamic PointLight (see wave-totem note) — additive/emissive glow only.
  g.position.set(SHOP_TOTEM_POS.x,0,SHOP_TOTEM_POS.z);
  g.visible=false;
  scene.add(g);
  shopTotemMesh=g;
}
function ensureWaveTotemMesh(){
  if(waveTotemMesh) return;
  const g=new THREE.Group();
  const base=new THREE.Mesh(
    new THREE.CylinderGeometry(0.46,0.76,0.34,6),
    new THREE.MeshBasicMaterial({color:0x102010})
  );
  base.position.y=0.17; g.add(base);
  const body=new THREE.Mesh(
    new THREE.CylinderGeometry(0.30,0.40,1.0,6),
    new THREE.MeshBasicMaterial({color:0x173824})
  );
  body.position.y=0.78; g.add(body); g.userData.body=body;
  const gem=new THREE.Mesh(
    new THREE.OctahedronGeometry(0.34,0),
    new THREE.MeshBasicMaterial({color:0xffd700,transparent:true,opacity:0.80,blending:THREE.AdditiveBlending})
  );
  gem.position.y=1.46; g.add(gem); g.userData.gem=gem;
  const ring=new THREE.Mesh(
    new THREE.TorusGeometry(0.76,0.035,8,36),
    new THREE.MeshBasicMaterial({color:0xffd700,transparent:true,opacity:0.66,blending:THREE.AdditiveBlending})
  );
  ring.rotation.x=Math.PI/2; ring.position.y=0.08; g.add(ring); g.userData.ring=ring;
  // No real PointLight here on purpose: adding/removing a light when the totem
  // shows/hides forces three.js to recompile every material (a visible hitch,
  // the "totem appears = lag" report). The gem/ring are additive + emissive so
  // they still glow via bloom without a dynamic light.
  g.position.set(WAVE_TOTEM_POS.x,0,WAVE_TOTEM_POS.z);
  g.visible=false;
  scene.add(g);
  waveTotemMesh=g;
}
function setWaveTotemWorldVisible(v){
  ensureWaveTotemMesh();
  waveTotemMesh.visible=!!v;
  if(v){
    // Always re-anchor on show — WAVE_TOTEM_POS constant may have changed,
    // and the mesh is cached across waves so the constructor's position is
    // only applied once.
    waveTotemMesh.position.set(WAVE_TOTEM_POS.x, 0, WAVE_TOTEM_POS.z);
    const opt=waveTotemOfferById(_waveTotemOfferId);
    const col=opt ? parseInt(opt.color.replace('#',''),16) : 0xffd700;
    if(waveTotemMesh.userData.gem) waveTotemMesh.userData.gem.material.color.setHex(col);
    if(waveTotemMesh.userData.ring) waveTotemMesh.userData.ring.material.color.setHex(col);
    if(waveTotemLight) waveTotemLight.color.setHex(col);
    // Attention-grab spawn flourish so the player notices it appearing.
    if(typeof spawnShockwave==='function') spawnShockwave(WAVE_TOTEM_POS.x, WAVE_TOTEM_POS.z, 1.8, col, 0.32, 0.85);
    if(typeof burst==='function') burst({x:WAVE_TOTEM_POS.x, z:WAVE_TOTEM_POS.z}, col, isMobile?6:12);
  }
}
function setRunShopWorldVisible(v){
  ensureRunShopMesh();
  ensureShopTotemMesh();
  runShopMesh.visible=!!v;
  shopTotemMesh.visible=!!v&&!shopTotemDestroyed;
  ensureShopPrompt().style.display='none';
}
function syncShopTotemState(state){
  shopTotemUses=Math.max(0,Math.min(SHOP_TOTEM_MAX_USES,state?.uses|0));
  shopTotemBreakChance=Math.max(0.5,Math.min(1,Number(state?.chance)||0.5));
  shopTotemDestroyed=!!state?.destroyed || shopTotemUses>=SHOP_TOTEM_MAX_USES;
  if(shopTotemMesh) shopTotemMesh.visible=gState==='shopround'&&!shopTotemDestroyed;
}
function broadcastShopTotemState(){
  if(!mp.isHost||mp.soloMode) return;
  broadcastMP({type:'SHOP_TOTEM_STATE',wave:waveNum,uses:shopTotemUses,chance:shopTotemBreakChance,destroyed:shopTotemDestroyed});
}
function activateShopTotem(){
  if(gState!=='shopround'||shopTotemDestroyed||shopTotemUses>=SHOP_TOTEM_MAX_USES) return;
  playSample('totem');
  if(!mp.soloMode&&!mp.isHost){
    sendToHost({type:'SHOP_TOTEM_CLICK',wave:waveNum});
    return;
  }
  shopTotemUses=Math.min(SHOP_TOTEM_MAX_USES,shopTotemUses+1);
  const roll=Math.random();
  const broke=roll<shopTotemBreakChance || shopTotemUses>=SHOP_TOTEM_MAX_USES;
  const bossCount=Math.pow(2,shopTotemUses);
  const bossMult=Math.pow(1.2,shopTotemUses);
  burst(SHOP_TOTEM_POS,0xff44cc,isMobile?12:24);
  spawnShockwave(SHOP_TOTEM_POS.x,SHOP_TOTEM_POS.z,2.4,0xff44cc,0.28,0.8);
  annText(`TOTEM: ${bossCount} BOSSES x${bossMult.toFixed(2)}`,'#ff66dd');
  if(broke){
    shopTotemDestroyed=true;
    if(shopTotemMesh) shopTotemMesh.visible=false;
    setTimeout(()=>annText('TOTEM BROKE','#ff66dd'),450);
  } else {
    shopTotemBreakChance=Math.min(1,shopTotemBreakChance+0.10);
    setTimeout(()=>annText(`TOTEM HOLDS - BREAK ${(shopTotemBreakChance*100).toFixed(0)}%`,'#ff99ee'),450);
  }
  broadcastShopTotemState();
}
function activateWaveTotem(){
  if(gState!=='playing'||!waveClear||!_waveTotemOfferPending||!_waveTotemOfferId||_waveTotemAccepted) return;
  playSample('totem');
  if(!mp.soloMode&&!mp.isHost){
    sendToHost({type:'WAVE_TOTEM_ACCEPT',wave:waveNum,id:_waveTotemOfferId});
    return;
  }
  const opt=waveTotemOfferById(_waveTotemOfferId);
  if(!opt) return;
  _pendingTotemMod=_waveTotemOfferId;
  _waveTotemAccepted=true;
  _waveTotemOfferPending=false;
  setWaveTotemWorldVisible(false);
  burst(WAVE_TOTEM_POS,parseInt(opt.color.replace('#',''),16),isMobile?10:20);
  spawnShockwave(WAVE_TOTEM_POS.x,WAVE_TOTEM_POS.z,2.1,parseInt(opt.color.replace('#',''),16),0.25,0.75);
  annText('TOTEM ACCEPTED - '+opt.name,opt.color);
  broadcastWaveTotemState();
}
function startRunShopRound(){
  closeRunShopUI();
  hideContributionPanel();
  resetExitReady();
  clearMapSpellsAndAllies();
  disposeMiniObjective();
  closeExit();
  if(currentMapLayout!==SHOP_PRESET_ID){
    currentMapLayout=SHOP_PRESET_ID;
    changeMapLayout(currentMapLayout);
  }
  gState='shopround';
  waveClear=true;
  waveSpawned=false;
  waveTransition=false;
  waveFightTime=0;
  const sp=SPAWN_POS[mp.myId%MAX_PLAYERS]||[0,ARENA_H-2];
  player.pos.set(sp[0],0,sp[1]);
  if(player.mesh){ player.mesh.position.x=sp[0]; player.mesh.position.z=sp[1]; }
  player.dashT=0; player.dashCd=Math.min(player.dashCd||0,0.2);
  player.meleeDashSpeed=0; player.meleeDashSpecial=false; player.hookSwingT=0; player.hookSwingMode=''; player.hookOrbitDir=0; player.hookWallBuffer=0; player.hookInertiaT=0;
  disposeActiveHookRope();
  // Reroll cost follows the same shop-round + party-size scaling as cards so
  // it stays equally meaningful at every shop and party size. Growth-per-use
  // (the RUN_SHOP_REROLL_GROWTH multiplier in the reroll handler) is on top
  // of this base.
  // Frugal Trader applies to the reroll base too so the discount feels
  // consistent across both shop buttons.
  const rerollDiscount=Math.min(0.95, SHOP_DISCOUNT_PCT[playerSkills.frugalShop||0]||0);
  const gamblerStart=hasRelic('gamblerChip')?(RELIC_LEVELS.gamblerChip.priceMul[relicLevel('gamblerChip')]||1):1;
  runShopRerollCost=Math.max(1,Math.round(RUN_SHOP_REROLL_BASE*runShopRoundIndex()*runShopPlayerMult()*relicShopPriceMult()*gamblerStart*(1-rerollDiscount)));
  shopTotemUses=0; shopTotemBreakChance=0.5; shopTotemDestroyed=false;
  rollRunShopCards();
  setRunShopWorldVisible(true);
  openExit('SHOP ROUND: Press E at the shop, then reach the boss exit');
  document.getElementById('exitArrow').textContent='▲ BOSS EXIT ▲';
  // Shop wave heal pickups: 5× player count, scattered around the TOP of the
  // arena (near the boss exit) so the bags don't crowd the spawn point or
  // the shop totem. Host owns spawns in MP so the pool stays consistent.
  if(mp.soloMode || mp.isHost){
    const partySize=mp.soloMode?1:Math.max(1,mpPlayerIds().length);
    const bagCount=partySize*5;
    // Top-middle anchor: roughly opposite of the player spawn (which sits at
    // ARENA_H-2 along +z). Tile bags in a 6-wide row offset by jitter.
    const anchorZ=-ARENA_H+3;
    for(let i=0;i<bagCount;i++){
      const col=i%6, row=Math.floor(i/6);
      const bx=(col-2.5)*1.35+(Math.random()-0.5)*0.4;
      const bz=anchorZ+row*1.1+(Math.random()-0.5)*0.35;
      spawnHealBag(bx,bz,0.20+Math.random()*0.10);
    }
  }
  // Wave event clears at shop start.
  waveEvent=null;
  renderWaveEventBanner();
  updateHUD();
}
function finishRunShopRound(){
  if(gState!=='shopround') return;
  resetExitReady();
  runShopDoneWave=waveNum;
  closeRunShopUI();
  setRunShopWorldVisible(false);
  ensureShopPrompt().style.display='none';
  waveClear=false;
  closeExit();
  clearMapSpellsAndAllies();
  // Wipe any uncollected shop heal bags before the boss wave starts — leaving
  // them on the floor lets players free-heal mid-fight which trivialises boss
  // wave damage tuning. Host clears + broadcasts in MP.
  if(typeof healBags!=='undefined' && healBags.length){
    for(let i=healBags.length-1;i>=0;i--){
      const id=healBags[i].id;
      _disposeHealBag(healBags[i]);
      if(!mp.soloMode && mp.isHost) broadcastMP({type:'HEAL_BAG_PICKUP',id,by:-1});
    }
  }
  afterBuffSelect();
}
function updateRunShopRound(dt, now){
  if(runShopMesh&&runShopMesh.visible){
    runShopMesh.rotation.y+=dt*0.9;
    if(runShopMesh.userData.core){
      runShopMesh.userData.core.rotation.y-=dt*1.6;
      runShopMesh.userData.core.position.y=1.08+Math.sin(now*0.004)*0.10;
    }
    if(runShopMesh.userData.ring) runShopMesh.userData.ring.rotation.z+=dt*1.8;
  }
  if(shopTotemMesh&&shopTotemMesh.visible){
    shopTotemMesh.rotation.y+=dt*0.65;
    if(shopTotemMesh.userData.gem){
      shopTotemMesh.userData.gem.rotation.y-=dt*2.1;
      shopTotemMesh.userData.gem.position.y=1.58+Math.sin(now*0.006)*0.08;
    }
    if(shopTotemMesh.userData.ring) shopTotemMesh.userData.ring.rotation.z-=dt*1.6;
    if(shopTotemLight) shopTotemLight.intensity=1.7+0.7*Math.sin(now*0.005);
  }
  if(gState!=='shopround'||!player||player.dead) return;
  const nearShop=Math.hypot(player.pos.x,player.pos.z)<2.1;
  const nearTotem=!shopTotemDestroyed&&Math.hypot(player.pos.x-SHOP_TOTEM_POS.x,player.pos.z-SHOP_TOTEM_POS.z)<1.9;
  const prompt=ensureShopPrompt();
  if(nearTotem){
    prompt.textContent=`PRESS E / CLICK - RISK TOTEM (${Math.pow(2,shopTotemUses+1)} BOSSES, BREAK ${(shopTotemBreakChance*100).toFixed(0)}%)`;
    prompt.style.display='block';
  } else if(nearShop){
    prompt.textContent='PRESS E - BOSS PREP SHOP';
    prompt.style.display='block';
  } else {
    prompt.style.display='none';
  }
  if(exitOpen){
    if(exitMesh) exitMesh.rotation.z += dt*2;
    refreshExitLabel();
    if(mp.exitReady[mp.myId]) updateExitReadyPrompt();
    else document.getElementById('exitArrow').style.display=
      Math.hypot(player.pos.x,player.pos.z-EXIT_Z)>5?'block':'none';
    if(Math.hypot(player.pos.x, player.pos.z-EXIT_Z) < 2.0) requestExitTransition('shop');
  }
}
function updateWaveTotemWorld(dt, now){
  if(waveTotemMesh&&waveTotemMesh.visible){
    waveTotemMesh.rotation.y+=dt*0.8;
    if(waveTotemMesh.userData.gem){
      waveTotemMesh.userData.gem.rotation.y-=dt*2.2;
      waveTotemMesh.userData.gem.position.y=1.46+Math.sin(now*0.006)*0.09;
    }
    if(waveTotemMesh.userData.ring) waveTotemMesh.userData.ring.rotation.z+=dt*1.7;
    if(waveTotemLight) waveTotemLight.intensity=1.6+0.6*Math.sin(now*0.006);
  }
  if(gState!=='playing'||!waveClear||!exitOpen||!_waveTotemOfferPending||!player||player.dead){
    if(gState!=='shopround') ensureShopPrompt().style.display='none';
    return;
  }
  const opt=waveTotemOfferById(_waveTotemOfferId);
  const near=Math.hypot(player.pos.x-WAVE_TOTEM_POS.x,player.pos.z-WAVE_TOTEM_POS.z)<1.9;
  const prompt=ensureShopPrompt();
  if(near&&opt){
    // Spell out exactly what activating does + the reward, so players aren't
    // gambling blind on an unlabelled modifier.
    const _lines=(opt.desc||'').split('\n');
    prompt.innerHTML=`<div style="font-size:1.5em;letter-spacing:1.5px;text-shadow:0 0 12px ${opt.color};color:${opt.color}">⭐ PRESS E — ACTIVATE ${opt.name}</div>`
      + _lines.map(ln=>{
          const reward=/^\s*reward/i.test(ln);
          return `<div style="font-size:1.05em;font-weight:700;letter-spacing:.6px;margin-top:5px;text-shadow:0 0 7px rgba(0,0,0,.9);color:${reward?'#ffe066':'rgba(255,255,255,.92)'}">${ln}</div>`;
        }).join('');
    prompt.style.display='block';
  } else if(gState!=='shopround') {
    prompt.style.display='none';
  }
}

function showBuffSelect(phase){
  cancelGravityCharge();
  _buffSelectPhase=phase;
  gState='buffselect';
  const el=document.getElementById('buffSelect');
  const title=document.getElementById('buffTitle');
  const sub=document.getElementById('buffSubtitle');
  const cards=document.getElementById('buffCards');
  el.style.display='flex'; cards.classList.remove('choosing-card'); cards.innerHTML='';
  _ensureRelicPickState(phase);
  if(_relicFateSkip){
    annText('FATE GAMBIT FAILED','#ffee77');
    _resetPickChain();
    // A failed bonus offer must not erase cards already earned from this boss.
    if(phase==='boss') _resetFateRollOnly();
    else _resetRelicPickState();
    el.style.display='none';
    if(phase==='boss'){
      if(!continueTotemBossRewards()) completeBossReward();
    }
    else afterBuffSelect();
    return;
  }

  if(phase==='status'){
    title.textContent='✓ WAVE CLEAR!';
    sub.textContent='CHOOSE A STATUS UPGRADE';
    STATUS_BUFFS.forEach((b,i)=>{
      const card=document.createElement('div'); card.className='buff-card';
      card.style.setProperty('--cat-color', b.id==='atk' ? '#00eeff' : b.id==='heal' ? '#44ff88' : '#ff5577');
      card.style.animationDelay=`${i*70}ms, ${340+i*70}ms`;
      card.innerHTML=`${cardIconHtml(b.id,b.icon)}<div class="buff-card-name">${b.name}</div>`;
      card.addEventListener('click',()=>pickCardWithFx(card,()=>{ b.fn(); el.style.display='none'; showBuffSelect('skill'); }));
      cards.appendChild(card);
    });
  } else if(phase==='opening'){
    title.textContent='OPENING LOADOUT';
    sub.textContent=openingLoadoutPicksLeft>1 ? 'CHOOSE YOUR STARTING SKILLS' : 'CHOOSE YOUR STARTING SKILL';
    const choices=getFirstSkillChoices();
    if(!choices.length){el.style.display='none';afterBuffSelect();return;}
    choices.forEach((id,i)=>{
      const def=SKILL_DEFS[id];
      const cur=skillPickLevel(id);
      const next=cur+1;
      const catInfo=SKILL_CAT_INFO[SKILL_CATEGORY[id]]||{label:'GENERAL',color:'#888888'};
      const rarity=RARITY_INFO[skillRarity(id)]||RARITY_INFO.common;
      const card=document.createElement('div'); card.className='buff-card';
      card.style.setProperty('--cat-color', rarity.color||catInfo.color);
      card.style.animationDelay=`${i*70}ms, ${340+i*70}ms`;
      card.innerHTML=`
        <div class="buff-card-cat">${rarity.label} - ${catInfo.label}</div>
        ${cardIconHtml(id,def.icon)}
        <div class="buff-card-name">${def.name}</div>
        <div class="buff-card-desc">${hl(skillDesc(id,next))}</div>
        ${levelDotsHtml(cur,next,skillMaxLevel(id))}`;
      card.addEventListener('click',()=>pickCardWithFx(card,()=>{
        applySkill(id);
        if(openingLoadoutBoosts>0){
          applySkill(id);
          openingLoadoutBoosts--;
        }
        _firstSkillPickDone=true;
        openingLoadoutPicksLeft=Math.max(0,openingLoadoutPicksLeft-1);
        if(openingLoadoutPicksLeft>0) showBuffSelect('opening');
        else { el.style.display='none'; afterBuffSelect(); }
      }));
      cards.appendChild(card);
    });
    addRerollButton(cards, phase);
  } else if(phase==='boss'){
    title.textContent='★ BOSS DEFEATED';
    sub.textContent='BOSS REWARD — CHOOSE A SKILL';
    if(!_currentOffering.length){
      _currentOffering=getBossSkillChoices();
      _offeringPicked.clear();
    }
    const choices=_currentOffering.filter(id => !_offeringPicked.has(id));
    if(!choices.length){
      // Offering exhausted (every card already picked via pickStreak/luckyDraw).
      // If totem bonus picks are still owed, refresh and keep going; otherwise
      // exit the boss-reward flow normally.
      if(continueTotemBossRewards()) return;
      completeBossReward();return;
    }
    choices.forEach((id,i)=>{
      const def=SKILL_DEFS[id]; const cur=skillPickLevel(id); const next=cur+1;
      const catInfo=SKILL_CAT_INFO[SKILL_CATEGORY[id]]||{label:'GENERAL',color:'#888888'};
      const rarity=RARITY_INFO[skillRarity(id)]||RARITY_INFO.common;
      const card=document.createElement('div'); card.className='buff-card boss-buff-card';
      card.style.setProperty('--cat-color', rarity.color||catInfo.color);
      card.style.animationDelay=`${i*70}ms, ${340+i*70}ms`;
      // Category indicated by the coloured bar at the top of the card (CSS
      // ::after) and the icon's coloured drop-shadow. Level progression
      // shown as rarity-capped dots: Common 5, Uncommon 4, Rare 3, Epic 2.
      card.innerHTML=`
        <div class="buff-card-cat">${rarity.label} - ${catInfo.label}</div>
        ${cardIconHtml(id,def.icon)}
        <div class="buff-card-name">${def.name}</div>
        <div class="buff-card-desc">${hl(skillDesc(id,next))}</div>
        ${levelDotsHtml(cur,next,skillMaxLevel(id))}`;
      card.addEventListener('click',()=>pickCardWithFx(card,()=>{
        applySkill(id);
        _recordRewardPick();
        _offeringPicked.add(id);
        if((_rewardPickCount<3||_relicFateExtras>0)&&_continuePickChain('boss')) return;
        if(_rewardPickCount>=3){ _resetPickChain(); _resetFateRollOnly(); }
        if(continueTotemBossRewards()) return;
        completeBossReward();
      }));
      cards.appendChild(card);
    });
    addRerollButton(cards, phase);
  } else {
    // Context-aware title — caller sets _skillPickContext to wave/loot/mini/
    // bounty/challenge/streak/draw/fate before invoking showBuffSelect so the
    // player sees WHERE this card is coming from instead of a generic banner.
    const _ctx = SKILL_PICK_TITLES[_skillPickContext] || SKILL_PICK_TITLES.wave;
    title.textContent = _ctx.title;
    sub.textContent = _ctx.sub;
    if(!_currentOffering.length){
      _currentOffering = getSkillChoices();
      _offeringPicked.clear();
    }
    const choices=_currentOffering.filter(id => !_offeringPicked.has(id));
    if(!choices.length){ _resetPickChain(); _resetRelicPickState(); el.style.display='none'; afterBuffSelect(); return; }
    choices.forEach((id,i)=>{
      const def=SKILL_DEFS[id];
      const cur=skillPickLevel(id); const next=cur+1;
      const catInfo=SKILL_CAT_INFO[SKILL_CATEGORY[id]]||{label:'GENERAL',color:'#888888'};
      const rarity=RARITY_INFO[skillRarity(id)]||RARITY_INFO.common;
      const card=document.createElement('div'); card.className='buff-card';
      card.style.setProperty('--cat-color', rarity.color||catInfo.color);
      card.style.animationDelay=`${i*70}ms, ${340+i*70}ms`;
      // Category shown by the coloured top bar + glow on the icon; level
      // shown by the dot row instead of "LVL N -> N+1" text.
      card.innerHTML=`
        <div class="buff-card-cat">${rarity.label} - ${catInfo.label}</div>
        ${cardIconHtml(id,def.icon)}
        <div class="buff-card-name">${def.name}</div>
        <div class="buff-card-desc">${hl(skillDesc(id,next))}</div>
        ${levelDotsHtml(cur,next,skillMaxLevel(id))}`;
      card.addEventListener('click',()=>pickCardWithFx(card,()=>{
        _firstSkillPickDone=true; applySkill(id);
        _recordRewardPick();
        _offeringPicked.add(id);
        if((_rewardPickCount<3||_relicFateExtras>0)&&_continuePickChain(phase)) return;
        if(_rewardPickCount>=3){ _resetPickChain(); _resetRelicPickState(); }
        if(mp.soloMode) el.style.display='none';
        afterBuffSelect();
      }));
      cards.appendChild(card);
    });
    addRerollButton(cards, phase);
  }
}

function applySkill(id){
  const max=skillMaxLevel(id);
  const oldPicks=playerSkillPicks[id]||0;
  const oldEff=skillEffectiveLevel(id,oldPicks);
  const picks=Math.min(max,oldPicks+1);
  playerSkillPicks[id]=picks;
  const eff=skillEffectiveLevel(id,picks);
  playerSkills[id]=eff;
  if(id==='vitalCore'){
    const gain=(VITAL_CORE_HP[eff]||0)-(VITAL_CORE_HP[oldEff]||0);
    if(gain>0){ addPlayerMaxHp(gain); dmgNum('MAX HP +'+gain,player.pos,'#66ffaa'); }
  }
  if(id==='factoryGate'){
    spawnFactoryGateLegionWithVfx(1, 5);
    factoryGateCd=factoryGateInterval(); // start the next legion timer right after the instant deploy
  }
  if(id==='orbGalaxy'){
    rebuildFireballs(); rebuildIceOrbs(); rebuildThunderOrbs(); rebuildPoisonOrbs();
  }
  if(id==='twinOrbit') { rebuildFireballs(); rebuildIceOrbs(); rebuildThunderOrbs(); rebuildPoisonOrbs(); }
  if(id==='fireball')   rebuildFireballs();
  if(id==='iceOrb')     rebuildIceOrbs();
  if(id==='thunderOrb') rebuildThunderOrbs();
  if(id==='poisonOrb')  rebuildPoisonOrbs();
  if(id==='barrier'){ buildBarrierVisual(); if(!player.barrierActive) player.barrierCd=0; }
  if(id==='lightning'){ lightningT=0; document.getElementById('lightningCd').style.display='flex'; }
  if(id==='spellCard'){
    player.spellCd=0;
    document.getElementById('spellCd').style.display='flex';
    if(realIsMobile) document.getElementById('spellBtn').style.display='flex';
  }
  if(id==='fireRing'){ player.fireRingCd=0; document.getElementById('ringCd').style.display='flex'; }
  if(id==='homingBomb'){ player.homingBombCd=0; document.getElementById('bombCd').style.display='flex'; }
  if(id==='stormCall'){ player.stormCallCd=0; document.getElementById('stormCd').style.display='flex'; }
  if(id==='guardianTurret'){ document.getElementById('turretCdEl').style.display='flex'; document.getElementById('summonSep').style.display='block'; turretSpawnCd=0; }
  if(id==='laserDrone'){ document.getElementById('droneCdEl').style.display='flex'; document.getElementById('summonSep').style.display='block'; droneSpawnCd=0; }
  if(id==='repairDrone'){ document.getElementById('repairCdEl').style.display='flex'; document.getElementById('summonSep').style.display='block'; repairDroneSpawnCd=0; }
  if(id==='shieldBot'){ document.getElementById('shieldBotCdEl').style.display='flex'; document.getElementById('summonSep').style.display='block'; shieldBotSpawnCd=0; }
  if(id==='bladeSentinel'){ document.getElementById('sentinelCdEl').style.display='flex'; document.getElementById('summonSep').style.display='block'; sentinelSpawnCd=0; }
  updateSkillHUD();
}

function resetLegendaryTimers(){
  factoryGateCd=0; gravityCoreT=0; celestialVerdictCd=4; archmageLoopCd=0; bulletHellShots=0; soulLinkHealT=0;
  railBurstShots=0; overclockBarrageShots=0; orbitStormCd=0; elementalWakeCd=0; meteorRiteCd=4;
  crimsonCycloneT=0; crimsonCycloneTick=0;
}

function hasAnySummon(){
  return summonDrones.length||repairDrones.length||turrets.length||shieldBots.length||sentinels.length;
}
function activeSummonCount(){
  return summonDrones.length+repairDrones.length+turrets.length+shieldBots.length+sentinels.length;
}
function factoryGateInterval(){
  return Math.max(8.0, 20*getSummonCdMult());
}

// Factory Gate (legendary): when picked, instantly deploy a full legion — 1 of every
// summon type at max effective level. The spawn functions read playerSkills to size the
// units, so we temp-bump each skill to level 5 around the call. The summon update
// loops have been un-gated (effDroneLvl etc. fall back to 5 when the player doesn't
// own the skill) so factory-spawned units operate normally even without ownership.
function spawnFactoryGateUnit(id, fn, forceLvl=5, origin=null){
  if(!player||player.dead) return;
  const prev=playerSkills[id]||0;
  playerSkills[id]=Math.max(prev,forceLvl);
  const ox=origin?.x, oz=origin?.z;
  const px=player.pos.x, pz=player.pos.z;
  if(Number.isFinite(ox)&&Number.isFinite(oz)) player.pos.set(ox,0,oz);
  fn();
  if(Number.isFinite(ox)&&Number.isFinite(oz)) player.pos.set(px,0,pz);
  playerSkills[id]=prev;
}
function factoryGateSummonTypes(){
  return [
    ['laserDrone',     spawnDrone],
    ['guardianTurret', spawnTurret],
    ['repairDrone',    spawnRepairDrone],
    ['shieldBot',      spawnShieldBot],
    ['bladeSentinel',  spawnSentinel],
  ];
}
function spawnFactoryGateLegion(perType=1, forceLvl=5, origin=null){
  const types=[
    ['laserDrone',     spawnDrone],
    ['guardianTurret', spawnTurret],
    ['repairDrone',    spawnRepairDrone],
    ['shieldBot',      spawnShieldBot],
    ['bladeSentinel',  spawnSentinel],
  ];
  for(const [id,fn] of types){
    for(let k=0;k<perType;k++) spawnFactoryGateUnit(id,fn,forceLvl,origin);
  }
  spawnShockwave(player.pos.x,player.pos.z,3.4,0xffdd44,0.30,0.95);
  burst(player.pos,0xffdd44,isMobile?12:24);
  burst(player.pos,0xffffff,isMobile?6:12);
  annText('FACTORY GATE — LEGION','#ffdd44');
}
function spawnFactoryGateLegionWithVfx(perType=1, forceLvl=5){
  if(!player||player.dead) return;
  const gx=player.pos.x, gz=player.pos.z;
  sFactoryGate();
  let spawned=0;
  const types=factoryGateSummonTypes();
  spawnFactoryGateVfx(gx,gz,()=>{
    types.forEach(([id,fn],i)=>{
      setTimeout(()=>{
        if(!player||player.dead) return;
        spawnFactoryGateUnit(id,fn,forceLvl,{x:gx,z:gz});
        spawnShockwave(gx,gz,1.25,0xffdd44,0.16,0.42);
        burst({x:gx,z:gz},0xffdd44,isMobile?5:9);
        spawned++;
        if(spawned>=types.length*perType){
          burst({x:gx,z:gz},0xffffff,isMobile?6:12);
          annText('FACTORY GATE','#ffdd44');
        }
      },i*500);
    });
  },3.0);
}

function triggerArchmageLoop(source){
  if(!playerSkills.archmageLoop||archmageLoopCd>0||Math.random()>0.25) return;
  const owned=['spellCard','fireRing','homingBomb','stormCall','lightning'].filter(id=>id!==source&&(playerSkills[id]||0)>0);
  if(!owned.length) return;
  archmageLoopCd=0.5;
  const pick=owned[Math.floor(Math.random()*owned.length)];
  const spellPwr=SPELL_PWR_MULT[playerSkills.spellPower||0];
  spawnSkillRingAura(player.pos.x,player.pos.z,2.25,0xcc33ff,0.50,0.52);
  sArcaneLoop();
  if(pick==='spellCard'){
    for(let i=0;i<10;i++){
      const a=(i/10)*Math.PI*2;
      fireSpellBall({x:player.pos.x,z:player.pos.z},_scratchDir.set(Math.sin(a),0,Math.cos(a)),Math.round(playerStats.attackDmg*2.2*spellPwr),0xcc33ff,3);
    }
    spawnShockwave(player.pos.x,player.pos.z,2.4,0xcc33ff,0.22,0.65);
  } else if(pick==='fireRing'){
    spawnDamageRing(player.pos.x,player.pos.z,7.5,Math.round(95*spellPwr),0xff5500,0.85);
  } else if(pick==='homingBomb'){
    spawnHomingBomb({x:player.pos.x,z:player.pos.z},Math.round(130*spellPwr),3.1);
  } else if(pick==='stormCall'){
    const te=[...enemies].filter(e=>!e.dead).sort((a,b)=>b.maxHp-a.maxHp)[0];
    if(te){
      const ei=enemies.indexOf(te);
      const dmg=playerDamageAmount(te,Math.round(120*spellPwr));
      te.hp-=dmg; te.hitFlashT=0.16; addEnemyStagger(te,0.24);
      showHitNumber(te,dmg,'#ffffaa',mp.myId,'spell');
      spawnStormZap(te.pos.x,te.pos.z);
      if(te.hp<=0&&ei>=0) killEnemy(te);
    }
  } else if(pick==='lightning'){
    const chain=[...enemies].filter(e=>!e.dead)
      .sort((a,b)=>Math.hypot(a.pos.x-player.pos.x,a.pos.z-player.pos.z)-Math.hypot(b.pos.x-player.pos.x,b.pos.z-player.pos.z))
      .slice(0,3);
    for(const te of chain){
      const ei=enemies.indexOf(te); if(ei===-1) continue;
      const dmg=playerDamageAmount(te,Math.round(85*spellPwr));
      te.hp-=dmg; addEnemyStagger(te,0.12); te.hitFlashT=0.12;
      spawnZapLine(player.pos.x,player.pos.z,te.pos.x,te.pos.z);
      spawnStormZap(te.pos.x,te.pos.z);
      showHitNumber(te,dmg,'#66ccff',mp.myId,'spell');
      if(te.hp<=0) killEnemy(te);
    }
  }
  burst(player.pos,0xcc33ff,isMobile?6:12);
}

function castCelestialVerdict(){
  const te=[...enemies].filter(e=>!e.dead).sort((a,b)=>(b.hp+b.maxHp*0.5)-(a.hp+a.maxHp*0.5))[0];
  if(!te) return;
  const dmg=te.type==='boss'?Math.round(te.maxHp*0.085):Math.round(Math.max(220,playerStats.attackDmg*11));
  spawnWarningLine(te.pos.x,te.pos.z,0,0.5,2.2,0xfff2aa,0.35,()=>{
    if(te.dead) return;
    const ei=enemies.indexOf(te);
    if(ei>=0) damageEnemyIndex(ei,dmg,0xfff2aa,0.35,mp.myId,'spell');
    spawnSkyBeamVfx(te.pos.x,te.pos.z,1.4,0xfff2aa,0.45);
    sLightH();
    spawnStormZap(te.pos.x,te.pos.z);
    spawnShockwave(te.pos.x,te.pos.z,3.1,0xfff2aa,0.28,0.9);
  });
}

function ownedOrbMeshes(){
  return [...fireballMeshes,...iceOrbMeshes,...thunderOrbMeshes,...poisonOrbMeshes].filter(m=>m&&m.visible);
}

function castPlayerMeteor(x,z,r,dmg,col=0xff66ff,delay=0.58){
  spawnSkyMeteorVfx(x,z,r,col,delay);
  sMeteorFall();
  spawnWarningCircle(x,z,r,col,delay,()=>{
    damageEnemiesInCircle(x,z,r,dmg,col,0.2,'spell');
    burst({x,z},col,isMobile?10:20);
    spawnShockwave(x,z,r,col,0.28,0.82);
    shakeAmt=Math.max(shakeAmt,0.16);
    sExplosion();
  });
}

function updateEpicEffects(dt){
  if(player.dead||player.downed) return;
  const tempo=epicRank('arcaneTempo');
  if(tempo){
    const bonus=dt*([0,0.22,0.42][tempo]||0);
    player.spellCd=Math.max(0,player.spellCd-bonus);
    player.fireRingCd=Math.max(0,player.fireRingCd-bonus);
    player.homingBombCd=Math.max(0,player.homingBombCd-bonus);
    player.stormCallCd=Math.max(0,player.stormCallCd-bonus);
    lightningT=Math.max(0,lightningT-bonus);
  }

  const meteor=epicRank('meteorRite');
  if(meteor){
    meteorRiteCd-=dt;
    if(meteorRiteCd<=0){
      meteorRiteCd=[0,7.5,5.6][meteor]||7;
      const t=nearestEnemy(player.pos.x,player.pos.z,16);
      if(t) castPlayerMeteor(t.enemy.pos.x,t.enemy.pos.z,[0,2.2,2.9][meteor],Math.round(playerStats.attackDmg*[0,5.5,8.0][meteor]),0xcc66ff,0.52);
    }
  }

  const storm=epicRank('orbitStorm');
  if(storm&&ownedOrbMeshes().length){
    orbitStormCd-=dt;
    if(orbitStormCd<=0){
      orbitStormCd=[0,3.8,2.6][storm]||3.5;
      const r=orbPulseRadius(performance.now());
      spawnShockwave(player.pos.x,player.pos.z,r,0xffaa33,0.18,0.55);
      spawnSkillRingAura(player.pos.x,player.pos.z,r,0xffaa33,0.42,0.42);
      sOrbPulse();
      damageEnemiesInCircle(player.pos.x,player.pos.z,r,Math.round(playerStats.attackDmg*[0,2.1,3.2][storm]),0xffaa33,0.08,'orb');
    }
  }

  const wake=epicRank('elementalWake');
  if(wake&&ownedOrbMeshes().length){
    elementalWakeCd-=dt;
    if(elementalWakeCd<=0){
      elementalWakeCd=[0,4.8,3.2][wake]||4.5;
      const orbs=ownedOrbMeshes();
      const max= isMobile ? Math.min(2,orbs.length) : Math.min(4,orbs.length);
      for(let i=0;i<max;i++){
        const m=orbs[(i*2+Math.floor(Math.random()*orbs.length))%orbs.length];
        const x=m.position.x, z=m.position.z;
        spawnShockwave(x,z,[0,1.45,1.9][wake],0x66ffee,0.14,0.48);
        spawnSkillRingAura(x,z,[0,1.45,1.9][wake],0x66ffee,0.28,0.34);
        damageEnemiesInCircle(x,z,[0,1.45,1.9][wake],Math.round(playerStats.attackDmg*[0,1.5,2.2][wake]),0x66ffee,0.07,'elemental');
      }
      sOrbPulse();
    }
  }
}

function updateLegendaryEffects(dt){
  if(player.dead||player.downed) return;
  // Factory Gate: legion (1 of every summon type = 5 allies) deploys at pick-time
  // and then repeats faster when the player has Summon Haste.
  if(playerSkills.factoryGate){
    factoryGateCd-=dt;
    if(factoryGateCd<=0){
      factoryGateCd=factoryGateInterval();
      spawnFactoryGateLegionWithVfx(1, 5);
    }
  }
  if(playerSkills.soulLinkArmy&&hasAnySummon()&&!regenSourcesBlocked()){
    soulLinkHealT-=dt;
    if(soulLinkHealT<=0){
      soulLinkHealT=2.6;
      healPlayer(Math.max(1,Math.round(playerStats.maxHp*0.01*activeSummonCount())));
    }
  }
  if(playerSkills.crimsonCyclone&&crimsonCycloneT>0){
    crimsonCycloneT=Math.max(0,crimsonCycloneT-dt);
    crimsonCycloneTick-=dt;
    if(crimsonCycloneTick<=0){
      crimsonCycloneTick=0.22;
      const r=2.45, dmg=Math.round(playerStats.attackDmg*1.65);
      // Three offset crescent slashes per tick instead of a single flat
      // shockwave ring — reads as a spinning multi-blade aura matching the
      // skill description. Each slash is a partial arc with a random base
      // rotation so the player sees blades whipping around them.
      const baseAng=Math.random()*Math.PI*2;
      for(let bi=0;bi<3;bi++){
        const ang=baseAng+bi*(Math.PI*2/3);
        const dx=Math.sin(ang), dz=Math.cos(ang);
        spawnSkillBeam(player.pos.x,player.pos.z,dx,dz,r,0.46,0xff3366,0.18,0.55);
      }
      spawnShockwave(player.pos.x,player.pos.z,r,0xff3366,0.10,0.28);
      for(let i=enemies.length-1;i>=0;i--){
        const e=enemies[i]; if(!e||e.dead) continue;
        if(Math.hypot(e.pos.x-player.pos.x,e.pos.z-player.pos.z)<r+e.cfg.r) damageEnemyIndex(i,dmg,0xff3366,0.10,mp.myId,'melee');
      }
      if(miniObjective?.type==='spawners' && !miniObjective.complete){
        for(const sp of (miniObjective.spawners||[])){
          if(!sp.alive) continue;
          if(Math.hypot(sp.x-player.pos.x,sp.z-player.pos.z)<r+0.8){
            damageMiniObjectiveAt(sp.x,sp.z,dmg,0.9,0xff3366);
          }
        }
      }
    }
  }
  if(playerSkills.gravityCore){
    gravityCoreT-=dt;
    if(gravityCoreT<=0){
      gravityCoreT=0.34;
      const orbitR=orbPulseRadius(performance.now());
      if(Math.random()<0.34) spawnSkillRingAura(player.pos.x,player.pos.z,orbitR,0x66ddff,0.34,0.32);
      for(let i=enemies.length-1;i>=0;i--){
        const e=enemies[i]; if(!e||e.dead) continue;
        const dx=e.pos.x-player.pos.x, dz=e.pos.z-player.pos.z;
        const d=Math.hypot(dx,dz)||1;
        if(d>9.5) continue;
        const targetR=orbitR;
        const pull=(d-targetR)*0.034;
        e.pos.x-=dx/d*pull; e.pos.z-=dz/d*pull;
        addEnemyStagger(e,0.025);
        if(Math.abs(d-targetR)<1.05) damageEnemyIndex(i,Math.round(playerStats.attackDmg*0.95),0x66ddff,0.07,mp.myId,'orb');
      }
    }
  }
  if(playerSkills.celestialVerdict){
    celestialVerdictCd-=dt;
    if(celestialVerdictCd<=0){ celestialVerdictCd=8.0; castCelestialVerdict(); }
  }
  archmageLoopCd=Math.max(0,archmageLoopCd-dt);
}

function permLevel(id){
  return (persistData.upgrades&&persistData.upgrades[id])||0;
}

function setupRunPerms(){
  const reviveLvl=permLevel('revive');
  runRevives=PERM_REVIVE_COUNTS[reviveLvl]||0;
  runReviveHpPct=PERM_REVIVE_HP[reviveLvl]||0;
  runRerolls=PERM_RUN_REROLLS[permLevel('reroll')]||0;
}

function beginOpeningLoadoutOrWave(){
  const lvl=permLevel('startSkill');
  const count=PERM_START_COUNTS[lvl]||0;
  if(!mp.soloMode&&mp.connected){
    mp.buffReady={};
    mp.buffPlayers=mpPlayerIds();
    mp.buffStartQueued=false;
  }
  if(!count){
    _skillPickContext='wave';
    showBuffSelect('skill');
    return;
  }
  openingLoadoutPicksLeft=count;
  openingLoadoutBoosts=PERM_START_BOOSTS[lvl]||0;
  showBuffSelect('opening');
}

// Shared crit roll — used by playerDamageAmount (bullets/orbs/spells with sourcePerm
// from possibly remote bullets) AND by damageEnemyIndex (everything else: melee /
// movement / summon / mine / cyclone). Adds the Crit Edge luck skill bonus on top
// of the permanent crit upgrade. For remote bullets, uses their owner's perm/skill
// snapshot so each player's crit chance follows their own build.
// Transient bonus that boosts the next rollCrit() call. Set by the melee
// path when Stonebreaker is owned so a melee swing rolls with elevated crit
// chance. Cleared after each rollCrit so non-melee damage isn't affected.
let _critChanceBonus=0;
const { rollCrit, playerDamageAmount } = createDamageSystem({
  permLevel, relicDamageMult,
  getSkills: () => playerSkills,
  getPlayer: () => player,
  getPhaseVulnerability: () => phaseVulnMap,
  getCritBonus: () => _critChanceBonus,
  getProtectionMult: enemy => enemy&&linkIsValid(enemy.linkSource,enemy,lineBlockedByObstacle)?0.7:1,
  PERM_CRIT_CHANCE, CRIT_LUCK_BONUS, PERM_BOSS_DMG_MULT,
  onExecute(enemy) {
    if(skillFxThrottle('exec'+enemy.poolIdx,250)){
      burst(enemy.pos,0xff3344,isMobile?5:10);
      flashLight(enemy.pos,0xff2244,5,7,0.16);
      dmgNum('EXECUTE',enemy.pos,'#ff4466','threat');
    }
  },
});

function dashCooldown(){
  let cd=DASH_CD[playerSkills.dashMastery||0] || DASH_CD[0];
  if(hasRelic('berserkerGrip')) cd*=RELIC_LEVELS.berserkerGrip.dashCdMul[relicLevel('berserkerGrip')];
  if(hasRelic('quantumDash'))   cd*=RELIC_LEVELS.quantumDash.cdMul[relicLevel('quantumDash')];
  // Heavy Boots — team-wide CD multiplier on top.
  cd *= heavyBootsCdMul();
  return cd;
}
function dashDistanceMult(){ return hasRelic('quantumDash') ? RELIC_LEVELS.quantumDash.distMul[relicLevel('quantumDash')] : 1; }

function dashDirection(){
  let dx=0,dz=0;
  if(realIsMobile){
    dx=joy.L.dx; dz=joy.L.dy;
    if(Math.hypot(dx,dz)<0.15){dx=joy.R.dx; dz=joy.R.dy;}
  } else {
    if(keys[NB_KEYBINDS.left]||keys['ArrowLeft']) dx-=1;
    if(keys[NB_KEYBINDS.right]||keys['ArrowRight']) dx+=1;
    if(keys[NB_KEYBINDS.up]||keys['ArrowUp']) dz-=1;
    if(keys[NB_KEYBINDS.down]||keys['ArrowDown']) dz+=1;
    if(Math.hypot(dx,dz)<0.15 && mouse.world){
      dx=mouse.world.x-player.pos.x; dz=mouse.world.z-player.pos.z;
    }
  }
  let len=Math.hypot(dx,dz);
  if(len<0.15&&player.mesh){dx=Math.sin(player.mesh.rotation.y); dz=Math.cos(player.mesh.rotation.y); len=Math.hypot(dx,dz);}
  len=len||1;
  return {x:dx/len,z:dz/len};
}

function startDash(){
  if(nbPaused||gState!=='playing'||player.dead||player.downed||player.dashCd>0||player.dashT>0) return;
  if(player.hookSwingMode==='wall'&&player.hookSwingT>0){
    finishHookSwingWithInertia();
    player.hookInertiaT=0;
  }
  const lvl=playerSkills.dashMastery||0;
  const d=dashDirection();
  player.dashStartX=player.pos.x; player.dashStartZ=player.pos.z;
  player.dashVX=d.x; player.dashVZ=d.z;
  player.dashT=DASH_DUR[lvl]||DASH_DUR[0];
  player.dashCd=dashCooldown();
  player.dashTrailT=0;
  player.dashKinetic=player.kineticCharge||0;
  if(playerSkills.kineticCharge) player.kineticCharge=0;
  player._phaseHitSet=new Set();
  player.invincible=Math.max(player.invincible,0.18+(playerSkills.phaseStep||0)*0.04);
  burst(player.pos,0x44aaff,isMobile?4:8);
  spawnShockwave(player.pos.x,player.pos.z,0.85,0x44aaff,0.18,0.65);
  sDashMove();
  if(playerSkills.mineLayer) spawnMine(player.pos.x,player.pos.z);
}

function applyPhaseStepHit(idx,lvl){
  const e=enemies[idx]; if(!e||e.dead) return;
  slowMap.set(e.poolIdx,Math.max(slowMap.get(e.poolIdx)||0,PHASE_SLOW[lvl]||0));
  const prev=phaseVulnMap.get(e.poolIdx);
  phaseVulnMap.set(e.poolIdx,{t:1.8+lvl*0.18,mult:Math.max(prev?.mult||0,PHASE_VULN[lvl]||0)});
  spawnZapLine(player.pos.x,player.pos.z,e.pos.x,e.pos.z);
  spawnShockwave(e.pos.x,e.pos.z,0.62+lvl*0.08,0x88ddff,0.18,0.5);
  sPhaseStep();
}

function phaseStepPulse(radius,lvl){
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i]; if(e.dead||player._phaseHitSet?.has(e.poolIdx)) continue;
    if(Math.hypot(e.pos.x-player.pos.x,e.pos.z-player.pos.z)<radius+e.cfg.r){
      player._phaseHitSet.add(e.poolIdx);
      applyPhaseStepHit(i,lvl);
    }
  }
}

function sendAfterimageZoneMP(x,z,lvl){
  if(!mp.connected||mp.soloMode) return;
  const msg={
    type:'AFTERIMAGE_ZONE',id:mp.myId,
    x:Math.round(x*100)/100,z:Math.round(z*100)/100,
    lvl:Math.max(1,Math.min(5,lvl|0)),
  };
  if(mp.isHost) broadcastMP(msg);
  else sendToHost(msg);
}

function spawnAfterimageCharge(x,z,lvl,opts={}){
  const visualOnly=!!opts.visualOnly;
  const relay=opts.relay!==false;
  const r=AFTER_R[lvl]||AFTER_R[1];
  const geo=new THREE.RingGeometry(Math.max(0.18,r*0.28),Math.max(0.32,r*0.34),isMobile?18:28);
  const mat=new THREE.MeshBasicMaterial({color:0x44aaff,transparent:true,opacity:0.52,blending:THREE.AdditiveBlending,depthWrite:false});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.rotation.x=-Math.PI/2; mesh.position.set(x,0.052,z);
  scene.add(mesh);
  afterimageZones.push({mesh,mat,x,z,lvl,r,t:0,delay:AFTER_DELAY[lvl]||0.36,dmg:Math.round((AFTER_DMG[lvl]||100)*atkScale()),visualOnly});
  if(!isMobile) spawnShockwave(x,z,r*0.52,0x2277ff,0.16,0.34);
  if(relay) sendAfterimageZoneMP(x,z,lvl);
}

function detonateAfterimageZone(z){
  burst({x:z.x,z:z.z},0x44aaff,isMobile?6:12);
  burst({x:z.x,z:z.z},0xffffff,isMobile?3:6);
  spawnShockwave(z.x,z.z,z.r,0x44aaff,0.22,0.82);
  flashLight({x:z.x,z:z.z},0x44aaff,2.2,4.2,0.12);
  if(!z.visualOnly){
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i]; if(!e||e.dead) continue;
      if(Math.hypot(e.pos.x-z.x,e.pos.z-z.z)<z.r+e.cfg.r){
        damageEnemyIndex(i,z.dmg,0x44aaff,0.14,mp.myId,'movement');
      }
    }
  }
  sAfterimageBurst();
}

// ── Health Bag Pickups (Loot Goblin luck skill) ─────────────
// World-space pickups dropped from kills. Any player can walk over to collect.
// MP sync: host rolls the drop on kill and broadcasts HEAL_BAG_SPAWN. Each client
// runs its own pickup detection against the local player and broadcasts
// HEAL_BAG_PICKUP, which despawns the bag for everyone.
const healBags = [];
let _healBagIdCounter = 1;

function buildHealBagMesh(){
  const g = new THREE.Group();
  const outer = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.30, 0),
    new THREE.MeshBasicMaterial({color:0x44ff88, transparent:true, opacity:0.85, blending:THREE.AdditiveBlending, depthWrite:false})
  );
  g.add(outer); g.userData.outer = outer;
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 12, 10),
    new THREE.MeshBasicMaterial({color:0x88ffaa, transparent:true, opacity:0.30, blending:THREE.AdditiveBlending, depthWrite:false})
  );
  g.add(glow); g.userData.glow = glow;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.44, 0.58, 18),
    new THREE.MeshBasicMaterial({color:0xaaffbb, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false})
  );
  ring.rotation.x = -Math.PI/2;
  g.add(ring); g.userData.ring = ring;
  return g;
}

function spawnHealBag(x, z, healPct, idOverride=null, fromRemote=false){
  const id = idOverride !== null ? idOverride : _healBagIdCounter++;
  if(healBags.some(b => b.id === id)) return; // dedupe in case of network echo
  const mesh = buildHealBagMesh();
  mesh.position.set(x, 0.7, z);
  scene.add(mesh);
  healBags.push({mesh, id, pos:{x,z}, healPct, ttl:25, claimed:false});
  burst({x,z:z}, 0x44ff88, 6);
  if(!fromRemote && !mp.soloMode){
    broadcastMP({type:'HEAL_BAG_SPAWN', id, x:Math.round(x*100)/100, z:Math.round(z*100)/100, pct:healPct});
  }
}

function _disposeHealBag(b){
  scene.remove(b.mesh);
  b.mesh.traverse(o=>{ o.geometry?.dispose?.(); o.material?.dispose?.(); });
  const idx = healBags.indexOf(b);
  if(idx>=0) healBags.splice(idx, 1);
}

function consumeHealBagLocal(b){
  if(b.claimed) return;
  b.claimed = true;
  // Heal % of picker's own max HP — so the same bag is more valuable to high-HP builds.
  const healAmt = Math.max(1, Math.round((playerStats.maxHp||100) * (b.healPct||0)));
  const gained = healPlayer(healAmt);
  if(gained) dmgNum('+'+gained+' HP', player.pos, '#44ff88');
  burst(player.pos, 0x44ff88, 10);
  impactPulse(player.pos, 0x44ff88, 1.2, 6);
  if(!mp.soloMode) broadcastMP({type:'HEAL_BAG_PICKUP', id:b.id, by:mp.myId});
  _disposeHealBag(b);
}

function removeHealBagById(id){
  const b = healBags.find(x => x.id === id);
  if(b) _disposeHealBag(b);
}

// ── Buff Cache drops (Loot Drop epic skill) ──────────────────────
// Same MP pattern as healBags: roller broadcasts SPAWN, picker broadcasts
// PICKUP and applies the buff locally only.
const BUFF_TYPES = [
  { id:'dmg',       label:'+50% DMG',    icon:'⚔️', color:0xff3344, glow:0xff7777, dur:10 },
  { id:'fireRate',  label:'+50% RATE',   icon:'⚡', color:0xffdd44, glow:0xffee88, dur:10 },
  { id:'speed',     label:'+40% SPEED',  icon:'💨', color:0x66ddff, glow:0xaaeeff, dur:10 },
  { id:'defense',   label:'-50% DMG TAKEN', icon:'🛡️', color:0x66ff99, glow:0xaaffcc, dur:10 },
  { id:'heal',      label:'+50% HEAL',   icon:'💖', color:0xff77bb, glow:0xffaadd, dur:0 },
];
const BUFF_BY_ID = Object.fromEntries(BUFF_TYPES.map(b=>[b.id,b]));
const buffDrops = [];
let _buffDropIdCounter = 1;
// Active per-buff timers on the local player. Per-id so the same buff overwrites
// itself (cannot stack with itself, per user spec) but two different buffs can
// run side-by-side. value is dur remaining in seconds (heal has no entry).
if(typeof window!=='undefined') window._activeBuffs = window._activeBuffs || {};
const activeBuffs = window._activeBuffs;
function buffActive(id){ return (activeBuffs[id]||0) > 0; }
function buffDamageMult(){ return buffActive('dmg') ? 1.5 : 1; }
function buffFireRateMult(){ return buffActive('fireRate') ? 0.5 : 1; }
function buffSpeedMult(){ return buffActive('speed') ? 1.4 : 1; }
function buffDefenseMult(){ return buffActive('defense') ? 0.5 : 1; }
function tickActiveBuffs(dt){
  let anyActive=false;
  for(const k of Object.keys(activeBuffs)){
    if(activeBuffs[k]>0){
      activeBuffs[k]-=dt;
      if(activeBuffs[k]<=0){ activeBuffs[k]=0; }
      anyActive=true;
    }
  }
  if(anyActive) renderActiveBuffsHud();
}
function renderActiveBuffsHud(){
  const el=document.getElementById('activeBuffs'); if(!el) return;
  const parts=[];
  for(const b of BUFF_TYPES){
    if(b.id==='heal') continue;
    const t=activeBuffs[b.id]||0;
    if(t>0) parts.push(`<span style="color:#${b.color.toString(16).padStart(6,'0')};margin-right:6px">${b.icon}${t.toFixed(1)}s</span>`);
  }
  el.innerHTML=parts.join('');
}
// ── Cursed relic indicator under HP bar ───────────────────
// Lists every cursed relic anyone in the lobby currently has, with the
// holder's name + relic level. Re-rendered when relics change.
function renderCursedRelicPanel(){
  const el=document.getElementById('cursedRelicPanel'); if(!el) return;
  const rows=[];
  const _ownLine = (ownerName, id, lvl)=>{
    const def=RELIC_DEFS[id]; if(!def) return;
    const tier=['','I','II','III'][lvl] || '';
    rows.push(`<div><span style="opacity:0.85">${ownerName} →</span> ${def.icon||'💀'} <b>${def.name}${tier?' '+tier:''}</b></div>`);
  };
  // Local player
  const myName = (mp && mp.names && mp.names[mp.myId]) || 'YOU';
  for(const id of Object.keys(RELIC_DEFS)){
    if(!RELIC_DEFS[id].cursed) continue;
    const lvl=relicLevel(id);
    if(lvl>0) _ownLine(myName, id, lvl);
  }
  // Remote players
  if(mp && mp.remotePlayers){
    for(const [pid,rp] of Object.entries(mp.remotePlayers)){
      if(!rp || !rp.relics) continue;
      const name = (mp.names && mp.names[pid]) || ('P'+(Number(pid)+1));
      for(const id of Object.keys(RELIC_DEFS)){
        if(!RELIC_DEFS[id].cursed) continue;
        const v=rp.relics[id]; const lvl=(v===true)?1:(v|0);
        if(lvl>0) _ownLine(name, id, lvl);
      }
    }
  }
  if(rows.length===0){ el.style.display='none'; el.innerHTML=''; return; }
  el.innerHTML = `<div style="color:#ffaa66;font-weight:700;letter-spacing:1.6px;">💀 CURSE ACTIVE</div>${rows.join('')}`;
  el.style.display='block';
}
function buildBuffDropMesh(type){
  const def=BUFF_BY_ID[type]||BUFF_TYPES[0];
  const g=new THREE.Group();
  const core=new THREE.Mesh(
    new THREE.OctahedronGeometry(0.34,0),
    new THREE.MeshBasicMaterial({color:def.color,transparent:true,opacity:0.92,blending:THREE.AdditiveBlending,depthWrite:false})
  );
  g.add(core); g.userData.core=core;
  const halo=new THREE.Mesh(
    new THREE.SphereGeometry(0.52,12,10),
    new THREE.MeshBasicMaterial({color:def.glow,transparent:true,opacity:0.28,blending:THREE.AdditiveBlending,depthWrite:false})
  );
  g.add(halo); g.userData.halo=halo;
  const ring=new THREE.Mesh(
    new THREE.RingGeometry(0.48,0.62,20),
    new THREE.MeshBasicMaterial({color:def.glow,transparent:true,opacity:0.55,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false})
  );
  ring.rotation.x=-Math.PI/2;
  g.add(ring); g.userData.ring=ring;
  return g;
}
function spawnBuffDrop(x,z,typeOverride=null,idOverride=null,fromRemote=false){
  const type=typeOverride||BUFF_TYPES[Math.floor(Math.random()*BUFF_TYPES.length)].id;
  const id=idOverride!==null?idOverride:_buffDropIdCounter++;
  if(buffDrops.some(d=>d.id===id)) return;
  const def=BUFF_BY_ID[type]||BUFF_TYPES[0];
  const mesh=buildBuffDropMesh(type);
  mesh.position.set(x,0.7,z);
  scene.add(mesh);
  buffDrops.push({mesh,id,pos:{x,z},type,ttl:25,claimed:false});
  burst({x,z},def.color,isMobile?5:9);
  spawnShockwave(x,z,0.85,def.glow,0.18,0.45);
  sBuffDrop();
  if(!fromRemote && !mp.soloMode){
    broadcastMP({type:'BUFF_DROP_SPAWN',id,x:Math.round(x*100)/100,z:Math.round(z*100)/100,t:type});
  }
}
function _disposeBuffDrop(d){
  scene.remove(d.mesh);
  d.mesh.traverse(o=>{ o.geometry?.dispose?.(); o.material?.dispose?.(); });
  const idx=buffDrops.indexOf(d);
  if(idx>=0) buffDrops.splice(idx,1);
}
function removeBuffDropById(id){
  const d=buffDrops.find(x=>x.id===id);
  if(d) _disposeBuffDrop(d);
}
function consumeBuffDropLocal(d){
  if(d.claimed) return;
  d.claimed=true;
  const def=BUFF_BY_ID[d.type]||BUFF_TYPES[0];
  if(d.type==='heal'){
    const heal=Math.max(1,Math.round((playerStats.maxHp||100)*0.5));
    const gained=healPlayer(heal);
    if(gained) dmgNum('+'+gained+' HP',player.pos,'#ff77bb');
  } else {
    activeBuffs[d.type]=def.dur;
    dmgNum(def.icon+' '+def.label,player.pos,'#'+def.color.toString(16).padStart(6,'0'));
    renderActiveBuffsHud();
  }
  burst(player.pos,def.color,isMobile?6:12);
  impactPulse(player.pos,def.glow,1.0,isMobile?4:8);
  spawnSkillRingAura(player.pos.x,player.pos.z,1.1,def.glow,0.32,0.46);
  sBuffPick();
  if(!mp.soloMode) broadcastMP({type:'BUFF_DROP_PICKUP',id:d.id,by:mp.myId});
  _disposeBuffDrop(d);
}
function updateBuffDrops(dt){
  const now=performance.now();
  tickActiveBuffs(dt);
  for(let i=buffDrops.length-1;i>=0;i--){
    const d=buffDrops[i];
    d.ttl-=dt;
    d.mesh.position.y=0.7+Math.sin(now*0.005+d.id*0.7)*0.10;
    d.mesh.rotation.y+=dt*1.8;
    if(d.mesh.userData.core) d.mesh.userData.core.rotation.x+=dt*1.4;
    if(d.mesh.userData.halo) d.mesh.userData.halo.material.opacity=0.24+0.10*Math.sin(now*0.008+d.id);
    if(d.ttl<=0){ _disposeBuffDrop(d); continue; }
    if(d.claimed) continue;
    // Greedy Crown — at L2+ also blocks buff drops (L1 only blocks heal bags).
    if(typeof greedyCrownBlocksMe==='function' && greedyCrownBlocksMe()){
      const scope=greedyCrownActiveScope();
      if(scope==='heal+buff' || scope==='all') continue;
    }
    if(player && !player.dead && Math.hypot(d.pos.x-player.pos.x,d.pos.z-player.pos.z)<0.92){
      consumeBuffDropLocal(d);
    }
  }
}

function updateHealBags(dt){
  const now = performance.now();
  for(let i=healBags.length-1; i>=0; i--){
    const b = healBags[i];
    b.ttl -= dt;
    b.mesh.position.y = 0.7 + Math.sin(now*0.005 + b.id*0.7)*0.10;
    b.mesh.rotation.y += dt*1.8;
    if(b.mesh.userData.outer) b.mesh.userData.outer.rotation.x += dt*1.2;
    if(b.mesh.userData.glow)  b.mesh.userData.glow.material.opacity = 0.26 + 0.10*Math.sin(now*0.008 + b.id);
    if(b.ttl <= 0){ _disposeHealBag(b); continue; }
    if(b.claimed) continue;
    // Greedy Crown (cursed) — if a teammate owns the Crown, I can't pick up.
    if(typeof greedyCrownBlocksMe==='function' && greedyCrownBlocksMe()) continue;
    if(player && !player.dead){
      const mdx=player.pos.x-b.pos.x, mdz=player.pos.z-b.pos.z;
      const md=Math.hypot(mdx,mdz);
      // Magnet: within range the bag accelerates toward you (faster the closer
      // it gets) so you vacuum drops up instead of pixel-hunting them.
      const MAG=3.8;
      if(md<MAG && md>0.001){
        const pull=(0.35+(1-md/MAG)*0.65)*16*dt;
        b.pos.x+=mdx/md*Math.min(pull,md); b.pos.z+=mdz/md*Math.min(pull,md);
        b.mesh.position.x=b.pos.x; b.mesh.position.z=b.pos.z;
      }
      if(md<0.92) consumeHealBagLocal(b);
    }
  }
}

function updateAfterimageZones(dt){
  for(let i=afterimageZones.length-1;i>=0;i--){
    const z=afterimageZones[i];
    z.t+=dt;
    const p=Math.min(1,z.t/z.delay);
    const pulse=0.88+0.16*Math.sin(z.t*38);
    z.mesh.scale.setScalar((0.72+p*0.9)*pulse);
    z.mat.opacity=0.58*(1-p)+0.15;
    z.mesh.rotation.z+=dt*(3.5+z.lvl);
    if(z.t>=z.delay){
      detonateAfterimageZone(z);
      scene.remove(z.mesh); z.mesh.geometry.dispose(); z.mat.dispose();
      afterimageZones.splice(i,1);
    }
  }
}

function sendBlinkStrikeMP(x,z,lvl){
  if(!mp.connected||mp.soloMode) return;
  const msg={
    type:'BLINK_STRIKE',id:mp.myId,
    x:Math.round(x*100)/100,z:Math.round(z*100)/100,
    lvl:Math.max(1,Math.min(5,lvl|0)),
  };
  if(mp.isHost) broadcastMP(msg);
  else sendToHost(msg);
}

function performBlinkStrike(x,z,lvl,opts={}){
  const visualOnly=!!opts.visualOnly;
  const relay=opts.relay!==false;
  const r=BLINK_RANGE[lvl]||BLINK_RANGE[1];
  spawnSwordSlash(x,z,r,lvl);
  if(!visualOnly){
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i]; if(!e||e.dead) continue;
      if(Math.hypot(e.pos.x-x,e.pos.z-z)<r+e.cfg.r){
        damageEnemyIndex(i,Math.round(BLINK_DMG[lvl]*atkScale()),0xdffcff,0.22,mp.myId,'movement');
      }
    }
  }
  sBlinkStrike();
  if(relay) sendBlinkStrikeMP(x,z,lvl);
}

function finishDash(){
  const sx=Number.isFinite(player.dashStartX)?player.dashStartX:player.pos.x;
  const sz=Number.isFinite(player.dashStartZ)?player.dashStartZ:player.pos.z;
  if(playerSkills.starfallDash) castPlayerMeteor(player.pos.x,player.pos.z,3.0,Math.round(playerStats.attackDmg*9.0),0xffdd66,0.50);
  if(playerSkills.echoStep&&Math.hypot(player.pos.x-sx,player.pos.z-sz)>0.6){
    const ex=player.pos.x, ez=player.pos.z;
    const len=Math.hypot(ex-sx,ez-sz);
    const ang=Math.atan2(ex-sx,ez-sz);
    spawnWarningLine((sx+ex)*0.5,(sz+ez)*0.5,ang,len,1.25,0x44aaff,0.42,()=>{
      for(let i=enemies.length-1;i>=0;i--){
        const e=enemies[i]; if(!e||e.dead) continue;
        if(segmentPointDistance(e.pos.x,e.pos.z,sx,sz,ex,ez)<=1.25+e.cfg.r) damageEnemyIndex(i,Math.round(playerStats.attackDmg*7.0),0x44aaff,0.24,mp.myId,'movement');
      }
      spawnShockwave(ex,ez,2.0,0x44aaff,0.20,0.62);
    });
  }
  const bl=playerSkills.blinkStrike||0;
  if(bl){
    performBlinkStrike(player.pos.x,player.pos.z,bl,{visualOnly:mp.connected&&!mp.soloMode&&!mp.isHost});
  }
  const kc=playerSkills.kineticCharge||0;
  const charge=player.dashKinetic||0;
  if(kc&&charge>0.18){
    const scale=0.45+charge*0.75;
    const r=(KINETIC_R[kc]||1.2)*scale;
    const dmg=Math.round((KINETIC_DMG[kc]||45)*scale*atkScale());
    burst(player.pos,0x33ffcc,isMobile?8:16);
    spawnShockwave(player.pos.x,player.pos.z,r,0x33ffcc,0.24,0.86);
    flashLight(player.pos,0x33ffcc,2.6,5,0.14);
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i]; if(!e||e.dead) continue;
      if(Math.hypot(e.pos.x-player.pos.x,e.pos.z-player.pos.z)<r+e.cfg.r){
        damageEnemyIndex(i,dmg,0x33ffcc,0.18,mp.myId,'movement');
      }
    }
    sKineticBurst(charge);
  }
  player.dashKinetic=0;
}

function tickStatusMaps(dt){
  for(const [k,v] of slowMap){
    const nv=v-dt;
    if(nv<=0) slowMap.delete(k); else slowMap.set(k,nv);
  }
  for(const [k,v] of phaseVulnMap){
    v.t-=dt;
    if(v.t<=0) phaseVulnMap.delete(k);
  }
  tickElementTags(dt);
  // Fog of War challenge — a clear sphere stays visible around the player while
  // everything beyond darkens (player-centred vignette), plus a light scene-fog
  // haze. The old approach just cranked camera-distance fog, which (with the far
  // camera) fogged out the player themselves — now you can always see yourself.
  if(scene && scene.fog){
    // Restore visibility the instant the wave is cleared (all enemies dead),
    // not only when the next wave starts.
    const fogOn = waveEvent && waveEvent.type==='challenge' && waveEvent.sub==='fogOfWar' && !waveClear;
    const vig = document.getElementById('fogVignette');
    if(fogOn){
      if(typeof scene.fog._origDensity!=='number') scene.fog._origDensity = scene.fog.density;
      scene.fog.density = Math.min(0.06, (scene.fog._origDensity||0.024) * 2.2); // light haze only
      if(vig && player){
        vig.classList.add('on');
        _fogProj.set(player.pos.x, 0.6, player.pos.z).project(camera);
        const sx = (_fogProj.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-_fogProj.y * 0.5 + 0.5) * window.innerHeight;
        vig.style.setProperty('--fx', sx + 'px');
        vig.style.setProperty('--fy', sy + 'px');
      }
    } else {
      if(typeof scene.fog._origDensity==='number'){
        scene.fog.density = scene.fog._origDensity;
        scene.fog._origDensity = undefined;
      }
      if(vig) vig.classList.remove('on');
    }
  }
  // Bloodthirst window decay — clears stacks when timer hits 0.
  if(player && (player._btT||0)>0){
    player._btT=Math.max(0,player._btT-dt);
    if(player._btT===0) player._btStacks=0;
  }
  // Ice Spike — periodic random freeze + damage. eff 3 = 4s / 1.5s freeze,
  // eff 5 = 2.5s / 2s freeze. No-op if no enemies alive.
  if(playerSkills.iceSpike && gState==='playing' && !waveTransition && !waveClear){
    iceSpikeCd-=dt;
    if(iceSpikeCd<=0){
      const _isLvl=playerSkills.iceSpike;
      const _isInt=[0,4,4,4,2.5,2.5][_isLvl]||4;
      const _isFreeze=[0,1.5,1.5,1.5,2,2][_isLvl]||1.5;
      iceSpikeCd=_isInt;
      const alive=enemies.filter(e=>!e.dead);
      if(alive.length){
        const tgt=alive[Math.floor(Math.random()*alive.length)];
        const tIdx=enemies.indexOf(tgt);
        if(tIdx>=0){
          const dmg=Math.max(1,Math.round(playerStats.attackDmg*1.6*crystalPowerMult()));
          damageEnemyIndex(tIdx,dmg,0x88ddff,0.2,mp.myId,'melee');
          applyEnemySlow(tgt,_isFreeze);
          burst(tgt.pos,0x88ddff,isMobile?5:10);
          spawnShockwave(tgt.pos.x,tgt.pos.z,0.9,0xaaeaff,0.20,0.5);
          if(typeof sIceHit==='function') sIceHit();
          tagElement(tgt,'ice',dmg);
        }
      }
    }
  }
}

function showHitNumber(enemy, dmg, color, ownerId=mp.myId, source='skill'){
  if(!enemy) return;
  enemy.grassRevealT=Math.max(enemy.grassRevealT||0,0.95);
  const sourceKey=normalizeDamageSource(source);
  const sourceMeta=DAMAGE_SOURCE_META[sourceKey]||DAMAGE_SOURCE_META.skill;
  recordDamageDealt(dmg,ownerId,sourceKey);
  enemy._lastHitOwner=ownerId;
  if(enemy.type==='boss'&&ownerId===mp.myId){
    currentBossTargetPoolIdx=enemy.poolIdx;
    updateBossBarFromEnemy(enemy);
  }
  const crit=!!enemy._lastCrit;
  const srcPrefix=(sourceKey!=='skill'&&sourceKey!=='bullet') ? sourceMeta.label+' ' : '';
  dmgNum((crit?'CRIT ':srcPrefix+'-')+dmg,_scratchPos.set(enemy.pos.x,0,enemy.pos.z),crit?'#ffd700':(sourceMeta.color||color));
  if(crit){
    burst(enemy.pos,0xffdd55,isMobile?4:8);
    impactPulse(enemy.pos,0xffdd55,0.8,isMobile?3:5);
  }
  enemy._lastCrit=false;
}

function afterBuffSelect(){
  // Challenge-event reward chooser runs after the normal wave-clear pick.
  // Player decides between an extra relic or a fresh skill card; the choice
  // routes into either showChallengeRelicPick or the normal bonus-pick loop.
  if(_challengeRewardPending){
    showChallengeRewardChoice();
    return;
  }
  // Cursed Shrine gamble menu — fires after scheduled curse waves.
  if(_cursedShrinePending){
    showCursedShrine();
    return;
  }
  // No-damage bounty reward: a guaranteed EPIC card (the hardest bounty pays the
  // best). Uses the shrine card-pick renderer with a bounty-themed title.
  if(_eventEpicReward){
    _eventEpicReward=false;
    annText('★ FLAWLESS — EPIC REWARD','#ff66cc');
    showShrineCardPick('epic', '★ BOUNTY REWARD', 'CHOOSE AN EPIC SKILL');
    return;
  }
  // Wave-event bonus picks (loot / mini / bounty completion) — re-open buff
  // select before advancing. Each bonus pick consumes one counter; multiple
  // events stacking is theoretically possible if we ever chain them.
  if(_eventBonusPicksLeft>0){
    _eventBonusPicksLeft--;
    _currentOffering=[];
    _offeringPicked.clear();
    // Title for the bonus card reflects which event earned it. waveEvent
    // may be null by this point if the wave already advanced — fall back to
    // a generic 'loot' label so the user sees a sensible title either way.
    if(waveEvent && SKILL_PICK_TITLES[waveEvent.type]) _skillPickContext=waveEvent.type;
    else _skillPickContext='loot';
    annText('★ BONUS PICK','#ffd166');
    showBuffSelect('skill');
    return;
  }
  if(mp.soloMode&&shouldOpenRunShopAfterWave()){
    startRunShopRound();
    return;
  }
  if(mp.soloMode){ nextWave(); return; }
  mp.buffReady[mp.myId]=true;
  removeBuffRerollButtons();
  showBuffWaiting();
  if(mp.isHost){
    markBuffReady(mp.myId);
  } else {
    sendToHost({type:'BUFF_READY',id:mp.myId,wave:waveNum});
  }
}

function isLocalDevRun(){
  const h=location.hostname;
  const isLocalHost=location.protocol==='file:'||h==='localhost'||h==='127.0.0.1'||h==='::1'||h.endsWith('.local');
  return isLocalHost && (mp.soloMode || !mp.connected);
}
function devClearCombatEntities(){
  for(const b of bulletPool) if(b.active) releaseBullet(b);
  enemies.forEach(e=>{ e.dead=true; releaseEnemySlot(e); });
  enemies.length=0;
  _waveSpawnQueue.length=0; _waveSpawnTimer=0;
  for(const p of partPool){ if(p.active){p.active=false;p.mesh.visible=false;} }
}
function devWinWaveNow(){
  if(!isLocalDevRun()){ annText('LOCAL TEST ONLY','#ff5577'); return false; }
  if(gState==='buffselect') return devPickCardNow();
  if(gState!=='playing'||!waveSpawned){ annText('NO ACTIVE WAVE','#ffaa00'); return false; }
  const wasBoss=_bossClearPending||waveNum%5===0||enemies.some(e=>e.type==='boss');
  devClearCombatEntities();
  waveTransition=false;
  waveClear=true;
  reviveTeamForWaveClear();
  document.getElementById('bossBar').style.display='none';
  if(wasBoss){
    _bossClearPending=false;
    _firstSkillPickDone=false;
    annText('DEV: BOSS CLEAR','#ffd700');
    showBuffSelect('boss');
  } else {
    annText('DEV: WAVE CLEAR','#00ff88');
    closeExit();
    clearMapSpellsAndAllies();
    showBuffSelect(waveNum%2!==0?'status':'skill');
  }
  return true;
}
function devPickCardNow(){
  if(!isLocalDevRun()){ annText('LOCAL TEST ONLY','#ff5577'); return false; }
  if(gState!=='buffselect'){ annText('NO CARD SCREEN','#ffaa00'); return false; }
  const phase=_buffSelectPhase;
  const cards=document.getElementById('buffCards');
  const card=cards?.querySelector('.buff-card');
  if(!card) return false;
  card.click();
  if(phase==='status'){
    setTimeout(()=>devPickCardNow(),30);
  } else if(phase==='boss'){
    setTimeout(()=>{
      if(gState==='playing'&&waveClear){
        waveClear=false;
        closeExit();
        clearMapSpellsAndAllies();
        nextWave();
      }
    },30);
  }
  return true;
}
function devWinAndPickNow(){
  if(devWinWaveNow()) setTimeout(()=>devPickCardNow(),50);
}

function updateSkillHUD(){
  const el=document.getElementById('buffs'); el.innerHTML='';
  Object.entries(playerSkillPicks).forEach(([id,lvl])=>{
    if(!lvl||!SKILL_DEFS[id]) return;
    const d=document.createElement('span'); d.className='skill-pip';
    d.textContent=`${SKILL_DEFS[id].icon} ${skillRarity(id)[0].toUpperCase()}${lvl}/${skillMaxLevel(id)}`;
    el.appendChild(d);
  });
}

// ── Input ─────────────────────────────────────────────────
const keys  = {};
// Rebindable gameplay keys (stored as KeyboardEvent.code). Movement still
// accepts arrow keys as a fixed fallback. Edited via Settings > Keybind.
const NB_KEYBIND_DEFAULTS = {up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',dash:'Space',melee:'KeyF',reload:'KeyR',interact:'KeyE'};
let NB_KEYBINDS = Object.assign({}, NB_KEYBIND_DEFAULTS);
try{ const _kb=JSON.parse(localStorage.getItem('nbKeybinds')||'null'); if(_kb&&typeof _kb==='object') for(const k in NB_KEYBIND_DEFAULTS) if(_kb[k]) NB_KEYBINDS[k]=_kb[k]; }catch(_){}
const mouse = {x:innerWidth/2,y:innerHeight/2,down:false,world:new THREE.Vector3(),hasWorld:false};
// Shared scratch vectors — reused to avoid per-frame Vector3 allocations
const _scratchDir = new THREE.Vector3();
const _scratchPos = new THREE.Vector3();
const _scratchProj = new THREE.Vector3();
let _spellTapped = false;
let _dashTapped = false;
const raycaster   = new THREE.Raycaster();
const BULLET_AIM_Y = 0.55;
const aimPlane = new THREE.Plane(new THREE.Vector3(0,1,0),-BULLET_AIM_Y);

function updateMouseWorld(){
  const rect=_canvasRect||canvas.getBoundingClientRect();
  const nx=((mouse.x-rect.left)/rect.width)*2-1, ny=-((mouse.y-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera({x:nx,y:ny},camera);
  mouse.hasWorld=!!raycaster.ray.intersectPlane(aimPlane,mouse.world);
}

window.addEventListener('keydown',e=>{
  const wasDown=!!keys[e.code];
  keys[e.code]=true;
  if(!wasDown && !e.repeat && e.code==='Escape' && (gState==='playing'||gState==='shopround')){
    if(!nbPaused) nbPauseOpen();
    else if(document.getElementById('menu').style.display==='flex') nbSettingsBack(); // ESC backs out of the settings page to the pause menu
    else nbResume();
    e.preventDefault();
    return;
  }
  if(nbPaused||(gState!=='playing'&&gState!=='shopround')){
    delete keys[e.code];
    return;
  }
  if(!wasDown&&e.code==='F8'){
    devWinWaveNow();
    e.preventDefault();
    return;
  }
  if(!wasDown&&e.code==='F9'){
    devPickCardNow();
    e.preventDefault();
    return;
  }
  if(!wasDown&&e.code==='F10'){
    devWinAndPickNow();
    e.preventDefault();
    return;
  }
  if(e.code===NB_KEYBINDS.dash){
    if(!wasDown) startDash();
    e.preventDefault();
  }
  if(!wasDown&&e.code===NB_KEYBINDS.melee){
    if(player&&player.hookSwingMode==='wall'&&player.hookSwingT>0){
      finishHookSwingWithInertia();
      e.preventDefault();
      return;
    }
    useMeleeAttack();
    e.preventDefault();
  }
  if(!wasDown&&e.code===NB_KEYBINDS.reload){
    // Manual reload — only fires when not already reloading and mag isn't
    // already full. Triggering reload at 0 ammo just starts the timer the
    // same way the auto-reload does.
    startManualReload();
    e.preventDefault();
  }
  if(!wasDown&&e.code===NB_KEYBINDS.interact){
    if(tryInteract()) e.preventDefault();
  }
});
// Shared by the E key and the mobile USE button — returns true if something activated.
function tryInteract(){
  if(nbPaused) return false;
  if(gState==='playing' && waveClear && _waveTotemOfferPending && player && Math.hypot(player.pos.x-WAVE_TOTEM_POS.x,player.pos.z-WAVE_TOTEM_POS.z)<1.9){
    activateWaveTotem();
    return true;
  } else if(gState==='shopround' && player && !shopTotemDestroyed && Math.hypot(player.pos.x-SHOP_TOTEM_POS.x,player.pos.z-SHOP_TOTEM_POS.z)<1.9){
    activateShopTotem();
    return true;
  } else if(gState==='shopround' && player && Math.hypot(player.pos.x,player.pos.z)<2.3){
    openRunShopUI();
    return true;
  }
  return false;
}
window.addEventListener('keyup',  e=>{delete keys[e.code];});
window.addEventListener('mousemove',e=>{
  mouse.x=e.clientX; mouse.y=e.clientY;
  updateMouseWorld();
});
window.addEventListener('mousedown',e=>{
  if(e.button===0){
    if(nbPaused||(gState!=='playing'&&gState!=='shopround')||e.target.closest?.('button,input,select,textarea')) return;
    if(gState==='playing' && waveClear && _waveTotemOfferPending && player && Math.hypot(player.pos.x-WAVE_TOTEM_POS.x,player.pos.z-WAVE_TOTEM_POS.z)<1.9){
      activateWaveTotem();
      e.preventDefault();
      return;
    }
    if(gState==='shopround' && player && !shopTotemDestroyed && Math.hypot(player.pos.x-SHOP_TOTEM_POS.x,player.pos.z-SHOP_TOTEM_POS.z)<1.9){
      activateShopTotem();
      e.preventDefault();
      return;
    }
    // Shop overlay open: the click is for buy/reroll buttons, not firing.
    if(_runShopUIOpen) return;
    mouse.down=true;
  }
});
window.addEventListener('mouseup',  e=>{if(e.button===0)mouse.down=false;});
window.addEventListener('contextmenu', e=>e.preventDefault());   // right-click was popping the browser's "Save image as" menu over the canvas

const chEl = document.getElementById('crosshair');
if(!realIsMobile){
  chEl.style.display='block'; document.body.style.cursor='none';
  window.addEventListener('mousemove',e=>{chEl.style.left=(e.clientX-12)+'px';chEl.style.top=(e.clientY-12)+'px';});
}

// ── Mobile joystick ───────────────────────────────────────
const jL=document.getElementById('jL'),jR=document.getElementById('jR');
const jLk=document.getElementById('jLk'),jRk=document.getElementById('jRk');
const joy={L:{act:false,id:-1,sx:0,sy:0,dx:0,dy:0},R:{act:false,id:-1,sx:0,sy:0,dx:0,dy:0}};
function resetGameplayInput(){
  cancelGravityCharge();
  for(const key of Object.keys(keys)) delete keys[key];
  mouse.down=false;_dashTapped=false;_spellTapped=false;
  for(const side of ['L','R']) Object.assign(joy[side],{act:false,id:-1,dx:0,dy:0});
  jLk.style.transform=jRk.style.transform='translate(-50%,-50%)';
}
window.addEventListener('blur',resetGameplayInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden) resetGameplayInput();});
const JR_MAX=52;
if(realIsMobile){
  jL.style.display=jR.style.display='flex';
  function onTouch(ev){
    // Only act as a joystick during actual gameplay, and only consume (prevent
    // default on) touches we actually handle. Otherwise menu / difficulty /
    // gun-select / shop taps + scrolling stay normal on mobile — touching the
    // whole window unconditionally is what made the game feel "stuck".
    const playing = !nbPaused&&!_runShopUIOpen&&(gState==='playing'||gState==='shopround');
    let handled = false;
    for(let i=0;i<ev.changedTouches.length;i++){
      const t=ev.changedTouches[i];
      const cx=t.clientX,cy=t.clientY;
      const up=ev.type==='touchend'||ev.type==='touchcancel';
      if(!up){
        if(!playing||ev.target.closest?.('button,input,select,textarea,#dashBtn,#spellBtn,#meleeBtn,#useBtn,#touchPauseBtn')) continue;
        const inBand = cy>innerHeight-260;
        const start=ev.type==='touchstart';
        const owned=joy.L.id===t.identifier||joy.R.id===t.identifier;
        const inL = start&&!owned&&!joy.L.act&&inBand&&cx<innerWidth*0.5;
        const inR = start&&!owned&&!joy.R.act&&inBand&&cx>=innerWidth*0.5;
        if(inL||(joy.L.act&&joy.L.id===t.identifier)){
          if(inL){joy.L.sx=cx;joy.L.sy=cy;joy.L.id=t.identifier;joy.L.act=true;}
          const dx=Math.max(-JR_MAX,Math.min(JR_MAX,cx-joy.L.sx));
          const dy=Math.max(-JR_MAX,Math.min(JR_MAX,cy-joy.L.sy));
          joy.L.dx=dx/JR_MAX; joy.L.dy=dy/JR_MAX;
          jLk.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
          handled=true;
        }
        if(inR||(joy.R.act&&joy.R.id===t.identifier)){
          if(inR){joy.R.sx=cx;joy.R.sy=cy;joy.R.id=t.identifier;joy.R.act=true;}
          const dx=Math.max(-JR_MAX,Math.min(JR_MAX,cx-joy.R.sx));
          const dy=Math.max(-JR_MAX,Math.min(JR_MAX,cy-joy.R.sy));
          joy.R.dx=dx/JR_MAX; joy.R.dy=dy/JR_MAX;
          jRk.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
          handled=true;
        }
      } else {
        if(joy.L.id===t.identifier){joy.L.act=false;joy.L.dx=0;joy.L.dy=0;joy.L.id=-1;jLk.style.transform='translate(-50%,-50%)';handled=true;}
        if(joy.R.id===t.identifier){joy.R.act=false;joy.R.dx=0;joy.R.dy=0;joy.R.id=-1;jRk.style.transform='translate(-50%,-50%)';handled=true;}
      }
    }
    if(handled) ev.preventDefault();
  }
  ['touchstart','touchmove','touchend','touchcancel'].forEach(e=>window.addEventListener(e,onTouch,{passive:false}));
  const _dashBtnEl=document.getElementById('dashBtn');
  _dashBtnEl.style.display='flex';
  _dashBtnEl.addEventListener('touchstart',ev=>{ev.preventDefault();if(nbPaused||gState!=='playing') return;startDash();},{passive:false});
  // Mobile spell button
  const _spellBtnEl=document.getElementById('spellBtn');
  _spellBtnEl.addEventListener('touchstart',ev=>{ev.preventDefault();if(!nbPaused&&gState==='playing') _spellTapped=true;},{passive:false});
  // Mobile melee — mirrors the keydown path, including the hook-swing release special case.
  const _meleeBtnEl=document.getElementById('meleeBtn');
  _meleeBtnEl.style.display='flex';
  _meleeBtnEl.addEventListener('touchstart',ev=>{
    ev.preventDefault();
    if(nbPaused||gState!=='playing') return;
    if(player&&player.hookSwingMode==='wall'&&player.hookSwingT>0) finishHookSwingWithInertia();
    else useMeleeAttack();
  },{passive:false});
  // Mobile interact (totem / shop — the "PRESS E" prompt was unreachable on touch).
  const _useBtnEl=document.getElementById('useBtn');
  _useBtnEl.style.display='flex';
  _useBtnEl.addEventListener('touchstart',ev=>{ev.preventDefault();tryInteract();},{passive:false});
  // Mobile pause — same flow as an Escape press.
  const _pauseBtnEl=document.getElementById('touchPauseBtn');
  _pauseBtnEl.style.display='flex';
  _pauseBtnEl.addEventListener('touchstart',ev=>{
    ev.preventDefault();
    if(gState!=='playing'&&gState!=='shopround') return;
    if(!nbPaused) nbPauseOpen();
    else if(document.getElementById('menu').style.display==='flex') nbSettingsBack();
    else nbResume();
  },{passive:false});
}

// Aim trace
// Local-only visual helper. This is never sent through multiplayer sync.
const aimTrace = new THREE.Group();
const aimTraceMat = new THREE.MeshBasicMaterial({
  color:0x00ffff,
  transparent:true,
  opacity:0.35,
  blending:THREE.AdditiveBlending,
  depthWrite:false
});
const aimTraceGlowMat = new THREE.MeshBasicMaterial({
  color:0x38bdf8,
  transparent:true,
  opacity:0.12,
  blending:THREE.AdditiveBlending,
  depthWrite:false
});
const aimTraceBeam = new THREE.Mesh(new THREE.BoxGeometry(0.055,0.035,1), aimTraceMat);
const aimTraceGlow = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.025,1), aimTraceGlowMat);
const aimTraceTip = new THREE.Mesh(
  new THREE.ConeGeometry(0.18,0.42,4),
  new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.58,blending:THREE.AdditiveBlending,depthWrite:false})
);
aimTraceTip.rotation.x = Math.PI / 2;
aimTrace.add(aimTraceGlow, aimTraceBeam, aimTraceTip);
aimTrace.visible = false;
// Above the river-ribbon ceiling (~86) so the aim line + reticle stay visible
// over water instead of being hidden under it. Matches the ground-VFX tier.
aimTrace.renderOrder = 100;
aimTraceGlow.renderOrder = aimTraceBeam.renderOrder = aimTraceTip.renderOrder = 100;
scene.add(aimTrace);

function getLocalAimDir(){
  if(gState!=='playing'||player.dead||player.downed) return null;
  let fx=0, fz=0;
  if(realIsMobile){
    if(!joy.R.act) return null;
    fx=joy.R.dx; fz=joy.R.dy;
  } else {
    if(!mouse.hasWorld) return null;
    fx=mouse.world.x-player.pos.x;
    fz=mouse.world.z-player.pos.z;
  }
  const len=Math.hypot(fx,fz);
  if(len<0.18) return null;
  return {x:fx/len,z:fz/len,firing:mouse.down||(realIsMobile&&joy.R.act&&len>0.25)};
}

function updateAimTrace(){
  if(!realIsMobile) updateMouseWorld();
  const dir=getLocalAimDir();
  if(!dir){
    aimTrace.visible=false;
    return;
  }

  const start=0.92;
  let traceLen=11;
  if(!realIsMobile && mouse.hasWorld){
    const dx=mouse.world.x-player.pos.x, dz=mouse.world.z-player.pos.z;
    traceLen=Math.max(start+0.4, Math.min(Math.hypot(dx,dz), 14));
  }
  const beamLen=traceLen-start;
  aimTrace.visible=true;
  aimTrace.position.set(
    player.pos.x + dir.x * (start + beamLen * 0.5),
    BULLET_AIM_Y,
    player.pos.z + dir.z * (start + beamLen * 0.5)
  );
  aimTrace.rotation.y=Math.atan2(dir.x,dir.z);
  aimTraceBeam.scale.z=beamLen;
  aimTraceGlow.scale.z=beamLen;
  aimTraceTip.position.set(0,0,beamLen*0.5+0.18);
  const pulse=0.5+0.5*Math.sin(performance.now()*0.012);
  aimTraceMat.opacity=dir.firing ? 0.46 : 0.25 + pulse*0.08;
  aimTraceGlowMat.opacity=dir.firing ? 0.20 : 0.09 + pulse*0.04;
}

// Exit portal
const EXIT_Z = -ARENA_H + 1.5;
let exitMesh = null, exitGlow = null, exitOpen = false, exitRingMat = null;
let exitRingMesh = null;
// World-space "x/N AT EXIT" label that floats above the portal in multiplayer so
// everyone can see how many of the team have gathered (the exit waits for all).
let exitLabelSprite=null, _exitLabelCanvas=null, _exitLabelCtx=null, _exitLabelTex=null, _exitLabelLast='';
function drawExitLabel(txt){
  const cv=_exitLabelCanvas, cx=_exitLabelCtx; if(!cx) return;
  cx.clearRect(0,0,cv.width,cv.height);
  cx.font='bold 76px "Segoe UI", Arial, sans-serif';
  cx.textAlign='center'; cx.textBaseline='middle';
  cx.lineWidth=14; cx.strokeStyle='rgba(0,0,0,0.92)';
  cx.strokeText(txt, cv.width/2, cv.height/2);
  cx.fillStyle='#00ffcc';
  cx.fillText(txt, cv.width/2, cv.height/2);
  _exitLabelTex.needsUpdate=true;
}
function refreshExitLabel(){
  if(!exitLabelSprite) return;
  // Solo exits the instant you touch the portal, so the count only matters in MP.
  if(!exitOpen || mp.soloMode || !mp.connected){ exitLabelSprite.visible=false; return; }
  const ids=exitReadyIds();
  const ready=ids.filter(id=>mp.exitReady[id]).length;
  exitLabelSprite.visible=true;
  const txt=`${ready}/${ids.length} AT EXIT`;
  if(txt!==_exitLabelLast){ _exitLabelLast=txt; drawExitLabel(txt); }
}

function ensureExitPortal(){
  if(!exitMesh){
    const tg = new THREE.TorusGeometry(1.4, 0.25, 10, 28);
    const tm = new THREE.MeshBasicMaterial({color:0x00ffcc,depthTest:false});
    exitMesh = new THREE.Mesh(tg, tm);
    exitMesh.rotation.x = Math.PI/2;
    exitMesh.position.set(0, 0.8, EXIT_Z);
    exitMesh.renderOrder=130;
    exitMesh.visible=false;
    scene.add(exitMesh);
    const gl = new THREE.PointLight(0x00ffcc, 4, 7);
    gl.position.set(0, 1.2, EXIT_Z);
    gl.intensity=0;
    scene.add(gl); exitGlow = gl;
    const lc=document.createElement('canvas'); lc.width=640; lc.height=160;
    _exitLabelCanvas=lc; _exitLabelCtx=lc.getContext('2d');
    _exitLabelTex=new THREE.CanvasTexture(lc);
    const lsm=new THREE.SpriteMaterial({map:_exitLabelTex,transparent:true,depthTest:false});
    exitLabelSprite=new THREE.Sprite(lsm);
    exitLabelSprite.position.set(0, 2.8, EXIT_Z);
    exitLabelSprite.scale.set(4.0, 1.0, 1);
    exitLabelSprite.renderOrder=131;
    exitLabelSprite.visible=false;
    scene.add(exitLabelSprite);
  }
}

function openExit(message=null){
  exitOpen = true;
  ensureExitPortal();
  refreshExitLabel();
  exitMesh.visible = true; if(exitGlow) exitGlow.intensity = 4;
  if(exitRingMesh) exitRingMesh.visible=true;
  if(exitRingMat) exitRingMat.opacity=0.72;
  document.getElementById('exitArrow').style.display='block';
  if(message) setTimeout(()=>annText(message,'#00ff88'),40);
  annText('✓ LEVEL CLEAR! Reach the exit!','#00ff88');
  sWaveEnd();
}

function closeExit(){
  exitOpen = false;
  if(exitMesh) exitMesh.visible = false;
  if(exitGlow) exitGlow.intensity = 0;
  if(exitRingMesh) exitRingMesh.visible=false;
  if(exitRingMat) exitRingMat.opacity=0;
  if(exitLabelSprite) exitLabelSprite.visible=false;
  _exitLabelLast='';
  const arrow=document.getElementById('exitArrow');
  arrow.style.display='none';
  arrow.textContent='▲ EXIT ▲';
}

function resetExitReady(){
  mp.exitReady={};
  mp.exitPlayers=null;
  mp.exitStartQueued=false;
  mp.exitMode='';
}

function exitReadyIds(){
  return Array.isArray(mp.exitPlayers) ? mp.exitPlayers : mpPlayerIds();
}

function allExitReady(){
  const ids=exitReadyIds();
  return ids.length>0&&ids.every(id=>mp.exitReady[id]);
}

function updateExitReadyPrompt(){
  if(mp.soloMode||!mp.connected) return;
  const ids=exitReadyIds();
  const readyCount=ids.filter(id=>mp.exitReady[id]).length;
  const arrow=document.getElementById('exitArrow');
  if(arrow&&exitOpen){
    arrow.textContent=`▲ WAITING ${readyCount}/${ids.length} ▲`;
    arrow.style.display='block';
  }
}

function broadcastExitReadyState(mode){
  if(!mp.isHost||mp.soloMode) return;
  broadcastMP({type:'EXIT_READY_STATE',ready:mp.exitReady,players:mpPlayerIds(),wave:waveNum,mode});
}

function completeWaveExitTransition(){
  if(gState!=='playing'||!waveClear) return;
  waveClear=false; closeExit();
  resetExitReady();
  if(_waveTotemOfferPending) resetWaveTotemOffer();
  clearMapSpellsAndAllies();
  claimWaveEventReward();
  if(_activeTotemMod) deliverTotemReward();
  tickCurseHpOnWaveClear();
  if(!shouldOpenRunShopAfterWave() && shouldOpenCursedShrineAfterWave(waveNum)){
    _cursedShrinePending=true;
  }
  _skillPickContext='wave';
  showBuffSelect(waveNum%2!==0?'status':'skill');
}

function completeExitTransition(mode){
  if(mode==='shop') finishRunShopRound();
  else completeWaveExitTransition();
}

function markExitReady(id,mode){
  mode=mode==='shop'?'shop':'wave';
  mp.exitMode=mode;
  mp.exitReady[id]=true;
  updateExitReadyPrompt();
  if(!mp.isHost) return;
  broadcastExitReadyState(mode);
  if(allExitReady()&&!mp.exitStartQueued){
    mp.exitStartQueued=true;
    broadcastMP({type:'EXIT_GO',wave:waveNum,mode});
    setTimeout(()=>completeExitTransition(mode),120);
  }
}

function requestExitTransition(mode){
  mode=mode==='shop'?'shop':'wave';
  if(mp.soloMode||!mp.connected){
    completeExitTransition(mode);
    return;
  }
  if(mp.exitReady[mp.myId]) return;
  markExitReady(mp.myId,mode);
  if(!mp.isHost) sendToHost({type:'EXIT_READY',wave:waveNum,mode});
}

// ── Game state ────────────────────────────────────────────
let gState='menu';
let nbPaused=false; // ESC pause: freezes the sim (loop still renders the frozen frame) while the pause menu is up
let waveNum=0,score=0,killCount=0,bestScore=0;
let runGeneration=0;
const runScore = createRunScoreRecorder({
  submit: (...args) => window.PixoLeaderboard.submit(...args),
  getIdentity: () => { const user=window.NeonBrawlAuth?.getState().user; return user ? {id:user.id,name:user.user_metadata?.display_name||'Player'} : null; },
});
function recordRunScore(reason){
  const ids = (mp.soloMode || !mp.connected) ? [mp.myId]
    : [...new Set([mp.myId, ...Object.keys(mp.remotePlayers).map(Number)])];
  const members = ids.map(id => ({ user_id: mp.userIds[id] || null, display_name: playerDisplayName(id) }));
  try {
    runScore.finish(reason, { score, difficulty: nbDifficulty, wave: waveNum, kills: killCount, members, coop: !mp.soloMode });
  } catch(error) { console.warn('[NeonBrawl] Could not save run score', error); }
}
function onPageExit(){ recordRunScore('exit'); notifyRoomExit(); }

let streak=0,streakT=0,shakeAmt=0;
// Solo-only impact freeze: slows the whole sim for a beat on big hits. Gated to
// solo so it can never desync multiplayer (where the sim is shared/authoritative).
let _hitStopT=0;
function hitStop(sec){ if(mp.soloMode) _hitStopT=Math.max(_hitStopT,sec); }
let waveClear=false,waveTransition=false;
let waveFightTime=0;
// ── Wave event state ────────────────────────────────────────
// One event may attach to each non-boss wave. Mini-objective waves replace the
// old per-wave forced objective: the objective spawners/defend/survive now
// ONLY appear when the "mini" event rolls. See rollWaveEvent.
//   type: 'mini' | 'loot' | 'bounty' | 'crystal' | 'mutation' | null
//   sub:  for 'mini' → 'spawners'|'survive'|'relays'|'cells'
//         for 'bounty' → 'noDamage'|'fastClear'|'noDeaths'|'noBullet'
//         for 'challenge' → speedDemon|meteorStorm|rangedHell|fogOfWar|vampireNight|plagueField|eliteSurge
//   complete/failed: tracked at wave clear time
let waveEvent=null;
let _waveEventDamageTaken=0;
let _waveEventDeathLocal=false;
let _eventBonusPicksLeft=0;
let _eventEpicReward=false; // pending guaranteed-epic card from a no-damage bounty clear
let _lastBannerTick=0;
const BOUNTY_FAST_CLEAR_TIME=60;
function eventCrystalMult(){
  let m = (waveEvent&&waveEvent.type==='crystal') ? 2 : 1;
  if(typeof totemCrystalMult==='function') m *= totemCrystalMult();
  return m;
}
function eventMutationActive(){ return !!(waveEvent&&waveEvent.type==='mutation'); }
let _bossClearPending=false;
let _firstSkillPickDone=false;
let runRerolls=0, runRevives=0, runReviveHpPct=0;
let openingLoadoutPicksLeft=0, openingLoadoutBoosts=0;
let runCrystals=0, runShopRerollCost=RUN_SHOP_REROLL_BASE, runShopDoneWave=0;
let runShopCards=[], runShopMesh=null, runShopLight=null;
let waveTotemMesh=null, waveTotemLight=null;
let runGunKeyAwards={};
// Tracks how many times each skill has been purchased from the run shop IN
// THIS RUN. Used to double the price on each repeat buy (8 → 16 → 32 → …).
// Resets in initGame / startAsClient alongside the rest of the run state.
let runShopPurchases={};
let shopTotemMesh=null, shopTotemLight=null, shopTotemUses=0, shopTotemBreakChance=0.5, shopTotemDestroyed=false;
// Bonus boss rewards earned from the shop totem. Captured when a boss wave
// spawns and consumed after the default boss reward pick. Reset each new run.
let bossBonusPicksLeft=0, bossBonusRelicsLeft=0;
const camLook=new THREE.Vector3();
let hudThrottle=0;

// ── Spatial grid for O(1) neighbour lookup ────────────────
// Replaces the O(n²) enemy-separation loop
const CELL = 3; // world units per grid cell
const GCOLS = Math.ceil(ARENA*2/CELL)+2;
const grid2D = new Array(GCOLS*GCOLS); // reused each frame

function cellIdx(x,z){
  const gx = Math.floor((x+ARENA)/CELL);
  const gz = Math.floor((z+ARENA)/CELL);
  const cgx = Math.max(0,Math.min(GCOLS-1,gx));
  const cgz = Math.max(0,Math.min(GCOLS-1,gz));
  return cgz*GCOLS+cgx;
}

function buildGrid(){
  for(let i=0;i<grid2D.length;i++) grid2D[i]=null;
  for(let i=0;i<enemies.length;i++){
    const e=enemies[i]; if(!e||e.dead) continue;
    const idx=cellIdx(e.pos.x,e.pos.z);
    e._next=grid2D[idx]; grid2D[idx]=i;
  }
}

// Separate e from its neighbours using the spatial grid (O(1) avg)
function separateEnemy(e, ei){
  const gx0=Math.floor((e.pos.x+ARENA)/CELL)-1;
  const gz0=Math.floor((e.pos.z+ARENA)/CELL)-1;
  for(let gc=0;gc<9;gc++){
    const nx=gx0+(gc%3), nz=gz0+Math.floor(gc/3);
    if(nx<0||nx>=GCOLS||nz<0||nz>=GCOLS) continue;
    let j=grid2D[nz*GCOLS+nx];
    while(j!==null){
      const jv=j; j=enemies[jv]._next;
      if(jv===ei||enemies[jv].dead) continue;
      const e2=enemies[jv];
      const ex2=e.pos.x-e2.pos.x, ez2=e.pos.z-e2.pos.z;
      const ed=Math.hypot(ex2,ez2);
      const minD=e.cfg.r+e2.cfg.r+0.15;
      if(ed<minD&&ed>0.001){
        const push=(minD-ed)*0.55;
        e.pos.x+=ex2/ed*push; e.pos.z+=ez2/ed*push;
      }
    }
  }
}

// ── Game init / wave / over ───────────────────────────────
function initGame(){
  resetGameplayInput();
  player.gravityExhaustion=0;
  player._regenAcc=0;
  player._curseHpPct=0;player._curseHpWaves=0;
  runGeneration++;
  pistolPrecision.reset();
  pistolJudgment.reset();
  shotgunSalvos.reset();
  ruptureCharge.reset();
  ak47Rhythm.reset();
  steelStorm.reset();
  burstSalvos.reset();burstOpening.reset();celestialTriad.reset();grenadePrimer.reset();supernovaCharge.reset();
  runScore.begin();
  // See startAsClient for why: stale mouse/key state from the previous run
  // can lock firing or trigger movement on respawn.
  mouse.down=false;
  for(const k of Object.keys(keys)) delete keys[k];
  _dashTapped=false; _spellTapped=false;
  for(const b of bulletPool) if(b.active) releaseBullet(b);
  enemies.forEach(e=>{ e.dead=true; releaseEnemySlot(e); }); enemies.length=0;
  _waveSpawnQueue.length=0; _waveSpawnTimer=0;
  for(const p of partPool){ if(p.active){p.active=false;p.mesh.visible=false;} }

  // Reset roguelike progression
  Object.keys(playerSkills).forEach(k=>delete playerSkills[k]);
  Object.keys(playerSkillPicks).forEach(k=>delete playerSkillPicks[k]);
  Object.keys(skillWeights).forEach(k=>delete skillWeights[k]);
  resetRelics();
  resetLegendaryTimers();
  const _pu=persistData.upgrades;
  playerStats.baseMaxHp = MAX_HP + PERM_HP_BONUS[_pu.hp||0];
  recalcPlayerMaxHp(false);
  playerStats.attackDmg = Math.round(25*Math.round(100*PERM_DMG_MULT[_pu.dmg||0])/100);
  lightningT=0; fireballAngle=0; iceOrbAngle=Math.PI/3; thunderOrbAngle=Math.PI*2/3; poisonOrbAngle=Math.PI;
  slowMap.clear(); phaseVulnMap.clear(); poisonMap.clear();
  elementTagMap.clear(); _tagIndicators.forEach(ind=>ind.visible=false);
  setupRunPerms();
  rebuildFireballs(); rebuildIceOrbs(); rebuildThunderOrbs(); rebuildPoisonOrbs(); buildBarrierVisual(); initGhostPool();

  const sp = SPAWN_POS[mp.myId%MAX_PLAYERS];
  player.pos.set(sp[0],0,sp[1]); player.hp=playerStats.maxHp; player.maxHp=playerStats.maxHp; player.overhealShield=0; player._bloodGrowthHp=0; player.dead=false;
  player.downed=false; player.downedT=0; player.reviveT=0; player.lastReviveTouch=0;
  player.fireCd=0; player.minigunSpin=0; player.railCharge=0; player.railChargeSfxT=0; player.railMaxFx=false; player.railWasCharging=false; player.gun='pistol'; player.invincible=0; player.barrierActive=false; player.barrierCd=0;
  player.ammo=currentMagSize(); player.reloadT=0; player.reloadDur=currentReloadTime();
  player.dashCd=0; player.dashT=0; player.dashKinetic=0; player.kineticCharge=0; player.speedBoostT=0; player.repairPulseCd=0; player.meleeDashSpeed=0; player.meleeDashSpecial=false; player.hookSwingT=0; player.hookSwingMode=''; player.hookOrbitDir=0; player.hookWallBuffer=0; player.hookInertiaT=0;
  disposeActiveHookRope();
  if(player.moveTrail) clearTrail(player.moveTrail);
  player.spellCd=0; player.fireRingCd=0; player.homingBombCd=0; player.stormCallCd=0;
  player.meleeWeapon='katana'; player.meleeCd=0;
  for(const s of spellBalls) if(s.active){s.active=false;s.mesh.visible=false;clearTrail(s.trail);}
  for(let i=damageRings.length-1;i>=0;i--){ _releaseDamageRingSlot(damageRings[i]); }
  damageRings.length=0;
  for(let i=homingBombs.length-1;i>=0;i--){ _releaseHomingBombSlot(homingBombs[i]); }
  homingBombs.length=0;
  clearSummons();
  buildPlayer();
  // Solo keeps the player's remembered pick; host uses the lobby choice.
  nbDifficulty = mp.soloMode ? nbDifficulty : (mp.hostDifficulty || 'hard');
  waveNum=0; score=0; killCount=0; streak=0; streakT=0;
  resetRunStats();
  runCrystals=0; runShopRerollCost=RUN_SHOP_REROLL_BASE; runShopDoneWave=0; runShopCards=[]; runShopPurchases={}; runGunKeyAwards={}; bossBonusPicksLeft=0; bossBonusRelicsLeft=0;
  waveClear=false; waveSpawned=false; waveTransition=false; waveEnemyTotal=0; waveFightTime=0;
  waveEvent=null; _eventBonusPicksLeft=0; _eventEpicReward=false; _challengeRewardPending=false; _cursedShrinePending=false; _waveTotemOfferPending=false; _waveTotemOfferId=null; _waveTotemAccepted=false; _pendingTotemMod=null; _activeTotemMod=null; if(player){player._curseHpPct=0;player._curseHpWaves=0;} resetWaveEventTracking(); renderWaveEventBanner();
  _bossClearPending=false; _firstSkillPickDone=false; currentBossTargetPoolIdx=null;
  mp.syncT=0; mp.hostSyncT=0; mp.buffReady={}; mp.buffPlayers=null; mp.buffStartQueued=false;
  mp.exitReady={}; mp.exitPlayers=null; mp.exitStartQueued=false; mp.exitMode='';
  mp.gunReady={}; mp.gunPlayers=null; mp.gunStartQueued=false;
  mp.meleeReady={}; mp.meleePlayers=null; mp.meleeStartQueued=false;
  mp.rematchReady={}; mp.rematchPlayers=null; mp.rematchStartQueued=false;
  resetWaveContribution();
  navTimer=0;
  currentMapLayout=0; changeMapLayout(0); // reset to default layout each new game
  _lastNormalMapIdx=-1;
  closeExit(); setWaveTotemWorldVisible(false); musicStop();
  gState='playing';
  document.getElementById('menu').style.display='none';
  document.getElementById('gameover').style.display='none';
  document.getElementById('deadOverlay').style.display='none';
  document.getElementById('buffSelect').style.display='none';
  document.getElementById('meleeSelect').style.display='none';
  const _gunSel=document.getElementById('gunSelect'); if(_gunSel) _gunSel.style.display='none';
  document.getElementById('bossBar').style.display='none';
  document.getElementById('exitArrow').style.display='none';
  document.getElementById('spellCd').style.display='none';
  document.getElementById('ringCd').style.display='none';
  document.getElementById('bombCd').style.display='none';
  document.getElementById('stormCd').style.display='none';
  document.getElementById('lightningCd').style.display='none';
  document.getElementById('spellBtn').style.display='none';
  document.getElementById('turretCdEl').style.display='none';
  document.getElementById('droneCdEl').style.display='none';
  document.getElementById('shieldBotCdEl').style.display='none';
  document.getElementById('sentinelCdEl').style.display='none';
  document.getElementById('repairCdEl').style.display='none';
  document.getElementById('summonSep').style.display='none';
  document.getElementById('hud').style.display='block';
  if(realIsMobile){ for(const _tb of ['dashBtn','meleeBtn','useBtn']) document.getElementById(_tb).style.display='flex'; } // re-show after a disconnect hid them
  camera.position.set(0, CAM_Y, ARENA_H-2+CAM_Z_OFF); camera.lookAt(0,0,ARENA_H-2);
  refreshHP(); updateHUD(); updateSkillHUD(); updateGoldHud(); updateCrystalHud();

  if(!mp.soloMode && mp.isHost){
    const spawnMap={};
    Object.keys(mp.remotePlayers).forEach(id=>{ spawnMap[+id]=SPAWN_POS[(+id)%MAX_PLAYERS]; });
    broadcastMP(JSON.stringify({type:'GAME_START',spawnPos:null,spawnMap,mapLayout:currentMapLayout,names:mp.names,difficulty:mp.hostDifficulty}));
    for(const id in mp.remotePlayers) buildRemotePlayer(+id);
  }
  showGunSelect();
}

function nextWave(){
  resetExitReady();
  if(!mp.soloMode&&!mp.isHost) return;
  _waveEndSfxDone=false; // arm the clear fanfare for this new wave
  closeRunShopUI(); setRunShopWorldVisible(false); setWaveTotemWorldVisible(false);
  clearMapSpellsAndAllies();
  disposeMiniObjective();
  gState='playing';
  // Defensive menu hide — see same-named fix in HOST_STATE handler.
  { const _m=document.getElementById('menu'); if(_m) _m.style.display='none'; }
  waveNum++;
  currentBossTargetPoolIdx=null;
  updateBossBarFromEnemy(null);
  resetWaveContribution();
  // Crystal Tithe (economy epic): at the start of every wave, gain a
  // percentage of the crystals you're currently holding. Snowballs your
  // economy if you save up between shops.
  const surgePct=CRYSTAL_SURGE_PCT[playerSkills.crystalSurge||0]||0;
  if(surgePct>0 && (runCrystals||0)>0){
    const bonus=Math.floor(runCrystals*surgePct);
    if(bonus>0) grantRunCrystal(bonus, player?.pos);
  }
  let mapChanged=false;
  const targetMap=presetForWave(waveNum);
  if(currentMapLayout!==targetMap){
    currentMapLayout=targetMap;
    changeMapLayout(currentMapLayout);
    mapChanged=true;
  }
  waveClear=false; waveSpawned=false; waveTransition=true; waveFightTime=0;
  // Accepted wave totems own the next wave, so random wave events do not
  // cancel a risk/reward the team just activated.
  const acceptedTotem=_pendingTotemMod;
  waveEvent=acceptedTotem ? null : rollWaveEvent(waveNum);
  resetWaveEventTracking();
  // Activate any pending Wave Totem modifier for this wave. Cleared after
  // the wave's reward is delivered.
  _activeTotemMod = acceptedTotem;
  _pendingTotemMod = null;
  // Clear the visible between-wave totem offer after the new wave starts.
  resetWaveTotemOffer();
  // Reset player to bottom spawn
  player.pos.set(0, 0, ARENA_H-2);
  if(player.mesh){ player.mesh.position.x=0; player.mesh.position.z=ARENA_H-2; }
  const preset=ARENA_PRESETS[currentMapLayout]||ARENA_PRESETS[0];
  const label=waveNum%5===0?`BOSS ${waveNum} - ${preset.name}`:`LEVEL ${waveNum} - ${preset.name}`;
  annText(label,mapChanged?'#66eeff':'#ffd700');
  // Pop the event panel immediately at wave start so the player sees it
  // through the whole intro instead of mid-fight. announceWaveEvent itself
  // queues the auto-dock 2.2s later.
  if(waveEvent) announceWaveEvent();
  renderWaveEventBanner();
  // Wave intro delay before enemies start spawning. Shorter when there's no
  // event to read (just a beat for the level label) and a bit longer with
  // an event so the popped panel has time to register before the fight.
  if(waveNum%5!==0) musicStart(waveNum,false); // start the wave track right away, not after the intro beat
  const introDelay = waveEvent ? 1700 : 800;
  const introRun=runGeneration,introWave=waveNum;
  setTimeout(()=>{
    if(gState!=='playing'||runGeneration!==introRun||waveNum!==introWave||!waveTransition) return;
    spawnWave(waveNum); waveTransition=false;
  }, introDelay);
}

function annText(txt,col='#ffd700'){
  const el=document.getElementById('waveAnn');
  el.textContent=txt; el.style.color=col; el.style.textShadow=`0 0 40px ${col}`;
  el.style.transition='none'; el.style.opacity='1'; el.style.transform='translate(-50%,-50%) scale(1)';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.style.transition='opacity 1.2s ease-out, transform 1.2s ease-out';
    el.style.opacity='0'; el.style.transform='translate(-50%,-50%) scale(1.6)';
  }));
}

// Quick coloured edge-flash for big hits (boss specials / phase shifts). Local
// cosmetic — runs on whoever's screen calls it. Reuses the annText flash trick.
let _flashEl=null;
function screenFlash(col='#ffffff',strength=0.5){
  _flashEl=_flashEl||document.getElementById('screenFlash');
  if(!_flashEl) return;
  _flashEl.style.background=`radial-gradient(circle at 50% 52%, transparent 38%, ${col} 130%)`;
  _flashEl.style.transition='none';
  _flashEl.style.opacity=String(Math.min(1,strength));
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    _flashEl.style.transition='opacity 0.42s ease-out';
    _flashEl.style.opacity='0';
  }));
}

function runSummaryChips(items, emptyText){
  if(!items.length) return `<span class="run-chip empty">${escHtml(emptyText)}</span>`;
  return items.map(t=>`<span class="run-chip">${escHtml(t)}</span>`).join('');
}

function runSummaryCardGroups(entries){
  if(!entries.length) return '<span class="run-chip empty">NO CARDS</span>';
  const groups=new Map();
  for(const e of entries){
    const cat=e.cat||'skill';
    if(!groups.has(cat)) groups.set(cat,[]);
    groups.get(cat).push(e);
  }
  const ordered=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  return `<div class="run-card-groups">${ordered.map(([cat,list])=>{
    const catInfo=SKILL_CAT_INFO[cat]||{label:cat.toUpperCase(),color:'#9fb7c8'};
    list.sort((a,b)=>(RARITY_ORDER[b.rarity]??0)-(RARITY_ORDER[a.rarity]??0) || b.lvl-a.lvl || a.name.localeCompare(b.name));
    const chips=list.slice(0,6).map(e=>{
      const r=RARITY_INFO[e.rarity]||RARITY_INFO.common;
      return `<span class="run-chip">${escHtml(e.name)} ${e.lvl} <span class="rarity" style="--rarity-color:${r.color}">${r.label}</span></span>`;
    }).join('');
    const more=list.length>6?`<span class="run-chip">+${list.length-6} MORE</span>`:'';
    return `<div class="run-card-group" style="--group-color:${catInfo.color}">
      <div class="run-group-title">${escHtml(catInfo.label)}</div>
      <div class="run-chip-list">${chips}${more}</div>
    </div>`;
  }).join('')}</div>`;
}

function teamSummarySnapshot(){
  if(mp.soloMode||!mp.connected) return null;
  const out={};
  const sources=[lastContributionSnapshot, contributionSnapshot()].filter(Boolean);
  for(const src of sources){
    for(const id of Object.keys(src||{})){
      const n=+id;
      if(n>=0&&n<MAX_PLAYERS) out[n]=mergeContribution(out[n],src[id]);
    }
  }
  return Object.keys(out).length ? out : null;
}
function summaryIds(snapshot){
  if(!snapshot) return [];
  return Object.keys(snapshot).map(Number).filter(id=>id>=0&&id<MAX_PLAYERS).sort((a,b)=>a-b);
}
function buildRunSummaryTabs(snapshot, selectedId){
  const ids=summaryIds(snapshot);
  if(ids.length<=1) return '';
  return `<div class="run-summary-tabs">${ids.map(id=>{
    const active=id===selectedId?' active':'';
    const color=PLAYER_COLORS[id%MAX_PLAYERS]?.hex||'#69f7ff';
    return `<button class="run-summary-tab${active}" type="button" data-summary-id="${id}" style="--player-color:${color}">${escHtml(playerDisplayName(id))}</button>`;
  }).join('')}</div>`;
}
function buildMemberContributionSummaryHtml(selectedId, snapshot){
  // Render a teammate exactly like your own summary, from their synced state.
  const rp=mp.remotePlayers[selectedId]||{};
  const gun=GUNS[rp.gun]||GUNS.pistol;
  const melee=MELEE_WEAPONS[rp.meleeWeapon]||MELEE_WEAPONS.katana;
  const relics=Object.entries(rp.relics||{}).filter(([,v])=>!!v).map(([id])=>RELIC_DEFS[id]?.name||id);
  const cardEntries=Object.entries(rp.skills||{})
    .filter(([,lvl])=>(lvl||0)>0)
    .map(([id,lvl])=>{
      const def=SKILL_DEFS[id]||{name:id};
      return {id,lvl,cat:SKILL_CATEGORY[id]||'skill',name:def.name,rarity:skillRarity(id)};
    });
  return buildRunDetailHtml({gun,melee,relics,cardEntries,dmg:rp.dsrc||{}});
}
function buildTeamRunSummaryHtml(selectedId=mp.myId, snapshot=teamSummarySnapshot()){
  const ids=summaryIds(snapshot);
  if(ids.length && !ids.includes(selectedId)) selectedId=mp.myId;
  if(selectedId!==mp.myId && snapshot){
    return `${buildRunSummaryTabs(snapshot,selectedId)}${buildMemberContributionSummaryHtml(selectedId,snapshot)}`;
  }
  return `${buildRunSummaryTabs(snapshot,mp.myId)}${buildRunSummaryHtml()}`;
}
function wireRunSummaryTabs(root, renderFn){
  if(!root) return;
  root.querySelectorAll('.run-summary-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id=+btn.dataset.summaryId;
      if(Number.isFinite(id)) renderFn(id);
    });
  });
}

function buildRunSummaryHtml(){
  const gun=GUNS[player.gun]||GUNS.pistol;
  const melee=MELEE_WEAPONS[player.meleeWeapon]||MELEE_WEAPONS.katana;
  const relics=Object.keys(playerRelics).map(id=>RELIC_DEFS[id]?.name||id);
  const cardEntries=Object.entries(playerSkillPicks).map(([id,lvl])=>{
    const def=SKILL_DEFS[id]||{name:id};
    return {id,lvl,cat:SKILL_CATEGORY[id]||'skill',name:def.name,rarity:skillRarity(id)};
  });
  return buildRunDetailHtml({gun,melee,relics,cardEntries,dmg:runStats?runStats.damage:{}});
}
// Shared run-detail renderer (BUILD / DAMAGE REPORT / RELICS / CARDS). Used for
// your own summary AND a teammate's, so clicking a player on the boss-clear /
// game-over board shows their build exactly the way you see your own — driven by
// each player's synced per-source damage map (PLAYER_STATE.dsrc).
function buildRunDetailHtml({gun,melee,relics,cardEntries,dmg}){
  dmg=dmg||{};
  const total=DAMAGE_SOURCE_ORDER.reduce((sum,k)=>sum+(dmg[k]||0),0);
  const rows=DAMAGE_SOURCE_ORDER
    .filter(k=>(dmg[k]||0)>0)
    .sort((a,b)=>(dmg[b]||0)-(dmg[a]||0))
    .map((k,i)=>{
      const meta=DAMAGE_SOURCE_META[k];
      const val=Math.round(dmg[k]||0);
      const pct=total>0?Math.round(val/total*100):0;
      return `<div class="run-damage-row" style="--src-color:${meta.color}">
        <div>${meta.label}</div>
        <div class="run-damage-bar"><div class="run-damage-fill" style="--bar-width:${pct}%;--delay:${i*65}ms"></div></div>
        <div class="run-damage-num">${formatStat(val)}<span class="run-damage-pct">${pct}%</span></div>
      </div>`;
    }).join('') || '<div class="run-chip empty">NO DAMAGE DATA</div>';
  const topKey=DAMAGE_SOURCE_ORDER.slice().sort((a,b)=>(dmg[b]||0)-(dmg[a]||0))[0];
  const topText=total>0 ? `${DAMAGE_SOURCE_META[topKey].label} ${formatStat(dmg[topKey]||0)} / ${Math.round((dmg[topKey]||0)/total*100)}%` : 'NONE';
  const sourceRank=DAMAGE_SOURCE_ORDER.slice().filter(k=>(dmg[k]||0)>0).sort((a,b)=>(dmg[b]||0)-(dmg[a]||0));
  const secondKey=sourceRank[1]||null;
  const topPct=total>0 ? (dmg[topKey]||0)/total : 0;
  const buildStyle=total<=0 ? 'UNKNOWN'
    : topPct>=0.55 ? `${DAMAGE_SOURCE_META[topKey].label} CORE`
    : secondKey ? `${DAMAGE_SOURCE_META[topKey].label} + ${DAMAGE_SOURCE_META[secondKey].label}`
    : DAMAGE_SOURCE_META[topKey].label;
  const bestCard=cardEntries.length ? cardEntries.slice().sort((a,b)=>(RARITY_ORDER[b.rarity]??0)-(RARITY_ORDER[a.rarity]??0)||b.lvl-a.lvl)[0] : null;
  const bestCardText=bestCard ? `${bestCard.name} ${bestCard.lvl}` : 'NONE';
  return `
    <div class="run-summary-panel">
      <div class="run-summary-title">BUILD</div>
      <div class="run-loadout-row"><span>Primary</span><span class="run-loadout-val">${escHtml(gun.name)}</span></div>
      <div class="run-loadout-row"><span>Melee</span><span class="run-loadout-val">${escHtml(melee.name)}</span></div>
      <div class="run-loadout-row"><span>MVP Source</span><span class="run-loadout-val">${escHtml(topText)}</span></div>
      <div class="run-loadout-row"><span>Build Style</span><span class="run-loadout-val">${escHtml(buildStyle)}</span></div>
      <div class="run-loadout-row"><span>Best Card</span><span class="run-loadout-val">${escHtml(bestCardText)}</span></div>
      <div class="run-loadout-row"><span>Cards Picked</span><span class="run-loadout-val">${cardEntries.length}</span></div>
    </div>
    <div class="run-summary-panel">
      <div class="run-summary-title">DAMAGE REPORT</div>
      ${rows}
    </div>
    <div class="run-summary-panel">
      <div class="run-summary-title">RELICS</div>
      <div class="run-chip-list">${runSummaryChips(relics,'NO RELICS')}</div>
    </div>
    <div class="run-summary-panel">
      <div class="run-summary-title">CARDS</div>
      ${runSummaryCardGroups(cardEntries)}
    </div>`;
}

function renderRunSummary(selectedId=runSummarySelectedId){
  const el=document.getElementById('runSummary');
  if(!el) return;
  const snapshot=teamSummarySnapshot();
  const ids=summaryIds(snapshot);
  if(ids.length && !ids.includes(selectedId)) selectedId=mp.myId;
  runSummarySelectedId=selectedId;
  el.innerHTML=buildTeamRunSummaryHtml(selectedId,snapshot);
  wireRunSummaryTabs(el,id=>renderRunSummary(id));
}

function queueBossReward(){
  const rewardRun=runGeneration,rewardWave=waveNum;
  const stillCurrent=()=>runGeneration===rewardRun&&waveNum===rewardWave&&gState==='playing'&&waveClear;
  setTimeout(()=>{
    if(!stillCurrent()) return;
    // Heavy Crown promises additional picks, not merely more offered options.
    bossBonusPicksLeft+=RELIC_LEVELS.heavyCrown.bossPickBonus[relicLevel('heavyCrown')]||0;
    showBossRunSummaryThen(()=>{if(stillCurrent()) showBuffSelect('boss');});
  },450);
}

function showBossRunSummaryThen(done){
  const el=document.getElementById('bossRunSummary');
  if(!el){ done(); return; }
  const snapshot=teamSummarySnapshot();
  let selectedId=summaryIds(snapshot).includes(runSummarySelectedId) ? runSummarySelectedId : mp.myId;
  el.innerHTML=`<div class="boss-summary-box">
    <div class="boss-summary-head">
      <div class="boss-summary-title">BOSS CLEAR</div>
      <button class="boss-summary-close" type="button">CONTINUE</button>
    </div>
    <div class="run-summary boss-summary-body">${buildTeamRunSummaryHtml(selectedId,snapshot)}</div>
  </div>`;
  el.classList.add('show');
  clearTimeout(el._hideT);
  const renderBossSummary=(id)=>{
    selectedId=id;
    runSummarySelectedId=id;
    const body=el.querySelector('.boss-summary-body');
    if(!body) return;
    body.innerHTML=buildTeamRunSummaryHtml(selectedId,snapshot);
    wireRunSummaryTabs(body,renderBossSummary);
  };
  const close=()=>{
    el.classList.remove('show');
    el.innerHTML='';
    done();
  };
  wireRunSummaryTabs(el,renderBossSummary);
  const btn=el.querySelector('.boss-summary-close');
  if(btn) btn.addEventListener('click',close,{once:true});
}

function gameOver(){
  recordRunScore('death');
  gState='gameover'; bestScore=Math.max(bestScore,score);
  flushPendingGold();
  hideReviveUI();
  mp.rematchReady={}; mp.rematchPlayers=null; mp.rematchStartQueued=false;
  playBgm('menu'); // game over -> menu music
  hideMeleeSelect();
  closeRunShopUI(); setRunShopWorldVisible(false); setWaveTotemWorldVisible(false);
  document.getElementById('hud').style.display='none';
  document.getElementById('gameover').style.display='flex';
  document.getElementById('goSc').textContent='Score: '+score.toLocaleString();
  document.getElementById('goWv').textContent=`Reached Level ${waveNum}`;
  document.getElementById('goKills').textContent=killCount;
  document.getElementById('goWaves').textContent=waveNum;
  document.getElementById('goHi').textContent=bestScore.toLocaleString();
  runSummarySelectedId=mp.myId;
  renderRunSummary();
  sGameOver();

}

function refreshHP(){
  // The bar fills relative to BASE max HP so a Cursed Shrine cap-reduction
  // shows as a grey overlay on the right side rather than just shrinking
  // the green silently. relicMaxHpMult-driven losses (Glass Reactor, etc.)
  // do NOT show the grey overlay — those are permanent build choices.
  const baseMax = (playerStats?.baseMaxHp) || MAX_HP;
  const curMax  = Math.max(1, player.maxHp || baseMax);
  const hp      = Math.max(0, player.hp || 0);
  const shield  = Math.max(0, player.overhealShield || 0);
  const hpText=document.getElementById('hpText');
  if(hpText) hpText.textContent=`${Math.ceil(hp)} / ${Math.round(curMax)}${shield>0?' +'+Math.round(shield):''}`;
  const tempCurseActive=(player?._curseHpPct||0)>0;
  let uncursedMax=curMax;
  if(tempCurseActive){
    let relicMul=1;
    if(hasRelic('glassReactor')) relicMul*=RELIC_LEVELS.glassReactor.hpMul[relicLevel('glassReactor')];
    if(hasRelic('regenHeart'))   relicMul*=RELIC_LEVELS.regenHeart.hpMul[relicLevel('regenHeart')];
    uncursedMax=Math.max(1,Math.round(baseMax*relicMul)-(playerStats.maxHpPenalty||0));
  }
  const visualMax=Math.max(tempCurseActive ? Math.max(curMax,uncursedMax) : curMax, hp+shield);
  const greenPct = Math.max(0, Math.min(100, hp / visualMax * 100));
  const fill=document.getElementById('hpFill');
  fill.style.width = greenPct + '%';
  const shieldEl=document.getElementById('hpShieldFill');
  if(shieldEl){
    const shieldPct=Math.max(0,Math.min(100-greenPct,shield/visualMax*100));
    if(shieldPct>0.5){
      shieldEl.style.left=greenPct+'%';
      shieldEl.style.width=shieldPct+'%';
      shieldEl.style.display='block';
    } else {
      shieldEl.style.display='none';
    }
  }
  // Color thresholds use current-max% so the bar turns red when you're
  // actually low on HP, not low on absolute HP.
  const curPct = hp / curMax * 100;
  fill.style.background =
    curPct>55?'linear-gradient(90deg,#00ff88,#00ffcc)':
    curPct>25?'linear-gradient(90deg,#ffaa00,#ffcc00)':
              'linear-gradient(90deg,#ff2244,#ff6600)';
  fill.classList.toggle('crit',curPct<=25);
  // Grey "cursed cap" overlay on the right side of the track.
  const curseEl=document.getElementById('hpCurseFill');
  if(curseEl){
    const lostPct=tempCurseActive ? Math.max(0, Math.min(100, (visualMax-curMax) / visualMax * 100)) : 0;
    if(lostPct>0.5){
      curseEl.style.width = lostPct + '%';
      curseEl.style.display='block';
    } else {
      curseEl.style.display='none';
    }
  }
}

// Cooldown-bar fill setter: caches each #...Fill element ref and writes
// style.width only when the percentage actually changed. Writes the exact same
// string the inline code did (pct+'%'), so output is byte-identical — it just
// skips the redundant per-frame write while a bar sits full/idle.
const _cdFillEls={};
function _setCdFill(id, pct){
  let el=_cdFillEls[id];
  if(el===undefined){ el=_cdFillEls[id]=document.getElementById(id)||null; }
  if(!el) return;
  if(pct!==el._lastPct){ el.style.width=pct+'%'; el._lastPct=pct; }
}
let _hudEls=null; // cached HUD element refs + last-written strings (dirty-check to skip no-op DOM writes)
function updateHUD(){
  if(!_hudEls) _hudEls={score:document.getElementById('scoreD'),wave:document.getElementById('waveD'),enemy:document.getElementById('enemyD'),_s:null,_w:null,_e:null};
  const sStr=score.toLocaleString();
  if(sStr!==_hudEls._s){ _hudEls.score.textContent=sStr; _hudEls._s=sStr; }
  const wStr=gState==='shopround'?'SHOP ROUND':`LEVEL ${waveNum}`;
  if(wStr!==_hudEls._w){ _hudEls.wave.textContent=wStr; _hudEls._w=wStr; }
  const obj=miniObjectiveStatus();
  const eStr=obj|| (gState==='shopround'?'SHOP / EXIT':enemies.length?`${enemies.length} enemies`:waveClear?'FIND EXIT':'Preparing...');
  if(eStr!==_hudEls._e){ _hudEls.enemy.textContent=eStr; _hudEls._e=eStr; }
  updateBossBarFromEnemies();
  updateAmmoHud();
}

// Updates the ammo / reload UI. Called from updateHUD (~20Hz) AND from the
// firing block on every shot so the count drops the instant you fire instead
// of waiting for the next HUD tick.
let _ammoEls=null; // cached refs + last-written strings; retries until the elements exist
function updateAmmoHud(){
  if(!_ammoEls){
    const c=document.getElementById('ammoCount'), f=document.getElementById('ammoReloadFill');
    if(!c||!f) return;
    _ammoEls={count:c,fill:f,_t:null,_w:null,_bg:null};
  }
  const countEl=_ammoEls.count, fillEl=_ammoEls.fill;
  const ammo=Math.max(0,Math.floor(player?.ammo??0));
  const reloading=(player?.reloadT||0)>0;
  const mag=currentMagSize();
  const txt=reloading ? `RELOADING…` : `${ammo} / ${mag}`;
  if(txt!==_ammoEls._t){ countEl.textContent=txt; _ammoEls._t=txt; }
  countEl.classList.toggle('reloading',reloading);
  countEl.classList.toggle('empty',!reloading&&ammo<=0);
  // Use the stored per-reload duration (captured at reload-start) so the
  // bar fills correctly even when Quick Hands shortens reload mid-run.
  let pct;
  if(reloading){
    const dur=Math.max(0.01,player.reloadDur||RELOAD_TIME);
    pct=Math.max(0,Math.min(1,1-(player.reloadT/dur)));
  } else {
    pct=Math.max(0,Math.min(1,ammo/mag));
  }
  const wStr=(pct*100).toFixed(1)+'%';
  if(wStr!==_ammoEls._w){ fillEl.style.width=wStr; _ammoEls._w=wStr; }
  const bg=reloading
    ? 'linear-gradient(90deg,#9ad8ff,#3b7fdc)'
    : (ammo<=5 ? 'linear-gradient(90deg,#ff8866,#ff3344)' : 'linear-gradient(90deg,#ffe259,#ffa733)');
  if(bg!==_ammoEls._bg){ fillEl.style.background=bg; _ammoEls._bg=bg; }
}

// Floating "RELOADING" tag positioned below the local player while reloadT
// > 0. Uses the same project()->screen pipeline as the player name tag
// (#nameLayer is `position:fixed; inset:0` so we need to add the canvas
// rect offset to land in viewport coords).
function updateReloadTag(){
  const tag=document.getElementById('reloadTag');
  if(!tag) return;
  const reloading=(player?.reloadT||0)>0;
  if(!reloading||player?.dead||gState!=='playing'){
    tag.classList.remove('show');
    return;
  }
  _scratchProj.set(player.pos.x,0.05,player.pos.z).project(camera);
  if(_scratchProj.z<-1||_scratchProj.z>1){ tag.classList.remove('show'); return; }
  const rect=_canvasRect||canvas.getBoundingClientRect();
  tag.style.left=((_scratchProj.x*0.5+0.5)*rect.width  + rect.left)+'px';
  tag.style.top =((-_scratchProj.y*0.5+0.5)*rect.height + rect.top )+'px';
  tag.classList.add('show');
}

function toScreen(pos3){
  _scratchProj.set(pos3.x,0.8,pos3.z); _scratchProj.project(camera);
  // The canvas is offset inside the viewport by the site chrome (top bar +
  // left sidebar). Damage numbers / floating labels live inside #ui, which is
  // `position:fixed; inset:0` and therefore in viewport coords — so we add the
  // canvas's bounding-rect offset to translate canvas-pixel coords into the
  // viewport space those DOM elements use. Same fix-shape as the cursor raycast.
  const rect=_canvasRect||canvas.getBoundingClientRect();
  return {
    x:(_scratchProj.x+1)/2*rect.width  + rect.left,
    y:(-_scratchProj.y+1)/2*rect.height + rect.top,
  };
}
// Floating damage/heal numbers reuse a fixed ring of DOM nodes instead of
// creating + removing a div per hit. Both .dmg animations end at opacity:0
// with `forwards`, so a finished node sits invisible until it's reused — we
// just restart its CSS animation. Same look, no per-hit allocation / GC / timer.
const _dmgPool=[]; let _dmgIdx=0;
const _DMG_POOL_MAX=isMobile?44:96;
function dmgNum(txt,pos,col,cls=''){
  const parent=document.getElementById('ui'); if(!parent) return;
  const sc=toScreen(pos);
  let el=_dmgPool[_dmgIdx];
  if(!el){ el=document.createElement('div'); parent.appendChild(el); _dmgPool[_dmgIdx]=el; }
  _dmgIdx=(_dmgIdx+1)%_DMG_POOL_MAX;
  el.className=cls ? `dmg ${cls}` : 'dmg'; el.textContent=txt; el.style.color=col;
  el.style.left=sc.x+'px'; el.style.top=sc.y+'px';
  el.style.animation='none'; void el.offsetWidth; el.style.animation=''; // restart the float/fade on reuse
}

// ── Audio ─────────────────────────────────────────────────
let AC=null, audioMaster=null, noiseBuf=null;
let _musicGain=null; const _musicOscs=[]; let _beatTimer=null; let _musicLpf=null;
function initAC(){
  if(AC){ if(AC.state==='suspended') AC.resume(); return; }
  AC=new(window.AudioContext||window.webkitAudioContext)();
  audioMaster=AC.createGain();
  audioMaster.gain.value=nbAudioGain();
  audioMaster.connect(AC.destination);
  loadSfx();
}
function audioDest(){ if(!AC) return null; if(!audioMaster) initAC(); return audioMaster; }
// ── Sound settings (master volume + mute), persisted to localStorage. All
// SFX + music route through audioMaster, so one gain value covers the mix.
let nbVolume = 72, nbMuted = false;        // SFX channel (Web Audio audioMaster)
let nbBgmVol = 60, nbBgmMuted = false;     // BGM channel (HTML5 <audio> volume, independent of SFX)
try{ const v=parseInt(localStorage.getItem('nbVolume'),10); if(!isNaN(v)) nbVolume=Math.max(0,Math.min(100,v)); nbMuted=localStorage.getItem('nbMuted')==='1'; }catch(_){}
try{ const bv=parseInt(localStorage.getItem('nbBgmVol'),10); if(!isNaN(bv)) nbBgmVol=Math.max(0,Math.min(100,bv)); nbBgmMuted=localStorage.getItem('nbBgmMuted')==='1'; }catch(_){}
let nbOthersSfx = true;                    // play OTHER players' SFX (shoot/dash). Default ON.
try{ const o=localStorage.getItem('nbOthersSfx'); if(o!==null) nbOthersSfx = o!=='0'; }catch(_){}
function othersSfxOn(){ return nbOthersSfx && !nbMuted; }
function nbAudioGain(){ return nbMuted ? 0 : nbVolume/100; }
function nbBgmGain(){ return nbBgmMuted ? 0 : nbBgmVol/100; }
function nbApplyAudio(){ if(audioMaster) audioMaster.gain.value = nbAudioGain(); applyBgmVol(); }
// ── BGM (looping mp3 tracks via HTML5 <audio>; volume separate from SFX) ──
const BGM_FILES = {
  menu:'sound/bgm/main_menu.mp3',
  normal:'sound/bgm/normal%20wave%20bgm.mp3',
  boss1:'sound/bgm/boss%20wave%20bgm%201.mp3',
  boss2:'sound/bgm/boss%20wave%20bgm%202.mp3',
};
const _bgmEls={}; let _bgmCur=null, _bgmKey=null;
function _getBgm(key){
  let a=_bgmEls[key];
  if(!a){
    a=new Audio(); a.loop=true; a.preload='auto'; a._rawSrc=BGM_FILES[key];
    // Prefer the loudness-normalized track; if its file is missing, the error
    // handler swaps to the raw track once (and keeps playing if it's current).
    a.addEventListener('error',()=>{
      if(a.src && a.src.indexOf('bgm_normalized')>=0){
        a.src=a._rawSrc; a.load();
        if(_bgmCur===a){ const p=a.play(); if(p&&p.catch) p.catch(()=>{}); }
      }
    });
    a.src=BGM_FILES[key].replace('sound/bgm/','sound/bgm_normalized/');
    _bgmEls[key]=a;
  }
  return a;
}
function applyBgmVol(){ if(_bgmCur) _bgmCur.volume=nbBgmGain(); }
function playBgm(key){
  if(!window.NEONBRAWL_CONFIG.assets.music) return;
  if(!key||!BGM_FILES[key]){ stopBgm(); return; }
  if(_bgmKey===key && _bgmCur && !_bgmCur.paused){ _bgmCur.volume=nbBgmGain(); return; } // already on this track
  stopBgm();
  const a=_getBgm(key); a.volume=nbBgmGain();
  try{ a.currentTime=0; }catch(e){}
  const p=a.play(); if(p&&p.catch) p.catch(()=>{}); // browsers reject autoplay until the first gesture
  _bgmCur=a; _bgmKey=key;
}
function stopBgm(){ if(_bgmCur){ try{ _bgmCur.pause(); }catch(e){} } _bgmCur=null; _bgmKey=null; }
function preloadBgm(){ if(!window.NEONBRAWL_CONFIG.assets.music) return; for(const k in BGM_FILES) _getBgm(k); } // create + buffer every track so wave/boss switches play instantly
// Attempt the menu music on load with no gesture (like the other games):
// browsers that permit autoplay for this origin play it right away; otherwise
// it stays queued and the first user gesture (_nbStartAudio) starts it.
try{ if(gState==='menu') playBgm('menu'); }catch(e){}
// ── Sampled SFX (recorded one-shots from sound/sfx/) ──────
// Each s*() below tries its sample first and falls back to the synth if the
// file isn't decoded yet (or failed to load), so there's always sound. Bytes
// are fetched eagerly at load; decoding waits for the AudioContext (created on
// the first user gesture). All samples route through audioMaster, so the
// volume/mute settings cover them too.
const SFX_FILES = {
  shoot_pistol:'sound/sfx/shoot_pistol.mp3', shoot_smg:'sound/sfx/shoot_smg.mp3',
  shoot_ak:'sound/sfx/shoot_ak.mp3', shoot_shotgun:'sound/sfx/shoot_shotgun.mp3',
  shoot_flame:'sound/sfx/shoot_flame.mp3', shoot_sniper:'sound/sfx/shoot_sniper.mp3',
  shoot_rpg:'sound/sfx/shoot_rpg.mp3', shoot_laser:'sound/sfx/shoot_laser.mp3',
  shoot_minigun:'sound/sfx/shoot_minigun.wav', shoot_boomerang:'sound/sfx/shoot_boomerang.mp3',
  shoot_burstRifle:'sound/sfx/shoot_burstRifle.mp3', shoot_grenadeLauncher:'sound/sfx/shoot_grenadeLauncher.mp3',
  rail_charge:'sound/sfx/rail_charge.mp3', rail_fire:'sound/sfx/rail_fire.mp3',
  reload_start:'sound/sfx/reload_start.mp3', reload_end:'sound/sfx/reload_end.mp3',
  button_hover:'sound/sfx/button_hover.wav', button_click:'sound/sfx/button_click.mp3',
  hit:'sound/sfx/hit.mp3', enemy_die:'sound/sfx/enemy_die.mp3', enemy_shot:'sound/sfx/enemy_shot.mp3',
  death_big:'sound/sfx/death_big.mp3', elite_cue:'sound/sfx/elite_cue.wav',
  bounce:'sound/sfx/bounce.wav', dash:'sound/sfx/dash.wav',
  wave_end_normal:'sound/sfx/wave_end_normal.mp3', wave_end_boss:'sound/sfx/wave_end_boss.mp3',
  weapon_katana:'sound/sfx/weapon_katana.wav', weapon_dagger:'sound/sfx/weapon_dagger.wav',
  weapon_axe:'sound/sfx/weapon_axe.wav', weapon_samuraiSword:'sound/sfx/weapon_samuraiSword.wav',
  weapon_hook_shoot:'sound/sfx/weapon_hook_shoot.wav', weapon_hook_hitwall:'sound/sfx/weapon_hook_hitwall.wav',
  totem:'sound/sfx/totem.wav', reroll:'sound/sfx/reroll.wav', buy:'sound/sfx/buy.wav',
  boss_next_phase:'sound/sfx/boss_next_phase.wav',
};
const sfxBuffers = {};   // key -> decoded AudioBuffer
const _sfxRaw = {};      // key -> fetched ArrayBuffer awaiting decode
let _sfxFetchStarted=false, _sfxDecodeStarted=false;
function _decodeSfx(key){
  const raw=_sfxRaw[key]; if(!raw||!AC||sfxBuffers[key]) return;
  // decodeAudioData detaches the buffer, so decode a copy (lets a fresh AC re-decode).
  try{ AC.decodeAudioData(raw.slice(0), b=>{ sfxBuffers[key]=b; }, ()=>{}); }catch(e){}
}
function _fetchOk(url){ return fetch(url).then(r=>{ if(r.ok) return r.arrayBuffer(); throw 0; }); }
function _fetchSfx(){
  if(!window.NEONBRAWL_CONFIG.assets.samples) return;
  if(_sfxFetchStarted) return; _sfxFetchStarted=true;
  for(const key in SFX_FILES){
    const raw=SFX_FILES[key], norm=raw.replace('sound/sfx/','sound/sfx_normalized/');
    // Prefer the loudness-normalized copy (normalize-audio.ps1); fall back to the
    // raw file if it hasn't been generated. Either missing -> synth fallback.
    _fetchOk(norm).catch(()=>_fetchOk(raw))
      .then(buf=>{ _sfxRaw[key]=buf; if(AC) _decodeSfx(key); })
      .catch(()=>{});
  }
}
function loadSfx(){ _fetchSfx(); if(_sfxDecodeStarted||!AC) return; _sfxDecodeStarted=true; for(const key in _sfxRaw) _decodeSfx(key); }
// Play a decoded sample through the master bus. Returns false if not ready, so
// the caller can run its synth fallback. vol 0..1, rate = playbackRate.
// HTML5 <audio> pool used as a pre-gesture fallback for SFX. Chrome keeps an
// AudioContext 'suspended' until a user gesture even on autoplay-permitted
// origins, but an <audio> element IS allowed to play there — so this lets menu
// hover/click SFX sound before the first click (same trick the BGM uses, and
// the same fallback Tetris's SFX use).
const _sfxHtmlPool = {};
function _playSampleHtml(key, vol){
  if(!window.NEONBRAWL_CONFIG.assets.samples) return false;
  const url = SFX_FILES[key]; if(!url) return false;
  const pool = _sfxHtmlPool[key] || (_sfxHtmlPool[key] = []);
  let a = null;
  for(const el of pool){ if(el.paused || el.ended){ a = el; break; } }
  if(!a){ if(pool.length < 4){ a = new Audio(url); a.preload='auto'; pool.push(a); } else { a = pool[0]; } }
  try{ a.currentTime = 0; }catch(e){}
  a.volume = Math.max(0, Math.min(1, vol * (nbMuted ? 0 : nbVolume/100)));
  const p = a.play(); if(p && p.catch) p.catch(()=>{});
  return true;
}
// Gun-fire samples play at a reduced volume. High fire-rate weapons (SMG,
// minigun, AK, flamethrower, laser) stack many shots per second and at full
// volume the gunfire drowns out hits, deaths and music. Scaled centrally here
// so every shoot call — and its throttled variant — gets the same reduction.
const GUN_SFX_VOL = 0.35;
const GUN_SFX_KEYS = new Set([
  'shoot_pistol','shoot_smg','shoot_ak','shoot_shotgun','shoot_flame',
  'shoot_sniper','shoot_rpg','shoot_laser','shoot_minigun','shoot_boomerang',
  'shoot_burstRifle','shoot_grenadeLauncher','rail_fire',
]);
function playSample(key, vol=1, rate=1){
  if(GUN_SFX_KEYS.has(key)) vol *= GUN_SFX_VOL;
  const buf=sfxBuffers[key];
  // Preferred: Web Audio (low-latency, normalized buffers) once the context runs.
  if(buf && AC && AC.state==='running'){
    const dest=audioDest();
    if(dest){
      try{
        const src=AC.createBufferSource(); src.buffer=buf;
        if(rate!==1) src.playbackRate.value=rate;
        if(vol!==1){ const g=AC.createGain(); g.gain.value=vol; src.connect(g); g.connect(dest); }
        else src.connect(dest);
        src.start();
        return true;
      }catch(e){}
    }
  }
  // Context not running yet (pre-gesture / decoding): nudge it for next time and
  // play via <audio> so the sound still happens before the first click.
  if(AC && AC.state==='suspended') AC.resume();
  return _playSampleHtml(key, vol);
}
// Like playSample but rate-limited per key, so clustered events (many enemy
// deaths in one AoE, a bullet stream hitting the player) don't stack the same
// sample into a loud mush. Returns true whenever the sample is loaded (played
// OR throttled) so the synth fallback stays suppressed; false only if unloaded.
const _sfxThrotT={};
function playSampleT(key, ms, vol=1){
  if(!sfxBuffers[key]) return false;
  const n=performance.now();
  if(n-(_sfxThrotT[key]||0)>=ms){ _sfxThrotT[key]=n; playSample(key,vol); }
  return true;
}
// Railgun charge is a long (~7s) one-shot sample: play it ONCE when charging
// starts and cut it the instant the player releases — not retriggered per tick.
let _railChargeSrc=null, _railChargeGain=null;
function startRailChargeSfx(){
  if(_railChargeSrc) return; // already playing this charge
  const buf=sfxBuffers['rail_charge'], dest=audioDest();
  if(!buf||!AC||!dest) return;
  if(AC.state==='suspended') AC.resume();
  try{
    const src=AC.createBufferSource(); src.buffer=buf;
    const g=AC.createGain(); g.gain.value=1;
    src.connect(g); g.connect(dest); src.start();
    src.onended=()=>{ if(_railChargeSrc===src){ _railChargeSrc=null; _railChargeGain=null; } };
    _railChargeSrc=src; _railChargeGain=g;
  }catch(e){}
}
function stopRailChargeSfx(){
  if(!_railChargeSrc) return;
  const src=_railChargeSrc, g=_railChargeGain; _railChargeSrc=null; _railChargeGain=null;
  try{
    // 40ms fade so the cut is instant but doesn't click.
    if(g&&AC){ const t=AC.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value,t); g.gain.linearRampToValueAtTime(0.0001,t+0.04); src.stop(t+0.06); }
    else src.stop();
  }catch(e){}
}
_fetchSfx(); // start downloading immediately; decode happens once the AudioContext exists
// ── UI click / hover SFX ──────────────────────────────────
// Delegated so dynamically-built cards (skills, weapons, relics, difficulty)
// are covered without per-element wiring. closest() scopes it to real buttons
// and selection cards, so canvas / gameplay clicks never trigger it. Hover
// de-dupes per element with a short throttle so sweeping a row doesn't machine-gun.
const SFX_UI_SEL='button,.buff-card,.nb-diff-card';
// Unlock audio + start the menu music on the first user gesture anywhere — no
// click-to-start screen needed (same as the other games). Browsers block all
// audio until a gesture, so only the pre-first-click hover is silent.
let _nbAudioStarted=false;
function _nbStartAudio(){
  if(_nbAudioStarted) return; _nbAudioStarted=true;
  try{ initAC(); }catch(e){}
  try{ preloadBgm(); }catch(e){}
  try{ if(gState==='menu') playBgm('menu'); }catch(e){}
}
document.addEventListener('pointerdown', _nbStartAudio, true);
document.addEventListener('keydown', _nbStartAudio, true);
// Also try to bring up the Web Audio context on load (no gesture). On an
// autoplay-permitted origin it starts 'running' so hover/click SFX work right
// away (matching the auto-started BGM); otherwise it's 'suspended' and the first
// gesture resumes it. Placed here (after the SFX defs) so initAC()->loadSfx()
// isn't called before SFX_FILES exists. Does NOT set _nbAudioStarted, so the
// gesture handler still runs to resume a suspended context.
try{ initAC(); }catch(e){}
// Hover: only play when the hovered button/card actually CHANGES. We track the
// last matched element via closest() (including null), so moving WITHIN a card
// over its child text/icon doesn't re-trigger, while leaving and re-entering does.
let _uiHoverEl=null, _uiHoverT=0;
document.addEventListener('pointerover',e=>{
  const el=(e.target&&e.target.closest&&e.target.closest(SFX_UI_SEL))||null;
  if(el===_uiHoverEl) return;   // same element (or both null) -> nothing changed
  _uiHoverEl=el;
  if(!el) return;               // moved off any button/card -> state updated, no sound
  const n=performance.now(); if(n-_uiHoverT<40) return; _uiHoverT=n;
  playSample('button_hover',0.5);
});
// Capture phase so the click sound still fires for cards that re-render / close
// themselves in their own click handler.
document.addEventListener('click',e=>{
  const el=e.target&&e.target.closest&&e.target.closest(SFX_UI_SEL);
  if(el) playSample('button_click',0.7);
},true);
function makeNoiseBuffer(){
  if(noiseBuf||!AC) return noiseBuf;
  const len=Math.floor(AC.sampleRate*0.8);
  noiseBuf=AC.createBuffer(1,len,AC.sampleRate);
  const d=noiseBuf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
  return noiseBuf;
}
function tone(f,d,v=.15,t='sine',sv=0.001,delay=0,endF=null){
  if(!AC) return;
  try{
    const at=AC.currentTime+delay;
    const o=AC.createOscillator(),g=AC.createGain();
    o.connect(g); g.connect(audioDest()); o.type=t;
    o.frequency.setValueAtTime(f,at);
    if(endF) o.frequency.exponentialRampToValueAtTime(Math.max(1,endF),at+d);
    g.gain.setValueAtTime(0.0001,at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002,v),at+0.008);
    g.gain.exponentialRampToValueAtTime(sv,at+d);
    o.start(at); o.stop(at+d+0.02);
  }catch(e){}
}
function noise(d=0.12,v=0.12,type='bandpass',freq=900,q=1.2,delay=0){
  if(!AC) return;
  try{
    const at=AC.currentTime+delay;
    const src=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();
    src.buffer=makeNoiseBuffer();
    f.type=type; f.frequency.setValueAtTime(freq,at); f.Q.value=q;
    src.connect(f); f.connect(g); g.connect(audioDest());
    g.gain.setValueAtTime(0.0001,at);
    g.gain.exponentialRampToValueAtTime(v,at+0.006);
    g.gain.exponentialRampToValueAtTime(0.0001,at+d);
    src.start(at); src.stop(at+d+0.02);
  }catch(e){}
}
const sShoot   =()=>{tone(920,0.055,0.045,'square',0.001,0,420);noise(0.035,0.028,'highpass',1800,0.6);};
// Per-gun primary-fire SFX. Each gun has its own envelope so the audio
// telegraph matches the visual: pistol = balanced pop, SMG = light rapid
// click (low gain so it doesn't fatigue the ear at ~8 shots/sec), shotgun
// = low thud + long shrapnel tail + bright crack on top.
const sShootPistol = () => {
  if(playSample('shoot_pistol')) return;
  tone(680, 0.065, 0.058, 'square',  0.001, 0,    260);
  noise(0.045, 0.040, 'highpass', 1500, 0.7);
  // Brief sub-thump for "weight" since pistol fire rate is slower.
  tone(150, 0.055, 0.045, 'sine',    0.001, 0,    55);
};
const sShootSmg = () => {
  if(playSample('shoot_smg')) return;
  // Faint quick click — gain stays low because this plays ~8x/sec when held.
  tone(1240, 0.030, 0.028, 'square',  0.001, 0,    640);
  noise(0.022, 0.020, 'highpass', 2600, 0.6);
};
const sShootAk = () => {
  if(playSample('shoot_ak')) return;
  tone(520, 0.052, 0.055, 'square', 0.001, 0, 210);
  tone(118, 0.060, 0.040, 'sine', 0.001, 0, 64);
  noise(0.050, 0.055, 'bandpass', 1500, 0.9);
  noise(0.024, 0.030, 'highpass', 3100, 0.6, 0.01);
};
const sShootShotgun = () => {
  if(playSample('shoot_shotgun')) return;
  // ── Blast ──────────────────────────────────────────────
  // Cavernous low thud — front of the blast.
  tone(82, 0.20, 0.20, 'sine', 0.001, 0, 32);
  // Wide noise body — feels like 12 pellets at once.
  noise(0.18, 0.13, 'lowpass',  1100, 0.8);
  noise(0.11, 0.085, 'bandpass', 2400, 1.2, 0.02);
  // Bright crack riding on top so it sounds metallic, not just bassy.
  tone(420, 0.050, 0.075, 'sawtooth', 0.001, 0, 75);
  // ── Pump-action bolt ───────────────────────────────────
  // After the boom, the player hears the bolt cycle — pull-back schick
  // followed by a chunk-forward lock. Both are delayed via the `noise()` /
  // `tone()` delay arg. Shotgun fireCd is 0.85 s so the whole sequence
  // (peaks at ~0.40 s) finishes well before the next shot.
  // Pull-back: gritty bandpass hiss centred above the blast tail.
  noise(0.13, 0.070, 'bandpass', 1900, 1.6, 0.18);
  noise(0.09, 0.045, 'highpass', 2800, 0.9, 0.22);
  // Lock-forward CLACK — two short noise layers at different bands so it
  // reads as "metal hits metal." The previous 260 Hz square tone here gave
  // an audible tonal pop that didn't suit a shotgun bolt; pure noise hits
  // sound cleaner and more mechanical.
  noise(0.05, 0.080, 'bandpass', 480,  1.6, 0.34); // sub thunk
  noise(0.04, 0.060, 'bandpass', 1500, 2.0, 0.345); // metallic click on top
};
const sShootFlame = () => {
  if(playSample('shoot_flame')) return;
  noise(0.075,0.034,'lowpass',760,0.8);
  tone(120,0.035,0.026,'sawtooth',0.001,0,42);
};
const sShootSniper = () => {
  if(playSample('shoot_sniper')) return;
  tone(1580,0.08,0.09,'square',0.001,0,620);
  tone(88,0.18,0.14,'sine',0.001,0,34);
  noise(0.12,0.07,'highpass',2600,0.8);
};
const sShootRpg = () => {
  if(playSample('shoot_rpg')) return;
  tone(96,0.16,0.10,'sawtooth',0.001,0,46);
  noise(0.15,0.08,'lowpass',620,0.9);
  noise(0.06,0.035,'bandpass',1800,1.2,0.03);
};
const sShootLaser = () => {
  if(playSample('shoot_laser')) return;
  tone(1760,0.055,0.04,'sine',0.001,0,840);
  tone(2320,0.040,0.025,'triangle',0.001,0.012,760);
};
const sShootMinigun = () => {
  if(playSample('shoot_minigun')) return;
  tone(760,0.026,0.022,'square',0.001,0,360);
  noise(0.025,0.020,'highpass',2500,0.6);
};
const sShootBoomerang = () => {
  if(playSample('shoot_boomerang')) return;
  tone(520,0.09,0.05,'triangle',0.001,0,180);
  noise(0.08,0.035,'bandpass',1200,1.8);
};
const sShootBurst=()=>{if(playSample('shoot_burstRifle'))return;sShootSmg();}; // burst rifle has its own sample; falls back to the SMG sound
const sShootGrenade=()=>{if(playSample('shoot_grenadeLauncher'))return;sShootRpg();}; // grenade launcher; falls back to the RPG sound
const sHit     =()=>{if(playSampleT('hit',50))return;tone(210,0.075,0.075,'triangle',0.001,0,120);noise(0.055,0.045,'bandpass',520,1.0);};
const sDie     =()=>{if(playSample('death_big'))return;tone(360,0.18,0.16,'sawtooth',0.001,0,120);noise(0.18,0.08,'lowpass',700,0.8,0.04);};
const sWaveClr =()=>{[440,554,659,880].forEach((f,i)=>tone(f,0.13,0.09,'sine',0.001,i*0.075));};
// Wave-clear fanfare: boss waves (every 5th) get their own sample; synth chime is the fallback.
let _waveEndSfxDone=false; // one clear-fanfare per wave; reset when a new wave begins
const sWaveEnd =()=>{
  if(_waveEndSfxDone) return; // boss plays it on the kill, so the post-card openExit must not replay it
  _waveEndSfxDone=true;
  if(playSample(waveNum%5===0?'wave_end_boss':'wave_end_normal')) return;
  sWaveClr();
};
const sGameOver=()=>{[460,320,190].forEach((f,i)=>tone(f,0.28,0.16,'triangle',0.001,i*0.18,f*0.62));noise(0.42,0.055,'lowpass',380,0.9,0.08);};
const sPU      =()=>{[620,930,1240].forEach((f,i)=>tone(f,0.09,0.075,'triangle',0.001,i*0.045));};
const sEnDie   =()=>{if(playSampleT('enemy_die',50))return;tone(360,0.055,0.055,'triangle',0.001,0,190);noise(0.05,0.028,'bandpass',900,1.4);};
const sEnemyShot=()=>{if(playSample('enemy_shot'))return;tone(240,0.055,0.042,'sawtooth',0.001,0,110);noise(0.05,0.03,'bandpass',650,1.1);};
const sCharge   =()=>{tone(620,0.16,0.045,'sine',0.001,0,1350);noise(0.12,0.018,'highpass',2600,0.8);};
const sExplosion=()=>{tone(58,0.28,0.18,'sine',0.001,0,34);noise(0.26,0.11,'lowpass',520,0.7);noise(0.08,0.045,'bandpass',1900,0.8);};
const sBossPhase=()=>{if(playSample('boss_next_phase'))return;[75,110,160,240].forEach((f,i)=>tone(f,0.24,0.12,'sawtooth',0.001,i*0.065,f*0.8));noise(0.32,0.08,'lowpass',460,0.9);};
const sSlam     =()=>{tone(45,0.22,0.20,'sine',0.001,0,32);noise(0.14,0.09,'lowpass',340,0.8);};
const sElite    =()=>{if(playSample('elite_cue'))return;tone(420,0.07,0.055,'triangle',0.001);tone(720,0.09,0.045,'triangle',0.001,0.04);};
// Skill SFX
const sFireHit  =()=>{noise(0.12,0.07,'bandpass',1200,0.9);tone(180,0.10,0.075,'sawtooth',0.001,0,95);};
const sIceHit   =()=>{tone(1580,0.055,0.07,'sine',0.001);tone(1040,0.08,0.045,'triangle',0.001,0.025);noise(0.045,0.025,'highpass',3400,1.2);};
const sThunderH =()=>{noise(0.095,0.085,'highpass',2400,0.9);tone(72,0.16,0.13,'square',0.001,0,45);tone(2500,0.035,0.055,'sine');};
const sPoisonH  =()=>{noise(0.16,0.04,'bandpass',420,2.5);tone(260,0.13,0.045,'sine',0.001,0,180);};
const sLightH   =()=>{noise(0.13,0.10,'highpass',3000,0.8);tone(82,0.18,0.14,'sawtooth',0.001,0,48);tone(3400,0.04,0.055,'sine');};
const sBarrierH =()=>{[850,1160,1500].forEach((f,i)=>tone(f,0.055,0.07,'sine',0.001,i*0.025));};
const sBounce   =()=>{if(playSampleT('bounce',40))return;tone(760,0.035,0.04,'triangle',0.001,0,520);};
const sSpell    =()=>{tone(95,0.20,0.16,'sine',0.001,0,70);[330,620,1180].forEach((f,i)=>tone(f,0.08,0.075,'triangle',0.001,i*0.04));noise(0.16,0.035,'bandpass',1500,1.1);};
const sDashMove =()=>{if(playSample('dash'))return;tone(520,0.08,0.045,'triangle',0.001,0,1150);noise(0.06,0.028,'highpass',1800,0.9);};
// Per-gun shoot SFX dispatch — shared by the local fire path and the remote
// (relayed) fire handlers so there's one mapping to maintain.
function playGunShootSfx(gunId){
  if(gunId==='smg') sShootSmg();
  else if(gunId==='ak47') sShootAk();
  else if(gunId==='shotgun') sShootShotgun();
  else if(gunId==='flamethrower'||gunId==='cryo') sShootFlame();
  else if(gunId==='sniper') sShootSniper();
  else if(gunId==='burst') sShootBurst();
  else if(gunId==='grenade') sShootGrenade();
  else if(gunId==='rpg') sShootRpg();
  else if(gunId==='laser') sShootLaser();
  else if(gunId==='minigun') sShootMinigun();
  else if(gunId==='boomerang') sShootBoomerang();
  else if(gunId==='gravity'){tone(180,0.32,0.12,'sine',0.001,0,48);tone(420,0.22,0.05,'triangle',0.001,0,120);}
  else if(gunId==='railgun') sRailBurst();
  else sShootPistol();
}
// Other players' gunfire/dash SFX, gated by the "others SFX" toggle and lightly
// throttled so a lobby full of full-auto weapons doesn't turn into mush.
let _remoteShootT=0; const _remoteDashT={};
function playRemoteGunSfx(gunId){
  if(!othersSfxOn()) return;
  const n=performance.now(); if(n-_remoteShootT<45) return; _remoteShootT=n;
  playGunShootSfx(gunId);
}
function playRemoteDashSfx(id){
  if(!othersSfxOn()) return;
  const n=performance.now(); if(n-(_remoteDashT[id]||0)<400) return; _remoteDashT[id]=n; // once per dash, not per ghost
  sDashMove();
}
const sAfterimageBurst=()=>{tone(92,0.14,0.11,'sine',0.001,0,46);tone(980,0.07,0.045,'triangle',0.001);noise(0.11,0.05,'bandpass',1500,1.0);};
const sPhaseStep=()=>{tone(1360,0.045,0.045,'sine',0.001,0,720);noise(0.05,0.025,'highpass',2600,0.8);};
const sBlinkStrike=()=>{noise(0.075,0.055,'highpass',4200,0.7);tone(1320,0.045,0.045,'triangle',0.001,0,620);tone(150,0.11,0.045,'sine',0.001,0.025,88);};
const sKineticBurst=(charge=1)=>{tone(70,0.18,0.10+charge*0.06,'sine',0.001,0,42);tone(520+charge*320,0.10,0.05,'triangle',0.001);noise(0.12,0.055,'bandpass',900+charge*800,0.9);};
const sFactoryGate=()=>{tone(110,0.35,0.12,'sawtooth',0.001,0,68);tone(660,0.18,0.055,'triangle',0.001,0.08,1320);noise(0.32,0.075,'bandpass',820,0.9);};
const sMeteorFall=()=>{tone(820,0.24,0.05,'sawtooth',0.001,0,180);noise(0.20,0.052,'bandpass',1250,0.9);};
const sRailBurst=()=>{if(playSample('rail_fire'))return;tone(2200,0.045,0.06,'square',0.001,0,980);noise(0.07,0.05,'highpass',3200,0.75);};
const sRailCharge=()=>{if(playSample('rail_charge'))return;tone(920,0.13,0.028,'sine',0.001,0,1680);tone(1880,0.06,0.018,'triangle',0.001,0.035);noise(0.055,0.018,'highpass',3600,0.7);};
const sRailMax=()=>{tone(1640,0.12,0.055,'triangle',0.001);tone(3280,0.08,0.040,'sine',0.001,0.035);noise(0.08,0.026,'highpass',4600,0.9);};
const sGrenadeArm=()=>{tone(520,0.05,0.035,'triangle',0.001);tone(980,0.035,0.022,'sine',0.001,0.045);};
const sGrenadeBoom=()=>{tone(62,0.18,0.18,'sine',0.001,0,34);noise(0.22,0.08,'lowpass',520,1.1);tone(180,0.08,0.055,'sawtooth',0.001,0.025,90);};
const sOverclock=()=>{[920,1120,1340].forEach((f,i)=>tone(f,0.04,0.035,'square',0.001,i*0.025,520));noise(0.08,0.032,'highpass',2600,0.8);};
const sOrbPulse=()=>{tone(520,0.10,0.04,'sine',0.001,0,260);tone(1040,0.07,0.03,'triangle',0.001,0.025);};
const sArcaneLoop=()=>{[520,780,1170].forEach((f,i)=>tone(f,0.075,0.035,'triangle',0.001,i*0.035));noise(0.10,0.025,'bandpass',1700,1.1);};
const sDuelGuard=()=>{tone(980,0.055,0.035,'sine',0.001);tone(1480,0.07,0.03,'triangle',0.001,0.025);};
// Chain Detonate — deeper boom with a quick tonal pop and bandpass tail.
const sDetonate=()=>{tone(72,0.22,0.16,'sine',0.001,0,38);noise(0.18,0.08,'lowpass',680,0.85);tone(240,0.06,0.05,'square',0.001,0.025,140);};
// Round Surge — short bright chip when an extra shot fires.
const sRoundSurge=()=>{tone(1640,0.045,0.045,'square',0.001,0,820);noise(0.04,0.025,'highpass',3200,0.8);};
// Buff drop spawn — gentle "treasure" chime.
const sBuffDrop=()=>{[660,990,1320].forEach((f,i)=>tone(f,0.08,0.05,'sine',0.001,i*0.04));};
// Buff pickup — bright triadic chord.
const sBuffPick=()=>{[880,1100,1320,1660].forEach((f,i)=>tone(f,0.08,0.055,'triangle',0.001,i*0.025));noise(0.06,0.025,'highpass',2400,0.8);};
// Element reaction stings — pre-tuned per pair, low-mid attack with a high tail.
const sElemVapor =()=>{noise(0.18,0.06,'lowpass',680,0.9);tone(880,0.07,0.04,'sine',0.001,0.04,420);};
const sElemPlasma=()=>{tone(2400,0.05,0.05,'square',0.001,0,1180);noise(0.12,0.06,'highpass',2600,0.85);tone(120,0.10,0.08,'sine',0.001,0.02,60);};
const sElemCombust=()=>{tone(96,0.18,0.13,'sawtooth',0.001,0,52);noise(0.14,0.06,'bandpass',880,1.0);};
const sElemShatter=()=>{noise(0.09,0.05,'highpass',4200,0.8);[1800,2400,3200].forEach((f,i)=>tone(f,0.05,0.04,'triangle',0.001,i*0.02));};
const sElemBrittle=()=>{tone(560,0.10,0.05,'sine',0.001);noise(0.10,0.04,'bandpass',420,1.6,0.04);};
const sElemCorrode=()=>{noise(0.16,0.07,'bandpass',520,1.3);tone(220,0.13,0.07,'sawtooth',0.001,0.03,90);};
// Wave event opening cue — short rising chord.
const sEventCue=()=>{[520,780,1170,1560].forEach((f,i)=>tone(f,0.10,0.05,'triangle',0.001,i*0.05));noise(0.10,0.035,'highpass',2400,0.85);};
// Reload SFX — pair of percussive clicks layered with noise to fake a mag
// dropping out / mag slapping in. Two functions because the start and end
// of the reload need to sound distinct. Easy to swap for a recorded sample
// later — just replace the body with an AudioBufferSource if you find a
// nicer one online (no other callsites change).
const sReloadStart=()=>{
  if(playSample('reload_start')) return;
  // Mag-release click: thick low blip + short percussive noise puff.
  tone(220,0.060,0.085,'square',0.001,0,90);
  noise(0.055,0.040,'bandpass',520,1.4);
  tone(150,0.090,0.060,'sine',0.001,0.02,70);
};
const sReloadEnd=()=>{
  if(playSample('reload_end')) return;
  // Mag-seat + slide-rack: two tight clicks 80ms apart.
  tone(290,0.045,0.070,'square',0.001,0,160);
  noise(0.055,0.050,'bandpass',780,1.5);
  tone(380,0.040,0.060,'square',0.001,0.080,210);
  noise(0.040,0.038,'highpass',2200,0.8,0.080);
};
// Melee swing sounds — wide air-whoosh layered with a thinner metallic edge.
// Two delayed noise bursts fake a frequency sweep (the noise() helper has no
// built-in sweep), and the tone supplies the steel-on-air ring.
const sKatanaSlash=()=>{
  noise(0.14,0.075,'bandpass',780,0.7);
  noise(0.10,0.060,'bandpass',1700,0.9,0.045);
  tone(2100,0.10,0.045,'triangle',0.001,0.05,1050);
};
const sDaggerSlash=()=>{
  noise(0.07,0.070,'bandpass',2200,0.6);
  tone(2400,0.06,0.035,'sine',0.001,0.005,1500);
};
// Plays when the slash actually connects with at least one enemy.
const sMeleeHit=()=>{
  tone(340,0.075,0.085,'square',0.001,0,140);
  noise(0.075,0.060,'bandpass',720,1.3);
};
// Per-weapon swing samples (katana/dagger/axe/samurai). Falls back to the synth
// whoosh when the sample isn't loaded — dagger keeps its thinner sound, the rest
// reuse the katana whoosh.
const MELEE_SFX_KEYS={katana:'weapon_katana',dagger:'weapon_dagger',axe:'weapon_axe',samurai:'weapon_samuraiSword'};
const sMeleeSwing=(id)=>{
  const key=MELEE_SFX_KEYS[id];
  if(key && playSample(key)) return;
  if(id==='dagger') sDaggerSlash(); else sKatanaSlash();
};
// Hook: fired (rope flies out) and the wall-anchor thunk when it bites terrain.
const sHookShoot=()=>{ if(playSample('weapon_hook_shoot')) return; sDaggerSlash(); };
const sHookWall =()=>{ if(playSample('weapon_hook_hitwall')) return; sMeleeHit(); };
// Throttle skill hit SFX so simultaneous orb hits don't stack
let _sFireT=0,_sIceT=0,_sThunT=0,_sPoisT=0,_sEnemyShotT=0,_sChargeT=0;
const sFireHitThrot =()=>{const n=Date.now();if(n-_sFireT>140){_sFireT=n;sFireHit();}};
const sIceHitThrot  =()=>{const n=Date.now();if(n-_sIceT>140){_sIceT=n;sIceHit();}};
const sThunHitThrot =()=>{const n=Date.now();if(n-_sThunT>140){_sThunT=n;sThunderH();}};
const sPoisHitThrot =()=>{const n=Date.now();if(n-_sPoisT>200){_sPoisT=n;sPoisonH();}};
const sEnemyShotThrot=()=>{const n=Date.now();if(n-_sEnemyShotT>90){_sEnemyShotT=n;sEnemyShot();}};
const sChargeThrot=()=>{const n=Date.now();if(n-_sChargeT>450){_sChargeT=n;sCharge();}};

// Recorded BGM now drives the music (synth tracks retired). Boss waves pick boss
// track 1 or 2 at random and keep it across phase changes; everything else plays
// the normal wave track. Called at wave/boss start and on boss-slain (-> normal).
function musicStart(waveNum,bossMode){
  if(bossMode){
    if(_bgmKey==='boss1'||_bgmKey==='boss2') return; // keep the boss track already playing
    playBgm(Math.random()<0.5?'boss1':'boss2');
  } else {
    playBgm('normal');
  }
}
// No-op: BGM persists across waves + the shop; it's switched explicitly at the
// menu / game over / disconnect, so wave clears don't leave a silent gap.
function musicStop(){}
// Briefly open the music's low-pass so the track "swells" at big beats (boss
// entrance, phase change). Cheap, self-contained, no-ops if music isn't running.
function musicSwell(amt=1){
  if(!AC||!_musicLpf) return;
  try{
    const f=_musicLpf.frequency, base=f.value;
    f.cancelScheduledValues(AC.currentTime);
    f.setValueAtTime(base,AC.currentTime);
    f.linearRampToValueAtTime(base+850*amt,AC.currentTime+0.10);
    f.linearRampToValueAtTime(base,AC.currentTime+1.6);
  }catch(e){}
}
// Rising-pitch blip when the combo multiplier climbs — punctuates a streak.
function sComboUp(mult){
  if(!AC) return;
  try{
    const o=AC.createOscillator(),g=AC.createGain();
    o.type='square'; o.frequency.value=420+Math.min(mult,9)*85;
    g.gain.setValueAtTime(0.0001,AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.10,AC.currentTime+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,AC.currentTime+0.18);
    o.connect(g); g.connect(audioDest()||AC.destination); o.start(); o.stop(AC.currentTime+0.2);
  }catch(e){}
}
// Re-trigger the soft screen-edge glow when a combo milestone lands.
function pulseComboVignette(){
  const v=document.getElementById('comboVignette'); if(!v) return;
  v.classList.remove('pulse'); void v.offsetWidth; v.classList.add('pulse');
}
// Big slam-in boss name when a boss spawns — the "beat" before the fight.
function bossIntro(name,col){
  const el=document.getElementById('bossIntro'); if(!el) return;
  el.textContent=name;
  el.style.color=cssHex(col);
  el.style.setProperty('--bi-col',cssHex(col));
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

function setDownedOverlay(title, sub, fillPct=0){
  const overlay=document.getElementById('deadOverlay');
  const ttl=document.getElementById('downedTitle');
  const st=document.getElementById('downedSub');
  const fill=document.getElementById('reviveFill');
  if(ttl) ttl.textContent=title;
  if(st) st.textContent=sub;
  if(fill) fill.style.width=Math.max(0,Math.min(100,fillPct))+'%';
  if(overlay) overlay.style.display='flex';
}

function downPlayer(){
  player.hp=0;
  player.dead=true;
  player.downed=true;
  player.railWasCharging=false; stopRailChargeSfx(); // don't leave the rail charge looping if you die mid-charge
  player.downedT=effectiveBleedTime();
  player.reviveT=0;
  player.lastReviveTouch=0;
  player.invincible=0;
  // Bounty: no-deaths fails when local player goes down (any down counts).
  _waveEventDeathLocal=true;
  refreshHP();
  setDownedOverlay('DOWNED',`TEAMMATE REVIVE - ${Math.ceil(player.downedT)}s`,0);
  annText('TEAMMATE DOWN!','#ff3355');
  burst(player.pos,0xff3355,24);
  spawnShockwave(player.pos.x,player.pos.z,2.8,0xff3355,0.35,0.85);
  sDie();
  if(player.mesh){
    player.mesh.visible=true;
    player.mesh.position.set(player.pos.x,0.28,player.pos.z);
    player.mesh.scale.setScalar(0.78);
  }
  sendPlayerState();
  setTimeout(checkTeamWipe,300);
}

function revivePlayer(){
  player.dead=false;
  player.downed=false;
  player.downedT=0;
  player.reviveT=0;
  player.lastReviveTouch=0;
  player.hp=Math.max(1,Math.round(playerStats.maxHp*REVIVE_HP_PCT));
  recordHealing(player.hp);
  player.invincible=1.6;
  refreshHP();
  document.getElementById('deadOverlay').style.display='none';
  const zone=reviveZones.get(mp.myId);
  if(zone) zone.group.visible=false;
  if(player.mesh){
    player.mesh.visible=true;
    player.mesh.scale.setScalar(1);
    player.mesh.rotation.z=0;
    player.mesh.position.set(player.pos.x,0.55,player.pos.z);
  } else buildPlayer();
  annText('REVIVED!','#00ffcc');
  burst(player.pos,0x00ffcc,26);
  impactPulse(player.pos,0x00ffcc,2.0,isMobile?8:14);
  sWaveClr();
  sendPlayerState();
}

function reviveLocalForWaveClear(){
  if(player.downed||player.dead){
    player.dead=false;
    player.downed=true;
    revivePlayer();
  }
}

function reviveTeamForWaveClear(){
  reviveLocalForWaveClear();
  if(mp.isHost&&!mp.soloMode) broadcastMP({type:'WAVE_CLEAR_REVIVE'});
}

function updateDowned(dt){
  if(!player.downed) return;
  const reviveTime=effectiveReviveTime();
  // Count alive teammates standing on us. Bleed-out PAUSES while anyone is
  // reviving (resumes once they all leave), and revive speed scales with how
  // many are helping — two revivers fill twice as fast, etc.
  let reviverCount=0;
  for(const rp of Object.values(mp.remotePlayers)){
    if(rp.dead||rp.downed) continue;
    const range=effectiveReviveRange(rp.skills||{});
    if(Math.hypot(rp.pos.x-player.pos.x,rp.pos.z-player.pos.z)<=range) reviverCount++;
  }
  // A fresh revive ping still counts as one helper if that peer's position
  // packet hasn't arrived yet this frame.
  if(reviverCount===0 && performance.now()-(player.lastReviveTouch||0)<260) reviverCount=1;
  player.reviverCount=reviverCount;
  const reviverNear=reviverCount>0;
  // Diminishing-returns speed-up: each extra reviver multiplies by 1.5, so
  // 1 helper = 1x, 2 = 1.5x, 3 = 2.25x, 4 = 3.375x.
  const reviveSpeed=reviverNear?Math.pow(1.5,reviverCount-1):0;
  if(!reviverNear) player.downedT-=dt;
  if(reviverNear) player.reviveT=Math.min(reviveTime,player.reviveT+dt*reviveSpeed);
  else player.reviveT=Math.max(0,player.reviveT-dt*0.7);

  const pct=player.reviveT/reviveTime*100;
  const sub=reviverNear
    ? `REVIVING ${Math.round(pct)}%${reviverCount>1?` (${reviverCount} reviving)`:''} - ${Math.ceil(player.downedT)}s`
    : `WAIT FOR A TEAMMATE - ${Math.ceil(player.downedT)}s`;
  setDownedOverlay('DOWNED',sub,pct);
  if(player.mesh){
    player.mesh.visible=true;
    player.mesh.position.set(player.pos.x,0.28+Math.sin(Date.now()*0.012)*0.03,player.pos.z);
    player.mesh.rotation.z=Math.sin(Date.now()*0.006)*0.18;
    player.mesh.scale.setScalar(0.72+Math.sin(Date.now()*0.01)*0.04);
  }
  if(player.reviveT>=reviveTime){ revivePlayer(); return; }
  if(player.downedT<=0){
    player.downed=false;
    player.dead=true;
    player.reviveT=0;
    if(player.mesh) player.mesh.visible=false;
    setDownedOverlay('BLEED OUT','SPECTATING...',0);
    sendPlayerState();
    checkTeamWipe();
  }
}

function hurtPlayer(dmg){
  if(player.invincible>0||player.dead) return;
  if(player.barrierActive){
    player.barrierActive=false;
    player.barrierCd=BARRIER_CD[playerSkills.barrier||1];
    if(barrierMesh) barrierMesh.visible=false;
    burst(player.pos,0x44aaff,10); sBarrierH(); return;
  }
  // Buff Cache "defense" buff halves incoming damage while active.
  if(typeof buffDefenseMult==='function') dmg=Math.max(1,Math.round(dmg*buffDefenseMult()));
  // Brittle Bones (cursed) — all players take more damage.
  {
    const _bbMul=brittleBonesMul();
    if(_bbMul>1) dmg=Math.max(1,Math.round(dmg*_bbMul));
  }
  // Linked Pain (cursed, you own) — when YOU take damage, broadcast a share
  // of it to every teammate. Guests route through the host because they do
  // not have direct connections to other guests.
  if(hasRelic('linkedPain') && !mp.soloMode && dmg>0 && typeof broadcastMP==='function'){
    const share=Math.max(1,Math.round(dmg*linkedPainShareLocal()));
    for(const [sid,rp] of Object.entries(mp.remotePlayers||{})){
      const id=+sid;
      if(!isLivingPlayerState(rp)) continue;
      const msg={type:'HURT',targetId:id,dmg:share};
      if(mp.isHost){
        const c=mp.conns?.get(id);
        if(c&&c.open) c.send(JSON.stringify(msg));
      }else sendToHost(msg);
    }
  }
  // Vampire Night challenge — every hit on a player heals nearby enemies
  // (within 6m) by 10% of their max HP. Sustained damage punches through;
  // hit-and-run gives them their HP back.
  if(waveEvent && waveEvent.type==='challenge' && waveEvent.sub==='vampireNight' && enemies && enemies.length){
    for(const e of enemies){
      if(e.dead) continue;
      if(Math.hypot(e.pos.x-player.pos.x,e.pos.z-player.pos.z)<6){
        e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp*0.10));
      }
    }
  }
  // Iron Plate — flat % damage reduction from any source.
  const _ipLvl=playerSkills.ironPlate||0;
  if(_ipLvl){
    const _ipR=[0,0.05,0.10,0.10,0.15,0.20][_ipLvl]||0;
    if(_ipR>0) dmg=Math.max(1,Math.round(dmg*(1-_ipR)));
  }
  // Berserker's Heart — extra reduction while at low HP.
  const _bhLvl=playerSkills.berserkerHeart||0;
  if(_bhLvl && player.hp <= playerStats.maxHp*0.30){
    const _bhR=[0,0.25,0.25,0.40,0.40,0.55][_bhLvl]||0;
    if(_bhR>0) dmg=Math.max(1,Math.round(dmg*(1-_bhR)));
  }
  const skinRank=epicRank('secondSkin');
  if(skinRank){
    dmg=Math.max(1,Math.round(dmg*([1,0.75,0.50][skinRank]||1)));
    spawnSkillRingAura(player.pos.x,player.pos.z,1.15,0x44ff88,0.26,0.35);
    if(!regenSourcesBlocked()){
      setTimeout(()=>{
        if(player.dead||player.downed) return;
        const gained=healPlayer([0,5,10][skinRank]||0);
        if(gained) dmgNum('+'+gained+' HP',player.pos,'#aaffaa');
      }, 220);
    }
  }
  if(playerSkills.soulLinkArmy){
    const linked=getSummonHitTarget(player.pos.x,player.pos.z,2.6);
    if(linked){
      const absorbed=Math.ceil(dmg*0.38);
      dealDmgToTarget(linked,absorbed);
      dmg=Math.max(1,Math.round(dmg-absorbed));
      burst({x:linked.x,z:linked.z},0x44ffcc,isMobile?4:8);
      spawnShockwave(player.pos.x,player.pos.z,1.25,0x44ffcc,0.18,0.48);
      // Visible soul-link tether so it's clear the summon ate the hit.
      if(fxHeavyOK()) spawnSkillBeam(player.pos.x,player.pos.z,linked.x-player.pos.x,linked.z-player.pos.z,Math.hypot(linked.x-player.pos.x,linked.z-player.pos.z)||0.1,0.32,0x44ffcc,0.2,0.5);
    }
  }
  if((playerSkills.shieldBot||0)>0){
    const bot=shieldBots.find(b=>Math.hypot(b.pos.x-player.pos.x,b.pos.z-player.pos.z)<2.0);
    if(bot){
      bot.hp-=dmg*2;
      burst(bot.pos,0x4488ff,8); sBarrierH();
      if(bot.hp<=0){
        const bidx=shieldBots.indexOf(bot);
        if(bidx>=0){ scene.remove(shieldBots[bidx].mesh); _disposeGroup(shieldBots[bidx].mesh); shieldBots.splice(bidx,1); }
        shieldBotSpawnCd=SHIELDBOT_RESPAWN_BASE*getSummonCdMult();
        burst(bot.pos,0x4488ff,12);
      }
      return;
    }
  }
  dmg=absorbOverhealShield(dmg);
  if(dmg<=0) return;
  const taken=Math.min(player.hp,dmg);
  // Count HP actually lost, including while the remaining enemies spawn.
  if(gState==='playing'&&!waveTransition&&!waveClear) _waveEventDamageTaken+=taken;
  recordDamageTaken(taken);
  player.hp-=dmg; player.invincible=0.45; shakeAmt=0.35+dmg*0.025;
  sHit(); refreshHP(); dmgNum('-'+dmg,player.pos,'#ff3355');
  impactPulse(player.pos,0xff3355,1.1,isMobile?4:8);
  const _vg=document.getElementById('dmgVig');
  _vg.style.animation='none'; void _vg.offsetWidth;
  _vg.style.animation='vigOut 0.55s ease-out forwards';
  if(player.hp<=0){
    if(runRevives>0){
      runRevives--;
      player.hp=Math.max(1,Math.round(playerStats.maxHp*runReviveHpPct));
      player.invincible=1.4;
      refreshHP();
      annText('EMERGENCY REBOOT!','#00ffcc');
      burst(player.pos,0x00ffcc,20);
      impactPulse(player.pos,0x00ffcc,2.0,isMobile?8:14);
      sBarrierH();
      return;
    }
    if(!mp.soloMode){
      downPlayer();
      return;
    }
    player.hp=0; player.dead=true;
    burst(player.pos,0x00ffcc,22);
    if(player.mesh) scene.remove(player.mesh);
    sDie();
    const defeatedRun=runGeneration;
    if(mp.soloMode){
      setTimeout(()=>{
        if(runGeneration===defeatedRun&&gState==='playing'&&player.dead) gameOver();
      },1500);
    } else {
      setTimeout(()=>{
        if(runGeneration!==defeatedRun||gState!=='playing'||!player.dead) return;
        const allDead=Object.values(mp.remotePlayers).every(rp=>rp.dead);
        if(allDead){
          if(mp.isHost) broadcastMP(JSON.stringify({type:'GAME_OVER_ALL'}));
          gameOver();
        } else {
          document.getElementById('deadOverlay').style.display='flex';
        }
      },1200);
    }
  }
}

function killEnemy(target, fromRemote=false){
  // Reactions may remove this target before the outer attack finishes.
  // Retain identity: a saved array index can now point at a survivor.
  const e=typeof target==='number'?enemies[target]:target;
  if(!e||e.dead||!enemies.includes(e))return;
  e.dead=true;
  const killOwner=e._lastHitOwner??mp.myId;
  if(!fromRemote){
    recordKill(killOwner);
    if(killOwner===mp.myId)armRifleReload();
    else if(mp.isHost&&mp.remotePlayers[killOwner]?.gun==='ak47'&&mp.remotePlayers[killOwner]?.skills?.ak47Tactical){
      const c=mp.conns.get(+killOwner);if(c?.open)c.send(JSON.stringify({type:'AK47_RELOAD_READY',targetId:+killOwner}));
    }
  }
  if(e.type==='boss'){
    _bossClearPending=true;
    hitStop(0.22); musicSwell(1.3);
    if(currentBossTargetPoolIdx===e.poolIdx) currentBossTargetPoolIdx=null;
    const bc=(e.bossProfile&&e.bossProfile.col)||0xff3344, be=(e.bossProfile&&e.bossProfile.emi)||0xffaa00;
    const bx=e.pos.x, bz=e.pos.z;
    screenFlash(cssHex(bc),0.7);
    burst(e.pos,bc,isMobile?14:35); burst(e.pos,be,isMobile?10:25); burst(e.pos,0xffffff,isMobile?8:18);
    spawnShockwave(bx,bz,6.5,bc,0.55,1.0);
    shakeAmt=1.05;
    sExplosion();
    // Multi-stage finale: staggered secondary blasts, then a final white flash.
    for(let k=0;k<4;k++){
      setTimeout(()=>{
        const a=Math.random()*Math.PI*2, rad=1.2+Math.random()*2.2;
        const px=bx+Math.cos(a)*rad, pz=bz+Math.sin(a)*rad;
        burst({x:px,z:pz}, k%2?be:bc, isMobile?6:14);
        spawnShockwave(px,pz,2.2+Math.random()*1.4, k%2?be:bc, 0.4, 0.85);
        flashLight({x:px,z:pz},bc,5,7,0.2);
      }, 180+k*170);
    }
    setTimeout(()=>{ screenFlash('#ffffff',0.8); spawnShockwave(bx,bz,8.5,0xffffff,0.6,1.0); shakeAmt=Math.max(shakeAmt,0.9); sExplosion(); }, 900);
  }
  burst(e.pos,e.cfg.col,14);
  // Bomber: explode on death (host/solo only, not on remote clients)
  if(e.type==='bomber'&&!fromRemote){
    const expR=3.2, expDmg=Math.round(45*e.dmgMult);
    burst(e.pos,0xff5500,22); burst(e.pos,0xffaa00,12);
    spawnShockwave(e.pos.x,e.pos.z,expR,0xff6600,0.34,0.9);
    sExplosion();
    if(isLivingPlayerState(player)&&Math.hypot(player.pos.x-e.pos.x,player.pos.z-e.pos.z)<expR)
      hurtPlayer(expDmg);
    if(mp.isHost&&!mp.soloMode){
      for(const [sid,rp] of Object.entries(mp.remotePlayers)){
        if(isLivingPlayerState(rp)&&Math.hypot(rp.pos.x-e.pos.x,rp.pos.z-e.pos.z)<expR){
          const c=mp.conns.get(+sid); if(c&&c.open) c.send(JSON.stringify({type:'HURT',targetId:+sid,dmg:expDmg}));
        }
      }
    }
  }
  // All elites detonate on death; champions hit harder/wider.
  if(e.elite&&!fromRemote){
    const champ=e.elite==='champion';
    const ecol=e.cfg.emi||e.cfg.col;
    const expR=(champ?4.2:2.6)+Math.min(waveNum*0.05,1.2), expDmg=Math.round((champ?40:22)*e.dmgMult);
    burst(e.pos,ecol,champ?22:14); burst(e.pos,0xffffff,8);
    spawnShockwave(e.pos.x,e.pos.z,expR,ecol,0.30,0.85);
    sExplosion();
    if(isLivingPlayerState(player)&&Math.hypot(player.pos.x-e.pos.x,player.pos.z-e.pos.z)<expR)
      hurtPlayer(expDmg);
    if(mp.isHost&&!mp.soloMode){
      for(const [sid,rp] of Object.entries(mp.remotePlayers)){
        if(isLivingPlayerState(rp)&&Math.hypot(rp.pos.x-e.pos.x,rp.pos.z-e.pos.z)<expR){
          const c=mp.conns.get(+sid); if(c&&c.open) c.send(JSON.stringify({type:'HURT',targetId:+sid,dmg:expDmg}));
        }
      }
    }
  }
  // Champion finale: a parting bullet ring as it dies.
  if(e.elite==='champion'&&!fromRemote){
    const n=12;
    for(let bi=0;bi<n;bi++){
      const ang=(bi/n)*Math.PI*2;
      fireBullet(e.pos,_scratchDir.set(Math.sin(ang),0,Math.cos(ang)),false,Math.round(12*e.dmgMult));
    }
    spawnShockwave(e.pos.x,e.pos.z,3.0,0xff66ff,0.28,0.8);
  }
  // Chain Detonate skill — local kill makes the corpse explode and damages
  // surrounding enemies. dmgPct scales with effective skill level. We use
  // playerStats.attackDmg as the base so it tracks the +3 stat upgrades.
  if(!fromRemote&&killOwner===mp.myId&&(playerSkills.detonate||0)>0){
    const lvl=playerSkills.detonate;
    const _detR=[0,1.6,1.9,2.2,2.6,3.0][lvl]||1.8;
    const _detMult=[0,1.4,1.9,2.4,3.0,3.5][lvl]||1.6;
    const detDmg=Math.max(1,Math.round(playerStats.attackDmg*_detMult*crystalPowerMult()));
    spawnShockwave(e.pos.x,e.pos.z,_detR,0xff8800,0.26,0.78);
    burst(e.pos,0xff6600,isMobile?8:16); burst(e.pos,0xffaa00,isMobile?4:8);
    flashLight(e.pos,0xff8800,5.0,4.5,0.13);
    sDetonate();
    for(let dj=enemies.length-1;dj>=0;dj--){
      const de=enemies[dj]; if(!de||de.dead||de===e) continue;
      const dd=Math.hypot(de.pos.x-e.pos.x,de.pos.z-e.pos.z);
      if(dd<=_detR+de.cfg.r){
        const fall=1-Math.min(0.65,dd/Math.max(1,_detR))*0.55;
        damageEnemyIndex(dj,Math.max(1,Math.round(detDmg*fall)),0xff8800,0.16,mp.myId,'skill');
      }
    }
    if(miniObjective?.type==='spawners'&&!miniObjective.complete){
      for(const sp of (miniObjective.spawners||[])){
        if(!sp.alive) continue;
        const dd=Math.hypot(sp.x-e.pos.x,sp.z-e.pos.z);
        if(dd<=_detR+0.5){
          const fall=1-Math.min(0.65,dd/Math.max(1,_detR))*0.55;
          damageMiniObjectiveAt(sp.x,sp.z,Math.max(1,Math.round(detDmg*fall)),0.5,0xff8800);
        }
      }
    }
  }
  // Buff Cache (Loot Drop) epic skill — chance to drop a temporary buff orb
  // on enemy death. Host owns drops in MP so the pool stays consistent.
  if(!fromRemote&&killOwner===mp.myId&&(playerSkills.lootDrop||0)>0){
    const lvl=playerSkills.lootDrop;
    const dropChance=[0,0.15,0.15,0.15,0.30,0.30][lvl]||0;
    if(dropChance>0&&Math.random()<dropChance) spawnBuffDrop(e.pos.x,e.pos.z);
  }
  rollCrystalDrop(e);
  // Crystal Lining — guaranteed flat crystal trickle on every kill (separate
  // from the random rollCrystalDrop loot). Only the kill owner gets paid.
  if(!fromRemote && killOwner===mp.myId){
    applyBloodGrowthKill();
    const _clLvl=playerSkills.crystalLining||0;
    if(_clLvl){
      const _clAmt=[0,1,2,2,3,4][_clLvl]||0;
      if(_clAmt>0) grantRunCrystal(_clAmt, e.pos);
    }
    // Bloodthirst — melee kills add a stack (cap 3) and refresh the 3s
    // window. Tracked on player; the melee path multiplies damage from it.
    if(_meleeSwingActive && (playerSkills.bloodthirst||0)>0){
      player._btStacks=Math.min(3,(player._btStacks||0)+1);
      player._btT=3.0;
    }
  }
  // Splitter bursts into two fast shards on death (host-only; the shards sync
  // to clients via the next HOST_STATE — no extra message needed).
  if(e.type==='splitter'&&!fromRemote){
    burst(e.pos,0xff66aa,isMobile?8:16);
    spawnShockwave(e.pos.x,e.pos.z,2.0,0xff66aa,0.3,0.85);
    for(let s=0;s<2;s++){
      const a=Math.PI*0.5+s*Math.PI+(Math.random()-0.5)*0.6;
      spawnEnemy('splitterling',e.pos.x+Math.cos(a)*1.4,e.pos.z+Math.sin(a)*1.4);
    }
  }
  releaseEnemySlot(e);
  if(!fromRemote&&!mp.soloMode&&mp.connected){
    const _kmsg=JSON.stringify({type:'KILL_ENEMY',pidx:e.poolIdx});
    if(mp.isHost) broadcastMP(_kmsg); else sendToHost(_kmsg);
  }
  streak++; streakT=4; killCount++;
  const mult=1+Math.floor(streak/3);
  const gained=Math.round(e.cfg.pts*(e.scoreMult||1)*mult);
  score+=gained;
  dmgNum((mult>1?`×${mult} `:'')+'+'+gained,e.pos,mult>1?'#ffe066':'#ffd700');
  if(streak>3){
    const sd=document.getElementById('streakD');
    if(sd){
      sd.textContent=`🔥 ${streak}× COMBO`;
      const tier=Math.min(5,mult);
      sd.style.color=['#00ffff','#7dff6a','#ffd166','#ff9a3d','#ff4466'][tier-1]||'#ff4466';
      sd.style.fontSize=(13+tier*2)+'px';
      sd.classList.remove('combo-pop'); void sd.offsetWidth; sd.classList.add('combo-pop');
    }
    // Punctuate each multiplier step (every 3 kills) with a rising blip + edge
    // pulse — only for our own kills so MP doesn't spam from teammates' streaks.
    if(killOwner===mp.myId && streak%3===0){ sComboUp(mult); pulseComboVignette(); }
  }
  const leechLvl=killOwner===mp.myId ? (playerSkills.leech||0) : (mp.remotePlayers[killOwner]?.skills?.leech||0);
  // Vampire Pact relic on the kill owner blocks the Vampiric skill heal —
  // pact replaces all other regen/lifesteal sources.
  const _leechBlocked=killOwner===mp.myId ? regenSourcesBlocked() : !!mp.remotePlayers[killOwner]?.relics?.vampirePact;
  if(!fromRemote&&leechLvl&&!_leechBlocked){
    const _lhp=LEECH_HP[leechLvl]||0;
    if(_lhp>0&&killOwner===mp.myId&&!player.dead){
      healPlayer(_lhp);
      dmgNum('+'+_lhp+' HP',player.pos,'#00ff88');
      playerGlow.color.setHex(0x00ff44); playerGlow.intensity=6; player.healFlashT=0.35;
    } else if(_lhp>0&&mp.isHost&&!mp.soloMode){
      const c=mp.conns.get(+killOwner);
      if(c&&c.open) c.send(JSON.stringify({type:'HEAL',targetId:+killOwner,amount:_lhp,color:'#00ff88'}));
    }
  }
  const adLvl=playerSkills.adrenaline||0;
  if(adLvl&&!player.dead){
    if(adLvl>=3) player.dashCd=Math.max(0,player.dashCd-0.18*adLvl);
  }
  // Gold drop
  if(mp.soloMode||mp.isHost){
    const _gd=GOLD_DROP_TABLE[e.type];
    if(_gd&&Math.random()<_gd.chance){
      const rawGold=_gd.min+Math.floor(Math.random()*(_gd.max-_gd.min+1));
      const _totemGold = (typeof totemGoldMult==='function')?totemGoldMult():1;
      const g=enemyGoldAmount(rawGold,_totemGold);
      if(!(greedyCrownBlocksMe() && greedyCrownActiveScope()==='all')){
        grantGold(g, e.pos, 'enemy_drop', { enemy:e.type, wave:waveNum });
      }
      if(!mp.soloMode) broadcastMP({type:'GOLD_DROP',amount:g,baseAmount:rawGold,teamMultiplier:_totemGold});
    }
    // Health bag drop (Loot Goblin luck skill) — host rolls, broadcasts spawn.
    // Bag stores a heal-fraction; picker heals that % of their own max HP.
    const _hdLvl=playerSkills.healDrop||0;
    if(_hdLvl){
      const _hdChance=HEAL_DROP_CHANCE[_hdLvl]||0;
      if(_hdChance>0 && Math.random()<_hdChance){
        const pct=HEAL_DROP_PCT[_hdLvl]||0;
        if(pct>0) spawnHealBag(e.pos.x, e.pos.z, pct);
      }
    }
  }
  sEnDie();
  // Splice by reference, not by the original idx — Chain Detonate's AoE
  // above calls damageEnemyIndex which can recursively kill neighbours and
  // splice them out, shifting our index. Using indexOf(e) finds the dying
  // enemy's CURRENT slot (or -1 if it's already been removed somehow).
  // Without this fix, dead enemies stay in the array with .dead=true,
  // blocking wave clear and looking visually stuck.
  const _liveIdx = enemies.indexOf(e);
  if(_liveIdx !== -1) enemies.splice(_liveIdx, 1);
  updateHUD();
}


function dealDmgToTarget(tgt, dmg){
  if(tgt.isSummon){
    const s=tgt.summonRef; if(!s||s.hp<=0) return;
    const pos=_summonPos(s);
    s.hp-=dmg; burst(pos,0xff4444,3);
    if(s.hp<=0){
      const cdMult=getSummonCdMult();
      if(tgt.summonType==='laserDrone'){
        const idx=summonDrones.findIndex(m=>m.userData===s);
        if(idx>=0){ disposeTrail(summonDrones[idx].userData.trail); scene.remove(summonDrones[idx]); _disposeGroup(summonDrones[idx]); summonDrones.splice(idx,1); }
      } else if(tgt.summonType==='repairDrone'){
        const idx=repairDrones.findIndex(m=>m.userData===s);
        if(idx>=0){ disposeTrail(repairDrones[idx].userData.trail); scene.remove(repairDrones[idx]); _disposeGroup(repairDrones[idx]); repairDrones.splice(idx,1); }
      } else if(tgt.summonType==='turret'){
        const idx=turrets.indexOf(s);
        if(idx>=0){ scene.remove(turrets[idx].mesh); _disposeGroup(turrets[idx].mesh); turrets.splice(idx,1); }
      } else if(tgt.summonType==='shieldBot'){
        const idx=shieldBots.indexOf(s);
        if(idx>=0){ scene.remove(shieldBots[idx].mesh); _disposeGroup(shieldBots[idx].mesh); shieldBots.splice(idx,1); }
        shieldBotSpawnCd=Math.max(shieldBotSpawnCd, SHIELDBOT_RESPAWN_BASE*cdMult);
      } else if(tgt.summonType==='sentinel'){
        const idx=sentinels.indexOf(s);
        if(idx>=0){ scene.remove(sentinels[idx].mesh); _disposeGroup(sentinels[idx].mesh); sentinels.splice(idx,1); }
        sentinelSpawnCd=Math.max(sentinelSpawnCd, SENTINEL_RESPAWN_BASE*cdMult);
      }
      burst(pos,0xff2244,8);
      spawnShockwave(pos.x,pos.z,1.1,0xff3355,0.18,0.55);
    }
    return;
  }
  if(tgt.isLocal){
    if(isLivingPlayerState(player)) hurtPlayer(dmg);
  } else {
    const rp=mp.remotePlayers[tgt.id];
    if(isLivingPlayerState(rp)){
      const c=mp.conns.get(tgt.id); if(c&&c.open) c.send(JSON.stringify({type:'HURT',targetId:tgt.id,dmg}));
    }
  }
}

// ── Main update ───────────────────────────────────────────
function bossDamageCircle(x,z,r,dmg){
  if(!player.dead&&!player.downed&&Math.hypot(player.pos.x-x,player.pos.z-z)<r) hurtPlayer(dmg);
  if(mp.isHost){
    for(const [id,rp] of Object.entries(mp.remotePlayers)){
      if(!rp.dead&&!rp.downed&&Math.hypot(rp.pos.x-x,rp.pos.z-z)<r){
        const c=mp.conns.get(+id); if(c&&c.open) c.send(JSON.stringify({type:'HURT',targetId:+id,dmg}));
      }
    }
  }
}
function bossDamageLine(x,z,ang,len,width,dmg){
  const sx=Math.sin(ang), sz=Math.cos(ang);
  const test=(p)=>{
    const px=p.x-x, pz=p.z-z;
    const along=px*sx+pz*sz;
    const side=Math.abs(px*sz-pz*sx);
    return along>=-0.2&&along<=len+0.2&&side<=width*0.5;
  };
  if(!player.dead&&!player.downed&&test(player.pos)) hurtPlayer(dmg);
  if(mp.isHost){
    for(const [id,rp] of Object.entries(mp.remotePlayers)){
      if(!rp.dead&&!rp.downed&&test(rp.pos)){
        const c=mp.conns.get(+id); if(c&&c.open) c.send(JSON.stringify({type:'HURT',targetId:+id,dmg}));
      }
    }
  }
}
function castBossLineHazard(x,z,ang,len,width,dmg,col,delay=0.58){
  spawnWarningLine(x,z,ang,len,width,col,delay,()=>{
    bossDamageLine(x,z,ang,len,width,dmg);
    const ex=x+Math.sin(ang)*len, ez=z+Math.cos(ang)*len;
    spawnShockwave(ex,ez,1.25,col,0.18,0.56);
    burst({x:ex,z:ez},col,isMobile?5:10);
  });
}
function castBossMeteorRing(cx,zx,rad,n,r,dmg,col,delay=0.82){
  for(let i=0;i<n;i++){
    const a=(i/n)*Math.PI*2+Math.random()*0.22;
    castMeteor(cx+Math.sin(a)*rad,zx+Math.cos(a)*rad,r,dmg,col,delay+i*0.045);
  }
}
function heraldCommandAura(boss,col){
  spawnSkillRingAura(boss.pos.x,boss.pos.z,5.4,col,0.55,0.38);
  spawnShockwave(boss.pos.x,boss.pos.z,5.4,col,0.24,0.62);
  for(const e of enemies){
    if(e.dead||e.type==='boss') continue;
    if(Math.hypot(e.pos.x-boss.pos.x,e.pos.z-boss.pos.z)>5.8) continue;
    if(!e.heraldCommanded){
      e.heraldCommanded=true;
      e.maxHp=Math.round(e.maxHp*1.18);
      e.hp=Math.min(e.maxHp,Math.round(e.hp*1.18+18));
      e.dmgMult*=1.12;
      e.spd*=1.08;
    }
    e.hitFlashT=0.16;
    if(e.mesh?.userData?.threatHalo){
      e.mesh.userData.threatHalo.visible=true;
      e.mesh.userData.threatHalo.material.color.setHex(col);
    }
  }
}
function castMeteor(x,z,r,dmg,col,delay=0.9){
  spawnWarningCircle(x,z,r,col,delay,()=>{
    bossDamageCircle(x,z,r,dmg);
    burst({x,z},col,isMobile?14:26);
    spawnShockwave(x,z,r,col,0.32,0.95);
    shakeAmt=Math.max(shakeAmt,0.24);
    sExplosion();
  });
}
function castDash(e,tgt,len,width,dmg,col,delay=0.65){
  const dx=tgt.x-e.pos.x, dz=tgt.z-e.pos.z, dist=Math.hypot(dx,dz)||1;
  const ang=Math.atan2(dx,dz);
  const dashLen=Math.min(len,Math.max(3,dist+1.2));
  const startX=e.pos.x, startZ=e.pos.z;
  spawnWarningLine(startX,startZ,ang,dashLen,width,col,delay,()=>{
    if(e.dead) return;
    bossDamageLine(startX,startZ,ang,dashLen,width,dmg);
    e.pos.x=startX+Math.sin(ang)*Math.min(dashLen,dist);
    e.pos.z=startZ+Math.cos(ang)*Math.min(dashLen,dist);
    clamp(e.pos,e.cfg.r); resolveObst(e.pos,e.cfg.r);
    breakTerrain(e.pos,2.8,2,col);
    burst(e.pos,col,isMobile?10:18);
    spawnShockwave(e.pos.x,e.pos.z,3.6,col,0.24,0.86);
    if(e.bossProfile?.special==='apex'){
      castBossLineHazard(startX,startZ,ang,dashLen,Math.max(width*0.72,0.95),Math.round(dmg*0.55),col,0.46);
    }
    shakeAmt=Math.max(shakeAmt,0.34);
    sSlam();
  });
}
function castBulletPattern(e,n,dmg,col,spin=0){
  n=Math.min(isMobile?18:28,Math.ceil(n*bossProjectileMult()));
  for(let bi=0;bi<n;bi++){
    const ang=(bi/n)*Math.PI*2+spin;
    fireBullet(e.pos,_scratchDir.set(Math.sin(ang),0,Math.cos(ang)),false,dmg);
  }
  spawnShockwave(e.pos.x,e.pos.z,3.0,col,0.22,0.75);
  sEnemyShotThrot();
}

function pointInMapZone(p,h){
  if(h.shape==='circle') return Math.hypot(p.x-h.x,p.z-h.z)<=h.r;
  return Math.abs(p.x-h.x)<=h.w*0.5 && Math.abs(p.z-h.z)<=h.d*0.5;
}
function mapMoveMultAt(pos){
  let mult=1;
  for(const h of mapHazards){
    if((h.type||'damage')==='slow'&&pointInMapZone(pos,h)) mult=Math.min(mult,h.mult||0.65);
  }
  return mult;
}
function grassZoneAt(pos){
  for(const h of mapHazards){
    if(h.type==='grass'&&pointInMapZone(pos,h)) return h;
  }
  return null;
}
function updateEnemyGrassVisibility(e,dt){
  const zone=grassZoneAt(e.pos);
  const playerZone=grassZoneAt(player.pos);
  if(e.grassZone&&e.grassZone!==zone) e.grassExitRevealT=Math.max(e.grassExitRevealT||0,0.75);
  e.grassZone=zone;
  e.grassRevealT=Math.max(0,(e.grassRevealT||0)-dt);
  e.grassExitRevealT=Math.max(0,(e.grassExitRevealT||0)-dt);
  let target=1;
  if(zone){
    target=(playerZone===zone||e.grassRevealT>0||e.grassExitRevealT>0) ? 1 : 0;
  }
  const cur=e.grassAlpha ?? 1;
  const rate=target>cur?14:5.5;
  e.grassAlpha=cur+(target-cur)*(1-Math.exp(-rate*dt));
  if(e.grassAlpha<0.015) e.grassAlpha=0;
  if(e.grassAlpha>0.985) e.grassAlpha=1;
  setEnemyOpacity(e,e.grassAlpha);
}
function setEnemyOpacity(e,alpha){
  const p=e.mesh.userData;
  [e.mesh.material,p.accentMat,p.eyeMat].forEach(mat=>{
    if(!mat) return;
    mat.transparent=alpha<0.99;
    mat.opacity=alpha;
    mat.depthWrite=alpha>=0.99;
  });
  e.mesh.visible=alpha>0.01 || e.spawnAnim>0 || (e.grassRevealT||0)>0 || (e.grassExitRevealT||0)>0;
}
function updateMapHazards(dt, now){
  const heatRunning=gState==='playing'&&!waveClear&&!waveTransition;
  if(heatRunning)mapHazardTime+=dt;
  for(const h of mapHazards){
    h.t=(h.t||0)+dt;
    const type=h.type||'damage';
    if(h.mat){
      const base=type==='grass'?0.93:type==='slow'?0.93:0.12;
      const pulse=type==='grass'?0:type==='slow'?0:0.16;
      h.mat.opacity=base+Math.max(0,Math.sin(h.t*3.5))*pulse;
    }
    if(h.kind==='water'&&h.details){
      h.details.forEach((line,i)=>{
        if(!line.userData.waterLine) return;
        line.position.x+=Math.sin(h.t*1.6+i)*dt*0.050;
        line.position.z+=Math.cos(h.t*1.3+i)*dt*0.035;
        if(line.material) line.material.opacity=0.16+Math.max(0,Math.sin(h.t*2.4+i))*0.28;
      });
    }
    // Grass sway used to update every blade's rotation per frame (hundreds
    // of mesh writes / map). Static tufts read fine at 54° camera tilt and
    // the perf win on low-end laptops is significant.
    if(type==='heat'){
      const phase=heatRunning?foundryPhase(mapHazardTime,h.lane):'off';
      h.phase=phase;
      for(const detail of h.details||[])detail.visible=phase!=='off';
      if(h.mat){
        h.mat.color.setHex(phase==='active'?0xff4422:phase==='warning'?0xffcc33:0x774422);
        h.mat.opacity=phase==='active'?0.7:phase==='warning'?0.3+0.25*(0.5+0.5*Math.sin(mapHazardTime*12)):0.08;
      }
      if(phase!=='active'){h.hitCd={};continue;}
    }else if(type!=='damage') continue;
    if(!h.hitCd) h.hitCd={};
    h.hitCd.local=Math.max(0,(h.hitCd.local||0)-dt);
    // The host also sends hazard hits to guests; guests only animate the zone.
    if((mp.soloMode||mp.isHost)&&!player.dead&&!player.downed&&pointInMapZone(player.pos,h)&&h.hitCd.local<=0){
      h.hitCd.local=0.55;
      hurtPlayer(h.dmg||6);
      spawnShockwave(player.pos.x,player.pos.z,1.0,h.col||0xff3355,0.16,0.45);
    }
    if(mp.isHost){
      for(const [id,rp] of Object.entries(mp.remotePlayers)){
        const key='r'+id;
        h.hitCd[key]=Math.max(0,(h.hitCd[key]||0)-dt);
        if(!rp.dead&&!rp.downed&&pointInMapZone(rp.pos,h)&&h.hitCd[key]<=0){
          h.hitCd[key]=0.55;
          const c=mp.conns.get(+id);
          if(c&&c.open) c.send(JSON.stringify({type:'HURT',targetId:+id,dmg:h.dmg||6}));
        }
      }
    }
  }
}

let linkerBeams=null;
function updateLinkerTargets(){
  for(const e of enemies)e.linkSource=null;
  if(mp.soloMode||mp.isHost){
    for(const {source,target} of chooseLinks(enemies,lineBlockedByObstacle))target.linkSource=source;
  }else{
    const byId=new Map(enemies.filter(e=>!e.dead).map(e=>[e.poolIdx,e]));
    for(const e of enemies)e.linkSource=byId.get(e.linkSourceId)||null;
  }
}
function updateLinkerVisuals(){
  if(!linkerBeams){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(16*18),3));
    linkerBeams=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xcc88ff,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
    linkerBeams.frustumCulled=false;scene.add(linkerBeams);
  }
  const pos=linkerBeams.geometry.attributes.position;
  let count=0;
  for(const target of enemies){
    const source=target.linkSource;
    if(count>=16||!linkIsValid(source,target,lineBlockedByObstacle))continue;
    const dx=target.pos.x-source.pos.x,dz=target.pos.z-source.pos.z;
    const length=Math.hypot(dx,dz)||1,ox=-dz/length*.07,oz=dx/length*.07;
    for(const [i,end,side] of [[0,source,-1],[1,target,-1],[2,target,1],[3,source,-1],[4,target,1],[5,source,1]])
      pos.setXYZ(count*6+i,end.pos.x+ox*side,end===source?.95:.7,end.pos.z+oz*side);
    count++;
  }
  pos.needsUpdate=true;linkerBeams.geometry.setDrawRange(0,count*6);
  linkerBeams.visible=count>0&&gState==='playing';
}
function update(dt){
  if(player.gun!=='grenade')grenadePrimer.reset();
  if(player.gun!=='burst')burstOpening.reset();
  ak47Rhythm.tick(dt,player.gun==='ak47',player.reloadT>0);
  steelStorm.tick(dt,player.gun==='ak47'&&!!playerSkills.ak47Ascension);
  player.gravityExhaustion=Math.max(0,(player.gravityExhaustion||0)-dt);
  updateDowned(dt);
  updateReviveAssist(dt);
  const now = Date.now();
  tickStatusMaps(dt);
  updateWarningZones(dt);
  updateMapHazards(dt, now);
  updateHookedEnemies(dt);
  // Drip-feed queued spawns up to the on-map cap. Queue is only populated on
  // host / solo (spawnWave is host-gated in nextWave), so this is a no-op
  // on remote clients.
  tickWaveSpawnQueue(dt);
  updateLinkerTargets();

  // ── Player ──
  if(!player.dead){
    updateEpicEffects(dt);
    updateLegendaryEffects(dt);
    // Regen Heart relic: leveled max-HP-per-second regen. Uses a remainder
    // so the small per-frame fraction accumulates instead of rounding to 0.
    // Vampire Pact L3 hard-blocks this too — see vampirePactHardBlock.
    if(hasRelic('regenHeart')&&normalHealingMultiplier()>0){
      const _maxHp=playerStats.maxHp||MAX_HP;
      // Apply modifiers before rounding so a half-strength 1 HP tick cannot round back to full strength.
      const _add=(_maxHp*RELIC_LEVELS.regenHeart.regenPct[relicLevel('regenHeart')])*dt*normalHealingMultiplier();
      player._regenAcc=(player._regenAcc||0)+_add;
      if(player._regenAcc>=1){
        const whole=Math.floor(player._regenAcc);
        player._regenAcc-=whole;
        if(player.hp<_maxHp){
          const before=player.hp;
          player.hp=Math.min(_maxHp,player.hp+whole);
          if(player.hp>before){recordHealing(player.hp-before);refreshHP();}
        }
      }
    }
    player.dashCd=Math.max(0,player.dashCd-dt);
    const _dashMax=dashCooldown();
    const _dashEl=document.getElementById('dashCdFill');
    if(_dashEl) _dashEl.style.width=(1-player.dashCd/_dashMax)*100+'%';
    player.meleeCd=Math.max(0,player.meleeCd-dt);
    const _meleeCfg=meleeStatsFor(player.meleeWeapon);
    const _meleeEl=document.getElementById('meleeCdFill');
    if(_meleeEl) _meleeEl.style.width=(1-player.meleeCd/_meleeCfg.cd)*100+'%';
    player.speedBoostT=Math.max(0,player.speedBoostT-dt);
    const wantFire=!_runShopUIOpen&&(mouse.down||(realIsMobile&&joy.R.act&&Math.hypot(joy.R.dx,joy.R.dy)>0.25));
    const activeGun=getActiveGun();
    const minigunShooting=activeGun.id==='minigun'&&wantFire&&player.reloadT<=0&&player.ammo>0;
    const railSlow=(player.gravityExhaustion>0?.65:1)*(activeGun.id==='railgun' ? 1-0.4*Math.min(1,(player.railCharge||0)/(activeGun.chargeMax||2)) : 1);
    const speedBoost=playerSkills.adrenaline ? ADREN_SPEED[playerSkills.adrenaline||0] : 1;
    const spd = PLAYER_SPD * PERM_SPD_MULT[persistData.upgrades.speed||0] * speedBoost * mapMoveMultAt(player.pos) * (minigunShooting?0.7:1) * railSlow * hasteAuraMult() * (typeof buffSpeedMult==='function'?buffSpeedMult():1);
    let mvx=0,mvz=0;
    if(realIsMobile){ mvx=joy.L.dx; mvz=joy.L.dy; }
    else{
      if(keys[NB_KEYBINDS.left]||keys['ArrowLeft'])  mvx-=1;
      if(keys[NB_KEYBINDS.right]||keys['ArrowRight']) mvx+=1;
      if(keys[NB_KEYBINDS.up]||keys['ArrowUp'])    mvz-=1;
      if(keys[NB_KEYBINDS.down]||keys['ArrowDown'])  mvz+=1;
    }
    const mlen=Math.hypot(mvx,mvz);
    if(mlen>0.01){mvx/=mlen;mvz/=mlen;}
    const prevPX=player.pos.x, prevPZ=player.pos.z;
    if(_dashTapped){_dashTapped=false; startDash();}
    const dashMovedThisFrame=player.dashT>0;
    if(player.hookSwingT>0){
      const _hookBeforeX=player.pos.x, _hookBeforeZ=player.pos.z;
      // Hook swing: auto-pull toward the anchor + WASD input + leash clamp.
      // Middle-ground tune (between the original yank-too-strong and the
      // last too-soft pass). Pull peaks higher and ramps faster so the tail
      // of the swing actually flings the player. Steering stays generous
      // enough during the early ramp that the orbit is still directable —
      // pull only starts winning ~0.3 s in, which is the right moment for
      // the "I've got my line, now fly" feel.
      const isWallHook=player.hookSwingMode==='wall';
      const HOOK_DUR=player.hookSwingDur||0.75;
      const swingElapsed = isWallHook ? 0 : HOOK_DUR - player.hookSwingT;
      if(isWallHook) player.hookWallBuffer=Math.max(0,(player.hookWallBuffer||0)-dt);
      if(!isWallHook) player.hookSwingT=Math.max(0,player.hookSwingT-dt);
      const rx=player.hookSwingX-player.pos.x;
      const rz=player.hookSwingZ-player.pos.z;
      const rd=Math.hypot(rx,rz)||1;
      // Pull speed ramps 4 → 30 u/s over ~0.52 s.
      if(isWallHook){
        const rawTurn=(keys[NB_KEYBINDS.right]?1:0)-(keys[NB_KEYBINDS.left]?1:0);
        const turn=rawTurn*(player.hookWallInputSign||1);
        if(Math.abs(turn)<0.01){
          updateActiveHookRope();
        } else {
          player.hookOrbitDir=Math.sign(turn);
          const radius=Math.max(1.1,player.hookSwingR||rd);
          const curAng=Math.atan2(player.pos.z-player.hookSwingZ,player.pos.x-player.hookSwingX);
          const orbitSpd=Math.max(1.8,Math.min(5.2,(spd*2.85)/radius));
          const nextAng=curAng+player.hookOrbitDir*orbitSpd*dt;
          const nx=player.hookSwingX+Math.cos(nextAng)*radius;
          const nz=player.hookSwingZ+Math.sin(nextAng)*radius;
          const md=Math.hypot(nx-player.pos.x,nz-player.pos.z);
          if(md>0.001&&player.hookWallBuffer<=0&&!canMoveAlong(player.pos,(nx-player.pos.x)/md,(nz-player.pos.z)/md,0.50,md)){
            finishHookSwingWithInertia();
          } else {
            player.pos.x=nx; player.pos.z=nz;
          }
        }
      } else {
        const pullSpd=Math.min(32,10+swingElapsed*62);
        player.pos.x += (rx/rd)*pullSpd*dt + mvx*spd*0.82*dt;
        player.pos.z += (rz/rd)*pullSpd*dt + mvz*spd*0.82*dt;
      }
      // WASD steering at 2.0× normal speed (~15 u/s). Beats the pull during
      // Leash clamp — never further than hookSwingR from the anchor, which
      // is what makes WASD-perpendicular input read as orbiting the target.
      const ax=player.hookSwingX-player.pos.x;
      const az=player.hookSwingZ-player.pos.z;
      const ad=Math.hypot(ax,az);
      if(player.hookSwingMode==='wall'&&player.hookSwingT>0){
        const radius=Math.max(1.1,player.hookSwingR||ad);
        const k=radius/(ad||1);
        player.pos.x=player.hookSwingX-ax*k;
        player.pos.z=player.hookSwingZ-az*k;
      } else if(ad>player.hookSwingR){
        const k=player.hookSwingR/ad;
        player.pos.x=player.hookSwingX-ax*k;
        player.pos.z=player.hookSwingZ-az*k;
      }
      // End swing once we're effectively on the anchor (player can keep moving).
      if(player.hookSwingMode!=='wall'&&ad<0.75) player.hookSwingT=0;
      player.hookVelX=(player.pos.x-_hookBeforeX)/Math.max(0.001,dt);
      player.hookVelZ=(player.pos.z-_hookBeforeZ)/Math.max(0.001,dt);
      updateActiveHookRope();
      if(player.hookSwingT<=0) finishHookSwingWithInertia();
    } else if(player.hookInertiaT>0){
      player.hookInertiaT=Math.max(0,player.hookInertiaT-dt);
      const fade=player.hookInertiaT/0.34;
      player.pos.x+=(player.hookInertiaVX||0)*fade*dt + mvx*spd*0.35*dt;
      player.pos.z+=(player.hookInertiaVZ||0)*fade*dt + mvz*spd*0.35*dt;
      player.hookInertiaVX*=Math.pow(0.72,dt*60);
      player.hookInertiaVZ*=Math.pow(0.72,dt*60);
    } else if(player.dashT>0){
      const lvl=playerSkills.dashMastery||0;
      player.dashT=Math.max(0,player.dashT-dt);
      const dashSpeed=(player.meleeDashSpeed || (DASH_SPEED[lvl]||DASH_SPEED[0]))*(player.meleeDashSpeed?1:dashDistanceMult());
      player.pos.x+=player.dashVX*dashSpeed*dt;
      player.pos.z+=player.dashVZ*dashSpeed*dt;
      player.dashTrailT-=dt;
      if(player.dashTrailT<=0){
        player.dashTrailT=playerSkills.mineLayer>=3?0.045:0.065;
        spawnDashGhost(player.pos.x,player.pos.z,player.mesh?player.mesh.rotation.y:0);
        const aiLvl=playerSkills.afterimage||0;
        if(aiLvl&&!player.meleeDashSpecial){
          spawnAfterimageCharge(player.pos.x,player.pos.z,aiLvl,{visualOnly:mp.connected&&!mp.soloMode&&!mp.isHost});
        }
        if(playerSkills.mineLayer&&!player.meleeDashSpecial&&mineDropCd<=0){
          spawnMine(player.pos.x,player.pos.z);
          mineDropCd=playerSkills.mineLayer>=3?0.11:0.18;
        }
      }
      const phLvl=playerSkills.phaseStep||0;
      if(phLvl&&!player.meleeDashSpecial) phaseStepPulse(1.02,phLvl);
      if(player.dashT<=0){
        const meleeDash=player.meleeDashSpecial;
        player.meleeDashSpeed=0;
        player.meleeDashSpecial=false;
        if(meleeDash) player.dashKinetic=0;
        else finishDash();
      }
    } else {
      player.pos.x+=mvx*spd*dt; player.pos.z+=mvz*spd*dt;
    }
    mineDropCd=Math.max(0,mineDropCd-dt);
    clamp(player.pos,0.62); resolveObst(player.pos,0.62);
    updateMoveTrail(player,mp.myId,player.pos.x,player.pos.z,Math.hypot(player.pos.x-prevPX,player.pos.z-prevPZ),dt);
    const kcLvl=playerSkills.kineticCharge||0;
    if(kcLvl&&player.dashT<=0&&!dashMovedThisFrame){
      const moved=Math.hypot(player.pos.x-prevPX,player.pos.z-prevPZ);
      if(moved>0.001){
        const before=player.kineticCharge||0;
        player.kineticCharge=Math.min(1,before+moved/(KINETIC_DIST[kcLvl]||18));
        if(before<1&&player.kineticCharge>=1){
          burst(player.pos,0x33ffcc,isMobile?4:8);
          spawnShockwave(player.pos.x,player.pos.z,0.9,0x33ffcc,0.18,0.5);
          sChargeThrot();
        }
      }
    }

    if(player.mesh){
      player.mesh.position.x=player.pos.x;
      player.mesh.position.z=player.pos.z;
      player.mesh.position.y=0.55+Math.sin(Date.now()*0.009)*0.055;
      if(player.mesh.userData.selfMarker){
        const pulse=0.5+0.5*Math.sin(Date.now()*0.01);
        const markerScale=1+pulse*0.08;
        player.mesh.userData.selfMarker.scale.setScalar(markerScale);
        player.mesh.userData.selfMarker.material.opacity=0.50+pulse*0.20;
        player.mesh.userData.selfMarkerGlow.scale.setScalar(1+pulse*0.12);
        player.mesh.userData.selfMarkerGlow.material.opacity=0.12+pulse*0.14;
      }
      if(!realIsMobile&&mouse.world){
        const dx=mouse.world.x-player.pos.x,dz=mouse.world.z-player.pos.z;
        if(Math.hypot(dx,dz)>0.2) player.mesh.rotation.y=Math.atan2(dx,dz);
      } else if(realIsMobile&&joy.R.act&&Math.hypot(joy.R.dx,joy.R.dy)>0.2){
        player.mesh.rotation.y=Math.atan2(joy.R.dx,joy.R.dy);
      }
      player.mesh.visible=player.invincible<=0||Math.floor(Date.now()/70)%2===0;
    }
    playerGlow.position.set(player.pos.x,0.8,player.pos.z);
    if(player.healFlashT>0){
      player.healFlashT=Math.max(0,player.healFlashT-dt);
      playerGlow.intensity=2.5+player.healFlashT/0.35*3.5;
      if(player.healFlashT<=0){ playerGlow.color.setHex(PLAYER_COLORS[mp.myId%MAX_PLAYERS].emi); playerGlow.intensity=2.5; }
    }
    // Repair drone healing is handled in updateSummons when the drone is alive

    // Guard: if fireCd ever becomes NaN/Infinity (e.g. an out-of-bounds skill
    // level lookup multiplied through), the `fireCd<=0` check would be false
    // forever and the player could never shoot again. Clamp to 0 on any
    // non-finite value before decrementing.
    if(!Number.isFinite(player.fireCd)) player.fireCd=0;
    player.fireCd-=dt;
    if(player.fireCd < -0.16) player.fireCd = -0.16;
    // Tick the reload timer down — when it hits 0 the mag refills. Done here
    // so the reload state advances even if the player isn't holding fire.
    if(player.reloadT>0){
      player.reloadT=Math.max(0,player.reloadT-dt);
      if(player.reloadT<=0){ player.ammo=currentMagSize(); if(player.gun==='burst')burstOpening.reload(); if(player.gun==='grenade')grenadePrimer.reload(); if(player.gun==='pistol'&&playerSkills.pistolAscension)pistolJudgment.reload(player.ammo); sReloadEnd(); }
    }
    const rfMult=([1,0.85,0.72,0.60,0.50,0.40][playerSkills.rapidFire||0])||1;
    const fireRateMult=PERM_CD_MULT[persistData.upgrades.fireRate||0]||1;
    player.railChargeSfxT=Math.max(0,(player.railChargeSfxT||0)-dt);
    if(activeGun.id==='minigun'){
      // Unbounded ramp: spin keeps climbing past 1 the longer you hold fire.
      // Cool-down decay still pulls it back fast (-1.8/s) so the moment you
      // release, the next burst starts from a slower state. Safe ceiling 4
      // prevents anything pathological if you somehow hold fire for tens of
      // seconds straight.
      player.minigunSpin=Math.max(0,Math.min(4,player.minigunSpin+(minigunShooting?dt*(activeGun.ramp||0.42):-dt*1.8)));
    } else player.minigunSpin=0;
    const railCanCharge=activeGun.id==='railgun'&&player.fireCd<=0&&player.reloadT<=0&&player.ammo>0;
    if(activeGun.id==='railgun'){
      if(wantFire&&railCanCharge){
        const railMax=activeGun.chargeMax||2;
        player.railCharge=Math.min(railMax,(player.railCharge||0)+dt);
        player.railWasCharging=true;
        if(sfxBuffers['rail_charge']){
          startRailChargeSfx(); // 7s charge sample: plays once, held until release
        } else if(player.railChargeSfxT<=0){
          sRailCharge(); // synth fallback: short repeating charge tick
          player.railChargeSfxT=0.42;
        }
        if(player.railCharge>=railMax&&!player.railMaxFx){
          player.railMaxFx=true;
          const d=meleeAimDir();
          const mx=player.pos.x+d.x*0.86, mz=player.pos.z+d.z*0.86;
          spawnSkillRingAura(mx,mz,1.05,activeGun.color,0.34,0.76);
          spawnShockwave(mx,mz,1.25,activeGun.color,0.20,0.72);
          burst({x:mx,z:mz},activeGun.color,isMobile?4:8);
          flashLight({x:mx,z:mz},activeGun.color,5.5,6.5,0.16);
          sRailMax();
        }
        if(!isMobile&&Math.random()<0.22){
          burst({x:player.pos.x+Math.sin(player.mesh?.rotation.y||0)*0.9,z:player.pos.z+Math.cos(player.mesh?.rotation.y||0)*0.9},activeGun.color,1);
        }
      } else if(player.railWasCharging){
        stopRailChargeSfx(); // release: cut the charge sample instantly
        const charge=Math.max(0,player.railCharge||0);
        player.railWasCharging=false;
        player.railMaxFx=false;
        player.railCharge=0;
        if(charge>0.06&&railCanCharge){
          const d=meleeAimDir();
          const p=Math.max(0,Math.min(1,charge/(activeGun.chargeMax||2)));
          // Charge multiplier: 1× uncharged → 5× at full charge (was 1×→3×).
          // Buff makes a 2s full charge actually feel devastating; 5× × 2.5
          // dmgMult × 25 base = 312 per shot at full charge.
          const pdmg=Math.max(1,Math.round(playerStats.attackDmg*BULLET_PWR_MULT[playerSkills.bulletPower||0]*crystalPowerMult()*activeGun.dmgMult*(1+p*4)));
          if(!hasRelic('infiniteMag')){
            player.ammo--;
            if(player.ammo<=0){ player.reloadDur=weaponReloadTime(); player.reloadT=player.reloadDur; sReloadStart(); }
          }
          player.fireCd=activeGun.fireCd*rfMult*fireRateMult*(hasRelic('infiniteMag')?(RELIC_LEVELS.infiniteMag.fireMul[relicLevel('infiniteMag')]||1):1)*buffFireRateMult();
          applySpecialGunFire(activeGun,player.pos.x+d.x*0.72,player.pos.z+d.z*0.72,d.x,d.z,pdmg,mp.myId,false,true,null,{charge:p});
          spawnShockwave(player.pos.x+d.x*0.85,player.pos.z+d.z*0.85,0.95+p*0.65,activeGun.color,0.18,0.72);
          tickShotCounterEpics(d.x,d.z,pdmg,playerSkills.pierce||0);
          noteWaveEventGunFire();
          sRailBurst(); // railgun fire uses the dedicated rail_fire sound (was reusing the sniper sound)
        }
      }
    } else {
      if(player.railWasCharging) stopRailChargeSfx(); // switched away mid-charge
      player.railCharge=0;
      player.railMaxFx=false;
      player.railWasCharging=false;
    }
    // Fire is also gated on having ammo AND not being mid-reload. Bonus
    // shots (spread, railBurst, etc.) belong to the same fire event so they
    // don't cost extra ammo.
    const gravityHandled=updateGravityAscension(dt,wantFire,rfMult*fireRateMult*(hasRelic('infiniteMag')?(RELIC_LEVELS.infiniteMag.fireMul[relicLevel('infiniteMag')]||1):1)*buffFireRateMult());
    let primaryCatchupShots = 0;
    while(!gravityHandled&&activeGun.id!=='railgun'&&wantFire&&player.fireCd<=0&&player.reloadT<=0&&player.ammo>0&&primaryCatchupShots<PRIMARY_FIRE_CATCHUP_MAX){
      primaryCatchupShots++;
      const gun=activeGun;
      const supernovaShot=gun.id==='grenade'&&playerSkills.grenadeAscension&&supernovaCharge.fire();
      const grenadeShot=gun.id==='grenade'?grenadePrimer.fire(skillPickLevel('grenadePrimer')):{damage:1,quick:false};
      const triadShot=gun.id==='burst'&&playerSkills.burstAscension&&celestialTriad.fire();
      const burstOpts=gun.id==='burst'?{burstSalvo:runGeneration+':'+(++burstSequence),triad:!!triadShot}:null;
      const burstDamage=burstOpts?burstOpening.fire(skillPickLevel('burstOpening'))*(triadShot?3:1):1;
      const stormShot=gun.id==='ak47'&&playerSkills.ak47Ascension&&steelStorm.shot();
      const rifleDamage=gun.id==='ak47'?ak47Rhythm.shot(skillPickLevel('ak47Momentum'))*(stormShot?2:1):1;
      const shotgunOpts=gun.id==='shotgun'?{shotgunSalvo:runGeneration+':'+(++shotgunSequence)}:null;
      const pattern=gun.id==='shotgun'?shotgunPattern(skillPickLevel('shotgunRain')):{pellets:gun.bulletsPerShot,spread:gun.id==='ak47'?ak47Spread(skillPickLevel('ak47Control')):gun.id==='burst'?burstSpread(skillPickLevel('burstControl')):gun.spread};
      const pistolOpts=gun.id==='pistol'?{pistolShot:true,pistolPrimary:true,pistolJudgment:!!playerSkills.pistolAscension&&pistolJudgment.fire(),pistolLast:player.ammo===1&&!hasRelic('infiniteMag')}:null;
      if(!hasRelic('infiniteMag')){
        player.ammo--;
        if(player.ammo<=0){ player.reloadDur=weaponReloadTime(); player.reloadT=player.reloadDur; player.minigunSpin=0; sReloadStart(); }
      }
      // Gun-specific base cooldown; rapidFire skill + perm fire-rate
      // multiplier stack on top, same as before.
      // Minigun keeps ramping past spin=1: first unit interpolates fireCd→
      // minFireCd, every extra unit cuts the resulting interval by another
      // 30%, with a 0.022s floor (~45 shots/sec) so the loop stays sane.
      let gunBaseCd;
      if(gun.id==='minigun'){
        const t=player.minigunSpin||0;
        const linear=gun.fireCd+(gun.minFireCd-gun.fireCd)*Math.min(1,t);
        const over=Math.max(0,t-1);
        gunBaseCd=Math.max(0.022,linear*Math.pow(0.70,over));
      } else {
        gunBaseCd=gun.fireCd;
      }
      const nextFireCd=gunBaseCd*rfMult*fireRateMult*(hasRelic('infiniteMag')?(RELIC_LEVELS.infiniteMag.fireMul[relicLevel('infiniteMag')]||1):1)*buffFireRateMult()*(player.gravityExhaustion>0?1.5:1);
      player.fireCd+=nextFireCd;
      if(!Number.isFinite(player.fireCd)) player.fireCd=gun.fireCd;
      let fx,fz;
      if(realIsMobile&&joy.R.act){fx=joy.R.dx;fz=joy.R.dy;}
      else{
        const dx=mouse.world.x-player.pos.x,dz=mouse.world.z-player.pos.z;
        const dl=Math.hypot(dx,dz)||1; fx=dx/dl; fz=dz/dl;
      }
      if(Math.hypot(fx,fz)>0.1){
        // Crystal Force scales every bullet; gun.dmgMult is per-pellet so
        // shotguns deal small per-pellet damage but stack via 12 pellets.
        const pdmgBase=playerStats.attackDmg*BULLET_PWR_MULT[playerSkills.bulletPower||0]*crystalPowerMult()*gun.dmgMult*rifleDamage*burstDamage*grenadeShot.damage*(supernovaShot?3:1);
        const pdmg=Math.max(1,Math.round(pdmgBase));
        if(shotgunOpts&&playerSkills.shotgunAscension&&ruptureCharge.fire()){
          shotgunOpts.rupture=true;
          fireRupture(player.pos.x,player.pos.z,fx,fz,pdmg*12,mp.myId,localAttackModifiers(),!(mp.soloMode||mp.isHost));
          if(mp.connected){const msg={type:'RUPTURE',id:mp.myId,x:player.pos.x,z:player.pos.z,dx:fx,dz:fz,dmg:pdmg*12,perm:localAttackModifiers()};if(mp.isHost)broadcastMP(msg);else sendToHost(msg);}
        }
        const pierceLvl=(playerSkills.pierce||0)+(stormShot?2:0)+(triadShot?3:0);
        if(triadShot)spawnShockwave(player.pos.x+fx*.85,player.pos.z+fz*.85,1.5,0xffedaa,.3,.8);
        if(stormShot)spawnShockwave(player.pos.x+fx*.85,player.pos.z+fz*.85,1.15,0xe6c4ff,.2,.7);
        const isSpecialGun=gun.kind==='flame'||gun.kind==='laser'||gun.kind==='cryo';
        if(isSpecialGun){
          applySpecialGunFire(gun,player.pos.x+fx*0.65,player.pos.z+fz*0.65,fx,fz,pdmg,mp.myId,false,true,null);
          if(!isMobile) spawnShockwave(player.pos.x+fx*0.78,player.pos.z+fz*0.78,0.7,gun.color,0.12,0.45);
        } else {
        // Helper: turn the aim vector into a slightly randomised vector
        // within the gun's spread cone. Shotguns use two staggered rows so
        // the blast reads as a real pellet fan instead of one flat line.
        const _spread=(pelletI=0)=>{
          if(pattern.spread<=0) return [fx,fz];
          let a;
          if(gun.id==='shotgun'&&pattern.pellets>1){
            const rowSize=Math.ceil(pattern.pellets/2);
            const row=Math.floor(pelletI/rowSize);
            const col=pelletI%rowSize;
            const slotT=((col+0.5+(row?0.38:0))/rowSize)-0.5;
            a=slotT*2*pattern.spread+(Math.random()-0.5)*pattern.spread*0.24;
          } else {
            a=(Math.random()-0.5)*2*pattern.spread;
          }
          const ca=Math.cos(a), sa=Math.sin(a);
          return [fx*ca-fz*sa, fx*sa+fz*ca];
        };
        for(let pelletI=0;pelletI<pattern.pellets;pelletI++){
          const [sx,sz]=_spread(pelletI);
          const shotgunRow=gun.id==='shotgun' ? Math.floor(pelletI/Math.ceil(pattern.pellets/2)) : 0;
          const rowDelay=shotgunRow ? 0.055 : 0;
          const muzzleDist=gun.id==='shotgun' ? (shotgunRow ? 0.78 : 0.96) : 0.95;
          const sbx=player.pos.x+sx*muzzleDist, sbz=player.pos.z+sz*muzzleDist;
          const bulletOpts=gun.kind==='gravity' ? {gravityTravel:gravityAimTravel(gun,sbx,sbz)} : gun.kind==='grenade' ? {grenadeTravel:grenadeAimTravel(gun,sbx,sbz),grenadeQuick:grenadeShot.quick,supernova:!!supernovaShot,grenadePrimary:true} : pistolOpts || (burstOpts?{...burstOpts,burstIndex:pelletI}:null) || (shotgunOpts ? {...shotgunOpts,delay:rowDelay} : null);
          const slot=fireBullet({x:sbx,z:sbz},_scratchDir.set(sx,0,sz),true,pdmg,pierceLvl,false,null,mp.myId,null,bulletOpts);
          // Shotgun pellets carry per-bullet falloff. Origin is the muzzle
          // position; at hit time the bullet code scales damage by how far
          // the pellet has travelled from there.
          if(slot && gun.falloffStart>0){
            slot.falloffStart=gun.falloffStart;
            slot.falloffEnd=gun.falloffEnd;
            slot.falloffMin=gun.falloffMin;
            slot.fallOX=sbx; slot.fallOZ=sbz;
          }
          sendFireMP(
            Math.round(sbx*100)/100,
            Math.round(sbz*100)/100,
            Math.round(sx*1000)/1000,
            Math.round(sz*1000)/1000,
            pdmg,
            pierceLvl,
            bulletOpts
          );
        }
        // Muzzle puff scaled by pellet count so shotguns visibly punch harder.
        if(!isMobile) spawnShockwave(player.pos.x+fx*0.85,player.pos.z+fz*0.85,
          pattern.pellets>1?0.95:0.65, gun.color, 0.16, pattern.pellets>1?0.78:0.6);
        fireSpreadShots(gun,fx,fz,pdmg,pierceLvl,pistolOpts||shotgunOpts||(gun.id==='grenade'?{grenadeQuick:grenadeShot.quick,supernova:!!supernovaShot}:{}));
        }
        tickShotCounterEpics(fx,fz,pdmg,pierceLvl);
        noteWaveEventGunFire();
        // Per-gun shoot SFX so the audio telegraph matches the visual
        // weapon. Falls back to the legacy sShoot if something unfamiliar
        // ends up in player.gun.
        muzzleLight.intensity=9;
        muzzleLight.color.setHex(gun.color||0x00ffff);
        playGunShootSfx(gun.id);
      }
    }
    if(primaryCatchupShots>=PRIMARY_FIRE_CATCHUP_MAX&&player.fireCd<0) player.fireCd=0;
    if(activeGun.id!=='railgun'&&(!wantFire||player.reloadT>0||player.ammo<=0)) player.fireCd=Math.max(0,player.fireCd);
    muzzleLight.position.set(player.pos.x,0.7,player.pos.z);
    muzzleLight.intensity=Math.max(0,muzzleLight.intensity-dt*55);
    if(muzzleLight.intensity===0) muzzleLight.color.setHex(0x00ffff);
    if(player.invincible>0) player.invincible-=dt;
    // Barrier cooldown
    if(!player.barrierActive&&(playerSkills.barrier||0)>0){
      player.barrierCd-=dt;
      if(player.barrierCd<=0){ player.barrierActive=true; if(barrierMesh) barrierMesh.visible=true; }
    }
    if(barrierMesh&&!player.dead){
      barrierMesh.position.set(player.pos.x,0.6,player.pos.z);
      barrierMesh.rotation.y+=dt*1.4;
      if(barrierMesh.children[0]) barrierMesh.children[0].rotation.z+=dt*2.2;
      if(barrierMesh.children[1]) barrierMesh.children[1].rotation.x+=dt*1.8;
      barrierMesh.material.opacity=0.16+0.06*Math.sin(now*0.008);
    }
    // ── Spell Card (Nova) ──
    const spellLvl=playerSkills.spellCard||0;
    if(spellLvl>0){
      player.spellCd=Math.max(0,player.spellCd-dt);
      _spellTapped=false; // consumed below or discarded
      if(player.spellCd<=0){
        const cdMult=SPELL_CD_MULT[playerSkills.spellHaste||0];
        player.spellCd=SPELLCARD_CD[spellLvl]*cdMult;
        const n=SPELLCARD_N[spellLvl];
        const spellPwr=SPELL_PWR_MULT[playerSkills.spellPower||0];
        const spdmg=Math.round(playerStats.attackDmg*3.5*spellPwr);
        for(let si=0;si<n;si++){
          const ang=(si/n)*Math.PI*2;
          fireSpellBall({x:player.pos.x,z:player.pos.z},_scratchDir.set(Math.sin(ang),0,Math.cos(ang)),spdmg,0xcc33ff,5);
        }
        spawnShockwave(player.pos.x,player.pos.z,3.2+spellLvl*0.35,0xcc33ff,0.32,0.9);
        flashLight(player.pos,0xcc33ff,7,8,0.22);
        burst(player.pos,0xcc33ff,isMobile?10:18); burst(player.pos,0xff00cc,isMobile?6:10); sSpell();
        triggerArchmageLoop('spellCard');
      }
      // Update cooldown HUD
      const _cdMax=SPELLCARD_CD[spellLvl]*SPELL_CD_MULT[playerSkills.spellHaste||0];
      _setCdFill('spellCdFill',(1-player.spellCd/_cdMax)*100);
    }
    // ── Fire Ring (auto-cast) ──
    const fireRingLvl=playerSkills.fireRing||0;
    if(fireRingLvl>0&&!player.dead){
      player.fireRingCd=Math.max(0,player.fireRingCd-dt);
      if(player.fireRingCd<=0){
        const cdMult=SPELL_CD_MULT[playerSkills.spellHaste||0];
        player.fireRingCd=FIRERING_CD_BASE[fireRingLvl]*cdMult;
        const spellPwr=SPELL_PWR_MULT[playerSkills.spellPower||0];
        spawnDamageRing(player.pos.x,player.pos.z,FIRERING_R[fireRingLvl],Math.round(FIRERING_DMG[fireRingLvl]*spellPwr*atkScale()),0xff5500,1.2);
        burst(player.pos,0xff5500,isMobile?6:10); burst(player.pos,0xffaa00,isMobile?4:7);
        triggerArchmageLoop('fireRing');
      }
      _setCdFill('ringCdFill',(1-player.fireRingCd/(FIRERING_CD_BASE[fireRingLvl]*SPELL_CD_MULT[playerSkills.spellHaste||0]))*100);
    }
    // ── Homing Bomb (auto-cast) ──
    const homingBombLvl=playerSkills.homingBomb||0;
    if(homingBombLvl>0&&!player.dead){
      player.homingBombCd=Math.max(0,player.homingBombCd-dt);
      if(player.homingBombCd<=0&&enemies.some(e=>!e.dead)){
        const cdMult=SPELL_CD_MULT[playerSkills.spellHaste||0];
        player.homingBombCd=HOMING_CD_BASE[homingBombLvl]*cdMult;
        const spellPwr=SPELL_PWR_MULT[playerSkills.spellPower||0];
        const dmg=Math.round(HOMING_DMG[homingBombLvl]*spellPwr*atkScale());
        const explR=HOMING_EXPLR[homingBombLvl];
        for(let bi=0;bi<HOMING_N[homingBombLvl];bi++){
          const offX=(Math.random()-0.5)*0.8, offZ=(Math.random()-0.5)*0.8;
          spawnHomingBomb({x:player.pos.x+offX,z:player.pos.z+offZ},dmg,explR);
        }
        spawnShockwave(player.pos.x,player.pos.z,1.7+homingBombLvl*0.25,0xff3300,0.22,0.75);
        flashLight(player.pos,0xff5500,5.5,7,0.18);
        triggerArchmageLoop('homingBomb');
      }
      _setCdFill('bombCdFill',(1-player.homingBombCd/(HOMING_CD_BASE[homingBombLvl]*SPELL_CD_MULT[playerSkills.spellHaste||0]))*100);
    }
    // ── Storm Call (auto-cast, hits farthest enemies) ──
    const stormCallLvl=playerSkills.stormCall||0;
    if(stormCallLvl>0&&!player.dead){
      player.stormCallCd=Math.max(0,player.stormCallCd-dt);
      if(player.stormCallCd<=0){
        const cdMult=SPELL_CD_MULT[playerSkills.spellHaste||0];
        player.stormCallCd=STORMCALL_CD_BASE[stormCallLvl]*cdMult;
        const spellPwr=SPELL_PWR_MULT[playerSkills.spellPower||0];
        const sdmg=Math.round(STORMCALL_DMG[stormCallLvl]*spellPwr*atkScale());
        const nTargets=STORMCALL_TARGETS[stormCallLvl];
        const alive=[...enemies].filter(e=>!e.dead);
        const targets=alive
          .sort((a,b)=>Math.hypot(b.pos.x-player.pos.x,b.pos.z-player.pos.z)-Math.hypot(a.pos.x-player.pos.x,a.pos.z-player.pos.z))
          .slice(0,nTargets);
        for(const te of targets){
          const ei=enemies.indexOf(te); if(ei===-1) continue;
          const stormDmg=playerDamageAmount(te,sdmg);
          te.hp-=stormDmg; addEnemyStagger(te,0.25); te.hitFlashT=0.15;
          showHitNumber(te,stormDmg,'#ffffaa',mp.myId,'spell');
          burst({x:te.pos.x,z:te.pos.z},0xffff44,isMobile?8:14);
          burst({x:te.pos.x,z:te.pos.z},0xffffff,isMobile?4:7);
          spawnStormZap(te.pos.x,te.pos.z);
          shakeAmt=Math.max(shakeAmt,0.14);
          tagElement(te,'thunder',stormDmg);
          if(te.hp<=0) killEnemy(te);
        }
        if(targets.length>0) sLightH();
        if(targets.length>0) triggerArchmageLoop('stormCall');
      }
      _setCdFill('stormCdFill',(1-player.stormCallCd/(STORMCALL_CD_BASE[stormCallLvl]*SPELL_CD_MULT[playerSkills.spellHaste||0]))*100);
    }
  }

  updateSummons(dt, now);

  // ── Summon CD bars ─────────────────────────────────────
  { const cdM=getSummonCdMult();
    if(playerSkills.guardianTurret){
      const _tLvl=playerSkills.guardianTurret;
      _setCdFill('turretCdFill',(1-Math.min(turretSpawnCd/Math.max(0.01,TURRET_CD[_tLvl]*cdM),1))*100);
    }
    if(playerSkills.laserDrone){
      const _dLvl=playerSkills.laserDrone;
      _setCdFill('droneCdFill',(1-Math.min(droneSpawnCd/Math.max(0.01,DRONE_SPAWN_CD[_dLvl]*cdM),1))*100);
    }
    if(playerSkills.repairDrone){
      const _rLvl=playerSkills.repairDrone;
      _setCdFill('repairCdFill',(1-Math.min(repairDroneSpawnCd/Math.max(0.01,REPAIR_SPAWN_CD[_rLvl]*cdM),1))*100);
    }
    if(playerSkills.shieldBot){
      _setCdFill('shieldBotCdFill',(1-Math.min(shieldBotSpawnCd/Math.max(0.01,SHIELDBOT_RESPAWN_BASE*cdM),1))*100);
    }
    if(playerSkills.bladeSentinel){
      _setCdFill('sentinelCdFill',(1-Math.min(sentinelSpawnCd/Math.max(0.01,SENTINEL_RESPAWN_BASE*cdM),1))*100);
    }
  }

  if(gState==='playing'&&!waveClear&&!waveTransition) waveFightTime+=dt;

  // ── Enemy AI (host / solo only) ──
  if(mp.soloMode||mp.isHost){
    // Rebuild flow field on timer
    navTimer-=dt;
    if(navTimer<=0){
      navTimer=NAV_FREQ;
      const srcs=[];
      if(isLivingPlayerState(player)) srcs.push({x:player.pos.x,z:player.pos.z});
      for(const rp of Object.values(mp.remotePlayers)) if(isLivingPlayerState(rp)) srcs.push({x:rp.pos.x,z:rp.pos.z});
      if(srcs.length) buildFlowField(srcs);
    }

    buildGrid();
    activeGravityFields.length=0;
    for(const b of bulletPool)if(b.active&&b.bulletKind==='gravity'&&!b.visualOnly&&b.delay<=0&&!b.gravityTravelling)activeGravityFields.push(b);
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i]; if(!e||e.dead) continue;
      e.gravitySource=gravityFieldForEnemy(e);
      const tgt=getEnemyTarget(e.pos.x,e.pos.z);
      if(!tgt){
        e.mesh.position.x=e.pos.x; e.mesh.position.z=e.pos.z;
        e.mesh.position.y=0.55+Math.sin(now*0.005+i)*0.05;
        animateEnemyRig(e,dt,now,0);
        updateEnemyGrassVisibility(e,dt);
        continue;
      }
      const dx=tgt.x-e.pos.x, dz=tgt.z-e.pos.z;
      const dist=tgt.dist;
      e._lastDist=dist;

      const ramHandled=e.type==='rammer'&&tickRammer(e,dt,tgt);
      if(!ramHandled){
      let desiredX=0,desiredZ=0;
      if(e.stagger>0){ e.stagger-=dt; }
      else{
        let navX,navZ;
        if(tgt.isSummon){
          navX=dist>0.01?dx/dist:0; navZ=dist>0.01?dz/dist:0;
        } else {
          const {fx,fz,ok}=getNavFlowRobust(e.pos.x,e.pos.z);
          navX=ok?fx:(dist>0.01?dx/dist:0); navZ=ok?fz:(dist>0.01?dz/dist:0);
        }

        if(e.type==='rammer'){
          desiredX=dist<2?(dist>.01?-dx/dist:-Math.sin(e.mesh.rotation.y)):navX;
          desiredZ=dist<2?(dist>.01?-dz/dist:-Math.cos(e.mesh.rotation.y)):navZ;
        } else if(e.type==='chaser'||e.type==='tank'||e.type==='bomber'||e.type==='boss'||e.type==='shieldBearer'||e.type==='splitter'||e.type==='splitterling'||e.type==='berserker'){
          // Shield Bearer behaves like a tank/chaser — pushes straight toward
          // the player so its forward shield arc points at the threat.
          // Splitter / splitterling / berserker are also straight melee rushers.
          desiredX=navX; desiredZ=navZ;
        } else if(e.type==='healer'||e.type==='summoner'||e.type==='linker'){
          // Healer keeps mid-rear distance (~7m). Backs off if too close,
          // strafes if at sweet spot. Same archetype as sniper but slower.
          if(dist<7&&dist>0.01){desiredX=-dx/dist;desiredZ=-dz/dist;}
          else{desiredX=navX;desiredZ=navZ;}
          if(dist>0.01){desiredX-=dz/dist*0.5;desiredZ+=dx/dist*0.5;}
        } else if(e.type==='speeder'){
          desiredX=navX; desiredZ=navZ;
          if(Math.random()<0.03){desiredX+=(Math.random()-0.5)*1.8;desiredZ+=(Math.random()-0.5)*1.8;}
        } else if(e.type==='shooter'){
          if(dist<5.5&&dist>0.01){desiredX=-dx/dist;desiredZ=-dz/dist;}
          else{desiredX=navX;desiredZ=navZ;}
          if(dist>0.01){desiredX-=dz/dist*0.6;desiredZ+=dx/dist*0.6;}
        } else if(e.type==='sniper'){
          if(dist<9&&dist>0.01){desiredX=-dx/dist;desiredZ=-dz/dist;}
          else{desiredX=navX;desiredZ=navZ;}
          if(dist>0.01){desiredX-=dz/dist*1.4;desiredZ+=dx/dist*1.4;}
        } else if(e.type==='disruptor'){
          if(dist<6.5&&dist>0.01){desiredX=-dx/dist;desiredZ=-dz/dist;}
          else{desiredX=navX;desiredZ=navZ;}
          if(dist>0.01){desiredX+=dz/dist*0.9;desiredZ-=dx/dist*0.9;}
        } else if(e.type==='dasher'){
          if(e.dashCharge>0){
            e.dashCharge-=dt;
            desiredX=0; desiredZ=0;
            if(e.dashCharge<=0&&dist>0.01){
              e.dashActive=e.elite?0.72:0.58;
              e.dashDX=dx/dist; e.dashDZ=dz/dist;
              triggerEnemyAttack(e,0.22);
              burst(e.pos,0xff00cc,isMobile?4:8);
              sChargeThrot();
            }
          } else if(e.dashActive>0){
            e.dashActive-=dt; desiredX=e.dashDX; desiredZ=e.dashDZ;
          } else {
            e.dashT-=dt;
            if(e.dashT<=0&&dist>1.5){
              e.dashT=(e.elite?1.8:3)+Math.random()*(e.elite?1.2:2);
              if(dist>0.01){
                e.dashDX=dx/dist;e.dashDZ=dz/dist;
                spawnWarningLine(e.pos.x,e.pos.z,Math.atan2(dx,dz),Math.min(8.0,dist+1.2),0.86,0xff00cc,e.elite?0.38:0.54);
                enemyAlert(e,'DASH',0xff00cc);
                e.dashCharge=e.elite?0.38:0.54;
              }
            }
            desiredX=navX; desiredZ=navZ;
          }
        }
        const dl=Math.hypot(desiredX,desiredZ);
        if(dl>0.001){desiredX/=dl;desiredZ/=dl;}
        const avoid=wallAvoidVector(e.pos,e.cfg.r);
        const avoidLen=Math.hypot(avoid.x,avoid.z);
        const probeStep=Math.max(e.cfg.r*0.45,0.55);
        if(avoidLen>0.001&&!canMoveAlong(e.pos,desiredX,desiredZ,e.cfg.r,probeStep)){
          desiredX+=avoid.x*0.75;
          desiredZ+=avoid.z*0.75;
          const al=Math.hypot(desiredX,desiredZ)||1;
          desiredX/=al; desiredZ/=al;
        }
        if(e.detourT>0){
          e.detourT-=dt;
          const detourStep=Math.max(e.cfg.r*1.2,0.9);
          if(canMoveAlong(e.pos,e.detourX,e.detourZ,e.cfg.r,detourStep)){
            desiredX=e.detourX; desiredZ=e.detourZ;
          } else {
            e.detourT=0;
          }
        }
      }

      const ml=Math.hypot(desiredX,desiredZ)||1;
      const _isSlowed=(slowMap.get(e.poolIdx)||0)>0;
      let _spd=e.spd*(_isSlowed?0.35:1);
      _spd*=1+Math.min(Math.max(0,waveFightTime-35)*0.006,0.35);
      if(e.type==='dasher'&&e.dashActive>0) _spd=e.spd*4.2;
      if(e.type==='berserker') _spd*=1+(1-Math.max(0,Math.min(1,e.hp/e.maxHp)))*0.9; // rage: faster as HP drops
      _spd*=hasteAuraMult();
      // Speed Demon challenge — every enemy moves twice as fast for the wave.
      if(waveEvent && waveEvent.type==='challenge' && waveEvent.sub==='speedDemon') _spd*=2;
      const gravity=e.gravitySource;
      // Apply after all Hell, dash, rage and challenge speed bonuses.
      if(gravity)_spd=Math.min(_spd,GUNS.gravity.pullSpeed*(e.type==='boss'?GUNS.gravity.bossPullMult:1)*.5);
      if(!gravity?.gravityGlobal){
      const steer=openSteer(e.pos,desiredX/ml,desiredZ/ml,e.cfg.r,Math.max(e.cfg.r*0.85,_spd*dt*2.2),e.avoidX,e.avoidZ);
      e.avoidX=steer.x; e.avoidZ=steer.z;
      e.pos.x+=steer.x*_spd*dt;
      e.pos.z+=steer.z*_spd*dt;
      clamp(e.pos,e.cfg.r); resolveObst(e.pos,e.cfg.r);
      separateEnemy(e,i); clamp(e.pos,e.cfg.r); resolveObst(e.pos,e.cfg.r);
      if(isBlockedAt(e.pos.x,e.pos.z,e.cfg.r)) projectToNearestOpen(e.pos,e.cfg.r,Math.max(2.5,e.cfg.r*2.5));

      // Stuck escape: if barely moved in 0.45s, nudge perpendicular to flow
      if(gravity){e.stuckCheck=.45;e.prevX=e.pos.x;e.prevZ=e.pos.z;}
      e.stuckCheck-=dt;
      if(e.stuckCheck<=0){
        e.stuckCheck=0.45;
        const moved=Math.hypot(e.pos.x-e.prevX,e.pos.z-e.prevZ);
        const stuckLimit=Math.max(0.12,Math.min(0.28,e.cfg.r*0.22));
        if(moved<stuckLimit&&e.stagger<=0){
          const side=Math.random()<0.5?1:-1;
          const away=wallAvoidVector(e.pos,e.cfg.r);
          const detour=chooseDetourDirection(e.pos,desiredX/ml,desiredZ/ml,e.cfg.r,Math.max(e.cfg.r*1.3,1.0),e.avoidX||(-steer.z*side),e.avoidZ||(steer.x*side));
          e.detourX=detour.x; e.detourZ=detour.z;
          e.detourT=e.type==='boss'?1.35:0.9;
          const ax=Math.hypot(away.x,away.z)>0.001?away.x+detour.x*0.8:detour.x;
          const az=Math.hypot(away.x,away.z)>0.001?away.z+detour.z*0.8:detour.z;
          const al=Math.hypot(ax,az)||1;
          e.pos.x+=(ax/al)*Math.max(0.9,e.cfg.r*0.75);
          e.pos.z+=(az/al)*Math.max(0.9,e.cfg.r*0.75);
          clamp(e.pos,e.cfg.r); resolveObst(e.pos,e.cfg.r);
          if(isBlockedAt(e.pos.x,e.pos.z,e.cfg.r)) projectToNearestOpen(e.pos,e.cfg.r,Math.max(3,e.cfg.r*3));
        }
        e.prevX=e.pos.x; e.prevZ=e.pos.z;
      }

      } // Global singularities own movement, including passage through walls.
      } // Rammer wind-up, rush and recovery own their movement.
      const moveAmt=Math.hypot(e.pos.x-e.mesh.position.x,e.pos.z-e.mesh.position.z);
      e.mesh.position.x=e.pos.x; e.mesh.position.z=e.pos.z;
      e.mesh.position.y=0.55+Math.sin(now*0.005+i)*0.05;
      if(e.type==='rammer'&&ramHandled)e.mesh.rotation.y=Math.atan2(e.ram.dx,e.ram.dz);
      else if(dist>0.01){
        const turnRate=e.type==='boss'?4.5:e.type==='tank'?5.5:e.type==='sniper'?6.5:9;
        e.mesh.rotation.y=angleLerp(e.mesh.rotation.y,Math.atan2(dx,dz),1-Math.exp(-turnRate*dt));
      }
      animateEnemyRig(e,dt,now,moveAmt);
      if(e.hitFlashT>0){ e.hitFlashT=Math.max(0,e.hitFlashT-dt); }
      const _ff=e.hitFlashT>0 ? e.hitFlashT/0.12 : 0;
      let _ei=0.45*(e.hp/e.maxHp)+0.18+_ff*1.35;
      if(e.elite) _ei+=0.18;
      if(e.type==='rammer'&&e.ram.phase==='windup')_ei+=1.5*(1-e.ram.timer/.9);
      if(e.type==='rammer'&&e.ram.phase==='crashed')_ei+=.8;
      if(e.type==='berserker') _ei+=(1-Math.max(0,Math.min(1,e.hp/e.maxHp)))*0.9; // glows hotter while enraged
      if(e.type==='bomber'&&dist<4) _ei+=0.35+Math.max(0,Math.sin(now*0.014))*0.45; // danger pulse
      if(e.type==='sniper'&&e.chargeT>0) _ei+=1.4*(1-e.chargeT/0.65);  // charge-up glow
      if(e.type==='dasher'&&(e.dashActive>0||e.dashCharge>0)) _ei+=1.6; // charge / dash trail flash
      if(e.type==='disruptor'&&e.chargeT>0) _ei+=1.1;
      _ei=Math.min(_ei,e.elite?2.0:2.6);
      updateEnemyGrassVisibility(e,dt);
      e.mesh.material.emissiveIntensity=_ei;
      if(e.spawnAnim>0){
        e.spawnAnim-=dt;
        const _t=1.0-e.spawnAnim/0.4;
        const _sc=_t<0.75?_t/0.75:1+Math.sin((_t-0.75)/0.25*Math.PI)*0.18;
        e.mesh.scale.setScalar(Math.max(0.001,_sc)*(e.sizeMult||1));
      } else { const _s=e.sizeMult||1; if(Math.abs(e.mesh.scale.x-_s)>1e-3) e.mesh.scale.setScalar(_s); }

      if(e.type==='rammer')continue; // Rammer damage is handled by its swept charge.
      // ── Attacks ──
      // Difficulty scales attack RATE by stretching the cooldown's countdown:
      // a smaller cd (hell) makes fdt larger so fireCd hits 0 sooner = more
      // shots/sec; easy does the reverse. Charge/telegraph timers stay on real
      // dt so wind-ups remain readable and fair.
      // Ranged Hell challenge adds a 1.5x enemy fire-rate buff (rate only — the
      // charge/telegraph timers above stay on real dt, so wind-ups stay fair).
      const fdt = (dt / diffCfg().cd) * ((waveEvent && waveEvent.type==='challenge' && waveEvent.sub==='rangedHell') ? 1.5 : 1);
      // ── Elite specials — every enemy type gains one signature ability when
      // elite (champion does its type-special too, plus the volley below). All
      // host-side; results sync via HOST_STATE. cd is shorter for champions.
      if(e.elite){
        e.eliteCd-=fdt;
        if(e.eliteCd<=0 && dist<16){
          const champ=e.elite==='champion';
          const dm=e.dmgMult, col=e.cfg.emi||e.cfg.col;
          const base=dist>0.01?Math.atan2(dx,dz):0;
          let cd=3.4+Math.random()*1.4;
          switch(e.type){
            case 'chaser': // Lunge: leap toward the player
              if(!e.gravitySource&&dist>1.6&&dist<11){ const L=Math.min(4.0,dist*0.7); e.pos.x+=Math.sin(base)*L; e.pos.z+=Math.cos(base)*L; clamp(e.pos,e.cfg.r); resolveObst(e.pos,e.cfg.r); e.prevX=e.pos.x; e.prevZ=e.pos.z; spawnShockwave(e.pos.x,e.pos.z,2.0,col,0.2,0.6); triggerEnemyAttack(e,0.22); }
              cd=2.4+Math.random(); break;
            case 'speeder': // Afterburn: drop a damaging scorch where it stands
              castMeteor(e.pos.x,e.pos.z,1.7,Math.round(11*dm),col,0.5); cd=1.8+Math.random()*0.6; break;
            case 'tank': case 'shieldBearer': { // Slam + (shield) heal nearby allies
              spawnWarningCircle(e.pos.x,e.pos.z,3.0,col,0.5,()=>{ bossDamageCircle(e.pos.x,e.pos.z,3.0,Math.round(16*dm)); spawnShockwave(e.pos.x,e.pos.z,3.0,col,0.24,0.8); burst(e.pos,col,isMobile?6:12); });
              if(e.type==='shieldBearer'){ for(const a of enemies){ if(!a||a.dead||a===e||a.hp>=a.maxHp||a.elite||a.type==='boss') continue; if(Math.hypot(a.pos.x-e.pos.x,a.pos.z-e.pos.z)>5) continue; a.hp=Math.min(a.maxHp,a.hp+Math.round(a.maxHp*0.05)); } spawnShockwave(e.pos.x,e.pos.z,5,0x88ccff,0.26,0.7); }
              triggerEnemyAttack(e,0.4); cd=4.0+Math.random(); break; }
            case 'shooter': // Burst: 5-round fan
              for(const off of [-0.4,-0.2,0,0.2,0.4]) fireBullet(e.pos,_scratchDir.set(Math.sin(base+off),0,Math.cos(base+off)),false,Math.round(12*dm));
              spawnShockwave(e.pos.x,e.pos.z,1.8,col,0.2,0.7); sEnemyShotThrot(); triggerEnemyAttack(e,0.26); cd=2.8+Math.random(); break;
            case 'sniper': // Piercing rail line through the player
              if(dist>0.01){ enemyAlert(e,'RAIL',col); castBossLineHazard(e.pos.x,e.pos.z,base,Math.min(20,dist+2),0.7,Math.round(26*dm),col,0.55); } cd=3.6+Math.random(); break;
            case 'bomber': // Cluster: 3 delayed blasts around the player
              for(let k=0;k<3;k++){ const a=Math.random()*Math.PI*2,r=Math.random()*3; castMeteor(tgt.x+Math.sin(a)*r,tgt.z+Math.cos(a)*r,1.7,Math.round(14*dm),col,0.7+k*0.12); } enemyAlert(e,'CLUSTER',col); cd=4.2+Math.random(); break;
            case 'dasher': // Extra dash with a hazard trail
              castDash(e,tgt,8,1.0,Math.round(20*dm),col,0.5); cd=3.2+Math.random(); break;
            case 'disruptor': // Static field: wide jam AoE on the player
              { const tx=tgt.x,tz=tgt.z; enemyAlert(e,'JAM',col); spawnWarningCircle(tx,tz,3.0,col,0.7,()=>{ bossDamageCircle(tx,tz,3.0,Math.round(13*dm)); spawnShockwave(tx,tz,3.0,col,0.24,0.78); burst({x:tx,z:tz},col,isMobile?6:12); }); } cd=4.4+Math.random(); break;
            case 'healer': { // Mass mend: heal nearby NORMAL allies (not elites/champions/bosses)
              let any=false; for(const a of enemies){ if(!a||a.dead||a===e||a.hp>=a.maxHp||a.elite||a.type==='boss') continue; if(Math.hypot(a.pos.x-e.pos.x,a.pos.z-e.pos.z)>6) continue; const h=Math.max(1,Math.round(a.maxHp*0.07)); a.hp=Math.min(a.maxHp,a.hp+h); dmgNum('+'+h,_scratchPos.set(a.pos.x,0,a.pos.z),'#44ff77'); any=true; } if(any){ spawnShockwave(e.pos.x,e.pos.z,6,0x44ff77,0.3,0.85); enemyAlert(e,'MASS HEAL',0x44ff77); } cd=3.8+Math.random(); break; }
            case 'summoner': // Overlord: an extra summon burst
              if(enemies.length<46){ enemyAlert(e,'SUMMON',col); for(let k=0;k<2&&enemies.length<46;k++){ const a=Math.random()*Math.PI*2,r=1.6+Math.random(); spawnEnemy(Math.random()<0.5?'chaser':'speeder',e.pos.x+Math.cos(a)*r,e.pos.z+Math.sin(a)*r); } } cd=4.5+Math.random(); break;
            case 'berserker': case 'splitter': // Bloodfury: small self-heal while wounded (not champions — they're tanky enough)
              if(!champ && e.hp<e.maxHp*0.5){ const h=Math.max(1,Math.round(e.maxHp*0.05)); e.hp=Math.min(e.maxHp,e.hp+h); dmgNum('+'+h,_scratchPos.set(e.pos.x,0,e.pos.z),'#ff4466'); burst(e.pos,col,isMobile?4:7); } cd=2.8+Math.random(); break;
          }
          e.eliteCd=cd*(champ?0.7:1);
        }
      }
      // Champion mini-boss: periodic 5-round tracking volley on top of its base attacks.
      if(e.elite==='champion'&&dist<16){
        e.elitePulseCd-=fdt;
        if(e.elitePulseCd<=0&&dist>0.01){
          e.elitePulseCd=2.6+Math.random()*0.8;
          triggerEnemyAttack(e,0.4);
          enemyAlert(e,'VOLLEY',0xff66ff);
          const base=Math.atan2(dx,dz);
          for(const off of [-0.34,-0.17,0,0.17,0.34]){
            fireBullet(e.pos,_scratchDir.set(Math.sin(base+off),0,Math.cos(base+off)),false,Math.round(13*e.dmgMult));
          }
          burst(e.pos,0xff66ff,isMobile?5:10);
          spawnShockwave(e.pos.x,e.pos.z,2.2,0xff66ff,0.26,0.8);
          sEnemyShotThrot();
        }
      }

      if(e.type==='shooter'){
        e.fireCd-=fdt;
        if(e.fireCd<=0&&dist<13){
          // Faster cadence (was 2.0+1.0r → 1.3+0.7r so ~33% more shots/sec)
          // + per-shot random spread so the rounds don't sit on a perfectly
          // predictable line. spread = ~±9° each side keeps the cone tight
          // enough to threaten but not as oppressive as a sniper.
          e.fireCd=1.3+Math.random()*0.7;
          if(dist>0.01){
            const ang=Math.atan2(dx,dz) + (Math.random()-0.5)*0.32;
            fireBullet(e.pos,_scratchDir.set(Math.sin(ang),0,Math.cos(ang)),false,Math.round(14*e.dmgMult));
            triggerEnemyAttack(e,0.22);
            impactPulse(e.pos,0xff8800,0.8,isMobile?2:4);
            sEnemyShotThrot();
          }
        }
      }
      if(e.type==='sniper'){
        // Phase 1: wait for fireCd, then enter charge
        if(e.chargeT<=0){ e.fireCd-=fdt; if(e.fireCd<=0&&dist<18){ e.fireCd=3.5+Math.random(); e.chargeT=0.65; enemyAlert(e,'SNIPE',0x00eeff); spawnWarningLine(e.pos.x,e.pos.z,Math.atan2(dx,dz),Math.min(18,dist+1.0),0.28,0x00eeff,0.65); spawnShockwave(e.pos.x,e.pos.z,1.4,0x00eeff,0.35,0.7); sChargeThrot(); } }
        // Phase 2: charge up, then fire high-damage shot
        else{ e.chargeT-=dt; if(e.chargeT<=0&&dist>0.01){
          fireBullet(e.pos,_scratchDir.set(dx/dist,0,dz/dist),false,Math.round(32*e.dmgMult));
          // Tag the just-fired bullet so it punches through player summons
          // and reaches the player. Sniper is the anti-wall counter so the
          // player can't hide behind a chain of allies forever.
          for(let _bi=bulletPool.length-1;_bi>=0;_bi--){
            const _sb=bulletPool[_bi];
            if(_sb.active && !_sb.isPlayer && _sb.pos.x===e.pos.x && _sb.pos.z===e.pos.z){
              _sb.piercesAllies=true; break;
            }
          }
          triggerEnemyAttack(e,0.32);
          impactPulse(e.pos,0x00eeff,1.0,isMobile?3:6);
          sEnemyShotThrot();
        } }
      }
      if(e.type==='disruptor'){
        if(e.chargeT>0) e.chargeT-=dt;
        e.fireCd-=fdt;
        if(e.fireCd<=0&&dist<14){
          e.fireCd=3.0+Math.random()*0.8;
          e.chargeT=0.85;
          const tx=tgt.x+(Math.random()-0.5)*1.8, tz=tgt.z+(Math.random()-0.5)*1.8;
          triggerEnemyAttack(e,0.36);
          enemyAlert(e,'JAM',0x55ff99);
          spawnWarningCircle(tx,tz,2.15,0x55ff99,0.82,()=>{
            bossDamageCircle(tx,tz,2.15,Math.round(13*e.dmgMult));
            spawnShockwave(tx,tz,2.15,0x55ff99,0.22,0.78);
            burst({x:tx,z:tz},0x55ff99,isMobile?7:12);
          });
          sChargeThrot();
        }
      }
      if(e.type==='tank'&&dist<1.4+e.cfg.r){
        e.fireCd-=fdt; if(e.fireCd<=0){
          e.fireCd=1.6;
          triggerEnemyAttack(e,0.32);
          dealDmgToTarget(tgt,Math.round(28*e.dmgMult));
        }
      }
      if((e.type==='chaser'||e.type==='speeder')&&dist<1.0+e.cfg.r){
        e.fireCd-=fdt; if(e.fireCd<=0){
          e.fireCd=0.75;
          triggerEnemyAttack(e,e.type==='speeder'?0.18:0.24);
          dealDmgToTarget(tgt,Math.round((e.type==='speeder'?9:16)*e.dmgMult));
        }
      }
      if(e.type==='bomber'&&dist<1.2+e.cfg.r){
        e.fireCd-=fdt; if(e.fireCd<=0){
          e.fireCd=2.0;
          triggerEnemyAttack(e,0.36);
          const bx=e.pos.x,bz=e.pos.z,br=1.8+e.cfg.r,bd=Math.round(20*e.dmgMult);
          enemyAlert(e,'BOMB',0xff5500);
          spawnWarningCircle(bx,bz,br,0xff5500,0.38,()=>{
            if(e.dead) return;
            bossDamageCircle(bx,bz,br,bd);
            burst({x:bx,z:bz},0xff5500,isMobile?5:9);
          });
        }
      }
      if(e.type==='dasher'&&dist<1.0+e.cfg.r){
        e.fireCd-=fdt; if(e.fireCd<=0){
          e.fireCd=0.8;
          triggerEnemyAttack(e,0.22);
          dealDmgToTarget(tgt,Math.round((e.dashActive>0?32:16)*e.dmgMult));
        }
      }
      if(e.type==='healer'){
        // Heal pulse every ~3.5s. Restores 8% of each nearby (<5m) enemy's
        // MAX HP (not current), capped at maxHp. Healer doesn't heal itself
        // to keep it killable. Telegraph: spinning ring + green shockwave.
        e.fireCd-=fdt;
        if(e.fireCd<=0){
          e.fireCd=3.4+Math.random()*0.5;
          triggerEnemyAttack(e,0.30);
          let healedAny=false;
          for(let hi=0;hi<enemies.length;hi++){
            const a=enemies[hi]; if(!a||a.dead||a===e) continue;
            if(a.elite||a.type==='boss') continue; // never sustain elites/champions/bosses
            if(Math.hypot(a.pos.x-e.pos.x,a.pos.z-e.pos.z)>5) continue;
            if(a.hp>=a.maxHp) continue;
            const heal=Math.max(1,Math.round(a.maxHp*0.08));
            a.hp=Math.min(a.maxHp,a.hp+heal);
            dmgNum('+'+heal,_scratchPos.set(a.pos.x,0,a.pos.z),'#44ff77');
            healedAny=true;
          }
          if(healedAny){
            spawnShockwave(e.pos.x,e.pos.z,5.0,0x44ff77,0.32,0.85);
            burst(e.pos,0x44ff77,isMobile?6:12);
            enemyAlert(e,'HEAL',0x44ff77);
          }
        }
      }
      if(e.type==='shieldBearer'&&dist<1.2+e.cfg.r){
        // Slow heavy shove on contact, similar damage to tank.
        e.fireCd-=fdt; if(e.fireCd<=0){
          e.fireCd=1.4;
          triggerEnemyAttack(e,0.34);
          dealDmgToTarget(tgt,Math.round(22*e.dmgMult));
        }
      }
      if((e.type==='splitter'||e.type==='berserker')&&dist<1.0+e.cfg.r){
        e.fireCd-=fdt; if(e.fireCd<=0){
          e.fireCd=0.8;
          triggerEnemyAttack(e,0.26);
          dealDmgToTarget(tgt,Math.round((e.type==='berserker'?14:18)*e.dmgMult));
        }
      }
      if(e.type==='splitterling'&&dist<0.9+e.cfg.r){
        e.fireCd-=fdt; if(e.fireCd<=0){
          e.fireCd=0.7;
          triggerEnemyAttack(e,0.18);
          dealDmgToTarget(tgt,Math.round(7*e.dmgMult));
        }
      }
      if(e.type==='summoner'){
        // Keeps its distance and conjures trash. Capped so it can't flood the arena.
        e.fireCd-=fdt;
        if(e.fireCd<=0){
          e.fireCd=5.5+Math.random()*1.5;
          if(enemies.length<46){
            triggerEnemyAttack(e,0.4);
            enemyAlert(e,'SUMMON',0xb066ff);
            spawnShockwave(e.pos.x,e.pos.z,2.6,0xb066ff,0.4,0.85);
            burst(e.pos,0xb066ff,isMobile?5:10);
            const n=waveNum>=14?2:1;
            for(let s=0;s<n&&enemies.length<46;s++){
              const a=Math.random()*Math.PI*2,rad=1.6+Math.random()*0.8;
              spawnEnemy(Math.random()<0.5?'chaser':'speeder',e.pos.x+Math.cos(a)*rad,e.pos.z+Math.sin(a)*rad);
            }
          }
        }
      }
      if(e.type==='boss'){
        const profile=e.bossProfile||BOSS_PROFILES[e.bossName]||BOSS_PROFILES.WARDEN;
        const hpPct=e.hp/e.maxHp;
        const newPhase=hpPct>0.66?1:hpPct>0.33?2:3;
        if(newPhase>e.phase){
          e.phase=newPhase; shakeAmt=0.52;
          hitStop(newPhase===3?0.12:0.09); musicSwell(newPhase===3?1.1:0.8);
          burst(e.pos,0xff2244,24); burst(e.pos,0xffaa00,14);
          spawnShockwave(e.pos.x,e.pos.z,5.0,profile.col,0.45,1.0);
          sBossPhase();
          screenFlash(cssHex(profile.col),newPhase===3?0.6:0.45);
          annText(newPhase===2?`${e.bossName}: PHASE 2`:`${e.bossName}: ENRAGED`,cssHex(profile.col));
          spawnBossMinions(e,newPhase===2?profile.phase2:profile.phase3,4.2);
          breakTerrain(e.pos,newPhase===2?4.2:7.0,newPhase===2?2:5,profile.col);
          if(newPhase===3){e.spd*=1.5; musicStart(waveNum,true);}
        }

        e.specialCd-=fdt;
        if(e.specialCd<=0){
          e.specialCd=e.phase===3?3.0:e.phase===2?4.0:5.0;
          triggerEnemyAttack(e,0.48);
          enemyAlert(e,bossSpecialLabel(profile.special),profile.col);
          screenFlash(cssHex(profile.col),0.4);
          shakeAmt=Math.max(shakeAmt,0.42);
          // Per-encounter pattern intensity: later bosses in the run fire denser
          // versions of their special (more meteors / spokes / bullets / rings).
          const iv=e.bossIntensity||0;
          if(profile.special==='warden'){
            castMeteor(e.pos.x,e.pos.z,5.2,Math.round(26*e.dmgMult),profile.col,0.85);
            if(e.phase>=2) castBossMeteorRing(tgt.x,tgt.z,3.9,(e.phase>=3?6:4)+iv,1.55,Math.round(16*e.dmgMult),profile.col,0.76);
            for(let k=0;k<iv;k++) castMeteor(tgt.x+(Math.random()-0.5)*7,tgt.z+(Math.random()-0.5)*7,2.0,Math.round(14*e.dmgMult),profile.col,0.95+k*0.1);
            spawnBossMinions(e,e.phase>=3?['tank','chaser','shooter']:['tank','chaser'],4.8);
            if(e.phase>=2) breakTerrain(e.pos,5.8,e.phase>=3?4:2,profile.col);
            burst(e.pos,profile.col,18);
            sBossPhase();
          } else if(profile.special==='phantom'){
            const ang=Math.atan2(e.pos.x-tgt.x,e.pos.z-tgt.z)+(Math.random()<0.5?0.95:-0.95);
            const p={x:tgt.x+Math.sin(ang)*6.5,z:tgt.z+Math.cos(ang)*6.5};
            projectToNearestOpen(p,e.cfg.r,5);
            const oldX=e.pos.x, oldZ=e.pos.z;
            spawnShockwave(e.pos.x,e.pos.z,2.5,profile.col,0.22,0.7);
            e.pos.x=p.x; e.pos.z=p.z;
            e.detourT=0; e.prevX=p.x; e.prevZ=p.z;
            spawnShockwave(e.pos.x,e.pos.z,2.5,profile.col,0.22,0.7);
            if(e.phase>=2) castBossLineHazard(oldX,oldZ,Math.atan2(tgt.x-oldX,tgt.z-oldZ),Math.min(11,Math.hypot(tgt.x-oldX,tgt.z-oldZ)+2.2),0.78,Math.round(17*e.dmgMult),profile.col,0.62);
            castMeteor(tgt.x,tgt.z,2.4+e.phase*0.25,Math.round(21*e.dmgMult),profile.col,0.72);
            if(e.phase>=3) castMeteor((tgt.x+p.x)*0.5,(tgt.z+p.z)*0.5,1.9,Math.round(15*e.dmgMult),profile.col,0.9);
            for(let k=0;k<iv;k++) castMeteor(tgt.x+(Math.random()-0.5)*5,tgt.z+(Math.random()-0.5)*5,1.8,Math.round(13*e.dmgMult),profile.col,0.8+k*0.1);
            burst(e.pos,profile.col,16);
            sChargeThrot();
          } else if(profile.special==='apex'){
            if(dist>0.01){
              castDash(e,tgt,9.5,1.25+e.phase*0.15,Math.round(30*e.dmgMult),profile.col,0.62);
              const da=Math.atan2(tgt.x-e.pos.x,tgt.z-e.pos.z);
              for(let k=1;k<=iv;k++) castBossLineHazard(e.pos.x,e.pos.z,da+(k%2?1:-1)*Math.ceil(k/2)*0.2,9.0,0.85,Math.round(14*e.dmgMult),profile.col,0.55);
            }
          } else if(profile.special==='nexus'){
            e.burstSpin+=0.3;
            spawnWarningCircle(e.pos.x,e.pos.z,3.2,profile.col,0.55,()=>castBulletPattern(e,Math.round(((e.phase===3?24:16)+iv*3)*diffCfg().bullets),Math.round(13*e.dmgMult),profile.col,e.burstSpin));
            if(e.phase>=2){
              const base=Math.atan2(dx,dz)+e.burstSpin;
              castBossLineHazard(e.pos.x,e.pos.z,base,11.5,0.52,Math.round(15*e.dmgMult),profile.col,0.72);
              if(e.phase>=3) castBossLineHazard(e.pos.x,e.pos.z,base+Math.PI*0.5,11.5,0.52,Math.round(15*e.dmgMult),profile.col,0.82);
              if(iv>=2) castBossLineHazard(e.pos.x,e.pos.z,base+Math.PI*0.25,11.5,0.52,Math.round(14*e.dmgMult),profile.col,0.9);
            }
          } else if(profile.special==='herald'){
            spawnBossMinions(e,e.phase>=3?['sniper','shooter','dasher','bomber']:['sniper','shooter','chaser'],4.6);
            heraldCommandAura(e,profile.col);
            castMeteor(tgt.x,tgt.z,2.6,Math.round(24*e.dmgMult),profile.col,0.9);
            if(e.phase>=2) castMeteor(tgt.x+3.2,tgt.z-1.8,2.1,Math.round(17*e.dmgMult),profile.col,1.05);
            if(e.phase>=3) castMeteor(tgt.x-3.2,tgt.z+1.8,2.1,Math.round(17*e.dmgMult),profile.col,1.05);
            for(let k=0;k<iv;k++) castMeteor(tgt.x+(Math.random()-0.5)*6,tgt.z+(Math.random()-0.5)*6,2.0,Math.round(15*e.dmgMult),profile.col,0.95+k*0.1);
            if(iv>=2) spawnBossMinions(e,['shooter','chaser'],5.2);
            sElite();
          } else if(profile.special==='goliath'){
            // Seismic pound: detonation at its feet + expanding shockwave rings
            // that radiate outward, so standing anywhere near it is lethal.
            castMeteor(e.pos.x,e.pos.z,4.0,Math.round(30*e.dmgMult),profile.col,0.7);
            castBossMeteorRing(e.pos.x,e.pos.z,3.6,(e.phase>=3?10:e.phase>=2?8:6)+iv,1.7,Math.round(18*e.dmgMult),profile.col,0.8);
            if(e.phase>=3||iv>=2) castBossMeteorRing(e.pos.x,e.pos.z,6.6,12+iv,1.7,Math.round(15*e.dmgMult),profile.col,1.05);
            spawnBossMinions(e,e.phase>=3?['tank','shieldBearer']:['tank'],5.0);
            breakTerrain(e.pos,6.5,e.phase>=3?5:3,profile.col);
            burst(e.pos,profile.col,22); shakeAmt=Math.max(shakeAmt,0.6); sSlam();
          } else if(profile.special==='tempest'){
            // Rotating lightning spokes from the core + a strike on the player.
            const spokes=(e.phase>=3?6:e.phase>=2?5:4)+iv;
            const base=Math.atan2(dx,dz)+e.burstSpin;
            for(let s=0;s<spokes;s++) castBossLineHazard(e.pos.x,e.pos.z,base+s/spokes*Math.PI*2,12,0.6,Math.round(15*e.dmgMult),profile.col,0.5+s*0.03);
            e.burstSpin+=0.4;
            castMeteor(tgt.x,tgt.z,2.2,Math.round(20*e.dmgMult),profile.col,0.55);
            if(e.phase>=2) castMeteor(tgt.x+(Math.random()-0.5)*4,tgt.z+(Math.random()-0.5)*4,1.8,Math.round(14*e.dmgMult),profile.col,0.7);
            for(let k=0;k<iv;k++) castMeteor(tgt.x+(Math.random()-0.5)*6,tgt.z+(Math.random()-0.5)*6,1.7,Math.round(12*e.dmgMult),profile.col,0.6+k*0.08);
            spawnShockwave(e.pos.x,e.pos.z,3.0,profile.col,0.2,0.7); sChargeThrot();
          } else if(profile.special==='blight'){
            // Toxic bloom: scattered spore detonations around the player force
            // constant repositioning, backed by a wave of reinforcements.
            const pods=(e.phase>=3?9:e.phase>=2?7:5)+iv*2;
            for(let s=0;s<pods;s++){
              const a=Math.random()*Math.PI*2, rad=Math.random()*4.2;
              castMeteor(tgt.x+Math.sin(a)*rad,tgt.z+Math.cos(a)*rad,1.8,Math.round(13*e.dmgMult),profile.col,0.7+s*0.05);
            }
            spawnBossMinions(e,e.phase>=3?['bomber','splitter','shooter']:['bomber','chaser'],4.6);
            if(e.phase>=2) castBossMeteorRing(e.pos.x,e.pos.z,3.0,6+iv,1.6,Math.round(12*e.dmgMult),profile.col,0.82);
            burst(e.pos,profile.col,16); sElite();
          }
        }

        e.slamCd-=fdt;
        if(e.slamCd<=0){
          e.slamCd=profile.slamCd[Math.max(0,Math.min(2,e.phase-1))];
          triggerEnemyAttack(e,0.52);
          const slamR=(3.5+e.phase*0.5)*profile.slamR;
          castMeteor(e.pos.x,e.pos.z,slamR,Math.round(20*e.dmgMult),profile.col,0.55);
          burst(e.pos,profile.col,12);
          sSlam();
          shakeAmt=Math.max(shakeAmt,0.28);
        }
        if(e.phase>=2){
          e.burstCd-=fdt;
          if(e.burstCd<=0){
            e.burstCd=profile.burstCd[Math.max(0,Math.min(2,e.phase-1))];
            triggerEnemyAttack(e,0.42);
            const n=Math.ceil(profile.burstN[Math.max(0,Math.min(2,e.phase-1))]*bossProjectileMult()*diffCfg().bullets);
            e.burstSpin+=(profile.special==='nexus'?0.32:0.12);
            for(let bi=0;bi<n;bi++){
              let ang=(bi/n)*Math.PI*2+e.burstSpin;
              if(profile.special==='phantom'&&dist>0.01) ang=Math.atan2(dx,dz)+(bi-(n-1)/2)*0.18;
              fireBullet(e.pos,_scratchDir.set(Math.sin(ang),0,Math.cos(ang)),false,Math.round(16*e.dmgMult));
            }
            spawnShockwave(e.pos.x,e.pos.z,2.8,profile.col,0.22,0.75);
            sEnemyShotThrot();
          }
        }
        if(e.phase>=2&&!e.spawnedMinions){
          e.spawnedMinions=true;
          spawnBossMinions(e,e.phase===3?profile.phase3:profile.phase2,3.7);
        }
      }
    }
  } else {
    // Non-host: update enemy mesh positions from applyHostEnemyState data with
    // dead-reckoning so a delayed HOST_STATE packet doesn't freeze the enemy.
    // netVX/netVZ are last-known host velocity; we extrapolate up to 0.5s.
    for(let i=0;i<enemies.length;i++){
      const e=enemies[i]; if(!e||e.dead) continue;
      if(e.netReady){
        e.netExtrapT=(e.netExtrapT||0)+dt;
        if(e.netExtrapT<0.5){
          e.netX+=(e.netVX||0)*dt;
          e.netZ+=(e.netVZ||0)*dt;
        }
        const target={x:e.netX,z:e.netZ};
        smoothNetPos(e.pos,target,dt,MP_ENEMY_SMOOTH,5.5);
      }
      const moveDx=e.pos.x-e.mesh.position.x, moveDz=e.pos.z-e.mesh.position.z;
      const moveAmt=Math.hypot(moveDx,moveDz);
      e.mesh.position.x=e.pos.x;
      e.mesh.position.z=e.pos.z;
      e.mesh.position.y=0.55+Math.sin(now*0.005+i)*0.05;
      if(e.type==='rammer'&&e.ram?.phase!=='idle')e.mesh.rotation.y=Math.atan2(e.ram?.dx||0,e.ram?.dz||1);
      else if(moveAmt>0.002){
        const goal=Math.atan2(moveDx,moveDz);
        e.mesh.rotation.y=angleLerp(e.mesh.rotation.y,goal,1-Math.exp(-8*dt));
      }
      animateEnemyRig(e,dt,now,moveAmt);
      updateEnemyGrassVisibility(e,dt);
    }
  }

  // ── Bullets ──
  rebuildEnemyGrid(); // broadphase for the per-bullet collision + magnetic seeks below
  for(let i=0;i<bulletPool.length;i++){
    const b=bulletPool[i]; if(!b.active) continue;
    const bColor=b.visualColor||(b.isPlayer?0x00ffff:0xff6600);
    if(b.delay>0){
      b.delay-=dt;
      if(b.delay<=0){
        b.delay=0;
        b.mesh.visible=true;
        if(b.isPlayer&&!b.visualOnly&&!isMobile) flashLight(b.pos,bColor,2.2,4.0,0.06);
      } else {
        continue;
      }
    }
    if(b.bulletKind==='gravity'){tickGravityBullet(b,dt);continue;}
    b.life-=dt;
    if(b.life<=0){
      if(b.bulletKind==='grenade'&&b.explodeR){
        armPlayerGrenade(b,bColor);
        continue;
      }
      if(b.explodeR) explodePlayerBullet(b,bColor);
      releaseBullet(b);continue;
    }
    // Max-range despawn for regular bullets — grenades/boomerangs handle
    // their own range logic elsewhere. travelDist is incremented at the
    // bottom of this block after the position update.
    if(b.isPlayer && b.maxRange>0 && !b.bulletKind && !b.boomerang && (b.travelDist||0) >= b.maxRange){
      if(b.explodeR) explodePlayerBullet(b,bColor);
      releaseBullet(b); continue;
    }
    if(b.boomerang){
      const travel=Math.hypot(b.pos.x-b.originX,b.pos.z-b.originZ);
      const ownerPos=ownerWorldPos(b.ownerId??mp.myId);
      if(!b.returning&&travel>=b.maxRange) b.returning=true;
      if(b.returning){
        const rdx=ownerPos.x-b.pos.x, rdz=ownerPos.z-b.pos.z;
        const rdl=Math.hypot(rdx,rdz)||1;
        b.dir.x=rdx/rdl; b.dir.z=rdz/rdl;
        b.spd=Math.max(b.spd,25);
        if(rdl<0.75){ releaseBullet(b); continue; }
      }
    }
    const prevBX=b.pos.x, prevBZ=b.pos.z;
    // Magnetic Rounds — local player's bullets steer toward the nearest live
    // enemy each frame. Skip grenades / boomerangs / non-player bullets and
    // any bullet that's already homing (e.g. railgun rerouting).
    if(b.isPlayer && !b.visualOnly && !b.bulletKind && !b.boomerang && (b.ownerId??mp.myId)===mp.myId && (playerSkills.magneticRounds||0)>0){
      const _mrLvl=playerSkills.magneticRounds;
      // eff 3 (rare pick 1) = gentle curve; eff 5 (rare pick 2) = stronger
      const curveRate=[0,0,0,3.0,3.0,4.5][_mrLvl]||0;
      const seekR=[0,0,0,7,7,10][_mrLvl]||0;
      let bestE=null, bestD=seekR;
      const _mc=queryEnemyGrid(b.pos.x,b.pos.z,seekR,_magnetCands);
      for(let mi=0;mi<_mc.length;mi++){
        const en=_mc[mi]; if(en.dead) continue;
        const d=Math.hypot(en.pos.x-b.pos.x,en.pos.z-b.pos.z);
        if(d<bestD){ bestD=d; bestE=en; }
      }
      if(bestE){
        const tdx=bestE.pos.x-b.pos.x, tdz=bestE.pos.z-b.pos.z;
        const tl=Math.hypot(tdx,tdz)||1;
        const ndx=tdx/tl, ndz=tdz/tl;
        const t=Math.min(1, curveRate*dt);
        b.dir.x = b.dir.x*(1-t) + ndx*t;
        b.dir.z = b.dir.z*(1-t) + ndz*t;
        const dl=Math.hypot(b.dir.x,b.dir.z)||1;
        b.dir.x/=dl; b.dir.z/=dl;
      }
    }
    b.pos.x+=b.dir.x*b.spd*dt; b.pos.z+=b.dir.z*b.spd*dt;
    // Accumulate travel distance for regular bullets and rockets so the
    // max-range despawn check above can trigger. Grenade has its own
    // travelDist tracking inside its branch below; boomerang uses the
    // origin-distance check separately.
    if(b.isPlayer && (!b.bulletKind || b.bulletKind==='rocket') && !b.boomerang){
      b.travelDist = (b.travelDist||0) + Math.hypot(b.pos.x-prevBX, b.pos.z-prevBZ);
    }
    if(b.bulletKind==='grenade'){
      if(!b.grenadeArmed&&b.maxRange>0){
        const stepDist=Math.hypot(b.pos.x-prevBX,b.pos.z-prevBZ);
        b.travelDist=(b.travelDist||0)+stepDist;
        if(b.travelDist>=b.maxRange){
          const keep=stepDist>0 ? Math.max(0,1-(b.travelDist-b.maxRange)/stepDist) : 0;
          b.pos.x=prevBX+(b.pos.x-prevBX)*keep;
          b.pos.z=prevBZ+(b.pos.z-prevBZ)*keep;
          armPlayerGrenade(b,bColor);
        }
      }
      if(b.grenadeArmed){
        b.grenadeGroundT-=dt;
        b.grenadeY=0.18;
        if(!isMobile&&Math.random()<0.22) burst(b.pos,Math.random()<0.5?0xffdd88:bColor,1);
        if(b.grenadeGroundT<=0){
          explodePlayerBullet(b,bColor);
          releaseBullet(b);continue;
        }
      } else {
        b.grenadeY+=b.grenadeVY*dt;
        b.grenadeVY-=15.5*dt;
        if(b.grenadeY<=0.18){
          if(b.groundBounceLeft>0&&Math.abs(b.grenadeVY)>1.2){
            b.grenadeY=0.18;
            b.grenadeVY=Math.abs(b.grenadeVY)*0.56;
            b.groundBounceLeft--;
            b.spd*=0.84;
            if(b.isPlayer) sBounce();
          } else {
            armPlayerGrenade(b,bColor);
          }
        }
        b.mesh.rotation.x+=dt*6.0;
        b.mesh.rotation.z+=dt*8.0;
      }
    }
    b.mesh.position.x=b.pos.x; b.mesh.position.z=b.pos.z;
    if(!b.isPlayer){ // enemy bullets carry a short trail so the line of fire is readable
      if(!b.trail){ b.trail=createTrail(ENEMY_BULLET_TRAIL_COL,0,false,ENEMY_BULLET_TRAIL_PTS); b.trail.widthScale=ENEMY_BULLET_TRAIL_W; }
      updateTrail(b.trail,b.pos.x,0.55,b.pos.z);
    }
    if(b.bulletKind==='grenade') b.mesh.position.y=b.grenadeY;
    if(b.bulletKind==='rocket'){
      b.mesh.rotation.set(0,Math.atan2(b.dir.x,b.dir.z),0);
    } else if(b.isPlayer) b.mesh.rotation.z+=dt*12;
    if(!isMobile&&Math.random()<(b.isPlayer?0.06:0.08)){
      burst(b.pos,bColor,1);
    }
    if(b.bulletKind==='rocket'){
      const tail={x:b.pos.x-b.dir.x*0.42,z:b.pos.z-b.dir.z*0.42};
      burst(tail,Math.random()<0.45?0xffdd55:0xff5522,isMobile?1:2);
      if(!isMobile&&Math.random()<0.42) spawnShockwave(tail.x,tail.z,0.34,0xff5533,0.10,0.28);
    } else if(b.bulletKind==='grenade'){
      const tail={x:b.pos.x-b.dir.x*0.24,z:b.pos.z-b.dir.z*0.24};
      if(!b.grenadeArmed) burst(tail,Math.random()<0.5?0xfff0aa:bColor,isMobile?1:2);
      if(!isMobile&&Math.random()<0.18) spawnShockwave(tail.x,tail.z,0.24,bColor,0.08,0.22);
    }
    // Arena wall bounce / release
    let _wallHit=false;
    if(Math.abs(b.pos.x)>ARENA_W-0.1){ if(b.bounceLeft>0){b.dir.x=-b.dir.x;b.pos.x=Math.sign(b.pos.x)*(ARENA_W-0.15);b.bounceLeft--;aimPistolRicochet(b,-Math.sign(b.pos.x),0);if(b.isPlayer)sBounce();} else _wallHit=true; }
    if(Math.abs(b.pos.z)>ARENA_H-0.1){ if(b.bounceLeft>0){b.dir.z=-b.dir.z;b.pos.z=Math.sign(b.pos.z)*(ARENA_H-0.15);b.bounceLeft--;aimPistolRicochet(b,0,-Math.sign(b.pos.z));if(b.isPlayer)sBounce();} else _wallHit=true; }
    if(_wallHit){
      impactPulse(b.pos,bColor,0.75,3);
      if(b.bulletKind==='grenade'&&b.explodeR){
        if(Math.abs(b.pos.x)>ARENA_W-0.1){ b.dir.x*=-1; b.pos.x=Math.sign(b.pos.x)*(ARENA_W-0.18); }
        if(Math.abs(b.pos.z)>ARENA_H-0.1){ b.dir.z*=-1; b.pos.z=Math.sign(b.pos.z)*(ARENA_H-0.18); }
        b.spd*=0.46;
        b.grenadeVY=Math.min(b.grenadeVY,0.8);
        continue;
      }
      if(b.explodeR) explodePlayerBullet(b,bColor);
      if(b.boomerang&&!b.returning){ b.returning=true; continue; }
      releaseBullet(b);continue;
    }
    if(Math.abs(b.pos.x)>ARENA_W+0.5||Math.abs(b.pos.z)>ARENA_H+0.5){releaseBullet(b);continue;}
    // Obstacle bounce / release
    let hitWall=false, _wnx=0, _wnz=0;
    for(const o of obstacleBoxes){
      const br=b.hitR||0.22;
      if(boxOverlap(b.pos.x,b.pos.z,br,o.x,o.z,o.hw,o.hd)){
        if(b.isPlayer&&!b.visualOnly&&o.destructible) damageObstacle(o,Math.max(18,Math.round((b.dmg||20)*0.45)),bColor);
        const _odx=b.pos.x-o.x, _odz=b.pos.z-o.z;
        const _ox=o.hw+br-Math.abs(_odx), _oz=o.hd+br-Math.abs(_odz);
        if(_ox<_oz){_wnx=Math.sign(_odx);}else{_wnz=Math.sign(_odz);}
        hitWall=true; break;
      }
    }
    if(hitWall){
      if(b.bounceLeft>0){
        b.bounceLeft--;
        if(_wnx!==0){b.dir.x=Math.abs(b.dir.x)*_wnx;b.pos.x+=_wnx*0.3;}
        else{b.dir.z=Math.abs(b.dir.z)*_wnz;b.pos.z+=_wnz*0.3;}
        const _dl=Math.hypot(b.dir.x,b.dir.z)||1;b.dir.x/=_dl;b.dir.z/=_dl;
        aimPistolRicochet(b,_wnx,_wnz);
        if(b.isPlayer){b.mesh.rotation.y=Math.atan2(b.dir.x,b.dir.z);sBounce();}
      } else {
        impactPulse(b.pos,bColor,0.75,3);
        if(b.bulletKind==='grenade'&&b.explodeR){
          if(_wnx!==0){ b.dir.x=Math.abs(b.dir.x)*_wnx; b.pos.x+=_wnx*0.32; }
          else { b.dir.z=Math.abs(b.dir.z)*_wnz; b.pos.z+=_wnz*0.32; }
          b.spd*=0.46;
          b.grenadeVY=Math.min(b.grenadeVY,0.8);
          if(b.isPlayer) sBounce();
          continue;
        }
        if(b.explodeR) explodePlayerBullet(b,bColor);
        if(b.boomerang&&!b.returning){ b.returning=true; continue; }
        releaseBullet(b);continue;
      }
    }

    if(b.isPlayer){
      if(damageMiniObjectiveWithBullet(b)){
        impactPulse(b.pos,0xffaa00,0.7,isMobile?3:5);
        releaseBullet(b);
        continue;
      }
      const heavyRank=b.ownerPerm?.heavyRounds ?? (playerSkills.heavyRounds||0);
      const _hitR=(b.hitR||0.22)+(HEAVY_R[heavyRank]||0); // per-bullet, independent of enemy
      const _cands=queryEnemyGrid(b.pos.x,b.pos.z,_hitR,_bulletCands);
      if(_cands.length>1) _cands.sort((a,c)=>c._gi-a._gi); // keep the old highest-index-first visiting order for simultaneous-overlap ties
      for(let ci=0;ci<_cands.length;ci++){
        const e=_cands[ci]; if(e.dead) continue;
        if(b.hitSet?.has(e)) continue;
        if(Math.hypot(b.pos.x-e.pos.x,b.pos.z-e.pos.z)<e.cfg.r+_hitR){
          let j=enemies.indexOf(e); if(j<0) continue; // live index for kill/splash bookkeeping below
          if(b.bulletKind==='grenade'){
            bounceGrenadeOffEnemy(b,e,bColor);
            break;
          }
          // Shield Bearer — front arc soaks ~70% of incoming bullet damage.
          // Bullets DON'T fully despawn anymore (user wants them to chip
          // through for chip damage); they continue through with a 0.30
          // damage multiplier and a "BLOCKED" floater so the player still
          // sees the shield doing something. Boomerangs, grenades, rockets
          // bypass entirely. Cone/beam weapons don't go through this code
          // path at all so they also ignore the shield.
          let _shieldChip = 1;
          if(e.type==='shieldBearer' && !b.bulletKind && !b.boomerang){
            const fx = Math.sin(e.mesh.rotation.y || 0);
            const fz = Math.cos(e.mesh.rotation.y || 0);
            const facing = -(b.dir.x*fx + b.dir.z*fz);
            if(facing > 0.20){
              _shieldChip = 0.30;
              burst(b.pos, 0x88bbff, isMobile?2:4);
              impactPulse(b.pos, 0xaaccff, 0.5, isMobile?2:4);
              dmgNum('BLOCKED', _scratchPos.set(b.pos.x,0,b.pos.z), '#aaccff');
              if(typeof sBarrierH==='function') sBarrierH();
            }
          }
          if(b.hitSet) b.hitSet.add(e);
          if(b.visualOnly){
            burst(b.pos,e.cfg.col,isMobile?2:5);
            if(b.explodeR) explodePlayerBullet(b,bColor,j);
            if(b.pierce>0) b.pierce--;
            else { releaseBullet(b); break; }
            continue;
          }
          // Apply per-bullet distance falloff (shotgun pellets). bullets
          // without falloff have falloffStart=0 so the multiplier is 1.
          let _falloffMult=1;
          if(b.falloffStart>0 && b.falloffEnd>b.falloffStart){
            const _d=Math.hypot(b.pos.x-b.fallOX, b.pos.z-b.fallOZ);
            if(_d<=b.falloffStart) _falloffMult=1;
            else if(_d>=b.falloffEnd) _falloffMult=b.falloffMin;
            else {
              const _t=(_d-b.falloffStart)/(b.falloffEnd-b.falloffStart);
              _falloffMult=1+(b.falloffMin-1)*_t;
            }
          }
          const _pierceMult=pierceFalloffMult(b.pierceHits||0);
          const _bDmgAdj=Math.max(1,Math.round(b.dmg*_falloffMult*_pierceMult*_shieldChip));
          if(b.ruptureCharging&&shotgunSalvos.charge(b.shotgunSalvo,Math.hypot(b.pos.x-b.fallOX,b.pos.z-b.fallOZ)<=3)){
            if(b.ownerId===mp.myId)ruptureCharge.hit();
            else if(mp.isHost){const conn=mp.conns.get(b.ownerId);if(conn?.open)conn.send(JSON.stringify({type:'RUPTURE_CHARGE',targetId:b.ownerId}));}
          }
          const shotgunHit=shotgunSalvos.hit(b.shotgunSalvo,e,b.ownerPerm?.shotgunFocus,b.ownerPerm?.shotgunImpact,Math.hypot(b.pos.x-b.fallOX,b.pos.z-b.fallOZ)<=3);
          const burstMult=burstSalvos.hit(b.burstSalvo,e,b.burstIndex,b.ownerPerm?.burstConvergence);
          if(b.triadCharging&&burstSalvos.charge(b.burstSalvo)){
            if(b.ownerId===mp.myId)celestialTriad.hit();
            else if(mp.isHost){const c=mp.conns.get(b.ownerId);if(c?.open)c.send(JSON.stringify({type:'TRIAD_CHARGE',targetId:b.ownerId}));}
          }
          const hitDmg=playerDamageAmount(e,Math.max(1,Math.round(_bDmgAdj*shotgunHit.damage*burstMult)),b.ownerPerm);
          if(shotgunHit.stagger){
            addEnemyStagger(e,shotgunHit.stagger);
            const distance=shotgunHit.push*enemyControlFactor(e),steps=Math.ceil(distance/.1);
            for(let n=0;n<steps;n++){
              e.pos.x+=b.dir.x*distance/steps;e.pos.z+=b.dir.z*distance/steps;
              clamp(e.pos,e.cfg.r);resolveObst(e.pos,e.cfg.r);
            }
          }
          pistolPrecision.finish(b.pistolShot,true);
          registerJudgmentHit(b);
          e.hp-=hitDmg; addEnemyStagger(e,0.08); e.hitFlashT=0.12;
          showHitNumber(e,hitDmg,cssHex(bColor),b.ownerId??mp.myId,'bullet');
          impactPulse(b.pos,bColor,0.65,isMobile?3:5);
          // Imbue Rounds — locally-owned bullet hits roll an element tag at a
          // level-scaled chance. Reaction-dmg is reduced at lv1 so spray
          // builds don't snowball; full at lv2. Random element each roll so
          // the player triggers different pairings without micro-managing.
          if(b.isPlayer && !b.visualOnly && (b.ownerId??mp.myId)===mp.myId && (playerSkills.imbueRounds||0)>0){
            const _irLvl=playerSkills.imbueRounds;
            const _irChance=[0,0,0,0.60,0.60,1.00][_irLvl]||0;
            if(_irChance>0 && Math.random()<_irChance){
              _imbuedReactionDmg=[1,1,1,0.65,0.65,1.00][_irLvl]||1;
              const elem=IMBUE_ELEMS[Math.floor(Math.random()*4)];
              tagElement(e, elem, hitDmg);
            }
          }
          // Round Surge: locally-owned bullet hits roll an extra shot toward
          // the same target. Tagged bullets (b._surgeRound) skip the roll to
          // prevent runaway chains. Chance scales with effective skill level.
          if(b.isPlayer && !b._surgeRound && (b.ownerId??mp.myId)===mp.myId && (playerSkills.roundSurge||0)>0){
            const surgeChance=[0,0.10,0.15,0.20,0.25,0.30][playerSkills.roundSurge]||0;
            if(surgeChance>0 && Math.random()<surgeChance){
              const sx=player.pos.x, sz=player.pos.z;
              const dxx=e.pos.x-sx, dzz=e.pos.z-sz;
              const dd=Math.hypot(dxx,dzz)||1;
              const surge=fireBullet({x:sx,z:sz},_scratchDir.set(dxx/dd,0,dzz/dd),true,b.dmg,b.pierce||0,false,b.ownerPerm,mp.myId,player?.gun||'pistol');
              if(surge&&typeof surge==='object') surge._surgeRound=true;
              else { for(const bb of bulletPool){ if(bb.active&&bb.isPlayer&&!bb._surgeRound&&bb.pos.x===sx&&bb.pos.z===sz){ bb._surgeRound=true; break; } } }
              sRoundSurge();
              burst(player.pos,0xffee44,isMobile?2:4);
            }
          }
          if(b.explodeR) explodePlayerBullet(b,bColor,j);
          b.pierceHits=(b.pierceHits||0)+1;
          // Explosive AoE — skip primary (j), adjust j for any lower-index kills
          const expLvl=playerSkills.explosive||0;
          if(expLvl>0&&!b.explodeR){
            const er=EXPLOSIVE_R[expLvl];
            const bx=b.pos.x, bz=b.pos.z;
            burst({x:bx,z:bz},0xff7700,isMobile?8:14);
            burst({x:bx,z:bz},0xffdd00,isMobile?5:9);
            spawnShockwave(bx,bz,er);
            shakeAmt=Math.max(shakeAmt,0.08+expLvl*0.04);
            muzzleLight.color.setHex(0xff6600); muzzleLight.intensity=7;
            for(let ej=enemies.length-1;ej>=0;ej--){
              if(ej===j) continue; // handled separately below
              const ee=enemies[ej]; if(ee.dead) continue;
              if(Math.hypot(bx-ee.pos.x,bz-ee.pos.z)<er){
                // Explosive splash inherits the same falloff factor as the
                // primary hit so shotgun-explosive combos don't sidestep the
                // distance penalty.
                const splashDmg=playerDamageAmount(ee,Math.max(1,Math.round(b.dmg*0.4*_falloffMult)),b.ownerPerm);
                ee.hp-=splashDmg; addEnemyStagger(ee,0.12); ee.hitFlashT=0.12;
                showHitNumber(ee,splashDmg,'#ff8800',b.ownerId??mp.myId,'bullet');
                if(ee.hp<=0){ killEnemy(ee); if(ej<j) j--; }
              }
            }
          }
          if(e.hp<=0){
            const liveIdx=enemies.indexOf(e);
            if(liveIdx>=0) killEnemy(liveIdx);
          }
          if(b.explodeR){ releaseBullet(b); break; }
          if(b.pierce>0){
            b.pierce--;
            // push bullet past enemy edge so it doesn't re-collide same enemy next frame
            const _hr=e.cfg.r+_hitR;
            const _pd=Math.hypot(b.pos.x-e.pos.x,b.pos.z-e.pos.z);
            const _push=_hr-_pd+0.15;
            if(_push>0){ b.pos.x+=b.dir.x*_push; b.pos.z+=b.dir.z*_push; }
          } else { releaseBullet(b); break; }
        }
      }
    } else {
      // Solo/host: local player hit
      // Enemy sniper rounds carry b.piercesAllies — they punch straight
      // through summons / drones / turrets to reach the player behind the
      // wall. Only the SAME summon shouldn't be re-hit, hence the hitSet.
      const summonHit=getSummonHitTarget(b.pos.x,b.pos.z,0.22);
      if(summonHit){
        if(b.piercesAllies){
          if(!b._summonHitSet) b._summonHitSet=new Set();
          // Use a stable id from the hit target so we skip THIS specific ally
          // on subsequent frames (the bullet stays inside its hit radius for
          // multiple frames otherwise).
          const _ak = summonHit.summonRef || summonHit.idx || summonHit;
          if(!b._summonHitSet.has(_ak)){
            dealDmgToTarget(summonHit,b.dmg);
            impactPulse(b.pos,0xff6600,0.5,2);
            b._summonHitSet.add(_ak);
          }
          // Don't release the bullet — keep traveling toward the player.
        } else {
          dealDmgToTarget(summonHit,b.dmg);
          impactPulse(b.pos,0xff6600,0.7,3);
          releaseBullet(b);
          continue;
        }
      }
      if((mp.soloMode||mp.isHost)&&isLivingPlayerState(player)&&player.invincible<=0&&Math.hypot(b.pos.x-player.pos.x,b.pos.z-player.pos.z)<0.72){
        hurtPlayer(b.dmg); impactPulse(b.pos,0xff6600,0.8,4); releaseBullet(b); continue;
      }
      // Host: check remote players
      if(mp.isHost&&!mp.soloMode){
        let hit=false;
        for(const sid in mp.remotePlayers){
          const rp=mp.remotePlayers[sid];
          if(!isLivingPlayerState(rp)) continue;
          if(Math.hypot(b.pos.x-rp.pos.x,b.pos.z-rp.pos.z)<0.72){
            const _bc=mp.conns.get(+sid); if(_bc&&_bc.open) _bc.send(JSON.stringify({type:'HURT',targetId:+sid,dmg:b.dmg}));
            releaseBullet(b); hit=true; break;
          }
        }
        if(hit) continue;
      }
    }
  }

  // ── Particles ──
  const _partDamp=Math.pow(0.82,dt*60); // frame-rate-independent damping, identical for every particle this frame
  for(let i=0;i<partPool.length;i++){
    const p=partPool[i]; if(!p.active) continue;
    p.life-=dt;
    if(p.life<=0){p.active=false;p.mesh.visible=false;continue;}
    p.mesh.position.x+=p.vx*dt; p.mesh.position.y+=p.vy*dt; p.mesh.position.z+=p.vz*dt;
    p.vx*=_partDamp; p.vz*=_partDamp;
    p.vy-=13*dt;
    p.mesh.rotation.x+=p.spinX*dt; p.mesh.rotation.y+=p.spinY*dt;
    const s=p.life/p.maxLife;
    const pop=Math.min(1,(1-s)*4);
    p.mesh.scale.setScalar(Math.max(0.01,s*(0.65+p.grow*pop)));
  }

  // ── Fireball orbital ──
  if(fireballMeshes.length&&!player.dead){
    const fbSpd=FIREBALL_SPD[playerSkills.fireball||0]*orbSpeedMult();
    fireballAngle+=dt*fbSpd;
    const angStep=Math.PI*2/fireballMeshes.length;
    const orbitR=orbOrbitRadius(now);
    for(let fi=0;fi<fireballMeshes.length;fi++){
      const ang=fireballAngle+fi*angStep;
      const fx2=player.pos.x+Math.cos(ang)*orbitR;
      const fz2=player.pos.z+Math.sin(ang)*orbitR;
      fireballMeshes[fi].position.set(fx2,0.55+Math.sin(now*0.006+fi)*0.22,fz2);
      updateTrail(fireballMeshes[fi].userData.trail,fx2,fireballMeshes[fi].position.y,fz2);
      fireballMeshes[fi].scale.setScalar((0.88+0.12*Math.sin(now*0.009+fi*1.3))*ORB_SIZE_SCL[playerSkills.orbSize||0]);
      if(fireballMeshes[fi].userData.aura) fireballMeshes[fi].userData.aura.material.opacity=0.18+0.14*Math.abs(Math.sin(now*0.016+fi));
      fireballMeshes[fi].rotation.y+=dt*3;
      { const _fd=fireballMeshes[fi].userData;
        if(_fd.ring)  _fd.ring.rotation.z+=dt*4.5;
        if(_fd.ring2) _fd.ring2.rotation.x+=dt*2.5;
        if(_fd.hot)   _fd.hot.material.opacity=0.50+0.22*Math.abs(Math.sin(now*0.02+fi)); }
      if(!isMobile&&Math.random()<0.06) burst({x:fx2,z:fz2},0xff4400,1);
      const _fbHR=0.3+ORB_SIZE_R[playerSkills.orbSize||0];
      for(let ei=enemies.length-1;ei>=0;ei--){
        const ee=enemies[ei]; if(ee.dead) continue;
        if(Math.hypot(fx2-ee.pos.x,fz2-ee.pos.z)<ee.cfg.r+_fbHR){
          const cdKey=ee.poolIdx*10+fi;
          if(!(fireballHitCd.get(cdKey)>0)){
            const fireOrbDmg=playerDamageAmount(ee,Math.round(55*atkScale()*ORB_PWR_MULT[playerSkills.orbPower||0]*orbDamageMult()));
            ee.hp-=fireOrbDmg; addEnemyStagger(ee,0.1); ee.hitFlashT=0.12;
            showHitNumber(ee,fireOrbDmg,'#ff5500',mp.myId,'orb');
            burst({x:fx2,z:fz2},0xff5500,6); impactPulse({x:fx2,z:fz2},0xff5500,0.75,3); sFireHitThrot();
            tagElement(ee,'fire',fireOrbDmg);
            if(ee.hp<=0) killEnemy(ee);
            fireballHitCd.set(cdKey,0.32);
          }
        }
      }
    }
    if(orbLights){let cx=0,cz=0;fireballMeshes.forEach(m=>{cx+=m.position.x;cz+=m.position.z;});orbLights.fireball.position.set(cx/fireballMeshes.length,1,cz/fireballMeshes.length);orbLights.fireball.intensity=0.9;}
    for(const [k,v] of fireballHitCd) fireballHitCd.set(k,v-dt);
  } else if(orbLights){ orbLights.fireball.intensity=0; }

  // ── Ice orb orbital ──
  if(iceOrbMeshes.length&&!player.dead){
    const spd=ORB_SPD[playerSkills.iceOrb||0]*orbSpeedMult();
    iceOrbAngle+=dt*spd;
    const step=Math.PI*2/iceOrbMeshes.length;
    const orbitR=orbOrbitRadius(now);
    for(let fi=0;fi<iceOrbMeshes.length;fi++){
      const ang=iceOrbAngle+fi*step;
      const ox=player.pos.x+Math.cos(ang)*orbitR, oz=player.pos.z+Math.sin(ang)*orbitR;
      iceOrbMeshes[fi].position.set(ox,0.55+Math.sin(now*0.006+fi+1)*0.22,oz);
      updateTrail(iceOrbMeshes[fi].userData.trail,ox,iceOrbMeshes[fi].position.y,oz);
      iceOrbMeshes[fi].scale.setScalar((0.9+0.10*Math.sin(now*0.007+fi*2.1))*ORB_SIZE_SCL[playerSkills.orbSize||0]);
      if(iceOrbMeshes[fi].userData.aura) iceOrbMeshes[fi].userData.aura.material.opacity=0.16+0.12*Math.abs(Math.sin(now*0.013+fi));
      iceOrbMeshes[fi].rotation.x+=dt*2; iceOrbMeshes[fi].rotation.z+=dt*1.5;
      { const _id=iceOrbMeshes[fi].userData;
        if(_id.ring)  _id.ring.rotation.y+=dt*3.0;
        if(_id.ring2) _id.ring2.rotation.z+=dt*-2.2;
        if(_id.inner) _id.inner.rotation.x+=dt*-4; }
      const _ioHR=0.3+ORB_SIZE_R[playerSkills.orbSize||0];
      for(let ei=enemies.length-1;ei>=0;ei--){
        const ee=enemies[ei]; if(ee.dead) continue;
        if(Math.hypot(ox-ee.pos.x,oz-ee.pos.z)<ee.cfg.r+_ioHR){
          const ck=ee.poolIdx*10+fi;
          if(!(iceHitCd.get(ck)>0)){
            const iceOrbDmg=playerDamageAmount(ee,Math.round(30*atkScale()*ORB_PWR_MULT[playerSkills.orbPower||0]*orbDamageMult()));
            ee.hp-=iceOrbDmg; addEnemyStagger(ee,0.08); ee.hitFlashT=0.12;
            showHitNumber(ee,iceOrbDmg,'#88ddff',mp.myId,'orb');
            applyEnemySlow(ee,2.5);
            burst({x:ox,z:oz},0x88ddff,6); impactPulse({x:ox,z:oz},0x88ddff,0.65,3); sIceHitThrot();
            tagElement(ee,'ice',iceOrbDmg);
            if(ee.hp<=0) killEnemy(ee);
            iceHitCd.set(ck,0.40);
          }
        }
      }
    }
    if(orbLights){let cx=0,cz=0;iceOrbMeshes.forEach(m=>{cx+=m.position.x;cz+=m.position.z;});orbLights.iceOrb.position.set(cx/iceOrbMeshes.length,1,cz/iceOrbMeshes.length);orbLights.iceOrb.intensity=0.75;}
    for(const [k,v] of iceHitCd) iceHitCd.set(k,v-dt);
  } else if(orbLights){ orbLights.iceOrb.intensity=0; }

  // ── Thunder orb orbital ──
  if(thunderOrbMeshes.length&&!player.dead){
    const spd=ORB_SPD[playerSkills.thunderOrb||0]*orbSpeedMult();
    thunderOrbAngle+=dt*spd;
    const step=Math.PI*2/thunderOrbMeshes.length;
    const orbitR=orbOrbitRadius(now);
    for(let fi=0;fi<thunderOrbMeshes.length;fi++){
      const ang=thunderOrbAngle+fi*step;
      const ox=player.pos.x+Math.cos(ang)*orbitR, oz=player.pos.z+Math.sin(ang)*orbitR;
      thunderOrbMeshes[fi].position.set(ox,0.55+Math.sin(now*0.006+fi+2)*0.22,oz);
      updateTrail(thunderOrbMeshes[fi].userData.trail,ox,thunderOrbMeshes[fi].position.y,oz);
      thunderOrbMeshes[fi].scale.setScalar((0.85+0.15*Math.abs(Math.sin(now*0.012+fi)))*ORB_SIZE_SCL[playerSkills.orbSize||0]);
      if(thunderOrbMeshes[fi].userData.aura) thunderOrbMeshes[fi].userData.aura.material.opacity=0.22+0.20*Math.abs(Math.sin(now*0.027+fi));
      thunderOrbMeshes[fi].rotation.y+=dt*5; thunderOrbMeshes[fi].rotation.x+=dt*3;
      { const _td=thunderOrbMeshes[fi].userData;
        if(_td.ring)  _td.ring.rotation.z+=dt*6.0;
        if(_td.ring2) _td.ring2.rotation.x+=dt*4.0;
        if(_td.inner){ _td.inner.rotation.y+=dt*-7; _td.inner.material.opacity=0.50+0.28*Math.abs(Math.sin(now*0.03+fi)); } }
      const _toHR=0.3+ORB_SIZE_R[playerSkills.orbSize||0];
      for(let ei=enemies.length-1;ei>=0;ei--){
        const ee=enemies[ei]; if(ee.dead) continue;
        if(Math.hypot(ox-ee.pos.x,oz-ee.pos.z)<ee.cfg.r+_toHR){
          const ck=ee.poolIdx*10+fi;
          if(!(thunderHitCd.get(ck)>0)){
            const thunderOrbDmg=playerDamageAmount(ee,Math.round(65*atkScale()*ORB_PWR_MULT[playerSkills.orbPower||0]*orbDamageMult()));
            ee.hp-=thunderOrbDmg; addEnemyStagger(ee,0.5); ee.hitFlashT=0.12;
            showHitNumber(ee,thunderOrbDmg,'#ffff44',mp.myId,'orb');
            burst({x:ox,z:oz},0xffff44,7); spawnZapLine(ox,oz,ee.pos.x,ee.pos.z); sThunHitThrot();
            tagElement(ee,'thunder',thunderOrbDmg);
            if(ee.hp<=0) killEnemy(ee);
            thunderHitCd.set(ck,0.42);
          }
        }
      }
    }
    if(orbLights){let cx=0,cz=0;thunderOrbMeshes.forEach(m=>{cx+=m.position.x;cz+=m.position.z;});orbLights.thunderOrb.position.set(cx/thunderOrbMeshes.length,1,cz/thunderOrbMeshes.length);orbLights.thunderOrb.intensity=0.9;}
    for(const [k,v] of thunderHitCd) thunderHitCd.set(k,v-dt);
  } else if(orbLights){ orbLights.thunderOrb.intensity=0; }

  // ── Poison orb orbital ──
  if(poisonOrbMeshes.length&&!player.dead){
    const spd=ORB_SPD[playerSkills.poisonOrb||0]*orbSpeedMult();
    poisonOrbAngle+=dt*spd;
    const step=Math.PI*2/poisonOrbMeshes.length;
    const orbitR=orbOrbitRadius(now);
    for(let fi=0;fi<poisonOrbMeshes.length;fi++){
      const ang=poisonOrbAngle+fi*step;
      const ox=player.pos.x+Math.cos(ang)*orbitR, oz=player.pos.z+Math.sin(ang)*orbitR;
      poisonOrbMeshes[fi].position.set(ox,0.55+Math.sin(now*0.006+fi+3)*0.22,oz);
      updateTrail(poisonOrbMeshes[fi].userData.trail,ox,poisonOrbMeshes[fi].position.y,oz);
      poisonOrbMeshes[fi].scale.setScalar((0.82+0.18*Math.sin(now*0.005+fi*2.5))*ORB_SIZE_SCL[playerSkills.orbSize||0]);
      if(poisonOrbMeshes[fi].userData.aura) poisonOrbMeshes[fi].userData.aura.material.opacity=0.14+0.16*Math.abs(Math.sin(now*0.01+fi));
      poisonOrbMeshes[fi].rotation.y+=dt*2.5;
      { const _pd=poisonOrbMeshes[fi].userData;
        if(_pd.ring)    _pd.ring.rotation.x+=dt*1.8;
        if(_pd.ring2)   _pd.ring2.rotation.z+=dt*-1.4;
        if(_pd.nucleus) _pd.nucleus.rotation.y+=dt*5; }
      if(!isMobile&&Math.random()<0.04) burst({x:ox,z:oz},0x33cc22,1);
      const _poHR=0.3+ORB_SIZE_R[playerSkills.orbSize||0];
      for(let ei=enemies.length-1;ei>=0;ei--){
        const ee=enemies[ei]; if(ee.dead) continue;
        if(Math.hypot(ox-ee.pos.x,oz-ee.pos.z)<ee.cfg.r+_poHR){
          const ck=ee.poolIdx*10+fi;
          if(!(poisonHitCd.get(ck)>0)){
            const poisonOrbDmg=playerDamageAmount(ee,Math.round(18*atkScale()*ORB_PWR_MULT[playerSkills.orbPower||0]*orbDamageMult()));
            ee.hp-=poisonOrbDmg; ee.hitFlashT=0.12; showHitNumber(ee,poisonOrbDmg,'#55ee44',mp.myId,'orb'); burst({x:ox,z:oz},0x55ee44,6); spawnShockwave(ox,oz,0.62,0x55ee44,0.16,0.55); sPoisHitThrot();
            if(!poisonMap.has(ee.poolIdx)) poisonMap.set(ee.poolIdx,{t:3,tick:0,dmg:Math.round(18*atkScale()*ORB_PWR_MULT[playerSkills.orbPower||0]*orbDamageMult())});
            else { const p=poisonMap.get(ee.poolIdx); p.t=3; }
            tagElement(ee,'poison',poisonOrbDmg);
            if(ee.hp<=0) killEnemy(ee);
            poisonHitCd.set(ck,0.60);
          }
        }
      }
    }
    if(orbLights){let cx=0,cz=0;poisonOrbMeshes.forEach(m=>{cx+=m.position.x;cz+=m.position.z;});orbLights.poisonOrb.position.set(cx/poisonOrbMeshes.length,1,cz/poisonOrbMeshes.length);orbLights.poisonOrb.intensity=0.7;}
    for(const [k,v] of poisonHitCd) poisonHitCd.set(k,v-dt);
  } else if(orbLights){ orbLights.poisonOrb.intensity=0; }

  // Reactions also apply poison without a poison orb equipped.
  if(!player.dead){
    for(const [pidx,pt] of poisonMap){
      pt.t-=dt; pt.tick-=dt;
      if(pt.tick<=0){
        pt.tick=0.5;
        const ei=enemies.findIndex(e=>e.poolIdx===pidx&&!e.dead);
        if(ei!==-1){ enemies[ei].hp-=pt.dmg; enemies[ei].hitFlashT=0.08; showHitNumber(enemies[ei],pt.dmg,'#55ee44',mp.myId,'orb'); burst(enemies[ei].pos,0x55ee44,3); if(enemies[ei].hp<=0) killEnemy(ei); }
      }
      if(pt.t<=0) poisonMap.delete(pidx);
    }
  }

  // ── Dash ghost afterimage ──
  for(const g of ghostPool){
    if(!g.visible) continue;
    g.userData.t-=dt;
    if(g.userData.t<=0){ g.visible=false; g.userData.bMat.opacity=0; g.userData.hMat.opacity=0; continue; }
    const fade=g.userData.t/g.userData.dur;
    g.userData.bMat.opacity=0.50*fade;
    g.userData.hMat.opacity=0.46*fade;
  }
  updateAfterimageZones(dt);
  updateHealBags(dt);
  updateBuffDrops(dt);
  updateRunShopRound(dt, now);
  updateWaveTotemWorld(dt, now);

  // ── Chain lightning ──
  const ltLvl=playerSkills.lightning||0;
  if(ltLvl&&!player.dead){
    lightningT-=dt;
    if(lightningT<=0){
      const _shLvl=playerSkills.spellHaste||0;
      lightningT=LIGHTNING_INTERVAL[ltLvl]*SPELL_CD_MULT[_shLvl];
      const targets=LIGHTNING_TARGETS[ltLvl];
      const spellPwr=SPELL_PWR_MULT[playerSkills.spellPower||0];
      const ltDmg=Math.round(LIGHTNING_DMG[ltLvl]*spellPwr*atkScale());
      const sorted=[...enemies].filter(e=>!e.dead)
        .sort((a,b)=>Math.hypot(a.pos.x-player.pos.x,a.pos.z-player.pos.z)-Math.hypot(b.pos.x-player.pos.x,b.pos.z-player.pos.z))
        .slice(0,targets);
      for(const te of sorted){
        const ei=enemies.indexOf(te); if(ei===-1) continue;
        const zapDmg=playerDamageAmount(te,ltDmg);
        te.hp-=zapDmg; addEnemyStagger(te,0.12); te.hitFlashT=0.12;
        burst(te.pos,0x44aaff,isMobile?6:12);
        burst(te.pos,0xffffff,isMobile?3:6);
        spawnZapLine(player.pos.x,player.pos.z,te.pos.x,te.pos.z);
        showHitNumber(te,zapDmg,'#44aaff',mp.myId,'spell');
        sLightH();
        tagElement(te,'thunder',zapDmg);
        if(te.hp<=0) killEnemy(te);
      }
      if(sorted.length>0) triggerArchmageLoop('lightning');
    }
    const _ltEl=document.getElementById('lightningCdFill');
    if(_ltEl) _ltEl.style.width=(1-Math.max(0,lightningT)/(LIGHTNING_INTERVAL[ltLvl]*SPELL_CD_MULT[playerSkills.spellHaste||0]))*100+'%';
  }

  // ── Level clear / exit ──
  updateMiniObjective(dt, now);
  updateLinkerVisuals();
  // Wave event tick: bounty pass/fail evaluation + banner refresh.
  evaluateBountyTick();
  tickMeteorStormChallenge(dt);
  if(waveEvent && (now-(_lastBannerTick||0))>180){ _lastBannerTick=now; renderWaveEventBanner(); }

  if(gState==='playing'&&waveSpawned&&!waveTransition&&enemies.length===0&&!waveClear&&!miniObjectiveBlocksWaveClear()){
    if(miniObjective&&miniObjective.type!=='spawners') disposeMiniObjective();
    waveClear=true;
    resetExitReady();
    awardGunKeysForWave(waveNum);
    reviveTeamForWaveClear();
    // Steady Pulse — flat HP heal on every wave clear.
    {
      const _spLvl=playerSkills.steadyPulse||0;
      if(_spLvl){
        const _spHp=[0,5,10,15,20,25][_spLvl]||0;
        if(_spHp>0 && !player.dead && !regenSourcesBlocked()){
          const gained=healPlayer(_spHp);
          if(gained){
            dmgNum('+'+gained+' HP',player.pos,'#ff88aa');
            // Green restore pulse so the wave-clear heal reads, not just a number.
            spawnSkillRingAura(player.pos.x,player.pos.z,1.7,0x66ffaa,0.42,0.5);
            burst(player.pos,0x66ffaa,isMobile?4:8);
          }
        }
      }
    }
    if(mp.connected&&!mp.soloMode&&mp.isHost){
      // Show the wave summary on every wave clear, including the pre-shop wave.
      const snap=contributionSnapshot();
      showContributionPanel(snap,waveNum);
      broadcastMP({type:'CONTRIB_SNAPSHOT',wave:waveNum,stats:snap});
    }
    if(_bossClearPending){
      _bossClearPending=false; _firstSkillPickDone=false;
      document.getElementById('bossBar').style.display='none';
      annText('★ BOSS SLAIN!','#ffd700');
      sWaveEnd(); // boss victory fanfare on the kill, not after the cards
      musicStart(waveNum,false);
      tickCurseHpOnWaveClear();
      applyBossPlateReward();
      queueBossReward();
    } else {
      openExit();
      rollWaveTotemAfterClear();
    }
  }
  // Client-only boss-reward trigger. KILL_ENEMY for the boss arrives in the
  // same network frame as HOST_STATE setting waveClear=true, so by the time
  // the main loop runs both flags are set and the !waveClear gate above
  // skips the boss-reward branch. Without this catch-up block, the boss
  // card slate slips to the next wave-clear cycle (the user-reported
  // "epic card only appears after wave 6" bug).
  if(gState==='playing'&&!mp.isHost&&mp.connected&&_bossClearPending&&enemies.length===0&&!miniObjectiveBlocksWaveClear()){
    _bossClearPending=false; _firstSkillPickDone=false;
    document.getElementById('bossBar').style.display='none';
    annText('★ BOSS SLAIN!','#ffd700');
    sWaveEnd(); // boss victory fanfare on the kill (client)
    musicStart(waveNum,false);
    tickCurseHpOnWaveClear();
    applyBossPlateReward();
    queueBossReward();
  }
  if(gState==='playing'&&waveClear&&exitOpen&&!player.dead){
    if(exitMesh) exitMesh.rotation.z += dt*2;
    refreshExitLabel();
    if(mp.exitReady[mp.myId]) updateExitReadyPrompt();
    else document.getElementById('exitArrow').style.display=
      Math.hypot(player.pos.x,player.pos.z-EXIT_Z)>5?'block':'none';
    if(Math.hypot(player.pos.x, player.pos.z-EXIT_Z) < 2.0){
      requestExitTransition('wave');
    }
  }

  // ── Spell balls (Nova energy balls) ──
  if(gState==='playing'){
    for(let i=0;i<spellBalls.length;i++){
      const s=spellBalls[i]; if(!s.active) continue;
      s.life-=dt;
      s.mesh.position.x+=s.vx*dt; s.mesh.position.z+=s.vz*dt;
      s.mesh.rotation.y+=dt*8; s.mesh.rotation.x+=dt*4;
      s.mesh.scale.setScalar(0.95+0.14*Math.sin(now*0.018+i));
      s.auraMat.opacity=0.18+0.16*Math.abs(Math.sin(now*0.021+i));
      const sx=s.mesh.position.x, sz=s.mesh.position.z;
      if(s.life<=0||Math.abs(sx)>ARENA_W+1||sz<-(ARENA_H+1)||sz>ARENA_H+1){s.active=false;s.mesh.visible=false;clearTrail(s.trail);continue;}
      updateTrail(s.trail,sx,s.mesh.position.y,sz);
      for(let j=enemies.length-1;j>=0;j--){
        const e=enemies[j]; if(e.dead||s.hitSet.has(e.poolIdx)) continue;
        if(Math.hypot(sx-e.pos.x,sz-e.pos.z)<e.cfg.r+0.3){
          s.hitSet.add(e.poolIdx);
          const spellDmg=playerDamageAmount(e,s.dmg);
          e.hp-=spellDmg; addEnemyStagger(e,0.18); e.hitFlashT=0.12;
          burst({x:sx,z:sz},0xcc33ff,isMobile?4:7);
          impactPulse({x:sx,z:sz},0xcc33ff,0.9,isMobile?3:6);
          showHitNumber(e,spellDmg,'#cc33ff',mp.myId,'spell');
          if(e.hp<=0) killEnemy(e);
        }
      }
      // Spell ball hits spawner once when it sweeps over.
      if(miniObjective?.type==='spawners' && !miniObjective.complete){
        for(let k=0;k<(miniObjective.spawners||[]).length;k++){
          const sp=miniObjective.spawners[k]; if(!sp.alive) continue;
          const key='sp'+k;
          if(s.hitSet.has(key)) continue;
          if(Math.hypot(sx-sp.x,sz-sp.z)<0.9){
            s.hitSet.add(key);
            damageMiniObjectiveAt(sp.x,sp.z,s.dmg,0.9,0xcc33ff);
          }
        }
      }
    }
    // ── Damage rings (Fire Ring spell) ──
    for(let i=damageRings.length-1;i>=0;i--){
      const dr=damageRings[i]; dr.t+=dt;
      const p=Math.min(dr.t/dr.dur,1);
      const curR=dr.maxR*p;
      dr.mesh.scale.setScalar(curR||0.001);
      dr.mesh.rotation.z+=dt*1.4;
      dr.mat.opacity=0.96*(1-p*0.72);
      if(dr.glowMesh){
        dr.glowMesh.scale.setScalar((curR||0.001)*(1+0.06*Math.sin(now*0.03)));
        dr.glowMesh.rotation.z-=dt*0.9;
        dr.glowMat.opacity=0.28*(1-p);
      }
      for(let j=enemies.length-1;j>=0;j--){
        const e=enemies[j]; if(e.dead||dr.hitSet.has(j)) continue;
        const dist=Math.hypot(dr.mesh.position.x-e.pos.x,dr.mesh.position.z-e.pos.z);
        if(dist<=curR&&dist>dr.prevR-0.5){
          dr.hitSet.add(j);
          const ringDmg=playerDamageAmount(e,dr.dmg);
          e.hp-=ringDmg; addEnemyStagger(e,0.1); e.hitFlashT=0.12;
          showHitNumber(e,ringDmg,'#ff8800',mp.myId,'spell');
          burst({x:e.pos.x,z:e.pos.z},0xff5500,4);
          tagElement(e,'fire',ringDmg);
          if(e.hp<=0) killEnemy(e);
        }
      }
      // Fire ring sweeps the spawner — one hit per ring per spawner.
      if(miniObjective?.type==='spawners' && !miniObjective.complete){
        if(!dr.spawnerHit) dr.spawnerHit=new Set();
        for(let k=0;k<(miniObjective.spawners||[]).length;k++){
          const sp=miniObjective.spawners[k]; if(!sp.alive||dr.spawnerHit.has(k)) continue;
          const d=Math.hypot(dr.mesh.position.x-sp.x,dr.mesh.position.z-sp.z);
          if(d<=curR && d>dr.prevR-0.5){
            dr.spawnerHit.add(k);
            damageMiniObjectiveAt(sp.x,sp.z,dr.dmg,0.5,0xff5500);
          }
        }
      }
      dr.prevR=curR;
      if(dr.t>=dr.dur){ _releaseDamageRingSlot(dr); damageRings.splice(i,1); }
    }
    // ── Homing bombs ──
    for(let i=homingBombs.length-1;i>=0;i--){
      const hb=homingBombs[i]; hb.life-=dt;
      let tgtX=hb.pos.x, tgtZ=hb.pos.z, bestDist=999;
      for(const e of enemies){ if(e.dead) continue; const d=Math.hypot(hb.pos.x-e.pos.x,hb.pos.z-e.pos.z); if(d<bestDist){bestDist=d;tgtX=e.pos.x;tgtZ=e.pos.z;} }
      const hdx=tgtX-hb.pos.x, hdz=tgtZ-hb.pos.z, hd=Math.hypot(hdx,hdz)||1;
      const hspd=10;
      hb.vx+=(hdx/hd*hspd-hb.vx)*dt*6;
      hb.vz+=(hdz/hd*hspd-hb.vz)*dt*6;
      hb.pos.x+=hb.vx*dt; hb.pos.z+=hb.vz*dt;
      hb.mesh.position.set(hb.pos.x,0.5,hb.pos.z);
      updateTrail(hb.trail,hb.pos.x,0.5,hb.pos.z);
      // Rotate visually
      hb.mesh.rotation.y+=dt*8;
      hb.mesh.rotation.x+=dt*5;
      if(hb.mesh.children[0]) hb.mesh.children[0].material.opacity=0.18+0.16*Math.abs(Math.sin(now*0.018+i));
      let exploded=false;
      for(let j=enemies.length-1;j>=0;j--){
        const e=enemies[j]; if(!e||e.dead) continue;
        if(Math.hypot(hb.pos.x-e.pos.x,hb.pos.z-e.pos.z)<e.cfg.r+0.25){
          burst(hb.pos,0xff3300,isMobile?8:14); burst(hb.pos,0xff9900,isMobile?5:8);
          spawnShockwave(hb.pos.x,hb.pos.z,hb.explR);
          flashLight(hb.pos,0xff6600,7.5,9,0.24);
          shakeAmt=Math.max(shakeAmt,0.18);
          for(let ej=enemies.length-1;ej>=0;ej--){
            const ee=enemies[ej]; if(ee.dead) continue;
            if(Math.hypot(hb.pos.x-ee.pos.x,hb.pos.z-ee.pos.z)<hb.explR){
              const bombDmg=playerDamageAmount(ee,hb.dmg);
              ee.hp-=bombDmg; addEnemyStagger(ee,0.15); ee.hitFlashT=0.12;
              showHitNumber(ee,bombDmg,'#ff4400',mp.myId,'spell');
              if(ee.hp<=0) killEnemy(ee);
            }
          }
          exploded=true; break;
        }
      }
      if(exploded||hb.life<=0){
        if(hb.life<=0){burst(hb.pos,0xff3300,6);spawnShockwave(hb.pos.x,hb.pos.z,hb.explR*0.4);}
        _releaseHomingBombSlot(hb); homingBombs.splice(i,1);
      }
    }
  }
  // ── Shockwave rings ──
  for(let i=shockwaves.length-1;i>=0;i--){
    const sw=shockwaves[i]; sw.t+=dt;
    const p=Math.min(sw.t/sw.dur,1);
    sw.mesh.scale.setScalar(sw.maxR*(0.12+0.88*p));
    sw.mesh.rotation.z+=sw.spin*dt;
    sw.mat.opacity=(sw.opacity||0.9)*(1-p);
    if(sw.t>=sw.dur){ _releaseShockwaveSlot(sw); shockwaves.splice(i,1); }
  }
  for(let i=slashVfx.length-1;i>=0;i--){
    const s=slashVfx[i]; s.t+=dt;
    const p=Math.min(1,s.t/s.dur);
    if(s.extend){
      // Cylinder anchored at the player end, oriented toward destination. Y
      // is scaled from 0 → fullLen over growDur for the "growing slash"
      // feel; XZ stays at 1 so the cross-section stays a fixed thickness.
      const growT=Math.min(1, s.t / (s.growDur||0.10));
      // Easing — quick out so the cut feels snappy, not draggy.
      const eased=1 - Math.pow(1-growT, 2.6);
      s.mesh.scale.set(s.scaleXZ||1, Math.max(0.0001, s.fullLen*eased), s.scaleXZ||1);
    } else if(s.elastic){
      // Hook rope: stretch lengthwise on impact, snap-back twang. We scale the
      // rope axially using its world bounding (TubeGeometry is along curve), so
      // a uniform scale plus a sin oscillation on Y reads as elastic recoil.
      const wobble=1+Math.sin(p*Math.PI*3)*0.10*(1-p);
      s.mesh.scale.set(wobble,1+Math.sin(p*Math.PI*5)*0.18*(1-p),wobble);
    } else {
      s.mesh.scale.setScalar(0.64+p*0.68);
    }
    // Don't rotate `extend` streaks — their orientation is set by quaternion
    // at spawn (the slash direction) and applying rotation.z on top would
    // tilt the cylinder mid-grow.
    if(!s.extend) s.mesh.rotation.z=s.baseRot+s.spin*s.t;
    s.mat.opacity=s.opacity*Math.pow(1-p,1.35);
    if(s.t>=s.dur){
      scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mat.dispose(); slashVfx.splice(i,1);
    }
  }
  // Hook flight projectiles — move toward their anchor and fire onLand when
  // they arrive. Runs in the same VFX block so it shares the slash dt.
  updateFlyingHooks(dt);
  updateSkillVfx(dt);
  // Traveling blade-wave projectiles (bladeWave epic skill). Lives here so
  // it advances during 'playing' / 'shopround' state and shares the dt.
  updateBladeWaves(dt);

  // ── Streak decay ──
  for(const v of vfxLights){
    if(v.t<=0) continue;
    v.t-=dt;
    const p=Math.max(0,v.t/v.dur);
    v.light.intensity=v.intensity*p*p;
    if(v.t<=0) v.light.intensity=0;
  }

  if(streakT>0){
    streakT-=dt;
    if(streakT<=0){streak=0;const sd=document.getElementById('streakD');if(sd){sd.textContent='';sd.classList.remove('combo-pop');sd.style.fontSize='';sd.style.color='';}}
  }

  // ── Camera (scrolling, follows player Z) ──
  shakeAmt*=Math.pow(0.75,dt*60);
  const shk=(Math.random()-0.5)*shakeAmt;
  const tgtCamX=player.pos.x*0.3+shk;
  const tgtCamZ=player.pos.z+CAM_Z_OFF;
  camera.position.x+=(tgtCamX-camera.position.x)*0.07;
  camera.position.y+=(CAM_Y-camera.position.y)*0.07;
  camera.position.z+=(tgtCamZ-camera.position.z)*0.07;
  camLook.set(tgtCamX,0,player.pos.z+shk*0.3); camera.lookAt(camLook);

  // ── HUD throttle ──
  if(++hudThrottle>=3){ hudThrottle=0; updateHUD(); }

  // ── Remote players ──
  for(const [sid,rp] of Object.entries(mp.remotePlayers)){
    if(!rp.mesh) continue;
    if(rp.dead&&!rp.downed){ rp.mesh.visible=false; clearMoveTrailVisual(rp); continue; }
    rp.mesh.visible=true;
    if(!rp.hasState){rp.renderPos.copy(rp.pos); rp.renderRot=rp.rot||0; rp.hasState=true;}
    smoothNetPos(rp.renderPos,rp.pos,dt,MP_REMOTE_SMOOTH,6);
    rp.renderRot=angleLerp(rp.renderRot,rp.rot||0,1-Math.exp(-MP_REMOTE_SMOOTH*dt));
    const downPulse=rp.downed?Math.sin(now*0.012+rp.hp):0;
    rp.mesh.position.set(rp.renderPos.x,rp.downed?0.28+downPulse*0.03:0.55+Math.sin(now*0.009+rp.hp)*0.055,rp.renderPos.z);
    updateMoveTrail(rp,+sid,rp.renderPos.x,rp.renderPos.z,Math.hypot(rp.renderPos.x-(rp._trailX??rp.renderPos.x),rp.renderPos.z-(rp._trailZ??rp.renderPos.z)),dt);
    rp._trailX=rp.renderPos.x; rp._trailZ=rp.renderPos.z;
    rp.mesh.rotation.y=rp.renderRot;
    rp.mesh.rotation.z=rp.downed?Math.sin(now*0.006+rp.hp)*0.18:0;
    rp.mesh.scale.setScalar(rp.downed?0.72+downPulse*0.04:1);
  }

  // ── MP state sync (20fps) ──
  updatePlayerNameTags();
  updateReloadTag();
  updateReviveZones();
  updateRemoteSkillVisuals(dt, now);
  if(!mp.soloMode){
    mp.syncT+=dt;
    if(mp.syncT>=MP_PLAYER_SYNC_DT){
      mp.syncT=0;
      sendPlayerState();
    }
    if(mp.isHost){
      mp.hostSyncT+=dt;
      if(mp.hostSyncT>=MP_HOST_SYNC_DT){
        mp.hostSyncT=0;
        sendHostState();
      }
    }
  }
}

function menuOrbit(){
  const t=Date.now()*0.00045;
  camera.position.x=Math.cos(t)*20;
  camera.position.z=Math.sin(t)*20;
  camera.position.y=19+Math.sin(t*0.7)*3;
  camera.lookAt(0,0,0);
}

// ── Game loop ─────────────────────────────────────────────
// Driven by PixoTick (rAF when visible, Web Worker when hidden) so the
// multiplayer simulation keeps ticking in a backgrounded tab.
let lastNow=performance.now();
let _mobileCtlShown=null; // tracks mobile control visibility so we only write on change
// Canvas bounding rect. Name tags, the reload tag, mouse projection and damage numbers all read it, so
// caching it removed ~5 layout reflows a frame -- but refreshing it at the top of every frame left one,
// and that one is the expensive kind: the HUD writes to the DOM during the frame, so the next frame's
// read has to flush the layout those writes invalidated. The rect only moves when the window does.
let _canvasRect=null;
function refreshCanvasRect(){_canvasRect=canvas.getBoundingClientRect();}
addEventListener('resize',()=>{_canvasRect=null;});
addEventListener('scroll',()=>{_canvasRect=null;},{passive:true});
addEventListener('orientationchange',()=>{_canvasRect=null;});
function loop(now){
  if(sceneView.contextLost && mp.soloMode){lastNow=now;resetGameplayInput();return;}
  resetFrameVfxBudget();
  if(!_canvasRect)refreshCanvasRect();
  const rdt=Math.min((now-lastNow)/1000, 0.05); lastNow=now;
  // Hit-stop: while frozen (solo only) the gameplay sim runs at 12% speed for a
  // punchy beat; the freeze timer + networking stay on real time.
  if(_hitStopT>0) _hitStopT-=rdt;
  const dt=(mp.soloMode&&_hitStopT>0)?rdt*0.12:rdt;
  if(!realIsMobile) updateMouseWorld();
  if((gState==='playing'||gState==='shopround') && !(nbPaused&&mp.soloMode)) update(dt);
  else if(gState==='menu'||gState==='gameover') menuOrbit();
  // Show the on-screen joystick / dash / spell buttons only during gameplay so
  // they never overlap (and block taps on) menu, difficulty, gun-select, shop
  // or game-over screens on mobile.
  if(realIsMobile){
    const _pc = gState==='playing';
    if(_mobileCtlShown!==_pc){
      _mobileCtlShown=_pc;
      const _d=_pc?'flex':'none';
      if(jL) jL.style.display=_d;
      if(jR) jR.style.display=_d;
      const _db=document.getElementById('dashBtn'); if(_db) _db.style.display=_d;
      if(!_pc){ const _sb=document.getElementById('spellBtn'); if(_sb) _sb.style.display='none'; }
    }
  }
  updateAimTrace();
  updateGravityChargeHud();
  updatePistolJudgmentHud();
  updateRuptureHud();
  updateSteelStormHud();
  updateTriadHud();
  updateSupernovaHud();
  updateMultiplayerPresence(rdt);
  if(gState!=='playing'&&gState!=='shopround'){ updatePlayerNameTags(); updateReloadTag(); }
  sceneView.render();
}

// ── Persistent upgrade shop ───────────────────────────────
let _shopReturnId='menu';
let _gunChestOpening=false;
let _gunChestResult='';
function openShop(returnId='menu'){
  _shopReturnId=returnId;
  document.getElementById(returnId).style.display='none';
  document.getElementById('upgradeShop').style.display='flex';
  renderShop();
}
function closeShop(){
  document.getElementById('upgradeShop').style.display='none';
  document.getElementById(_shopReturnId).style.display='flex';
}
function availableGunChestRarities(){
  return Object.entries(GUN_CHEST_RARITIES).map(([key,r])=>({
    key,
    def:r,
    ids:r.ids.filter(id=>GUNS[id]&&!isGunOwned(id)),
  })).filter(r=>r.ids.length);
}
function rollGunChestId(){
  const available=availableGunChestRarities();
  if(!available.length) return null;
  const total=available.reduce((sum,r)=>sum+r.def.weight,0);
  let roll=Math.random()*total;
  let picked=available[available.length-1];
  for(const r of available){
    roll-=r.def.weight;
    if(roll<=0){ picked=r; break; }
  }
  const ids=picked.ids;
  return { id:ids[Math.floor(Math.random()*ids.length)], rarity:picked.key };
}
function openGunChest(){
  if(_gunChestOpening) return;
  if((persistData.gunKeys||0)<=0) return;
  const prize=rollGunChestId();
  if(!prize){ _gunChestResult='ALL GUNS UNLOCKED'; renderShop(); return; }
  _gunChestOpening=true;
  _gunChestResult='OPENING...';
  renderShop();
  setTimeout(()=>{
    const gun=GUNS[prize.id];
    const rarity=GUN_CHEST_RARITIES[prize.rarity]||GUN_CHEST_RARITIES.common;
    persistData.gunKeys=Math.max(0,(persistData.gunKeys||0)-1);
    persistData.guns={...DEFAULT_PERSIST.guns,...(persistData.guns||{})};
    persistData.guns[prize.id]=true;
    _gunChestResult=`UNLOCKED ${rarity.label}: ${gun.name}`;
    _gunChestOpening=false;
    _savePD();
    renderShop();
  },760);
}
function renderGunChest(){
  const el=document.getElementById('gunChestShop');
  if(!el) return;
  const keys=persistData.gunKeys||0;
  const remaining=chestAvailableGunIds().length;
  const canOpen=keys>0&&remaining>0&&!_gunChestOpening;
  const owned=GUN_SELECT_ORDER.filter(id=>GUNS[id]&&isGunOwned(id)).length;
  const available=availableGunChestRarities();
  const totalWeight=available.reduce((sum,r)=>sum+r.def.weight,0);
  const odds=available.map(r=>`${r.def.label} ${Number((r.def.weight/totalWeight*100).toFixed(1))}%`).join(', ');
  el.innerHTML=`
    <div class="gun-chest-panel${_gunChestOpening?' opening':''}">
      <div class="gun-chest-art">
        <div class="gun-chest-spark"></div>
        <div class="gun-chest-lid"></div>
        <div class="gun-chest-box"></div>
        <div class="gun-chest-lock"></div>
      </div>
      <div>
        <div class="gun-chest-title">WEAPON CHEST</div>
        <div class="gun-chest-sub">Earn 1 key for every 10 waves cleared. ${remaining?`Current chest odds: ${odds}.`:'All guns unlocked.'}</div>
        <div class="gun-chest-result">${_gunChestResult||`${owned}/${GUN_SELECT_ORDER.length} guns unlocked`}</div>
      </div>
      <div class="gun-chest-actions">
        <div class="gun-key-count">KEYS ${keys}</div>
        <button class="gun-chest-btn" type="button"${canOpen?'':' disabled'}>${remaining?(_gunChestOpening?'OPENING':'OPEN CHEST'):'ALL UNLOCKED'}</button>
      </div>
    </div>`;
  const btn=el.querySelector('.gun-chest-btn');
  if(btn) btn.addEventListener('click',openGunChest);
}
function renderShopLegacy(){
  document.getElementById('shopGoldAmt').textContent=persistData.gold;
  const container=document.getElementById('shopBody');
  container.innerHTML='';
  PERM_DEFS.forEach(def=>{
    // Heal saves that went past max via the old double-click race.
    const rawLvl=persistData.upgrades[def.id]||0;
    const lvl=Math.min(PERM_MAX_LVL,rawLvl);
    if(lvl!==rawLvl){ persistData.upgrades[def.id]=lvl; _savePD(); }
    const maxed=lvl>=PERM_MAX_LVL;
    const cost=maxed?0:PERM_UPGRADE_COST[lvl+1];
    const canAfford=!maxed&&persistData.gold>=cost;
    const card=document.createElement('div');
    card.className='perm-card'+(maxed?' is-maxed':'');

    let bar='<div class="perm-bar">';
    for(let i=1;i<=PERM_MAX_LVL;i++) bar+=`<div class="perm-seg${i<=lvl?' on':''}"></div>`;
    bar+='</div>';

    const btn=maxed
      ? `<div class="perm-maxed-lbl">★ MAXED</div>`
      : `<button class="perm-buy-btn"${canAfford?'':' disabled'}>💰 ${cost} — UPGRADE</button>`;

    card.innerHTML=`
      <div class="perm-card-top">
        ${cardIconHtml(def.id,def.icon,'perm-card-icon',def)}
        <div><div class="perm-card-name">${def.name}</div>
        <div class="perm-card-lv">LV ${lvl} / ${PERM_MAX_LVL}</div></div>
      </div>
      ${bar}
      <div class="perm-card-cur">Now: <b>${def.effects[lvl]}</b></div>
      <div class="perm-card-nxt">${maxed?'':`Next: ${def.effects[lvl+1]}`}</div>
      ${btn}`;

    if(!maxed&&canAfford){
      const buyBtnEl=card.querySelector('.perm-buy-btn');
      buyBtnEl.addEventListener('click',async()=>{
        if(buyBtnEl.disabled) return;
        buyBtnEl.disabled=true;
        try{ await spendAccountGold(cost,'upgrade_purchase',{ upgrade:def.id, level:lvl+1 }); }
        catch(e){ console.warn('[NeonBrawl] upgrade purchase failed', e.message || e); renderShop(); return; }
        persistData.upgrades[def.id]=Math.min(PERM_MAX_LVL,(persistData.upgrades[def.id]||0)+1);
        _savePD(); renderShop();
      });
    }
    container.appendChild(card);
  });
}

// ── Boot ──────────────────────────────────────────────────
let _shopTab = 'WEAPONS';
function setShopTab(name){ if(!name) return; _shopTab = name; renderShop(); }
(function _wireShopTabs(){
  const bar = document.getElementById('shopTabs');
  if(bar) bar.addEventListener('click', e=>{ const b = e.target.closest('.shop-tab'); if(b && b.dataset.tab) setShopTab(b.dataset.tab); });
})();
function renderShop(){
  const gold=persistData.gold||0;
  const upgrades=persistData.upgrades||{};
  document.getElementById('shopGoldAmt').textContent=gold;
  const tab=_shopTab;
  document.querySelectorAll('#shopTabs .shop-tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  // Gun chest belongs to the WEAPONS tab only.
  const gc=document.getElementById('gunChestShop');
  if(gc) gc.style.display = tab==='WEAPONS' ? '' : 'none';
  if(tab==='WEAPONS') renderGunChest();
  const summary=document.getElementById('shopSummary');
  if(summary){
    summary.innerHTML=`
      <div class="shop-stat"><div class="shop-stat-l">OFFENSE</div><div class="shop-stat-v">DMG ${upgrades.dmg||0} / CRIT ${upgrades.crit||0}</div></div>
      <div class="shop-stat"><div class="shop-stat-l">SURVIVAL</div><div class="shop-stat-v">HP ${upgrades.hp||0} / REV ${upgrades.revive||0}</div></div>
      <div class="shop-stat"><div class="shop-stat-l">CONTROL</div><div class="shop-stat-v">SPD ${upgrades.speed||0} / ROLL ${upgrades.reroll||0}</div></div>
      <div class="shop-stat"><div class="shop-stat-l">ECONOMY</div><div class="shop-stat-v">GOLD ${upgrades.treasure||0} / KEYS ${persistData.gunKeys||0}</div></div>`;
  }
  const container=document.getElementById('shopBody');
  container.innerHTML='';

  // ── Weapons section — sequential unlock chain shown above stat upgrades.
  // Katana is rendered for completeness (always owned) so the player sees the
  // whole roster; locked weapons show the required predecessor so the
  // progression path is visible without leaving the shop. WEAPONS tab only.
  if(tab==='WEAPONS'){
  const weaponHead=document.createElement('div');
  weaponHead.className='perm-section';
  weaponHead.textContent='MELEE WEAPONS';
  container.appendChild(weaponHead);
  WEAPON_SHOP_DEFS.forEach(w=>{
    const owned=isWeaponOwned(w.id);
    const locked=!owned && isWeaponLocked(w.id);
    const canBuy=canBuyWeapon(w.id);
    const card=document.createElement('div');
    card.className='perm-card weapon-card'
      +(owned?' is-maxed':'')
      +(canBuy?' can-buy':'')
      +(locked?' is-locked':'');
    card.style.setProperty('--perm-color', w.css||'#00ffcc');
    const reqDef=w.requires?weaponShopDef(w.requires):null;
    const reqName=reqDef?reqDef.name:'KATANA';
    const btn = owned
      ? `<div class="perm-maxed-lbl">★ OWNED</div>`
      : locked
        ? `<div class="perm-maxed-lbl" style="color:#ff6688">🔒 UNLOCK ${reqName} FIRST</div>`
        : (canBuy
            ? `<button class="perm-buy-btn">${w.cost} GOLD — UNLOCK</button>`
            : `<button class="perm-buy-btn" disabled>${w.cost} GOLD — UNLOCK</button><div class="perm-need">NEED ${Math.max(0,w.cost-gold)} MORE</div>`);
    card.innerHTML=`
      <div class="perm-card-top">
        ${cardIconHtml(w.id,w.icon,'perm-card-icon',w)}
        <div class="perm-card-title">
          <div class="perm-card-name">${w.name}</div>
          <div class="perm-card-lv">${owned?'UNLOCKED':locked?`Need ${reqName}`:`${w.cost} GOLD`}</div>
        </div>
      </div>
      <div class="perm-card-why">${w.why}</div>
      ${btn}`;
    if(!owned && canBuy){
      const buyBtn=card.querySelector('.perm-buy-btn');
      if(buyBtn) buyBtn.addEventListener('click',async()=>{
        if(buyBtn.disabled||!canBuyWeapon(w.id)) return;
        buyBtn.disabled=true;
        try{ await spendAccountGold(w.cost,'weapon_unlock',{weapon:w.id}); }
        catch(e){ console.warn('[NeonBrawl] weapon unlock failed', e.message||e); renderShop(); return; }
        persistData.weapons = persistData.weapons || {};
        persistData.weapons[w.id] = true;
        _savePD();
        renderShop();
      });
    }
    container.appendChild(card);
  });
  } // end WEAPONS tab

  let lastCat='';
  const catColors={OFFENSE:'#ff5577',SURVIVAL:'#44ff88',PREMIUM:'#aa88ff',ECONOMY:'#ffd700'};
  PERM_SHOP_DEFS.filter(def=>def.cat===tab).forEach(def=>{
    const max=def.max||PERM_MAX_LVL;
    const costs=def.costs||PERM_UPGRADE_COST;
    // Clamp the saved value to max. A double-click on the buy button while
    // the spend API call was in flight could let two purchases through
    // back-to-back, pushing the saved level past max (e.g. LV 11 / 10) and
    // making def.effects[lvl] read as `undefined`. We heal the value on
    // every render AND prevent the race below.
    const rawLvl=upgrades[def.id]||0;
    const lvl=Math.min(max,rawLvl);
    if(lvl!==rawLvl){
      // Persist the clamp so the next read elsewhere (gameplay perms) sees
      // the corrected value too.
      persistData.upgrades[def.id]=lvl;
      _savePD();
    }
    const maxed=lvl>=max;
    const cost=maxed?0:costs[lvl+1];
    const canAfford=!maxed&&gold>=cost;

    if(def.cat!==lastCat){
      lastCat=def.cat;
      const section=document.createElement('div');
      section.className='perm-section';
      section.textContent=def.cat;
      container.appendChild(section);
    }

    const card=document.createElement('div');
    card.className='perm-card'+(maxed?' is-maxed':'')+(canAfford?' can-buy':'');
    card.style.setProperty('--perm-color',catColors[def.cat]||'#00ffcc');
    let bar='<div class="perm-bar">';
    for(let i=1;i<=max;i++) bar+=`<div class="perm-seg${i<=lvl?' on':''}"></div>`;
    bar+='</div>';
    const btn=maxed
      ? `<div class="perm-maxed-lbl">MAXED</div>`
      : `<button class="perm-buy-btn"${canAfford?'':' disabled'}>${cost} GOLD - UPGRADE</button>${canAfford?'':`<div class="perm-need">NEED ${cost-gold} MORE</div>`}`;

    card.innerHTML=`
      <div class="perm-card-top">
        ${cardIconHtml(def.id,def.icon,'perm-card-icon',def)}
        <div class="perm-card-title"><div class="perm-card-name">${def.name}</div>
        <div class="perm-card-lv">LV ${lvl} / ${max}</div></div>
      </div>
      ${bar}
      <div class="perm-card-effect">
        <div class="perm-effect-box"><div class="perm-effect-l">NOW</div><div class="perm-effect-v">${def.effects[lvl]}</div></div>
        <div class="perm-effect-box next"><div class="perm-effect-l">${maxed?'STATUS':'NEXT'}</div><div class="perm-effect-v">${maxed?'MAXED':def.effects[lvl+1]}</div></div>
      </div>
      <div class="perm-card-why">${def.why}</div>
      ${btn}`;

    if(!maxed&&canAfford){
      const buyBtnEl=card.querySelector('.perm-buy-btn');
      buyBtnEl.addEventListener('click',async()=>{
        // Disable the button BEFORE awaiting the network call so a fast
        // double-click can't queue two purchases against the same level
        // and push the saved value past max.
        if(buyBtnEl.disabled) return;
        buyBtnEl.disabled=true;
        try{ await spendAccountGold(cost,'upgrade_purchase',{ upgrade:def.id, level:lvl+1 }); }
        catch(e){ console.warn('[NeonBrawl] upgrade purchase failed', e.message || e); renderShop(); return; }
        // Cap the increment at max so a save corruption / external write
        // still can't overshoot.
        persistData.upgrades[def.id]=Math.min(max,(persistData.upgrades[def.id]||0)+1);
        _savePD();
        renderShop();
      });
    }
    container.appendChild(card);
  });
}

buildWorld();
buildNavBlocked(); // must run after buildWorld() populates obstacleBoxes
// Pre-build the lazy world meshes (wave totem, boss-prep shop, shop totem) at
// load so their first appearance mid-run doesn't hitch — geometry/material
// allocation happens here instead of on the frame the totem pops in.
try { ensureWaveTotemMesh(); ensureRunShopMesh(); ensureShopTotemMesh(); } catch(_) {}
if (window.PixoTick) {
  window.PixoTick.makeLoop({ tickMs: 16, onTick: loop }).start();
} else {
  (function raf(ts){ loop(ts); requestAnimationFrame(raf); })(performance.now());
}
updateGoldHud();
updateLobbyUI();
// Solo: pick difficulty first (still on a menu screen), then enter the game.
document.getElementById('playBtn').addEventListener('click',()=>{
  if(mp.connected){ setMpStatus('Leave the room to play solo'); return; }
  nbSyncDifficultyUI();
  nbMenuScreen('Difficulty');
});
function nbSyncDifficultyUI(){
  const grid=document.getElementById('nbDiffGrid'); if(!grid) return;
  grid.innerHTML='';
  NB_DIFF_META.forEach(m=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='nb-diff-card'+(m.key===nbDifficulty?' active':'');
    b.style.setProperty('--dc',m.col);
    const name=document.createElement('span'); name.className='dc-name'; name.textContent=DIFFICULTY[m.key].label;
    const desc=document.createElement('span'); desc.className='dc-desc'; desc.textContent=m.desc;
    const txt=document.createElement('span'); txt.className='dc-text'; txt.append(name,desc);
    const emo=document.createElement('span'); emo.className='dc-emoji'; emo.textContent=m.emoji;
    b.append(emo,txt);
    b.addEventListener('click',()=>startSoloWithDifficulty(m.key));
    grid.appendChild(b);
  });
}
function startSoloWithDifficulty(d){
  setNbDifficulty(d);
  initAC(); mp.soloMode=true; mp.myId=0; mp.isHost=true; mp.names={0:getLocalPlayerName()}; initGame();
}

// ── Menu screens / settings (Tetris-style) ────────────────
function nbMenuScreen(name){
  document.querySelectorAll('.nb-screen').forEach(s=>s.classList.toggle('active', s.id==='nbScreen'+name));
}
function nbSettingsTab(name){
  document.querySelectorAll('#nbScreenSettings .nb-tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===name));
  document.querySelectorAll('#nbScreenSettings .nb-section').forEach(s=>s.classList.toggle('active', s.dataset.section===name));
}
document.getElementById('nbBtnMP').addEventListener('click',()=>{
  if (window.NEONBRAWL_CONFIG?.multiplayer === false) {
    window.PixoHowto.open({title:'Multiplayer em preparação',sections:[{heading:'Jogue no modo solo',body:'As salas online ainda estão em preparação. O modo solo está disponível nesta versão.'}]});
    return;
  }
  nbMenuScreen('MP');
});
document.getElementById('nbBtnSettings').addEventListener('click',()=>nbMenuScreen('Settings'));

// Sound: master volume + mute, wired to audioMaster via nbApplyAudio().
function nbSyncSoundUI(){
  const sl=document.getElementById('nbVolSlider'), val=document.getElementById('nbVolVal'), tg=document.getElementById('nbSoundToggle');
  if(sl) sl.value=nbVolume;
  if(val) val.textContent=nbVolume+'%';
  if(tg){ tg.textContent = nbMuted ? '🔇 OFF' : '🔊 ON'; tg.classList.toggle('off', nbMuted); }
  const bsl=document.getElementById('nbBgmSlider'), bval=document.getElementById('nbBgmVal'), btg=document.getElementById('nbBgmToggle');
  if(bsl) bsl.value=nbBgmVol;
  if(bval) bval.textContent=nbBgmVol+'%';
  if(btg){ btg.textContent = nbBgmMuted ? '🔇 OFF' : '🔊 ON'; btg.classList.toggle('off', nbBgmMuted); }
  const otg=document.getElementById('nbOthersSfxToggle');
  if(otg){ otg.textContent = nbOthersSfx ? '🔊 ON' : '🔇 OFF'; otg.classList.toggle('off', !nbOthersSfx); }
}
function nbToggleOthersSfx(){
  nbOthersSfx=!nbOthersSfx;
  try{ localStorage.setItem('nbOthersSfx', nbOthersSfx?'1':'0'); }catch(_){}
  nbSyncSoundUI();
}
function nbToggleMute(){
  nbMuted=!nbMuted;
  try{ localStorage.setItem('nbMuted', nbMuted?'1':'0'); }catch(_){}
  nbApplyAudio(); nbSyncSoundUI();
}
function nbToggleBgm(){
  nbBgmMuted=!nbBgmMuted;
  try{ localStorage.setItem('nbBgmMuted', nbBgmMuted?'1':'0'); }catch(_){}
  nbApplyAudio(); nbSyncSoundUI();
}
document.getElementById('nbVolSlider')?.addEventListener('input',e=>{
  nbVolume=Math.max(0,Math.min(100,parseInt(e.target.value,10)||0));
  try{ localStorage.setItem('nbVolume', String(nbVolume)); }catch(_){}
  if(nbMuted && nbVolume>0){ nbMuted=false; try{ localStorage.setItem('nbMuted','0'); }catch(_){} }
  nbApplyAudio(); nbSyncSoundUI();
});
document.getElementById('nbBgmSlider')?.addEventListener('input',e=>{
  nbBgmVol=Math.max(0,Math.min(100,parseInt(e.target.value,10)||0));
  try{ localStorage.setItem('nbBgmVol', String(nbBgmVol)); }catch(_){}
  if(nbBgmMuted && nbBgmVol>0){ nbBgmMuted=false; try{ localStorage.setItem('nbBgmMuted','0'); }catch(_){} }
  nbApplyAudio(); nbSyncSoundUI();
});

// Keybind: rebind any gameplay key (stored in NB_KEYBINDS / localStorage).
const NB_KEYBIND_ACTIONS = [
  ['up','Move Up'],['down','Move Down'],['left','Move Left'],['right','Move Right'],
  ['dash','Dash'],['melee','Melee'],['reload','Reload'],['interact','Interact'],
];
function nbCodeLabel(code){
  if(!code) return '—';
  if(code==='Space') return 'SPACE';
  if(code.startsWith('Key')) return code.slice(3);
  if(code.startsWith('Digit')) return code.slice(5);
  if(code.startsWith('Arrow')) return code.slice(5).toUpperCase();
  return code.toUpperCase();
}
function nbSaveKeybinds(){ try{ localStorage.setItem('nbKeybinds', JSON.stringify(NB_KEYBINDS)); }catch(_){} }
let _nbCapturing=null;
function nbRenderKeybinds(){
  const list=document.getElementById('nbKeyList'); if(!list) return;
  list.innerHTML='';
  for(const [action,label] of NB_KEYBIND_ACTIONS){
    const row=document.createElement('div'); row.className='nb-key-row';
    const lab=document.createElement('span'); lab.className='nb-row-label'; lab.textContent=label;
    const btn=document.createElement('button'); btn.type='button'; btn.className='nb-key-btn';
    if(_nbCapturing===action){ btn.textContent='PRESS…'; btn.classList.add('capturing'); }
    else btn.textContent=nbCodeLabel(NB_KEYBINDS[action]);
    btn.addEventListener('click',()=>nbStartCapture(action));
    row.appendChild(lab); row.appendChild(btn); list.appendChild(row);
  }
}
function nbStartCapture(action){
  if(_nbCapturing) return;
  _nbCapturing=action; nbRenderKeybinds();
  const onKey=(e)=>{
    e.preventDefault(); e.stopPropagation();
    window.removeEventListener('keydown', onKey, true);
    if(e.code && e.code!=='Escape'){
      const old=NB_KEYBINDS[action];
      // Swap with whatever action currently owns this key, so nothing is left unbound.
      for(const k in NB_KEYBINDS) if(NB_KEYBINDS[k]===e.code && k!==action) NB_KEYBINDS[k]=old;
      NB_KEYBINDS[action]=e.code;
      nbSaveKeybinds();
    }
    _nbCapturing=null; nbRenderKeybinds();
  };
  window.addEventListener('keydown', onKey, true);
}
function nbResetKeybinds(){ NB_KEYBINDS=Object.assign({}, NB_KEYBIND_DEFAULTS); nbSaveKeybinds(); nbRenderKeybinds(); }
// Inline onclick handlers resolve in global scope; this script is a module,
// so expose the ones referenced from HTML (same pattern as window.copyRoomCode).
window.nbMenuScreen=nbMenuScreen; window.nbSettingsTab=nbSettingsTab;
window.nbToggleMute=nbToggleMute; window.nbToggleBgm=nbToggleBgm; window.nbToggleOthersSfx=nbToggleOthersSfx; window.nbResetKeybinds=nbResetKeybinds;
// ── In-game pause menu (ESC) ──────────────────────────────
function nbPauseOpen(){
  if(nbPaused) return;
  resetGameplayInput();
  nbPaused=true;
  document.getElementById('nbPause').style.display='flex';
}
function nbResume(){
  nbPaused=false;
  document.getElementById('nbPause').style.display='none';
  document.getElementById('hud').style.display='block'; // restore HUD (settings-from-pause hides it)
}
function nbPauseOpenSettings(){
  // Reuse the menu's Settings screen over the paused game; the HUD is hidden so
  // it doesn't bleed through, and the Back button returns to the pause menu.
  document.getElementById('nbPause').style.display='none';
  document.getElementById('hud').style.display='none';
  document.getElementById('menu').style.display='flex';
  nbMenuScreen('Settings');
  nbSyncSoundUI(); nbRenderKeybinds();
}
function nbSettingsBack(){
  if(nbPaused){
    document.getElementById('menu').style.display='none';
    nbMenuScreen('Main'); // reset menu to Main for the next normal open
    document.getElementById('nbPause').style.display='flex';
  } else {
    nbMenuScreen('Main');
  }
}
function nbQuitToMenu(){
  recordRunScore('leave');
  resetGameplayInput();
  const summary=document.getElementById('bossRunSummary');
  if(summary){summary.classList.remove('show');summary.innerHTML='';}
  nbPaused=false;
  document.getElementById('nbPause').style.display='none';
  if(mp.connected){ returnToMenuAfterDisconnect('Left the game'); return; }
  // Solo: tear down to the main menu (a fresh PLAY runs a full initGame reset).
  hideReviveUI();
  document.getElementById('hud').style.display='none';
  document.getElementById('gameover').style.display='none';
  document.getElementById('deadOverlay').style.display='none';
  document.getElementById('buffSelect').style.display='none';
  document.getElementById('meleeSelect').style.display='none';
  const _gs=document.getElementById('gunSelect'); if(_gs) _gs.style.display='none';
  closeRunShopUI(); setRunShopWorldVisible(false); setWaveTotemWorldVisible(false);
  document.getElementById('bossBar').style.display='none';
  document.getElementById('exitArrow').style.display='none';
  const _sb=document.getElementById('spellBtn'); if(_sb) _sb.style.display='none';
  const _db=document.getElementById('dashBtn'); if(_db) _db.style.display='none';
  gState='menu';
  document.getElementById('menu').style.display='flex';
  nbMenuScreen('Main');
  playBgm('menu');
}
document.getElementById('nbResumeBtn')?.addEventListener('click', nbResume);
document.getElementById('nbPauseSettingsBtn')?.addEventListener('click', nbPauseOpenSettings);
document.getElementById('nbPauseHowtoBtn')?.addEventListener('click', neonbrawlShowHowto);
document.getElementById('nbPauseMenuBtn')?.addEventListener('click', nbQuitToMenu);
window.nbSettingsBack=nbSettingsBack;
nbSyncSoundUI();
nbRenderKeybinds();

// Floating neon particles behind the menu (mirrors the Tetris main menu).
(function spawnNbParticles(){
  const host=document.getElementById('nbBgParticles'); if(!host) return;
  const colors=['rgba(0,255,204,0.95)','rgba(255,0,204,0.95)','rgba(157,75,255,0.92)','rgba(43,198,255,0.9)','rgba(255,221,0,0.85)','rgba(255,255,255,0.8)'];
  const COUNT=realIsMobile?18:36;
  for(let i=0;i<COUNT;i++){
    const p=document.createElement('div'); p.className='nb-bg-particle';
    const size=2+Math.random()*5;
    const color=colors[(Math.random()*colors.length)|0];
    const duration=14+Math.random()*22;
    p.style.width=p.style.height=size+'px';
    p.style.left=(Math.random()*100)+'%';
    p.style.background=color;
    p.style.boxShadow=`0 0 ${size*5}px ${color}, 0 0 ${size*10}px ${color}`;
    p.style.animationDuration=duration+'s';
    p.style.animationDelay=(-Math.random()*duration)+'s';
    host.appendChild(p);
  }
})();

// Graphics tier selector (potato / low / medium / high). Tier is read once at
// module top (gfxTier) and baked into renderer setup. Reload is required to
// rebuild particle counts and geometry at the new tier; the click auto-
// reloads unless the user is mid-room.
(function _wireGfxTier(){
  const row=document.getElementById('gfxTierRow'); if(!row) return;
  const hint=document.getElementById('gfxTierHint');
  const valid={potato:1,low:1,medium:1,high:1};
  function current(){
    try{
      const v=(localStorage.getItem('nbGfxTier')||'').toLowerCase();
      if(valid[v]) return v;
    }catch(_){}
    return realIsMobile?'low':'high';
  }
  function paint(){
    const cur=current();
    for(const btn of row.querySelectorAll('.gfxTierBtn')){
      btn.dataset.active = btn.dataset.tier===cur ? '1' : '0';
    }
  }
  paint();
  row.addEventListener('click',ev=>{
    const btn=ev.target.closest('.gfxTierBtn'); if(!btn) return;
    const tier=btn.dataset.tier; if(!valid[tier]) return;
    if(tier===current()) return;
    try{ localStorage.setItem('nbGfxTier',tier); }catch(_){}
    paint();
    if(hint){
      hint.textContent='⟳ RELOADING…';
      hint.style.color='#ffd166';
    }
    if(!mp.connected) setTimeout(()=>location.reload(), 450);
  });
})();
document.getElementById('upgradeBtn').addEventListener('click',()=>{ openShop('menu'); });
document.getElementById('goUpgradeBtn').addEventListener('click',()=>{ openShop('gameover'); });
document.getElementById('shopCloseBtn').addEventListener('click',()=>{ closeShop(); });
document.getElementById('restartBtn').addEventListener('click',requestRematch);
document.getElementById('goMenuBtn').addEventListener('click',()=>{
  document.getElementById('gameover').style.display='none';
  document.getElementById('menu').style.display='flex';
  nbMenuScreen(mp && mp.connected ? 'MP' : 'Main');
  playBgm('menu');
});
document.getElementById('hostBtn').addEventListener('click',()=>{
  initAC();
  if(!mp.connected){ mp.hostDifficulty = DIFFICULTY[nbDifficulty]?nbDifficulty:'hard'; hostGame(); }
  else if(mp.isHost) initGame();
});
// JOIN GAME opens a code-entry popup; CONNECT inside it submits the code.
function nbOpenJoinPopup(){
  const p=document.getElementById('joinPopup'); if(!p) return;
  p.classList.add('show');
  const inp=document.getElementById('roomInput'); if(inp){ inp.value=''; setTimeout(()=>inp.focus(),30); }
}
function nbCloseJoinPopup(){ const p=document.getElementById('joinPopup'); if(p) p.classList.remove('show'); }
window.nbCloseJoinPopup=nbCloseJoinPopup;
document.getElementById('joinChoiceBtn')?.addEventListener('click',()=>{ initAC(); nbOpenJoinPopup(); });
document.getElementById('joinPopup')?.addEventListener('click',e=>{ if(e.target.id==='joinPopup') nbCloseJoinPopup(); });
document.getElementById('leaveRoomBtn').addEventListener('click',()=>leaveRoom());
document.getElementById('joinBtn').addEventListener('click',()=>{
  initAC();
  const code=document.getElementById('roomInput').value.trim().toUpperCase();
  if(!code){ setMpStatus('Enter a room code'); return; }
  if(!mp.connected){ nbCloseJoinPopup(); joinGame(code); }
});
document.getElementById('roomInput')?.addEventListener('keydown',e=>{
  if(e.key==='Enter') document.getElementById('joinBtn').click();
  else if(e.key==='Escape') nbCloseJoinPopup();
});
document.getElementById('inviteFriendBtn')?.addEventListener('click',()=>{
  if (window.PixoInvite) window.PixoInvite.open({ gameKey:'neonbrawl', roomCode: mp.roomCode || '' });
});
// Auto-join from ?join=CODE deep-link. When a friend clicks "Accept Invite"
// from outside this page, the browser navigates to /NeonBrawl/?join=CODE and
// the autojoin handler fires once both PixoInvite (for the URL parser) AND
// PixoTurn (for ICE creds) are loaded. We wait for both because if joinGame
// fires before PixoTurn is ready, the connection goes out on STUN-only and a
// symmetric-NAT friend silently fails to connect. Retries handle the
// PeerJS-signaling race where the host's room isn't registered yet on the
// friend's first try.
(function _nbWaitInvite(){
  if (window.NEONBRAWL_CONFIG?.multiplayer === false) return;
  if (window.PixoInvite && window.PixoTurn) {
    // Prefer the early sessionStorage stash (set in <head> before bootstrap)
    // — it survives the first-sync reload that PixoCloudSave triggers on
    // fresh logins. URL ?join= alone wouldn't, because attachAutoJoin strips
    // it on first read and the reloaded page has no ?join= to re-fire.
    let stashed = '';
    try{
      const t = +(sessionStorage.getItem('_nbInviteAt')||0);
      // Expire stash after 90s so an old session doesn't auto-join us when
      // we open the menu for an unrelated reason later.
      if(t && Date.now()-t < 90_000){
        stashed = sessionStorage.getItem('_nbInviteCode') || '';
      }
    }catch(_){}
    if(stashed){
      try{
        sessionStorage.removeItem('_nbInviteCode');
        sessionStorage.removeItem('_nbInviteAt');
      }catch(_){}
      initAC();
      const inp = document.getElementById('roomInput'); if(inp) inp.value = stashed;
      nbMenuScreen('MP');
      if (!mp.connected) joinGame(stashed,{retries:3});
      return;
    }
    window.PixoInvite.attachAutoJoin(code => {
      initAC();
      document.getElementById('roomInput').value = code;
      nbMenuScreen('MP');
      if (!mp.connected) joinGame(code,{retries:3});
    });
  } else setTimeout(_nbWaitInvite, 120);
})();
// PixoCloudSave forces a one-time reload on first login per session when the
// imported cloud localStorage differs from local. If the player clicks Play
// before that reload fires, they get yanked back to the menu mid-init —
// which matches the "looks like the game refreshed once" report. Gate the
// menu buttons for ~1.8s when a fresh-session reload is plausible (auth
// token present, cloud-reload sentinel not yet set) to give it time to
// settle. Already-synced sessions skip the gate entirely.
(function _nbCloudSyncGate(){
  const btns = ['playBtn','hostBtn','joinBtn']
    .map(id=>document.getElementById(id)).filter(Boolean);
  if(!btns.length) return;
  let hasAuthToken=false, alreadyReloaded=false;
  try{
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i)||'';
      if(k.startsWith('sb-') && k.endsWith('-auth-token')){ hasAuthToken=true; break; }
    }
    for(let i=0;i<sessionStorage.length;i++){
      if((sessionStorage.key(i)||'').startsWith('pixoCloudReloaded:neonbrawl:')){ alreadyReloaded=true; break; }
    }
  }catch(_){}
  if(!hasAuthToken || alreadyReloaded) return;
  const saved = btns.map(b=>({b,pe:b.style.pointerEvents,op:b.style.opacity,title:b.title}));
  for(const s of saved){
    s.b.style.pointerEvents='none';
    s.b.style.opacity='0.55';
    s.b.title='Syncing your save…';
  }
  setTimeout(()=>{
    for(const s of saved){
      s.b.style.pointerEvents=s.pe;
      s.b.style.opacity=s.op;
      s.b.title=s.title||'';
    }
  }, 1800);
})();
window.addEventListener('pagehide',onPageExit);
window.addEventListener('beforeunload',onPageExit);

// ─── Dev / cheat console helpers ────────────────────────────
// Run any of these in the browser DevTools console (F12 → Console tab).
// Each writes to localStorage via _savePD so changes survive reloads.
window.nbUnlockAllGuns = function(){
  if(!persistData.guns) persistData.guns={};
  for(const id in GUNS) persistData.guns[id]=true;
  _savePD();
  if(typeof renderShop==='function') renderShop();
  return 'Unlocked '+Object.keys(GUNS).length+' guns.';
};
window.nbUnlockAllMelee = function(){
  if(!persistData.weapons) persistData.weapons={};
  for(const id in MELEE_WEAPONS) persistData.weapons[id]=true;
  _savePD();
  if(typeof renderShop==='function') renderShop();
  return 'Unlocked '+Object.keys(MELEE_WEAPONS).length+' melee.';
};
window.nbGrantKeys = function(n=10){
  n=Math.max(1,Math.floor(Number(n)||1));
  persistData.gunKeys=(persistData.gunKeys||0)+n;
  _savePD();
  if(typeof renderShop==='function') renderShop();
  if(typeof updateHUD==='function') updateHUD();
  return 'Added '+n+' keys. Total: '+persistData.gunKeys;
};
window.nbGrantGold = function(n=10000){
  n=Math.max(1,Math.floor(Number(n)||1));
  persistData.gold=(persistData.gold||0)+n;
  _savePD();
  if(typeof updateGoldHud==='function') updateGoldHud();
  return 'Added '+n+' gold. Total: '+persistData.gold;
};
window.nbMaxAllUpgrades = function(){
  for(const def of PERM_DEFS){
    persistData.upgrades[def.id]=def.max||10;
  }
  _savePD();
  return 'All permanent upgrades maxed.';
};
window.nbWipeProgress = function(){
  if(!confirm('Wipe ALL NeonBrawl progress (gold, keys, upgrades, unlocks)?')) return 'cancelled';
  try{ localStorage.removeItem('_nbpd'); }catch(_){}
  return 'Wiped. Reload the page.';
};
console.log('[NeonBrawl] dev helpers ready: nbUnlockAllGuns(), nbUnlockAllMelee(), nbGrantKeys(n), nbGrantGold(n), nbMaxAllUpgrades(), nbWipeProgress()');

// ─── Leaderboard Button ──────────────────────
// One board per difficulty (party sizes merged). A co-op run shows up as a
// single multi-avatar entry; see the submit block + shared/leaderboard.js.
document.getElementById('openLeaderboard')?.addEventListener('click', () => {
  if (window.PixoLeaderboard) {
    window.PixoLeaderboard.open({
      game_key:'neonbrawl', title:'NeonBrawl', icon:'🔫',
      modes:[
        { value:'score_easy',   label:'EASY' },
        { value:'score_normal', label:'NORMAL' },
        { value:'score_hard',   label:'HARD' },
        { value:'score_expert', label:'EXPERT' },
        { value:'score_hell',   label:'HELL' },
      ],
    });
  }
});

// Backups and account changes are applied only in the menu, outside rooms.
const progressSchema = {
  resetId: SAVE_RESET_ID,
  gunLockResetId: GUN_LOCK_RESET_ID,
  upgrades: Object.fromEntries(PERM_SHOP_DEFS.map(def => [def.id, def.max || PERM_MAX_LVL])),
  guns: Object.keys(GUNS), weapons: Object.keys(MELEE_WEAPONS),
};
setupCloudProgress({
  schema: progressSchema, getProgress: () => structuredClone(persistData),
  defaults: structuredClone(DEFAULT_PERSIST),
  setProgress: progress => {persistData=structuredClone(progress);updateGoldHud();},
  canSwitch: () => gState === 'menu' && !mp.connected && document.getElementById('upgradeShop').style.display !== 'flex',
});
setupBackupUI({
  schema: progressSchema, getProgress: () => structuredClone(persistData),
  canUse: () => gState === 'menu' && !mp.connected && window.NeonBrawlProgress.ready(),
});
