<script setup lang="ts">
import { ref, onMounted } from 'vue';
import MosaicTile from './MosaicTile.vue';

interface WeatherData {
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  location: string;
  feelsLike: number;
}

const weather = ref<WeatherData | null>(null);
const loading = ref(true);
const error = ref(false);

// Obtener ubicación del usuario
const getUserLocation = async (): Promise<{ lat: number; lon: number } | null> => {
  return new Promise((resolve) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        () => {
          // Si no hay permiso, usar coordenadas por defecto (ej: CDMX)
          resolve({ lat: 19.4326, lon: -99.1332 });
        },
        {
          timeout: 10000,
          enableHighAccuracy: false,
        }
      );
    } else {
      resolve({ lat: 19.4326, lon: -99.1332 });
    }
  });
};

// Mapear códigos WMO a emojis e iconos legibles
const getWeatherIcon = (code: number, isDay: boolean): { emoji: string; description: string } => {
  const iconMap: Record<number, { day: string; night: string; desc: string }> = {
    0: { day: '☀️', night: '🌙', desc: 'Despejado' },
    1: { day: '🌤️', night: '🌥️', desc: 'Mayormente despejado' },
    2: { day: '⛅', night: '☁️', desc: 'Parcialmente nublado' },
    3: { day: '☁️', night: '☁️', desc: 'Nublado' },
    45: { day: '🌫️', night: '🌫️', desc: 'Nubina' },
    48: { day: '🌫️', night: '🌫️', desc: 'Nubina con depósito' },
    51: { day: '🌦️', night: '🌧️', desc: 'Llovizna leve' },
    53: { day: '🌦️', night: '🌧️', desc: 'Llovizna moderada' },
    55: { day: '🌧️', night: '⛈️', desc: 'Llovizna densa' },
    61: { day: '🌧️', night: '🌧️', desc: 'Lluvia ligera' },
    63: { day: '🌧️', night: '🌧️', desc: 'Lluvia moderada' },
    65: { day: '⛈️', night: '⛈️', desc: 'Lluvia fuerte' },
    71: { day: '🌨️', night: '🌨️', desc: 'Nieve ligera' },
    73: { day: '🌨️', night: '🌨️', desc: 'Nieve moderada' },
    75: { day: '❄️', night: '❄️', desc: 'Nieve fuerte' },
    80: { day: '🌧️', night: '🌧️', desc: 'Lluvia' },
    81: { day: '⛈️', night: '⛈️', desc: 'Tormenta' },
    82: { day: '⛈️', night: '⛈️', desc: 'Tormenta fuerte' },
  };

  const weatherInfo = iconMap[code] || { day: '🌡️', night: '🌡️', desc: 'Desconocido' };
  return {
    emoji: isDay ? weatherInfo.day : weatherInfo.night,
    description: weatherInfo.desc,
  };
};

const fetchWeather = async () => {
  try {
    loading.value = true;
    error.value = false;

    const location = await getUserLocation();
    if (!location) throw new Error('No se pudo obtener la ubicación');

    // API Open-Meteo (gratuita, sin API key, con CORS habilitado)
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day,apparent_temperature&timezone=auto`,
      { method: 'GET' }
    );

    if (!response.ok) throw new Error('Error al obtener datos del clima');

    const data = await response.json();
    const current = data.current;

    const { emoji, description } = getWeatherIcon(current.weather_code, current.is_day);

    weather.value = {
      temp: Math.round(current.temperature_2m),
      condition: description,
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m * 10) / 10,
      icon: emoji,
      location: data.timezone || 'Tu ubicación',
      feelsLike: Math.round(current.apparent_temperature),
    };
  } catch (err) {
    console.error('Error al cargar el clima:', err);
    error.value = true;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchWeather();
  // Actualizar cada 30 minutos
  setInterval(fetchWeather, 30 * 60 * 1000);
});
</script>

<template>
  <MosaicTile
    v-if="weather && !error"
    title="Clima"
    :icon="weather.icon"
    :size="'2x1'"
    color="#2b6cb0"
    :loading="loading"
  >
    <div class="weather-content">
      <div class="weather-location">
        <p class="location-text">📍 {{ weather.location }}</p>
      </div>
      <div class="weather-main">
        <div class="temp-display">
          <span class="current-temp">{{ weather.temp }}°</span>
          <div class="weather-details">
            <p class="condition">{{ weather.condition }}</p>
            <p class="feels-like">Sensación: {{ weather.feelsLike }}°</p>
          </div>
        </div>
      </div>
      <div class="weather-stats">
        <div class="stat">
          <span class="stat-label">Humedad</span>
          <span class="stat-value">{{ weather.humidity }}%</span>
        </div>
        <div class="stat">
          <span class="stat-label">Viento</span>
          <span class="stat-value">{{ weather.windSpeed }} km/h</span>
        </div>
      </div>
    </div>
  </MosaicTile>

  <!-- Mosaico de error -->
  <MosaicTile v-else-if="error" title="Clima" icon="⚠️" :size="'2x1'" color="#e74c3c">
    <div class="error-message">
      <p>No se pudo cargar el clima</p>
      <button @click="fetchWeather" class="retry-btn">Reintentar</button>
    </div>
  </MosaicTile>

  <!-- Mosaico de carga -->
  <MosaicTile v-else title="Clima" icon="☁️" :size="'2x1'" color="#2b6cb0" :loading="true" />
</template>

<style scoped>
.weather-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.weather-location {
  margin-bottom: 8px;
}

.location-text {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  opacity: 0.9;
}

.weather-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.temp-display {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.current-temp {
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
}

.weather-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.condition {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  opacity: 0.9;
}

.feels-like {
  margin: 0;
  font-size: 12px;
  opacity: 0.8;
}

.weather-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
}

.stat-label {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
}

.error-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
}

.error-message p {
  margin: 0;
  font-size: 14px;
}

.retry-btn {
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.4);
}

@media (max-width: 640px) {
  .current-temp {
    font-size: 36px;
  }

  .weather-stats {
    grid-template-columns: 1fr;
  }
}
</style>
