// Huella, enquête à Rivesaltes : maquette 3D (moteur, commandes, périodes, plan) et missions.
import * as THREE from 'three';
import { createWorld } from './world.js';
import { ERAS, ERA_ORDER, STOPS, SOURCES } from './content.js';
import { TITLE, PIECES, BARTOLI, BARTOLI_ES, DRAWINGS, TEACHER_EMAIL, EPISODES, ES_STARTERS, ES_GRAMMAR } from './enquete.js';
import { emptyState, parseSave, wrapSave, unwrapSave, fileName, MAX_FILE } from './carnet.js';
import { makePdf } from './pdf.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
// Crée un élément ; le texte passe toujours par des nœuds texte, jamais par innerHTML.
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat(Infinity).filter(k => k != null && k !== false));
  return e;
}
const icon = id => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#' + id); s.append(u); return s; };
let toastTimer;
function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms); }

// ---------------------------------------------------------------- Travail de l'élève
const FIELDS = new Map();
EPISODES.forEach(ep => ep.missions.forEach((m, i) => (m.fields || []).forEach(f => FIELDS.set(f.id, { field: f, mission: m, ep, i }))));
const SCHEMA = { fields: [...FIELDS.keys()], pieces: PIECES.map(p => p.id), missions: Object.fromEntries(EPISODES.map(e => [e.id, e.missions.length])), eras: ERA_ORDER };
const PIECE = Object.fromEntries(PIECES.map(p => [p.id, p]));
const CHRONO_START = ['harkis', 'camp', 'memorial', 'deportation', 'retirada', 'liberation', 'baraque'];
const KEY = 'rivesaltes-traces-v1';
const local = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
};
let state = parseSave(local.get(KEY, ''), SCHEMA).state || emptyState();
if (!state.chrono.length) state.chrono = [...CHRONO_START];
let saveTimer;
function save(now) {
  clearTimeout(saveTimer);
  const run = () => { state.saved = new Date().toISOString(); if (!local.set(KEY, JSON.stringify(state))) toast('Enregistrement impossible sur cet appareil : télécharge ton carnet à la fin.'); };
  if (now) run(); else saveTimer = setTimeout(run, 400);
}
addEventListener('pagehide', () => save(true));
const answer = id => (state.answers[id] || '').trim();
const who = () => [state.ident.prenom, state.ident.nom].filter(Boolean).join(' ');

// Accueil : choix de l'épisode, puis carte de stagiaire si le nom manque.
const meta = e => { const r = state.reached[e.id]; return r ? `Reprendre · mission ${r + 1} sur ${e.missions.length}` : null; };
EPISODES.forEach(e => { const t = meta(e); if (t) $(`#${e.id}-meta`).textContent = t; });
$$('.ep-card').forEach(b => { b.disabled = false; b.addEventListener('click', () => chooseEp(b.dataset.ep)); });
$('.ep-card').focus();
let chosen = 'ep1', loaded = false, pending = false;
// L'élève choisit son épisode et tape son nom pendant que la maquette se construit ; on démarre dès qu'elle est prête.
function go() { if (loaded) return start(); pending = true; $('#loading').hidden = false; $('#loading .primary')?.focus(); }
function chooseEp(ep) {
  chosen = ep;
  if (state.ident.nom.trim() && state.ident.prenom.trim()) return go();
  $('#w-choose').hidden = true; $('#w-id').hidden = false;
  for (const k of ['prenom', 'nom', 'classe']) $('#id-' + k).value = state.ident[k];
  $('#id-prenom').focus();
}
$('#w-back').addEventListener('click', () => { $('#w-id').hidden = true; $('#w-choose').hidden = false; });
$('#w-id').addEventListener('submit', e => {
  e.preventDefault();
  for (const k of ['prenom', 'nom', 'classe']) state.ident[k] = $('#id-' + k).value.trim();
  save(true); go();
});
$('#w-import').addEventListener('click', () => chooseEp('ep2'));

// ---------------------------------------------------------------- Moteur 3D
const canvas = $('#view');
const lowPower = matchMedia('(max-width: 899px)').matches || (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const maxDPR = Math.min(devicePixelRatio || 1, lowPower ? 1.5 : 2);
let dpr = Math.min(maxDPR, lowPower ? 1.15 : 1.5);
const camera = new THREE.PerspectiveCamera(62, 1, .15, 60000); camera.rotation.order = 'YXZ';
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w < h ? 72 : 62; camera.updateProjectionMatrix(); drawMini();
}
let miniDirty = true;
addEventListener('resize', resize);

const loadBar = $('#load-bar'), loadText = $('#load-text');
const progress = (p, label) => {
  const pct = `${Math.round(8 + p * 88)}%`, text = label === 'Prêt' ? 'Maquette prête' : `Chargement · ${label.toLowerCase()}…`;
  loadBar.style.width = pct; loadText.textContent = text; $('#loading-bar').style.width = pct; $('#loading-text').textContent = text;
};
let world;
try {
  const plan = await (await fetch('./data/ilot_f.json')).json();
  world = await createWorld(renderer, { plan, lowPower, onProgress: progress });
} catch (err) {
  console.error(err); loadText.textContent = $('#loading-text').textContent = 'La maquette n’a pas pu se charger. Rouvre la page avec une connexion.'; throw err;
}

const S = {
  page: 'enquete', era: ERAS[local.get('rivesaltes.era', '')] ? local.get('rivesaltes.era', '') : '1939', mode: 'walk',
  p: { x: 0, z: 0, yaw: 0, pitch: 0, y: 0 },
  aerial: { tx: 0, tz: 0, dist: 520, az: 0, el: .78 },
  tween: null, walkTo: null, keys: new Set(), stick: null
};
let idle = true; // vue d'attente qui tourne lentement derrière l'écran d'accueil

const ring = new THREE.Mesh(new THREE.RingGeometry(.35, .5, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85, depthWrite: false }));
ring.rotation.x = -Math.PI / 2; ring.visible = false; world.scene.add(ring);

// ---------------------------------------------------------------- Poses
const STOP = Object.fromEntries(STOPS.map(s => [s.id, s]));
function stopPose(id) {
  const s = STOP[id]; let x, z, lx, lz, ly = 1.6;
  if (s.barrack) {
    const b = world.byId[s.barrack]; [x, z] = world.toWorld(b, ...s.local);
    if (s.lookLocal) [lx, lz] = world.toWorld(b, ...s.lookLocal);
    else { const t = world.byId[s.lookBarrack || s.barrack]; lx = t.x; lz = t.z; ly = 2.4; }
  } else { [x, z] = s.at; [lx, lz] = s.look; }
  const dx = lx - x, dz = lz - z, d = Math.hypot(dx, dz);
  return { x, z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(ly - 1.6, d) * .8 };
}
// Lieu à trouver pour une mission : un arrêt de content.js, ou la tente la plus proche.
function targetPose(m) {
  if (m.target !== 'tents') return stopPose(m.target);
  const [tx, tz] = world.map.tents.reduce((a, t) => Math.hypot(t[0] - S.p.x, t[1] - S.p.z) < Math.hypot(a[0] - S.p.x, a[1] - S.p.z) ? t : a);
  for (let r = 5; r < 30; r += 1.5) for (let a = 0; a < 6.28; a += .4) { const x = tx + Math.cos(a) * r, z = tz + Math.sin(a) * r; if (!world.blockedBy(x, z, .5)) return { x, z, yaw: Math.atan2(-(tx - x), -(tz - z)), pitch: -.1 }; }
  return { x: tx + 8, z: tz, yaw: 0, pitch: 0 };
}
function targetDistance(m) {
  if (m.target === 'tents') return S.era === '1962' ? Math.min(...world.map.tents.map(t => Math.hypot(t[0] - S.p.x, t[1] - S.p.z))) : Infinity;
  const p = stopPose(m.target); return Math.hypot(p.x - S.p.x, p.z - S.p.z);
}
const eyeOf = p => new THREE.Vector3(p.x, world.groundAt(p.x, p.z) + 1.6, p.z);
const quatOf = (yaw, pitch) => new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
function aerialEye(a) { const g = world.groundAt(a.tx, a.tz); return new THREE.Vector3(a.tx + Math.sin(a.az) * Math.cos(a.el) * a.dist, g + Math.sin(a.el) * a.dist, a.tz + Math.cos(a.az) * Math.cos(a.el) * a.dist); }
function aerialQuat(a) { const m = new THREE.Matrix4().lookAt(aerialEye(a), new THREE.Vector3(a.tx, world.groundAt(a.tx, a.tz), a.tz), new THREE.Vector3(0, 1, 0)); return new THREE.Quaternion().setFromRotationMatrix(m); }

