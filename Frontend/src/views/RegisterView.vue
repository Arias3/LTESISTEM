<template>
  <div class="login-container">
    <div class="background"></div>
    <div class="overlay"></div>

    <div class="card">
      <Toast ref="toastRef" />
      <h1 class="title">Crear Cuenta</h1>
      <p class="subtitle">Complete los datos</p>

      <!-- Nombre -->
      <div class="field">
        <label>Nombre</label>
        <input
          type="text"
          v-model="name"
          @input="name = name.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g, '')"
          placeholder="Tu nombre"
        />
        <p v-if="nameError" class="error">{{ nameError }}</p>
      </div>

      <!-- Usuario -->
      <div class="field">
        <label>Usuario</label>

        <input
          type="text"
          v-model="username"
          @input="handleUsername"
          placeholder="Crea un usuario"
          :class="{ errorInput: usernameValidationError || usernameExistError }"
        />

        <!-- Error de validación -->
        <p v-if="usernameValidationError" class="error">
          {{ usernameValidationError }}
        </p>

        <!-- Error del backend -->
        <p v-if="usernameExistError" class="error">
          {{ usernameExistError }}
        </p>
      </div>

      <!-- Contraseña -->
      <div class="field">
        <label>Contraseña</label>
        <input
          type="password"
          v-model="password"
          placeholder="Ingresa una contraseña"
        />
        <p v-if="passwordError" class="error">{{ passwordError }}</p>
      </div>

      <!-- Confirmar -->
      <div class="field">
        <label>Confirmar contraseña</label>
        <input
          type="password"
          v-model="confirmPassword"
          placeholder="Ingresa una contraseña"
        />
        <p v-if="confirmError" class="error">{{ confirmError }}</p>
      </div>

      <button class="btn login-btn" :disabled="!isValid" @click="register">
        Registrarse
      </button>

      <p class="register">
        ¿Ya tienes cuenta?
        <router-link to="/login">Ingresar</router-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import Toast from "../components/Toast.vue";
const router = useRouter();
const toastRef = ref();
const name = ref("");
const username = ref("");
const password = ref("");
const confirmPassword = ref("");

const API_URL = import.meta.env.VITE_API_URL;

// username igual q login
const handleUsername = () => {
  username.value = username.value.toLowerCase().replace(/[^a-z]/g, "");
  usernameExistError.value = ""; // 🔥 limpia error backend al escribir
};

const nameError = computed(() => {
  if (!name.value) return "El nombre es obligatorio";
  if (name.value.length < 2) return "Nombre demasiado corto";
  return "";
});

const usernameValidationError = computed(() => {
  if (!username.value) return "El usuario es obligatorio";
  if (!/^[a-z]+$/.test(username.value))
    return "Solo letras minúsculas sin números ni símbolos";
  return "";
});

// SOLO para backend
const usernameExistError = ref("");

const passwordError = computed(() => {
  if (!password.value) return "La contraseña es obligatoria";
  if (password.value.length < 6) return "Debe tener mínimo 6 caracteres";
  return "";
});

const confirmError = computed(() => {
  if (!confirmPassword.value) return "Debe confirmar la contraseña";
  if (confirmPassword.value !== password.value)
    return "Las contraseñas no coinciden";
  return "";
});

const isValid = computed(() => {
  return (
    !nameError.value &&
    !usernameValidationError.value &&
    !passwordError.value &&
    !confirmError.value
  );
});

const register = async () => {
  try {
    const res = await fetch(`${API_URL}/api/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.value,
        username: username.value,
        password: password.value,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.error?.includes("existe"))
        usernameExistError.value = "Este usuario ya está registrado";

      throw new Error(data.error);
    }
    toastRef.value.show("Usuario creado exitosamente", "success");

    // Pequeño delay para que se vea el mensaje
    setTimeout(() => {
      router.push("/login");
    }, 1200);
  } catch (err: any) {
    console.log(err);
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
.error-msg {
  margin-top: 6px;
  font-size: 13px;
  color: #ff4b4b;
  font-weight: 600;
}

.errorInput {
  border: 1.7px solid #ff4b4b !important;
  background: rgba(255, 0, 0, 0.08);
}
</style>
