// lib/overlap.ts — copyright hygiene gate for editor-written 5W cards.
// Blocks publish if any 8-word shingle of the card matches source text the editor pasted
// into the "source excerpt (private, for checking)" field. Evidence of good-faith process.
const SHINGLE = 8;

const norm = (s: string) =>
  s.toLowerCase().replace(/[“”"'’‘.,;:!?()\[\]—–-]/g, " ").replace(/\s+/g, " ").trim();

function shingles(text: string, n = SHINGLE): Set<string> {
  const w = norm(text).split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

export function verbatimOverlap(cardText: string, sourceTexts: string[]) {
  const cardShingles = shingles(cardText);
  const hits: string[] = [];
  for (const src of sourceTexts) {
    const s = shingles(src);
    for (const sh of cardShingles) if (s.has(sh)) hits.push(sh);
  }
  return { blocked: hits.length > 0, matches: [...new Set(hits)].slice(0, 5) };
}
