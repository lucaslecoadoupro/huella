// Le travail de l'élève : forme de la sauvegarde, validation à l'import, noms de fichiers.
// Aucun accès au DOM ici (testé par outils/test_parcours.mjs).

export const APP_ID = 'rivesaltes-traces-du-silence';
export const SAVE_VERSION = 1;
export const MAX_ANSWER = 20000;   // caractères par réponse
export const MAX_FILE = 5_000_000; // octets pour un PDF importé

export const emptyState = () => ({
  app: APP_ID, version: SAVE_VERSION, ident: { nom: '', prenom: '', classe: '' },
  answers: {}, found: [], chrono: [], chronoChecked: false, reached: { ep1: 0, ep2: 0 }, mark: null, saved: ''
});

const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};

// Valide une sauvegarde (texte JSON) et renvoie un état propre, reconstruit champ par champ :
// seuls les champs connus, en texte brut, sont repris. Rien n'est jamais exécuté ni injecté en HTML.
// schema : { fields, pieces, missions: { ep1: n, ep2: n }, eras }
export function parseSave(text, schema) {
  if (typeof text !== 'string' || text.length > MAX_FILE) return { error: 'Ce fichier est trop gros pour être un carnet du parcours.' };
  let raw;
  try { raw = JSON.parse(text); } catch { return { error: 'Ce fichier n’est pas lisible. Choisis le PDF qui commence par Rivesaltes_AVANT.' }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.app !== APP_ID) return { error: 'Ce fichier ne vient pas du parcours « Huella ». Choisis le PDF qui commence par Rivesaltes_AVANT.' };
  if (!Number.isInteger(raw.version) || raw.version < 1 || raw.version > SAVE_VERSION) return { error: 'Ce carnet vient d’une version plus récente de l’application. Recharge la page avec une connexion, puis réessaie.' };
  const s = emptyState(), id = obj(raw.ident), ans = obj(raw.answers), reached = obj(raw.reached);
  for (const k of ['nom', 'prenom', 'classe']) s.ident[k] = str(id[k], 80);
  for (const f of schema.fields) if (Object.hasOwn(ans, f) && typeof ans[f] === 'string') s.answers[f] = ans[f].slice(0, MAX_ANSWER);
  if (Array.isArray(raw.found)) s.found = schema.pieces.filter(p => raw.found.includes(p));
  const c = raw.chrono;
  if (Array.isArray(c) && c.length === schema.pieces.length && schema.pieces.every(p => c.includes(p))) { s.chrono = [...c]; s.chronoChecked = raw.chronoChecked === true; }
  for (const ep of ['ep1', 'ep2']) if (Number.isInteger(reached[ep])) s.reached[ep] = Math.max(0, Math.min(schema.missions[ep] - 1, reached[ep]));
  const m = raw.mark;
  if (m && Number.isFinite(m.x) && Number.isFinite(m.z) && Math.abs(m.x) < 1000 && Math.abs(m.z) < 1000 && schema.eras.includes(m.era))
    s.mark = { x: m.x, z: m.z, era: m.era, barrack: Number.isInteger(m.barrack) ? m.barrack : null };
  s.saved = str(raw.saved, 40);
  return { state: s };
}

// La sauvegarde voyage dans le PDF lui-même, entre deux marqueurs, encodée en base64.
const BEGIN = 'RIVESALTES-SAVE-BEGIN:', END = ':RIVESALTES-SAVE-END';
export function wrapSave(state) {
  let bin = ''; for (const b of new TextEncoder().encode(JSON.stringify(state))) bin += String.fromCharCode(b);
  return BEGIN + btoa(bin) + END;
}
export function unwrapSave(pdfText) { // texte d'un PDF ou d'un mail collé
  const i = pdfText.indexOf(BEGIN), j = pdfText.indexOf(END, i);
  if (i < 0 || j < 0) return null;
  // Un mail recopié peut contenir des retours à la ligne ou des « > » de citation : on ne garde que le base64.
  try { return new TextDecoder().decode(Uint8Array.from(atob(pdfText.slice(i + BEGIN.length, j).replace(/[^A-Za-z0-9+/=]/g, '')), c => c.charCodeAt(0))); } catch { return null; }
}

const clean = (s, fallback) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || fallback;
// Rivesaltes_AVANT_Nom_Prenom.pdf, Rivesaltes_APRES_Nom_Prenom.pdf
export const fileName = (kind, ident, ext) => `Rivesaltes_${kind}_${clean(ident.nom, 'Nom')}_${clean(ident.prenom, 'Prenom')}.${ext}`;
