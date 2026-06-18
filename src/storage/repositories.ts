import type { MistakeRecord } from '../domain/practice/mistakes';
import { scoreMistake } from '../domain/practice/mistakes';
import type { ShuangpinSchemeId } from '../domain/schemes/types';
import { db, type PracticeSessionRecord, type PreferenceRecord } from './db';

export function saveMistake(record: MistakeRecord): Promise<string> {
  return db.mistakes.put(record);
}

export async function upsertMistake(record: MistakeRecord): Promise<string> {
  const existing = await db.mistakes.get(record.id);
  if (!existing) return saveMistake(record);

  return saveMistake({
    ...existing,
    ...record,
    count: existing.count + record.count,
    correctStreak: 0,
    lastCorrectAt: existing.lastCorrectAt,
    lastWrongAt: Math.max(existing.lastWrongAt, record.lastWrongAt),
  });
}

export async function listMistakesForPractice(scheme: ShuangpinSchemeId, now = Date.now(), limit = 12): Promise<MistakeRecord[]> {
  const records = await db.mistakes.where('scheme').equals(scheme).toArray();
  return records
    .sort((a, b) => scoreMistake(b, now) - scoreMistake(a, now))
    .slice(0, limit);
}

export async function listMistakesByScheme(scheme: ShuangpinSchemeId): Promise<MistakeRecord[]> {
  const records = await db.mistakes.where('scheme').equals(scheme).toArray();
  return records.sort((a, b) => b.lastWrongAt - a.lastWrongAt);
}

export async function markMistakeCorrect(id: string, now = Date.now()): Promise<void> {
  const record = await db.mistakes.get(id);
  if (!record) return;

  await db.mistakes.put({
    ...record,
    correctStreak: record.correctStreak + 1,
    lastCorrectAt: now,
  });
}

export function saveSession(record: PracticeSessionRecord): Promise<string> {
  return db.sessions.put(record);
}

export function savePreferences(record: PreferenceRecord): Promise<string> {
  return db.preferences.put(record);
}

export function loadPreferences(id = 'default'): Promise<PreferenceRecord | undefined> {
  return db.preferences.get(id);
}

export function clearMistakes(): Promise<void> {
  return db.mistakes.clear();
}

export function clearSessions(): Promise<void> {
  return db.sessions.clear();
}
