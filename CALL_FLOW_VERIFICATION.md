# 📞 Verificación del Flujo de Llamadas

## ✅ Flujo Correcto de Llamada de Voz/Video

### 1️⃣ **INICIAR LLAMADA (Caller)**

**Usuario A** hace clic en el botón de llamada:

```
MessagesView.vue (startAudioCall/startVideoCall)
    ↓
call.startCall({ id, name }, mode)
    ↓
1. Verificar socket conectado ✅
2. Cambiar estado a "calling" 
3. Inicializar WebRTC (pedir permisos)
    ↓
webrtc.init(mode)
    - Solicitar getUserMedia (micrófono/cámara)
    - Crear PeerConnection
    - Añadir tracks locales
    - Configurar handlers ICE
    ↓
4. Configurar manejador de ICE candidates
5. Emitir "call:request" al backend
6. Crear OFFER (pero NO enviarlo aún)
7. Esperar que receptor esté listo
```

**Logs esperados:**
```
📞 Iniciando llamada a: [nombre]
🎤 Solicitando permisos para: audio
✅ Stream local obtenido
➕ Track añadido a PeerConnection: audio
✅ PeerConnection configurada correctamente
📝 Offer creado (esperando receptor listo)
```

---

### 2️⃣ **RECIBIR LLAMADA (Receiver)**

**Usuario B** recibe la notificación:

```
Backend emite "call:incoming"
    ↓
call.registerSocketEvents() → on("call:incoming")
    ↓
1. Guardar incomingCall { callerId, callerName, mode }
2. Cambiar estado a "ringing"
    ↓
IncomingCallModal.vue se muestra
    - Avatar del caller
    - Botones: Aceptar / Rechazar
    - Sonido de llamada entrante
```

**Logs esperados:**
```
📞 Llamada entrante de { callerId: "...", callerName: "...", mode: "audio" }
```

---

### 3️⃣ **ACEPTAR LLAMADA (Receiver)**

**Usuario B** hace clic en "Aceptar":

```
IncomingCallModal (accept)
    ↓
call.acceptCall()
    ↓
1. Verificar socket conectado ✅
2. Inicializar WebRTC (pedir permisos)
    ↓
webrtc.init(mode)
    - Solicitar getUserMedia
    - Crear PeerConnection
    - Añadir tracks locales
    ↓
3. Establecer activeCall
4. Emitir "call:accept" al backend
5. Emitir "call:ready-for-offer" al backend
6. Cambiar estado a "in-call"
7. Esperando offer del caller...
```

**Logs esperados:**
```
✅ Aceptando llamada de: [nombre]
🎤 Solicitando permisos para: audio
✅ Stream local obtenido
📤 Enviando accept al caller...
📤 Enviando ready-for-offer...
⏳ Esperando offer del caller...
```

---

### 4️⃣ **ENVIAR OFFER (Caller)**

Backend recibe "call:ready-for-offer" y notifica al caller:

```
Backend emite "call:receiver-ready"
    ↓
call.on("call:receiver-ready")
    ↓
1. Verificar que somos caller ✅
2. Verificar estado "calling" ✅
3. Obtener offer previamente creado
4. Emitir "call:offer" al backend con el offer
```

**Logs esperados:**
```
🎯 Receptor listo: [nombre]
📤 Enviando offer ahora que el receptor está listo
```

---

### 5️⃣ **PROCESAR OFFER (Receiver)**

Backend envía offer al receptor:

```
Backend emite "call:offer"
    ↓
call.on("call:offer")
    ↓
1. Verificar estado "in-call" ✅
2. Verificar que activeCall existe ✅
3. Configurar remote description con el offer
4. Crear answer
5. Configurar local description con answer
6. Emitir "call:answer" al backend
```

**Logs esperados:**
```
📡 Offer recibido de: [nombre], estado actual: in-call
🎯 Procesando offer después de aceptar llamada
📥 Configurando remote description: offer
📤 Creando answer
📤 Enviando answer al caller
🎉 Conexión WebRTC establecida como receptor
```

---

### 6️⃣ **PROCESAR ANSWER (Caller)**

Backend envía answer al caller:

```
Backend emite "call:answer"
    ↓
call.on("call:answer")
    ↓
1. Verificar estado "calling" ✅
2. Verificar que activeCall existe ✅
3. Configurar remote description con answer
4. Cambiar estado a "in-call"
5. Limpiar timeout
```

**Logs esperados:**
```
✅ Answer recibido de: [ID], estado actual: calling
📥 Configurando remote description con answer
🎉 Conexión establecida como caller
```

---

### 7️⃣ **INTERCAMBIO ICE CANDIDATES**

