import type { ShuangpinScheme } from '../schemes/types';

export type PracticeModule = 'character' | 'poem' | 'article' | 'vocabulary' | 'mistake';

export interface PracticeUnit {
  id: string;
  module: Exclude<PracticeModule, 'mistake'>;
  text: string;
  syllables: string[];
  source?: string;
  tags: string[];
  lineCharCount?: number;
}

export interface PracticeSession {
  unit: PracticeUnit;
  scheme: ShuangpinScheme;
  codes: string[];
  textCharIndices: number[];
  cursor: { charIndex: number; codeIndex: number };
  stats: {
    startedAt: number;
    elapsedMs: number;
    totalKeystrokes: number;
    correctKeystrokes: number;
    wrongKeystrokes: number;
    currentCombo: number;
    maxCombo: number;
    completedChars: number;
  };
}

export interface KeyEventResult {
  status: 'correct' | 'wrong' | 'ignored' | 'complete';
  expectedKey?: string;
  actualKey?: string;
  currentCharIndex: number;
  currentTextIndex: number;
  currentCodeIndex: number;
}
