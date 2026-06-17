import { pinyin } from 'pinyin-pro';
import type { PracticeUnit } from './practice/types';

export type VocabularyPricingType = 'free' | 'paid' | 'owned';

export interface VocabularyRegistry {
  schemaVersion: 1;
  updatedAt: string;
  packages: VocabularyRegistryItem[];
}

export interface VocabularyRegistryItem {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  pricingType: VocabularyPricingType;
  tags: string[];
  entryCount: number;
  downloadUrl: string;
  mirrorUrls?: string[];
  checksum?: string;
  minAppVersion?: string;
}

export interface VocabularyPackageFile {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  author: string;
  license: string;
  pricingType: VocabularyPricingType;
  description: string;
  tags: string[];
  entries: VocabularyEntry[];
}

export interface VocabularyEntry {
  text: string;
  weight?: number;
  tags?: string[];
  source?: string;
}

export interface VocabularyPracticeUnit extends PracticeUnit {
  module: 'vocabulary';
  lineCharCount: number;
  packageId: string;
}

const ZH_ONLY = /^[\u4e00-\u9fff]+$/;

export function validateVocabularyRegistry(input: unknown): VocabularyRegistry {
  if (!isRecord(input) || input.schemaVersion !== 1 || typeof input.updatedAt !== 'string' || !Array.isArray(input.packages)) {
    throw new Error('词库索引格式不完整');
  }

  const packages = input.packages.map((item) => {
    if (!isRecord(item) || !isRegistryItem(item)) {
      throw new Error('词库索引格式不完整');
    }
    return {
      schemaVersion: 1 as const,
      ...item,
      tags: [...item.tags],
      mirrorUrls: item.mirrorUrls ? [...item.mirrorUrls] : undefined,
    };
  });

  return {
    schemaVersion: 1,
    updatedAt: input.updatedAt,
    packages,
  };
}

export function validateVocabularyPackage(input: unknown): VocabularyPackageFile {
  if (!isRecord(input) || input.schemaVersion !== 1 || !isPackageMeta(input) || !Array.isArray(input.entries)) {
    throw new Error('词库文件格式不完整');
  }

  const entries = input.entries
    .filter(isRecord)
    .map((entry) => ({
      text: typeof entry.text === 'string' ? entry.text.trim() : '',
      weight: typeof entry.weight === 'number' ? entry.weight : undefined,
      tags: Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
      source: typeof entry.source === 'string' ? entry.source : undefined,
    }))
    .filter((entry) => entry.text.length > 0 && entry.text.length <= 12 && ZH_ONLY.test(entry.text));

  return {
    schemaVersion: 1,
    id: input.id,
    name: input.name,
    version: input.version,
    author: input.author,
    license: input.license,
    pricingType: input.pricingType,
    description: input.description,
    tags: [...input.tags],
    entries,
  };
}

export function buildVocabularyPracticeUnits(packageFile: VocabularyPackageFile, targetCharCount = 12, lineCharCount = 6): VocabularyPracticeUnit[] {
  const sortedEntries = [...packageFile.entries].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  const units: VocabularyPracticeUnit[] = [];
  let buffer = '';
  let unitIndex = 0;

  for (const entry of sortedEntries) {
    const entryLength = Array.from(entry.text).length;
    if (entryLength > targetCharCount) continue;
    if (Array.from(buffer).length + entryLength > targetCharCount) {
      if (Array.from(buffer).length === targetCharCount) {
        units.push(createVocabularyUnit(packageFile, buffer, unitIndex, lineCharCount));
        unitIndex += 1;
      }
      buffer = '';
    }
    buffer += entry.text;
    if (Array.from(buffer).length === targetCharCount) {
      units.push(createVocabularyUnit(packageFile, buffer, unitIndex, lineCharCount));
      unitIndex += 1;
      buffer = '';
    }
  }

  if (units.length === 0 && buffer.length > 0) {
    units.push(createVocabularyUnit(packageFile, buffer, unitIndex, lineCharCount));
  }

  return units;
}

export function createVocabularyPackageFromEntries(
  meta: Omit<VocabularyPackageFile, 'entries' | 'schemaVersion'>,
  entries: VocabularyEntry[],
): VocabularyPackageFile {
  return validateVocabularyPackage({
    schemaVersion: 1,
    ...meta,
    entries,
  });
}

function createVocabularyUnit(packageFile: VocabularyPackageFile, text: string, index: number, lineCharCount: number): VocabularyPracticeUnit {
  return {
    id: `vocabulary-${packageFile.id}-${packageFile.version}-${index}`,
    module: 'vocabulary',
    text,
    syllables: toSyllables(text),
    source: packageFile.name,
    tags: ['词库', ...packageFile.tags],
    lineCharCount,
    packageId: packageFile.id,
  };
}

function toSyllables(text: string): string[] {
  return pinyin(text, {
    toneType: 'none',
    type: 'array',
    nonZh: 'removed',
  }).map((syllable) => syllable.replaceAll('ü', 'v'));
}

function isRegistryItem(item: Record<string, unknown>): item is Record<string, unknown> & VocabularyRegistryItem {
  return typeof item.id === 'string'
    && typeof item.name === 'string'
    && typeof item.version === 'string'
    && typeof item.description === 'string'
    && typeof item.author === 'string'
    && isPricingType(item.pricingType)
    && Array.isArray(item.tags)
    && item.tags.every((tag) => typeof tag === 'string')
    && typeof item.entryCount === 'number'
    && typeof item.downloadUrl === 'string'
    && (item.mirrorUrls === undefined || (Array.isArray(item.mirrorUrls) && item.mirrorUrls.every((url) => typeof url === 'string')));
}

function isPackageMeta(item: Record<string, unknown>): item is Omit<VocabularyPackageFile, 'entries'> & Record<string, unknown> {
  return typeof item.id === 'string'
    && typeof item.name === 'string'
    && typeof item.version === 'string'
    && typeof item.author === 'string'
    && typeof item.license === 'string'
    && isPricingType(item.pricingType)
    && typeof item.description === 'string'
    && Array.isArray(item.tags)
    && item.tags.every((tag) => typeof tag === 'string');
}

function isPricingType(value: unknown): value is VocabularyPricingType {
  return value === 'free' || value === 'paid' || value === 'owned';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
