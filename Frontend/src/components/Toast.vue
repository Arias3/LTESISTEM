<template>
  <transition name="toast-slide">
    <div v-if="visible" class="toast" :class="type">
      <div class="glow"></div>
      <p>{{ message }}</p>
    </div>
  </transition>
</template>

<script setup>
import { ref, defineExpose } from "vue";

const visible = ref(false);
const message = ref("");
const type = ref("success");

function show(msg, t = "success", duration = 3000) {
  message.value = msg;
  type.value = t;
  visible.value = true;

  setTimeout(() => {
    visible.value = false;
  }, duration);
}

defineExpose({ show });
</script>

<style scoped>
.toast {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  padding: 16px 34px;

  border-radius: 18px;
  color: white;
  font-weight: 700;
  letter-spacing: .4px;

  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);

  border: 1px solid rgba(255,255,255,0.35);

  box-shadow:
    0px 25px 60px rgba(0,0,0,.4),
    inset 0px 1px 10px rgba(255,255,255,.2);

  overflow: hidden;
  z-index: 9999;
}

/* Verde cristal éxito */
.success {
  background: linear-gradient(
    to top right,
    rgba(20, 120, 68, 0.82),
    rgba(76, 220, 140, 0.55)
  );
}

/* Rojo cristal error */
.error {
  background: linear-gradient(
    to top right,
    rgba(145, 28, 34, 0.82),
    rgba(255, 99, 71, 0.55)
  );
}

/* Glow premium */
.glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at top left,
    rgba(255,255,255,0.32),
    transparent 45%
  );
  pointer-events: none;
}

/* Animación elegante superior */
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.45s cubic-bezier(.16,.99,.29,1);
}

.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, -25px) scale(.96);
}
</style>