function flyTo(target, onDone, dur) {
  const fromP = camera.position.clone(), fromQ = camera.quaternion.clone();
  const toP = target.mode === 'walk' ? eyeOf(target) : aerialEye(target);
  const toQ = target.mode === 'walk' ? quatOf(target.yaw, target.pitch) : aerialQuat(target);
  const dist = fromP.distanceTo(toP);
  S.tween = { t: 0, dur: dur ?? Math.min(2.4, .7 + dist / 260), fromP, fromQ, toP, toQ, arc: target.mode === 'walk' && S.mode === 'walk' ? Math.min(140, dist * .28) : 0, onDone };
  S.walkTo = null; ring.visible = false;
}
function setMode(mode) {
  S.mode = mode; document.body.dataset.mode = mode;
  const b = $('#mode-btn'); b.setAttribute('aria-pressed', String(mode === 'aerial'));
  b.setAttribute('aria-label', mode === 'aerial' ? 'Revenir à hauteur d’élève' : 'Vue aérienne');
  b.querySelector('use').setAttribute('href', mode === 'aerial' ? '#i-walk' : '#i-plane');
  $('#aerial-hint').hidden = mode !== 'aerial';
}
function goWalk(pose, dur) { flyTo({ mode: 'walk', ...pose }, () => { Object.assign(S.p, pose); S.p.y = 0; setMode('walk'); checkMission(); }, dur); }
function goAerial() {
  const fx = -Math.sin(S.p.yaw), fz = -Math.cos(S.p.yaw);
  Object.assign(S.aerial, { tx: S.p.x + fx * 60, tz: S.p.z + fz * 60, dist: 330, az: S.p.yaw, el: .72 });
  flyTo({ mode: 'aerial', ...S.aerial }, () => setMode('aerial'), 1.4); setMode('aerial');
}
$('#mode-btn').addEventListener('click', () => { if (S.mode === 'aerial') { goWalk({ ...S.p }, 1.3); setMode('walk'); } else goAerial(); });

// ---------------------------------------------------------------- Périodes
function setEra(key, { veil = true } = {}) {
  if (!ERAS[key]) return;
  const apply = () => {
    S.era = key; local.set('rivesaltes.era', key); world.setEra(key);
    $('#era-label').textContent = ERAS[key].date; renderEraList(); drawMini(); if (!$('#map-sheet').hidden) drawBig();
    refreshEraStatus();
    if (world.blockedBy(S.p.x, S.p.z) && S.mode !== 'aerial') // la nouvelle période bloque la position : on recule vers un espace libre
      for (let r = 2; r < 40; r += 2) for (let a = 0; a < 6.28; a += .5) { const x = S.p.x + Math.cos(a) * r, z = S.p.z + Math.sin(a) * r; if (!world.blockedBy(x, z)) { S.p.x = x; S.p.z = z; r = 99; break; } }
    checkMission();
  };
  if (veil) {
    $('#veil-date').textContent = ERAS[key].date; $('#veil-title').textContent = ERAS[key].title;
    $('#era-veil').classList.add('show'); setTimeout(apply, 380); setTimeout(() => $('#era-veil').classList.remove('show'), 1300);
  } else apply();
  showEraBanner(key);
}
let bannerTimer;
function showEraBanner(key) {
  const e = ERAS[key], b = $('#era-banner');
  $('#eb-date').textContent = e.date; $('#eb-title').textContent = e.title; $('#eb-text').textContent = e.text; b.hidden = false;
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.hidden = true, 7000);
}
$('#era-banner').addEventListener('click', () => $('#era-banner').hidden = true);
function renderEraList() {
  $('#era-list').replaceChildren(...ERA_ORDER.map(k => {
    const e = ERAS[k];
    return h('button', { class: 'era-item', 'aria-pressed': String(k === S.era), onclick: () => { closeSheets(); if (k !== S.era) setEra(k); } },
      h('b', {}, e.label), h('span', {}, h('strong', {}, e.title), h('span', { class: 't' }, e.text)));
  }));
}
$('#era-btn').addEventListener('click', () => openSheet('#era-sheet'));

// ---------------------------------------------------------------- Missions
const EP = id => EPISODES.find(e => e.id === id);
let cur = { ep: 'ep1', i: 0 };
try { const c = JSON.parse(local.get('rivesaltes.cur', 'null')); if (c && EP(c.ep) && c.i >= 0 && c.i <= state.reached[c.ep]) cur = c; } catch { }
const hintLevel = {};
const mission = () => EP(cur.ep).missions[cur.i];
const filled = m => (m.fields || []).every(f => answer(f.id));
const found = m => !m.piece || state.found.includes(m.piece);
function blocker(m) { // ce qui empêche de passer à la mission suivante (rien = on peut avancer)
  if (m.kind === 'find' && !found(m)) return 'Trouve d’abord le lieu dans la maquette.';
  if ((m.kind === 'find' || m.kind === 'piece') && !answer(m.fields[0].id)) return 'Écris ta réponse pour ranger la pièce dans le dossier.';
  if (m.kind === 'chrono' && !state.chronoChecked) return 'Vérifie ton ordre pour continuer.';
  if (m.kind === 'mark' && !state.mark) return 'Pose ton repère dans la maquette pour continuer.';
  return '';
}
function goMission(ep, i) {
  const e = EP(ep); cur = { ep, i: Math.max(0, Math.min(i, state.reached[ep], e.missions.length - 1)) };
  local.set('rivesaltes.cur', JSON.stringify(cur));
  $('#brand-ep').textContent = `Épisode ${e.num} · ${e.moment}`;
  renderMission(); toggleMission(true); updatePins(); drawMini();
}
function advance() {
  const e = EP(cur.ep);
  if (cur.i >= e.missions.length - 1) return;
  const m = mission();
  if (m.kind === 'piece' && !state.found.includes(m.piece)) { state.found.unshift(m.piece); updateCount(); }
  state.reached[cur.ep] = Math.max(state.reached[cur.ep], cur.i + 1); save();
  goMission(cur.ep, cur.i + 1);
  $('#m-toggle').focus();
}
function toggleMission(open) { const m = $('#mission'); const o = open ?? m.dataset.open !== 'true'; m.dataset.open = String(o); $('#m-toggle').setAttribute('aria-expanded', String(o)); }
$('#m-toggle').addEventListener('click', () => toggleMission());
$('#m-prev').addEventListener('click', () => goMission(cur.ep, cur.i - 1));
$('#m-next').addEventListener('click', () => { if (cur.i < state.reached[cur.ep]) goMission(cur.ep, cur.i + 1); });

// Champs de réponse
function textField(f) {
  const id = 'f-' + f.id, hint = f.hint ? 'h-' + f.id : null;
  const t = h('textarea', { id, rows: f.rows || 3, 'aria-describedby': hint, lang: f.lang || null, spellcheck: 'true' });
  t.value = state.answers[f.id] || '';
  t.addEventListener('input', () => { state.answers[f.id] = t.value; save(); updateFooter(); });
  return h('div', { class: 'field' },
    h('label', { for: id }, f.label),
    f.before && memo('Avant la visite, tu avais écrit', f.before),
    hint && h('p', { class: 'hint', id: hint }, f.hint), t);
}
function memo(tag, id) { const t = answer(id); return h('div', { class: 'memo' }, h('span', { class: 'eyebrow' }, tag), t ? h('p', {}, t) : h('p', { class: 'none' }, 'Pas de réponse retrouvée.')); }
function identFields() {
  return h('div', { class: 'id-grid' }, [['prenom', 'Prénom', 'given-name'], ['nom', 'Nom', 'family-name'], ['classe', 'Classe', 'off']].map(([k, label, auto]) => {
    const i = h('input', { autocomplete: auto, maxlength: 80 }); i.value = state.ident[k];
    i.addEventListener('input', () => { state.ident[k] = i.value; save(); });
    return h('label', {}, label, i);
  }));
}
const esChips = list => h('ul', { class: 'es', lang: 'es' }, list.map(([es, fr]) => h('li', {}, h('b', {}, es), h('span', { lang: 'fr' }, fr))));
function pieceCard(p) {
  return h('article', { class: 'piece' }, h('span', { class: 'eyebrow' }, `Pièce du dossier · ${p.date}`), h('h3', {}, p.title), h('p', {}, p.text),
    h('p', { class: 'es-title' }, 'En español'), esChips(p.es));
}

