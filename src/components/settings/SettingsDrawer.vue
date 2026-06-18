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

        <section class="settings-section settings-about">
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
        </section>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ExternalLink, X } from '@lucide/vue';
import type { PracticeModule } from '../../domain/practice/types';
import { usePracticeStore } from '../../stores/practiceStore';

defineProps<{
  open: boolean;
}>();

defineEmits<{
  (event: 'close'): void;
}>();

const practice = usePracticeStore();

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
</script>
