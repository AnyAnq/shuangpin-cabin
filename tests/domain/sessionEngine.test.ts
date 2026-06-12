import { describe, expect, it } from 'vitest';
import { createSession, handlePracticeKey } from '../../src/domain/practice/sessionEngine';
import { xiaoheScheme } from '../../src/domain/schemes/xiaohe';

describe('练习引擎', () => {
  it('按错键时不推进当前位置', () => {
    const session = createSession({
      unit: { id: 'u1', module: 'poem', text: '多', syllables: ['duo'], tags: [] },
      scheme: xiaoheScheme,
      now: 1000,
    });

    const result = handlePracticeKey(session, 's', 1200);

    expect(result.status).toBe('wrong');
    expect(result.expectedKey).toBe('d');
    expect(result.actualKey).toBe('s');
    expect(session.cursor.codeIndex).toBe(0);
    expect(session.stats.wrongKeystrokes).toBe(1);
  });

  it('按对完整编码后完成练习单位', () => {
    const session = createSession({
      unit: { id: 'u1', module: 'poem', text: '多', syllables: ['duo'], tags: [] },
      scheme: xiaoheScheme,
      now: 1000,
    });

    expect(handlePracticeKey(session, 'd', 1100).status).toBe('correct');
    expect(handlePracticeKey(session, 'o', 1200).status).toBe('complete');
    expect(session.cursor.charIndex).toBe(1);
    expect(session.stats.completedChars).toBe(1);
  });

  it('忽略非字母输入', () => {
    const session = createSession({
      unit: { id: 'u1', module: 'poem', text: '多', syllables: ['duo'], tags: [] },
      scheme: xiaoheScheme,
      now: 1000,
    });

    expect(handlePracticeKey(session, 'Shift', 1100).status).toBe('ignored');
    expect(session.stats.totalKeystrokes).toBe(0);
  });

  it('Backspace 可以撤销最后一个正确编码位', () => {
    const session = createSession({
      unit: { id: 'u1', module: 'poem', text: '多', syllables: ['duo'], tags: [] },
      scheme: xiaoheScheme,
      now: 1000,
    });

    handlePracticeKey(session, 'd', 1100);
    const result = handlePracticeKey(session, 'Backspace', 1200);

    expect(result.status).toBe('correct');
    expect(session.cursor.codeIndex).toBe(0);
    expect(session.stats.correctKeystrokes).toBe(0);
  });

  it('展示文本包含标点时，练习光标会跳过标点落到下一个汉字', () => {
    const session = createSession({
      unit: { id: 'u1', module: 'article', text: '多，情。', syllables: ['duo', 'qing'], tags: [] },
      scheme: xiaoheScheme,
      now: 1000,
    });

    expect(session.textCharIndices).toEqual([0, 2]);
    handlePracticeKey(session, 'd', 1100);
    const result = handlePracticeKey(session, 'o', 1200);

    expect(result.status).toBe('correct');
    expect(result.currentTextIndex).toBe(2);
  });
});