// Contenu propre à chaque type de mission
const BODY = {
  find(m) {
    if (found(m)) return [pieceCard(PIECE[m.piece]), m.fields.map(textField)];
    const lvl = hintLevel[m.id] || 0;
    const help = lvl < m.hints.length
      ? h('button', { class: 'secondary', onclick: () => { hintLevel[m.id] = lvl + 1; renderMission(); updatePins(); drawMini(); } }, icon('i-bulb'), `Un indice (${lvl + 1}/${m.hints.length})`)
      : h('button', { class: 'secondary', onclick: () => { if (S.era !== m.era) setEra(m.era); setTimeout(() => goWalk(targetPose(m)), 450); } }, icon('i-go'), 'M’y conduire');
    return [
      h('div', { class: 'objective' }, h('span', { class: 'eyebrow' }, 'Objectif'), h('p', {}, 'Trouve ce lieu dans la maquette, à la bonne époque.'),
        h('p', { class: 'era-now', id: 'era-now' })),
      m.hints.slice(0, lvl).map((t, k) => h('p', { class: 'hint-line' }, icon('i-bulb'), `Indice ${k + 1} : ${t}`)),
      lvl >= 2 && h('p', { class: 'hint-line' }, icon('i-flag'), 'Un repère « ? » marque maintenant l’endroit dans la maquette et sur le plan.'),
      h('div', { class: 'row' }, help)
    ];
  },
  piece: m => [pieceCard(PIECE[m.piece]), m.fields.map(textField)],
  chrono(m) {
    const msg = h('p', { class: 'notice', role: 'status' }); msg.hidden = !state.chronoChecked;
    const list = () => {
      let good = 0;
      const ol = h('ol', { class: 'chrono' }, state.chrono.map((id, i) => {
        const p = PIECE[id], ok = PIECES[i].id === id; if (ok) good++;
        const move = d => () => {
          [state.chrono[i], state.chrono[i + d]] = [state.chrono[i + d], state.chrono[i]]; save();
          const fresh = list(); ol.replaceWith(fresh);
          const li = fresh.children[i + d]; (li.querySelector(`[data-d="${d}"]:not(:disabled)`) || li.querySelector('button:not(:disabled)')).focus();
        };
        return h('li', { class: state.chronoChecked ? (ok ? 'ok' : 'ko') : '' },
          h('div', {}, state.chronoChecked && h('span', { class: 'date' }, p.date), h('strong', {}, p.title), state.chronoChecked && h('span', { class: 'mark' }, ok ? 'Bien placée' : 'À déplacer')),
          h('div', { class: 'moves' },
            h('button', { 'data-d': -1, 'aria-label': `Monter « ${p.title} »`, disabled: i === 0, onclick: move(-1) }, '↑'),
            h('button', { 'data-d': 1, 'aria-label': `Descendre « ${p.title} »`, disabled: i === state.chrono.length - 1, onclick: move(1) }, '↓')));
      }));
      msg.textContent = good === PIECES.length ? 'Le dossier est en ordre.' : `${good} pièce${good > 1 ? 's' : ''} sur ${PIECES.length} à la bonne place. Les dates sont visibles : déplace les pièces marquées « À déplacer ».`;
      return ol;
    };
    return [list(), h('div', { class: 'row' }, h('button', { class: 'secondary', onclick: () => { state.chronoChecked = true; save(); renderMission(); } }, icon('i-check'), 'Vérifier mon ordre')), msg, m.fields.map(textField)];
  },
  bartoli(m) {
    const d = DRAWINGS[m.drawing];
    return [
      !m.again && h('div', { class: 'fiches' }, BARTOLI.map(f => h('details', { class: 'fiche' + (f.caution ? ' caution' : ''), open: true }, h('summary', {}, f.title), h('p', {}, f.text)))),
      h('figure', { class: 'drawing' },
        h('button', { class: 'art', 'aria-label': `Agrandir : ${d.title}`, onclick: () => openArt(d) }, h('img', { src: d.src, alt: d.alt })),
        h('figcaption', {}, h('b', {}, d.title), ' · ', d.credit, ' Touche le dessin pour l’agrandir.')),
      h('p', { class: 'es-title' }, 'En español'), esChips(BARTOLI_ES),
      m.fields.map(textField)
    ];
  },
  write(m) {
    return [
      m.recall && h('div', { class: 'memos' }, m.recall.map(id => memo(`${FIELDS.get(id).ep.moment} · ${FIELDS.get(id).field.label}`, id))),
      m.showChrono && h('ol', { class: 'chrono static' }, PIECES.map(p => h('li', {}, h('div', {}, h('span', { class: 'date' }, p.date), h('strong', {}, p.title))))),
      m.fields.map(textField)
    ];
  },
  mark(m) {
    const info = state.mark ? `Ton repère : près de la baraque n° ${state.mark.barrack}, en ${ERAS[state.mark.era].date}.` : 'Pas encore de repère.';
    return [h('p', { class: 'objective' }, info),
      h('div', { class: 'row' }, h('button', { class: 'secondary', onclick: placeMark }, icon('i-flag'), state.mark ? 'Déplacer mon repère ici' : 'Poser mon repère ici')),
      m.fields.map(textField)];
  },
  import() {
    const n = SCHEMA.fields.filter(f => f.startsWith('e1_') && answer(f)).length;
    const paste = h('textarea', { rows: 3, placeholder: 'Colle ici tout le texte de ton mail…', 'aria-label': 'Texte du mail envoyé à ton professeur' });
    return [
      n ? h('div', { class: 'notice ok' }, h('p', {}, h('b', {}, 'Ton travail de l’épisode 1 est bien là '), `(${n} réponse${n > 1 ? 's' : ''}, ${state.found.length} pièce${state.found.length > 1 ? 's' : ''} du dossier).`), h('p', {}, 'Tu n’as rien à faire : passe à la mission suivante.'))
        : h('div', { class: 'notice' }, h('p', {}, h('b', {}, 'Ton travail de l’épisode 1 n’est pas sur cet appareil.')), h('p', {}, 'Tu l’as fait sur un autre appareil ? Retrouve-le ci-dessous. Sinon, continue : les rappels de l’épisode 1 resteront vides.')),
      importMsg && h('p', { class: 'notice ' + importMsg.kind, role: importMsg.kind === 'error' ? 'alert' : 'status' }, importMsg.text),
      h('details', { class: 'rescue', open: !n || importMsg?.kind === 'error' },
        h('summary', {}, 'J’ai changé d’appareil ou de navigateur'),
        h('ol', { class: 'steps' },
          h('li', {}, 'Ouvre ta messagerie, dans les messages ', h('b', {}, 'envoyés'), ' : retrouve le mail de l’épisode 1 envoyé à ton professeur.'),
          h('li', {}, 'Copie tout le texte du mail, puis colle-le ici.')),
        paste,
        h('div', { class: 'row' },
          h('button', { class: 'secondary', onclick: () => { importMsg = importText(paste.value); renderMission(); } }, icon('i-upload'), 'Retrouver mon travail'),
          h('button', { class: 'link', onclick: () => pickPdf(() => renderMission()) }, 'ou ouvrir mon carnet PDF'))),
      h('p', { class: 'es-title' }, 'Mon identité'), identFields()
    ];
  },
  spanish(m) {
    const words = [...PIECES.filter(p => state.found.includes(p.id)).flatMap(p => p.es), ...BARTOLI_ES];
    const field = textField(m.fields[0]), t = field.querySelector('textarea');
    const insert = s => { const a = t.selectionStart ?? t.value.length; const before = t.value.slice(0, a), sep = before && !/\s$/.test(before) ? ' ' : ''; t.value = before + sep + s + t.value.slice(a); t.dispatchEvent(new Event('input')); t.focus(); };
    return [
      h('p', { class: 'es-title' }, 'Mi léxico'), esChips(words),
      h('p', { class: 'es-title' }, 'Para empezar tus frases'),
      h('div', { class: 'starters', lang: 'es' }, ES_STARTERS.map(s => h('button', { type: 'button', onclick: () => insert(s.split('…')[0].split(' / ')[0]) }, s))),
      h('p', { class: 'hint' }, ES_GRAMMAR), field
    ];
  },
  export(m) {
    const e = EP(cur.ep), missing = e.missions.map((x, i) => ({ x, i, n: (x.fields || []).filter(f => !answer(f.id)).length })).filter(o => o.n);
    return [
      !(state.ident.nom.trim() && state.ident.prenom.trim()) && h('div', { class: 'notice error' }, h('p', {}, 'Indique ton prénom et ton nom : ils servent à nommer ton carnet.'), identFields()),
      h('ol', { class: 'steps' },
        h('li', {}, 'Appuie sur « Envoyer à mon professeur » : tes réponses sont copiées et ta messagerie s’ouvre.'),
        h('li', {}, 'Si le message est vide, colle tes réponses : Ctrl+V (Cmd+V sur Mac, appui long puis Coller sur téléphone).'),
        h('li', {}, 'Envoie.')),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => sendWork(e) }, icon('i-send'), h('span', {}, 'Envoyer à mon professeur'))),
      h('p', { class: 'small' }, 'Ta messagerie ne s’ouvre pas (Gmail, Outlook… dans le navigateur) ? Ouvre-la toi-même et écris à ', h('b', { class: 'mono' }, TEACHER_EMAIL), ' ',
        h('button', { class: 'link', onclick: () => copy(TEACHER_EMAIL, 'Adresse copiée') }, 'copier l’adresse'), ', puis ',
        h('button', { class: 'link', onclick: () => copy(workText(e), 'Réponses copiées : colle-les dans ton message') }, 'copie tes réponses'), ' et colle-les dans le message.'),
      e.num === 1 && h('p', { class: 'small' }, 'Ton travail reste enregistré ici. Fais l’épisode 2 sur cet appareil, dans le même navigateur : il reprendra tout seul.'),
      missing.length ? h('details', { class: 'rescue' }, h('summary', {}, `${missing.reduce((a, o) => a + o.n, 0)} question(s) encore sans réponse`),
        h('ul', {}, missing.map(o => h('li', {}, o.i <= state.reached[cur.ep] ? h('button', { class: 'link', onclick: () => goMission(cur.ep, o.i) }, o.x.title) : o.x.title, ` (${o.n})`))),
        h('p', { class: 'small' }, 'Tu peux quand même envoyer ton travail.'))
        : h('p', { class: 'notice ok' }, 'Toutes les questions ont une réponse.'),
      h('details', { class: 'rescue' }, h('summary', {}, 'Autres options'),
        h('div', { class: 'row' }, h('button', { class: 'secondary', onclick: () => downloadPdf(e) }, icon('i-download'), `Télécharger mon ${e.pdfTitle.toLowerCase()} (PDF)`)))
    ];
  }
};

