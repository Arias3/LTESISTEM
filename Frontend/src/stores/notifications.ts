import { defineStore } from "pinia";

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export const useNotificationsStore = defineStore("notifications", {
  state: () => ({
    notifications: [] as Notification[],
    isLoading: false
  }),

  getters: {
    unreadCount: (state) =>
      state.notifications.filter(n => !n.read).length,

    hasUnread(): boolean {
      return this.unreadCount > 0;
    },

    sortedNotifications: (state) => {
      return [...state.notifications].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );
    }
  },

  actions: {
    /**
     * Simula carga desde backend
     * Luego puedes reemplazar por fetch/axios
     */
    async fetchNotifications() {
      this.isLoading = true;

      try {
        // MOCK — reemplazar por API real
        await new Promise(res => setTimeout(res, 500));

        this.notifications = [
          {
            id: "1",
            title: "Nueva alerta",
            message: "Se detectó actividad inusual",
            read: false,
            createdAt: new Date().toISOString()
          },
          {
            id: "2",
            title: "Mensaje recibido",
            message: "Tienes un nuevo mensaje",
            read: true,
            createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString()
          }
        ];
      } finally {
        this.isLoading = false;
      }
    },

    markAsRead(id: string) {
      const notif = this.notifications.find(n => n.id === id);
      if (notif) notif.read = true;
    },

    markAllAsRead() {
      this.notifications.forEach(n => (n.read = true));
    },

    addNotification(notification: Notification) {
      this.notifications.unshift(notification);
    },

    clearNotifications() {
      this.notifications = [];
    }
  }
});
