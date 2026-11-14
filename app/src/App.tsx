import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Fuse from 'fuse.js';
import {
  type Tone,
  type ProfileReview,
  generateIcebreakers,
  coachReplies,
  reviewProfile,
  practiceReply,
} from './engine';
import { saveLines, recentHistory, clearHistory, type HistoryItem } from './db';
import { ocrImage } from './ocr';
import { analyzeTone, type ToneStats } from './tone';

type Tab = 'coach' | 'openers' | 'profile' | 'practice' | 'history';

const TONES: Tone[] = ['playful', 'warm', 'direct', 'witty'];

// Share-target (Android): a shared screenshot's text / selected text arrives as
// query params on load. Grab it once so Coach can prefill.
function initialSharedText(): string {
  try {
    const p = new URLSearchParams(window.location.search);
    return (p.get('text') || p.get('title') || p.get('url') || '').trim();
  } catch {
    return '';
  }
}

export default function App() {
  const shared = initialSharedText();
  const [tab, setTab] = useState<Tab>('coach');

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo"><img className="logo-mark" src="/logo.svg" alt="" /> Wingman</span>
        <span className="badge">AI coach</span>
      </header>

      <main className="screen">
        {tab === 'coach' && <CoachScreen initial={shared} />}
        {tab === 'openers' && <OpenersScreen />}
        {tab === 'profile' && <ProfileScreen />}
        {tab === 'practice' && <PracticeScreen />}
        {tab === 'history' && <HistoryScreen />}
      </main>

      <nav className="tabbar">
        <TabButton id="coach" label="Coach" icon="💬" tab={tab} setTab={setTab} />
        <TabButton id="openers" label="Openers" icon="✨" tab={tab} setTab={setTab} />
        <TabButton id="profile" label="Profile" icon="🧐" tab={tab} setTab={setTab} />
        <TabButton id="practice" label="Practice" icon="🎯" tab={tab} setTab={setTab} />
        <TabButton id="history" label="History" icon="🕑" tab={tab} setTab={setTab} />
      </nav>
    </div>
  );
}

function TabButton(props: { id: Tab; label: string; icon: string; tab: Tab; setTab: (t: Tab) => void }) {
  const active = props.tab === props.id;
  return (
    <button className={active ? 'tab active' : 'tab'} onClick={() => props.setTab(props.id)} aria-current={active}>
      <span className="tab-icon">{props.icon}</span>
      <span className="tab-label">{props.label}</span>
    </button>
  );
}

function SourceTag({ source }: { source: 'ai' | 'offline' }) {
  return (
    <span className={source === 'ai' ? 'srctag ai' : 'srctag off'}>
      {source === 'ai' ? '✨ AI' : '📴 offline'}
    </span>
  );
}

// ---------- emoji picker (lazy; data ships as static JSON, no network) ----------
const EmojiPanel = lazy(async () => {
  const [{ default: data }, { default: Picker }] = await Promise.all([
    import('@emoji-mart/data'),
    import('@emoji-mart/react'),
  ]);
  return {
    default: ({ onPick }: { onPick: (e: string) => void }) => (
      <Picker data={data} theme="dark" previewPosition="none" skinTonePosition="search"
        onEmojiSelect={(e: { native: string }) => onPick(e.native)} />
    ),
  };
});

