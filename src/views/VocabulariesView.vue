<template>
  <div class="app-shell vocabulary-page">
    <FloatingSidebar @open-settings="settingsOpen = true" />
    <SettingsDrawer :open="settingsOpen" @close="settingsOpen = false" />
    <main class="vocabulary-main">
      <section class="vocabulary-hero">
        <span>词库中心</span>
        <h1>安装词库后开始练习</h1>
        <p>词库从外部仓库下载安装到浏览器本地，练习时只读取已安装内容。</p>
        <button type="button" class="soft-pill" :disabled="loadingRegistry" @click="loadRegistry">
          {{ loadingRegistry ? '刷新中...' : '刷新词库' }}
        </button>
      </section>

      <p v-if="registryError" class="vocabulary-error">{{ registryError }}</p>

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

      <section class="vocabulary-section" data-testid="online-vocabulary-center-section">
        <div class="vocabulary-section-head">
          <span>在线词库中心</span>
          <strong>{{ registryPackages.length }}</strong>
        </div>
        <div class="vocabulary-grid">
          <article v-for="item in registryPackages" :key="item.id" class="vocabulary-card has-bottom-action">
            <span>{{ item.pricingType === 'paid' ? '待解锁' : installedIds.has(item.id) ? '已安装' : '免费' }}</span>
            <h2>{{ item.name }}</h2>
            <p>{{ item.description }}</p>
            <div class="vocabulary-tags">
              <small v-for="tag in item.tags" :key="tag">{{ tag }}</small>
            </div>
            <div class="vocabulary-card-meta">
              <em>{{ item.entryCount }} 词</em>
              <em>v{{ item.version }}</em>
            </div>
            <button
              type="button"
              class="primary-action"
              :data-testid="`install-vocabulary-${item.id}`"
              :disabled="installingId === item.id || item.pricingType === 'paid'"
              @click="installPackage(item)"
            >
              {{ installButtonText(item) }}
            </button>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import FloatingSidebar from '../components/layout/FloatingSidebar.vue';
import SettingsDrawer from '../components/settings/SettingsDrawer.vue';
import {
  createLocalVocabularyPackage,
  createVocabularyExportFile,
  parseLocalVocabularyFile,
  type LocalVocabularyParseReport,
  type VocabularyEntry,
  type VocabularyRegistryItem,
} from '../domain/vocabulary';
import { downloadVocabularyPackage, fetchVocabularyRegistry } from '../services/vocabularyRegistryService';
import {
  installVocabularyPackage,
  listInstalledVocabularyPackages,
  listVocabularyEntries,
  listVocabularyPackagesBySource,
  uninstallVocabularyPackage,
} from '../storage/vocabularyRepository';
import type { VocabularyPackageRecord } from '../storage/db';
import { usePracticeStore } from '../stores/practiceStore';

const router = useRouter();
const practice = usePracticeStore();
const registryPackages = ref<VocabularyRegistryItem[]>([]);
const installedPackages = ref<VocabularyPackageRecord[]>([]);
const localPackages = ref<VocabularyPackageRecord[]>([]);
const remoteInstalledPackages = ref<VocabularyPackageRecord[]>([]);
const registryError = ref('');
const loadingRegistry = ref(false);
const installingId = ref<string | null>(null);
const settingsOpen = ref(false);
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
const installedIds = computed(() => new Set(installedPackages.value.map((pack) => pack.id)));
const canConfirmImport = computed(() => !!importReport.value && importReport.value.validCount > 0);

onMounted(() => {
  void hydrate();
});

async function hydrate() {
  await refreshInstalled();
  await loadRegistry();
}

async function refreshInstalled() {
  installedPackages.value = await listInstalledVocabularyPackages();
  localPackages.value = await listVocabularyPackagesBySource('local');
  remoteInstalledPackages.value = await listVocabularyPackagesBySource('remote');
  await practice.refreshVocabularyPackages();
}

async function loadRegistry() {
  loadingRegistry.value = true;
  registryError.value = '';
  try {
    const registry = await fetchVocabularyRegistry();
    registryPackages.value = registry.packages;
  } catch {
    registryError.value = '词库中心暂时无法连接，已安装词库仍可继续练习。';
  } finally {
    loadingRegistry.value = false;
  }
}

async function installPackage(item: VocabularyRegistryItem) {
  if (item.pricingType === 'paid') return;
  installingId.value = item.id;
  try {
    const result = await downloadVocabularyPackage(item.downloadUrl, item.mirrorUrls);
    await installVocabularyPackage(result.packageFile, result.sourceUrl, { checksum: item.checksum });
    await refreshInstalled();
  } finally {
    installingId.value = null;
  }
}

async function removePackage(packageId: string) {
  await uninstallVocabularyPackage(packageId);
  await refreshInstalled();
}

async function startPractice(packageId: string) {
  await practice.setVocabularyPackage(packageId);
  await practice.setModule('vocabulary');
  await router.push({ name: 'practice' });
}

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

function installButtonText(item: VocabularyRegistryItem) {
  if (item.pricingType === 'paid') return '待解锁';
  if (installingId.value === item.id) return '安装中...';
  if (installedIds.value.has(item.id)) return '更新';
  return '安装';
}
</script>

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
