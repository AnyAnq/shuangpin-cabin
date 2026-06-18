import Dexie, { type Table } from 'dexie';
import type { MistakeRecord } from '../domain/practice/mistakes';
import type { PracticeModule } from '../domain/practice/types';
import type { ShuangpinSchemeId } from '../domain/schemes/types';
import type { VocabularyPricingType } from '../domain/vocabulary';

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
  defaultModule?: PracticeModule;
  showCharacterCodes?: boolean;
  lastVocabularyPackageId?: string;
  updatedAt: number;
}

export interface VocabularyPackageRecord {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  pricingType: VocabularyPricingType;
  tags: string[];
  entryCount: number;
  installedAt: number;
  updatedAt: number;
  sourceUrl: string;
  checksum?: string;
}

export interface VocabularyEntryRecord {
  id: string;
  packageId: string;
  text: string;
  weight?: number;
  tags: string[];
  source?: string;
  length: number;
}

class ShuangpinPracticeDb extends Dexie {
  mistakes!: Table<MistakeRecord, string>;
  sessions!: Table<PracticeSessionRecord, string>;
  preferences!: Table<PreferenceRecord, string>;
  vocabularyPackages!: Table<VocabularyPackageRecord, string>;
  vocabularyEntries!: Table<VocabularyEntryRecord, string>;

  constructor() {
    super('shuangpin-cabin');
    this.version(1).stores({
      mistakes: 'id, scheme, module, targetChar, expectedKey, lastWrongAt',
      sessions: 'id, scheme, module, createdAt',
      preferences: 'id, scheme, module, updatedAt',
    });
    this.version(2).stores({
      mistakes: 'id, scheme, module, targetChar, expectedKey, lastWrongAt',
      sessions: 'id, scheme, module, createdAt',
      preferences: 'id, scheme, module, updatedAt',
      vocabularyPackages: 'id, pricingType, installedAt, updatedAt',
      vocabularyEntries: 'id, packageId, text, weight, length',
    });
  }
}

export const db = new ShuangpinPracticeDb();
