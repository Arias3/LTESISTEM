<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { useAuthStore } from "../stores/auth";
import { useCallStore } from "../stores/call";
import PhoneIcon from "../components/icons/PhoneIcon.vue";
import VideoIcon from "../components/icons/VideoIcon.vue";
const API_URL = import.meta.env.VITE_API_URL;

/* ================= TYPES ================= */

interface User {
  id: string;
  name: string;
  username: string;
  role: string;
  createdAt: string;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  user: User;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    receiverId: string;
    createdAt: string;
  };
}

/* ================= STATE ================= */

const auth = useAuthStore();
const contacts = ref<User[]>([]);
const conversations = ref<Conversation[]>([]);
const search = ref("");
const selectedContact = ref<User | null>(null);
const messages = ref<Message[]>([]);
const loadingMessages = ref(false);
const newMessage = ref("");
const sending = ref(false);
const isKeyboardVisible = ref(false);
const keyboardHeight = ref(0);

/* ================= COMPUTED ================= */

const isSearching = computed(() => search.value.trim().length > 0);

const filteredContacts = computed(() => {
  if (!isSearching.value) return [];

  const term = search.value.toLowerCase();

  return contacts.value.filter(
    (u) =>
      u.name.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term),
  );
});

/* ================= LOAD DATA ================= */

async function loadContacts() {
  const res = await fetch(`${API_URL}/api/auth`, {
    credentials: "include",
    headers: auth.getAuthHeaders() as Record<string, string>,
  });
  if (res.ok) {
    const users: User[] = await res.json();
    contacts.value = users.filter((u) => u.id !== auth.user.id);
  }
}

async function loadConversations() {
  const res = await fetch(`${API_URL}/api/chat/conversations`, {
    credentials: "include",
    headers: auth.getAuthHeaders() as Record<string, string>,
  });
  if (res.ok) {
    conversations.value = await res.json();
  }
}

onMounted(async () => {
  await Promise.all([loadContacts(), loadConversations()]);
});

/* ================= CHAT ================= */
async function sendMessage() {
  if (!selectedContact.value || !newMessage.value.trim()) return;

  sending.value = true;

  try {
    const res = await fetch(`${API_URL}/api/chat/send`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...auth.getAuthHeaders(),
      } as Record<string, string>,
      body: JSON.stringify({
        receiverId: selectedContact.value.id,
        content: newMessage.value,
      }),
    });

    if (res.ok) {
      const msg: Message = await res.json();
      messages.value.push(msg);
      newMessage.value = "";
      await loadConversations(); // refresca preview
    }
  } finally {
    sending.value = false;
  }
}

function formatMessageTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();

  // Hoy
  const isToday = date.toDateString() === now.toDateString();

  // Ayer
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  } else if (isYesterday) {
    return "Ayer";
  } else {
    return `${date.getDate().toString().padStart(2, "0")}/${(
      date.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}/${date.getFullYear()}`;
  }
}
/* ================= POLLING ================= */
let pollingTimer: ReturnType<typeof setInterval> | null = null;

async function loadNewMessages() {
  if (!selectedContact.value) return;

  // Último mensaje cargado
  const lastMsg = messages.value[messages.value.length - 1];
  const after = lastMsg ? lastMsg.createdAt : undefined;

  const query = after ? `?after=${encodeURIComponent(after)}` : "";
  const res = await fetch(
    `${API_URL}/api/chat/conversation/${selectedContact.value.id}${query}`,
    {
      credentials: "include",
      headers: auth.getAuthHeaders() as Record<string, string>,
    },
  );

  if (res.ok) {
    const newMsgs: Message[] = await res.json();

    if (newMsgs.length) {
      const existingIds = new Set(messages.value.map((m) => m.id));

      const onlyNew = newMsgs.filter((m) => !existingIds.has(m.id));

      if (onlyNew.length) {
        messages.value.push(...onlyNew);

        // actualizar conversación
        const last = onlyNew[onlyNew.length - 1];
        const conv = conversations.value.find(
          (c) => c.user.id === selectedContact.value?.id,
        );
        if (conv && last) {
          conv.lastMessage = last;
        }
      }
    }
  }
}

