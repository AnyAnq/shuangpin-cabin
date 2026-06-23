<template>
  <div class="app-shell vocabulary-page">
    <FloatingSidebar @open-settings="settingsOpen = true" />
    <SettingsDrawer :open="settingsOpen" @close="settingsOpen = false" @vocabulary-imported="refreshInstalled" />
    <main class="vocabulary-main">
      <section class="vocabulary-hero">
        <span>词库中心</span>
        <h1>安装词库后开始练习</h1>
        <p>词库从外部仓库下载安装到浏览器本地，练习时只读取已安装内容。</p>
        <div class="membership-strip" data-testid="membership-status">
          <strong>{{ membershipStatusText }}</strong>
          <small>赞助满 {{ sponsorThreshold }} 元，可获赠永久会员兑换码；付款时备注邮箱，管理员核对后发码。每个兑换码最多可兑换 3 次，兑换后当前浏览器永久有效。</small>
        </div>
        <button type="button" class="soft-pill" :disabled="loadingRegistry" @click="loadRegistry">
          {{ loadingRegistry ? '刷新中...' : '刷新词库' }}
        </button>
      </section>

      <p v-if="registryError" class="vocabulary-error">{{ registryError }}</p>

      <section class="vocabulary-section" data-testid="local-vocabulary-section">
        <div class="vocabulary-section-head">
          <span>本地词库</span>
          <strong>{{ localPackages.length }}</strong>
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
            <span>{{ registryBadgeText(item) }}</span>
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
              v-if="item.pricingType === 'paid' && !hasMemberAccess"
              type="button"
              class="primary-action sponsor-action"
              :data-testid="`sponsor-vocabulary-${item.id}`"
              @click="openSponsorDialog(item)"
            >
              赞助支持
            </button>
            <button
              v-else
              type="button"
              class="primary-action"
              :data-testid="`install-vocabulary-${item.id}`"
              :disabled="installingId === item.id"
              @click="installPackage(item)"
            >
              {{ installButtonText(item) }}
            </button>
          </article>
        </div>
      </section>
    </main>

    <div v-if="sponsorDialogOpen" class="modal-backdrop" data-testid="sponsor-dialog">
      <section class="sponsor-dialog" role="dialog" aria-modal="true" aria-label="赞助项目">
        <button type="button" class="dialog-close" aria-label="关闭赞助弹窗" @click="sponsorDialogOpen = false">×</button>
        <span>赞助项目</span>
        <h2>赞助项目，获赠永久会员</h2>
        <p>赞助满 {{ sponsorThreshold }} 元，可获赠永久会员兑换码。付款时请在微信或支付宝备注邮箱，管理员核对到账后发送兑换码。</p>
        <div class="sponsor-qr-grid">
          <div>
            <strong>微信赞助</strong>
            <img v-if="wechatSponsorQr" :src="wechatSponsorQr" alt="微信赞助二维码">
            <small v-else>请配置 VITE_WECHAT_SPONSOR_QR_IMAGE_URL</small>
          </div>
          <div>
            <strong>支付宝赞助</strong>
            <img v-if="alipaySponsorQr" :src="alipaySponsorQr" alt="支付宝赞助二维码">
            <small v-else>请配置 VITE_ALIPAY_SPONSOR_QR_IMAGE_URL</small>
          </div>
        </div>
        <form class="sponsor-form" @submit.prevent="submitSponsor">
          <label>
            邮箱
            <input v-model.trim="sponsorForm.email" type="email" placeholder="付款备注中的邮箱" required>
          </label>
          <label>
            付款时间
            <input v-model="sponsorForm.sponsoredAt" type="datetime-local" required>
          </label>
          <button type="submit" class="primary-action" data-testid="submit-sponsor-claim" :disabled="submittingSponsor">
            {{ submittingSponsor ? '提交中...' : '提交信息' }}
          </button>
        </form>
        <p v-if="sponsorNotice" class="sponsor-notice">{{ sponsorNotice }}</p>
        <form class="redeem-form" @submit.prevent="redeemCode">
          <label>
            兑换码
            <input v-model.trim="redeemCodeInput" type="text" placeholder="输入管理员发给你的兑换码" required>
          </label>
          <button type="submit" class="primary-action" data-testid="redeem-membership-code" :disabled="redeemingCode">
            {{ redeemingCode ? '兑换中...' : '兑换永久会员' }}
          </button>
        </form>
        <p v-if="redeemNotice" class="sponsor-notice">{{ redeemNotice }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import FloatingSidebar from '../components/layout/FloatingSidebar.vue';
import SettingsDrawer from '../components/settings/SettingsDrawer.vue';
import { createVocabularyExportFile, type VocabularyEntry, type VocabularyRegistryItem } from '../domain/vocabulary';
import { defaultMembershipState, fetchMembershipState, hasStoredMembershipToken, redeemMembershipCode, submitSponsorClaim, type MembershipState } from '../services/membershipService';
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
const membership = ref<MembershipState>(defaultMembershipState);
const sponsorDialogOpen = ref(false);
const submittingSponsor = ref(false);
const sponsorNotice = ref('');
const redeemingCode = ref(false);
const redeemNotice = ref('');
const redeemCodeInput = ref('');
const membershipTokenPresent = ref(hasStoredMembershipToken());
const sponsorThreshold = Number(import.meta.env.VITE_MEMBERSHIP_SPONSOR_THRESHOLD_CNY ?? 10);
const wechatSponsorQr = import.meta.env.VITE_WECHAT_SPONSOR_QR_IMAGE_URL ?? '/sponsor/wechat.png';
const alipaySponsorQr = import.meta.env.VITE_ALIPAY_SPONSOR_QR_IMAGE_URL ?? '/sponsor/alipay.jpg';
const sponsorForm = ref({
  email: '',
  sponsoredAt: toDatetimeLocal(new Date()),
});
const installedIds = computed(() => new Set(installedPackages.value.map((pack) => pack.id)));
const hasMemberAccess = computed(() => membership.value.membership.lifetime || membershipTokenPresent.value);
const membershipStatusText = computed(() => {
  if (hasMemberAccess.value) return '永久会员已开通';
  return '可用兑换码解锁词库服务';
});

onMounted(() => {
  void hydrate();
});

async function hydrate() {
  await refreshMembership();
  await refreshInstalled();
  await loadRegistry();
}

async function refreshMembership() {
  membership.value = await fetchMembershipState();
  membershipTokenPresent.value = hasStoredMembershipToken();
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
  if (item.pricingType === 'paid' && !hasMemberAccess.value) {
    openSponsorDialog(item);
    return;
  }
  installingId.value = item.id;
  try {
    const result = await downloadVocabularyPackage(item.downloadUrl, item.mirrorUrls);
    await installVocabularyPackage(result.packageFile, result.sourceUrl, { checksum: item.checksum });
    await refreshInstalled();
  } finally {
    installingId.value = null;
  }
}

function openSponsorDialog(item: VocabularyRegistryItem) {
  sponsorNotice.value = '';
  redeemNotice.value = '';
  sponsorForm.value.sponsoredAt = toDatetimeLocal(new Date());
  sponsorDialogOpen.value = true;
  void item;
}

async function submitSponsor() {
  submittingSponsor.value = true;
  sponsorNotice.value = '';
  try {
    await submitSponsorClaim({
      channel: 'wechat',
      amountCny: sponsorThreshold,
      sponsoredAt: new Date(sponsorForm.value.sponsoredAt).toISOString(),
      note: '用户仅提交邮箱和付款时间，请按微信或支付宝账单核对。',
      email: sponsorForm.value.email,
    });
    sponsorNotice.value = '已提交信息，管理员核对到账后会发送兑换码。';
  } catch {
    sponsorNotice.value = '提交失败，请检查邮箱和时间后重试。';
  } finally {
    submittingSponsor.value = false;
  }
}

async function redeemCode() {
  redeemingCode.value = true;
  redeemNotice.value = '';
  try {
    await redeemMembershipCode(redeemCodeInput.value);
    membershipTokenPresent.value = true;
    redeemNotice.value = '兑换成功，当前浏览器已解锁永久会员。';
  } catch {
    redeemNotice.value = '兑换失败，请检查兑换码是否正确，或是否已达到 3 次使用上限。';
  } finally {
    redeemingCode.value = false;
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
  if (installingId.value === item.id) return '安装中...';
  if (installedIds.value.has(item.id)) return '更新';
  return '安装';
}

function registryBadgeText(item: VocabularyRegistryItem) {
  if (installedIds.value.has(item.id)) return '已安装';
  if (item.pricingType === 'paid') return hasMemberAccess.value ? '会员权益' : '赞助权益';
  return '免费';
}

function toDatetimeLocal(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
</script>
