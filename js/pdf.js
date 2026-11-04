// Générateur PDF minimal, sans dépendance : texte seul, A4, polices standard
// Helvetica (aucune police à embarquer), encodage WinAnsi (accents français).
// Tout est calculé dans le navigateur : rien n'est envoyé à un serveur.

const PAGE_W = 595.28, PAGE_H = 841.89, M = 56, BOTTOM = 64;
// Largeurs Helvetica (AFM, 1/1000 em) des caractères 32 à 126.
const W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const WIN = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, 'Œ': 0x8C, 'œ': 0x9C, 'Ÿ': 0x9F };
const WIN_W = { 0x80: 556, 0x82: 222, 0x84: 333, 0x85: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350, 0x96: 556, 0x97: 1000, 0x8C: 1000, 0x9C: 944, 0x9F: 667 };

// Caractère Unicode → [code WinAnsi, largeur]. Ce qui n'existe pas en WinAnsi devient « ? ».
function glyph(ch) {
  if (ch === '\u202F' || ch === '\u2009' || ch === '\t') ch = ' ';
  if (ch === '\u2011') ch = '-';
  const c = ch.codePointAt(0);
  if (c >= 32 && c <= 126) return [c, W[c - 32]];
  if (WIN[ch]) return [WIN[ch], WIN_W[WIN[ch]]];
  if (c >= 160 && c <= 255) {
    const base = ch.normalize('NFD')[0].codePointAt(0);
    return [c, base >= 32 && base <= 126 && base !== c ? W[base - 32] : c === 160 ? 278 : 556];
  }
  const base = ch.normalize('NFD')[0];
  return base !== ch ? glyph(base) : [63, 556];
}
// shortcut: le gras est estimé à +6 % de la largeur normale ; prendre la table Helvetica-Bold si des titres débordent.
export const textWidth = (s, size, bold) => [...s].reduce((w, ch) => w + glyph(ch)[1], 0) * size / 1000 * (bold ? 1.06 : 1);
const hex = s => [...s].map(ch => glyph(ch)[0].toString(16).padStart(2, '0')).join('');

