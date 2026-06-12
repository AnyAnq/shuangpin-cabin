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
});