// Abrir chat y activar polling
async function openChat(user: User) {
  selectedContact.value = user;
  search.value = "";
  messages.value = [];
  loadingMessages.value = true;

  try {
    await loadNewMessages(); // carga inicial
  } finally {
    loadingMessages.value = false;
  }

  // Limpiar timer anterior si existía
  if (pollingTimer) clearInterval(pollingTimer);

  // Iniciar nuevo polling cada 3 segundos
  pollingTimer = setInterval(loadNewMessages, 3000);

  // Agregar listeners del teclado
  addKeyboardListeners();

  // Scroll al final después de cargar mensajes
  nextTick(() => {
    scrollToBottom();
  });
}

// Cerrar chat y detener polling
function closeChat() {
  selectedContact.value = null;

  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }

  // Remover listeners del teclado
  removeKeyboardListeners();
}

function switchChat(user: User) {
  // Limpiar chat anterior y timer
  if (pollingTimer) clearInterval(pollingTimer);
  selectedContact.value = null;
  closeChat(); // limpia chat y timer
  // Abrir nuevo chat
  openChat(user);
}

// Limpiar polling automáticamente al desmontar componente
onUnmounted(() => {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  removeKeyboardListeners();
});

// ================= KEYBOARD HANDLING ================= */
function addKeyboardListeners() {
  if (typeof window === "undefined") return;

  const viewport = window.visualViewport;

  if (viewport) {
    viewport.addEventListener("resize", handleVisualViewportResize);
  } else {
    window.addEventListener("resize", handleWindowResize);
  }
}

function removeKeyboardListeners() {
  if (typeof window === "undefined") return;

  const viewport = window.visualViewport;

  if (viewport) {
    viewport.removeEventListener("resize", handleVisualViewportResize);
  } else {
    window.removeEventListener("resize", handleWindowResize);
  }
}

function handleVisualViewportResize() {
  if (!window.visualViewport) return;

  const viewport = window.visualViewport;
  const heightDiff = window.innerHeight - viewport.height;

  if (heightDiff > 150) {
    // Teclado visible
    isKeyboardVisible.value = true;
    keyboardHeight.value = heightDiff;
    scrollToBottom();
  } else {
    isKeyboardVisible.value = false;
    keyboardHeight.value = 0;
  }
}

function handleWindowResize() {
  // Fallback simple
  setTimeout(() => {
    scrollToBottom();
  }, 300);
}

function scrollToBottom() {
  nextTick(() => {
    const chatBody = document.querySelector(".chat-body") as HTMLElement;
    if (chatBody) {
      chatBody.scrollTop = chatBody.scrollHeight;
    }
  });
}

// ================= CALLS ================= */
const call = useCallStore();

const canCall = computed(() => call.state === "idle");
const isCalling = computed(() => call.state === "calling");

const startAudioCall = () => {
  if (!canCall.value || !selectedContact.value) return;

  call.startCall(
    {
      id: selectedContact.value.id,
      name: selectedContact.value.name,
    },
    "audio",
  );
};

const startVideoCall = () => {
  if (!canCall.value || !selectedContact.value) return;

  call.startCall(
    {
      id: selectedContact.value.id,
      name: selectedContact.value.name,
    },
    "video",
  );
};
</script>

