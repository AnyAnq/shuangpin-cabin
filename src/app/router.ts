import { createRouter, createWebHistory } from 'vue-router';
import PracticeView from '../views/PracticeView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', name: 'practice', component: PracticeView }],
});
