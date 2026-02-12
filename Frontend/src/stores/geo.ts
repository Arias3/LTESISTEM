import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from './auth';

const API_URL = import.meta.env.VITE_API_URL;

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
  location: LocationCoordinates;
  timestamp: number;
  avatar?: string;
  online: boolean;
}

export interface SensorDevice {
  id: string;
  name: string;
  type: string; // 'camera', 'sensor', 'gateway', 'beacon'
  location: LocationCoordinates;
  timestamp: number;
  sensorData?: Record<string, any>;
  values?: Record<string, any>; // Alias para compatibilidad
  icon?: string;
  status?: 'online' | 'offline';
  online?: boolean;
}

export interface LocationTrack {
  id: string;
  accountId: string;
  deviceId: string;
  coordinates: LocationCoordinates;
  timestamp: number;
  data: Record<string, any>;
}

export const useGeoStore = defineStore('geo', () => {
  const authStore = useAuthStore();
  
  const users = ref<User[]>([]);
  const devices = ref<SensorDevice[]>([]);
  const userLocation = ref<LocationCoordinates | null>(null);
  const selectedMarker = ref<User | SensorDevice | null>(null);
  const mapZoom = ref(13);
  const mapCenter = ref<LocationCoordinates>({ latitude: 11.018224, longitude: -74.850678 }); // Santa Marta default
  
  let pollingInterval: ReturnType<typeof setInterval> | null = null;

  // ================= API CALLS =================
  
  // Obtener usuarios desde el backend
  const fetchUsers = async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/geo/users`, {
        credentials: 'include',
        headers: authStore.getAuthHeaders() as Record<string, string>,
      });
      
      if (res.ok) {
        const data: User[] = await res.json();
        users.value = data;
      }
    } catch (error) {
      console.error('Error al cargar usuarios geo:', error);
      // Mantener datos existentes en caso de error
    }
  };

  // Obtener dispositivos desde el backend
  const fetchDevices = async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/geo/devices`, {
        credentials: 'include',
        headers: authStore.getAuthHeaders() as Record<string, string>,
      });
      
      if (res.ok) {
        const data: SensorDevice[] = await res.json();
        devices.value = data.map(device => ({
          ...device,
          values: device.sensorData || device.values,
          status: device.online ? 'online' : 'offline',
        }));
      }
    } catch (error) {
      console.error('Error al cargar dispositivos geo:', error);
      // Mantener datos existentes en caso de error
    }
  };

  // Iniciar polling
  const startPolling = async () => {
    // Detener polling anterior si existe
    stopPolling();
    
    // Carga inicial
    await Promise.all([fetchUsers(), fetchDevices()]);
    
    // Polling cada 3 segundos
    pollingInterval = setInterval(async () => {
      await Promise.all([fetchUsers(), fetchDevices()]);
    }, 3000);
  };

  // Detener polling
  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  };

  // ================= MOCK DATA (FALLBACK) =================
  
  // Simulación de usuarios activos (para desarrollo sin backend)
  const initializeMockUsers = () => {
    users.value = [
      {
        id: 'user-1',
        name: 'Juan Carlos',
        role: 'Administrador',
        location: { latitude: 11.018224, longitude: -74.850678 },
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

  // Simulación de sensores/dispositivos
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

  // Obtener la ubicación del usuario
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
            // Fallback a ubicación por defecto (Santa Marta)
            userLocation.value = { latitude: 11.018224, longitude: -74.850678 };
            mapCenter.value = userLocation.value;
            resolve();
          },
          {
            timeout: 10000,
            enableHighAccuracy: true,
          }
        );
      } else {
        userLocation.value = { latitude: 11.018224, longitude: -74.850678 };
        mapCenter.value = userLocation.value;
        resolve();
      }
    });
  };

  // Enviar ubicación al backend (placeholder)
  const sendLocationToBackend = async (location: LocationCoordinates, data: Record<string, any> = {}): Promise<void> => {
    console.log('Enviando ubicación al backend:', {
      location,
      timestamp: Date.now(),
      data,
    });
    // TODO: Implementar llamada real al backend
    // const response = await fetch('/api/location/track', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ location, timestamp: Date.now(), data }),
    // });
  };

  // Seleccionar marcador
  const selectMarker = (marker: User | SensorDevice) => {
    selectedMarker.value = marker;
  };

  // Deseleccionar marcador
  const deselectMarker = () => {
    selectedMarker.value = null;
  };

  // Cambiar zoom del mapa
  const setMapZoom = (zoom: number) => {
    mapZoom.value = Math.max(1, Math.min(zoom, 20));
  };

  // Cambiar centro del mapa
  const setMapCenter = (coords: LocationCoordinates) => {
    mapCenter.value = coords;
  };

  // Verificar si una estructura es un usuario
  const isUser = (marker: any): marker is User => {
    return 'role' in marker;
  };

  // Verificar si una estructura es un dispositivo
  const isDevice = (marker: any): marker is SensorDevice => {
    return 'type' in marker;
  };

  // Computed: obtener todos los marcadores (usuarios + dispositivos)
  const allMarkers = computed(() => [...users.value, ...devices.value]);

  // Computed: usuarios en línea
  const onlineUsers = computed(() => users.value.filter(u => u.online));

  // Computed: dispositivos en línea
  const onlineDevices = computed(() => devices.value.filter(d => d.status === 'online'));

  return {
    users,
    devices,
    userLocation,
    selectedMarker,
    mapZoom,
    mapCenter,
    allMarkers,
    onlineUsers,
    onlineDevices,
    fetchUsers,
    fetchDevices,
    startPolling,
    stopPolling,
    initializeMockUsers,
    initializeMockDevices,
    getUserLocation,
    sendLocationToBackend,
    selectMarker,
    deselectMarker,
    setMapZoom,
    setMapCenter,
    isUser,
    isDevice,
  };
});
