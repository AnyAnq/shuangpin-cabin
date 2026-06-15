<template>
  <div class="segmented-control" aria-label="双拼方案">
    <button class="segment" :class="{ 'is-green': practice.schemeId === 'xiaohe' }" type="button" :disabled="practice.isSwitching" @click="practice.setScheme('xiaohe')">
      小鹤双拼
    </button>
    <button class="segment" :class="{ 'is-green': practice.schemeId === 'ziranma' }" type="button" :disabled="practice.isSwitching" @click="practice.setScheme('ziranma')">
      自然码
    </button>
  </div>
</template>

<script setup lang="ts">
import { usePracticeStore } from '../../stores/practiceStore';

const practice = usePracticeStore();
</script>
