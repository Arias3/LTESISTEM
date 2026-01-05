import { defineStore } from "pinia";
import { useCallStore } from "./call";

const API_URL = import.meta.env.VITE_API_URL;

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null as any
  }),

  getters: {
    isAuthenticated: (state) => !!state.user
  },

  actions: {
    setUser(user: any) {
      this.user = user;

      // 🔥 INICIALIZAR SOCKET AQUÍ
      const callStore = useCallStore();
      callStore.initSocket(user.id, user.name);
    },

    /* ================= CHECK SESSION ================= */
    async checkSession() {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include"
        });

        if (!res.ok) {
          this.user = null;
          return false;
        }

        this.user = await res.json();

        // 🔥 SI HAY SESIÓN, REINICIAR SOCKET
        const callStore = useCallStore();
        callStore.initSocket(this.user.id, this.user.name);

        return true;

      } catch {
        this.user = null;
        return false;
      }
    },

    /* ================= LOGOUT ================= */
    async logout() {
      try {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: "POST",
          credentials: "include"
        });
      } catch {}

      // 🔥 CERRAR SOCKET AL SALIR
      const callStore = useCallStore();
      callStore.disconnect();

      this.user = null;
    }
  }
});
