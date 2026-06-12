<template>
  <AppShell />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import AppShell from '../components/layout/AppShell.vue';
import { usePracticeStore } from '../stores/practiceStore';

const practice = usePracticeStore();
let wrongTimer: number | undefined;

function onKeydown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const result = practice.pressKey(event.key);
  if (result.status === 'wrong') {
    window.clearTimeout(wrongTimer);
    wrongTimer = window.setTimeout(() => practice.clearWrongKey(), 180);
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.clearTimeout(wrongTimer);
});
</script>
