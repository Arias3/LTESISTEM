<script setup lang="ts">
import type { SensorDevice } from '../../stores/geo';
import { computed } from 'vue';

interface Props {
  device: SensorDevice;
}

const props = defineProps<Props>();

// Obtener valores del dispositivo con fallback
const deviceValues = computed(() => {
  return props.device.sensorData || props.device.values || {};
});

const getValuesDisplay = (values: Record<string, any>): Array<{ label: string; value: string }> => {
  return Object.entries(values).map(([key, value]) => ({
    label: formatLabel(key),
    value: formatValue(value),
  }));
};

const formatLabel = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .charAt(0)
    .toUpperCase() + key.slice(1);
};

const formatValue = (value: any): string => {
  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No';
  }
  if (typeof value === 'number') {
    return value.toFixed(1);
  }
  return String(value);
};

const getTypeColor = (type: string): string => {
  const typeColors: Record<string, string> = {
    temperature: '#ff6b35',
    humidity: '#5ba3d0',
    motion: '#2d5088',
    camera: '#9b59b6',
  };
  return typeColors[type] || '#355c7d';
};
</script>

<template>
  <div class="device-info">
    <div class="device-type-badge" :style="{ backgroundColor: getTypeColor(device.type) }">
      {{ device.type }}
    </div>

    <div class="device-values">
      <div v-for="(item, index) in getValuesDisplay(deviceValues)" :key="index" class="value-row">
        <span class="value-label">{{ item.label }}</span>
        <span class="value-display">{{ item.value }}</span>
      </div>

      <div v-if="Object.keys(deviceValues).length === 0" class="no-values">
        No hay datos disponibles
      </div>
    </div>
  </div>
</template>

<style scoped>
.device-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  margin-bottom: 8px;
}

.device-type-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  color: white;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  align-self: flex-start;
}

.device-values {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.value-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid #e5e7eb;
}

.value-row:last-child {
  border-bottom: none;
}

.value-label {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: capitalize;
}

.value-display {
  font-size: 12px;
  font-weight: 600;
  color: #2d5088;
  font-family: monospace;
}

.no-values {
  text-align: center;
  color: #9ca3af;
  font-size: 12px;
  padding: 8px;
}
</style>
