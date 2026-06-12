import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { poemUnits } from '../../src/content/poems';
import { dailyQuotes } from '../../src/content/quotes';
import { db } from '../../src/storage/db';

describe('内容与本地存储', () => {
  it('提供诗词练习内容和每日一言', () => {
    expect(poemUnits[0].text).toBe('多情却被无情恼');
    expect(poemUnits[0].syllables).toContain('duo');
    expect(dailyQuotes[0].text).toBeTruthy();
  });

  it('创建练习记录和易错记录表', () => {
    expect(db.tables.map((table) => table.name)).toEqual(expect.arrayContaining(['mistakes', 'sessions', 'preferences']));
  });
});