// Coupe un texte en lignes ; les mots trop longs sont coupés au caractère.
export function wrap(text, size, maxW, bold) {
  const lines = [];
  for (const para of String(text).replace(/\r/g, '').normalize('NFC').split('\n')) {
    let line = '';
    for (let word of para.split(/ +/)) {
      while (textWidth(word, size, bold) > maxW) {
        let n = word.length; while (n > 1 && textWidth(word.slice(0, n), size, bold) > maxW) n--;
        if (line) { lines.push(line); line = ''; }
        lines.push(word.slice(0, n)); word = word.slice(n);
      }
      const next = line ? line + ' ' + word : word;
      if (textWidth(next, size, bold) <= maxW) line = next; else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

const STYLE = {
  title: { font: 'F2', size: 20, lead: 26, color: '0.17 0.17 0.16', before: 0, after: 6 },
  h1: { font: 'F2', size: 15, lead: 20, color: '0.55 0.34 0.10', before: 18, after: 6, keep: 4 },
  h2: { font: 'F2', size: 12.5, lead: 17, color: '0.17 0.17 0.16', before: 12, after: 3, keep: 3 },
  label: { font: 'F2', size: 10.5, lead: 14, color: '0.30 0.29 0.27', before: 8, after: 2, keep: 2 },
  p: { font: 'F1', size: 10.5, lead: 15, color: '0.10 0.10 0.10', before: 0, after: 2 },
  meta: { font: 'F1', size: 9.5, lead: 13, color: '0.38 0.36 0.33', before: 0, after: 2 },
  quote: { font: 'F3', size: 10, lead: 14, color: '0.30 0.29 0.27', before: 2, after: 4, indent: 14 },
  empty: { font: 'F3', size: 10, lead: 14, color: '0.50 0.48 0.45', before: 0, after: 2 }
};

// blocks : [{ t: 'title'|'h1'|'h2'|'label'|'p'|'meta'|'quote'|'empty'|'rule', text }]
// footer : texte en bas à gauche de chaque page ; la pagination est ajoutée à droite.
// attach : texte ASCII joint au PDF comme fichier intégré (la sauvegarde de l'élève).
export function makePdf({ blocks, footer = '', title = '', attach = '' }) {
  const pages = []; let ops, y;
  const newPage = () => { ops = []; pages.push(ops); y = PAGE_H - M; };
  newPage();
  for (const b of blocks) {
    if (b.t === 'rule') {
      if (y - 12 < BOTTOM) newPage();
      y -= 6; ops.push(`0.8 0.77 0.72 RG 0.6 w ${M} ${y.toFixed(2)} m ${(PAGE_W - M).toFixed(2)} ${y.toFixed(2)} l S`); y -= 8; continue;
    }
    const s = STYLE[b.t] || STYLE.p, x = M + (s.indent || 0);
    const lines = wrap(b.text ?? '', s.size, PAGE_W - M - x, s.font === 'F2');
    if (pages.length > 1 || y < PAGE_H - M) y -= s.before;
    // Un titre ne reste jamais seul en bas de page.
    if (y - (s.keep ? lines.length * s.lead + s.keep * 15 : s.lead) < BOTTOM) newPage();
    for (const line of lines) {
      if (y - s.lead < BOTTOM) newPage();
      y -= s.lead;
      if (b.t === 'quote') ops.push(`0.71 0.46 0.16 RG 1.5 w ${M + 3} ${(y - 3).toFixed(2)} m ${M + 3} ${(y + s.lead - 3).toFixed(2)} l S`);
      if (line) ops.push(`BT /${s.font} ${s.size} Tf ${s.color} rg ${x.toFixed(2)} ${y.toFixed(2)} Td <${hex(line)}> Tj ET`);
    }
    y -= s.after;
  }

  const objs = [];
  const add = body => { objs.push(body); return objs.length; };
  const fonts = ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique'].map(f => add(`<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`));
  const pagesId = objs.length + 1; objs.push(null);
  const kids = pages.map((p, i) => {
    const foot = `Page ${i + 1} / ${pages.length}`;
    const fl = wrap(footer, 8.5, PAGE_W - 2 * M - 70)[0] || '';
    const stream = [...p,
      `0.8 0.77 0.72 RG 0.5 w ${M} 44 m ${(PAGE_W - M).toFixed(2)} 44 l S`,
      `BT /F1 8.5 Tf 0.38 0.36 0.33 rg ${M} 32 Td <${hex(fl)}> Tj ET`,
      `BT /F1 8.5 Tf 0.38 0.36 0.33 rg ${(PAGE_W - M - textWidth(foot, 8.5)).toFixed(2)} 32 Td <${hex(foot)}> Tj ET`].join('\n');
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fonts[0]} 0 R /F2 ${fonts[1]} 0 R /F3 ${fonts[2]} 0 R >> >> /Contents ${content} 0 R >>`);
  });
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  let names = '';
  if (attach) {
    const file = add(`<< /Type /EmbeddedFile /Subtype /text#2Fplain /Length ${attach.length} >>\nstream\n${attach}\nendstream`);
    const spec = add(`<< /Type /Filespec /F (sauvegarde.txt) /EF << /F ${file} 0 R >> >>`);
    names = ` /Names << /EmbeddedFiles << /Names [(sauvegarde.txt) ${spec} 0 R] >> >>`;
  }
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R${names} >>`);
  const info = add(`<< /Title <FEFF${[...title].map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}> /Producer (Huella) >>`);

  // Le contenu est en ASCII (texte en hexadécimal) : 1 caractère = 1 octet, les décalages sont justes.
  let out = '%PDF-1.4\n'; const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
