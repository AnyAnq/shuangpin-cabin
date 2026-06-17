import type { VocabularyPackageFile } from '../domain/vocabulary';
import { db, type VocabularyEntryRecord, type VocabularyPackageRecord } from './db';

export async function listInstalledVocabularyPackages(): Promise<VocabularyPackageRecord[]> {
  return db.vocabularyPackages.orderBy('installedAt').reverse().toArray();
}

export async function getInstalledVocabularyPackage(packageId: string): Promise<VocabularyPackageRecord | undefined> {
  return db.vocabularyPackages.get(packageId);
}

export async function installVocabularyPackage(packageFile: VocabularyPackageFile, sourceUrl: string, checksum?: string): Promise<string> {
  const now = Date.now();
  const existing = await db.vocabularyPackages.get(packageFile.id);
  const packageRecord: VocabularyPackageRecord = {
    id: packageFile.id,
    name: packageFile.name,
    version: packageFile.version,
    description: packageFile.description,
    author: packageFile.author,
    license: packageFile.license,
    pricingType: packageFile.pricingType,
    tags: packageFile.tags,
    entryCount: packageFile.entries.length,
    installedAt: existing?.installedAt ?? now,
    updatedAt: now,
    sourceUrl,
    checksum,
  };
  const entries = packageFile.entries.map((entry, index): VocabularyEntryRecord => ({
    id: `${packageFile.id}-${index}`,
    packageId: packageFile.id,
    text: entry.text,
    weight: entry.weight,
    tags: entry.tags ?? [],
    source: entry.source,
    length: Array.from(entry.text).length,
  }));

  await db.transaction('rw', db.vocabularyPackages, db.vocabularyEntries, async () => {
    await db.vocabularyPackages.put(packageRecord);
    await db.vocabularyEntries.where('packageId').equals(packageFile.id).delete();
    if (entries.length > 0) {
      await db.vocabularyEntries.bulkPut(entries);
    }
  });

  return packageFile.id;
}

export async function uninstallVocabularyPackage(packageId: string): Promise<void> {
  await db.transaction('rw', db.vocabularyPackages, db.vocabularyEntries, async () => {
    await db.vocabularyEntries.where('packageId').equals(packageId).delete();
    await db.vocabularyPackages.delete(packageId);
  });
}

export async function listVocabularyEntries(packageId: string): Promise<VocabularyEntryRecord[]> {
  const entries = await db.vocabularyEntries.where('packageId').equals(packageId).toArray();
  return entries.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
}
