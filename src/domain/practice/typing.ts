export const MAX_TYPING_CHARS = 2000;
const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' });

export interface TypingArticle { id: string; title: string; text: string }
export type TypingKind = 'full' | 'review';
export interface TextRange { start: number; end: number }
export interface TextOperation {
  kind: 'equal' | 'replace' | 'delete' | 'insert';
  index: number;
  expected: string;
  actual: string;
}
export interface TextAlignment {
  operations: TextOperation[];
  consumed: number;
  matched: number;
  substitutions: number;
  omissions: number;
  insertions: number;
}
export interface TypingReport {
  id: string;
  kind: TypingKind;
  article: TypingArticle;
  inputText: string;
  elapsedMs: number;
  createdAt: number;
  matched: number;
  substitutions: number;
  omissions: number;
  insertions: number;
  accuracy: number;
  cpm: number;
  reviewTexts: string[];
}

export function normalizeTypingText(text: string): string {
  return text.normalize('NFC').replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).join('');
}

export function splitCharacters(text: string): string[] {
  return Array.from(segmenter.segment(text), item => item.segment);
}

export function typingCharacters(text: string): string[] {
  return splitCharacters(normalizeTypingText(text));
}

export function validateTypingArticle(article: TypingArticle): void {
  const length = typingCharacters(article.text).length;
  if (!length) throw new Error('请先准备一段练习文字。');
  if (length > MAX_TYPING_CHARS) throw new Error(`练习内容最多 ${MAX_TYPING_CHARS} 个字符，请缩短后再开始。`);
}

export function alignTypingText(targetText: string, inputText: string, live = false): TextAlignment {
  const target = typingCharacters(targetText);
  const input = typingCharacters(inputText);
  // ponytail: bounded 2,000-character articles use edit-distance alignment; use a worker for substantially longer articles.
  const width = input.length + 1;
  const costs = new Uint32Array((target.length + 1) * width);
  for (let j = 0; j <= input.length; j++) costs[j] = j;
  for (let i = 1; i <= target.length; i++) {
    costs[i * width] = i;
    for (let j = 1; j <= input.length; j++) {
      costs[i * width + j] = Math.min(
        costs[(i - 1) * width + j - 1] + (target[i - 1] === input[j - 1] ? 0 : 1),
        costs[(i - 1) * width + j] + 1,
        costs[i * width + j - 1] + 1,
      );
    }
  }

  let end = target.length;
  if (live) {
    end = 0;
    for (let i = 1; i <= target.length; i++) {
      if (costs[i * width + input.length] <= costs[end * width + input.length]) end = i;
    }
  }
  const result: TextAlignment = { operations: [], consumed: end, matched: 0, substitutions: 0, omissions: 0, insertions: 0 };
  let i = end;
  let j = input.length;
  while (i || j) {
    const cost = costs[i * width + j];
    if (i && j && cost === costs[(i - 1) * width + j - 1] + (target[i - 1] === input[j - 1] ? 0 : 1)) {
      const equal = target[i - 1] === input[j - 1];
      result.operations.push({ kind: equal ? 'equal' : 'replace', index: i - 1, expected: target[i - 1], actual: input[j - 1] });
      if (equal) result.matched++;
      else result.substitutions++;
      i--; j--;
    } else if (i && cost === costs[(i - 1) * width + j] + 1) {
      result.operations.push({ kind: 'delete', index: i - 1, expected: target[i - 1], actual: '' });
      result.omissions++;
      i--;
    } else {
      result.operations.push({ kind: 'insert', index: i, expected: '', actual: input[j - 1] });
      result.insertions++;
      j--;
    }
  }
  result.operations.reverse();
  return result;
}

export function differenceRanges(text: string, alignment: TextAlignment): TextRange[] {
  const chars = typingCharacters(text);
  if (!chars.length) return [];
  const ranges: TextRange[] = [];
  for (const operation of alignment.operations) {
    if (operation.kind === 'equal') continue;
    const index = Math.min(operation.index, chars.length - 1);
    let start = index;
    let end = index + 1;
    while (start > 0 && !/[。！？!?；;.]/.test(chars[start - 1])) start--;
    while (end < chars.length && !/[。！？!?；;.]/.test(chars[end - 1])) end++;
    if (end - start > 80) {
      start = Math.max(start, index - 20);
      end = Math.min(end, index + 21);
    }
    ranges.push({ start, end });
  }
  return mergeRanges(ranges);
}

export function mergeRanges(ranges: TextRange[]): TextRange[] {
  const merged: TextRange[] = [];
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && range.start < last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

export function createTypingReport(input: {
  article: TypingArticle; inputText: string; kind: TypingKind; elapsedMs: number;
  observedRanges: TextRange[]; now: number;
}): TypingReport {
  const alignment = alignTypingText(input.article.text, input.inputText);
  const chars = typingCharacters(input.article.text);
  const remaining = differenceRanges(input.article.text, alignment);
  const combined = mergeRanges([...remaining, ...input.observedRanges]);
  combined.sort((a, b) => Number(remaining.some(r => r.start < b.end && r.end > b.start)) - Number(remaining.some(r => r.start < a.end && r.end > a.start)) || a.start - b.start);
  const elapsedMs = Math.max(1, input.elapsedMs);
  return {
    id: crypto.randomUUID(), kind: input.kind, article: { ...input.article }, inputText: input.inputText,
    elapsedMs, createdAt: input.now,
    matched: alignment.matched, substitutions: alignment.substitutions,
    omissions: alignment.omissions, insertions: alignment.insertions,
    accuracy: Math.round(alignment.matched / (chars.length + alignment.insertions) * 1000) / 10,
    cpm: Math.round(alignment.matched / (elapsedMs / 60000)),
    reviewTexts: combined.slice(0, 3).map(range => chars.slice(range.start, range.end).join('')),
  };
}
