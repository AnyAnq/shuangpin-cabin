# Local Vocabulary Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete local vocabulary workflow so users can import JSON/TXT/CSV word lists, preview and edit metadata, practice them separately from online vocabularies, and export local vocabularies as standard JSON packages.

**Architecture:** Local import converts every file into the existing `VocabularyPackageFile` domain format, then stores it through the existing IndexedDB repository. The vocabulary center owns file reading, preview, source-based sections, and browser download; the practice store continues to consume installed packages without source-specific logic.

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, Dexie/IndexedDB, Vitest with fake-indexeddb, Vue Test Utils, Playwright.

## Global Constraints

- Support importing standard JSON vocabulary packages.
- Support importing simple TXT/CSV word lists.
- Show an import preview with editable metadata before installing.
- Clearly separate local vocabularies, online installed vocabularies, and the online vocabulary center.
- Local vocabularies export as standard JSON packages only.
- Do not add a word-level editor in this phase.
- Do not add cloud sync, accounts, or an online sharing market.
- Do not change vocabulary practice grouping, pinyin conversion, or shuangpin coding logic.
- `practiceStore.ts` must not add source-specific branching.
- Keep existing remote vocabulary install and practice behavior working.

---

## File Structure

- Modify `src/domain/vocabulary.ts`: add import parsing, local package creation, parsing report types, and export package creation.
- Modify `tests/domain/vocabulary.test.ts`: add domain tests for TXT/CSV/JSON local parsing, duplicate merging, filter reasons, metadata defaults, and export validity.
- Modify `src/storage/db.ts`: add `VocabularySourceType`, `sourceType`, `originalFileName`, and Dexie version 3 migration.
- Modify `src/storage/vocabularyRepository.ts`: accept install options, persist source metadata, list packages by source.
- Modify `tests/domain/vocabularyStorage.test.ts`: test source metadata and source-based queries.
- Modify `src/views/VocabulariesView.vue`: split local/online installed/online center sections, add file import preview, metadata editing, install, and export.
- Modify `tests/components/VocabulariesView.test.ts`: test the three sections, import preview/install, invalid import state, and export button visibility.
- Modify `e2e/practice.spec.ts`: add a user-level import TXT -> start practice path.

---

### Task 1: Vocabulary Import And Export Domain

**Files:**
- Modify: `src/domain/vocabulary.ts`
- Modify: `tests/domain/vocabulary.test.ts`

**Interfaces:**
- Produces:
  - `type LocalVocabularyFileKind = 'json' | 'plain'`
  - `interface LocalVocabularyMetaInput { id?: string; name: string; version?: string; author?: string; license?: string; description?: string; tags?: string[] }`
  - `interface LocalVocabularyParseReport { fileKind: LocalVocabularyFileKind; packageFile: VocabularyPackageFile; validCount: number; filteredCount: number; duplicateCount: number; previewEntries: VocabularyEntry[]; filterReasons: Record<string, number> }`
  - `function parseLocalVocabularyFile(fileName: string, text: string, now?: number): LocalVocabularyParseReport`
  - `function parsePlainVocabularyEntries(text: string): { entries: VocabularyEntry[]; filteredCount: number; duplicateCount: number; filterReasons: Record<string, number> }`
  - `function createLocalVocabularyPackage(meta: LocalVocabularyMetaInput, entries: VocabularyEntry[], now?: number): VocabularyPackageFile`
  - `function createVocabularyExportFile(packageRecord: Pick<VocabularyPackageFile, 'id' | 'name' | 'version' | 'author' | 'license' | 'pricingType' | 'description' | 'tags'>, entries: VocabularyEntry[]): VocabularyPackageFile`
- Consumes:
  - Existing `validateVocabularyPackage(input)`
  - Existing `VocabularyEntry` and `VocabularyPackageFile`

- [ ] **Step 1: Write failing domain tests**

Append these tests to `tests/domain/vocabulary.test.ts` inside the existing `describe('外置词库领域规则', () => { ... })` block:

