<template>
  <div class="segmented-control" aria-label="练习模块">
    <button class="segment" :class="{ 'is-active': practice.module === 'poem' }" type="button" @click="practice.setModule('poem')">
      诗词句子
    </button>
    <button class="segment" :class="{ 'is-active': practice.module === 'article' }" type="button" @click="practice.setModule('article')">
      绕口令
    </button>
    <button class="segment" :class="{ 'is-active': practice.module === 'mistake' }" type="button" @click="practice.setModule('mistake')">
      易错练习
    </button>
  </div>
</template>

<script setup lang="ts">
import { usePracticeStore } from '../../stores/practiceStore';

const practice = usePracticeStore();
</script>
