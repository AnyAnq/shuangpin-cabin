export interface DailyQuote {
  text: string;
  source: string;
  tags: string[];
}

export const dailyQuotes: DailyQuote[] = [
  { text: '心有猛虎，细嗅蔷薇。', source: '萨松', tags: ['名言'] },
  { text: '行到水穷处，坐看云起时。', source: '王维', tags: ['古诗词'] },
  { text: '知不足而奋进，望远山而前行。', source: '练习法', tags: ['自定义'] },
];
