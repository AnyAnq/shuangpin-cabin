import type { PracticeUnit } from '../domain/practice/types';

export const poemUnits: PracticeUnit[] = [
  {
    id: 'poem-001',
    module: 'poem',
    text: '多情却被无情恼，今夜还如昨夜长。',
    syllables: ['duo', 'qing', 'que', 'bei', 'wu', 'qing', 'nao', 'jin', 'ye', 'hai', 'ru', 'zuo', 'ye', 'chang'],
    source: '蝶恋花',
    tags: ['宋词', '短句'],
  },
  {
    id: 'poem-002',
    module: 'poem',
    text: '行到水穷处坐看云起时',
    syllables: ['xing', 'dao', 'shui', 'qiong', 'chu', 'zuo', 'kan', 'yun', 'qi', 'shi'],
    source: '终南别业',
    tags: ['唐诗', '短句'],
  },
];
