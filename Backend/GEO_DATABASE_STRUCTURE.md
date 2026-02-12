# Estructura de Base de Datos - Módulo Geo

## Tablas Necesarias

### 1. geo_users
Almacena información de usuarios con ubicación activa.

```sql
CREATE TABLE geo_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  online BOOLEAN DEFAULT true,
  last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(account_id)
);

CREATE INDEX idx_geo_users_online ON geo_users(online);
CREATE INDEX idx_geo_users_last_update ON geo_users(last_update);
```

**Campos:**
- `id`: Identificador único del registro
- `account_id`: Referencia al usuario (tabla accounts)
- `latitude`: Latitud de la ubicación (-90 a 90)
- `longitude`: Longitud de la ubicación (-180 a 180)
- `online`: Estado de conexión del usuario
- `last_update`: Última actualización de la ubicación
- `created_at`: Fecha de creación del registro

---

### 2. geo_devices
Almacena dispositivos/sensores con ubicación fija o móvil.

```sql
CREATE TABLE geo_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'camera', 'sensor', 'gateway', 'beacon'
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  online BOOLEAN DEFAULT true,
  sensor_data JSONB, -- Datos específicos del sensor
  last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_geo_devices_type ON geo_devices(type);
CREATE INDEX idx_geo_devices_online ON geo_devices(online);
CREATE INDEX idx_geo_devices_last_update ON geo_devices(last_update);
```

**Campos:**
- `id`: Identificador único del dispositivo
- `name`: Nombre descriptivo del dispositivo
- `type`: Tipo de dispositivo (camera, sensor, gateway, beacon)
- `latitude`: Latitud de la ubicación
- `longitude`: Longitud de la ubicación
- `online`: Estado de conexión del dispositivo
- `sensor_data`: Datos JSON con valores específicos del sensor
- `last_update`: Última actualización de datos
- `created_at`: Fecha de creación del registro

**Ejemplo de sensor_data:**
```json
{
  "temperature": 24.5,
  "humidity": 65,
  "movement": false,
  "battery": 78
}
```

---

## Endpoints de API

### GET /api/geo/users
Obtiene todos los usuarios con ubicación activa.

**Respuesta:**
```json
[
  {
    "id": "uuid",
    "accountId": "uuid",
    "name": "Juan Pérez",
    "username": "jperez",
    "role": "admin",
    "location": {
      "latitude": 11.018224,
      "longitude": -74.850678
    },
    "online": true,
    "timestamp": 1704987654321
  }
]
```

**Query desde Prisma:**
```typescript
const geoUsers = await prisma.geo_users.findMany({
  where: { online: true },
  include: {
    account: {
      select: {
        id: true,
        name: true,
        username: true,
        role: true
      }
    }
  }
});
```

---

### GET /api/geo/devices
Obtiene todos los dispositivos/sensores activos.

**Respuesta:**
```json
[
  {
    "id": "uuid",
    "name": "Sensor Norte",
    "type": "sensor",
    "location": {
      "latitude": 11.0188,
      "longitude": -74.851
    },
    "online": true,
    "sensorData": {
      "temperature": 24.5,
      "humidity": 65,
      "movement": false,
      "battery": 78
    },
    "timestamp": 1704987654321
  }
]
```

**Query desde Prisma:**
```typescript
const devices = await prisma.geo_devices.findMany({
  where: { online: true }
});
```

---

## Esquema Prisma

```prisma
model GeoUser {
  id         String   @id @default(uuid())
  accountId  String   @unique @map("account_id")
  latitude   Decimal  @db.Decimal(10, 8)
  longitude  Decimal  @db.Decimal(11, 8)
  online     Boolean  @default(true)
  lastUpdate DateTime @default(now()) @map("last_update")
  createdAt  DateTime @default(now()) @map("created_at")
  
  account    Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  
  @@index([online])
  @@index([lastUpdate])
  @@map("geo_users")
}

model GeoDevice {
  id         String   @id @default(uuid())
  name       String   @db.VarChar(255)
  type       String   @db.VarChar(50)
  latitude   Decimal  @db.Decimal(10, 8)
  longitude  Decimal  @db.Decimal(11, 8)
  online     Boolean  @default(true)
  sensorData Json?    @map("sensor_data")
  lastUpdate DateTime @default(now()) @map("last_update")
  createdAt  DateTime @default(now()) @map("created_at")
  
  @@index([type])
  @@index([online])
  @@index([lastUpdate])
  @@map("geo_devices")
}
```

---

## Polling en Frontend

El frontend debe consultar ambos endpoints cada 3-5 segundos:

```typescript
// En geo.ts store
let pollingInterval: ReturnType<typeof setInterval> | null = null;

async function fetchUsers() {
  const res = await fetch(`${API_URL}/api/geo/users`, {
    credentials: 'include',
    headers: authStore.getAuthHeaders()
  });
  if (res.ok) {
    users.value = await res.json();
  }
}

async function fetchDevices() {
  const res = await fetch(`${API_URL}/api/geo/devices`, {
    credentials: 'include',
    headers: authStore.getAuthHeaders()
  });
  if (res.ok) {
    devices.value = await res.json();
  }
}

function startPolling() {
  // Carga inicial
  await Promise.all([fetchUsers(), fetchDevices()]);
  
  // Polling cada 3 segundos
  pollingInterval = setInterval(async () => {
    await Promise.all([fetchUsers(), fetchDevices()]);
  }, 3000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
```

---

## Migración SQL para PostgreSQL

```sql
-- Crear tabla geo_users
CREATE TABLE geo_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  online BOOLEAN DEFAULT true,
  last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_geo_users_account FOREIGN KEY (account_id) 
    REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT unique_account_location UNIQUE (account_id)
);

CREATE INDEX idx_geo_users_online ON geo_users(online);
CREATE INDEX idx_geo_users_last_update ON geo_users(last_update);

-- Crear tabla geo_devices
CREATE TABLE geo_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  online BOOLEAN DEFAULT true,
  sensor_data JSONB,
  last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_geo_devices_type ON geo_devices(type);
CREATE INDEX idx_geo_devices_online ON geo_devices(online);
CREATE INDEX idx_geo_devices_last_update ON geo_devices(last_update);

-- Datos de prueba
INSERT INTO geo_devices (name, type, latitude, longitude, online, sensor_data) VALUES
  ('Sensor Norte', 'sensor', 11.0188, -74.851, true, '{"temperature": 24.5, "humidity": 65, "movement": false, "battery": 78}'),
  ('Cámara Entrada', 'camera', 11.0198, -74.852, true, '{"status": "recording", "fps": 30, "resolution": "1080p"}'),
  ('Gateway Central', 'gateway', 11.0168, -74.8492, true, '{"connected_devices": 12, "signal_strength": 85}'),
  ('Beacon Sur', 'beacon', 11.0175, -74.8522, true, '{"battery": 92, "range": 50}');
```
