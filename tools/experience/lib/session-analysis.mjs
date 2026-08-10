import fs from 'node:fs';

export function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line, i) => {
    try { return JSON.parse(line); } catch (e) { throw new Error(`${file}:${i + 1}: ${e.message}`); }
  });
}

export function eventOf(row) {
  const e = row.event || row;
  return String(e.type || e.kind || e.name || '').toLowerCase();
}

export const CLASSES = Object.freeze({
  FIGHT: /hit|attack|damage|death|stagger|block|parry|dodge|aggro|combat|boss/,
  TALK: /dialog|topic|talk|speech|parley|persuad|greet/,
  READ: /read|book|journal|lore|note/,
  TRADE: /trade|barter|buy|sell|merchant/,
  CRAFT: /craft|brew|alchemy|enchant|repair/,
  MENU: /menu|inventory|equip|map_open|journal_open/,
  TRANSIT: /travel|transit|road|fast_travel|travel_node/,
  EXPLORE: /discover|enter|exit|region|interior|load|move|position/,
});

export function classify(row) {
  const name = eventOf(row);
  for (const [cls, re] of Object.entries(CLASSES)) if (re.test(name)) return cls;
  return name ? 'UNKNOWN' : 'IDLE';
}

export function frameOf(row, fallback = 0) {
  return Number(row.frame ?? row.f ?? row.t ?? row.tick ?? fallback);
}

export function analyse(rows, fps = 60, binMinutes = 60) {
  const maxFrame = Math.max(0, ...rows.map((r, i) => frameOf(r, i)));
  const binFrames = fps * 60 * binMinutes;
  const n = Math.max(1, Math.ceil((maxFrame + 1) / binFrames));
  const bins = Array.from({ length: n }, (_, i) => ({ index: i, counts: {}, total: 0 }));
  for (const [i, row] of rows.entries()) {
    const b = bins[Math.min(n - 1, Math.floor(frameOf(row, i) / binFrames))];
    const cls = classify(row); b.counts[cls] = (b.counts[cls] || 0) + 1; b.total++;
  }
  for (const b of bins) {
    b.fractions = Object.fromEntries(Object.entries(b.counts).map(([k, v]) => [k, v / b.total]));
    b.entropy_bits = -Object.values(b.fractions).reduce((s, p) => s + (p ? p * Math.log2(p) : 0), 0);
  }
  return { fps, duration_frames: maxFrame + 1, duration_minutes: (maxFrame + 1) / fps / 60, bins };
}

export function write(file, value) { fs.mkdirSync(new URL('.', `file://${file}`).pathname, { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
