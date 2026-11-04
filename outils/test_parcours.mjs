// Vérifications rapides de l'enquête : node outils/test_parcours.mjs [chemin/du/test.pdf]
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { makePdf, wrap, textWidth } from '../js/pdf.js';
import { parseSave, fileName, emptyState, wrapSave, unwrapSave, APP_ID } from '../js/carnet.js';
import { EPISODES, PIECES } from '../js/enquete.js';
import { STOPS, ERA_ORDER } from '../js/content.js';

// Contenu : identifiants uniques, rappels et lieux valides.
const fields = EPISODES.flatMap(e => e.missions.flatMap(m => (m.fields || []).map(f => f.id)));
assert.equal(new Set(fields).size, fields.length, 'identifiants de champs en double');
const pieces = PIECES.map(p => p.id), stops = STOPS.map(s => s.id);
for (const e of EPISODES) for (const m of e.missions) {
  for (const id of [...(m.recall || []), ...(m.fields || []).map(f => f.before).filter(Boolean)]) assert.ok(fields.includes(id), 'rappel inconnu : ' + id);
  if (m.piece) assert.ok(pieces.includes(m.piece), 'pièce inconnue : ' + m.piece);
  if (m.kind === 'find') { assert.ok(m.target === 'tents' || stops.includes(m.target), 'lieu inconnu : ' + m.target); assert.ok(ERA_ORDER.includes(m.era)); assert.ok(m.hints.length >= 2); }
  if (m.kind === 'find' || m.kind === 'piece') assert.ok(m.fields?.length, 'une pièce demande au moins une réponse : ' + m.id);
}
assert.deepEqual(EPISODES[0].missions.filter(m => m.piece).map(m => m.piece).sort(), [...pieces].sort(), 'chaque pièce a sa mission');
const schema = { fields, pieces, missions: { ep1: EPISODES[0].missions.length, ep2: EPISODES[1].missions.length }, eras: ERA_ORDER };

// Sauvegarde : aller-retour dans le PDF, rejets, nettoyage.
const s = emptyState(); s.ident = { nom: 'Martínez', prenom: 'Zoé', classe: '3e B' }; s.answers.e1_hyp = 'Je pense que… « œuvre » 🙂'; s.found = ['camp', 'retirada']; s.reached.ep1 = 4; s.mark = { x: 10, z: -3, era: '1962', barrack: 12 };
const pdf = makePdf({ blocks: [{ t: 'title', text: 'Carnet' }], attach: wrapSave(s) });
const back = parseSave(unwrapSave(new TextDecoder('latin1').decode(pdf)), schema).state;
assert.equal(back.answers.e1_hyp, s.answers.e1_hyp); assert.deepEqual(back.found, ['retirada', 'camp']); assert.equal(back.reached.ep1, 4); assert.equal(back.mark.barrack, 12);
assert.equal(unwrapSave('%PDF-1.4 sans sauvegarde'), null);
// Code de reprise recopié depuis un mail : retours à la ligne et « > » de citation n'empêchent pas la lecture.
const code = wrapSave(s), mail = 'Bonjour,\n> ' + code.slice(0, 40) + '\n> ' + code.slice(40, 90) + '\r\n' + code.slice(90) + '\nZoé';
assert.equal(parseSave(unwrapSave(mail), schema).state.answers.e1_hyp, s.answers.e1_hyp);
assert.ok(parseSave('pas du json', schema).error);
assert.ok(parseSave('{"app":"autre"}', schema).error);
assert.ok(parseSave(JSON.stringify({ ...s, version: 99 }), schema).error);
const dirty = parseSave(JSON.stringify({ app: APP_ID, version: 1, answers: { e1_hyp: 42, inconnu: 'x', e1_deja: '<img src=x onerror=alert(1)>' }, found: ['camp', 'faux'], chrono: ['camp'], reached: { ep1: 999 }, mark: { x: 'a' }, ident: { nom: ['x'] } }), schema).state;
assert.deepEqual(Object.keys(dirty.answers), ['e1_deja']); // gardé tel quel : jamais inséré en HTML
assert.deepEqual(dirty.found, ['camp']); assert.deepEqual(dirty.chrono, []); assert.equal(dirty.reached.ep1, schema.missions.ep1 - 1); assert.equal(dirty.mark, null); assert.equal(dirty.ident.nom, '');
assert.equal(fileName('AVANT', s.ident, 'pdf'), 'Rivesaltes_AVANT_Martinez_Zoe.pdf');
assert.equal(fileName('APRES', { nom: '', prenom: '' }, 'pdf'), 'Rivesaltes_APRES_Nom_Prenom.pdf');

// PDF : coupe des lignes, pagination, structure.
assert.equal(textWidth('a', 1000), 556);
for (const l of wrap('x'.repeat(500) + ' fin', 10, 200)) assert.ok(textWidth(l, 10) <= 200);
const long = Array.from({ length: 60 }, (_, i) => ({ t: 'p', text: `Réponse ${i} : l’élève écrit « œuvre », “guillemets” — ` + 'mot '.repeat(40) }));
const bytes = makePdf({ blocks: [{ t: 'title', text: 'Carnet d’enquête' }, ...long], footer: 'Zoé Martínez', title: 'Test', attach: wrapSave(s) });
const txt = new TextDecoder('latin1').decode(bytes);
assert.ok(txt.startsWith('%PDF-1.4') && txt.trimEnd().endsWith('%%EOF'));
const pages = (txt.match(/\/Type \/Page\b/g) || []).length;
assert.ok(pages > 1, 'pagination');
const xref = Number(txt.match(/startxref\n(\d+)/)[1]); assert.equal(txt.slice(xref, xref + 4), 'xref');
if (process.argv[2]) writeFileSync(process.argv[2], bytes); // pour ouvrir le PDF de test
console.log(`OK — ${fields.length} champs, ${pieces.length} pièces, PDF de test : ${pages} pages`);
