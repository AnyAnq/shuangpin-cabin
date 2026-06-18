import { pinyin } from 'pinyin-pro';
import type { DailyQuote } from '../content/quotes';
import type { PracticeUnit } from '../domain/practice/types';

const DAILY_API_BASE = '/external-api';
const POETRY_API_BASE = '/poetry-api';
const TONGUE_API_BASE = '/tongue-api';

interface ApiResponse<T> {
  code: number;
  msg?: string;
  data: T;
}

interface ParsedPoetry {
  text: string;
  source: string;
}

export async function fetchTongueTwisterUnit(): Promise<PracticeUnit> {
  const data = await getApiData<string | { content: string }>(`${TONGUE_API_BASE}/raokouling`, [0]);
  const text = cleanContentText(toContentText(data));
  return {
    id: `api-tongue-${Date.now()}`,
    module: 'article',
    text,
    syllables: toSyllables(text),
    tags: ['绕口令', '在线内容'],
  };
}

export async function fetchPoetryUnit(): Promise<PracticeUnit> {
  const data = await getApiData<string>(`${POETRY_API_BASE}/yiyan?type=poetry`, [200]);
  const poetry = parsePoetryText(data);
  return {
    id: `api-poetry-${Date.now()}`,
    module: 'poem',
    text: poetry.text,
    syllables: toSyllables(poetry.text),
    source: poetry.source,
    tags: ['诗词', '在线内容'],
  };
}

export async function fetchDailyQuote(): Promise<DailyQuote> {
  const data = await getApiData<{ content: string }>(`${DAILY_API_BASE}/chicken-soup`, [200]);
  return {
    text: data.content,
    source: '某日一言',
    tags: ['在线内容'],
  };
}

function toContentText(data: string | { content: string }): string {
  return typeof data === 'string' ? data : data.content;
}

function cleanContentText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function parsePoetryText(rawText: string): ParsedPoetry {
  const text = cleanContentText(rawText);
  const match = text.match(/^(.*?)《([^》]+)》\s*[—-]\s*(.+)$/);
  if (!match) {
    return { text, source: '在线诗词' };
  }

  return {
    text: match[1].trim(),
    source: `${match[2].trim()} · ${match[3].trim()}`,
  };
}

function toSyllables(text: string): string[] {
  return pinyin(text, {
    toneType: 'none',
    type: 'array',
    nonZh: 'removed',
  }).map(normalizeSyllable);
}

function normalizeSyllable(syllable: string): string {
  return syllable.replaceAll('ü', 'v');
}

async function getApiData<T>(url: string, successCodes: number[]): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`内容 API 请求失败：${url}`);
  }

  const payload = (await response.json()) as ApiResponse<T>;
  if (!successCodes.includes(payload.code)) {
    throw new Error(payload.msg || `内容 API 返回异常：${url}`);
  }

  return payload.data;
}

// 内容缓存：用于后台预加载
const contentCache = {
  poem: null as PracticeUnit | null,
  article: null as PracticeUnit | null,
};

/**
 * 预加载诗词单元到缓存，不返回任何值
 * 用于后台异步预加载，不阻塞主流程
 */
export async function prefetchPoetryUnit(): Promise<void> {
  try {
    contentCache.poem = await fetchPoetryUnit();
  } catch {
    // 预加载失败不抛出异常，允许主流程继续
  }
}

/**
 * 预加载绕口令单元到缓存，不返回任何值
 * 用于后台异步预加载，不阻塞主流程
 */
export async function prefetchTongueTwisterUnit(): Promise<void> {
  try {
    contentCache.article = await fetchTongueTwisterUnit();
  } catch {
    // 预加载失败不抛出异常，允许主流程继续
  }
}

/**
 * 消费缓存中的诗词单元，返回后清空缓存
 * 如果缓存为空则返回 null
 */
export function consumeCachedPoetryUnit(): PracticeUnit | null {
  const cached = contentCache.poem;
  contentCache.poem = null;
  return cached;
}

/**
 * 消费缓存中的绕口令单元，返回后清空缓存
 * 如果缓存为空则返回 null
 */
export function consumeCachedTongueTwisterUnit(): PracticeUnit | null {
  const cached = contentCache.article;
  contentCache.article = null;
  return cached;
}
