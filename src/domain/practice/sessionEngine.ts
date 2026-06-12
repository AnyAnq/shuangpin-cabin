import type { ShuangpinScheme } from '../schemes/types';
import type { KeyEventResult, PracticeSession, PracticeUnit } from './types';

export function createSession(input: {
  unit: PracticeUnit;
  scheme: ShuangpinScheme;
  now: number;
}): PracticeSession {
  return {
    unit: input.unit,
    scheme: input.scheme,
    codes: input.unit.syllables.map(input.scheme.encodeSyllable),
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

export function handlePracticeKey(session: PracticeSession, rawKey: string, now: number): KeyEventResult {
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
    session.stats.wrongKeystrokes += 1;
    session.stats.currentCombo = 0;
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
    currentCodeIndex: session.cursor.codeIndex,
  };
}
