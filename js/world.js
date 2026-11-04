// Monde 3D de l'îlot F : terrain, baraques (intactes, dégradées, en ruine),
// clôture, végétation, tentes de 1962, Mémorial, horizon et lumière par période.
import * as THREE from 'three';
import { Sky } from 'three/addons/Sky.js';

// ---------- Constantes et petits utilitaires ----------
const B = 0.35;           // dessus du soubassement (sol intérieur)
const EAVE = 3.05;        // hauteur de l'égout de toiture
const RIDGE = 4.5;        // hauteur du faîtage
const T = 0.25;           // épaisseur des murs
const SILL = B + 1.15, WTOP = B + 2.0, DOOR_W = 1.4, DOOR_TOP = B + 2.1;
const ENCL = { xmin: -440, xmax: 440, zmin: -228, zmax: 228 };
const GATE = { z0: -15.5, z1: -4.5 };
const ROAD_Z = -10;
const MEMORIAL = { x0: 15, x1: 35, z0: -110, z1: 110, hSouth: 0.7, hNorth: 3.2, patios: [-55, 0, 55], patio: 10 };
export const INTERIOR_BARRACK = 32;

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function terrainY(x, z) {
  const r = Math.hypot(x / 1.4, z);
  const fade = 1 - smooth(480, 620, r);
  return 0.54 + fade * (0.16 * Math.sin(x * .009) * Math.cos(z * .011) + .06 * Math.sin((x + z) * .027));
}

// Accumulateur de géométrie : on construit chaque baraque dans son repère local,
// puis on la place (rotation + translation) dans un grand maillage fusionné.
class Builder {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.setFrame(0, 0, 0, 0); this.ao = true; }
  setFrame(x, y, z, yaw) { this.fx = x; this.fy = y; this.fz = z; this.cos = Math.cos(yaw); this.sin = Math.sin(yaw); }
  _v(x, y, z) { return [this.fx + x * this.cos + z * this.sin, this.fy + y, this.fz - x * this.sin + z * this.cos]; }
  _push(v, nrm, uv, col, ly) {
    const P = this._v(...v); this.p.push(...P);
    this.n.push(nrm[0] * this.cos + nrm[2] * this.sin, nrm[1], -nrm[0] * this.sin + nrm[2] * this.cos);
    this.u.push(uv[0], uv[1]);
    const k = this.ao ? 0.62 + 0.38 * smooth(B - .3, B + 1.4, ly) : 1;
    this.c.push(col[0] * k, col[1] * k, col[2] * k);
  }
  tri(a, b, c, uva, uvb, uvc, col) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const l = Math.hypot(...n) || 1; n[0] /= l; n[1] /= l; n[2] /= l;
    this._push(a, n, uva, col, a[1]); this._push(b, n, uvb, col, b[1]); this._push(c, n, uvc, col, c[1]);
  }
  quad(a, b, c, d, uvs, col) { this.tri(a, b, c, uvs[0], uvs[1], uvs[2], col); this.tri(a, c, d, uvs[0], uvs[2], uvs[3], col); }
  // Boîte avec UV « monde » (tu, tv = taille d'une tuile de texture en mètres).
  box(x0, x1, y0, y1, z0, z1, tu, tv, col, skip = '') {
    const U = (a, b) => [a / tu, b / tv];
    if (!skip.includes('px')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [U(z1, y0), U(z0, y0), U(z0, y1), U(z1, y1)], col);
    if (!skip.includes('nx')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [U(z0, y0), U(z1, y0), U(z1, y1), U(z0, y1)], col);
    if (!skip.includes('pz')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [U(x0, y0), U(x1, y0), U(x1, y1), U(x0, y1)], col);
    if (!skip.includes('nz')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [U(x1, y0), U(x0, y0), U(x0, y1), U(x1, y1)], col);
    if (!skip.includes('py')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [U(x0, z1), U(x1, z1), U(x1, z0), U(x0, z0)], col);
    if (!skip.includes('ny')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [U(x0, z0), U(x1, z0), U(x1, z1), U(x0, z1)], col);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere(); return g;
  }
}
const hex = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const jitter = (col, r, amt) => col.map(v => v * (1 - amt + r() * amt * 2));

// ---------- Textures procédurales (canvas) ----------
function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function grassTexture() {
  return canvasTex(256, (x, s) => {
    const r = rng(7);
    for (let i = 0; i < 70; i++) {
      const bx = s * (.2 + r() * .6), lean = (r() - .5) * s * .45, h = s * (.35 + r() * .6);
      const tone = r();
      x.strokeStyle = tone < .5 ? `rgb(${150 + r() * 40},${132 + r() * 30},${82 + r() * 25})` : tone < .8 ? `rgb(${112 + r() * 30},${108 + r() * 25},${68 + r() * 20})` : `rgb(${190 + r() * 30},${172 + r() * 25},${126 + r() * 20})`;
      x.lineWidth = 1.5 + r() * 2.5; x.lineCap = 'round';
      x.beginPath(); x.moveTo(bx, s); x.quadraticCurveTo(bx + lean * .3, s - h * .6, bx + lean, s - h); x.stroke();
    }
  });
}
function woodTexture() {
  return canvasTex(256, (x, s) => {
    const r = rng(11); x.fillStyle = '#7a6148'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 160; i++) { x.strokeStyle = `rgba(${r() < .5 ? '40,28,18' : '200,170,130'},${.05 + r() * .12})`; x.lineWidth = 1 + r() * 2; const y = r() * s; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(s * .3, y + (r() - .5) * 8, s * .6, y + (r() - .5) * 8, s, y); x.stroke(); }
    for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(30,20,12,.35)'; x.fillRect(0, i * s / 6, s, 2); }
  });
}
function noiseTexture(base, seed, grain = 26000) {
  return canvasTex(256, (x, s) => {
    const r = rng(seed); x.fillStyle = base; x.fillRect(0, 0, s, s);
    for (let i = 0; i < grain / 4; i++) { const a = .02 + r() * .05; x.fillStyle = r() < .5 ? `rgba(255,248,230,${a})` : `rgba(30,25,20,${a})`; x.fillRect(r() * s, r() * s, 1 + r() * 3, 1 + r() * 2); }
  });
}

