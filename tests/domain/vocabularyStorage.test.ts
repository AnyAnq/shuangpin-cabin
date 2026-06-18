import 'fake-indexeddb/auto';
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
  pricingType: 'free',
  description: '适合日常输入热身。',
  tags: ['daily'],
  entries: [
    { text: '今天', weight: 99 },
    { text: '事情', weight: 98 },
  ],
};

describe('词库安装存储', () => {
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
