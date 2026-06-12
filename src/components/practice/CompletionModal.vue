<template>
  <div v-if="open" class="completion-modal" role="dialog" aria-modal="true">
    <section>
      <p>本轮完成</p>
      <strong>{{ accuracy }}%</strong>
      <span>准确率</span>
    </section>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean;
  accuracy: number;
}>();
</script>
