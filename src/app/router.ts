import { createRouter, createWebHistory } from 'vue-router';
import PracticeView from '../views/PracticeView.vue';
import RecordsView from '../views/RecordsView.vue';
import AdminSponsorView from '../views/AdminSponsorView.vue';
import VocabulariesView from '../views/VocabulariesView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'practice', component: PracticeView },
    { path: '/keymap', redirect: { name: 'practice' } },
    { path: '/records', name: 'records', component: RecordsView },
    { path: '/vocabularies', name: 'vocabularies', component: VocabulariesView },
    { path: '/admin/sponsors', name: 'admin-sponsors', component: AdminSponsorView },
  ],
});
