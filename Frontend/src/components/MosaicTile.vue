<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  title?: string;
  icon?: string;
  value?: string | number;
  unit?: string;
  size?: '1x1' | '2x1' | '1x2' | '2x2';
  color?: string; // Acepta nombres predefinidos o códigos hex (#RRGGBB)
  gradient?: boolean;
  loading?: boolean;
  trend?: number;
}

const props = withDefaults(defineProps<Props>(), {
  size: '1x1',
  color: 'blue',
  gradient: true,
  loading: false,
});

// Tipo para configuración de color
type ColorConfig = { bg: string; border: string; text: string };

// Map de colores predefinidos con valores hex
const predefinedColors: Record<string, ColorConfig> = {
  blue: { bg: '#3b82f6', border: '#1e40af', text: '#ffffff' },
  green: { bg: '#22c55e', border: '#15803d', text: '#ffffff' },
  red: { bg: '#ef4444', border: '#991b1b', text: '#ffffff' },
  purple: { bg: '#a855f7', border: '#6b21a8', text: '#ffffff' },
  orange: { bg: '#f97316', border: '#b45309', text: '#ffffff' },
  cyan: { bg: '#1c427c', border: '#155e75', text: '#ffffff' },
  pink: { bg: '#ec4899', border: '#831843', text: '#ffffff' },
  yellow: { bg: '#eab308', border: '#78350f', text: '#1f2937' },
};

// Función para oscurecer un color hex
const darkenColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.floor((num >> 16) * (1 - percent));
  const g = Math.floor(((num >> 8) & 0x00ff) * (1 - percent));
  const b = Math.floor((num & 0x0000ff) * (1 - percent));
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
};

// Función para determinar si el texto debe ser claro u oscuro basado en el luminancia del color
const getContrastColor = (hex: string): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = num >> 16;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1f2937' : '#ffffff';
};

// Determinar los colores a usar
const getColorConfig = computed<ColorConfig>(() => {
  const colorValue = props.color.toLowerCase();
  
  // Si es un color predefinido
  const predefined = predefinedColors[colorValue];
  if (predefined) {
    return predefined;
  }
  
  // Si es un código hex válido
  if (/^#[0-9A-Fa-f]{6}$/.test(colorValue)) {
    return {
      bg: colorValue,
      border: darkenColor(colorValue, 0.3),
      text: getContrastColor(colorValue),
    };
  }
  
  // Por defecto, usar azul (siempre existe)
  return { bg: '#3b82f6', border: '#1e40af', text: '#ffffff' };
});

const sizeClasses = {
  '1x1': 'col-span-1 row-span-1',
  '2x1': 'col-span-2 row-span-1',
  '1x2': 'col-span-1 row-span-2',
  '2x2': 'col-span-2 row-span-2',
};

const tileStyles = computed(() => ({
  backgroundColor: getColorConfig.value.bg,
  borderColor: getColorConfig.value.border,
  color: getColorConfig.value.text,
}));
</script>

<template>
  <div 
    :class="['mosaic-tile', sizeClasses[size], { 'loading-state': loading }]"
    :style="tileStyles"
  >
    <!-- Animación de carga -->
    <div v-if="loading" class="loading-spinner">
      <div class="spinner"></div>
    </div>

    <!-- Contenido del mosaico -->
    <div class="tile-content" v-if="!loading">
      <!-- Encabezado con título e icono -->
      <div class="tile-header">
        <h3 v-if="title" class="tile-title">{{ title }}</h3>
        <span v-if="icon" class="tile-icon">{{ icon }}</span>
      </div>

      <!-- Valor principal -->
      <div class="tile-main">
        <div v-if="value !== undefined" class="value-section">
          <span class="value">{{ value }}</span>
          <span v-if="unit" class="unit">{{ unit }}</span>
        </div>

        <!-- Trending indicator -->
        <div v-if="trend !== undefined" class="trend-indicator" :class="{ positive: trend > 0, negative: trend < 0 }">
          <span class="trend-arrow">{{ trend > 0 ? '↑' : trend < 0 ? '↓' : '→' }}</span>
          <span class="trend-value">{{ Math.abs(trend) }}%</span>
        </div>
      </div>

      <!-- Slot para contenido personalizado -->
      <div class="tile-body">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mosaic-tile {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  border: 2px solid;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 160px;
  cursor: default;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 10px 13px rgba(0, 0, 0, 0.08);
}

.mosaic-tile:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.15), 0 4px 6px rgba(0, 0, 0, 0.1);
}

.mosaic-tile::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%);
  pointer-events: none;
  border-radius: 12px;
}

/* Header y contenido */
.tile-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.tile-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.tile-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  opacity: 0.85;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tile-icon {
  font-size: 24px;
  line-height: 1;
}

/* Sección de valores */
.tile-main {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex: 1;
}

.value-section {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.value {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
}

.unit {
  font-size: 14px;
  opacity: 0.7;
  font-weight: 500;
}

/* Indicador de tendencia */
.trend-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.trend-indicator.positive {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.25);
}

.trend-indicator.negative {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.25);
}

.trend-arrow {
  font-size: 14px;
}

/* Body del mosaico */
.tile-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Loading state */
.loading-state {
  opacity: 0.6;
}

.loading-spinner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Sizes */
.col-span-2 {
  grid-column: span 2;
}

.col-span-1 {
  grid-column: span 1;
}

.row-span-2 {
  grid-row: span 2;
}

.row-span-1 {
  grid-row: span 1;
}

/* Media queries */
@media (max-width: 1024px) {
  .col-span-2,
  .row-span-2 {
    grid-column: span 1 !important;
    grid-row: span 1 !important;
  }

  .mosaic-tile {
    min-height: 140px;
  }
}

@media (max-width: 640px) {
  .mosaic-tile {
    padding: 16px;
    min-height: 120px;
  }

  .value {
    font-size: 24px;
  }

  .tile-title {
    font-size: 12px;
  }
}
</style>