<template>
  <div class="chat-layout">
    <!-- LEFT / LISTA DE CHATS -->
    <aside class="chat-list" :class="{ hide: selectedContact }">
      <input class="search" placeholder="Buscar contacto" v-model="search" />

      <!-- CONVERSACIONES -->
      <div v-if="!isSearching">
        <div
          v-for="conv in conversations"
          :key="conv.user.id"
          class="chat-item"
          :class="{ active: selectedContact?.id === conv.user.id }"
          @click="switchChat(conv.user)"
        >
          <div class="avatar"></div>
          <div class="chat-info">
            <div class="chat-name">{{ conv.user.name }}</div>
            <div class="chat-last">
              {{ conv.lastMessage?.content || "No messages yet" }}
            </div>
          </div>
          <div class="chat-time">
            {{
              conv.lastMessage
                ? formatMessageTime(conv.lastMessage.createdAt)
                : ""
            }}
          </div>
        </div>
      </div>

      <!-- RESULTADOS DE BÚSQUEDA -->
      <div v-else>
        <div
          v-for="user in filteredContacts"
          :key="user.id"
          class="chat-item"
          :class="{ active: selectedContact?.id === user.id }"
          @click="switchChat(user)"
        >
          <div class="avatar"></div>
          <div class="chat-info">
            <div class="chat-name">{{ user.name }}</div>
            <div class="chat-last">@{{ user.username }}</div>
          </div>
        </div>
        <div v-if="filteredContacts.length === 0" class="chat-empty">
          No se encontraron usuarios
        </div>
      </div>
    </aside>

    <!-- RIGHT / VENTANA DE CHAT -->
    <section
      v-if="selectedContact"
      class="chat-window"
      :class="{ show: selectedContact }"
    >
      <header class="chat-header">
        <!-- Botón de volver -->
        <button @click="selectedContact = null" class="back-btn">←</button>

        <!-- Info del contacto -->
        <div class="chat-info">
          <div class="chat-title">{{ selectedContact?.name }}</div>
          <div class="chat-status">@{{ selectedContact?.username }}</div>
        </div>

        <!-- Botones de llamada a la derecha -->
        <div class="call-actions">
          <button
            v-if="selectedContact"
            class="call-btn audio"
            :class="{ active: isCalling }"
            :disabled="!canCall"
            @click="startAudioCall"
          >
            <PhoneIcon />
          </button>

          <button
            v-if="selectedContact"
            class="call-btn video"
            :class="{ active: isCalling }"
            :disabled="!canCall"
            @click="startVideoCall"
          >
            <VideoIcon />
          </button>
        </div>
      </header>
      <div class="chat-body">
        <div v-if="loadingMessages">Cargando mensajes…</div>

        <div v-else-if="messages.length === 0" class="chat-empty">
          Inicia la conversación con {{ selectedContact?.name }}
        </div>

        <div
          v-for="msg in messages"
          :key="msg.id"
          class="message"
          :class="{ me: msg.senderId === auth.user.id }"
        >
          {{ msg.content }}
          <span class="time">
            {{ formatMessageTime(msg.createdAt) }}
          </span>
        </div>
      </div>

      <div class="chat-input">
        <input
          placeholder="Escribe un mensaje"
          v-model="newMessage"
          :disabled="sending"
          @keyup.enter="sendMessage"
        />
        <button @click="sendMessage" :disabled="sending || !newMessage.trim()">
          Enviar
        </button>
      </div>
    </section>

    <!-- Mensaje cuando no hay chat seleccionado -->
    <div v-else class="chat-empty">Selecciona un chat para comenzar</div>
  </div>
</template>

<style scoped>
.chat-layout {
  display: flex;
  height: 100vh;
  background: #0b1220;
  color: #e5e7eb;
  font-family: "Inter", system-ui, sans-serif;
  overflow: hidden;
}

/* ================= LEFT ================= */

.chat-list {
  width: 30%;
  background: #020617;
  border-right: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
}

.search {
  padding: 12px 14px;
  margin: 12px;
  border-radius: 12px;
  border: 1px solid #2c4773;
  background: #020617;
  color: #e5e7eb;
  font-size: 14px;
}

.search::placeholder {
  color: #6282ae;
}

.chat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.chat-item:hover {
  background: #020617;
}

.chat-item.active {
  background: #020617;
  border-left: 3px solid #2563eb;
}

.avatar {
  width: 42px;
  height: 42px;
  background: #334155;
  border-radius: 50%;
  margin-right: 12px;
  flex-shrink: 0;
}

