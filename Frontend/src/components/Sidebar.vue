<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useUIStore } from "../stores/ui";
import { useNotificationsStore } from "../stores/notifications";

/* ICONS (SVG COMPONENTS) */
import BellIcon from "../components/icons/BellIcon.vue";
import StatsIcon from "../components/icons/StatsIcon.vue";
import MessagesIcon from "../components/icons/MessagesIcon.vue";
import MapIcon from "../components/icons/MapIcon.vue";
import NetworkIcon from "../components/icons/NetworkIcon.vue";
import LogoutIcon from "../components/icons/LogoutIcon.vue";

import NotificationsPopup from "./NotificationPopup.vue";

interface MenuItem {
  name: string;
  route: string;
  icon: any;
}

const router = useRouter();
const route = useRoute();

const auth = useAuthStore();
const ui = useUIStore();
const notifications = useNotificationsStore();

onMounted(() => {
  notifications.fetchNotifications();
});

const logout = async () => {
  await auth.logout();
  router.push("/login");
};

const menuItems: MenuItem[] = [
  { name: "Estadísticas", route: "/dashboard/stats", icon: StatsIcon },
  { name: "Mensajes", route: "/dashboard/messages", icon: MessagesIcon },
  { name: "Ubicación", route: "/dashboard/geo", icon: MapIcon },
  { name: "Red", route: "/dashboard/network", icon: NetworkIcon }
];

const goTo = (routePath: string) => {
  if (route.path !== routePath) {
    router.push(routePath);
  }
};

const isActive = (routePath: string) => {
  return route.path.startsWith(routePath);
};
</script>

<template>
  <aside class="sidebar">
    <!-- TOP / NOTIFICATIONS -->
    <div class="sidebar-top">
      <button
        class="icon-btn"
        title="Notificaciones"
        @click="ui.toggleNotifications"
      >
        <BellIcon :active="notifications.hasUnread" />

        <span
          v-if="notifications.hasUnread"
          class="badge"
        >
          {{ notifications.unreadCount }}
        </span>
      </button>
    </div>

    <!-- CENTER / NAVIGATION -->
    <div class="sidebar-center">
      <button
        v-for="item in menuItems"
        :key="item.name"
        class="icon-btn"
        :class="{ active: isActive(item.route) }"
        :title="item.name"
        @click="goTo(item.route)"
      >
        <component :is="item.icon" />
      </button>
    </div>

    <!-- BOTTOM / LOGOUT -->
    <div class="sidebar-bottom">
      <button
        class="icon-btn logout"
        title="Cerrar sesión"
        @click="logout"
      >
        <LogoutIcon />
      </button>
    </div>

    <!-- POPUP -->
    <NotificationsPopup />
  </aside>
</template>

<style scoped>
.sidebar {
  position: relative;
  width: 72px;
  height: 100vh;
  background: linear-gradient(180deg, #0b2447, #081a33);
  display: flex;
  flex-direction: column;
  align-items: center;
  /* raise bottom content slightly and avoid OS gesture bar overlap */
  padding: 12px 0 calc(20px + env(safe-area-inset-bottom, 0px));
}

/* SECTIONS */
.sidebar-top {
  display: flex;
  justify-content: center;
}

.sidebar-bottom {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.sidebar-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
}

/* BUTTON */
.icon-btn {
  position: relative;
  color: bisque;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: scale(1.05);
}

.icon-btn:active {
  transform: scale(0.95);
}

/* ACTIVE ROUTE */
.icon-btn.active {
  background: rgba(255, 255, 255, 0.18);
}

/* LOGOUT */
.logout:hover {
  background: rgba(255, 80, 80, 0.15);
}

/* NOTIFICATION BADGE */
.badge {
  position: absolute;
  top: 6px;
  right: 6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: #ff3b30;
  color: #ffffff;
  font-size: 10px;
  font-weight: 600;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
