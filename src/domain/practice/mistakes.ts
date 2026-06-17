import type { ShuangpinSchemeId } from '../schemes/types';
import type { ShuangpinScheme } from '../schemes/types';
import type { PracticeModule } from './types';
import type { PracticeUnit } from './types';

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

export interface MistakeGroupReason {
  type: MistakeRecord['errorType'];
  expectedKey: string;
  actualKey: string;
}

export interface MistakePracticeGroup {
  id: string;
  title: string;
  description: string;
  target: string;
  focusKeys: string[];
  total: number;
  empty: boolean;
  reason: MistakeGroupReason;
  mistakeIds: string[];
  unit: PracticeUnit;
  priority: number;
}

const GRADUATION_STREAK = 3;
const MAX_GROUP_SIZE = 12;

export function scoreMistake(record: MistakeRecord, now = Date.now()): number {
  const hoursSinceWrong = Math.max(1, (now - record.lastWrongAt) / 36e5);
  const recency = 24 / Math.min(24, hoursSinceWrong);
  const correctionPenalty = Math.min(5, record.averageCorrectionMs / 600);
  const graduationPenalty = record.correctStreak >= GRADUATION_STREAK ? 100 : 0;
  const recovery = record.correctStreak * 1.5 + graduationPenalty;

  return Math.max(0, record.count * 3 + recency + correctionPenalty - recovery);
}

export function groupMistakesForPractice(records: MistakeRecord[], scheme: ShuangpinScheme, now = Date.now()): MistakePracticeGroup[] {
  const candidates = records.filter((record) => record.scheme === scheme.id);
  if (candidates.length === 0) {
    return [createEmptyMistakeGroup(scheme)];
  }

  const buckets = new Map<string, MistakeRecord[]>();
  for (const record of candidates) {
    const key = `${record.errorType}:${record.actualKey}`;
    buckets.set(key, [...(buckets.get(key) ?? []), record]);
  }

  return Array.from(buckets.entries())
    .map(([key, groupRecords]) => createMistakeGroup(key, groupRecords, scheme, now))
    .sort((a, b) => groupScore(b) - groupScore(a));
}

export function mistakeGroupToPracticeUnit(group: MistakePracticeGroup): PracticeUnit {
  return group.unit;
}

function createMistakeGroup(key: string, records: MistakeRecord[], scheme: ShuangpinScheme, now: number): MistakePracticeGroup {
  const sortedRecords = [...records]
    .sort((a, b) => scoreMistake(b, now) - scoreMistake(a, now))
    .slice(0, MAX_GROUP_SIZE);
  const first = sortedRecords[0];
  const reason = {
    type: first.errorType,
    expectedKey: first.expectedKey,
    actualKey: first.actualKey,
  };
  const focusKeys = Array.from(new Set(sortedRecords.map((record) => record.actualKey)));
  const sourceRecords = sortedRecords.length > 0 ? sortedRecords : records;

  return {
    id: `mistake-group-${scheme.id}-${key}`,
    title: reasonTitle(first.errorType),
    description: reasonDescription(first.errorType, focusKeys),
    target: '连续正确 3 次后降权',
    focusKeys,
    total: sourceRecords.length,
    empty: false,
    reason,
    mistakeIds: sourceRecords.map((record) => record.id),
    priority: sourceRecords.reduce((sum, record) => sum + scoreMistake(record, now), 0),
    unit: {
      id: `mistake-group-${scheme.id}-${key}`,
      module: 'character',
      text: sourceRecords.map((record) => record.targetChar).join(''),
      syllables: sourceRecords.map((record) => record.targetSyllable),
      source: '易错复练',
      tags: ['易错', reasonTitle(first.errorType)],
    },
  };
}

function createEmptyMistakeGroup(scheme: ShuangpinScheme): MistakePracticeGroup {
  return {
    id: `mistake-empty-${scheme.id}`,
    title: '太棒了，没有出过错误',
    description: '目前还没有发现需要复练的错题，说明你的输入状态很稳。',
    target: '继续保持，打出第一条错题后这里会自动生成复练组',
    focusKeys: [],
    total: 0,
    empty: true,
    reason: {
      type: 'sequence',
      expectedKey: '',
      actualKey: '',
    },
    mistakeIds: [],
    priority: -1,
    unit: {
      id: `mistake-empty-${scheme.id}`,
      module: 'character',
      text: '',
      syllables: [],
      source: '零错记录',
      tags: ['零错记录'],
    },
  };
}

function groupScore(group: MistakePracticeGroup): number {
  if (group.empty) return -1;
  return group.priority + group.mistakeIds.length * 0.01;
}

function reasonTitle(type: MistakeRecord['errorType']): string {
  if (type === 'initial-key') return '声母键误按';
  if (type === 'final-key') return '韵母键误按';
  if (type === 'sequence') return '按键顺序不稳';
  return '误触修正';
}

function reasonDescription(type: MistakeRecord['errorType'], focusKeys: string[]): string {
  const keyText = focusKeys.length > 0 ? focusKeys.map((key) => key.toUpperCase()).join(' / ') : '当前键位';
  if (type === 'initial-key') return `重点修正 ${keyText} 附近的声母误按。`;
  if (type === 'final-key') return `重点修正 ${keyText} 附近的韵母误按。`;
  return `集中修正 ${keyText} 相关的输入偏差。`;
}