```ts
  it('从 TXT 词表生成本地词库并统计过滤和重复', () => {
    const report = parseLocalVocabularyFile('我的法律词库.txt', [
      '合同',
      '项目,80,工作',
      '练习,60,基础|输入',
      '项目,90,管理',
      'A计划',
      '超长超长超长超长超长超长超长',
      '',
    ].join('\n'), 1718697600000);

    expect(report.fileKind).toBe('plain');
    expect(report.packageFile.id).toBe('local-我的法律词库-1718697600000');
    expect(report.packageFile.name).toBe('我的法律词库');
    expect(report.packageFile.author).toBe('本地导入');
    expect(report.packageFile.pricingType).toBe('owned');
    expect(report.packageFile.tags).toEqual(['custom', 'local']);
    expect(report.validCount).toBe(3);
    expect(report.duplicateCount).toBe(1);
    expect(report.filteredCount).toBe(3);
    expect(report.filterReasons).toEqual({
      '含英文、数字或符号': 1,
      '超过 12 字': 1,
      '空行': 1,
    });
    expect(report.packageFile.entries).toEqual([
      { text: '合同', weight: 100, tags: undefined, source: undefined },
      { text: '项目', weight: 90, tags: ['工作', '管理'], source: undefined },
      { text: '练习', weight: 60, tags: ['基础', '输入'], source: undefined },
    ]);
    expect(report.previewEntries.map((entry) => entry.text)).toEqual(['合同', '项目', '练习']);
  });

  it('从 CSV 词表跳过 text weight tags 表头', () => {
    const report = parseLocalVocabularyFile('daily.csv', [
      'text,weight,tags',
      '今天,88,日常/基础',
      '事情,,日常、工作',
    ].join('\n'), 1718697600000);

    expect(report.packageFile.name).toBe('daily');
    expect(report.validCount).toBe(2);
    expect(report.packageFile.entries).toEqual([
      { text: '今天', weight: 88, tags: ['日常', '基础'], source: undefined },
      { text: '事情', weight: 99, tags: ['日常', '工作'], source: undefined },
    ]);
  });

  it('导入标准 JSON 包时复用现有校验并标记为 JSON 类型', () => {
    const report = parseLocalVocabularyFile('custom.json', JSON.stringify({
      schemaVersion: 1,
      id: 'custom-json',
      name: 'JSON 词库',
      version: '1.0.0',
      author: '用户',
      license: 'Personal',
      pricingType: 'owned',
      description: '用户制作',
      tags: ['custom'],
      entries: [{ text: '今天', weight: 100 }, { text: 'A计划' }],
    }), 1718697600000);

    expect(report.fileKind).toBe('json');
    expect(report.packageFile.id).toBe('custom-json');
    expect(report.validCount).toBe(1);
    expect(report.filteredCount).toBe(1);
    expect(report.previewEntries).toEqual([{ text: '今天', weight: 100, tags: undefined, source: undefined }]);
  });

  it('导出文件能再次通过词库包校验', () => {
    const exported = createVocabularyExportFile({
      id: 'local-export',
      name: '导出词库',
      version: '1.0.0',
      author: '本地导入',
      license: 'Personal',
      pricingType: 'owned',
      description: '导出测试',
      tags: ['custom', 'local'],
    }, [
      { text: '今天', weight: 100, tags: ['日常'] },
      { text: '项目', weight: 90, tags: ['工作'] },
    ]);

    expect(validateVocabularyPackage(exported)).toEqual(exported);
  });
```

Update the import list at the top of `tests/domain/vocabulary.test.ts`:

```ts
import {
  buildVocabularyPracticeUnits,
  createVocabularyExportFile,
  parseLocalVocabularyFile,
  validateVocabularyPackage,
  validateVocabularyRegistry,
} from '../../src/domain/vocabulary';
```

- [ ] **Step 2: Run the domain test and verify it fails**

Run:

```bash
npm run test -- tests/domain/vocabulary.test.ts
```

Expected: FAIL because `parseLocalVocabularyFile` and `createVocabularyExportFile` are not exported.

- [ ] **Step 3: Implement import/export domain logic**

In `src/domain/vocabulary.ts`, add these exports below the existing interfaces:

```ts
export type LocalVocabularyFileKind = 'json' | 'plain';

export interface LocalVocabularyMetaInput {
  id?: string;
  name: string;
  version?: string;
  author?: string;
  license?: string;
  description?: string;
  tags?: string[];
}

export interface LocalVocabularyParseReport {
  fileKind: LocalVocabularyFileKind;
  packageFile: VocabularyPackageFile;
  validCount: number;
  filteredCount: number;
  duplicateCount: number;
  previewEntries: VocabularyEntry[];
  filterReasons: Record<string, number>;
}

interface PlainParseResult {
  entries: VocabularyEntry[];
  filteredCount: number;
  duplicateCount: number;
  filterReasons: Record<string, number>;
}
```

Add these constants near `ZH_ONLY`:

```ts
const MAX_ENTRY_LENGTH = 12;
const PREVIEW_ENTRY_LIMIT = 12;
const DEFAULT_LOCAL_TAGS = ['custom', 'local'];
```

Replace the hardcoded `12` in `validateVocabularyPackage` with `MAX_ENTRY_LENGTH`:

```ts
    .filter((entry) => entry.text.length > 0 && Array.from(entry.text).length <= MAX_ENTRY_LENGTH && ZH_ONLY.test(entry.text));
```

Add these exported functions before `buildVocabularyPracticeUnits`:

