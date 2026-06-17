import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/storage/db';
import { listMistakesByScheme, listMistakesForPractice, markMistakeCorrect, upsertMistake } from '../../src/storage/repositories';
import type { MistakeRecord } from '../../src/domain/practice/mistakes';

describe('内容与本地存储', () => {
  beforeEach(async () => {
    await db.mistakes.clear();
  });

  it('创建练习记录和易错记录表', () => {
    expect(db.tables.map((table) => table.name)).toEqual(expect.arrayContaining(['mistakes', 'sessions', 'preferences']));
  });

  it('重复按错同一键会合并易错记录次数', async () => {
    await upsertMistake(makeMistake({ id: 'xiaohe-duo-d-s', count: 1, lastWrongAt: 1000 }));
    await upsertMistake(makeMistake({ id: 'xiaohe-duo-d-s', count: 1, lastWrongAt: 3000 }));

    const record = await db.mistakes.get('xiaohe-duo-d-s');

    expect(record?.count).toBe(2);
    expect(record?.lastWrongAt).toBe(3000);
  });

  it('易错练习只取当前方案下优先级最高的错题', async () => {
    await upsertMistake(makeMistake({ id: 'xiaohe-low', scheme: 'xiaohe', count: 1, lastWrongAt: 1000 }));
    await upsertMistake(makeMistake({ id: 'xiaohe-high', scheme: 'xiaohe', targetChar: '情', targetSyllable: 'qing', expectedCode: 'qk', count: 5, lastWrongAt: 2000 }));
    await upsertMistake(makeMistake({ id: 'ziranma-high', scheme: 'ziranma', count: 9, lastWrongAt: 3000 }));

    const records = await listMistakesForPractice('xiaohe', 10_000, 3);

    expect(records.map((record) => record.id)).toEqual(['xiaohe-high', 'xiaohe-low']);
  });

  it('记录页只读取当前方案下的全部错题', async () => {
    await upsertMistake(makeMistake({ id: 'xiaohe-low', scheme: 'xiaohe', count: 1, lastWrongAt: 1000 }));
    await upsertMistake(makeMistake({ id: 'xiaohe-high', scheme: 'xiaohe', targetChar: '情', targetSyllable: 'qing', expectedCode: 'qk', count: 5, lastWrongAt: 3000 }));
    await upsertMistake(makeMistake({ id: 'ziranma-high', scheme: 'ziranma', count: 9, lastWrongAt: 4000 }));

    const records = await listMistakesByScheme('xiaohe');

    expect(records.map((record) => record.id)).toEqual(['xiaohe-high', 'xiaohe-low']);
  });

  it('易错复练正确后会增加连续正确次数', async () => {
    await upsertMistake(makeMistake({ id: 'xiaohe-duo-d-s', count: 3, correctStreak: 0 }));

    await markMistakeCorrect('xiaohe-duo-d-s', 5000);

    const record = await db.mistakes.get('xiaohe-duo-d-s');
    expect(record?.correctStreak).toBe(1);
    expect(record?.lastCorrectAt).toBe(5000);
  });
});

function makeMistake(overrides: Partial<MistakeRecord>): MistakeRecord {
  return {
    id: 'xiaohe-duo-d-s',
    scheme: 'xiaohe',
    module: 'poem',
    targetChar: '多',
    targetSyllable: 'duo',
    expectedCode: 'do',
    expectedKey: 'd',
    actualKey: 's',
    errorType: 'initial-key',
    contextText: '多情却被无情恼',
    count: 1,
    lastWrongAt: 1000,
    lastCorrectAt: null,
    correctStreak: 0,
    averageCorrectionMs: 0,
    ...overrides,
  };
}
