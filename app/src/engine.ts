// Wingman engine.
//
// Each public function tries the real AI backend first (Cloudflare Pages Function at
// /api/ai, which calls OpenRouter server-side), and transparently falls back to the
// on-device rule-based generator when offline or if the backend is unconfigured/down.
// So the app is genuinely useful online and still works with no network.

export type Tone = 'playful' | 'warm' | 'direct' | 'witty';

// '' -> same-origin (PWA on Cloudflare Pages). For the Capacitor iOS build, set
// VITE_API_BASE to the deployed Pages URL at build time (see DEPLOY.md).
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

async function callAI(mode: string, payload: Record<string, unknown>, timeoutMs = 20000): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, ...payload }),
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`api ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------- public API (AI-first, local fallback) ----------

export async function coachReplies(
  conversation: string,
  tones: Tone[] = ['playful', 'warm', 'direct'],
): Promise<{ items: string[]; source: 'ai' | 'offline' }> {
  if (!conversation.trim()) return { items: [], source: 'offline' };
  try {
    const data = await callAI('coach', { conversation, tones });
    if (Array.isArray(data?.items) && data.items.length) return { items: data.items, source: 'ai' };
    throw new Error('empty');
  } catch {
    return { items: localCoachReplies(conversation, tones), source: 'offline' };
  }
}

export async function generateIcebreakers(
  tone: Tone,
  about = '',
): Promise<{ items: string[]; source: 'ai' | 'offline' }> {
  try {
    const data = await callAI('openers', { tone, about });
    if (Array.isArray(data?.items) && data.items.length) return { items: data.items, source: 'ai' };
    throw new Error('empty');
  } catch {
    return { items: localIcebreakers(tone), source: 'offline' };
  }
}

export interface ProfileReview {
  score: number;
  strengths: string[];
  fixes: string[];
  source: 'ai' | 'offline';
}

export async function reviewProfile(bio: string): Promise<ProfileReview> {
  try {
    const data = await callAI('profile', { bio });
    if (typeof data?.score === 'number') {
      return {
        score: data.score,
        strengths: Array.isArray(data.strengths) ? data.strengths.map(String) : [],
        fixes: Array.isArray(data.fixes) ? data.fixes.map(String) : [],
        source: 'ai',
      };
    }
    throw new Error('bad');
  } catch {
    return { ...localReviewProfile(bio), source: 'offline' };
  }
}

export async function practiceReply(history: { me: boolean; text: string }[]): Promise<string> {
  try {
    const data = await callAI('practice', { history });
    if (typeof data?.reply === 'string' && data.reply.trim()) return data.reply.trim();
    throw new Error('empty');
  } catch {
    const turn = history.filter((m) => m.me).length;
    return localPracticeReply(turn);
  }
}

// ---------- on-device fallback (clean-room, rule-based) ----------

const OPENERS: Record<Tone, string[]> = {
  playful: [
    'Okay, important question before we go any further: pineapple on pizza — yes or crime?',
    'I have a strict two-question limit on first messages. Burning one on: what made you smile today?',
    'Your profile passed vibe-check. Risky follow-up: what are you weirdly competitive about?',
  ],
  warm: [
    'Hi! Your profile has a really easy, genuine energy — what have you been enjoying lately?',
    'Hey — you seem like good company. What does a good weekend look like for you?',
    'Something about your photos reads very "down to earth." What are you into these days?',
  ],
  direct: [
    "Hey, I'll be straightforward: you caught my eye. What are you looking for on here?",
    'Not big on small talk — what actually gets you excited right now?',
    "I'd like to take you for a coffee. But first: tea or coffee person?",
  ],
  witty: [
    'I was going to open with a clever line, but honestly your profile already set the bar too high.',
    "Statistically one of us has to send the first message. I drew the short straw — lucky you.",
    "On a scale of 'texts back in 3 seconds' to 'ghost', how are we feeling about this conversation?",
  ],
};

function firstHook(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'that';
  const words = cleaned.split(' ').slice(0, 6).join(' ');
  return words.length > 48 ? words.slice(0, 45) + '…' : words;
}

const REPLY_MOVES: Record<Tone, (ctx: string) => string> = {
  playful: (c) => `playful: "${firstHook(c)}? Bold claim — you're going to have to back that up over coffee."`,
  warm: (c) => `warm: "I love that — ${firstHook(c)}. Tell me more, what's the story there?"`,
  direct: () => `direct: "Honestly I'm enjoying this. Free this week? I'd like to keep it going in person."`,
  witty: (c) => `witty: "Noted: ${firstHook(c)}. I'm choosing to be impressed rather than intimidated."`,
};

function localIcebreakers(tone: Tone, count = 3): string[] {
  return OPENERS[tone].slice(0, Math.min(count, OPENERS[tone].length));
}

function localCoachReplies(conversation: string, tones: Tone[]): string[] {
  const ctx = conversation.trim();
  if (!ctx) return [];
  return tones.map((t) => REPLY_MOVES[t](ctx));
}

function localReviewProfile(bio: string): { score: number; strengths: string[]; fixes: string[] } {
  const text = bio.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const strengths: string[] = [];
  const fixes: string[] = [];
  if (words >= 25) strengths.push('Good length — enough to give someone a hook to reply to.');
  else fixes.push('Too short. Aim for 25–60 words; give at least two concrete hooks.');
  if (/[?]/.test(text)) strengths.push('Ends with an invitation to respond — nice.');
  else fixes.push('Add one light question or call-to-action so matches know how to open.');
  const generic = ['fun', 'easygoing', 'love to laugh', 'adventure', 'good vibes'];
  const hits = generic.filter((g) => text.toLowerCase().includes(g));
  if (hits.length) fixes.push(`Swap clichés (${hits.join(', ')}) for one specific, true detail.`);
  else if (words > 0) strengths.push('Avoids the usual clichés — feels specific.');
  if (/\b(I|my|me)\b/i.test(text)) strengths.push('Written in first person — reads as genuine.');
  let score = 40 + Math.min(words, 60) / 2;
  if (/[?]/.test(text)) score += 15;
  score -= hits.length * 8;
  score = Math.max(5, Math.min(99, Math.round(score)));
  return { score, strengths, fixes };
}

const PRACTICE_REPLIES = [
  "Haha okay that's actually a good answer. So what's your go-to way to spend a day off?",
  "Mm, I'll allow it. Tell me something most people don't guess about you.",
  "You're more fun than your profile let on. Are you a planner or a wing-it person?",
  "Careful, I might start enjoying this. What's the last thing that genuinely made you laugh?",
  "Bold. I respect it. Coffee or a walk — what's your ideal low-key first meet?",
];

function localPracticeReply(turn: number): string {
  return PRACTICE_REPLIES[turn % PRACTICE_REPLIES.length];
}
