const routes = [
  { path: '/login', component: () => import('pages/LoginPage.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('pages/IndexPage.vue') },
      { path: 'historico', component: () => import('pages/HistoricoGeralPage.vue') },
      { path: 'dashboard', component: () => import('pages/DashboardPage.vue') }
    ]
  },
  // ── PWA Campo (sem autenticação Supabase) ─────────────────────
  { path: '/campo', component: () => import('pages/CampoLoginPage.vue'), meta: { public: true } },
  { path: '/campo/registro', component: () => import('pages/CampoPage.vue'), meta: { public: true } },
  { path: '/:catchAll(.*)*', redirect: '/' }
]

export default routes
