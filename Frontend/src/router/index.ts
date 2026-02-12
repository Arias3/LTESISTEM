import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

import LoginView from "../views/LoginView.vue";
import RegisterView from "../views/RegisterView.vue";
import DashboardView from "../views/DashboardView.vue";

import StatsView from "../views/StatsView.vue";
import MessagesView from "../views/MessagesView.vue";
import PersonalView from "../views/PersonalView.vue";
import NetworkView from "../views/NetworkView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/login" },

    { path: "/login", component: LoginView },
    { path: "/register", component: RegisterView },

    {
      path: "/dashboard",
      component: DashboardView,
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          redirect: "/dashboard/stats" // 👈 clave
        },
        {
          path: "stats",
          name: "stats",
          component: StatsView
        },
        {
          path: "messages",
          name: "messages",
          component: MessagesView
        },
        {
          path: "personal",
          name: "personal",
          component: PersonalView
        },
        {
          path: "network",
          name: "network",
          component: NetworkView
        }
      ]
    }
  ]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (to.meta.requiresAuth) {
    await auth.checkAuth();
    if (!auth.isAuthenticated) return "/login";
  }
});

export default router;