Durante todo el proceso:

```
// Cada vez que se genera un ICE candidate:
pc.onicecandidate → event.candidate
    ↓
Emitir "call:ice-candidate" al backend
    ↓
Backend reenvía al otro peer
    ↓
call.on("call:ice-candidate")
    ↓
pc.addIceCandidate(candidate)
```

**Logs esperados:**
```
❄ ICE candidate generado: host/srflx/relay
❄ Enviando ICE candidate a: [ID]
🔄 Estado ICE cambiado: checking
🔄 Estado ICE cambiado: connected
🔄 Estado conexión cambiado: connected
```

---

### 8️⃣ **LLAMADA ACTIVA**

Una vez conectados:

```
ActiveCall.vue se muestra
    ↓
- Caller: Mostrando "En llamada"
- Receiver: Mostrando "En llamada"
    ↓
Streams funcionando:
    - localStream → video local (si es video)
    - remoteStream → audio/video remoto
```

**Logs esperados:**
```
📱 ActiveCall montado { state: 'in-call', ... }
🎯 Stream remoto disponible
🎥 Stream local disponible
```

---

### 9️⃣ **FINALIZAR LLAMADA**

Cualquier usuario hace clic en "Colgar":

```
ActiveCall.vue (hangup)
    ↓
call.endCall()
    ↓
1. Emitir "call:hangup" al backend
2. resetCall()
    ↓
webrtc.close()
    - Cerrar PeerConnection
    - Detener todos los tracks
    - Limpiar streams
    ↓
3. Cambiar estado a "idle"
```

**Logs esperados:**
```
📴 Colgando llamada
📴 Llamada finalizada
```

---

## 🔍 Checkpoints de Verificación

### ✅ Socket Conectado
- [ ] Socket inicializado al entrar al dashboard
- [ ] Evento "register" enviado al backend
- [ ] UserId y userName registrados correctamente

### ✅ Permisos de Medios
- [ ] getUserMedia solicitado correctamente
- [ ] Permisos aceptados por el usuario
- [ ] Tracks de audio/video obtenidos
- [ ] Tracks añadidos al PeerConnection

### ✅ Señalización
- [ ] call:request enviado
- [ ] call:incoming recibido
- [ ] call:accept enviado
- [ ] call:ready-for-offer enviado
- [ ] call:receiver-ready recibido
- [ ] call:offer enviado/recibido
- [ ] call:answer enviado/recibido

### ✅ WebRTC
- [ ] PeerConnection creado
- [ ] Local description configurado (offer/answer)
- [ ] Remote description configurado (offer/answer)
- [ ] ICE candidates intercambiados
- [ ] Estado de conexión: "connected"

### ✅ UI
- [ ] IncomingCallModal mostrado al recibir llamada
- [ ] ActiveCall mostrado durante llamada
- [ ] Streams de audio/video reproducidos correctamente
- [ ] Botón de colgar funciona

---

## 🚨 Problemas Comunes

### ❌ "Socket no inicializado"
**Causa:** No se llamó `initSocket()` al entrar al dashboard
**Solución:** Verificar que DashboardView.vue llama `auth.initCallSocket()` en onMounted

### ❌ "Error al acceder al micrófono/cámara"
**Causa:** Permisos denegados o no disponibles
**Solución:** 
- Verificar permisos del navegador
- Acceder desde localhost o HTTPS
- Verificar que el dispositivo tiene micrófono/cámara

### ❌ "Offer recibido en estado incorrecto"
**Causa:** Offer llegó antes de que receptor aceptara
**Solución:** Backend debe esperar "call:ready-for-offer" antes de enviar offer

### ❌ Estados ICE no cambian a "connected"
**Causa:** Problemas de red o TURN servers
**Solución:**
- Verificar STUN servers
- Considerar añadir TURN servers si están detrás de NAT estricto

---

## 📊 Estados del Sistema

### CallState
- `idle` - Sin llamada
- `calling` - Iniciando llamada (caller)
- `ringing` - Recibiendo llamada (receiver)
- `in-call` - En llamada activa

### PeerConnection States
- `connectionState`: new → connecting → connected → disconnected/failed/closed
- `iceConnectionState`: new → checking → connected → completed
- `signalingState`: stable → have-local-offer → stable (caller)
- `signalingState`: stable → have-remote-offer → stable (receiver)

---

## 🎯 Pruebas Recomendadas

1. **Llamada de audio básica** (localhost)
2. **Llamada de video básica** (localhost)
3. **Rechazar llamada entrante**
4. **No responder llamada (timeout)**
5. **Colgar durante llamada**
6. **Reconexión si se pierde conexión**
7. **Múltiples usuarios conectados**