// ---------- Construction ----------
// Rend la main au navigateur entre deux étapes (la barre de progression avance) ; MessageChannel n'est pas ralenti en arrière-plan.
const tick = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); });
export async function createWorld(renderer, { plan, lowPower, onProgress = () => { } }) {
  const scene = new THREE.Scene();
  const loader = new THREE.TextureLoader();
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), lowPower ? 4 : 8);
  const loadTex = async (url, srgb = true) => { const t = await loader.loadAsync(url); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  onProgress(.1, 'Textures');
  const [brickMap, brickN, roofMap, roofN, earthMap, earthN] = await Promise.all([
    loadTex('./textures/brick.webp'), loadTex('./textures/brick_n.webp', false),
    loadTex('./textures/roof.webp'), loadTex('./textures/roof_n.webp', false),
    loadTex('./textures/earth.webp'), loadTex('./textures/earth_n.webp', false)]);
  onProgress(.35, 'Terrain'); await tick();

  const barracks = plan.barracks.map(b => ({ ...b, y: terrainY(b.x, b.z) }));
  const byId = Object.fromEntries(barracks.map(b => [b.id, b]));
  const toWorld = (b, lx, lz) => [b.x + lx * Math.cos(b.yaw) + lz * Math.sin(b.yaw), b.z - lx * Math.sin(b.yaw) + lz * Math.cos(b.yaw)];
  const toLocal = (b, x, z) => { const dx = x - b.x, dz = z - b.z, c = Math.cos(b.yaw), s = Math.sin(b.yaw); return [dx * c - dz * s, dx * s + dz * c]; };

  // ----- Lumière et ciel -----
  const sky = new Sky(); sky.scale.setScalar(40000); scene.add(sky);
  const sun = new THREE.DirectionalLight(0xffeedd, 3); sun.castShadow = true;
  const smap = lowPower ? 1024 : 2048; sun.shadow.mapSize.set(smap, smap);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xdfe7ef, 0x8a7a63, 1.1); scene.add(hemi);
  scene.fog = new THREE.FogExp2(0xd8d6cc, 0.0008);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene(); const skyCopy = new Sky(); skyCopy.scale.setScalar(1000); skyScene.add(skyCopy);
  let envRT = null;

  // ----- Masque du sol (allées, terre tassée, ombres de contact) -----
  const GX = 1400, GZ = 900, MW = 2048, MH = Math.round(MW * GZ / GX);
  const mask = document.createElement('canvas'); mask.width = MW; mask.height = MH;
  {
    const m = mask.getContext('2d'); const px = x => (x + GX / 2) / GX * MW, pz = z => (GZ / 2 - z) / GZ * MH, s = MW / GX;
    m.fillStyle = 'rgb(255,0,0)'; m.fillRect(0, 0, MW, MH);
    const r = rng(3);
    // Taches sèches / plus herbeuses (canal B)
    m.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 260; i++) { const x = r() * MW, y = r() * MH, rad = (8 + r() * 45) * s; const g = m.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, `rgba(0,0,${60 + r() * 120},1)`); g.addColorStop(1, 'rgba(0,0,0,0)'); m.fillStyle = g; m.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    m.globalCompositeOperation = 'source-over';
    // Terre tassée : allée d'entrée, place, abords des baraques (canal G)
    const paint = (x0, z0, x1, z1, g, blur) => { m.filter = `blur(${blur * s}px)`; m.fillStyle = `rgba(0,255,0,${g})`; m.globalCompositeOperation = 'lighter'; m.fillRect(px(x0), pz(z1), (x1 - x0) * s, (z1 - z0) * s); m.globalCompositeOperation = 'source-over'; m.filter = 'none'; };
    paint(-470, ROAD_Z - 3.2, -40, ROAD_Z + 3.2, .55, 1.2);
    paint(5, -135, 45, 135, .32, 4);
    for (const b of barracks) {
      const L = b.length / 2 + 2.2, W = b.width / 2 + 2.6;
      const [ax, az] = b.yaw ? [W, L] : [L, W];
      paint(b.x - ax, b.z - az, b.x + ax, b.z + az, .28, 1.4);
      // Petit sentier devant chaque porte de pignon
      for (const sgn of [-1, 1]) { const [dx, dz] = toWorld(b, sgn * (b.length / 2 + 4), 0); const [hx, hz] = b.yaw ? [.8, 4] : [4, .8]; paint(dx - hx, dz - hz, dx + hx, dz + hz, .35, .8); }
    }
    // Ombres de contact sous les baraques (canal R assombri)
    m.globalCompositeOperation = 'multiply';
    for (const b of barracks) {
      const L = b.length / 2 + .7, W = b.width / 2 + .9; const [ax, az] = b.yaw ? [W, L] : [L, W];
      m.filter = `blur(${1.3 * s}px)`; m.fillStyle = 'rgb(120,255,255)'; m.fillRect(px(b.x - ax), pz(b.z + az), ax * 2 * s, az * 2 * s);
    }
    m.filter = 'none'; m.globalCompositeOperation = 'source-over';
  }
  const maskTex = new THREE.CanvasTexture(mask); maskTex.flipY = false; maskTex.colorSpace = THREE.NoColorSpace; maskTex.anisotropy = maxAniso;

  const groundUniforms = { uMask: { value: maskTex }, uMaskSize: { value: new THREE.Vector2(GX, GZ) } };
  function groundMaterial(tile, useMask) {
    const mat = new THREE.MeshStandardMaterial({ map: earthMap, normalMap: earthN, normalScale: new THREE.Vector2(.9, .9), roughness: .96, color: 0xc4bcae });
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, groundUniforms, { uTile: { value: tile } });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWXZ = (modelMatrix * vec4(transformed,1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec2 vWXZ; uniform sampler2D uMask; uniform vec2 uMaskSize; uniform float uTile;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}`)
        .replace('#include <map_fragment>', `
vec2 tuv = vWXZ / uTile;
vec4 t1 = texture2D(map, tuv);
vec4 t2 = texture2D(map, tuv * 0.23 + 0.37);
float dist = length(vWXZ - cameraPosition.xz);
vec3 tex = mix(t1.rgb, t2.rgb, 0.35 + 0.4*smoothstep(20.0, 160.0, dist));
float macro = 0.80 + 0.30*vnoise(vWXZ*0.012) + 0.12*vnoise(vWXZ*0.07) + 0.06*vnoise(vWXZ*0.5);
vec3 col = tex * macro;
float veg = smoothstep(0.55, 0.85, vnoise(vWXZ*0.006 + 3.1)*0.7 + vnoise(vWXZ*0.03)*0.3);
col = mix(col, col*vec3(.78,.80,.66), veg*0.55);
${useMask ? `vec2 muv = vec2(vWXZ.x/uMaskSize.x + .5, .5 - vWXZ.y/uMaskSize.y);
vec4 mk = (muv.x>0.0&&muv.x<1.0&&muv.y>0.0&&muv.y<1.0) ? texture2D(uMask, muv) : vec4(1.,0.,0.,0.);
col = mix(col, vec3(dot(col, vec3(.3,.5,.2)))*vec3(1.10,1.04,.95), mk.g*0.55);
col *= mix(1.0, 1.10, mk.g);
col = mix(col, col*vec3(.80,.85,.68), mk.b*0.55);
col *= mix(0.38, 1.0, mk.r);` : ''}
diffuseColor.rgb *= col;`);
    };
    mat.customProgramCacheKey = () => 'ground-' + useMask;
    return mat;
  }
  const groundGeo = new THREE.PlaneGeometry(GX, GZ, 280, 180); groundGeo.rotateX(-Math.PI / 2);
  { const p = groundGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, terrainY(p.getX(i), p.getZ(i))); groundGeo.computeVertexNormals(); }
  const ground = new THREE.Mesh(groundGeo, groundMaterial(3.2, true)); ground.receiveShadow = true; scene.add(ground);
  const farGeo = new THREE.CircleGeometry(50000, 64); farGeo.rotateX(-Math.PI / 2);
  const far = new THREE.Mesh(farGeo, groundMaterial(5.5, false)); far.position.y = .25; far.receiveShadow = true; scene.add(far);

  // ----- Horizon : collines, Corbières (au nord de la maquette) et mer à l'est -----
  const horizon = new THREE.Group(); scene.add(horizon);
  function ridge(radius, seed, profile, colTop, colBot) {
    const segs = 720, r = rng(seed), pos = [], col = [], idx = [];
    const n1 = Array.from({ length: 64 }, () => r()), n2 = Array.from({ length: 256 }, () => r());
    const ns = (arr, t) => { const n = arr.length, f = t * n, i = Math.floor(f) % n, j = (i + 1) % n, k = f - Math.floor(f), s = k * k * (3 - 2 * k); return arr[i] * (1 - s) + arr[j] * s; };
    const top = new THREE.Color(colTop), bot = new THREE.Color(colBot);
    for (let i = 0; i <= segs; i++) {
      const a = i / segs * Math.PI * 2, t = i / segs;
      const h = profile(a) * (0.55 + 0.45 * ns(n1, t) + 0.25 * ns(n2, t) - .12);
      const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
      pos.push(x, -60, z, x, Math.max(0, h), z); col.push(bot.r, bot.g, bot.b, top.r, top.g, top.b);
      if (i < segs) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })); horizon.add(m); return m;
  }
  const dirWeight = (a, target, width) => { let d = Math.abs(((a - target + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI); return Math.exp(-(d * d) / (width * width)); };
  // angle a : x = cos a, z = sin a  →  -z (Corbières) à a = -π/2, +x (mer) à a = 0
  const farRidge = ridge(14000, 21, a => 160 + 1250 * dirWeight(a, -Math.PI / 2, .9) + 380 * dirWeight(a, Math.PI * .8, .7) - 140 * dirWeight(a, 0, .5), '#7d8b98', '#aab3b8');
  const nearRidge = ridge(7000, 5, a => 50 + 330 * dirWeight(a, -Math.PI / 2, .55) + 70 * dirWeight(a, Math.PI, 1.2) - 40 * dirWeight(a, 0, .7), '#7f8270', '#a9a690');
  const sea = new THREE.Mesh(new THREE.RingGeometry(9000, 15000, 48, 1, -.55, 1.1), new THREE.MeshBasicMaterial({ color: 0x8aa3aa, fog: false }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = .8; horizon.add(sea);
  horizon.renderOrder = -1;

  // ----- Nuages légers (couche procédurale, dérive lente) -----
  const cloudU = { uTime: { value: 0 }, uCover: { value: .55 }, uSun: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(.75, .78, .82) } };
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(70000, 70000), new THREE.ShaderMaterial({
    uniforms: cloudU, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = (modelMatrix*vec4(position,1.)).xz; gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec2 vP; uniform float uTime, uCover; uniform vec3 uSun, uShade;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
      void main(){ vec2 p = vP*.00011 + vec2(uTime*.004, uTime*.0015);
        float d = fbm(p), c = smoothstep(uCover, uCover+.28, d);
        float edge = 1. - smoothstep(9000., 34000., length(vP));
        vec3 col = mix(uShade, uSun, smoothstep(uCover, uCover+.5, fbm(p+vec2(.03,.02))));
        gl_FragColor = vec4(col, c*.85*edge); }`
  }));
  clouds.rotation.x = -Math.PI / 2; clouds.position.y = 2600; clouds.renderOrder = -1; scene.add(clouds);
  onProgress(.5, 'Baraques'); await tick();

  // ----- Matériaux des bâtiments -----
  const brickMat = new THREE.MeshStandardMaterial({ map: brickMap, normalMap: brickN, normalScale: new THREE.Vector2(.8, .8), vertexColors: true, roughness: .92 });
  const roofMat = new THREE.MeshStandardMaterial({ map: roofMap, normalMap: roofN, normalScale: new THREE.Vector2(1.2, 1.2), vertexColors: true, roughness: .85, metalness: .05, side: THREE.DoubleSide });
  const woodTex = woodTexture(); woodTex.anisotropy = maxAniso;
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, vertexColors: true, roughness: .9 });
  const concreteMat = new THREE.MeshStandardMaterial({ map: earthMap, normalMap: earthN, vertexColors: true, roughness: .97, color: 0xb7b2aa });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d1a17, roughness: 1 });
  roofMat.shadowSide = THREE.DoubleSide; woodMat.side = THREE.DoubleSide;

  // Une baraque complète. mode : 'intact' | 'degraded' | 'ruin'
  function buildBarrack(b, mode, out) {
    const L = b.length, W = b.width, hl = L / 2, hw = W / 2, r = rng(b.id * 97 + (mode === 'ruin' ? 5 : 0));
    const wallCol = jitter(hex(['#f4e6dc', '#efe2d6', '#f7ebe0'][b.id % 3]), r, .05);
    const timberCol = jitter(hex('#d8c5b0'), r, .1);
    for (const k of ['wall', 'roof', 'wood', 'base']) out[k].setFrame(b.x, b.y, b.z, b.yaw);
    const wall = out.wall, wood = out.wood;
    // Soubassement / sol intérieur
    out.base.box(-hl - .08, hl + .08, -.45, B, -hw - .08, hw + .08, 2.6, 2.6, jitter(hex('#d6d0c6'), r, .04));
    const nWin = Math.max(3, Math.round(L / 5.5)), winX = Array.from({ length: nWin }, (_, i) => -hl + (i + .5) * L / nWin), ww = .5;
    const tu = 2.0, tv = 1.9;
    // Longs pans
    for (const side of [-1, 1]) {
      const z0 = side > 0 ? hw - T : -hw, z1 = side > 0 ? hw : -hw + T;
      const edges = [-hl, ...winX.flatMap(x => [x - ww, x + ww]), hl];
      if (mode !== 'ruin') {
        wall.box(-hl, hl, B, SILL, z0, z1, tu, tv, wallCol);
        wall.box(-hl, hl, WTOP, EAVE, z0, z1, tu, tv, wallCol);
        for (let i = 0; i < edges.length; i += 2) wall.box(edges[i], edges[i + 1], SILL, WTOP, z0, z1, tu, tv, wallCol, 'pyny');
        // Linteaux et appuis en bois, volets ouverts contre le mur
        for (const x of winX) {
          wood.box(x - ww - .08, x + ww + .08, WTOP, WTOP + .1, side > 0 ? hw : -hw - .04, side > 0 ? hw + .04 : -hw, 1.5, 1.5, timberCol);
          wood.box(x - ww - .06, x + ww + .06, SILL - .07, SILL, side > 0 ? hw : -hw - .08, side > 0 ? hw + .08 : -hw, 1.5, 1.5, timberCol);
          if (mode === 'degraded' && r() < .45) continue;
          for (const d of [-1, 1]) {
            const sx = x + d * (ww + .27), zz = side > 0 ? hw + .015 : -hw - .055;
            wood.box(sx - .25, sx + .25, SILL + .03, WTOP - .03, zz, zz + .04, 1.2, 1.2, jitter(timberCol, r, .12));
          }
        }
      } else {
        // Ruine : murs arasés, trumeaux irréguliers, plus de toiture
        let x = -hl;
        while (x < hl - .01) { const len = Math.min(hl - x, .9 + r() * 2.2); const top = SILL - .55 + r() * .55; wall.box(x, x + len, B, top, z0, z1, tu, tv, wallCol); x += len; }
        for (let i = 2; i < edges.length - 2; i += 2) {
          const top = r() < .35 ? EAVE - r() * .5 : SILL - .1 + r() * 1.1;
          if (top > SILL) wall.box(edges[i], edges[i + 1], SILL - .2, top, z0, z1, tu, tv, wallCol);
        }
        for (const [a, bnd] of [[-hl, edges[1]], [edges[edges.length - 2], hl]]) wall.box(a, bnd, SILL - .2, EAVE - r() * .4, z0, z1, tu, tv, wallCol);
      }
    }
    // Pignons avec porte
    for (const end of [-1, 1]) {
      const x0 = end > 0 ? hl - T : -hl, x1 = end > 0 ? hl : -hl + T;
      const iz0 = -hw + T, iz1 = hw - T;
      if (mode !== 'ruin') {
        wall.box(x0, x1, B, DOOR_TOP, iz0, -DOOR_W / 2, tu, tv, wallCol);
        wall.box(x0, x1, B, DOOR_TOP, DOOR_W / 2, iz1, tu, tv, wallCol);
        wall.box(x0, x1, DOOR_TOP, EAVE, iz0, iz1, tu, tv, wallCol);
        // Triangle du pignon
        const xf = end > 0 ? x1 : x0, xb = end > 0 ? x0 : x1, s = end;
        const U = (z, y) => [z / tu, y / tv];
        const fa = [xf, EAVE, -hw], fb = [xf, EAVE, hw], fc = [xf, RIDGE, 0], ba = [xb, EAVE, -hw], bb = [xb, EAVE, hw], bc = [xb, RIDGE, 0];
        if (s > 0) { wall.tri(fa, fc, fb, U(-hw, EAVE), U(0, RIDGE), U(hw, EAVE), wallCol); wall.tri(ba, bb, bc, U(-hw, EAVE), U(hw, EAVE), U(0, RIDGE), wallCol); }
        else { wall.tri(fa, fb, fc, U(-hw, EAVE), U(hw, EAVE), U(0, RIDGE), wallCol); wall.tri(ba, bc, bb, U(-hw, EAVE), U(0, RIDGE), U(hw, EAVE), wallCol); }
        // Porte : vantail fermé (ou ouvert pour la baraque témoin)
        const open = b.id === INTERIOR_BARRACK && end < 0;
        const doorCol = jitter(hex('#b9a48c'), r, .1);
        if (!open) { const xd = end > 0 ? hl - T * .5 : -hl + T * .5; wood.box(xd - .03, xd + .03, B, DOOR_TOP, -DOOR_W / 2, DOOR_W / 2, 1.4, 2.2, doorCol); }
        else wood.box(-hl + T, -hl + T + DOOR_W, B, DOOR_TOP, -DOOR_W / 2 - .06, -DOOR_W / 2, 1.4, 2.2, doorCol);
        const xd = end > 0 ? hl : -hl - .06;
        wood.box(xd, xd + .06, DOOR_TOP, DOOR_TOP + .12, -DOOR_W / 2 - .1, DOOR_W / 2 + .1, 1.5, 1.5, timberCol);
      } else {
        wall.box(x0, x1, B, B + .6 + r() * (EAVE - B - .9), iz0, -DOOR_W / 2, tu, tv, wallCol);
        wall.box(x0, x1, B, B + .6 + r() * (EAVE - B - .9), DOOR_W / 2, iz1, tu, tv, wallCol);
      }
    }
    // Toiture (plaques ondulées en bandes ; certaines manquent en 1962)
    if (mode !== 'ruin') {
      const ov = .42, slope = (RIDGE - EAVE) / hw, roofCol = jitter(hex('#d9d6cf'), r, .05);
      const panels = Math.ceil((L + .6) / 2.5), px0 = -hl - .3, pw = (L + .6) / panels;
      for (const side of [-1, 1]) {
        const ze = side * (hw + ov), ye = EAVE - ov * slope, zr = 0, yr = RIDGE + .04;
        const slen = Math.hypot(ze - zr, ye - yr), nz = side * slope / Math.hypot(1, slope) * 0, th = .06;
        for (let i = 0; i < panels; i++) {
          if (mode === 'degraded' && r() < .14) continue;
          const xa = px0 + i * pw, xb = xa + pw;
          const c = mode === 'degraded' ? jitter(roofCol.map(v => v * .82), r, .12) : jitter(roofCol, r, .04);
          const Ua = [xa / 2.5, 0], Ub = [xb / 2.5, 0], Uc = [xb / 2.5, slen / 2.5], Ud = [xa / 2.5, slen / 2.5];
          const A = [xa, yr, zr], Bp = [xb, yr, zr], C = [xb, ye, ze], D = [xa, ye, ze];
          out.roof.ao = false;
          if (side > 0) out.roof.quad(A, D, C, Bp, [Ua, Ud, Uc, Ub], c); else out.roof.quad(A, Bp, C, D, [Ua, Ub, Uc, Ud], c);
          // Épaisseur visible en rive basse
          const D2 = [xa, ye - th, ze], C2 = [xb, ye - th, ze];
          if (side > 0) out.roof.quad(D, D2, C2, C, [[0, 0], [0, .03], [1, .03], [1, 0]], c.map(v => v * .7)); else out.roof.quad(C, C2, D2, D, [[0, 0], [0, .03], [1, .03], [1, 0]], c.map(v => v * .7));
          out.roof.ao = true;
        }
        // Bandeau de rive en bois
        const zf0 = side > 0 ? hw + ov - .02 : -hw - ov - .03, zf1 = zf0 + .05;
        wood.box(-hl - .32, hl + .32, ye - .22, ye - .02, zf0, zf1, 2, 2, timberCol);
        // Rives de pignon
        for (const end of [-1, 1]) {
          const xg = end * (hl + .3), z0 = Math.min(0, ze), z1 = Math.max(0, ze);
          const a = [xg, yr + .02, 0], b2 = [xg, ye + .02, ze], a2 = [xg, yr - .16, 0], b3 = [xg, ye - .16, ze];
          if ((side > 0) === (end > 0)) wood.quad(a, a2, b3, b2, [[0, 0], [0, .1], [1, .1], [1, 0]], timberCol); else wood.quad(a, b2, b3, a2, [[0, 0], [1, 0], [1, .1], [0, .1]], timberCol);
          void z0; void z1;
        }
        void nz;
      }
      // Faîtière
      out.roof.box(-hl - .32, hl + .32, RIDGE + .02, RIDGE + .13, -.17, .17, 2.5, 2.5, jitter(hex('#bdb8ae'), r, .05));
      // Fermes de charpente visibles à l'intérieur (lues depuis la baraque témoin)
      if (b.id === INTERIOR_BARRACK) for (let x = -hl + 2.5; x < hl - 1; x += 3) {
        wood.box(x - .07, x + .07, EAVE - .15, EAVE - .02, -hw + T, hw - T, 2, 2, timberCol);
        wood.box(x - .06, x + .06, EAVE - .02, RIDGE - .08, -.07, .07, 2, 2, timberCol);
      }
    }
  }
  const makeSet = () => ({ wall: new Builder(), roof: new Builder(), wood: new Builder(), base: new Builder() });
  const sets = { intact: makeSet(), degraded: makeSet(), ruin: makeSet() };
  for (const b of barracks) for (const mode of ['intact', 'degraded', 'ruin']) buildBarrack(b, mode, sets[mode]);
  const groups = {};
  for (const [mode, s] of Object.entries(sets)) {
    const g = new THREE.Group(); g.name = 'Baraques — ' + mode;
    for (const [k, mat] of [['wall', brickMat], ['roof', roofMat], ['wood', woodMat], ['base', concreteMat]]) {
      if (!s[k].p.length) continue;
      const mesh = new THREE.Mesh(s[k].geometry(), mat); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
    }
    g.visible = false; scene.add(g); groups[mode] = g;
  }
  onProgress(.65, 'Clôture et végétation'); await tick();

  // ----- Intérieur de la baraque témoin (évocation 1941–1942) -----
  const ib = byId[INTERIOR_BARRACK];
  const interior = new THREE.Group(); interior.position.set(ib.x, ib.y, ib.z); interior.rotation.y = ib.yaw; scene.add(interior);
  const bunkRows = [];
  {
    const boxes = new Map(); const add = (mat, x, y, z, sx, sy, sz) => { if (!boxes.has(mat)) boxes.set(mat, []); boxes.get(mat).push([x, y, z, sx, sy, sz]); };
    const plank = new THREE.MeshStandardMaterial({ map: woodTex, color: 0xcdb89d, roughness: .95 });
    const linen = new THREE.MeshStandardMaterial({ map: noiseTexture('#a8946c', 3, 60000), roughness: 1 });
    const blanket = new THREE.MeshStandardMaterial({ map: noiseTexture('#5f5a4c', 5), roughness: 1 });
    const caseMat = new THREE.MeshStandardMaterial({ map: noiseTexture('#6e4f3a', 9), roughness: .95 });
    const hl = ib.length / 2, hw = ib.width / 2, r = rng(1941);
    const zRow = hw - T - .55;
    for (const side of [-1, 1]) {
      const z = side * zRow; let count = 0;
      for (let x = -hl + 3.2; x < hl - 1.4; x += 2.25) {
        count++;
        for (const [dx, dz] of [[-.95, -.43], [.95, -.43], [-.95, .43], [.95, .43]]) add(plank, x + dx, B + 1.0, z + dz, .09, 1.95, .09);
        for (const lv of [B + .45, B + 1.45]) {
          add(plank, x, lv, z, 1.96, .07, .92);
          add(linen, x, lv + .09, z, 1.8, .12, .78);
          add(blanket, x + .2 + (r() - .5) * .3, lv + .17, z + (r() - .5) * .05, 1.2 + r() * .3, .07, .84);
        }
        if (r() < .55) add(caseMat, x - .4 + r() * .6, B + .17, z - side * .78, .62, .32, .38);
      }
      bunkRows.push({ side, x0: -hl + 3.2 - 1.05, x1: -hl + 3.2 + (count - 1) * 2.25 + 1.05 });
    }
    // Table et bancs au centre de l'allée (évocation)
    add(plank, 4, B + .74, 0, 3.0, .06, .8); for (const dx of [-1.3, 1.3]) for (const dz of [-.3, .3]) add(plank, 4 + dx, B + .37, dz, .07, .74, .07);
    for (const dz of [-.75, .75]) { add(plank, 4, B + .44, dz, 2.8, .05, .28); for (const dx of [-1.2, 1.2]) add(plank, 4 + dx, B + .22, dz, .06, .44, .2); }
    const unit = new THREE.BoxGeometry(1, 1, 1), dummy = new THREE.Object3D();
    for (const [mat, list] of boxes) {
      const mesh = new THREE.InstancedMesh(unit, mat, list.length);
      list.forEach(([x, y, z, sx, sy, sz], i) => { dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
      mesh.castShadow = true; mesh.receiveShadow = true; interior.add(mesh);
    }
    const glow = new THREE.PointLight(0xe9d6b8, 0, 26, 1.2); glow.position.set(0, 2.6, 0); interior.add(glow); interior.userData.glow = glow;
  }

  // ----- Clôture (poteaux et barbelés) -----
  const fence = new THREE.Group(); scene.add(fence);
  {
    const posts = [], spans = [];
    const line = (ax, az, bx, bz) => { const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 3)); for (let i = 0; i <= n; i++) posts.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n]); spans.push([ax, az, bx, bz]); };
    const { xmin, xmax, zmin, zmax } = ENCL;
    line(xmin, zmin, xmax, zmin); line(xmax, zmin, xmax, zmax); line(xmax, zmax, xmin, zmax);
    line(xmin, zmax, xmin, GATE.z1); line(xmin, GATE.z0, xmin, zmin);
    const metal = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: .7, metalness: .4 });
    const postMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.06, .075, 1.8, 6), new THREE.MeshStandardMaterial({ color: 0x4f4337, roughness: .95 }), posts.length + 2);
    const d = new THREE.Object3D(); const r = rng(77);
    posts.forEach(([x, z], i) => { d.position.set(x, terrainY(x, z) + .85, z); d.rotation.set((r() - .5) * .05, 0, (r() - .5) * .05); d.scale.set(1, 1, 1); d.updateMatrix(); postMesh.setMatrixAt(i, d.matrix); });
    // Deux poteaux d'entrée plus hauts
    for (const [i, z] of [[posts.length, GATE.z0], [posts.length + 1, GATE.z1]]) { d.position.set(ENCL.xmin, terrainY(ENCL.xmin, z) + 1.25, z); d.rotation.set(0, 0, 0); d.scale.set(2.4, 1.45, 2.4); d.updateMatrix(); postMesh.setMatrixAt(i, d.matrix); }
    postMesh.castShadow = true; postMesh.receiveShadow = true; fence.add(postMesh);
    const wires = []; for (const [ax, az, bx, bz] of spans) { const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 3); for (let i = 0; i < n; i++) wires.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n, ax + (bx - ax) * (i + 1) / n, az + (bz - az) * (i + 1) / n]); }
    const heights = [.35, .75, 1.15, 1.55];
    const wireMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .022, .022), metal, wires.length * heights.length);
    let k = 0; for (const [ax, az, bx, bz] of wires) for (const h of heights) {
      const mx = (ax + bx) / 2, mz = (az + bz) / 2; d.position.set(mx, terrainY(mx, mz) + h - .04, mz); d.rotation.set(0, -Math.atan2(bz - az, bx - ax), 0); d.scale.set(Math.hypot(bx - ax, bz - az), 1, 1); d.updateMatrix(); wireMesh.setMatrixAt(k++, d.matrix);
    }
    fence.add(wireMesh);
  }

  // ----- Tentes de 1962 (emplacement indicatif) -----
  const tents = new THREE.Group(); scene.add(tents); const tentSpots = [];
  {
    const shape = new THREE.Shape(); shape.moveTo(-2.3, 0); shape.lineTo(-2.3, 1.55); shape.lineTo(0, 2.7); shape.lineTo(2.3, 1.55); shape.lineTo(2.3, 0); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 4.6, bevelEnabled: false }); geo.translate(0, 0, -2.3);
    const cloth = new THREE.MeshStandardMaterial({ map: noiseTexture('#8f8a6c', 17), color: 0xb3ad94, roughness: 1, side: THREE.DoubleSide });
    const door = new THREE.MeshStandardMaterial({ color: 0x3b382f, roughness: 1 });
    for (let row = 0; row < 11; row++) for (const x of [19, 31]) {
      const z = -66 + row * 12.5, y = terrainY(x, z);
      const t = new THREE.Mesh(geo, cloth); t.position.set(x, y, z); t.rotation.y = Math.PI / 2; t.castShadow = t.receiveShadow = true; tents.add(t);
      const dm = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.3), door); dm.position.set(x + (x < 25 ? 2.33 : -2.33), y + .65, z); dm.rotation.y = x < 25 ? Math.PI / 2 : -Math.PI / 2; tents.add(dm);
      tentSpots.push([x, z]);
    }
  }

  // ----- Mémorial (volume schématique, béton ocre rosé, à demi enterré) -----
  const memorial = new THREE.Group(); scene.add(memorial);
  {
    const M = MEMORIAL, bd = new Builder(); bd.ao = false; const conc = hex('#a9765e');
    const yAt = z => terrainY(25, z) + M.hSouth + (M.hNorth - M.hSouth) * (z - M.z0) / (M.z1 - M.z0);
    const base = -.6, P = M.patio / 2, px0 = 25 - P, px1 = 25 + P;
    const cuts = [M.z0, ...M.patios.flatMap(z => [z - P, z + P]), M.z1];
    // Toit (avec trois patios) et façades
    for (let i = 0; i < cuts.length - 1; i++) {
      const za = cuts[i], zb = cuts[i + 1], full = i % 2 === 0;
      const top = (x0, x1) => bd.quad([x0, yAt(za), za], [x0, yAt(zb), zb], [x1, yAt(zb), zb], [x1, yAt(za), za], [[x0 / 6, za / 6], [x0 / 6, zb / 6], [x1 / 6, zb / 6], [x1 / 6, za / 6]], conc);
      if (full) top(M.x0, M.x1); else { top(M.x0, px0); top(px1, M.x1); }
      for (const [x, s] of [[M.x0, -1], [M.x1, 1]]) {
        const q = [[x, base, za], [x, base, zb], [x, yAt(zb), zb], [x, yAt(za), za]];
        if (s > 0) bd.quad(q[0], q[3], q[2], q[1], [[0, 0], [0, 1], [1, 1], [1, 0]], conc.map(v => v * .96)); else bd.quad(...q, [[0, 0], [1, 0], [1, 1], [0, 1]], conc.map(v => v * .96));
      }
    }
    for (const [z, s] of [[M.z0, -1], [M.z1, 1]]) { const q = [[M.x0, base, z], [M.x1, base, z], [M.x1, yAt(z), z], [M.x0, yAt(z), z]]; if (s < 0) bd.quad(q[1], q[0], q[3], q[2], [[0, 0], [1, 0], [1, 1], [0, 1]], conc); else bd.quad(...q, [[0, 0], [1, 0], [1, 1], [0, 1]], conc); }
    // Patios : parois intérieures et sol de brique
    const floorY = -3.2;
    for (const zc of M.patios) {
      const za = zc - P, zb = zc + P, c2 = conc.map(v => v * .8);
      bd.quad([px0, floorY, za], [px0, floorY, zb], [px0, yAt(zb), zb], [px0, yAt(za), za], [[0, 0], [1, 0], [1, 1], [0, 1]], c2);
      bd.quad([px1, floorY, zb], [px1, floorY, za], [px1, yAt(za), za], [px1, yAt(zb), zb], [[0, 0], [1, 0], [1, 1], [0, 1]], c2);
      bd.quad([px1, floorY, za], [px0, floorY, za], [px0, yAt(za), za], [px1, yAt(za), za], [[0, 0], [1, 0], [1, 1], [0, 1]], c2);
      bd.quad([px0, floorY, zb], [px1, floorY, zb], [px1, yAt(zb), zb], [px0, yAt(zb), zb], [[0, 0], [1, 0], [1, 1], [0, 1]], c2);
    }
    const mem = new THREE.Mesh(bd.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .93, normalMap: earthN, normalScale: new THREE.Vector2(.25, .25), side: THREE.DoubleSide }));
    mem.castShadow = mem.receiveShadow = true; memorial.add(mem);
    const brickTile = brickMap.clone(); brickTile.repeat.set(5, 5); brickTile.needsUpdate = true;
    const brickFloor = new THREE.MeshStandardMaterial({ map: brickTile, color: 0xd8b9a4, roughness: .9 });
    for (const zc of M.patios) { const f = new THREE.Mesh(new THREE.PlaneGeometry(M.patio, M.patio), brickFloor); f.rotation.x = -Math.PI / 2; f.position.set(25, floorY + .01, zc); f.receiveShadow = true; memorial.add(f); }
    // Entrée en pente douce, côté sud
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(5, .2, 16), new THREE.MeshStandardMaterial({ color: 0x8a6656, roughness: .95 })); ramp.position.set(25, terrainY(25, M.z0 - 8) - .05, M.z0 - 7.5); ramp.rotation.x = -.06; memorial.add(ramp);
  }

  // ----- Végétation : touffes d'herbe sèche (vent) et buissons de garrigue -----
  const windU = { uTime: { value: 0 } };
  const inFootprint = (x, z, pad) => barracks.some(b => { const [lx, lz] = toLocal(b, x, z); return Math.abs(lx) < b.length / 2 + pad && Math.abs(lz) < b.width / 2 + pad; });
  const inMemorial = (x, z, pad = 0) => x > MEMORIAL.x0 - pad && x < MEMORIAL.x1 + pad && z > MEMORIAL.z0 - pad && z < MEMORIAL.z1 + pad;
  const onRoad = (x, z) => (x < -40 && Math.abs(z - ROAD_Z) < 3.5);
  let grass, grassBase = 0, grassTotal = 0;
  {
    const N = lowPower ? 26000 : 70000, EXTRA = lowPower ? 4000 : 9000;
    const geo = new THREE.BufferGeometry();
    const pos = [], uv = [];
    for (let k = 0; k < 2; k++) { const a = k * Math.PI / 2 + .3, cx = Math.cos(a) * .5, cz = Math.sin(a) * .5; pos.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 0, -cz, cx, 1, cz, -cx, 1, -cz); uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
    { const n = geo.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); }
    const mat = new THREE.MeshStandardMaterial({ map: grassTexture(), alphaTest: .45, side: THREE.DoubleSide, roughness: 1, color: 0xd6c9ae });
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = windU.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 ip = vec3(instanceMatrix[3][0], 0., instanceMatrix[3][2]);
float w = sin(uTime*1.6 + ip.x*.13 + ip.z*.09)*.6 + sin(uTime*2.7 + ip.x*.41)*.25;
transformed.x += position.y*position.y*.22*w; transformed.z += position.y*position.y*.12*w;`);
    };
    grass = new THREE.InstancedMesh(geo, mat, N + EXTRA); grass.frustumCulled = false; grass.receiveShadow = true;
    const r = rng(1939), d = new THREE.Object3D(), c = new THREE.Color();
    const n1 = (x, z) => .5 + .5 * Math.sin(x * .021 + Math.sin(z * .017) * 2.1) * Math.cos(z * .025 - x * .006);
    const place = (x, z, i, big) => { const s = (big ? .42 : .26) + r() * .38; d.position.set(x, terrainY(x, z) - .03, z); d.rotation.set(0, r() * 6.28, 0); d.scale.set(s * (1.2 + r() * .8), s * (.55 + r() * .6), s * (1.2 + r() * .8)); d.updateMatrix(); grass.setMatrixAt(i, d.matrix); c.setHSL(.09 + r() * .04, .12 + r() * .14, .50 + r() * .2); grass.setColorAt(i, c); };
    let i = 0, guard = 0;
    while (i < N && guard++ < N * 30) {
      const near = r() < .7, x = near ? (r() - .5) * 980 : (r() - .5) * GX, z = near ? (r() - .5) * 560 : (r() - .5) * GZ;
      const inside = x > ENCL.xmin && x < ENCL.xmax && z > ENCL.zmin && z < ENCL.zmax;
      let p = .25 + .75 * n1(x, z); if (inside) p *= .55; if (Math.abs(x - 25) < 22 && Math.abs(z) < 135) p *= .35;
      if (r() > p || inFootprint(x, z, 1.2) || inMemorial(x, z, 1) || onRoad(x, z)) continue;
      place(x, z, i++, !inside);
    }
    grassBase = i; let e = 0;
    while (e < EXTRA && guard++ < N * 40) { // touffes qui ont poussé dans les ruines (aujourd'hui)
      const b = barracks[Math.floor(r() * barracks.length)];
      const [x, z] = toWorld(b, (r() - .5) * (b.length + 6), (r() - .5) * (b.width + 6));
      place(x, z, i + e++, true);
    }
    grassTotal = i + e; grass.count = grassBase; grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    scene.add(grass);
    // Buissons bas
    const bgeo = new THREE.IcosahedronGeometry(1, 1); { const p = bgeo.attributes.position, rr = rng(4); for (let k = 0; k < p.count; k++) { const f = .8 + rr() * .4; p.setXYZ(k, p.getX(k) * f, Math.max(-.2, p.getY(k)) * f, p.getZ(k) * f); } bgeo.computeVertexNormals(); }
    const NB = lowPower ? 700 : 1600;
    const bushes = new THREE.InstancedMesh(bgeo, new THREE.MeshStandardMaterial({ color: 0x7c7a55, roughness: 1, flatShading: true }), NB);
    let j = 0; guard = 0;
    while (j < NB && guard++ < NB * 50) {
      const x = (r() - .5) * GX, z = (r() - .5) * GZ, inside = x > ENCL.xmin - 3 && x < ENCL.xmax + 3 && z > ENCL.zmin - 3 && z < ENCL.zmax + 3;
      if ((inside && r() > .12) || inFootprint(x, z, 2) || inMemorial(x, z, 2) || onRoad(x, z)) continue;
      const s = .35 + r() * .7; d.position.set(x, terrainY(x, z) + s * .15, z); d.rotation.set(0, r() * 6, 0); d.scale.set(s * (1 + r() * .5), s * (.45 + r() * .3), s * (1 + r() * .5)); d.updateMatrix(); bushes.setMatrixAt(j, d.matrix); c.setHSL(.15 + r() * .06, .18 + r() * .15, .32 + r() * .14); bushes.setColorAt(j, c); j++;
    }
    bushes.count = j; bushes.castShadow = !lowPower; bushes.receiveShadow = true; scene.add(bushes);
  }
  onProgress(.85, 'Lumière'); await tick();

  // ----- Collisions -----
  // Chaque obstacle est un rectangle orienté {x,z,yaw,hx,hz,tag}
  const obstacles = [];
  const ibHl = ib.length / 2, ibHw = ib.width / 2;
  for (const b of barracks) {
    if (b.id !== INTERIOR_BARRACK) { obstacles.push({ x: b.x, z: b.z, yaw: b.yaw, hx: b.length / 2 + .1, hz: b.width / 2 + .1, tag: 'barrack' }); continue; }
    const wallRect = (lx, lz, hx, hz, tag = 'barrack') => { const [x, z] = toWorld(b, lx, lz); obstacles.push({ x, z, yaw: b.yaw, hx, hz, tag }); };
    wallRect(0, ibHw - T / 2, ibHl, T / 2 + .05); wallRect(0, -ibHw + T / 2, ibHl, T / 2 + .05);
    wallRect(ibHl - T / 2, 0, T / 2 + .05, ibHw);
    const side = (ibHw - DOOR_W / 2) / 2; wallRect(-ibHl + T / 2, DOOR_W / 2 + side, T / 2 + .05, side); wallRect(-ibHl + T / 2, -DOOR_W / 2 - side, T / 2 + .05, side);
    for (const row of bunkRows) wallRect((row.x0 + row.x1) / 2, row.side * (ibHw - T - .55), (row.x1 - row.x0) / 2, .5, 'furniture');
    wallRect(4, 0, 1.6, 1.0, 'furniture');
  }
  const fenceRects = [
    { x: 0, z: ENCL.zmin, yaw: 0, hx: 440, hz: .15 }, { x: 0, z: ENCL.zmax, yaw: 0, hx: 440, hz: .15 },
    { x: ENCL.xmax, z: 0, yaw: 0, hx: .15, hz: 228 },
    { x: ENCL.xmin, z: (GATE.z1 + ENCL.zmax) / 2, yaw: 0, hx: .15, hz: (ENCL.zmax - GATE.z1) / 2 },
    { x: ENCL.xmin, z: (ENCL.zmin + GATE.z0) / 2, yaw: 0, hx: .15, hz: (GATE.z0 - ENCL.zmin) / 2 }].map(o => ({ ...o, tag: 'fence' }));
  const memRect = { x: 25, z: 0, yaw: 0, hx: 10.3, hz: 110.3, tag: 'memorial' };
  const tentRects = tentSpots.map(([x, z]) => ({ x, z, yaw: 0, hx: 2.5, hz: 2.5, tag: 'tent' }));
  let era = '1941';
  function hit(o, x, z, r) { const dx = x - o.x, dz = z - o.z, c = Math.cos(o.yaw), s = Math.sin(o.yaw); const lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) < o.hx + r && Math.abs(lz) < o.hz + r; }
  function blockedBy(x, z, r = .3) {
    if (Math.abs(x) > 640 || Math.abs(z) > 420) return 'edge';
    const interiorOn = era !== 'today' && era !== '1962';
    for (const o of obstacles) if ((o.tag !== 'furniture' || interiorOn) && hit(o, x, z, r)) return o.tag;
    if (era !== 'today') for (const o of fenceRects) if (hit(o, x, z, r)) return 'fence';
    if (era === 'today' && hit(memRect, x, z, r)) return 'memorial';
    if (era === '1962') for (const o of tentRects) if (hit(o, x, z, r)) return 'tent';
    return null;
  }
  const insideInterior = (x, z) => { const [lx, lz] = toLocal(ib, x, z); return Math.abs(lx) < ibHl - .05 && Math.abs(lz) < ibHw - .05; };
  const groundAt = (x, z) => insideInterior(x, z) ? ib.y + B : terrainY(x, z);

  // ----- Ambiances par période -----
  const MOODS = {
    clear: { cloud: .6, elev: 36, az: 205, sun: 0xfff1e0, sunI: 3.3, sky: 0xcfdcea, gnd: 0x8f7d63, hemiI: 1.0, fog: 0xc9d3db, dens: .0006, exp: .82, turb: 2.4, ray: 1.1, brick: 0xffffff, haze: .45 },
    internment: { cloud: .52, elev: 28, az: 215, sun: 0xffe2c2, sunI: 3.0, sky: 0xd2dbe4, gnd: 0x8a775e, hemiI: .95, fog: 0xc9ced2, dens: .0007, exp: .82, turb: 3.2, ray: 1.3, brick: 0xf2ece6, haze: .5 },
    deportation: { cloud: .45, elev: 15, az: 235, sun: 0xffc48e, sunI: 2.7, sky: 0xc9cfd6, gnd: 0x7a6a56, hemiI: .8, fog: 0xc4bdb6, dens: .0009, exp: .86, turb: 6, ray: 2.0, brick: 0xe6dcd3, haze: .58 },
    postwar: { cloud: .32, elev: 32, az: 190, sun: 0xf3efe6, sunI: 2.0, sky: 0xd0d6da, gnd: 0x837d73, hemiI: 1.3, fog: 0xc2c7c9, dens: .00085, exp: .86, turb: 8, ray: .9, brick: 0xe9e3dd, haze: .6 },
    families: { cloud: .58, elev: 24, az: 240, sun: 0xffd7a8, sunI: 3.0, sky: 0xd4dbe2, gnd: 0x8f7a5d, hemiI: .95, fog: 0xcfcdc6, dens: .0007, exp: .82, turb: 3.6, ray: 1.4, brick: 0xd9cdc2, haze: .5 },
    today: { cloud: .62, elev: 42, az: 200, sun: 0xfff6ea, sunI: 3.4, sky: 0xcddcea, gnd: 0x8e7f68, hemiI: 1.0, fog: 0xc6d2dc, dens: .00055, exp: .8, turb: 2.2, ray: 1.0, brick: 0xeee5dc, haze: .42 }
  };
  const sunDir = new THREE.Vector3();
  const fogCol = new THREE.Color();
  function applyMood(key) {
    const m = MOODS[key];
    sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - m.elev), THREE.MathUtils.degToRad(m.az));
    for (const s of [sky, skyCopy]) { const u = s.material.uniforms; u.turbidity.value = m.turb; u.rayleigh.value = m.ray; u.mieCoefficient.value = .004; u.mieDirectionalG.value = .78; u.sunPosition.value.copy(sunDir); }
    sun.color.setHex(m.sun); sun.intensity = m.sunI; hemi.color.setHex(m.sky); hemi.groundColor.setHex(m.gnd); hemi.intensity = m.hemiI; hemi.userData.base = m.hemiI;
    fogCol.setHex(m.fog); scene.fog.color.copy(fogCol); scene.fog.density = m.dens; renderer.toneMappingExposure = m.exp;
    brickMat.color.setHex(m.brick); cloudU.uCover.value = m.cloud; cloudU.uSun.value.setHex(m.sun).lerp(new THREE.Color(1, 1, 1), .6); cloudU.uShade.value.setHex(m.sky).multiplyScalar(.82);
    const tint = (top, bot) => new THREE.Color(top).lerp(fogCol, m.haze);
    farRidge.material.color.copy(tint(0xffffff)).lerp(new THREE.Color(0x8b9cab), .3);
    nearRidge.material.color.copy(new THREE.Color(0xffffff)).lerp(fogCol, m.haze * .4);
    sea.material.color.setHex(0x8aa3aa).lerp(fogCol, m.haze * .8);
    if (envRT) envRT.dispose(); envRT = pmrem.fromScene(skyScene, 0, .1, 2000); scene.environment = envRT.texture; scene.environmentIntensity = .55;
  }

  function setEra(key) {
    era = key;
    const today = key === 'today', d62 = key === '1962';
    groups.intact.visible = !today && !d62; groups.degraded.visible = d62; groups.ruin.visible = today;
    interior.visible = !today && !d62;
    fence.visible = !today; tents.visible = d62; memorial.visible = today;
    grass.count = today ? grassTotal : grassBase;
    const moodKey = { '1939': 'clear', '1941': 'internment', '1942': 'deportation', '1945': 'postwar', '1962': 'families', 'today': 'today' }[key];
    applyMood(moodKey);
  }

  // ----- Mise à jour par image : ombres qui suivent le regard, vent, intérieur -----
  let insideBlend = 0;
  function update(dt, focus, eye, aerial) {
    windU.uTime.value += dt; cloudU.uTime.value += dt;
    const extent = aerial ? Math.min(420, Math.max(60, eye.distanceTo(focus) * .55)) : 70;
    const cam = sun.shadow.camera;
    if (cam.right !== extent) { cam.left = -extent; cam.right = extent; cam.top = extent; cam.bottom = -extent; cam.near = 1; cam.far = 900; cam.updateProjectionMatrix(); }
    const texel = extent * 2 / sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
    sun.target.position.set(fx, focus.y, fz); sun.position.set(fx + sunDir.x * 400, focus.y + sunDir.y * 400, fz + sunDir.z * 400);
    const inside = !aerial && insideInterior(eye.x, eye.z) && interior.visible;
    insideBlend += ((inside ? 1 : 0) - insideBlend) * Math.min(1, dt * 3);
    hemi.intensity = (hemi.userData.base || 1) * (1 - .55 * insideBlend);
    interior.userData.glow.intensity = 6 * insideBlend;
    scene.environmentIntensity = .55 * (1 - .6 * insideBlend);
  }

  setEra('1941');
  onProgress(1, 'Prêt');

  const memorialRect = { x0: MEMORIAL.x0, x1: MEMORIAL.x1, z0: MEMORIAL.z0, z1: MEMORIAL.z1 };
  return {
    scene, setEra, update, blockedBy, groundAt, insideInterior, toWorld, toLocal, byId, barracks,
    map: { enclosure: ENCL, gate: GATE, road: ROAD_Z, memorial: memorialRect, tents: tentSpots, interiorId: INTERIOR_BARRACK },
    get era() { return era; }
  };
}
