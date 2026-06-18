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

export type LocalVocabularyFileKind = 'json' | 'plain';

export interface LocalVocabularyMetaInput {
  id?: string;
  name: string;
  version?: string;
  author?: string;
  license?: string;
  description?: string;
  tags?: string[];
}

export interface LocalVocabularyParseReport {
  fileKind: LocalVocabularyFileKind;
  packageFile: VocabularyPackageFile;
  validCount: number;
  filteredCount: number;
  duplicateCount: number;
  previewEntries: VocabularyEntry[];
  filterReasons: Record<string, number>;
}

export interface VocabularyPracticeUnit extends PracticeUnit {
  module: 'vocabulary';
  lineCharCount: number;
  packageId: string;
}

const ZH_ONLY = /^[\u4e00-\u9fff]+$/;
const MAX_ENTRY_LENGTH = 12;
const PREVIEW_ENTRY_LIMIT = 12;
const DEFAULT_LOCAL_TAGS = ['custom', 'local'];

interface PlainParseResult {
  entries: VocabularyEntry[];
  filteredCount: number;
  duplicateCount: number;
  filterReasons: Record<string, number>;
}

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
    .filter((entry) => entry.text.length > 0 && Array.from(entry.text).length <= MAX_ENTRY_LENGTH && ZH_ONLY.test(entry.text));

  return {
    schemaVersion: 1,
    id: input.id,
    name: input.name,
    version: input.version,
    author: input.author,
    license: typeof input.license === 'string' ? input.license : 'Personal',
    pricingType: isPricingType(input.pricingType) ? input.pricingType : 'owned',
    description: typeof input.description === 'string' ? input.description : '从本地文件导入的自定义词库',
    tags: Array.isArray(input.tags) ? [...input.tags] : [...DEFAULT_LOCAL_TAGS],
    entries,
  };
}

export function parseLocalVocabularyFile(fileName: string, text: string, now = Date.now()): LocalVocabularyParseReport {
  if (fileName.toLowerCase().endsWith('.json')) {
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('JSON 格式不正确');
    }
    const rawEntryCount = isRecord(payload) && Array.isArray(payload.entries) ? payload.entries.length : 0;
    const packageFile = validateVocabularyPackage(payload);
    const filteredCount = Math.max(0, rawEntryCount - packageFile.entries.length);

    return {
      fileKind: 'json',
      packageFile,
      validCount: packageFile.entries.length,
      filteredCount,
      duplicateCount: 0,
      previewEntries: packageFile.entries.slice(0, PREVIEW_ENTRY_LIMIT),
      filterReasons: filteredCount > 0 ? { '不符合词条规则': filteredCount } : {},
    };
  }

  const parsed = parsePlainVocabularyEntries(text);
  const packageFile = createLocalVocabularyPackage({
    name: baseNameFromFileName(fileName),
  }, parsed.entries, now);

  return {
    fileKind: 'plain',
    packageFile,
    validCount: packageFile.entries.length,
    filteredCount: parsed.filteredCount,
    duplicateCount: parsed.duplicateCount,
    previewEntries: packageFile.entries.slice(0, PREVIEW_ENTRY_LIMIT),
    filterReasons: parsed.filterReasons,
  };
}

export function parsePlainVocabularyEntries(text: string): PlainParseResult {
  const entriesByText = new Map<string, VocabularyEntry>();
  const filterReasons: Record<string, number> = {};
  let filteredCount = 0;
  let duplicateCount = 0;
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      filteredCount += 1;
      incrementReason(filterReasons, '空行');
      return;
    }
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
      filteredCount += 1;
      incrementReason(filterReasons, '注释行');
      return;
    }

    const columns = trimmed.split(',').map((column) => column.trim());
    if (index === 0 && columns[0]?.toLowerCase() === 'text') {
      filteredCount += 1;
      incrementReason(filterReasons, '表头');
      return;
    }

    const word = columns[0] ?? '';
    const charLength = Array.from(word).length;
    if (word.length === 0) {
      filteredCount += 1;
      incrementReason(filterReasons, '空行');
      return;
    }
    if (charLength > MAX_ENTRY_LENGTH) {
      filteredCount += 1;
      incrementReason(filterReasons, '超过 12 字');
      return;
    }
    if (!ZH_ONLY.test(word)) {
      filteredCount += 1;
      incrementReason(filterReasons, '含英文、数字或符号');
      return;
    }

    const parsedWeight = columns[1] ? Number(columns[1]) : Number.NaN;
    const fallbackWeight = Math.max(1, 100 - entriesByText.size);
    const weight = Number.isFinite(parsedWeight) ? parsedWeight : fallbackWeight;
    const tags = parseTags(columns.slice(2).join(','));
    const existing = entriesByText.get(word);
    if (existing) {
      duplicateCount += 1;
      entriesByText.set(word, {
        text: word,
        weight: Math.max(existing.weight ?? 0, weight),
        tags: mergeTags(existing.tags, tags),
        source: existing.source,
      });
      return;
    }

    entriesByText.set(word, {
      text: word,
      weight,
      tags: tags.length > 0 ? tags : undefined,
      source: undefined,
    });
  });

  return {
    entries: Array.from(entriesByText.values()),
    filteredCount,
    duplicateCount,
    filterReasons,
  };
}

export function createLocalVocabularyPackage(meta: LocalVocabularyMetaInput, entries: VocabularyEntry[], now = Date.now()): VocabularyPackageFile {
  return validateVocabularyPackage({
    schemaVersion: 1,
    id: meta.id ?? `local-${slugFromName(meta.name)}-${now}`,
    name: meta.name,
    version: meta.version ?? '1.0.0',
    author: meta.author ?? '本地导入',
    license: meta.license ?? 'Personal',
    pricingType: 'owned',
    description: meta.description ?? '从本地文件导入的自定义词库',
    tags: meta.tags && meta.tags.length > 0 ? meta.tags : DEFAULT_LOCAL_TAGS,
    entries,
  });
}

export function createVocabularyExportFile(
  packageRecord: Pick<VocabularyPackageFile, 'id' | 'name' | 'version' | 'author' | 'license' | 'pricingType' | 'description' | 'tags'>,
  entries: VocabularyEntry[],
): VocabularyPackageFile {
  return validateVocabularyPackage({
    schemaVersion: 1,
    ...packageRecord,
    entries,
  });
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

function baseNameFromFileName(fileName: string) {
  const normalized = fileName.split(/[\\/]/).pop() ?? fileName;
  return normalized.replace(/\.[^.]+$/, '') || '本地词库';
}

function slugFromName(name: string) {
  return name.trim().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '') || 'vocabulary';
}

function parseTags(input: string) {
  return input
    .split(/[|/\s、]+/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function mergeTags(left: string[] | undefined, right: string[]) {
  const merged = Array.from(new Set([...(left ?? []), ...right]));
  return merged.length > 0 ? merged : undefined;
}

function incrementReason(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
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
    && (item.license === undefined || typeof item.license === 'string')
    && (item.pricingType === undefined || isPricingType(item.pricingType))
    && (item.description === undefined || typeof item.description === 'string')
    && (item.tags === undefined || (Array.isArray(item.tags) && item.tags.every((tag) => typeof tag === 'string')));
}

function isPricingType(value: unknown): value is VocabularyPricingType {
  return value === 'free' || value === 'paid' || value === 'owned';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
