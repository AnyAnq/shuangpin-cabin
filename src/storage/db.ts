import Dexie, { type Table } from 'dexie';
import type { MistakeRecord } from '../domain/practice/mistakes';
import type { PracticeModule } from '../domain/practice/types';
import type { ShuangpinSchemeId } from '../domain/schemes/types';

export interface PracticeSessionRecord {
  id: string;
  scheme: ShuangpinSchemeId;
  module: PracticeModule;
  accuracy: number;
  wpm: number;
  maxCombo: number;
  elapsedMs: number;
  createdAt: number;
}

export interface PreferenceRecord {
  id: string;
  scheme: ShuangpinSchemeId;
  module: PracticeModule;
  updatedAt: number;
}

class ShuangpinPracticeDb extends Dexie {
  mistakes!: Table<MistakeRecord, string>;
  sessions!: Table<PracticeSessionRecord, string>;
  preferences!: Table<PreferenceRecord, string>;

  constructor() {
    super('shuangpin-cabin');
    this.version(1).stores({
      mistakes: 'id, scheme, module, targetChar, expectedKey, lastWrongAt',
      sessions: 'id, scheme, module, createdAt',
      preferences: 'id, scheme, module, updatedAt',
    });
  }
}

export const db = new ShuangpinPracticeDb();
