import type { ShuangpinSchemeId } from '../schemes/types';
import type { PracticeModule } from './types';

export interface MistakeRecord {
  id: string;
  scheme: ShuangpinSchemeId;
  module: PracticeModule;
  targetChar: string;
  targetSyllable: string;
  expectedCode: string;
  expectedKey: string;
  actualKey: string;
  errorType: 'initial-key' | 'final-key' | 'sequence' | 'typo';
  contextText: string;
  count: number;
  lastWrongAt: number;
  lastCorrectAt: number | null;
  correctStreak: number;
  averageCorrectionMs: number;
}

export function scoreMistake(record: MistakeRecord, now = Date.now()): number {
  const hoursSinceWrong = Math.max(1, (now - record.lastWrongAt) / 36e5);
  const recency = 24 / Math.min(24, hoursSinceWrong);
  const correctionPenalty = Math.min(5, record.averageCorrectionMs / 600);
  const recovery = record.correctStreak * 1.5;

  return Math.max(0, record.count * 3 + recency + correctionPenalty - recovery);
}
