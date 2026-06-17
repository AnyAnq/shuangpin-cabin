<template>
  <div class="segmented-control" aria-label="练习模块">
    <button class="segment" :class="{ 'is-active': practice.module === 'poem' }" type="button" :disabled="practice.isSwitching" :aria-current="practice.module === 'poem' ? 'page' : undefined" @click="setModule('poem')">
      诗词句子
    </button>
    <button class="segment" :class="{ 'is-active': practice.module === 'article' }" type="button" :disabled="practice.isSwitching" :aria-current="practice.module === 'article' ? 'page' : undefined" @click="setModule('article')">
      绕口令
    </button>
    <button class="segment" :class="{ 'is-active': practice.module === 'vocabulary' }" type="button" :disabled="practice.isSwitching" :aria-current="practice.module === 'vocabulary' ? 'page' : undefined" @click="setModule('vocabulary')">
      词库练习
    </button>
    <button class="segment" :class="{ 'is-active': practice.module === 'mistake' }" type="button" :disabled="practice.isSwitching" :aria-current="practice.module === 'mistake' ? 'page' : undefined" @click="setModule('mistake')">
      易错练习
    </button>
  </div>
</template>

<script setup lang="ts">
import { usePracticeStore } from '../../stores/practiceStore';
import type { PracticeModule } from '../../domain/practice/types';

const practice = usePracticeStore();

function setModule(module: PracticeModule) {
  if (practice.module === module) return;
  void practice.setModule(module);
}
</script>
