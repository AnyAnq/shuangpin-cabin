import type { ShuangpinScheme } from './types';

const finalMap: Record<string, string> = {
  a: 'a',
  ai: 'l',
  an: 'j',
  ang: 'h',
  ao: 'k',
  e: 'e',
  ei: 'z',
  en: 'f',
  eng: 'g',
  er: 'r',
  i: 'i',
  ia: 'w',
  ian: 'm',
  iang: 'd',
  iao: 'c',
  ie: 'x',
  in: 'n',
  ing: 'y',
  iong: 's',
  iu: 'q',
  o: 'o',
  ong: 's',
  ou: 'b',
  u: 'u',
  ua: 'w',
  uai: 'y',
  uan: 'r',
  uang: 'd',
  ue: 't',
  ui: 'v',
  un: 'p',
  uo: 'o',
  v: 'v',
  ve: 't',
};

const initialMap: Record<string, string> = {
  b: 'b',
  p: 'p',
  m: 'm',
  f: 'f',
  d: 'd',
  t: 't',
  n: 'n',
  l: 'l',
  g: 'g',
  k: 'k',
  h: 'h',
  j: 'j',
  q: 'q',
  x: 'x',
  zh: 'v',
  ch: 'i',
  sh: 'u',
  r: 'r',
  z: 'z',
  c: 'c',
  s: 's',
  y: 'y',
  w: 'w',
};

const singleInitials = Object.keys(initialMap).filter((key) => key.length === 1);
const initials = ['zh', 'ch', 'sh', ...singleInitials];

function splitSyllable(syllable: string): [string, string] {
  const normalized = syllable.toLowerCase();
  const initial = initials.find((key) => normalized.startsWith(key)) ?? '';
  return [initial, normalized.slice(initial.length)];
}

function encodeSyllable(syllable: string): string {
  const [initial, final] = splitSyllable(syllable);
  if (!initial && finalMap[final]) {
    return final;
  }
  const first = initial ? initialMap[initial] : finalMap[final]?.[0];
  const second = finalMap[final];
  if (!first || !second) {
    throw new Error(`Unsupported syllable: ${syllable}`);
  }
  return `${first}${second}`;
}

export const ziranmaScheme: ShuangpinScheme = {
  id: 'ziranma',
  name: '自然码',
  keys: [
    { key: 'q', label: 'Q', initials: ['q'], finals: ['iu'] },
    { key: 'w', label: 'W', initials: ['w'], finals: ['ia', 'ua'] },
    { key: 'e', label: 'E', initials: [], finals: ['e'] },
    { key: 'r', label: 'R', initials: ['r'], finals: ['uan', 'er'] },
    { key: 't', label: 'T', initials: ['t'], finals: ['ue', 've'] },
    { key: 'y', label: 'Y', initials: ['y'], finals: ['ing', 'uai'] },
    { key: 'u', label: 'U', initials: ['sh'], finals: ['u'] },
    { key: 'i', label: 'I', initials: ['ch'], finals: ['i'] },
    { key: 'o', label: 'O', initials: [], finals: ['o', 'uo'] },
    { key: 'p', label: 'P', initials: ['p'], finals: ['un'] },
    { key: 'a', label: 'A', initials: [], finals: ['a'] },
    { key: 's', label: 'S', initials: ['s'], finals: ['ong', 'iong'] },
    { key: 'd', label: 'D', initials: ['d'], finals: ['iang', 'uang'] },
    { key: 'f', label: 'F', initials: ['f'], finals: ['en'] },
    { key: 'g', label: 'G', initials: ['g'], finals: ['eng'] },
    { key: 'h', label: 'H', initials: ['h'], finals: ['ang'] },
    { key: 'j', label: 'J', initials: ['j'], finals: ['an'] },
    { key: 'k', label: 'K', initials: ['k'], finals: ['ao'] },
    { key: 'l', label: 'L', initials: ['l'], finals: ['ai'] },
    { key: 'z', label: 'Z', initials: ['z'], finals: ['ei'] },
    { key: 'x', label: 'X', initials: ['x'], finals: ['ie'] },
    { key: 'c', label: 'C', initials: ['c'], finals: ['iao'] },
    { key: 'v', label: 'V', initials: ['zh'], finals: ['ui', 'v'] },
    { key: 'b', label: 'B', initials: ['b'], finals: ['ou'] },
    { key: 'n', label: 'N', initials: ['n'], finals: ['in'] },
    { key: 'm', label: 'M', initials: ['m'], finals: ['ian'] },
  ],
  encodeSyllable,
};
