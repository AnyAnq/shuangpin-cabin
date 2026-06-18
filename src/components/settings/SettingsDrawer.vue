<template>
  <div v-if="open" class="settings-backdrop" @click.self="$emit('close')">
    <aside class="settings-drawer" aria-label="设置面板">
        <header class="settings-head">
          <div>
            <span>轻量设置</span>
            <h2>设置</h2>
          </div>
          <button type="button" aria-label="关闭设置" class="settings-close" @click="$emit('close')">
            <X />
          </button>
        </header>

        <section class="settings-section">
          <div class="settings-section-head">
            <span>练习偏好</span>
            <p>下一次进入时使用更顺手的默认节奏。</p>
          </div>

          <div class="settings-row">
            <strong>默认双拼方案</strong>
            <div class="settings-options">
              <button
                type="button"
                class="settings-option"
                :class="{ 'is-active': practice.schemeId === 'xiaohe' }"
                @click="practice.setScheme('xiaohe')"
              >
                小鹤双拼
              </button>
              <button
                type="button"
                class="settings-option"
                :class="{ 'is-active': practice.schemeId === 'ziranma' }"
                @click="practice.setScheme('ziranma')"
              >
                自然码
              </button>
            </div>
          </div>

          <div class="settings-row">
            <strong>默认练习模块</strong>
            <div class="settings-options">
              <button
                v-for="item in moduleOptions"
                :key="item.value"
                type="button"
                class="settings-option"
                :class="{ 'is-active': practice.defaultModule === item.value }"
                @click="practice.setDefaultModule(item.value)"
              >
                {{ item.label }}
              </button>
            </div>
          </div>

          <div class="settings-row settings-toggle-row">
            <div>
              <strong>显示逐字编码</strong>
              <p>在每个字下方显示双拼键位，引导节奏更稳。</p>
            </div>
            <button
              type="button"
              class="settings-switch"
              :class="{ 'is-on': practice.showCharacterCodes }"
              data-testid="toggle-character-codes"
              :aria-pressed="practice.showCharacterCodes"
              @click="practice.setShowCharacterCodes(!practice.showCharacterCodes)"
            >
              <span />
            </button>
          </div>
        </section>

        <section class="settings-section">
          <div class="settings-section-head">
            <span>本地数据</span>
            <p>只清理当前浏览器里的练习数据，不影响线上内容源。</p>
          </div>
          <div class="settings-danger-grid">
            <button type="button" @click="clearMistakes">清空错题记录</button>
            <button type="button" @click="clearSessions">清空练习记录</button>
            <button type="button" @click="clearVocabularies">清空已安装词库</button>
          </div>
        </section>

        <section class="settings-section">
          <div class="settings-section-head">
            <span>词库与项目</span>
            <p>导入自己制作的词库，也可以到 GitHub 查看源码和反馈问题。</p>
          </div>

          <div class="settings-row">
            <strong>本地词库</strong>
            <p>支持 JSON、TXT、CSV，导入后会保存到当前浏览器。</p>
            <div class="settings-options">
              <button type="button" class="settings-option" @click="openImportPicker">
                <Upload />
                导入本地词库
              </button>
              <input
                ref="importInput"
                type="file"
                accept=".json,.txt,.csv"
                class="settings-file-input"
                data-testid="settings-import-vocabulary-input"
                @change="handleImportFile"
              >
            </div>
          </div>

          <div v-if="importReport || importError || importNotice" class="settings-import-panel">
            <p v-if="importError" class="settings-import-error">{{ importError }}</p>
            <p v-if="importNotice" class="settings-import-success">{{ importNotice }}</p>
            <template v-if="importReport">
              <div class="settings-import-fields">
                <label>名称<input v-model="importMeta.name" type="text"></label>
                <label>描述<input v-model="importMeta.description" type="text"></label>
                <label>作者<input v-model="importMeta.author" type="text"></label>
                <label>标签<input v-model="importMeta.tags" type="text"></label>
              </div>
              <div class="settings-import-stats">
                <span>有效词条 {{ importReport.validCount }}</span>
                <span>重复 {{ importReport.duplicateCount }}</span>
                <span>过滤 {{ importReport.filteredCount }}</span>
              </div>
              <p v-if="importReport.validCount === 0" class="settings-import-error">未找到可练习的纯中文词条</p>
              <div class="settings-import-preview">
                <small v-for="entry in importReport.previewEntries" :key="entry.text">{{ entry.text }}</small>
              </div>
              <div v-if="Object.keys(importReport.filterReasons).length > 0" class="settings-import-reasons">
                <small v-for="(count, reason) in importReport.filterReasons" :key="reason">{{ reason }} {{ count }}</small>
              </div>
              <button
                type="button"
                class="settings-option"
                data-testid="settings-confirm-vocabulary-import"
                :disabled="!canConfirmImport"
                @click="confirmLocalImport"
              >
                确认导入
              </button>
            </template>
          </div>

          <div class="settings-row settings-project-row">
            <div>
              <span>GitHub</span>
              <strong>Shuangpin Cabin</strong>
              <p>项目源码、问题反馈和后续路线都放在这里。</p>
              <small>github.com/AnyAnq/shuangpin-cabin</small>
            </div>
            <a href="https://github.com/AnyAnq/shuangpin-cabin" target="_blank" rel="noreferrer">
              打开项目
              <ExternalLink />
            </a>
          </div>
        </section>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ExternalLink, Upload, X } from '@lucide/vue';
import type { PracticeModule } from '../../domain/practice/types';
import {
  createLocalVocabularyPackage,
  parseLocalVocabularyFile,
  type LocalVocabularyParseReport,
} from '../../domain/vocabulary';
import { usePracticeStore } from '../../stores/practiceStore';
import { installVocabularyPackage } from '../../storage/vocabularyRepository';

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'vocabulary-imported'): void;
}>();

const practice = usePracticeStore();
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

const moduleOptions: Array<{ label: string; value: PracticeModule }> = [
  { label: '诗词句子', value: 'poem' },
  { label: '绕口令', value: 'article' },
  { label: '词库练习', value: 'vocabulary' },
  { label: '易错练习', value: 'mistake' },
];

async function clearMistakes() {
  if (!window.confirm('确定清空错题记录吗？')) return;
  await practice.clearMistakeRecords();
}

async function clearSessions() {
  if (!window.confirm('确定清空练习记录吗？')) return;
  await practice.clearPracticeSessions();
}

async function clearVocabularies() {
  if (!window.confirm('确定清空已安装词库吗？')) return;
  await practice.clearInstalledVocabularies();
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
  await practice.refreshVocabularyPackages();
  importNotice.value = '已导入，可到词库页开始练习';
  importReport.value = null;
  emit('vocabulary-imported');
}
</script>
