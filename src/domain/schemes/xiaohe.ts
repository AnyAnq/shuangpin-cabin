import type { ShuangpinScheme } from './types';

const finalMap: Record<string, string> = {
  a: 'a',
  ai: 'd',
  an: 'j',
  ang: 'h',
  ao: 'c',
  e: 'e',
  ei: 'w',
  en: 'f',
  eng: 'g',
  er: 'r',
  i: 'i',
  ia: 'x',
  ian: 'm',
  iang: 'l',
  iao: 'n',
  ie: 'p',
  in: 'b',
  ing: 'k',
  iong: 's',
  iu: 'q',
  o: 'o',
  ong: 's',
  ou: 'z',
  u: 'u',
  ua: 'x',
  uai: 'k',
  uan: 'r',
  uang: 'l',
  ue: 't',
  ui: 'v',
  un: 'y',
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

export const xiaoheScheme: ShuangpinScheme = {
  id: 'xiaohe',
  name: '小鹤双拼',
  keys: [
    { key: 'q', label: 'Q', initials: ['q'], finals: ['iu'] },
    { key: 'w', label: 'W', initials: ['w'], finals: ['ei'] },
    { key: 'e', label: 'E', initials: [], finals: ['e'] },
    { key: 'r', label: 'R', initials: ['r'], finals: ['uan', 'er'] },
    { key: 't', label: 'T', initials: ['t'], finals: ['ue', 've'] },
    { key: 'y', label: 'Y', initials: ['y'], finals: ['un'] },
    { key: 'u', label: 'U', initials: ['sh'], finals: ['u'] },
    { key: 'i', label: 'I', initials: ['ch'], finals: ['i'] },
    { key: 'o', label: 'O', initials: [], finals: ['o', 'uo'] },
    { key: 'p', label: 'P', initials: ['p'], finals: ['ie'] },
    { key: 'a', label: 'A', initials: [], finals: ['a'] },
    { key: 's', label: 'S', initials: ['s'], finals: ['ong', 'iong'] },
    { key: 'd', label: 'D', initials: ['d'], finals: ['ai'] },
    { key: 'f', label: 'F', initials: ['f'], finals: ['en'] },
    { key: 'g', label: 'G', initials: ['g'], finals: ['eng'] },
    { key: 'h', label: 'H', initials: ['h'], finals: ['ang'] },
    { key: 'j', label: 'J', initials: ['j'], finals: ['an'] },
    { key: 'k', label: 'K', initials: ['k'], finals: ['ing', 'uai'] },
    { key: 'l', label: 'L', initials: ['l'], finals: ['iang', 'uang'] },
    { key: 'z', label: 'Z', initials: ['z'], finals: ['ou'] },
    { key: 'x', label: 'X', initials: ['x'], finals: ['ia', 'ua'] },
    { key: 'c', label: 'C', initials: ['c'], finals: ['ao'] },
    { key: 'v', label: 'V', initials: ['zh'], finals: ['ui', 'v'] },
    { key: 'b', label: 'B', initials: ['b'], finals: ['in'] },
    { key: 'n', label: 'N', initials: ['n'], finals: ['iao'] },
    { key: 'm', label: 'M', initials: ['m'], finals: ['ian'] },
  ],
  encodeSyllable,
};
