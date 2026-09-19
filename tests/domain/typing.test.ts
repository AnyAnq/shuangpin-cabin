import { describe, expect, it } from 'vitest';
import { typingArticles } from '../../src/content/typingArticles';
import { alignTypingText, createTypingReport, normalizeTypingText, typingCharacters, validateTypingArticle } from '../../src/domain/practice/typing';

describe('中文跟打判定', () => {
  it.each([
    ['甲丙丁戊。', 5, 0, 1, 0],
    ['甲乙多丙丁戊。', 6, 0, 0, 1],
    ['甲错丙丁戊。', 5, 1, 0, 0],
  ])('对齐 %s 后，错误不传染到后文', (text, matched, substitutions, omissions, insertions) => {
    const result = alignTypingText('甲乙丙丁戊。', text);
    expect(result).toMatchObject({ matched, substitutions, omissions, insertions });
    expect(result.operations.slice(-4).every(op => op.kind === 'equal')).toBe(true);
  });

  it('重复字漏打和连续多打仍能保留后续正确字符', () => {
    expect(alignTypingText('人人都爱学习。', '人都爱学习。')).toMatchObject({ matched: 6, omissions: 1, substitutions: 0 });
    expect(alignTypingText('甲乙丙丁', '甲乙多余丙丁')).toMatchObject({ matched: 4, insertions: 2, substitutions: 0 });
  });

  it('输入中不把未到达的尾部记为漏字，交卷时才统计', () => {
    expect(alignTypingText('甲乙丙丁。', '', true)).toMatchObject({ consumed: 0, omissions: 0 });
    expect(alignTypingText('甲乙丙丁。', '甲乙', true)).toMatchObject({ consumed: 2, matched: 2, omissions: 0 });
    expect(alignTypingText('甲乙丙丁。', '甲乙')).toMatchObject({ matched: 2, omissions: 3 });
  });

  it('忽略排版换行和行边空白，保留内部空格、大小写、标点与可见字符', () => {
    expect(normalizeTypingText('  A B \r\n C\rD  ')).toBe('A BCD');
    expect(alignTypingText('API，9。', 'api,9。')).toMatchObject({ substitutions: 4, matched: 2 });
    expect(alignTypingText('A B', 'AB')).toMatchObject({ omissions: 1, matched: 2 });
    expect(typingCharacters('e\u0301👍🏽')).toEqual(['é', '👍🏽']);
    expect(alignTypingText('é👍🏽', 'e\u0301👍🏽')).toMatchObject({ matched: 2 });
  });

  it('有效字速只计正确字符，准确率对多字也扣分', () => {
    const report = createTypingReport({ article: { id: 'test', title: '测试', text: '甲乙丙丁' }, inputText: '甲乙多丙丁', kind: 'full', elapsedMs: 120000, now: 1, observedRanges: [] });
    expect(report).toMatchObject({ matched: 4, insertions: 1, cpm: 2, accuracy: 80 });
  });

  it('最多取三段复练内容，交卷仍有错误的句子优先', () => {
    const report = createTypingReport({ article: { id: 'test', title: '测试', text: '甲。乙。丙。丁。' }, inputText: '甲。乙。丙。错。', kind: 'full', elapsedMs: 60000, now: 1, observedRanges: [{ start: 0, end: 2 }, { start: 2, end: 4 }, { start: 4, end: 6 }] });
    expect(report.reviewTexts).toEqual(['丁。', '甲。', '乙。']);
  });

  it('内置文章长度合适，自定义文章限定 1 到 2000 个可见字符', () => {
    expect(typingArticles).toHaveLength(3);
    for (const article of typingArticles) {
      expect(typingCharacters(article.text).length).toBeGreaterThanOrEqual(300);
      expect(typingCharacters(article.text).length).toBeLessThanOrEqual(600);
    }
    const article = { id: 'test', title: '测试', text: '字'.repeat(2000) };
    expect(() => validateTypingArticle(article)).not.toThrow();
    expect(() => validateTypingArticle({ ...article, text: article.text + '字' })).toThrow('2000');
    expect(() => validateTypingArticle({ ...article, text: ' \n\t' })).toThrow('请先准备');
  });
});
