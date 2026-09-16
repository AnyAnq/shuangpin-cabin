import { createRouter, createWebHistory } from 'vue-router';
import PracticeView from '../views/PracticeView.vue';
import LessonsView from '../views/LessonsView.vue';
import RecordsView from '../views/RecordsView.vue';
import VocabulariesView from '../views/VocabulariesView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'practice', component: PracticeView },
    { path: '/keymap', redirect: { name: 'practice' } },
    { path: '/lessons', name: 'lessons', component: LessonsView },
    { path: '/records', name: 'records', component: RecordsView },
    { path: '/vocabularies', name: 'vocabularies', component: VocabulariesView },
  ],
});
