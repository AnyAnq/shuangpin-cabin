<template>
  <section class="virtual-keyboard" aria-label="双拼键盘">
    <div v-for="row in rows" :key="row.join('')" class="keyboard-row">
      <button
        v-for="key in row"
        :key="key"
        type="button"
        class="keyboard-key"
        :class="{ 'is-hot': key.toLowerCase() === activeKey, 'is-wrong': key.toLowerCase() === wrongKey }"
        :data-key="key.toLowerCase()"
      >
        <strong>{{ key }}</strong>
        <small>{{ labelFor(key.toLowerCase()) }}</small>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ShuangpinScheme } from '../../domain/schemes/types';

const props = defineProps<{
  scheme: ShuangpinScheme;
  activeKey: string | null;
  wrongKey: string | null;
}>();

const rows = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

function labelFor(key: string): string {
  const schemeKey = props.scheme.keys.find((item) => item.key === key);
  if (!schemeKey) return '';
  return schemeKey.finals.slice(0, 2).join('/');
}
</script>