function renderMission() {
  const e = EP(cur.ep), m = mission(), n = e.missions.length;
  $('#m-num').textContent = cur.i + 1;
  $('#m-count').textContent = `Mission ${cur.i + 1} sur ${n}`;
  $('#m-title').textContent = m.title;
  $('#m-prev').disabled = cur.i === 0;
  $('#m-next').disabled = cur.i >= state.reached[cur.ep];
  $('#mission').dataset.kind = m.kind;
  $('#mission').classList.toggle('solved', !blocker(m) && m.kind !== 'export');
  const body = $('#m-body');
  body.replaceChildren(...[
    h('p', { class: 'brief' + (m.kind === 'find' ? ' doc' : '') }, m.brief),
    BODY[m.kind](m),
    h('div', { class: 'm-foot' }, h('p', { class: 'small', id: 'm-why' }),
      cur.i < n - 1 && h('button', { class: 'primary', id: 'm-advance', onclick: advance }, h('span', {}, m.piece && cur.i >= state.reached[cur.ep] ? 'Ranger la pièce' : 'Mission suivante'), icon('i-go')))
  ].flat(Infinity).filter(Boolean));
  body.scrollTop = 0;
  refreshEraStatus(); updateFooter(); updateCount();
}
function updateFooter() {
  const why = blocker(mission()), b = $('#m-advance');
  if (b) b.disabled = !!why;
  const w = $('#m-why'); if (w) w.textContent = why;
  $('#mission').classList.toggle('solved', !why && mission().kind !== 'export');
}
function refreshEraStatus() { const el = $('#era-now'); if (el) el.textContent = `Période affichée : ${ERAS[S.era].date}`; }
function updateCount() { $('#piece-count').textContent = `${state.found.length}/${PIECES.length}`; }

// Détection : le lieu de la mission est atteint, à la bonne époque ?
let wrongEraToast = 0;
function checkMission() {
  const m = mission();
  if (m.kind !== 'find' || found(m) || S.mode !== 'walk' || S.tween) return;
  const near = m.target === 'tents' && S.era !== '1962' ? false : targetDistance(m) < m.radius;
  if (near && S.era === m.era) return foundPiece(m);
  const p = m.target === 'tents' ? null : stopPose(m.target);
  if (p && Math.hypot(p.x - S.p.x, p.z - S.p.z) < m.radius && performance.now() - wrongEraToast > 6000) {
    wrongEraToast = performance.now(); toast('Bon endroit… mais le document parle d’une autre date. Change de période.');
  }
}
function foundPiece(m) {
  state.found.push(m.piece); save(true);
  $('#stamp-title').textContent = PIECE[m.piece].title;
  const st = $('#stamp'); st.classList.remove('show'); void st.offsetWidth; st.classList.add('show');
  renderMission(); toggleMission(true); updatePins(); drawMini();
  toast(`Pièce ${state.found.length} sur ${PIECES.length} retrouvée`);
}
function placeMark() {
  if (S.mode !== 'walk') { toast('Descends au sol pour poser ton repère.'); return; }
  const b = world.barracks.reduce((a, x) => Math.hypot(x.x - S.p.x, x.z - S.p.z) < Math.hypot(a.x - S.p.x, a.z - S.p.z) ? x : a);
  state.mark = { x: Math.round(S.p.x * 10) / 10, z: Math.round(S.p.z * 10) / 10, era: S.era, barrack: b.id }; save();
  renderMission(); updatePins(); toast('Repère posé');
}

// ---------------------------------------------------------------- Repères dans la scène
const FIND = EPISODES[0].missions.map((m, i) => ({ m, i })).filter(o => o.m.kind === 'find');
const pins = FIND.map(({ m, i }) => {
  const b = h('button', { class: 'pin', 'aria-label': m.title, onclick: ev => { ev.stopPropagation(); if (found(m)) { showPage('enquete'); goMission('ep1', i); } } },
    h('span', { class: 'bubble' }, h('b', {}, '?')), h('span', { class: 'label' }, m.title));
  $('#pins').append(b);
  return { el: b, m, pos: new THREE.Vector3() };
});
const markPin = h('button', { class: 'pin flag', 'aria-label': 'Mon repère' }, h('span', { class: 'bubble' }, icon('i-flag')), h('span', { class: 'label' }, 'Mon repère'));
$('#pins').append(markPin);
function updatePins() {
  const m = mission();
  for (const p of pins) {
    const done = found(p.m), hinted = p.m === m && (hintLevel[m.id] || 0) >= 2;
    p.show = cur.ep === 'ep1' && (done || hinted);
    p.el.classList.toggle('visited', done); p.el.classList.toggle('current', hinted && !done);
    p.el.querySelector('b').textContent = done ? '✓' : '?';
    p.el.querySelector('.label').textContent = done ? PIECE[p.m.piece].title : p.m.title;
    const t = p.m.target === 'tents' ? (() => { const [x, z] = world.map.tents[0]; return { x, z }; })() : stopPose(p.m.target);
    p.pos.set(t.x, world.groundAt(t.x, t.z) + (p.m.target === 'interieur' ? 2.6 : 3.2), t.z);
  }
}

