<template>
  <div class="app-shell vocabulary-page">
    <FloatingSidebar />
    <main class="vocabulary-main">
      <section class="vocabulary-hero">
        <span>管理员</span>
        <h1>赞助审核</h1>
        <p>核对微信或支付宝到账后，确认达标赞助并生成兑换码；每个兑换码最多可使用 3 次，已批准记录会保留邮箱和发放的兑换码。</p>
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
          <span>赞助记录</span>
          <strong>{{ claims.length }}</strong>
        </div>
        <div v-if="claims.length === 0" class="vocabulary-installed-empty">暂无赞助记录。</div>
        <div v-else class="admin-claim-list">
          <article v-for="claim in claims" :key="claim.id" class="admin-claim-card">
            <div>
              <strong>{{ claim.email }}</strong>
              <small>{{ claimMetaText(claim) }}</small>
              <p>{{ claim.note || '无备注' }}</p>
              <p v-if="claim.redeem_code" class="admin-code-line">
                兑换码：<strong>{{ claim.redeem_code }}</strong>
                <span>{{ redeemUsageText(claim) }}</span>
              </p>
            </div>
            <div v-if="claim.status === 'pending'" class="admin-claim-actions">
              <button type="button" class="primary-action" @click="review(claim.id, 'approve')">生成兑换码</button>
              <button type="button" class="ghost-action" @click="review(claim.id, 'thanks-only')">普通赞助</button>
              <button type="button" class="ghost-action" @click="review(claim.id, 'reject')">驳回</button>
            </div>
            <span v-else class="admin-status-pill">{{ statusText(claim) }}</span>
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
    claims.value = await fetchSponsorClaims('');
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

function redeemUsageText(claim: SponsorClaimRecord) {
  const used = claim.redemption_count ?? 0;
  const total = claim.max_redemptions ?? 3;
  return `已使用 ${used} / ${total} 次`;
}

function statusText(claim: SponsorClaimRecord) {
  if (claim.status === 'approved') {
    return claim.redeem_status === 'redeemed' ? '已用完' : '已批准';
  }
  if (claim.status === 'thanks_only') return '普通赞助';
  return '已驳回';
}
</script>