```ts
export function parseLocalVocabularyFile(fileName: string, text: string, now = Date.now()): LocalVocabularyParseReport {
  if (fileName.toLowerCase().endsWith('.json')) {
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('JSON 格式不正确');
    }
    const rawEntryCount = isRecord(payload) && Array.isArray(payload.entries) ? payload.entries.length : 0;
    const packageFile = validateVocabularyPackage(payload);
    const filteredCount = Math.max(0, rawEntryCount - packageFile.entries.length);
    return {
      fileKind: 'json',
      packageFile,
      validCount: packageFile.entries.length,
      filteredCount,
      duplicateCount: 0,
      previewEntries: packageFile.entries.slice(0, PREVIEW_ENTRY_LIMIT),
      filterReasons: filteredCount > 0 ? { '不符合词条规则': filteredCount } : {},
    };
  }

  const parsed = parsePlainVocabularyEntries(text);
  const packageFile = createLocalVocabularyPackage({
    name: baseNameFromFileName(fileName),
  }, parsed.entries, now);
  return {
    fileKind: 'plain',
    packageFile,
    validCount: packageFile.entries.length,
    filteredCount: parsed.filteredCount,
    duplicateCount: parsed.duplicateCount,
    previewEntries: packageFile.entries.slice(0, PREVIEW_ENTRY_LIMIT),
    filterReasons: parsed.filterReasons,
  };
}

export function parsePlainVocabularyEntries(text: string): PlainParseResult {
  const entriesByText = new Map<string, VocabularyEntry>();
  const filterReasons: Record<string, number> = {};
  let filteredCount = 0;
  let duplicateCount = 0;
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      filteredCount += 1;
      incrementReason(filterReasons, '空行');
      return;
    }
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
      filteredCount += 1;
      incrementReason(filterReasons, '注释行');
      return;
    }
    const columns = trimmed.split(',').map((column) => column.trim());
    if (index === 0 && columns[0]?.toLowerCase() === 'text') {
      filteredCount += 1;
      incrementReason(filterReasons, '表头');
      return;
    }

    const word = columns[0] ?? '';
    const charLength = Array.from(word).length;
    if (word.length === 0) {
      filteredCount += 1;
      incrementReason(filterReasons, '空行');
      return;
    }
    if (charLength > MAX_ENTRY_LENGTH) {
      filteredCount += 1;
      incrementReason(filterReasons, '超过 12 字');
      return;
    }
    if (!ZH_ONLY.test(word)) {
      filteredCount += 1;
      incrementReason(filterReasons, '含英文、数字或符号');
      return;
    }

    const parsedWeight = columns[1] ? Number(columns[1]) : Number.NaN;
    const fallbackWeight = Math.max(1, 100 - entriesByText.size);
    const weight = Number.isFinite(parsedWeight) ? parsedWeight : fallbackWeight;
    const tags = parseTags(columns.slice(2).join(','));
    const existing = entriesByText.get(word);
    if (existing) {
      duplicateCount += 1;
      entriesByText.set(word, {
        text: word,
        weight: Math.max(existing.weight ?? 0, weight),
        tags: mergeTags(existing.tags, tags),
        source: existing.source,
      });
      return;
    }
    entriesByText.set(word, {
      text: word,
      weight,
      tags: tags.length > 0 ? tags : undefined,
      source: undefined,
    });
  });

  return {
    entries: Array.from(entriesByText.values()),
    filteredCount,
    duplicateCount,
    filterReasons,
  };
}

export function createLocalVocabularyPackage(meta: LocalVocabularyMetaInput, entries: VocabularyEntry[], now = Date.now()): VocabularyPackageFile {
  return validateVocabularyPackage({
    schemaVersion: 1,
    id: meta.id ?? `local-${slugFromName(meta.name)}-${now}`,
    name: meta.name,
    version: meta.version ?? '1.0.0',
    author: meta.author ?? '本地导入',
    license: meta.license ?? 'Personal',
    pricingType: 'owned',
    description: meta.description ?? '从本地文件导入的自定义词库',
    tags: meta.tags && meta.tags.length > 0 ? meta.tags : DEFAULT_LOCAL_TAGS,
    entries,
  });
}

export function createVocabularyExportFile(
  packageRecord: Pick<VocabularyPackageFile, 'id' | 'name' | 'version' | 'author' | 'license' | 'pricingType' | 'description' | 'tags'>,
  entries: VocabularyEntry[],
): VocabularyPackageFile {
  return validateVocabularyPackage({
    schemaVersion: 1,
    ...packageRecord,
    entries,
  });
}
```

Add these helpers near the bottom of `src/domain/vocabulary.ts` before `isRegistryItem`:

```ts
function baseNameFromFileName(fileName: string) {
  const normalized = fileName.split(/[\\/]/).pop() ?? fileName;
  return normalized.replace(/\.[^.]+$/, '') || '本地词库';
}

function slugFromName(name: string) {
  return name.trim().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '') || 'vocabulary';
}

function parseTags(input: string) {
  return input
    .split(/[|/\s、]+/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function mergeTags(left: string[] | undefined, right: string[]) {
  const merged = Array.from(new Set([...(left ?? []), ...right]));
  return merged.length > 0 ? merged : undefined;
}

function incrementReason(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}
```