.chat-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-name {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-last {
  font-size: 12px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-time {
  font-size: 11px;
  color: #64748b;
  margin-left: 8px;
  flex-shrink: 0;
  white-space: nowrap;
}

/* ================= RIGHT ================= */

.chat-window {
  width: 70%;
  display: flex;
  flex-direction: column;
  background: #333c66;
  transition: transform 0.3s ease;
}

.chat-header {
  padding: 14px 16px;
  border-bottom: 1px solid #0c192f;
  background-color: #0b1220;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 40px rgba(0, 0, 0, 0.1);
}

.chat-header .back-btn {
  display: none;
  margin-right: 12px;
  background: none;
  border: none;
  color: #cbd5f5;
  font-size: 16px;
  cursor: pointer;
}
.chat-header .call-btn {
  color: #fcfcfc;
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
}

.chat-title {
  font-weight: 600;
  font-size: 15px;
}

.chat-status {
  font-size: 12px;
  color: #94a3b8;
}

/* ================= BODY ================= */

.chat-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.message {
  max-width: 65%;
  min-width: 30%;
  width: fit-content;
  padding: 10px 14px;
  border-radius: 14px;
  margin-bottom: 10px;
  background: #2547e2;
  font-size: 14px;
  line-height: 1.45;
  box-shadow:
    #232533 0px 2px 5px 0px,
    #0c1748 0px 1px 2px 0px;
}

.message.me {
  background: #22325f;
  margin-left: auto;
}

.time {
  display: block;
  font-size: 10px;
  margin-top: 4px;
  color: #cbd5f5;
  text-align: right;
}

/* ================= INPUT ================= */

.chat-input {
  display: flex;
  padding: 12px;
  border-top: 1px solid #1b2027;
  background: #020617;
  box-shadow:
    #232533 0px 2px 5px 0px,
    #0c1748 0px 1px 2px 0px;
}

.chat-input input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid #bec3cc;
  background: #090e249f;
  color: #e5e7eb;
  font-size: 14px;
}

.chat-input input::placeholder {
  color: #9aa2ad;
}

.chat-input button {
  margin-left: 10px;
  padding: 0 18px;
  border-radius: 12px;
  background: #2563eb;
  color: white;
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
}

.chat-input button:hover {
  background: #1e40af;
}

/* ================= EMPTY ================= */

.chat-empty {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #64748b;
  font-size: 14px;
}
.call-actions {
  display: flex;
  gap: 12px;
}

.call-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: none;
  background: #1e293b;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.call-btn:hover {
  background: #334155;
}

.call-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.call-btn.calling {
  animation: pulse 1.2s infinite;
  background: #2563eb;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.6);
  }
  70% {
    box-shadow: 0 0 0 12px rgba(37, 99, 235, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
  }
}

/* ================= MOBILE ================= */

@media (max-width: 768px) {
  .chat-layout {
    flex-direction: column;
  }

  .chat-list {
    width: 80%;
    height: 100%;
    position: absolute;
    z-index: 10;
    transform: translateX(0);
    background: #020617;
  }

  .chat-list.hide {
    transform: translateX(-100%);
  }

  .chat-window {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    transform: translateX(100%);
    z-index: 20;
  }

  .chat-window.show {
    transform: translateX(0);
  }

  .chat-header .back-btn {
    display: inline-block;
  }

  .chat-body {
    padding: 12px;
    padding-bottom: 80px; /* Ajuste para evitar superposición con input fijo */
  }

  .chat-input {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 10px;
    padding-bottom: calc(10px + env(safe-area-inset-bottom));
    background: #020617;
    z-index: 1000;
    box-shadow:
      #232533 0px -2px 5px 0px,
      #0c1748 0px -1px 2px 0px;
  }

  .message {
    max-width: 80%;
    min-width: 50%;
  }

  .chat-item {
    padding: 10px;
  }

  .chat-name {
    font-size: 15px;
  }

  .chat-last {
    font-size: 12px;
  }

  .chat-time {
    font-size: 11px;
  }

  .chat-input input {
    font-size: 14px;
  }

  .chat-input button {
    padding: 0 12px;
  }
}
</style>
