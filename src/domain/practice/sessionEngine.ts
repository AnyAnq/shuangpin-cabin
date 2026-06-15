import type { ShuangpinScheme } from '../schemes/types';
import type { KeyEventResult, PracticeSession, PracticeUnit } from './types';

export function createSession(input: {
  unit: PracticeUnit;
  scheme: ShuangpinScheme;
  now: number;
}): PracticeSession {
  const textCharIndices = buildTextCharIndices(input.unit);
  return {
    unit: input.unit,
    scheme: input.scheme,
    codes: input.unit.syllables.map(input.scheme.encodeSyllable),
    textCharIndices,
    cursor: { charIndex: 0, codeIndex: 0 },
    stats: {
      startedAt: input.now,
      elapsedMs: 0,
      totalKeystrokes: 0,
      correctKeystrokes: 0,
      wrongKeystrokes: 0,
      currentCombo: 0,
      maxCombo: 0,
      completedChars: 0,
    },
  };
}

export function getActiveTextIndex(session: PracticeSession): number {
  return session.textCharIndices[session.cursor.charIndex] ?? Array.from(session.unit.text).length;
}

export function handlePracticeKey(session: PracticeSession, rawKey: string, now: number): KeyEventResult {
  if (rawKey === 'Backspace') {
    return handleBackspace(session, now);
  }

  const key = rawKey.toLowerCase();
  if (!/^[a-z]$/.test(key)) {
    return toResult('ignored', session);
  }

  const expectedKey = session.codes[session.cursor.charIndex]?.[session.cursor.codeIndex];
  if (!expectedKey) {
    return toResult('complete', session);
  }

  session.stats.elapsedMs = now - session.stats.startedAt;
  session.stats.totalKeystrokes += 1;

  if (key !== expectedKey) {
    session.stats.correctKeystrokes = Math.max(0, session.stats.correctKeystrokes - session.cursor.codeIndex);
    session.stats.wrongKeystrokes += 1;
    session.stats.currentCombo = 0;
    session.cursor.codeIndex = 0;
    return toResult('wrong', session, expectedKey, key);
  }

  session.stats.correctKeystrokes += 1;
  session.stats.currentCombo += 1;
  session.stats.maxCombo = Math.max(session.stats.maxCombo, session.stats.currentCombo);
  session.cursor.codeIndex += 1;

  const currentCode = session.codes[session.cursor.charIndex];
  if (session.cursor.codeIndex >= currentCode.length) {
    session.cursor.charIndex += 1;
    session.cursor.codeIndex = 0;
    session.stats.completedChars += 1;
  }

  const status = session.cursor.charIndex >= session.codes.length ? 'complete' : 'correct';
  return toResult(status, session, expectedKey, key);
}

function handleBackspace(session: PracticeSession, now: number): KeyEventResult {
  if (session.cursor.charIndex === 0 && session.cursor.codeIndex === 0) {
    return toResult('ignored', session);
  }

  session.stats.elapsedMs = now - session.stats.startedAt;

  if (session.cursor.codeIndex === 0) {
    session.cursor.charIndex -= 1;
    session.cursor.codeIndex = session.codes[session.cursor.charIndex].length;
    session.stats.completedChars = Math.max(0, session.stats.completedChars - 1);
  }

  session.cursor.codeIndex -= 1;
  session.stats.correctKeystrokes = Math.max(0, session.stats.correctKeystrokes - 1);
  session.stats.currentCombo = Math.max(0, session.stats.currentCombo - 1);

  const expectedKey = session.codes[session.cursor.charIndex]?.[session.cursor.codeIndex];
  return toResult('correct', session, expectedKey);
}

function toResult(
  status: KeyEventResult['status'],
  session: PracticeSession,
  expectedKey?: string,
  actualKey?: string,
): KeyEventResult {
  return {
    status,
    expectedKey,
    actualKey,
    currentCharIndex: session.cursor.charIndex,
    currentTextIndex: getActiveTextIndex(session),
    currentCodeIndex: session.cursor.codeIndex,
  };
}

function buildTextCharIndices(unit: PracticeUnit): number[] {
  const chars = Array.from(unit.text);
  const indices = chars.flatMap((char, index) => (isPracticeChar(char) ? [index] : []));
  return indices.length === unit.syllables.length ? indices : unit.syllables.map((_, index) => index);
}

function isPracticeChar(char: string): boolean {
  return /\p{Script=Han}/u.test(char);
}