function EmojiButton({ onPick }: { onPick: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="emoji-wrap">
      <button type="button" className="ghost-btn" onClick={() => setOpen((o) => !o)} aria-label="Insert emoji">
        😊
      </button>
      {open && (
        <div className="emoji-pop">
          <Suspense fallback={<div className="emoji-loading">Loading…</div>}>
            <EmojiPanel onPick={(e) => { onPick(e); setOpen(false); }} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

// ---------- on-device tone meter (debounced) ----------
function ToneMeter({ text }: { text: string }) {
  const [stats, setStats] = useState<ToneStats | null>(null);
  useEffect(() => {
    const t = text.trim();
    if (t.length < 3) { setStats(null); return; }
    const timer = setTimeout(() => { analyzeTone(t).then(setStats).catch(() => {}); }, 400);
    return () => clearTimeout(timer);
  }, [text]);
  if (!stats) return null;
  return (
    <div className="tonemeter" aria-live="polite">
      <span className={`pill tone-${stats.label}`}>{stats.label}</span>
      <span className="pill">{stats.questions > 0 ? `${stats.questions} question${stats.questions > 1 ? 's' : ''}` : 'no question'}</span>
      <span className="pill">{stats.words} words</span>
      <span className="pill">~{stats.perSentence}/sentence</span>
    </div>
  );
}

// ---------- screenshot -> text control ----------
function OcrControl({ onText }: { onText: (t: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);

  async function handle(file: Blob) {
    setBusy(true); setPct(0);
    try {
      const text = await ocrImage(file, (f) => setPct(Math.round(f * 100)));
      if (text) onText(text);
    } catch {
      /* ignore OCR failure */
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="ghost-btn wide" onClick={() => fileRef.current?.click()} disabled={busy}>
        {busy ? `Reading screenshot… ${pct}%` : '📷 Paste a screenshot'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ''; }} />
    </>
  );
}

function CoachScreen({ initial = '' }: { initial?: string }) {
  const [convo, setConvo] = useState(initial);
  const [out, setOut] = useState<string[]>([]);
  const [source, setSource] = useState<'ai' | 'offline' | null>(null);
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  async function run() {
    setBusy(true);
    try {
      const r = await coachReplies(convo);
      setOut(r.items);
      setSource(r.source);
      saveLines('coach', convo, r.items);
    } finally {
      setBusy(false);
    }
  }

  // Paste an image directly into the textarea -> OCR it.
  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const img = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (img) {
      const file = img.getAsFile();
      if (file) { e.preventDefault(); runOcr(file); }
    }
  }
  async function runOcr(file: Blob) {
    const text = await ocrImage(file).catch(() => '');
    if (text) setConvo((c) => (c ? c + '\n' : '') + text);
  }

  return (
    <section>
      <h1>Reply coaching</h1>
      <p className="sub">Paste what they said — or a screenshot. You get three replies in different tones, grounded in their actual message.</p>
      <OcrControl onText={(t) => setConvo((c) => (c ? c + '\n' : '') + t)} />
      <textarea ref={taRef} value={convo} onChange={(e) => setConvo(e.target.value)} onPaste={onPaste} rows={5}
        placeholder="e.g. She said: 'I basically live at the climbing gym on weekends'" />
      <div className="composer-tools">
        <EmojiButton onPick={(e) => setConvo((c) => c + e)} />
        <ToneMeter text={convo} />
      </div>
      <button className="primary" onClick={run} disabled={!convo.trim() || busy}>
        {busy ? 'Thinking…' : 'Coach me'}
      </button>
      {source && <div className="srcline"><SourceTag source={source} /></div>}
      <div className="results">
        {out.map((r, i) => <button className="card tappable" key={i} onClick={() => copy(r)}>{r}</button>)}
      </div>
    </section>
  );
}

function OpenersScreen() {
  const [tone, setTone] = useState<Tone>('playful');
  const [about, setAbout] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [source, setSource] = useState<'ai' | 'offline' | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const r = await generateIcebreakers(tone, about);
      setLines(r.items);
      setSource(r.source);
      saveLines('opener', about, r.items, tone);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Icebreakers</h1>
      <p className="sub">Pick a tone, add a little about them, and generate openers. Tap a line to copy.</p>
      <div className="chips">
        {TONES.map((t) => (
          <button key={t} className={t === tone ? 'chip active' : 'chip'} onClick={() => setTone(t)}>{t}</button>
        ))}
      </div>
      <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3}
        placeholder="Optional: what's in their profile? (e.g. 'loves hiking, has a golden retriever, into film photography')" />
      <div className="composer-tools">
        <EmojiButton onPick={(e) => setAbout((c) => c + e)} />
      </div>
      <button className="primary" onClick={run} disabled={busy}>{busy ? 'Thinking…' : 'Generate openers'}</button>
      {source && <div className="srcline"><SourceTag source={source} /></div>}
      <div className="results">
        {lines.map((l, i) => (
          <button className="card tappable" key={i} onClick={() => copy(l)}>{l}</button>
        ))}
      </div>
    </section>
  );
}

function ProfileScreen() {
  const [bio, setBio] = useState('');
  const [review, setReview] = useState<ProfileReview | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const r = await reviewProfile(bio);
      setReview(r);
      saveLines('profile', bio, [`Score ${r.score}/100`, ...r.fixes]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Profile review</h1>
      <p className="sub">Paste your bio. Get a score and concrete fixes.</p>
      <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={5} placeholder="Paste your dating-app bio here…" />
      <div className="composer-tools">
        <EmojiButton onPick={(e) => setBio((c) => c + e)} />
        <ToneMeter text={bio} />
      </div>
      <button className="primary" onClick={run} disabled={!bio.trim() || busy}>{busy ? 'Reviewing…' : 'Review it'}</button>
      {review && (
        <div className="results">
          <div className="srcline"><SourceTag source={review.source} /></div>
          <div className="score"><span className="score-num">{review.score}</span><span className="score-cap">/ 100</span></div>
          {review.strengths.length > 0 && (
            <div className="card good"><strong>What works</strong><ul>{review.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          )}
          {review.fixes.length > 0 && (
            <div className="card fix"><strong>Fix these</strong><ul>{review.fixes.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          )}
        </div>
      )}
    </section>
  );
}

function PracticeScreen() {
  const [log, setLog] = useState<{ me: boolean; text: string }[]>([
    { me: false, text: "Hey! So your profile says you're into live music — who's the last band you saw?" },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!draft.trim() || busy) return;
    const next = [...log, { me: true, text: draft.trim() }];
    setLog(next);
    setDraft('');
    setBusy(true);
    try {
      const reply = await practiceReply(next);
      setLog((l) => [...l, { me: false, text: reply }]);
      saveLines('practice', draft.trim(), [reply]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Practice mode</h1>
      <p className="sub">A realistic simulated match. Rehearse without the stakes.</p>
      <div className="chat">
        {log.map((m, i) => <div className={m.me ? 'bubble me' : 'bubble them'} key={i}>{m.text}</div>)}
        {busy && <div className="bubble them typing">…</div>}
      </div>
      <div className="composer">
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Type your reply…" />
        <EmojiButton onPick={(e) => setDraft((c) => c + e)} />
        <button className="primary" onClick={send} disabled={!draft.trim() || busy}>Send</button>
      </div>
    </section>
  );
}

const KIND_ICON: Record<HistoryItem['kind'], string> = {
  coach: '💬', opener: '✨', profile: '🧐', practice: '🎯',
};

function HistoryScreen() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => { recentHistory().then(setItems); }, []);

  const fuse = new Fuse(items, { keys: ['output', 'input'], threshold: 0.4, ignoreLocation: true });
  const shown = q.trim() ? fuse.search(q.trim()).map((r) => r.item) : items;

  async function wipe() {
    await clearHistory();
    setItems([]);
  }

  return (
    <section>
      <h1>History</h1>
      <p className="sub">Everything you've generated, saved on this device only. Tap a line to copy.</p>
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your saved lines… (e.g. 'the hiking one')" />
      {items.length === 0 && <p className="empty">Nothing yet — generate some replies or openers.</p>}
      <div className="results">
        {shown.map((it) => (
          <button className="card tappable histrow" key={it.id} onClick={() => copy(it.output)}>
            <span className="hist-ico">{KIND_ICON[it.kind]}</span>
            <span className="hist-text">{it.output}</span>
          </button>
        ))}
      </div>
      {items.length > 0 && (
        <button className="ghost-btn danger" onClick={wipe}>Clear history</button>
      )}
    </section>
  );
}

function copy(text: string) {
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
}