- [ ] **Step 4: Run the domain test and verify it passes**

Run:

```bash
npm run test -- tests/domain/vocabulary.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/domain/vocabulary.ts tests/domain/vocabulary.test.ts
git commit -m "feat: parse local vocabulary files"
```

Expected: commit succeeds.

---

### Task 2: Vocabulary Source Storage

**Files:**
- Modify: `src/storage/db.ts`
- Modify: `src/storage/vocabularyRepository.ts`
- Modify: `tests/domain/vocabularyStorage.test.ts`

**Interfaces:**
- Consumes from Task 1:
  - Existing `VocabularyPackageFile`
- Produces:
  - `type VocabularySourceType = 'remote' | 'local'`
  - `interface InstallVocabularyOptions { sourceType?: VocabularySourceType; originalFileName?: string; checksum?: string }`
  - `function installVocabularyPackage(packageFile: VocabularyPackageFile, sourceUrl: string, options?: InstallVocabularyOptions): Promise<string>`
  - `function listVocabularyPackagesBySource(sourceType: VocabularySourceType): Promise<VocabularyPackageRecord[]>`

- [ ] **Step 1: Write failing storage tests**

Update the imports in `tests/domain/vocabularyStorage.test.ts`:

```ts
import {
  installVocabularyPackage,
  listInstalledVocabularyPackages,
  listVocabularyEntries,
  listVocabularyPackagesBySource,
  uninstallVocabularyPackage,
} from '../../src/storage/vocabularyRepository';
```

Append these tests inside the existing `describe('词库安装存储', () => { ... })` block:

```ts
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
```

- [ ] **Step 2: Run the storage test and verify it fails**

Run:

```bash
npm run test -- tests/domain/vocabularyStorage.test.ts
```

Expected: FAIL because `listVocabularyPackagesBySource` and `sourceType` do not exist.

- [ ] **Step 3: Implement storage source metadata**

In `src/storage/db.ts`, add the source type export near the imports:

```ts
export type VocabularySourceType = 'remote' | 'local';
```

Update `VocabularyPackageRecord`:

```ts
export interface VocabularyPackageRecord {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  pricingType: VocabularyPricingType;
  tags: string[];
  entryCount: number;
  installedAt: number;
  updatedAt: number;
  sourceUrl: string;
  sourceType: VocabularySourceType;
  originalFileName?: string;
  checksum?: string;
}
```

Add Dexie version 3 after version 2 in the constructor:

```ts
    this.version(3).stores({
      mistakes: 'id, scheme, module, targetChar, expectedKey, lastWrongAt',
      sessions: 'id, scheme, module, createdAt',
      preferences: 'id, scheme, module, updatedAt',
      vocabularyPackages: 'id, pricingType, sourceType, installedAt, updatedAt',
      vocabularyEntries: 'id, packageId, text, weight, length',
    }).upgrade(async (tx) => {
      const table = tx.table<VocabularyPackageRecord, string>('vocabularyPackages');
      const packages = await table.toArray();
      await Promise.all(packages.map((pack) => table.update(pack.id, {
        sourceType: pack.sourceUrl.startsWith('local-file:') ? 'local' : 'remote',
      })));
    });
```

In `src/storage/vocabularyRepository.ts`, update imports:

```ts
import { db, type VocabularyEntryRecord, type VocabularyPackageRecord, type VocabularySourceType } from './db';
```

Add the options interface:

```ts
export interface InstallVocabularyOptions {
  sourceType?: VocabularySourceType;
  originalFileName?: string;
  checksum?: string;
}
```

Change `installVocabularyPackage` signature and package record creation:

```ts
export async function installVocabularyPackage(
  packageFile: VocabularyPackageFile,
  sourceUrl: string,
  options: InstallVocabularyOptions = {},
): Promise<string> {
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
    sourceType: options.sourceType ?? 'remote',
    originalFileName: options.originalFileName,
    checksum: options.checksum,
  };
```

Add this function after `listInstalledVocabularyPackages`:

```ts
export async function listVocabularyPackagesBySource(sourceType: VocabularySourceType): Promise<VocabularyPackageRecord[]> {
  const packages = await db.vocabularyPackages.where('sourceType').equals(sourceType).toArray();
  return packages.sort((a, b) => b.installedAt - a.installedAt);
}
```

Update `src/views/VocabulariesView.vue` call site for remote install:

```ts
    await installVocabularyPackage(result.packageFile, result.sourceUrl, { checksum: item.checksum });
```

- [ ] **Step 4: Run storage and component tests**

Run:

```bash
npm run test -- tests/domain/vocabularyStorage.test.ts tests/components/VocabulariesView.test.ts
```

