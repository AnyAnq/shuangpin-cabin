import type { ShuangpinScheme } from '../schemes/types';
import { groupMistakesForPractice, scoreMistake, type MistakeRecord } from './mistakes';

const GRADUATION_STREAK = 3;

export interface MistakeReview {
  totalCount: number;
  activeCount: number;
  primaryFocusKey: string;
  primaryReason: string;
  topGroup: MistakeReviewGroup | null;
  distributions: MistakeReviewDistribution[];
  details: MistakeReviewDetail[];
}

export interface MistakeReviewGroup {
  id: string;
  title: string;
  description: string;
  target: string;
  focusKeys: string[];
  chars: string;
  total: number;
  riskLabel: string;
}

export interface MistakeReviewDistribution {
  type: MistakeRecord['errorType'];
  title: string;
  count: number;
  focusKeys: string[];
  riskLabel: string;
  score: number;
}

export interface MistakeReviewDetail {
  id: string;
  char: string;
  expectedCode: string;
  keyPath: string;
  count: number;
  correctStreak: number;
  lastWrongAt: number;
  reasonLabel: string;
  graduated: boolean;
  score: number;
}

export function buildMistakeReview(records: MistakeRecord[], scheme: ShuangpinScheme, now = Date.now()): MistakeReview {
  const schemeRecords = records.filter((record) => record.scheme === scheme.id);
  const activeRecords = schemeRecords.filter((record) => !isGraduated(record));
  const topGroup = toReviewGroup(groupMistakesForPractice(activeRecords, scheme, now).find((group) => !group.empty) ?? null);
  const distributions = buildDistributions(schemeRecords, now);
  const details = schemeRecords
    .map((record) => ({
      id: record.id,
      char: record.targetChar,
      expectedCode: record.expectedCode,
      keyPath: `${record.expectedKey.toUpperCase()} -> ${record.actualKey.toUpperCase()}`,
      count: record.count,
      correctStreak: record.correctStreak,
      lastWrongAt: record.lastWrongAt,
      reasonLabel: reasonLabel(record.errorType),
      graduated: isGraduated(record),
      score: scoreMistake(record, now),
    }))
    .sort((a, b) => b.score - a.score || b.lastWrongAt - a.lastWrongAt);

  return {
    totalCount: schemeRecords.length,
    activeCount: activeRecords.length,
    primaryFocusKey: topGroup?.focusKeys[0]?.toUpperCase() ?? '待积累',
    primaryReason: topGroup?.title ?? '先积累错题',
    topGroup,
    distributions,
    details,
  };
}

function buildDistributions(records: MistakeRecord[], now: number): MistakeReviewDistribution[] {
  const buckets = new Map<MistakeRecord['errorType'], MistakeRecord[]>();
  for (const record of records) {
    buckets.set(record.errorType, [...(buckets.get(record.errorType) ?? []), record]);
  }

  return Array.from(buckets.entries())
    .map(([type, bucketRecords]) => {
      const score = bucketRecords.reduce((sum, record) => sum + scoreMistake(record, now), 0);
      return {
        type,
        title: reasonLabel(type),
        count: bucketRecords.length,
        focusKeys: Array.from(new Set(bucketRecords.map((record) => record.actualKey.toUpperCase()))),
        riskLabel: riskLabel(score),
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function toReviewGroup(group: ReturnType<typeof groupMistakesForPractice>[number] | null): MistakeReviewGroup | null {
  if (!group) return null;
  return {
    id: group.id,
    title: group.title,
    description: group.description,
    target: group.target,
    focusKeys: group.focusKeys,
    chars: group.unit.text,
    total: group.total,
    riskLabel: riskLabel(group.priority),
  };
}

function isGraduated(record: MistakeRecord): boolean {
  return record.correctStreak >= GRADUATION_STREAK;
}

function reasonLabel(type: MistakeRecord['errorType']): string {
  if (type === 'initial-key') return '声母键误按';
  if (type === 'final-key') return '韵母键误按';
  if (type === 'sequence') return '按键顺序不稳';
  return '误触修正';
}

function riskLabel(score: number): string {
  if (score >= 18) return '高风险';
  if (score >= 8) return '中风险';
  return '观察';
}
