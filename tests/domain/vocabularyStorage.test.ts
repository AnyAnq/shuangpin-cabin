import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import type { VocabularyPackageFile } from '../../src/domain/vocabulary';
import { db } from '../../src/storage/db';
import {
  installVocabularyPackage,
  listInstalledVocabularyPackages,
  listVocabularyEntries,
  listVocabularyPackagesBySource,
  uninstallVocabularyPackage,
} from '../../src/storage/vocabularyRepository';

const packageFile: VocabularyPackageFile = {
  schemaVersion: 1,
  id: 'daily-common',
  name: '日常常用词',
  version: '1.0.0',
  author: 'Shuangpin Cabin',
  license: 'MIT',
  description: '适合日常输入热身。',
  tags: ['daily'],
  entries: [
    { text: '今天', weight: 99 },
    { text: '事情', weight: 98 },
  ],
};

describe('词库安装存储', () => {
  it.each([2, 3])('版本 %i 的本地数据升级后保留词库与练习数据并移除旧索引', async version => {
    db.close();
    await db.delete();
    const legacy = new Dexie(db.name);
    legacy.version(version).stores({
      mistakes: 'id, scheme, module, targetChar, expectedKey, lastWrongAt',
      sessions: 'id, scheme, module, createdAt',
      preferences: 'id, scheme, module, updatedAt',
      vocabularyPackages: version === 2
        ? 'id, pricingType, installedAt, updatedAt'
        : 'id, pricingType, sourceType, installedAt, updatedAt',
      vocabularyEntries: 'id, packageId, text, weight, length',
    });
    const preference = { id: 'default', scheme: 'xiaohe', module: 'vocabulary', updatedAt: 1 };
    const session = { id: 'saved', scheme: 'xiaohe', module: 'poem', accuracy: 95, wpm: 40, maxCombo: 8, elapsedMs: 1000, createdAt: 1 };
    const mistake = { id: 'saved', scheme: 'xiaohe', module: 'poem', targetChar: '多', targetSyllable: 'duo',
      expectedCode: 'do', expectedKey: 'o', actualKey: 'p', errorType: 'final-key', contextText: '多',
      count: 2, lastWrongAt: 1, lastCorrectAt: null, correctStreak: 0, averageCorrectionMs: 0 };
    try {
      await legacy.open();
      await legacy.table('vocabularyPackages').put({
        ...packageFile, pricingType: 'paid', entries: undefined, entryCount: 2,
        installedAt: 1, updatedAt: 2, sourceUrl: 'local-file:daily.txt',
        ...(version === 3 ? { sourceType: 'local' } : {}),
      });
      await legacy.table('vocabularyEntries').bulkPut(packageFile.entries.map((entry, index) => ({
        ...entry, id: 'entry-' + index, packageId: packageFile.id, tags: [], length: entry.text.length,
      })));
      await legacy.table('preferences').put(preference);
      await legacy.table('sessions').put(session);
      await legacy.table('mistakes').put(mistake);
      legacy.close();
      await db.open();

      expect(db.verno).toBe(4);
      expect(db.vocabularyPackages.schema.indexes.map(index => index.name)).not.toContain('pricingType');
      const installed = await db.vocabularyPackages.get(packageFile.id);
      expect(installed).toMatchObject({ id: packageFile.id, name: packageFile.name, sourceType: 'local', entryCount: 2 });
      expect(installed).not.toHaveProperty('pricingType');
      expect((await listVocabularyEntries(packageFile.id)).map(entry => entry.text)).toEqual(['今天', '事情']);
      expect(await db.preferences.get('default')).toEqual(preference);
      expect(await db.sessions.get('saved')).toEqual(session);
      expect(await db.mistakes.get('saved')).toEqual(mistake);
    } finally {
      legacy.close();
      if (!db.isOpen()) await db.open();
    }
  });

  beforeEach(async () => {
    await db.vocabularyPackages.clear();
    await db.vocabularyEntries.clear();
  });

  it('安装词库后写入 package 和 entries', async () => {
    await installVocabularyPackage(packageFile, 'https://example.com/daily.json');

    const packages = await listInstalledVocabularyPackages();
    const entries = await listVocabularyEntries('daily-common');

    expect(packages).toHaveLength(1);
    expect(packages[0].name).toBe('日常常用词');
    expect(entries.map((entry) => entry.text)).toEqual(['今天', '事情']);
  });

  it('重复安装同一词库会覆盖旧词条而不是追加重复数据', async () => {
    await installVocabularyPackage(packageFile, 'https://example.com/daily.json');
    await installVocabularyPackage({
      ...packageFile,
      entries: [{ text: '项目', weight: 100 }],
    }, 'https://example.com/daily.json');

    const entries = await listVocabularyEntries('daily-common');

    expect(entries.map((entry) => entry.text)).toEqual(['项目']);
  });

  it('卸载词库会同时删除词条', async () => {
    await installVocabularyPackage(packageFile, 'https://example.com/daily.json');

    await uninstallVocabularyPackage('daily-common');

    expect(await listInstalledVocabularyPackages()).toHaveLength(0);
    expect(await listVocabularyEntries('daily-common')).toHaveLength(0);
  });

  it('远程安装默认记录 remote 来源', async () => {
    await installVocabularyPackage(packageFile, 'https://example.com/daily.json');

    const packages = await listVocabularyPackagesBySource('remote');

    expect(packages).toHaveLength(1);
    expect(packages[0].sourceType).toBe('remote');
    expect(packages[0].originalFileName).toBeUndefined();
  });

  it('本地导入记录 local 来源和原始文件名', async () => {
    await installVocabularyPackage(packageFile, 'local-file:daily.txt', {
      sourceType: 'local',
      originalFileName: 'daily.txt',
    });

    const localPackages = await listVocabularyPackagesBySource('local');
    const remotePackages = await listVocabularyPackagesBySource('remote');

    expect(localPackages).toHaveLength(1);
    expect(localPackages[0].sourceType).toBe('local');
    expect(localPackages[0].originalFileName).toBe('daily.txt');
    expect(remotePackages).toHaveLength(0);
  });
});