Expected: PASS. If TypeScript reports old checksum call shape, update any remaining `installVocabularyPackage(packageFile, url, checksum)` calls to `installVocabularyPackage(packageFile, url, { checksum })`.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/storage/db.ts src/storage/vocabularyRepository.ts src/views/VocabulariesView.vue tests/domain/vocabularyStorage.test.ts
git commit -m "feat: track vocabulary source"
```

Expected: commit succeeds.

---

### Task 3: Vocabulary Center Local Import UI

**Files:**
- Modify: `src/views/VocabulariesView.vue`
- Modify: `tests/components/VocabulariesView.test.ts`

**Interfaces:**
- Consumes from Task 1:
  - `parseLocalVocabularyFile(fileName, text): LocalVocabularyParseReport`
  - `createLocalVocabularyPackage(meta, entries): VocabularyPackageFile`
  - `createVocabularyExportFile(packageRecord, entries): VocabularyPackageFile`
- Consumes from Task 2:
  - `installVocabularyPackage(packageFile, sourceUrl, options)`
  - `listVocabularyPackagesBySource(sourceType)`
  - `listVocabularyEntries(packageId)`
- Produces:
  - UI test ids:
    - `import-vocabulary-input`
    - `confirm-local-vocabulary-import`
    - `local-vocabulary-section`
    - `online-installed-vocabulary-section`
    - `online-vocabulary-center-section`
    - `export-vocabulary-<packageId>`

- [ ] **Step 1: Write failing component tests**

In `tests/components/VocabulariesView.test.ts`, update imports:

```ts
import { db, type VocabularyPackageRecord } from '../../src/storage/db';
```

Add these helpers at the bottom:

```ts
function textFile(name: string, content: string, type = 'text/plain') {
  return new File([content], name, { type });
}

async function installRecord(record: VocabularyPackageRecord) {
  await db.vocabularyPackages.put(record);
}
```

Append these tests:

```ts
  it('分区展示本地词库、在线已安装词库和在线词库中心', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.endsWith('/registry.json')) {
        return Promise.resolve(jsonResponse({
          schemaVersion: 1,
          updatedAt: '2026-06-17T00:00:00.000Z',
          packages: [],
        }));
      }
      return Promise.reject(new Error('未模拟请求'));
    }));
    await installRecord({
      id: 'local-pack',
      name: '我的词库',
      version: '1.0.0',
      description: '本地导入',
      author: '本地导入',
      license: 'Personal',
      pricingType: 'owned',
      tags: ['custom', 'local'],
      entryCount: 2,
      installedAt: 1,
      updatedAt: 1,
      sourceUrl: 'local-file:mine.txt',
      sourceType: 'local',
      originalFileName: 'mine.txt',
    });
    await installRecord({
      id: 'remote-pack',
      name: '在线词库',
      version: '1.0.0',
      description: '在线安装',
      author: 'Shuangpin Cabin',
      license: 'MIT',
      pricingType: 'free',
      tags: ['daily'],
      entryCount: 2,
      installedAt: 2,
      updatedAt: 2,
      sourceUrl: 'https://example.com/remote.json',
      sourceType: 'remote',
    });

    const wrapper = mount(VocabulariesView, {
      global: { plugins: [routerForVocabulary()] },
    });
    await flush();

    expect(wrapper.get('[data-testid="local-vocabulary-section"]').text()).toContain('我的词库');
    expect(wrapper.get('[data-testid="online-installed-vocabulary-section"]').text()).toContain('在线词库');
    expect(wrapper.get('[data-testid="online-vocabulary-center-section"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="export-vocabulary-local-pack"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="export-vocabulary-remote-pack"]').exists()).toBe(false);
  });

  it('导入 TXT 后显示预览并安装到本地词库区域', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.endsWith('/registry.json')) {
        return Promise.resolve(jsonResponse({
          schemaVersion: 1,
          updatedAt: '2026-06-17T00:00:00.000Z',
          packages: [],
        }));
      }
      return Promise.reject(new Error('未模拟请求'));
    }));
    const wrapper = mount(VocabulariesView, {
      global: { plugins: [routerForVocabulary()] },
    });
    await flush();

    const input = wrapper.get<HTMLInputElement>('[data-testid="import-vocabulary-input"]');
    Object.defineProperty(input.element, 'files', {
      value: [textFile('我的词库.txt', '今天\n项目,80,工作\nA计划')],
      configurable: true,
    });
    await input.trigger('change');
    await flush();

    expect(wrapper.text()).toContain('有效词条 2');
    expect(wrapper.text()).toContain('过滤 1');
    expect(wrapper.text()).toContain('今天');
    await wrapper.get('[data-testid="confirm-local-vocabulary-import"]').trigger('click');
    await flush();

    expect(wrapper.get('[data-testid="local-vocabulary-section"]').text()).toContain('我的词库');
    expect(await db.vocabularyPackages.where('sourceType').equals('local').count()).toBe(1);
    expect(await db.vocabularyEntries.where('packageId').startsWith('local-我的词库').count()).toBe(2);
  });

  it('没有有效词条时禁用确认导入', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.endsWith('/registry.json')) {
        return Promise.resolve(jsonResponse({
          schemaVersion: 1,
          updatedAt: '2026-06-17T00:00:00.000Z',
          packages: [],
        }));
      }
      return Promise.reject(new Error('未模拟请求'));
    }));
    const wrapper = mount(VocabulariesView, {
      global: { plugins: [routerForVocabulary()] },
    });
    await flush();

    const input = wrapper.get<HTMLInputElement>('[data-testid="import-vocabulary-input"]');
    Object.defineProperty(input.element, 'files', {
      value: [textFile('bad.txt', 'A计划\n123\n')],
      configurable: true,
    });
    await input.trigger('change');
    await flush();

    expect(wrapper.text()).toContain('未找到可练习的纯中文词条');
    expect(wrapper.get('[data-testid="confirm-local-vocabulary-import"]').attributes('disabled')).toBeDefined();
  });
