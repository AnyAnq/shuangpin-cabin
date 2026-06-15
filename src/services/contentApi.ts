import { pinyin } from 'pinyin-pro';
import type { DailyQuote } from '../content/quotes';
import type { PracticeUnit } from '../domain/practice/types';

const API_BASE = '/external-api';

interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

interface PoetryPayload {
  content: string;
  origin: string;
  author: string;
  category: string;
}

export async function fetchTongueTwisterUnit(): Promise<PracticeUnit> {
  const data = await getApiData<string | { content: string }>('/tongue-twister');
  const text = toContentText(data);
  return {
    id: `api-tongue-${Date.now()}`,
    module: 'article',
    text,
    syllables: toSyllables(text),
    tags: ['绕口令', '在线内容'],
  };
}

export async function fetchPoetryUnit(): Promise<PracticeUnit> {
  const data = await getApiData<PoetryPayload>('/diary-poetry');
  return {
    id: `api-poetry-${Date.now()}`,
    module: 'poem',
    text: data.content,
    syllables: toSyllables(data.content),
    source: `${data.origin} · ${data.author}`,
    tags: data.category.split('-').filter(Boolean),
  };
}

export async function fetchDailyQuote(): Promise<DailyQuote> {
  const data = await getApiData<{ content: string }>('/chicken-soup');
  return {
    text: data.content,
    source: '某日一言',
    tags: ['在线内容'],
  };
}

function toContentText(data: string | { content: string }): string {
  return typeof data === 'string' ? data : data.content;
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

async function getApiData<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`内容 API 请求失败：${path}`);
  }

  const payload = (await response.json()) as ApiResponse<T>;
  if (payload.code !== 200) {
    throw new Error(payload.msg || `内容 API 返回异常：${path}`);
  }

  return payload.data;
}
