// stores/ui.ts
import { defineStore } from "pinia";

export const useUIStore = defineStore("ui", {
  state: () => ({
    showNotifications: false
  }),
  actions: {
    toggleNotifications() {
      this.showNotifications = !this.showNotifications;
    },
    closeNotifications() {
      this.showNotifications = false;
    }
  }
});