```

Add this router helper near the existing `flush` helper:

```ts
function routerForVocabulary() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'practice', component: { template: '<div />' } },
      { path: '/records', name: 'records', component: { template: '<div />' } },
      { path: '/vocabularies', name: 'vocabularies', component: VocabulariesView },
    ],
  });
}
```

In the existing test, replace inline router creation with:

```ts
    const router = routerForVocabulary();
```

- [ ] **Step 2: Run component tests and verify they fail**

Run:

```bash
npm run test -- tests/components/VocabulariesView.test.ts
```

Expected: FAIL because the UI sections, input, import preview, and export buttons do not exist.

- [ ] **Step 3: Implement VocabulariesView script state and methods**

In `src/views/VocabulariesView.vue`, update imports:

```ts
import { computed, onMounted, ref } from 'vue';
import {
  createLocalVocabularyPackage,
  createVocabularyExportFile,
  parseLocalVocabularyFile,
  type LocalVocabularyParseReport,
  type VocabularyEntry,
  type VocabularyRegistryItem,
} from '../domain/vocabulary';
import {
  installVocabularyPackage,
  listInstalledVocabularyPackages,
  listVocabularyEntries,
  listVocabularyPackagesBySource,
  uninstallVocabularyPackage,
} from '../storage/vocabularyRepository';
```

Add refs and computed values after existing refs:

```ts
const localPackages = ref<VocabularyPackageRecord[]>([]);
const remoteInstalledPackages = ref<VocabularyPackageRecord[]>([]);
const importInput = ref<HTMLInputElement | null>(null);
const currentImportFileName = ref('');
const importReport = ref<LocalVocabularyParseReport | null>(null);
const importError = ref('');
const importNotice = ref('');
const importMeta = ref({
  name: '',
  description: '',
  author: '',
  tags: '',
});
const canConfirmImport = computed(() => !!importReport.value && importReport.value.validCount > 0);
```

Replace `refreshInstalled` with:

```ts
async function refreshInstalled() {
  installedPackages.value = await listInstalledVocabularyPackages();
  localPackages.value = await listVocabularyPackagesBySource('local');
  remoteInstalledPackages.value = await listVocabularyPackagesBySource('remote');
  await practice.refreshVocabularyPackages();
}
```

Add these methods before `installButtonText`:

```ts
function openImportPicker() {
  importInput.value?.click();
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  importError.value = '';
  importNotice.value = '';
  currentImportFileName.value = file.name;
  try {
    const text = await file.text();
    const report = parseLocalVocabularyFile(file.name, text);
    importReport.value = report;
    importMeta.value = {
      name: report.packageFile.name,
      description: report.packageFile.description,
      author: report.packageFile.author,
      tags: report.packageFile.tags.join(', '),
    };
  } catch (error) {
    importReport.value = null;
    importError.value = error instanceof Error ? error.message : '文件读取失败，请重新选择文件';
  } finally {
    input.value = '';
  }
}

async function confirmLocalImport() {
  if (!importReport.value || importReport.value.validCount === 0) return;
  const packageFile = createLocalVocabularyPackage({
    id: importReport.value.fileKind === 'json' ? importReport.value.packageFile.id : undefined,
    name: importMeta.value.name.trim() || importReport.value.packageFile.name,
    version: importReport.value.packageFile.version,
    author: importMeta.value.author.trim() || '本地导入',
    license: importReport.value.packageFile.license,
    description: importMeta.value.description.trim() || '从本地文件导入的自定义词库',
    tags: importMeta.value.tags.split(/[,，\s]+/).map((tag) => tag.trim()).filter(Boolean),
  }, importReport.value.packageFile.entries);
  await installVocabularyPackage(packageFile, `local-file:${currentImportFileName.value || packageFile.name}`, {
    sourceType: 'local',
    originalFileName: currentImportFileName.value || packageFile.name,
  });
  importNotice.value = '已导入，可开始练习';
  importReport.value = null;
  await refreshInstalled();
}

