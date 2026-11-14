// On-device "how does this read?" pre-check. Lazy-loads wink-nlp + its lite English
// model (MIT, ~1 MB, runs fully in the browser, offline). It is a lexicon heuristic,
// not a replacement for the LLM — a cheap instant gut-check before spending an AI call.
export interface ToneStats {
  sentiment: number; // -1 (cool) .. +1 (warm)
  label: string; // human sentiment label
  questions: number; // count of '?' — invites a reply
  words: number;
  perSentence: number; // avg words/sentence — a rough readability signal
}

let enginePromise: Promise<{ nlp: any; its: any }> | null = null;
function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const mod: any = await import('wink-nlp');
      const winkNLP = mod.default ?? mod;
      const model: any = (await import('wink-eng-lite-web-model')).default;
      const nlp = winkNLP(model);
      // `its` helpers live on the instance (nlp.its), not as a package export.
      return { nlp, its: nlp.its };
    })();
  }
  return enginePromise;
}

export async function analyzeTone(text: string): Promise<ToneStats | null> {
  const t = text.trim();
  if (t.length < 3) return null;
  const { nlp, its } = await getEngine();
  const doc = nlp.readDoc(t);
  const sentiment: number = doc.out(its.sentiment);
  const words: number = doc
    .tokens()
    .filter((tk: any) => tk.out(its.type) === 'word')
    .length();
  const sentences: number = Math.max(1, doc.sentences().length());
  const questions = (t.match(/\?/g) || []).length;
  const label =
    sentiment > 0.25 ? 'warm' : sentiment < -0.2 ? 'cool' : 'neutral';
  return {
    sentiment,
    label,
    questions,
    words,
    perSentence: Math.round(words / sentences),
  };
}
