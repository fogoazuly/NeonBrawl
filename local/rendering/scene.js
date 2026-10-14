import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';


export const CAM_Y = 21;
export const CAM_Z_OFF = 15;

export function createSceneView({ canvas, arenaHeight: ARENA_H, isMobile, realIsMobile,
  pixelRatio: GFX_PIXEL_RATIO, bloom: GFX_BLOOM, orbLighting: GFX_ORB_LIGHTS }) {
const renderer = new THREE.WebGLRenderer({ canvas, antialias:false, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, GFX_PIXEL_RATIO));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080705);
scene.fog = new THREE.FogExp2(0x080705, isMobile?0.030:0.024);


const camera = new THREE.PerspectiveCamera(52, innerWidth/innerHeight, 0.1, 200);


camera.position.set(0, CAM_Y, ARENA_H-2+CAM_Z_OFF);
camera.lookAt(0, 0, ARENA_H-2);

function resize(){
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  // Scene/composite render at full res; only the bloom blur stays half-res (cheap).
  // Previously composer.setSize(*0.5) shrank the WHOLE pipeline (incl. the scene)
  // to half resolution, which softened the game after any resize.
  if(composer){
    composer.setSize(innerWidth, innerHeight);
    if(bloomPass) bloomPass.setSize(innerWidth*0.5, innerHeight*0.5);
  }
}

// ── Lights ────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x112255, 0.5));
const sun = new THREE.DirectionalLight(0x4466ff, 0.8);
sun.position.set(8,20,6);
scene.add(sun);

const playerGlow = new THREE.PointLight(0x00ffcc, 2.5, 8);
scene.add(playerGlow);
const muzzleLight = new THREE.PointLight(0xffffff, 0, 5);
scene.add(muzzleLight);

// ── Bloom composer (desktop only) ────────────────────────
let composer = null;
let bloomPass = null;
const USE_BLOOM = GFX_BLOOM && !realIsMobile && innerWidth * innerHeight <= 1600000;
if(USE_BLOOM){
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Half-res bloom — cuts GPU cost ~75% with barely visible quality diff
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth*0.5, innerHeight*0.5), 0.48, 0.42, 0.66);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
}

// ── Orb ambient lights (desktop only) ────────────────────
const orbLights = !GFX_ORB_LIGHTS ? null : (()=>{
  const o={
    fireball:   new THREE.PointLight(0xff5500,0,5),
    iceOrb:     new THREE.PointLight(0x88ddff,0,5),
    thunderOrb: new THREE.PointLight(0xffff44,0,5),
    poisonOrb:  new THREE.PointLight(0x55ee44,0,5),
  };
  Object.values(o).forEach(l=>scene.add(l)); return o;
})();


// Three.js restores GPU resources on context restoration. Suspend simulation while
// they are unavailable, so a solo player cannot die behind a black canvas.
let contextLost = false;
const graphicsNotice = document.createElement('div');
graphicsNotice.setAttribute('role','status');
graphicsNotice.style.cssText='position:fixed;inset:40% 10% auto;z-index:100000;padding:24px;background:#101827;color:white;text-align:center;font:18px system-ui;border:1px solid #7af5d9';
graphicsNotice.textContent='O navegador interrompeu os gráficos. Aguardando recuperação…';
graphicsNotice.hidden=true;
document.body.append(graphicsNotice);
function lost(event){event.preventDefault();contextLost=true;graphicsNotice.hidden=false;console.warn('NeonBrawl: WebGL context lost');window.NeonBrawlDiagnostics?.record('webgl-lost');}
function restored(){window.NeonBrawlDiagnostics?.record('webgl-restored');contextLost=false;resize();graphicsNotice.hidden=true;}
canvas.addEventListener('webglcontextlost',lost);
canvas.addEventListener('webglcontextrestored',restored);
window.addEventListener('resize', resize);
return {
  scene, camera, playerGlow, muzzleLight, orbLights,
  get contextLost() { return contextLost; },
  render() { if(contextLost || document.hidden) return; if(composer) composer.render(); else renderer.render(scene, camera); },
  resize,
  dispose() {
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('webglcontextlost',lost);
    canvas.removeEventListener('webglcontextrestored',restored);
    graphicsNotice.remove();
    if(composer) {
      for(const pass of composer.passes) pass.dispose?.();
      composer.dispose();
    }
    renderer.dispose();
  },
};
}
