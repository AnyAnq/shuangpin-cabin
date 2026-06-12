export type ShuangpinSchemeId = 'xiaohe' | 'ziranma';

export interface SchemeKey {
  key: string;
  label: string;
  finals: string[];
  initials: string[];
}

export interface ShuangpinScheme {
  id: ShuangpinSchemeId;
  name: string;
  keys: SchemeKey[];
  encodeSyllable: (syllable: string) => string;
}
