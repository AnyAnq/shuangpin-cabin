<template>
  <div class="app-shell vocabulary-page">
    <FloatingSidebar />
    <main class="vocabulary-main">
      <section class="vocabulary-hero">
        <span>管理员</span>
        <h1>赞助审核</h1>
        <p>核对微信或支付宝到账后，确认达标赞助并生成一次性兑换码；未达标但有效的支持可标记为普通赞助。</p>
        <button type="button" class="soft-pill" @click="loadClaims">刷新</button>
      </section>

      <p v-if="error" class="vocabulary-error">{{ error }}</p>
      <form v-if="needsLogin" class="admin-login-form" @submit.prevent="login">
        <label>
          管理员密码
          <input
            v-model="adminPassword"
            type="password"
            data-testid="admin-password-input"
            autocomplete="current-password"
            placeholder="输入管理员密码"
          >
        </label>
        <button type="submit" class="primary-action" :disabled="loggingIn">
          {{ loggingIn ? '登录中...' : '进入后台' }}
        </button>
        <small v-if="loginError">{{ loginError }}</small>
      </form>
      <p v-if="latestRedeemCode" class="admin-redeem-code" data-testid="latest-redeem-code">
        兑换码：<strong>{{ latestRedeemCode }}</strong>
      </p>

      <section class="vocabulary-section">
        <div class="vocabulary-section-head">
          <span>待处理赞助</span>
          <strong>{{ claims.length }}</strong>
        </div>
        <div v-if="claims.length === 0" class="vocabulary-installed-empty">暂无待处理赞助记录。</div>
        <div v-else class="admin-claim-list">
          <article v-for="claim in claims" :key="claim.id" class="admin-claim-card">
            <div>
              <strong>{{ claim.email }}</strong>
              <small>{{ claimMetaText(claim) }}</small>
              <p>{{ claim.note || '无备注' }}</p>
            </div>
            <div class="admin-claim-actions">
              <button type="button" class="primary-action" @click="review(claim.id, 'approve')">生成兑换码</button>
              <button type="button" class="ghost-action" @click="review(claim.id, 'thanks-only')">普通赞助</button>
              <button type="button" class="ghost-action" @click="review(claim.id, 'reject')">驳回</button>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import FloatingSidebar from '../components/layout/FloatingSidebar.vue';
import { fetchSponsorClaims, loginAdmin, reviewSponsorClaim, type SponsorClaimRecord } from '../services/adminSponsorService';

const claims = ref<SponsorClaimRecord[]>([]);
const error = ref('');
const latestRedeemCode = ref('');
const needsLogin = ref(false);
const adminPassword = ref('');
const loggingIn = ref(false);
const loginError = ref('');

onMounted(() => {
  void loadClaims();
});

async function loadClaims() {
  error.value = '';
  try {
    claims.value = await fetchSponsorClaims('pending');
    needsLogin.value = false;
  } catch {
    needsLogin.value = true;
    error.value = '无法加载赞助记录，请确认当前账号具有管理员权限。';
  }
}

async function login() {
  loggingIn.value = true;
  loginError.value = '';
  try {
    await loginAdmin(adminPassword.value);
    adminPassword.value = '';
    await loadClaims();
  } catch {
    loginError.value = '管理员密码不正确或后台未配置密码。';
  } finally {
    loggingIn.value = false;
  }
}

async function review(id: string, action: 'approve' | 'thanks-only' | 'reject') {
  try {
    const result = await reviewSponsorClaim(id, action);
    if (result.redeemCode) latestRedeemCode.value = result.redeemCode;
    await loadClaims();
  } catch {
    error.value = '审核失败，请稍后重试。';
  }
}

function claimMetaText(claim: SponsorClaimRecord) {
  if (claim.note.includes('用户仅提交邮箱和付款时间')) {
    return `微信/支付宝 · 待核对 · ${claim.sponsored_at}`;
  }
  return `${claim.channel === 'wechat' ? '微信' : '支付宝'} · ${claim.amount_cny} 元 · ${claim.sponsored_at}`;
}
</script>
