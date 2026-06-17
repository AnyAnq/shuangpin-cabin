<template>
  <div class="app-shell vocabulary-page">
    <FloatingSidebar />
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

      <section class="vocabulary-section">
        <div class="vocabulary-section-head">
          <span>已安装</span>
          <strong>{{ installedPackages.length }}</strong>
        </div>
        <div v-if="installedPackages.length === 0" class="vocabulary-installed-empty">
          还没有安装词库。安装一个免费词库后，首页的词库练习就会亮起来。
        </div>
        <div v-else class="vocabulary-grid">
          <article v-for="pack in installedPackages" :key="pack.id" class="vocabulary-card is-installed">
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

      <section class="vocabulary-section">
        <div class="vocabulary-section-head">
          <span>可安装词库</span>
          <strong>{{ registryPackages.length }}</strong>
        </div>
        <div class="vocabulary-grid">
          <article v-for="item in registryPackages" :key="item.id" class="vocabulary-card">
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
import type { VocabularyRegistryItem } from '../domain/vocabulary';
import { downloadVocabularyPackage, fetchVocabularyRegistry } from '../services/vocabularyRegistryService';
import { installVocabularyPackage, listInstalledVocabularyPackages, uninstallVocabularyPackage } from '../storage/vocabularyRepository';
import type { VocabularyPackageRecord } from '../storage/db';
import { usePracticeStore } from '../stores/practiceStore';

const router = useRouter();
const practice = usePracticeStore();
const registryPackages = ref<VocabularyRegistryItem[]>([]);
const installedPackages = ref<VocabularyPackageRecord[]>([]);
const registryError = ref('');
const loadingRegistry = ref(false);
const installingId = ref<string | null>(null);
const installedIds = computed(() => new Set(installedPackages.value.map((pack) => pack.id)));

onMounted(() => {
  void hydrate();
});

async function hydrate() {
  await refreshInstalled();
  await loadRegistry();
}

async function refreshInstalled() {
  installedPackages.value = await listInstalledVocabularyPackages();
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
    await installVocabularyPackage(result.packageFile, result.sourceUrl, item.checksum);
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

function installButtonText(item: VocabularyRegistryItem) {
  if (item.pricingType === 'paid') return '待解锁';
  if (installingId.value === item.id) return '安装中...';
  if (installedIds.value.has(item.id)) return '更新';
  return '安装';
}
</script>
