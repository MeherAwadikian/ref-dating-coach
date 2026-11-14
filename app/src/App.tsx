import { useState } from 'react';
import {
  type Tone,
  type ProfileReview,
  generateIcebreakers,
  coachReplies,
  reviewProfile,
  practiceReply,
} from './engine';

type Tab = 'coach' | 'openers' | 'profile' | 'practice';

const TONES: Tone[] = ['playful', 'warm', 'direct', 'witty'];

export default function App() {
  const [tab, setTab] = useState<Tab>('coach');

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo"><img className="logo-mark" src="/logo.svg" alt="" /> Wingman</span>
        <span className="badge">AI coach</span>
      </header>

      <main className="screen">
        {tab === 'coach' && <CoachScreen />}
        {tab === 'openers' && <OpenersScreen />}
        {tab === 'profile' && <ProfileScreen />}
        {tab === 'practice' && <PracticeScreen />}
      </main>

      <nav className="tabbar">
        <TabButton id="coach" label="Coach" icon="💬" tab={tab} setTab={setTab} />
        <TabButton id="openers" label="Openers" icon="✨" tab={tab} setTab={setTab} />
        <TabButton id="profile" label="Profile" icon="🧐" tab={tab} setTab={setTab} />
        <TabButton id="practice" label="Practice" icon="🎯" tab={tab} setTab={setTab} />
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

function CoachScreen() {
  const [convo, setConvo] = useState('');
  const [out, setOut] = useState<string[]>([]);
  const [source, setSource] = useState<'ai' | 'offline' | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const r = await coachReplies(convo);
      setOut(r.items);
      setSource(r.source);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Reply coaching</h1>
      <p className="sub">Paste what they said. You get three replies in different tones, grounded in their actual message.</p>
      <textarea value={convo} onChange={(e) => setConvo(e.target.value)} rows={5}
        placeholder="e.g. She said: 'I basically live at the climbing gym on weekends'" />
      <button className="primary" onClick={run} disabled={!convo.trim() || busy}>
        {busy ? 'Thinking…' : 'Coach me'}
      </button>
      {source && <div className="srcline"><SourceTag source={source} /></div>}
      <div className="results">
        {out.map((r, i) => <div className="card" key={i}>{r}</div>)}
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
      setReview(await reviewProfile(bio));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Profile review</h1>
      <p className="sub">Paste your bio. Get a score and concrete fixes.</p>
      <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={5} placeholder="Paste your dating-app bio here…" />
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
        <button className="primary" onClick={send} disabled={!draft.trim() || busy}>Send</button>
      </div>
    </section>
  );
}

function copy(text: string) {
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
}