async function exportLocalPackage(pack: VocabularyPackageRecord) {
  try {
    const entries = await listVocabularyEntries(pack.id);
    const exportFile = createVocabularyExportFile({
      id: pack.id,
      name: pack.name,
      version: pack.version,
      author: pack.author,
      license: pack.license,
      pricingType: pack.pricingType,
      description: pack.description,
      tags: pack.tags,
    }, entries.map((entry): VocabularyEntry => ({
      text: entry.text,
      weight: entry.weight,
      tags: entry.tags,
      source: entry.source,
    })));
    const blob = new Blob([JSON.stringify(exportFile, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${pack.id}@${pack.version}.json`;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    registryError.value = '导出失败，请稍后重试';
  }
}
```

- [ ] **Step 4: Implement VocabulariesView template sections**

Replace the existing installed section with these two sections:

```vue
      <section class="vocabulary-section" data-testid="local-vocabulary-section">
        <div class="vocabulary-section-head">
          <span>本地词库</span>
          <strong>{{ localPackages.length }}</strong>
          <button type="button" class="soft-pill" @click="openImportPicker">导入词库</button>
          <input
            ref="importInput"
            type="file"
            accept=".json,.txt,.csv"
            class="vocabulary-file-input"
            data-testid="import-vocabulary-input"
            @change="handleImportFile"
          >
        </div>
        <div v-if="localPackages.length === 0" class="vocabulary-installed-empty">
          还没有本地词库。导入 JSON、TXT 或 CSV 后，就可以用自己的内容练习。
        </div>
        <div v-else class="vocabulary-grid">
          <article v-for="pack in localPackages" :key="pack.id" class="vocabulary-card is-installed has-bottom-action">
            <span>自定义</span>
            <h2>{{ pack.name }}</h2>
            <p>{{ pack.description }}</p>
            <div class="vocabulary-card-meta">
              <em>{{ pack.entryCount }} 词</em>
              <em>v{{ pack.version }}</em>
            </div>
            <div class="vocabulary-card-actions">
              <button type="button" class="primary-action" @click="startPractice(pack.id)">开始练习</button>
              <button type="button" class="ghost-action" :data-testid="`export-vocabulary-${pack.id}`" @click="exportLocalPackage(pack)">导出</button>
              <button type="button" class="ghost-action" @click="removePackage(pack.id)">卸载</button>
            </div>
          </article>
        </div>
      </section>

      <section v-if="importReport || importError || importNotice" class="vocabulary-section vocabulary-import-panel">
        <div class="vocabulary-section-head">
          <span>导入预览</span>
          <strong v-if="importReport">有效词条 {{ importReport.validCount }}</strong>
        </div>
        <p v-if="importError" class="vocabulary-error">{{ importError }}</p>
        <p v-if="importNotice" class="vocabulary-success">{{ importNotice }}</p>
        <template v-if="importReport">
          <div class="vocabulary-import-fields">
            <label>名称<input v-model="importMeta.name" type="text"></label>
            <label>描述<input v-model="importMeta.description" type="text"></label>
            <label>作者<input v-model="importMeta.author" type="text"></label>
            <label>标签<input v-model="importMeta.tags" type="text"></label>
          </div>
          <div class="vocabulary-card-meta">
            <em>有效词条 {{ importReport.validCount }}</em>
            <em>重复 {{ importReport.duplicateCount }}</em>
            <em>过滤 {{ importReport.filteredCount }}</em>
          </div>
          <p v-if="importReport.validCount === 0" class="vocabulary-error">未找到可练习的纯中文词条</p>
          <div class="vocabulary-tags">
            <small v-for="entry in importReport.previewEntries" :key="entry.text">{{ entry.text }}</small>
          </div>
          <div v-if="Object.keys(importReport.filterReasons).length > 0" class="vocabulary-filter-summary">
            <small v-for="(count, reason) in importReport.filterReasons" :key="reason">{{ reason }} {{ count }}</small>
          </div>
          <button
            type="button"
            class="primary-action"
            data-testid="confirm-local-vocabulary-import"
            :disabled="!canConfirmImport"
            @click="confirmLocalImport"
          >
            {{ importReport.fileKind === 'json' && installedIds.has(importReport.packageFile.id) ? '覆盖导入' : '确认导入' }}
          </button>
        </template>
      </section>

      <section class="vocabulary-section" data-testid="online-installed-vocabulary-section">
        <div class="vocabulary-section-head">
          <span>在线已安装词库</span>
          <strong>{{ remoteInstalledPackages.length }}</strong>
        </div>
        <div v-if="remoteInstalledPackages.length === 0" class="vocabulary-installed-empty">
          还没有安装在线词库。安装一个免费词库后，首页的词库练习就会亮起来。
        </div>
        <div v-else class="vocabulary-grid">
          <article v-for="pack in remoteInstalledPackages" :key="pack.id" class="vocabulary-card is-installed has-bottom-action">
            <span>已安装</span>
            <h2>{{ pack.name }}</h2>
            <p>{{ pack.description }}</p>
            <div class="vocabulary-card-meta">
              <em>{{ pack.entryCount }} 词</em>
              <em>v{{ pack.version }}</em>
            </div>
            <div class="vocabulary-card-actions">
              <button type="button" class="primary-action" @click="startPractice(pack.id)">开始练习</button>
              <button type="button" class="ghost-action" @click="removePackage(pack.id)">卸载</button>
            </div>
          </article>
        </div>
      </section>
```

Add `data-testid="online-vocabulary-center-section"` to the existing online center section:

```vue
      <section class="vocabulary-section" data-testid="online-vocabulary-center-section">
```

- [ ] **Step 5: Add minimal styles**

If `VocabulariesView.vue` has a style block, add these styles to it. If it does not, add a scoped style block at the end:

```vue
<style scoped>
.vocabulary-file-input {
  display: none;
}

.vocabulary-import-panel {
  border: 1px solid rgba(91, 67, 51, 0.16);
}

.vocabulary-import-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.vocabulary-import-fields label {
  display: grid;
  gap: 6px;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.vocabulary-import-fields input {
  min-width: 0;
  border: 1px solid rgba(91, 67, 51, 0.18);
  border-radius: 8px;
  padding: 9px 10px;
  background: rgba(255, 252, 246, 0.82);
  color: var(--text-main);
}

.vocabulary-filter-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}

.vocabulary-filter-summary small {
  border-radius: 999px;
  padding: 4px 8px;
  background: rgba(144, 88, 58, 0.1);
  color: var(--text-muted);
}

.vocabulary-success {
  margin: 0 0 16px;
  color: #52714d;
}
</style>
```

- [ ] **Step 6: Run component tests**

Run:

```bash
npm run test -- tests/components/VocabulariesView.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/views/VocabulariesView.vue tests/components/VocabulariesView.test.ts
git commit -m "feat: add local vocabulary import UI"
```

Expected: commit succeeds.

---

### Task 4: End-To-End Import Practice Flow

**Files:**
- Modify: `e2e/practice.spec.ts`

**Interfaces:**
- Consumes from Task 3:
  - `data-testid="import-vocabulary-input"`
  - `data-testid="confirm-local-vocabulary-import"`
  - Local section text and start practice button

- [ ] **Step 1: Write failing E2E test**

Append this test to `e2e/practice.spec.ts` before helper functions:

```ts
test('导入本地 TXT 词库后可以开始词库练习', async ({ page }) => {
  await mockContentApi(page);
  await mockVocabularyRegistry(page);
  await page.goto('/');

  await page.getByRole('link', { name: '词库' }).click();
  await expect(page.getByRole('heading', { name: '安装词库后开始练习' })).toBeVisible();

  await page.getByTestId('import-vocabulary-input').setInputFiles({
    name: '我的词库.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('今天\n事情\n可以\n我们\n项目\n完成\nA计划', 'utf-8'),
  });
  await expect(page.getByText('有效词条 6')).toBeVisible();
  await expect(page.getByText('过滤 1')).toBeVisible();
  await page.getByTestId('confirm-local-vocabulary-import').click();
  await expect(page.getByTestId('local-vocabulary-section')).toContainText('我的词库');

  await page.getByTestId('local-vocabulary-section').getByRole('button', { name: '开始练习' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('今日练习 · 词库练习 · 我的词库')).toBeVisible();
  await expectStageText(page, '今天事情可以我们项目完成');
});
```

- [ ] **Step 2: Run E2E test and verify it fails if Task 3 is incomplete**

Run:

```bash
npm run e2e -- e2e/practice.spec.ts --grep "导入本地 TXT"
```

Expected after Task 3 is complete: PASS. If it fails, the failure should point to missing UI test ids, import preview text, or practice text.

- [ ] **Step 3: Fix any E2E-only issues**

If Playwright cannot interact with the hidden file input, keep the input hidden with `display: none`; Playwright `setInputFiles` works with hidden file inputs. If the test fails because the local package does not create exactly one 12-character unit, use the six two-character words in the test buffer exactly as shown:

```text
今天
事情
可以
我们
项目
完成
```

The expected stage text remains:

```text
今天事情可以我们项目完成
```

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run test
npm run build
npm run e2e
```

Expected: all commands PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add e2e/practice.spec.ts
git commit -m "test: cover local vocabulary import flow"
```

Expected: commit succeeds.

---

## Final Review Checklist

- [ ] `npm run test` passes.
- [ ] `npm run build` passes.
- [ ] `npm run e2e` passes.
- [ ] Local vocabularies appear only in the local section.
- [ ] Online installed vocabularies appear only in the online installed section.
- [ ] Online registry packages appear only in the online vocabulary center.
- [ ] TXT/CSV invalid entries are reported without blocking valid entries.
- [ ] JSON export can be imported again through `parseLocalVocabularyFile`.
- [ ] `practiceStore.ts` has no source-type branching.
