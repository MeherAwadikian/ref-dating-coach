// Local, on-device history (IndexedDB via Dexie). Nothing leaves the device.
import Dexie, { type Table } from 'dexie';

export type HistoryKind = 'coach' | 'opener' | 'profile' | 'practice';

export interface HistoryItem {
  id?: number;
  kind: HistoryKind;
  input: string; // what the user gave (conversation / about / bio)
  output: string; // one generated line (replies/openers stored one row each)
  tone?: string;
  createdAt: number;
}

class WingmanDB extends Dexie {
  history!: Table<HistoryItem, number>;
  constructor() {
    super('wingman');
    this.version(1).stores({ history: '++id, kind, createdAt' });
  }
}

export const db = new WingmanDB();

export async function saveLines(
  kind: HistoryKind,
  input: string,
  lines: string[],
  tone?: string,
): Promise<void> {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  if (!clean.length) return;
  const createdAt = Date.now();
  try {
    await db.history.bulkAdd(clean.map((output) => ({ kind, input, output, tone, createdAt })));
  } catch {
    /* storage may be unavailable (private mode) — history is best-effort */
  }
}

export async function recentHistory(limit = 200): Promise<HistoryItem[]> {
  try {
    return await db.history.orderBy('createdAt').reverse().limit(limit).toArray();
  } catch {
    return [];
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await db.history.clear();
  } catch {
    /* ignore */
  }
}