// ---------------------------------------------------------------- Plan
const mini = $('#minimap'), big = $('#bigmap');
const MAPB = { x0: -452, x1: 452, z0: -240, z1: 240 };
function drawPlan(cv, { labels, scaleUp } = {}) {
  const r = cv.getBoundingClientRect(); const k = Math.min(2, devicePixelRatio || 1);
  if (r.width) { cv.width = Math.round(r.width * k); cv.height = Math.round(r.height * k); }
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  const sc = Math.min(W / (MAPB.x1 - MAPB.x0), H / (MAPB.z1 - MAPB.z0)), ox = W / 2, oz = H / 2;
  const X = x => ox + x * sc, Z = z => oz - z * sc;
  const today = S.era === 'today', m = world.map;
  ctx.fillStyle = '#d7cbb4'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e2d7c3'; ctx.fillRect(X(m.enclosure.xmin), Z(m.enclosure.zmax), (m.enclosure.xmax - m.enclosure.xmin) * sc, (m.enclosure.zmax - m.enclosure.zmin) * sc);
  ctx.strokeStyle = today ? 'rgba(90,80,66,.35)' : '#5a5042'; ctx.lineWidth = Math.max(1, sc * 2.2); ctx.setLineDash(today ? [4, 4] : []);
  ctx.strokeRect(X(m.enclosure.xmin), Z(m.enclosure.zmax), (m.enclosure.xmax - m.enclosure.xmin) * sc, (m.enclosure.zmax - m.enclosure.zmin) * sc); ctx.setLineDash([]);
  ctx.fillStyle = '#e2d7c3'; ctx.fillRect(X(m.enclosure.xmin) - 3, Z(m.gate.z1), 6, (m.gate.z1 - m.gate.z0) * sc);
  ctx.fillStyle = 'rgba(160,140,110,.35)'; ctx.fillRect(X(-440), Z(m.road + 3), 400 * sc, 6 * sc);
  for (const b of world.barracks) {
    const hl = b.length / 2, hw = b.width / 2, c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    const pts = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([lx, lz]) => [b.x + lx * c + lz * s, b.z - lx * s + lz * c]);
    ctx.beginPath(); pts.forEach(([x, z], i) => i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))); ctx.closePath();
    ctx.fillStyle = today ? 'rgba(139,90,66,.35)' : b.id === m.interiorId ? '#e3a476' : '#8b5a42'; ctx.fill();
    if (today) { ctx.strokeStyle = '#8b5a42'; ctx.lineWidth = 1; ctx.stroke(); }
  }
  if (S.era === '1962') { ctx.fillStyle = '#7d7a5a'; for (const [x, z] of m.tents) ctx.fillRect(X(x - 2.3), Z(z + 2.3), 4.6 * sc, 4.6 * sc); }
  if (today) { ctx.fillStyle = '#a9765e'; ctx.fillRect(X(m.memorial.x0), Z(m.memorial.z1), (m.memorial.x1 - m.memorial.x0) * sc, (m.memorial.z1 - m.memorial.z0) * sc); }
  // Pièces retrouvées, zone indiquée par l'indice, repère de l'élève
  for (const p of pins) if (p.show) {
    const x = X(p.pos.x), z = Z(p.pos.z), rr = (labels ? 11 : 6) * k, hinted = p.el.classList.contains('current');
    if (hinted) { ctx.beginPath(); ctx.arc(x, z, (p.m.radius + 6) * sc + 6 * k, 0, 7); ctx.fillStyle = 'rgba(199,121,63,.25)'; ctx.fill(); ctx.strokeStyle = '#c7793f'; ctx.lineWidth = 2 * k; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(x, z, rr, 0, 7); ctx.fillStyle = hinted ? '#c7793f' : '#3d4a40'; ctx.fill(); ctx.lineWidth = 1.5 * k; ctx.strokeStyle = 'rgba(30,25,20,.6)'; ctx.stroke();
    if (labels) { ctx.fillStyle = hinted ? '#1c1712' : '#93c29f'; ctx.font = `700 ${12 * k}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(hinted ? '?' : '✓', x, z + .5); }
  }
  if (cur.ep === 'ep2' && state.mark) { ctx.fillStyle = '#e0b36a'; ctx.beginPath(); ctx.arc(X(state.mark.x), Z(state.mark.z), (labels ? 8 : 4) * k, 0, 7); ctx.fill(); }
  const yaw = S.mode === 'aerial' ? S.aerial.az : S.p.yaw, px = S.mode === 'aerial' ? S.aerial.tx : S.p.x, pz = S.mode === 'aerial' ? S.aerial.tz : S.p.z;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), a = (scaleUp ? 15 : 9) * k;
  ctx.save(); ctx.translate(X(px), Z(pz)); ctx.rotate(Math.atan2(-fz, fx));
  ctx.beginPath(); ctx.moveTo(a, 0); ctx.lineTo(-a * .7, a * .65); ctx.lineTo(-a * .35, 0); ctx.lineTo(-a * .7, -a * .65); ctx.closePath();
  ctx.fillStyle = '#c7793f'; ctx.fill(); ctx.lineWidth = 1.6 * k; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
  return { X, Z, sc };
}
function drawMini() { miniDirty = true; }
let bigGeom = null;
function drawBig() { bigGeom = drawPlan(big, { labels: true, scaleUp: true }); }
function renderLegend() {
  const items = [['#8b5a42', S.era === 'today' ? 'Ruines des baraques' : 'Baraques (plan de 1939)'], ['#e3a476', 'Baraque témoin']];
  if (S.era === '1962') items.push(['#7d7a5a', 'Tentes (emplacement indicatif)']);
  if (S.era === 'today') items.push(['#a9765e', 'Mémorial (volume simplifié)']);
  items.push(['#3d4a40', 'Pièce retrouvée'], ['#c7793f', 'Toi, et la zone de l’indice']);
  $('#map-legend').replaceChildren(...items.map(([c, t]) => h('span', {}, h('i', { style: `background:${c}` }), t)));
}
$('#minimap-btn').addEventListener('click', () => { openSheet('#map-sheet'); requestAnimationFrame(() => { drawBig(); renderLegend(); }); });
big.addEventListener('click', e => {
  if (!bigGeom) return; const r = big.getBoundingClientRect(), k = big.width / r.width, mx = (e.clientX - r.left) * k, mz = (e.clientY - r.top) * k;
  const x = (mx - big.width / 2) / bigGeom.sc, z = -(mz - big.height / 2) / bigGeom.sc;
  if (world.blockedBy(x, z, .4)) { toast('Cet endroit est occupé : choisis un espace libre.'); return; }
  closeSheets(); goWalk({ x, z, yaw: S.p.yaw, pitch: 0 });
});

// ---------------------------------------------------------------- Feuilles et pages
function openSheet(sel) { closeSheets(); $('#sheet-backdrop').hidden = false; const s = $(sel); s.hidden = false; s.querySelector('[data-close]')?.focus(); }
function closeSheets() { $$('.sheet').forEach(s => s.hidden = true); $('#sheet-backdrop').hidden = true; }
$('#sheet-backdrop').addEventListener('click', closeSheets);
$$('[data-close]').forEach(b => b.addEventListener('click', closeSheets));
addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheets(); $('#help').hidden = true; if (tourI >= 0) endTour(false); } });
$('#about-btn').addEventListener('click', () => openSheet('#about-sheet'));
$('#sources').replaceChildren(...SOURCES.map(s => h('li', {}, h('a', { href: s.url, target: '_blank', rel: 'noreferrer' }, s.label))));
function showPage(p) {
  S.page = p; document.body.dataset.page = p;
  $$('#tabs [data-tab]').forEach(b => b.setAttribute('aria-current', b.dataset.tab === p ? 'page' : 'false'));
  $('#dossier').hidden = p !== 'dossier';
  if (p === 'dossier') { renderDossier(); $('#dossier').scrollTop = 0; $('#dossier').focus({ preventScroll: true }); }
  if (p === 'enquete') { lastT = performance.now(); resize(); }
}
$$('#tabs [data-tab]').forEach(b => b.addEventListener('click', () => showPage(b.dataset.tab)));

// Le dossier : pièces, missions, lexique, carnet
function renderDossier() {
  const words = [...PIECES.filter(p => state.found.includes(p.id)).flatMap(p => p.es), ...(state.reached.ep1 >= EPISODES[0].missions.findIndex(m => m.kind === 'bartoli') ? BARTOLI_ES : [])];
  $('#dossier-inner').replaceChildren(
    h('header', { class: 'page-head' }, h('span', { class: 'eyebrow' }, 'Archives du Mémorial · îlot F'), h('h1', {}, 'Mon dossier'),
      h('p', {}, who() ? `Enquête menée par ${who()}${state.ident.classe ? ', ' + state.ident.classe : ''}.` : 'Les pièces que tu as retrouvées, tes missions et ton carnet.')),
    h('div', { class: 'meter', role: 'img', 'aria-label': `${state.found.length} pièces sur ${PIECES.length}` }, PIECES.map(p => h('span', { class: state.found.includes(p.id) ? 'on' : '' })),
      h('b', {}, `${state.found.length} pièce${state.found.length > 1 ? 's' : ''} sur ${PIECES.length}`)),
    h('div', { class: 'pieces' }, PIECES.map(p => {
      const m = EPISODES[0].missions.find(x => x.piece === p.id), i = EPISODES[0].missions.indexOf(m);
      if (!state.found.includes(p.id)) return h('article', { class: 'piece locked' }, icon('i-lock'), h('h3', {}, 'Pièce manquante'), h('p', {}, `Mission : ${m.title}`));
      const note = answer(m.fields[0].id);
      return h('article', { class: 'piece' }, h('span', { class: 'eyebrow' }, p.date), h('h3', {}, p.title), h('p', {}, p.text),
        note && h('div', { class: 'memo' }, h('span', { class: 'eyebrow' }, 'Ma note'), h('p', {}, note)),
        h('button', { class: 'link', onclick: () => { showPage('enquete'); goMission('ep1', i); } }, 'Revoir la mission'));
    })),
    words.length && h('section', {}, h('h2', {}, 'Mi léxico'), esChips(words)),
    h('section', {}, h('h2', {}, 'Missions'), EPISODES.map(e => h('div', { class: 'ep-list' },
      h('h3', {}, `Épisode ${e.num} · ${e.title}`), h('span', { class: 'small' }, `${e.moment} · ${e.duration}`),
      h('ol', {}, e.missions.map((m, i) => {
        const open = i <= state.reached[e.id], done = open && !blocker(m) && filled(m) && found(m);
        return h('li', { class: done ? 'done' : '' }, open
          ? h('button', { class: 'link', onclick: () => { showPage('enquete'); goMission(e.id, i); } }, m.title)
          : h('span', { class: 'muted' }, icon('i-lock'), m.title));
      }))))),
    h('section', { class: 'actions' }, h('h2', {}, 'Mon carnet'),
      h('p', {}, 'Un seul fichier par épisode, à remettre à ton professeur. Celui de l’épisode 1 contient aussi ta sauvegarde.'),
      h('div', { class: 'row' },
        EPISODES.map(e => h('button', { class: 'secondary', onclick: () => downloadPdf(e) }, icon('i-download'), `Carnet de l’épisode ${e.num}`)),
        h('button', { class: 'secondary', onclick: () => pickPdf(() => renderDossier()) }, icon('i-upload'), 'Ouvrir un carnet PDF')),
      importMsg && h('p', { class: 'notice ' + importMsg.kind }, importMsg.text),
      h('button', { class: 'link danger', onclick: eraseAll }, 'Effacer mon travail de cet appareil'))
  );
}
function eraseAll() {
  if (!confirm('Effacer tout ton travail de cet appareil ? Télécharge d’abord ton carnet si tu veux le garder.')) return;
  state = emptyState(); state.chrono = [...CHRONO_START]; save(true); location.reload();
}

// ---------------------------------------------------------------- Carnet PDF (export et import)
function pdfBlocks(e) {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const B = [
    { t: 'meta', text: TITLE }, { t: 'title', text: e.pdfTitle },
    { t: 'meta', text: `Épisode ${e.num} · ${e.moment} · « ${e.title} »` },
    { t: 'meta', text: `Nom : ${state.ident.nom || '—'}    Prénom : ${state.ident.prenom || '—'}    Classe : ${state.ident.classe || '—'}` },
    { t: 'meta', text: `Document établi le ${date}` }, { t: 'rule' }
  ];
  const ans = id => answer(id) ? { t: 'p', text: answer(id) } : { t: 'empty', text: '(pas de réponse)' };
  for (const m of e.missions) {
    if (m.kind === 'import' || m.kind === 'export') continue;
    B.push({ t: 'h1', text: m.title });
    if (m.piece) B.push(state.found.includes(m.piece) ? { t: 'meta', text: `Pièce retrouvée : ${PIECE[m.piece].title} (${PIECE[m.piece].date})` } : { t: 'empty', text: 'Pièce non retrouvée dans la maquette.' });
    if (m.kind === 'chrono') {
      B.push({ t: 'label', text: 'Chronologie reconstituée' });
      state.chrono.forEach((id, i) => B.push({ t: 'p', text: `${i + 1}. ${PIECE[id].title}${state.chronoChecked ? ` (${PIECE[id].date})${PIECES[i].id === id ? '' : ' — mal placée'}` : ''}` }));
      if (!state.chronoChecked) B.push({ t: 'empty', text: 'Ordre non vérifié.' });
    }
    if (m.kind === 'bartoli') B.push({ t: 'meta', text: `${DRAWINGS[m.drawing].title} — ${DRAWINGS[m.drawing].credit}` });
    if (m.kind === 'mark') B.push(state.mark ? { t: 'meta', text: `Repère posé dans la maquette : près de la baraque n° ${state.mark.barrack}, période ${ERAS[state.mark.era].date}.` } : { t: 'empty', text: 'Aucun repère posé.' });
    for (const id of m.recall || []) B.push({ t: 'label', text: `Rappel (${FIELDS.get(id).ep.moment.toLowerCase()}) — ${FIELDS.get(id).field.label}` }, answer(id) ? { t: 'quote', text: answer(id) } : { t: 'empty', text: '(pas de réponse)' });
    for (const f of m.fields || []) {
      B.push({ t: 'label', text: f.label });
      if (f.before) B.push({ t: 'meta', text: 'Avant la visite :' }, answer(f.before) ? { t: 'quote', text: answer(f.before) } : { t: 'empty', text: '(pas de réponse)' }, { t: 'meta', text: 'Après la visite :' });
      B.push(ans(f.id));
    }
  }
  return B;
}
function pdfFile(e) {
  save(true);
  const bytes = makePdf({ blocks: pdfBlocks(e), title: `${e.pdfTitle} — ${who()}`, attach: wrapSave(state),
    footer: `${who() || 'Élève'}${state.ident.classe ? ' · ' + state.ident.classe : ''} · ${TITLE} · ${e.pdfTitle}` });
  return new File([bytes], fileName(e.pdfKind, state.ident, 'pdf'), { type: 'application/pdf' });
}
function downloadPdf(e, file = pdfFile(e)) {
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: file.name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('Carnet téléchargé');
}
// Le travail en texte (lu par le professeur dans le mail), suivi du code de reprise (pour l'épisode 2 sur un autre appareil).
function workText(e) {
  const fmt = { title: b => b.text.toUpperCase(), h1: b => `\n== ${b.text} ==`, label: b => `\n• ${b.text}`, quote: b => b.text.split('\n').map(l => '> ' + l).join('\n'), rule: () => '————————————' };
  return `${pdfBlocks(e).map(b => (fmt[b.t] || (x => x.text))(b)).join('\n')}\n\n--- Code de reprise (ne pas modifier) ---\n${wrapSave(state)}\n`;
}
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); return true; } catch { toast('Copie impossible sur cet appareil.'); return false; }
}
async function sendWork(e) {
  save(true);
  const text = workText(e), touch = matchMedia('(pointer: coarse)').matches;
  const copied = await copy(text, 'Réponses copiées');
  const subject = `${e.pdfTitle} — ${who() || 'Élève'}${state.ident.classe ? ' · ' + state.ident.classe : ''}`;
  // shortcut: sur ordinateur, un lien mailto long échoue souvent (environ 2 000 caractères sous Windows) : l'élève colle depuis le presse-papier.
  const body = touch ? `Bonjour,\n\n${text}` : `Bonjour,\n\n${copied ? 'Mes réponses (colle-les ici avec Ctrl+V, ou Cmd+V sur Mac) :' : 'Retourne dans l’enquête, appuie sur « copie tes réponses », puis colle-les ici.'}\n\n\n${who()}`;
  location.href = `mailto:${TEACHER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (!touch && copied) toast('Ta messagerie s’ouvre : colle tes réponses (Ctrl+V), puis envoie.', 7000);
}
function openArt(d) {
  $('#art-title').textContent = d.title; $('#art-img').src = d.src; $('#art-img').alt = d.alt; $('#art-credit').textContent = d.credit;
  openSheet('#art-sheet');
}
let importMsg = null, afterImport = null;
function pickPdf(then) { afterImport = then; $('#pdf-input').click(); }
$('#pdf-input').addEventListener('change', async () => {
  const input = $('#pdf-input'), file = input.files[0]; input.value = '';
  if (!file) return;
  importMsg = await importPdf(file); afterImport?.(importMsg);
});
async function importPdf(file) {
  if (file.size > MAX_FILE) return { kind: 'error', text: 'Ce fichier est trop gros pour être un carnet du parcours.' };
  return importText(new TextDecoder('latin1').decode(await file.arrayBuffer()));
}
function importText(text) {
  const json = unwrapSave(text);
  if (!json) return { kind: 'error', text: 'Je ne trouve pas ton code de reprise. Copie bien tout le mail, jusqu’à la fin du bloc « Code de reprise », puis réessaie.' };
  const { state: got, error } = parseSave(json, SCHEMA);
  if (error) return { kind: 'error', text: error };
  for (const k of ['nom', 'prenom', 'classe']) if (got.ident[k]) state.ident[k] = got.ident[k];
  Object.assign(state.answers, got.answers);
  state.found = PIECES.map(p => p.id).filter(id => state.found.includes(id) || got.found.includes(id));
  if (got.chrono.length) { state.chrono = got.chrono; state.chronoChecked = got.chronoChecked; }
  for (const ep of ['ep1', 'ep2']) state.reached[ep] = Math.max(state.reached[ep], got.reached[ep]);
  if (got.mark) state.mark = got.mark;
  save(true); updateCount(); updatePins(); drawMini();
  const n = Object.keys(got.answers).filter(f => f.startsWith('e1_')).length;
  return { kind: 'ok', text: `Carnet retrouvé${who() ? ' : ' + who() : ''}. ${n} réponse${n > 1 ? 's' : ''} de l’épisode 1, ${got.found.length} pièce${got.found.length > 1 ? 's' : ''} du dossier.` };
}

// ---------------------------------------------------------------- Commandes
const raycaster = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.55);
function groundPoint(cx, cy) {
  const v = new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); raycaster.setFromCamera(v, camera);
  const hit = new THREE.Vector3(); return raycaster.ray.intersectPlane(groundPlane, hit) ? hit : null;
}
function tapGround(cx, cy) {
  const hp = groundPoint(cx, cy); if (!hp) return;
  if (S.mode === 'aerial') {
    if (Math.abs(hp.x) > 600 || Math.abs(hp.z) > 400) return;
    if (world.blockedBy(hp.x, hp.z, .4)) { toast('Touche un espace libre, hors des bâtiments.'); return; }
    const dx = hp.x - camera.position.x, dz = hp.z - camera.position.z;
    goWalk({ x: hp.x, z: hp.z, yaw: Math.atan2(-dx, -dz), pitch: 0 }, 1.6);
  } else {
    const d = Math.hypot(hp.x - S.p.x, hp.z - S.p.z); if (d < 1 || d > 140) return;
    S.walkTo = { x: hp.x, z: hp.z }; ring.position.set(hp.x, world.groundAt(hp.x, hp.z) + .05, hp.z); ring.visible = true;
  }
}
const pointers = new Map();
let pinch = null;
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true });
  const touchLeft = e.pointerType !== 'mouse' && S.mode === 'walk' && e.clientX < innerWidth * .42 && e.clientY > innerHeight * .3;
  const p = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), kind: touchLeft ? 'stick' : 'look', moved: 0 };
  pointers.set(e.pointerId, p);
  if (p.kind === 'stick' && !S.stick) { S.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 }; const st = $('#stick'); st.style.left = e.clientX + 'px'; st.style.top = e.clientY + 'px'; st.classList.add('on'); st.firstElementChild.style.transform = ''; S.walkTo = null; ring.visible = false; }
  const looks = [...pointers.values()].filter(q => q.kind === 'look');
  if (looks.length === 2) pinch = { d: Math.hypot(looks[0].x - looks[1].x, looks[0].y - looks[1].y), dist: S.aerial.dist, fov: camera.fov };
  $('#era-banner').hidden = true;
  if (matchMedia('(max-width: 899px)').matches && mission().kind === 'find') toggleMission(false);
});
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; p.moved += Math.abs(dx) + Math.abs(dy);
  if (S.stick && S.stick.id === e.pointerId) {
    let sx = e.clientX - S.stick.ox, sy = e.clientY - S.stick.oy; const l = Math.hypot(sx, sy), R = 52; if (l > R) { sx *= R / l; sy *= R / l; }
    S.stick.dx = sx / R; S.stick.dy = sy / R; $('#stick .knob').style.transform = `translate(${sx}px,${sy}px)`; return;
  }
  const looks = [...pointers.values()].filter(q => q.kind === 'look');
  if (looks.length === 2 && pinch) {
    const d = Math.hypot(looks[0].x - looks[1].x, looks[0].y - looks[1].y), f = pinch.d / Math.max(20, d);
    if (S.mode === 'aerial') S.aerial.dist = THREE.MathUtils.clamp(pinch.dist * f, 40, 1600);
    else { camera.fov = THREE.MathUtils.clamp(pinch.fov * f, 35, 80); camera.updateProjectionMatrix(); }
    return;
  }
  if (S.tween) return;
  if (S.mode === 'walk') { const k = e.pointerType === 'mouse' ? .0042 : .0058; S.p.yaw += dx * k; S.p.pitch = THREE.MathUtils.clamp(S.p.pitch + dy * k * .8, -1.1, 1.0); }
  else { S.aerial.az -= dx * .005; S.aerial.el = THREE.MathUtils.clamp(S.aerial.el + dy * .004, .18, 1.45); }
});
function endPointer(e) {
  const p = pointers.get(e.pointerId); if (!p) return; pointers.delete(e.pointerId);
  if (S.stick && S.stick.id === e.pointerId) { S.stick = null; $('#stick').classList.remove('on'); }
  else if (p.kind === 'look' && p.moved < 10 && performance.now() - p.t < 450 && pointers.size === 0 && !pinch) tapGround(e.clientX, e.clientY);
  if (pointers.size < 2) pinch = null;
}
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', e => { e.preventDefault(); if (S.mode === 'aerial') S.aerial.dist = THREE.MathUtils.clamp(S.aerial.dist * Math.exp(e.deltaY * .0012), 40, 1600); else { camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * .02, 35, 80); camera.updateProjectionMatrix(); } }, { passive: false });
const MOVE_KEYS = ['KeyW', 'KeyZ', 'ArrowUp', 'KeyS', 'ArrowDown', 'KeyA', 'KeyQ', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
addEventListener('keydown', e => {
  if (S.page !== 'enquete' || tourI >= 0 || e.target.closest?.('textarea, input, button, summary, a') || !$('#sheet-backdrop').hidden || document.body.classList.contains('welcoming')) return;
  if (MOVE_KEYS.includes(e.code)) { e.preventDefault(); S.keys.add(e.code); S.walkTo = null; ring.visible = false; if (S.mode === 'aerial' && !e.code.startsWith('Shift')) { setMode('walk'); goWalk({ ...S.p }, .9); } }
  if (e.key === 'm' || e.key === 'M') $('#minimap-btn').click();
});
addEventListener('keyup', e => S.keys.delete(e.code));
addEventListener('blur', () => { S.keys.clear(); S.stick = null; $('#stick').classList.remove('on'); });

// ---------------------------------------------------------------- Déplacement
let blockedToast = 0;
function tryMove(dx, dz) {
  const nx = S.p.x + dx, nz = S.p.z + dz;
  if (!world.blockedBy(nx, nz)) { S.p.x = nx; S.p.z = nz; return true; }
  if (!world.blockedBy(nx, S.p.z)) { S.p.x = nx; return true; }
  if (!world.blockedBy(S.p.x, nz)) { S.p.z = nz; return true; }
  const what = world.blockedBy(nx, nz), now = performance.now();
  if (now - blockedToast > 2500) { blockedToast = now; toast({ fence: 'La clôture ferme le passage. L’entrée est à l’ouest.', barrack: 'Mur de baraque : contourne-la par l’allée.', memorial: 'Le Mémorial : contourne-le.', tent: 'Une tente : passe à côté.', furniture: 'Passe par l’allée centrale.', edge: 'Fin de la maquette.' }[what] || 'Passage fermé'); }
  return false;
}
let arrivalClock = 0;
function step(dt) {
  if (S.tween) {
    const tw = S.tween; tw.t += dt / tw.dur; const k = Math.min(1, tw.t), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(tw.fromP, tw.toP, e); camera.position.y += Math.sin(Math.PI * e) * tw.arc;
    camera.quaternion.slerpQuaternions(tw.fromQ, tw.toQ, e);
    if (k >= 1) { S.tween = null; tw.onDone?.(); }
    return;
  }
  if (S.mode === 'walk') {
    let f = 0, s = 0;
    const K = S.keys; if (K.has('KeyW') || K.has('KeyZ') || K.has('ArrowUp')) f += 1; if (K.has('KeyS') || K.has('ArrowDown')) f -= 1;
    if (K.has('KeyA') || K.has('KeyQ')) s -= 1; if (K.has('KeyD')) s += 1;
    if (K.has('ArrowLeft')) S.p.yaw += dt * 1.8; if (K.has('ArrowRight')) S.p.yaw -= dt * 1.8;
    let speed = (K.has('ShiftLeft') || K.has('ShiftRight')) ? 9 : 3.6;
    if (S.stick) { const m = Math.min(1, Math.hypot(S.stick.dx, S.stick.dy)); f = -S.stick.dy; s = S.stick.dx; speed = 1.3 + Math.pow(m, 1.6) * 6.5; if (m < .12) f = s = 0; }
    const fx = -Math.sin(S.p.yaw), fz = -Math.cos(S.p.yaw), rx = Math.cos(S.p.yaw), rz = -Math.sin(S.p.yaw);
    if (S.walkTo) {
      const dx = S.walkTo.x - S.p.x, dz = S.walkTo.z - S.p.z, d = Math.hypot(dx, dz);
      if (d < .4) { S.walkTo = null; ring.visible = false; }
      else {
        const target = Math.atan2(-dx, -dz); const dy = ((target - S.p.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        S.p.yaw += dy * Math.min(1, dt * 5); const v = Math.min(d, 5 * dt);
        if (!tryMove(dx / d * v, dz / d * v)) { S.walkTo = null; ring.visible = false; }
      }
    } else if (f || s) {
      const l = Math.hypot(f, s), v = speed * dt / Math.max(1, l);
      tryMove((fx * f + rx * s) * v, (fz * f + rz * s) * v);
    }
    const gy = world.groundAt(S.p.x, S.p.z) + 1.6; S.p.y = S.p.y ? S.p.y + (gy - S.p.y) * Math.min(1, dt * 10) : gy;
    camera.position.set(S.p.x, S.p.y, S.p.z); camera.rotation.set(S.p.pitch, S.p.yaw, 0);
    arrivalClock += dt; if (arrivalClock > .3) { arrivalClock = 0; checkMission(); }
  } else {
    if (idle) S.aerial.az += dt * .04;
    camera.position.copy(aerialEye(S.aerial)); camera.quaternion.copy(aerialQuat(S.aerial));
  }
}

// ---------------------------------------------------------------- Rendu
const tmp = new THREE.Vector3(), fwd = new THREE.Vector3();
function placePin(el, pos, aerial) {
  tmp.copy(pos); const d = tmp.distanceTo(camera.position);
  const behind = tmp.clone().sub(camera.position).dot(fwd) < 0;
  if (behind || (!aerial && d > 650) || d < 2.5) { el.style.display = 'none'; return; }
  tmp.project(camera); const x = (tmp.x * .5 + .5) * innerWidth, y = (-tmp.y * .5 + .5) * innerHeight;
  const sc = aerial ? .9 : THREE.MathUtils.clamp(26 / d, .55, 1.1);
  el.style.display = ''; el.style.transform = `translate(${x - 17}px, ${y - 40}px) scale(${sc})`; el.style.zIndex = String(1000 - Math.round(d));
}
const markPos = new THREE.Vector3();
function placePins() {
  const aerial = S.mode === 'aerial' || !!S.tween;
  camera.getWorldDirection(fwd);
  for (const p of pins) if (p.show) placePin(p.el, p.pos, aerial); else p.el.style.display = 'none';
  if (cur.ep === 'ep2' && state.mark) { markPos.set(state.mark.x, world.groundAt(state.mark.x, state.mark.z) + 3.2, state.mark.z); placePin(markPin, markPos, aerial); }
  else markPin.style.display = 'none';
}
let lastT = performance.now(), frames = 0, acc = 0;
const focus = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  if (S.page !== 'enquete' || document.hidden) return;
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  step(dt);
  if (S.mode === 'aerial' && !S.tween) focus.set(S.aerial.tx, 0, S.aerial.tz);
  else { camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); focus.copy(camera.position).addScaledVector(fwd, 28); }
  world.update(dt, focus, camera.position, S.mode === 'aerial' || (S.tween && S.tween.arc > 10));
  renderer.render(world.scene, camera);
  placePins();
  if (miniDirty || (frames & 7) === 0) { drawPlan(mini); miniDirty = false; }
  frames++; acc += dt;
  if (frames % 60 === 0) { // résolution adaptative : on garde l'image fluide sur les téléphones modestes
    const avg = acc / 60; acc = 0;
    if (avg > 1 / 40 && dpr > .75) { dpr = Math.max(.75, dpr - .15); resize(); }
    else if (avg < 1 / 58 && dpr < maxDPR) { dpr = Math.min(maxDPR, dpr + .1); resize(); }
  }
}

// ---------------------------------------------------------------- Aide et démarrage
function showHelp() { $('#help').hidden = false; $('#help-ok').focus(); }

// Visite guidée : met en lumière chaque zone de l'écran, puis termine par l'aide aux commandes.
const TOUR = [
  { title: 'Bienvenue dans l’îlot F', text: 'Tu es dans la maquette du camp de Rivesaltes, telle que le plan de 1939 la décrit. En une minute, voici comment mener ton enquête.' },
  { sel: '#mission', title: 'Ta mission', text: 'Ici s’affiche ta mission du moment : un document à lire, un lieu à trouver, des questions. Les flèches te ramènent aux missions précédentes.' },
  { sel: '#era-btn', title: 'Voyager dans le temps', text: 'Chaque document a une date. Choisis ici la bonne période : le camp change selon les époques, de 1939 à aujourd’hui.' },
  { sel: '#minimap-btn', title: 'Le plan', text: 'Touche le plan pour l’agrandir, puis touche un endroit pour t’y rendre. Les pièces retrouvées y apparaissent.' },
  { sel: '#mode-btn', title: 'Vue aérienne', text: 'Prends de la hauteur pour comprendre l’organisation du camp, puis touche le sol pour redescendre.' },
  { sel: '[data-tab="dossier"]', title: 'Ton dossier', text: 'Les pièces que tu retrouves, ton lexique espagnol et la liste des missions. Le compteur montre ta progression.' }
];
let tourI = -1;
function startTour() { closeSheets(); $('#help').hidden = true; $('#era-banner').hidden = true; showPage('enquete'); toggleMission(true); tourI = 0; $('#tour').hidden = false; tourStep(); }
function tourStep() {
  const st = TOUR[tourI], el = st.sel && $(st.sel), spot = $('#tour-spot'), card = $('#tour-card'), pad = 6;
  $('#tour-count').textContent = `${tourI + 1} / ${TOUR.length}`;
  $('#tour-title').textContent = st.title; $('#tour-text').textContent = st.text;
  $('#tour-next span').textContent = tourI === TOUR.length - 1 ? 'Terminer' : 'Suivant';
  const r = el?.getBoundingClientRect();
  Object.assign(spot.style, r ? { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + 2 * pad + 'px', height: r.height + 2 * pad + 'px' }
    : { left: innerWidth / 2 + 'px', top: innerHeight / 2 + 'px', width: '0px', height: '0px' });
  // La carte se place sous la zone, sinon au-dessus, sinon au centre.
  const cw = card.offsetWidth, ch = card.offsetHeight, m = 16;
  let top = r ? r.bottom + pad + 12 : (innerHeight - ch) / 2;
  if (r && top + ch > innerHeight - m) top = r.top - pad - 12 - ch;
  if (top < m) top = (innerHeight - ch) / 2;
  const left = r ? Math.min(Math.max(r.left, m), innerWidth - cw - m) : (innerWidth - cw) / 2;
  Object.assign(card.style, { left: left + 'px', top: top + 'px' });
  $('#tour-next').focus();
}
function endTour(help = true) { $('#tour').hidden = true; tourI = -1; local.set('rivesaltes.tourSeen', '1'); if (help) showHelp(); }
$('#tour-next').addEventListener('click', () => ++tourI < TOUR.length ? tourStep() : endTour());
$('#tour-skip').addEventListener('click', () => endTour(false));
addEventListener('resize', () => { if (tourI >= 0) tourStep(); });
$('#help-ok').addEventListener('click', () => { $('#help').hidden = true; local.set('rivesaltes.helpSeen', '1'); canvas.focus(); });
$('#help-btn').addEventListener('click', startTour);

resize(); world.setEra(S.era); $('#era-label').textContent = ERAS[S.era].date; renderEraList(); updateCount();
Object.assign(S.aerial, { tx: -60, tz: 0, dist: 760, az: -2.3, el: .62 });
S.mode = 'aerial'; document.body.dataset.mode = 'aerial';
camera.position.copy(aerialEye(S.aerial)); camera.quaternion.copy(aerialQuat(S.aerial));
requestAnimationFrame(frame);

function start() {
  navigator.storage?.persist?.().catch(() => { }); // demande au navigateur de ne pas effacer le travail
  $('#loading').hidden = true;
  idle = false; document.body.classList.remove('welcoming'); $('#welcome').classList.add('out'); setTimeout(() => $('#welcome').remove(), 700);
  goMission(chosen, cur.ep === chosen ? cur.i : state.reached[chosen]);
  goWalk(stopPose('entree'), 3.2); setTimeout(() => showEraBanner(S.era), 3300);
  if (!local.get('rivesaltes.tourSeen', '')) setTimeout(startTour, 3400);
}
loaded = true; if (pending) start();
// Accès pour les tests automatisés (sans effet sur l'usage normal)
window.__app = { startTour, S, world, camera, setEra, goMission, showPage, state: () => state, finish() { if (S.tween) S.tween.t = S.tween.dur; } };
