import type { MistakeRecord } from '../domain/practice/mistakes';
import { db, type PracticeSessionRecord, type PreferenceRecord } from './db';

export function saveMistake(record: MistakeRecord): Promise<string> {
  return db.mistakes.put(record);
}

export function saveSession(record: PracticeSessionRecord): Promise<string> {
  return db.sessions.put(record);
}

export function savePreferences(record: PreferenceRecord): Promise<string> {
  return db.preferences.put(record);
}
