import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './auth';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;
const API_URL = import.meta.env.VITE_API_URL;
const DEFAULT_CENTER: LocationCoordinates = { latitude: 11.019464, longitude: -74.851522 };

// ================= INTERFACES =================

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface User {
  id: string;
  accountId?: string;
  name: string;
  username?: string;
  role: string;
  location: LocationCoordinates | null;
  timestamp: number;
  lastUpdate?: string | null;
  avatar?: string;
  online: boolean;
}

export interface SensorDevice {
  id: string;
  deviceId?: string;          // hardware ID: "ESP32-XXXX"
  name: string;
  type: string;
  location: LocationCoordinates | null;
  timestamp: number;
  lastUpdate?: string;        // ISO date desde DB
  sensorData?: Record<string, any>;
  values?: Record<string, any>;
  icon?: string;
  status?: 'online' | 'offline';
  online?: boolean;
  samplingInterval?: number;
}

export interface LocationTrack {
  id: string;
  accountId: string;
  deviceId: string;
  coordinates: LocationCoordinates;
  timestamp: number;
  data: Record<string, any>;
}

// ================= STORE =================

export const useGeoStore = defineStore('geo', () => {
  const authStore = useAuthStore();

  // State
  const users = ref<User[]>([]);
  const devices = ref<SensorDevice[]>([]);
  const userLocation = ref<LocationCoordinates | null>(null);
  const selectedMarker = ref<User | SensorDevice | null>(null);
  const mapZoom = ref(13);
  const mapCenter = ref<LocationCoordinates>(DEFAULT_CENTER);

  // Geo permission state
  const geoPermission = ref<PermissionState | 'unknown'>('unknown');

  // Socket.IO
  let socket: Socket | null = null;
  let watchId: number | null = null;
  let lastSentTime = 0;
  const SEND_INTERVAL_MS = 10_000; // Enviar ubicación cada 10s máximo
  const MIN_DISTANCE_M = 5; // No enviar si movimiento < 5m

  // Polling fallback para dispositivos (aún usan REST)
  let devicePollingInterval: ReturnType<typeof setInterval> | null = null;

  const parseCoordinates = (location: any): LocationCoordinates | null => {
    if (!location) return null;
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    if (latitude === 0 && longitude === 0) return null;

    return { latitude, longitude };
  };

  const hasValidLocation = (marker: User | SensorDevice): boolean => {
    return Boolean(marker.location);
  };

  // ================= SOCKET.IO =================

  /** Inicializa socket geo y comienza tracking */
  const initGeoSocket = () => {
    if (socket?.connected) {
      console.log('📍 Geo socket ya conectado');
      return;
    }

    const user = authStore.user;
    if (!user) {
      console.warn('⚠️ No se puede inicializar geo sin usuario autenticado');
      return;
    }

    console.log('📍 Inicializando geo socket para:', user.username);

    socket = io(SOCKET_URL, {
      withCredentials: true,
      auth: authStore.getAuthHeaders() as Record<string, string>,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('📍 Geo socket conectado:', socket?.id);

      socket?.emit('geo:register', {
        userId: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
      });
    });

    // Recibir ubicaciones de todos los usuarios
    socket.on('geo:locations-update', (payload: any[]) => {
      users.value = (Array.isArray(payload) ? payload : []).filter((user: any) => {
        const username = String(user?.username || user?.name || '');
        return !username.toUpperCase().startsWith('ESP32-');
      }).map((user: any) => {
        const location = parseCoordinates(user?.location);
        const timestamp = Number(user?.timestamp);
        return {
          id: String(user?.id || user?.accountId || crypto.randomUUID()),
          accountId: user?.accountId ? String(user.accountId) : undefined,
          name: String(user?.name || user?.username || 'Usuario'),
          username: user?.username ? String(user.username) : undefined,
          role: String(user?.role || 'OPERATOR'),
          location,
          online: Boolean(user?.online),
          timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
          lastUpdate: user?.lastUpdate ? String(user.lastUpdate) : null,
        } as User;
      });
    });

    // Recibir TODOS los dispositivos (online + offline) del backend
    socket.on('device:data-update', (payload: any[]) => {
      devices.value = (Array.isArray(payload) ? payload : []).map((d: any) => {
        const location = parseCoordinates(d?.location);
        const timestamp = Number(d?.timestamp);
        return {
          ...d,
          id: String(d?.id || d?.deviceId || crypto.randomUUID()),
          name: String(d?.name || d?.deviceId || 'Dispositivo'),
          type: String(d?.type || 'sensor'),
          location,
          timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
          values: d?.sensorData || d?.values,
          status: d?.online ? 'online' : 'offline',
        } as SensorDevice;
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('📍 Geo socket desconectado:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('📍 Geo socket error:', error.message);
    });
  };

  // ================= GPS TRACKING =================

  /** Enviar ubicación y empezar watch */
  const emitLocation = (lat: number, lng: number) => {
    const prevLocation = userLocation.value;
    userLocation.value = { latitude: lat, longitude: lng };

    // Centrar mapa en la primera ubicación obtenida
    if (!prevLocation || (prevLocation.latitude === DEFAULT_CENTER.latitude && prevLocation.longitude === DEFAULT_CENTER.longitude)) {
      mapCenter.value = { latitude: lat, longitude: lng };
    }

    // Enviar por socket inmediatamente
    if (socket?.connected) {
      socket.emit('geo:update-location', { latitude: lat, longitude: lng });
      lastSentTime = Date.now();
    }
  };

  /** Callback para watchPosition */
  const handlePositionUpdate = (position: GeolocationPosition) => {
    const newLat = position.coords.latitude;
    const newLng = position.coords.longitude;

    const prevLocation = userLocation.value;
    userLocation.value = { latitude: newLat, longitude: newLng };

    if (!prevLocation || (prevLocation.latitude === DEFAULT_CENTER.latitude && prevLocation.longitude === DEFAULT_CENTER.longitude)) {
      mapCenter.value = { latitude: newLat, longitude: newLng };
    }

    // Throttle: no enviar más frecuente que SEND_INTERVAL_MS
    const now = Date.now();
    if (now - lastSentTime < SEND_INTERVAL_MS) return;

    // Filtrar: no enviar si el movimiento es menor a MIN_DISTANCE_M
    if (prevLocation && prevLocation.latitude !== DEFAULT_CENTER.latitude) {
      const dist = haversineDistance(prevLocation.latitude, prevLocation.longitude, newLat, newLng);
      if (dist < MIN_DISTANCE_M) return;
    }

    // Enviar por socket
    if (socket?.connected) {
      socket.emit('geo:update-location', { latitude: newLat, longitude: newLng });
      lastSentTime = now;
    }
  };

  /** Inicia tracking GPS con fallback para desktops sin GPS */
  const startTracking = () => {
    if (!navigator.geolocation) {
      console.warn('⚠️ Geolocalización no soportada');
      return;
    }

    if (watchId !== null) {
      console.log('📍 Tracking ya activo');
      return;
    }

    console.log('📍 Iniciando tracking GPS...');

    // Paso 1: obtener ubicación inicial (con fallback de precisión)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('📍 Ubicación inicial obtenida (alta precisión)');
        emitLocation(position.coords.latitude, position.coords.longitude);
        startWatch(true);
      },
      () => {
        // Fallback: intentar sin alta precisión (Wi-Fi/IP)
        console.log('📍 GPS no disponible, intentando con Wi-Fi/IP...');
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('📍 Ubicación obtenida (baja precisión - Wi-Fi/IP)');
            emitLocation(position.coords.latitude, position.coords.longitude);
            startWatch(false);
          },
          (error) => {
            console.warn('📍 No se pudo obtener ubicación:', error.message);
            startWatch(false);
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
    );
  };

  /** Inicia watchPosition con la precisión indicada */
  const startWatch = (highAccuracy: boolean) => {
    if (watchId !== null) return;

    watchId = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      (error) => {
        console.warn('📍 Error watch GPS:', error.message);
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: 15000,
        maximumAge: highAccuracy ? 5000 : 30000,
      }
    );
  };

  /** Detiene tracking GPS y desconecta socket */
  const stopTracking = () => {
    // Detener GPS watch
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
      console.log('📍 Tracking GPS detenido');
    }

    // Desconectar socket
    if (socket) {
      socket.disconnect();
      socket = null;
      console.log('📍 Geo socket desconectado');
    }

    // Detener polling de dispositivos
    stopDevicePolling();
  };

  // ================= GEO PERMISSIONS =================

  /** Consulta el estado actual del permiso de geolocalización */
  const checkGeoPermission = async (): Promise<PermissionState | 'unknown'> => {
    try {
      if (!navigator.permissions) {
        geoPermission.value = 'unknown';
        return 'unknown';
      }
      const status = await navigator.permissions.query({ name: 'geolocation' });
      geoPermission.value = status.state;

      // Escuchar cambios de permiso
      status.onchange = () => {
        geoPermission.value = status.state;
        if (status.state === 'granted') {
          startTracking();
        }
      };

      return status.state;
    } catch {
      geoPermission.value = 'unknown';
      return 'unknown';
    }
  };

  /** Solicita permiso de geolocalización */
  const requestGeoPermission = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          geoPermission.value = 'granted';
          userLocation.value = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          mapCenter.value = userLocation.value;
          startTracking();
          resolve(true);
        },
        () => {
          geoPermission.value = 'denied';
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  // ================= DEVICE POLLING (REST, no socket) =================

  const fetchDevices = async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/devices`, {
        credentials: 'include',
        headers: authStore.getAuthHeaders() as Record<string, string>,
      });

      if (res.ok) {
        const data = await res.json();
        const list: SensorDevice[] = data.devices || data;
        devices.value = list.map(device => ({
          ...device,
          location: parseCoordinates((device as any).location),
          values: device.sensorData || device.values,
          status: device.online ? 'online' : 'offline',
        }));
      }
    } catch (error) {
      console.error('Error al cargar dispositivos geo:', error);
    }
  };

  const fetchUsers = async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/geo/users`, {
        credentials: 'include',
        headers: authStore.getAuthHeaders() as Record<string, string>,
      });

      if (res.ok) {
        const list = await res.json();
        users.value = (Array.isArray(list) ? list : []).filter((user: any) => {
          const username = String(user?.username || user?.name || '');
          return !username.toUpperCase().startsWith('ESP32-');
        }).map((user: any) => ({
          id: String(user?.id || user?.accountId || crypto.randomUUID()),
          accountId: user?.accountId ? String(user.accountId) : undefined,
          name: String(user?.name || user?.username || 'Usuario'),
          username: user?.username ? String(user.username) : undefined,
          role: String(user?.role || 'OPERATOR'),
          location: parseCoordinates(user?.location),
          online: Boolean(user?.online),
          timestamp: Number.isFinite(Number(user?.timestamp)) ? Number(user.timestamp) : 0,
          lastUpdate: user?.lastUpdate ? String(user.lastUpdate) : null,
        }));
      }
    } catch (error) {
      console.error('Error al cargar usuarios geo:', error);
    }
  };

  const startDevicePolling = async () => {
    stopDevicePolling();
    // Cargar devices + inicializar socket geo
    await fetchUsers();
    await fetchDevices();
    initGeoSocket();
    // Polling de respaldo cada 30s (socket es la fuente primaria)
    devicePollingInterval = setInterval(() => {
      fetchUsers();
      fetchDevices();
    }, 30_000);
  };

  const stopDevicePolling = () => {
    if (devicePollingInterval) {
      clearInterval(devicePollingInterval);
      devicePollingInterval = null;
    }
  };

  // ================= LEGACY COMPAT =================

  // getUserLocation para compatibilidad (GeoView usa esto)
  const getUserLocation = async (): Promise<void> => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            userLocation.value = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            mapCenter.value = userLocation.value;
            resolve();
          },
          () => {
            if (!userLocation.value) {
              userLocation.value = { ...DEFAULT_CENTER };
              mapCenter.value = userLocation.value;
            }
            resolve();
          },
          { timeout: 10000, enableHighAccuracy: true }
        );
      } else {
        userLocation.value = { ...DEFAULT_CENTER };
        mapCenter.value = userLocation.value;
        resolve();
      }
    });
  };

  // ================= MOCK DATA (FALLBACK) =================

  const initializeMockUsers = () => {
    users.value = [
      {
        id: 'user-1',
        name: 'Juan Carlos',
        role: 'Administrador',
        location: { latitude: 11.019464, longitude: -74.851522 },
        timestamp: Date.now(),
        online: true,
      },
      {
        id: 'user-2',
        name: 'María López',
        role: 'Técnico',
        location: { latitude: 11.019500, longitude: -74.851200 },
        timestamp: Date.now(),
        online: true,
      },
      {
        id: 'user-3',
        name: 'Carlos García',
        role: 'Monitor',
        location: { latitude: 11.017000, longitude: -74.849500 },
        timestamp: Date.now(),
        online: false,
      },
    ];
  };

  const initializeMockDevices = () => {
    devices.value = [
      {
        id: 'sensor-temp-1',
        name: 'Sensor Temperatura - Oficina',
        type: 'temperature',
        location: { latitude: 11.018800, longitude: -74.851000 },
        timestamp: Date.now(),
        values: { temperature: 22.5, humidity: 65 },
        icon: '🌡️',
        status: 'online',
      },
      {
        id: 'sensor-motion-1',
        name: 'Sensor Movimiento - Entrada',
        type: 'motion',
        location: { latitude: 11.019800, longitude: -74.852000 },
        timestamp: Date.now(),
        values: { motion: true, lastDetected: '2 min' },
        icon: '📡',
        status: 'online',
      },
      {
        id: 'sensor-camera-1',
        name: 'Cámara - Pasillo Principal',
        type: 'camera',
        location: { latitude: 11.016800, longitude: -74.849200 },
        timestamp: Date.now(),
        values: { fps: 30, resolution: '1080p', status: 'grabando' },
        icon: '📹',
        status: 'online',
      },
      {
        id: 'sensor-temp-2',
        name: 'Sensor Humedad - Bodega',
        type: 'humidity',
        location: { latitude: 11.017500, longitude: -74.852200 },
        timestamp: Date.now(),
        values: { humidity: 72, temperature: 18.3 },
        icon: '💧',
        status: 'offline',
      },
    ];
  };

  // ================= HELPERS =================

  /** Distancia entre dos puntos GPS en metros (fórmula de Haversine) */
  function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  const selectMarker = (marker: User | SensorDevice) => {
    selectedMarker.value = marker;
  };

  const deselectMarker = () => {
    selectedMarker.value = null;
  };

  const setMapZoom = (zoom: number) => {
    mapZoom.value = Math.max(1, Math.min(zoom, 20));
  };

  const setMapCenter = (coords: LocationCoordinates) => {
    mapCenter.value = coords;
  };

  const isUser = (marker: any): marker is User => {
    return 'role' in marker;
  };

  const isDevice = (marker: any): marker is SensorDevice => {
    return 'type' in marker;
  };

  // Computed
  const allMarkers = computed(() => [...users.value, ...devices.value]);
  const onlineUsers = computed(() => users.value.filter(u => u.online));
  const onlineDevices = computed(() => devices.value.filter(d => d.status === 'online'));

  return {
    // State
    users,
    devices,
    userLocation,
    selectedMarker,
    mapZoom,
    mapCenter,
    geoPermission,
    
    // Computed
    allMarkers,
    onlineUsers,
    onlineDevices,
    
    // Socket.IO & Tracking
    initGeoSocket,
    startTracking,
    stopTracking,
    
    // Permissions
    checkGeoPermission,
    requestGeoPermission,
    
    // Devices (REST polling)
    fetchDevices,
    fetchUsers,
    startDevicePolling,
    stopDevicePolling,
    
    // Legacy compat
    getUserLocation,
    
    // Mock
    initializeMockUsers,
    initializeMockDevices,
    
    // Marker helpers
    selectMarker,
    deselectMarker,
    setMapZoom,
    setMapCenter,
    isUser,
    isDevice,
    hasValidLocation,
  };
});
