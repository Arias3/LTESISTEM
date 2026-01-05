<template>
  <div class="login-container">
    <div class="background"></div>
    <div class="overlay"></div>

    <div class="card">
      <h1 class="title">Bienvenido</h1>
      <p class="subtitle">Inicia sesión para continuar</p>

      <!-- Usuario -->
      <div class="field">
        <label>Usuario</label>
        <input
          type="text"
          v-model="username"
          @input="handleUsername"
          placeholder="Ingresa tu usuario"
        />

        <p v-if="usernameError" class="error">{{ usernameError }}</p>
      </div>

      <!-- Contraseña -->
      <div class="field">
        <label>Contraseña</label>
        <input
          type="password"
          v-model="password"
          placeholder="Ingresa tu contraseña"
        />

        <p v-if="passwordError" class="error">{{ passwordError }}</p>
      </div>

      <p v-if="loginError" class="error">{{ loginError }}</p>
      <button class="btn login-btn" :disabled="!isValid" @click="pressIngresar">
        Ingresar
      </button>

      <p class="register">
        ¿No tienes cuenta?
        <router-link to="/register">Regístrate aquí</router-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const API_URL = import.meta.env.VITE_API_URL;

const auth = useAuthStore();
const router = useRouter();
const loginError = ref("");
const username = ref("");
const password = ref("");

// solo letras minúsculas
const handleUsername = () => {
  username.value = username.value.toLowerCase().replace(/[^a-z]/g, ""); // elimina números y raros
};

const usernameError = computed(() => {
  if (!username.value) return "El usuario es obligatorio";
  if (!/^[a-z]+$/.test(username.value))
    return "Solo letras minúsculas sin números ni símbolos";
  return "";
});

const passwordError = computed(() => {
  if (!password.value) return "La contraseña es obligatoria";
  if (password.value.length < 6) return "Debe tener mínimo 6 caracteres";
  return "";
});

const isValid = computed(() => {
  return !usernameError.value && !passwordError.value;
});

const pressIngresar = async () => {
  loginError.value = "";

  if (!isValid.value) return;

  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        username: username.value,
        password: password.value,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      loginError.value = data.error || "Error al iniciar sesión";
      return;
    }

    // Guarda usuario en el store
    auth.setUser(data.user);

    // Redirigir
    setTimeout(() => {
      router.push("/dashboard");
    }, 300);

  } catch (err: any) {
    console.error(err);
    loginError.value = "No se pudo conectar al servidor";
  }
};
</script>

<style scoped>
/* (MISMO CSS DEL LOGIN ANTERIOR, NO LO CAMBIÉ) */
.login-container {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;

  display: flex;
  justify-content: center;
  align-items: center;

  font-family: sans-serif;
}

.error {
  margin-top: 6px;
  font-size: 13px;
  color: #ff4b4b;
  font-weight: 600;
}

.background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: url("/img/planta.jpg") no-repeat center center;
  background-size: cover;
  z-index: -2;
}

.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: -1;
}

.card {
  width: 95%;
  max-width: 420px;

  background: rgba(255, 255, 255, 0.13);
  border-radius: 18px;
  padding: 26px;

  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.25);

  color: white;
  text-align: center;

  box-shadow: 0 25px 40px rgba(0, 0, 0, 0.4);
}

.title {
  margin: 0;
  font-size: 26px;
  font-weight: bold;
}

.subtitle {
  margin-top: 4px;
  opacity: 0.8;
  font-size: 14px;
}

.field {
  text-align: left;
  margin-top: 18px;
  padding-inline: 4px;
}

.field input {
  width: 100%;
  box-sizing: border-box;
  margin-top: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  border: none;
  outline: none;
  background: rgba(255, 255, 255, 0.95);
}

.btn {
  width: 100%;
  margin-top: 18px;
  padding: 10px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 15px;
  font-weight: bold;
}

.login-btn {
  background: #1a73e8;
  color: white;
}

.login-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.register {
  margin-top: 12px;
  font-size: 13px;
}

.register a {
  color: #fff;
  font-weight: bold;
  text-decoration: underline;
}

.error {
  margin-top: 4px;
  color: #ffb3b3;
  font-size: 12px;
}
</style>
