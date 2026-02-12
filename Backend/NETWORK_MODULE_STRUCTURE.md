# Estructura de Base de Datos - Módulo Network (Red)

## Descripción

Este módulo gestiona las estadísticas y configuración de nodos de red. Los datos se obtienen del **ACP (Access Control Point)**, que es el sistema de gestión del nodo.

---

## Tabla de Base de Datos

### network_nodes

```sql
CREATE TABLE network_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'inactive', -- 'active', 'inactive', 'maintenance'
  transmit_power DECIMAL(5, 2), -- dBm
  download_frequency INTEGER, -- MHz
  upload_frequency INTEGER, -- MHz
  throughput_download DECIMAL(10, 2), -- Mbps
  throughput_upload DECIMAL(10, 2), -- Mbps
  gps_latitude DECIMAL(10, 8),
  gps_longitude DECIMAL(11, 8),
  gps_altitude DECIMAL(8, 2), -- metros
  signal_quality INTEGER, -- 0-100
  uptime BIGINT, -- segundos
  temperature DECIMAL(5, 2), -- °C
  acp_endpoint VARCHAR(255), -- URL del ACP para obtener datos
  last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'maintenance')),
  CONSTRAINT valid_signal_quality CHECK (signal_quality >= 0 AND signal_quality <= 100)
);

CREATE INDEX idx_network_nodes_status ON network_nodes(status);
CREATE INDEX idx_network_nodes_last_update ON network_nodes(last_update);
CREATE INDEX idx_network_nodes_node_id ON network_nodes(node_id);
```

---

## Esquema Prisma

```prisma
model NetworkNode {
  id                  String   @id @default(uuid())
  nodeId              String   @unique @map("node_id") @db.VarChar(50)
  name                String   @db.VarChar(255)
  status              String   @default("inactive") @db.VarChar(20)
  transmitPower       Decimal? @map("transmit_power") @db.Decimal(5, 2)
  downloadFrequency   Int?     @map("download_frequency")
  uploadFrequency     Int?     @map("upload_frequency")
  throughputDownload  Decimal? @map("throughput_download") @db.Decimal(10, 2)
  throughputUpload    Decimal? @map("throughput_upload") @db.Decimal(10, 2)
  gpsLatitude         Decimal? @map("gps_latitude") @db.Decimal(10, 8)
  gpsLongitude        Decimal? @map("gps_longitude") @db.Decimal(11, 8)
  gpsAltitude         Decimal? @map("gps_altitude") @db.Decimal(8, 2)
  signalQuality       Int?     @map("signal_quality")
  uptime              BigInt?
  temperature         Decimal? @db.Decimal(5, 2)
  acpEndpoint         String?  @map("acp_endpoint") @db.VarChar(255)
  lastUpdate          DateTime @default(now()) @map("last_update")
  createdAt           DateTime @default(now()) @map("created_at")
  
  @@index([status])
  @@index([lastUpdate])
  @@index([nodeId])
  @@map("network_nodes")
}
```

---

## Endpoints de API

### GET /api/network/nodes

Obtiene todos los nodos de red registrados.

**Respuesta:**
```json
[
  {
    "id": "uuid",
    "nodeId": "NODE-001",
    "name": "Nodo Central Santa Marta",
    "status": "active",
    "transmitPower": 23.5,
    "downloadFrequency": 2450,
    "uploadFrequency": 2450,
    "throughput": {
      "download": 145.2,
      "upload": 98.7
    },
    "gpsLocation": {
      "latitude": 11.018224,
      "longitude": -74.850678,
      "altitude": 12
    },
    "signalQuality": 87,
    "uptime": 3456789,
    "temperature": 42,
    "lastUpdate": 1704987654321
  }
]
```

---

### GET /api/network/nodes/:nodeId

Obtiene estadísticas de un nodo específico.

**Parámetros:**
- `nodeId` (path): ID del nodo (ej: "NODE-001")

**Respuesta:**
```json
{
  "id": "uuid",
  "nodeId": "NODE-001",
  "name": "Nodo Central Santa Marta",
  "status": "active",
  "transmitPower": 23.5,
  "downloadFrequency": 2450,
  "uploadFrequency": 2450,
  "throughput": {
    "download": 145.2,
    "upload": 98.7
  },
  "gpsLocation": {
    "latitude": 11.018224,
    "longitude": -74.850678,
    "altitude": 12
  },
  "signalQuality": 87,
  "uptime": 3456789,
  "temperature": 42,
  "acpEndpoint": "http://192.168.1.100/api/stats",
  "lastUpdate": 1704987654321
}
```

---

### POST /api/network/nodes

Registra un nuevo nodo de red.

**Body:**
```json
{
  "nodeId": "NODE-002",
  "name": "Nodo Secundario",
  "gpsLatitude": 11.020000,
  "gpsLongitude": -74.851000,
  "gpsAltitude": 15,
  "acpEndpoint": "http://192.168.1.101/api/stats"
}
```

**Respuesta:**
```json
{
  "id": "uuid",
  "nodeId": "NODE-002",
  "name": "Nodo Secundario",
  "status": "inactive",
  "gpsLocation": {
    "latitude": 11.020000,
    "longitude": -74.851000,
    "altitude": 15
  },
  "acpEndpoint": "http://192.168.1.101/api/stats",
  "createdAt": 1704987654321
}
```

---

### PUT /api/network/nodes/:nodeId/stats

Actualiza las estadísticas de un nodo (normalmente llamado por el ACP o por polling interno).

**Body:**
```json
{
  "status": "active",
  "transmitPower": 24.0,
  "downloadFrequency": 2450,
  "uploadFrequency": 2450,
  "throughputDownload": 150.5,
  "throughputUpload": 102.3,
  "signalQuality": 89,
  "uptime": 3456800,
  "temperature": 43
}
```

**Respuesta:**
```json
{
  "success": true,
  "nodeId": "NODE-001",
  "lastUpdate": 1704987654321
}
```

---

### POST /api/network/nodes/:nodeId/sync-acp

Sincroniza manualmente las estadísticas con el ACP del nodo.

**Respuesta:**
```json
{
  "success": true,
  "nodeId": "NODE-001",
  "acpEndpoint": "http://192.168.1.100/api/stats",
  "data": {
    "transmitPower": 23.5,
    "downloadFrequency": 2450,
    "uploadFrequency": 2450,
    "throughput": {
      "download": 145.2,
      "upload": 98.7
    },
    "signalQuality": 87,
    "temperature": 42
  },
  "lastUpdate": 1704987654321
}
```

---

## Integración con ACP

El **ACP (Access Control Point)** es el sistema de gestión del nodo. Cada nodo debe exponer un endpoint HTTP que devuelva sus estadísticas en el siguiente formato:

### Endpoint ACP Esperado

**GET `http://<node-ip>/api/stats`**

**Respuesta esperada del ACP:**
```json
{
  "status": "active",
  "transmitPower": 23.5,
  "downloadFrequency": 2450,
  "uploadFrequency": 2450,
  "throughput": {
    "download": 145.2,
    "upload": 98.7
  },
  "signalQuality": 87,
  "uptime": 3456789,
  "temperature": 42,
  "gpsLocation": {
    "latitude": 11.018224,
    "longitude": -74.850678,
    "altitude": 12
  }
}
```

---

## Servicio Backend (network.service.js)

```javascript
import { prisma } from "../../config/prisma.js";
import axios from "axios";

export const NetworkService = {
  // Obtener todos los nodos
  async getNodes() {
    const nodes = await prisma.networkNode.findMany({
      orderBy: { lastUpdate: 'desc' }
    });

    return nodes.map(node => this.formatNodeResponse(node));
  },

  // Obtener nodo específico
  async getNodeById(nodeId) {
    const node = await prisma.networkNode.findUnique({
      where: { nodeId }
    });

    if (!node) {
      throw new Error('Nodo no encontrado');
    }

    return this.formatNodeResponse(node);
  },

  // Registrar nuevo nodo
  async registerNode(data) {
    const node = await prisma.networkNode.create({
      data: {
        nodeId: data.nodeId,
        name: data.name,
        gpsLatitude: data.gpsLatitude,
        gpsLongitude: data.gpsLongitude,
        gpsAltitude: data.gpsAltitude,
        acpEndpoint: data.acpEndpoint,
      }
    });

    return this.formatNodeResponse(node);
  },

  // Actualizar estadísticas
  async updateNodeStats(nodeId, stats) {
    const node = await prisma.networkNode.update({
      where: { nodeId },
      data: {
        status: stats.status,
        transmitPower: stats.transmitPower,
        downloadFrequency: stats.downloadFrequency,
        uploadFrequency: stats.uploadFrequency,
        throughputDownload: stats.throughputDownload,
        throughputUpload: stats.throughputUpload,
        signalQuality: stats.signalQuality,
        uptime: stats.uptime,
        temperature: stats.temperature,
        lastUpdate: new Date(),
      }
    });

    return this.formatNodeResponse(node);
  },

  // Sincronizar con ACP
  async syncWithACP(nodeId) {
    const node = await prisma.networkNode.findUnique({
      where: { nodeId }
    });

    if (!node || !node.acpEndpoint) {
      throw new Error('Nodo no encontrado o sin ACP configurado');
    }

    try {
      const response = await axios.get(node.acpEndpoint, { timeout: 5000 });
      const acpData = response.data;

      // Actualizar con datos del ACP
      const updated = await this.updateNodeStats(nodeId, {
        status: acpData.status,
        transmitPower: acpData.transmitPower,
        downloadFrequency: acpData.downloadFrequency,
        uploadFrequency: acpData.uploadFrequency,
        throughputDownload: acpData.throughput.download,
        throughputUpload: acpData.throughput.upload,
        signalQuality: acpData.signalQuality,
        uptime: acpData.uptime,
        temperature: acpData.temperature,
      });

      return { success: true, data: acpData, node: updated };
    } catch (error) {
      throw new Error(`Error al conectar con ACP: ${error.message}`);
    }
  },

  // Formatear respuesta
  formatNodeResponse(node) {
    return {
      id: node.id,
      nodeId: node.nodeId,
      name: node.name,
      status: node.status,
      transmitPower: node.transmitPower ? parseFloat(node.transmitPower) : null,
      downloadFrequency: node.downloadFrequency,
      uploadFrequency: node.uploadFrequency,
      throughput: {
        download: node.throughputDownload ? parseFloat(node.throughputDownload) : null,
        upload: node.throughputUpload ? parseFloat(node.throughputUpload) : null,
      },
      gpsLocation: {
        latitude: node.gpsLatitude ? parseFloat(node.gpsLatitude) : null,
        longitude: node.gpsLongitude ? parseFloat(node.gpsLongitude) : null,
        altitude: node.gpsAltitude ? parseFloat(node.gpsAltitude) : null,
      },
      signalQuality: node.signalQuality,
      uptime: node.uptime ? parseInt(node.uptime) : null,
      temperature: node.temperature ? parseFloat(node.temperature) : null,
      acpEndpoint: node.acpEndpoint,
      lastUpdate: node.lastUpdate.getTime(),
    };
  },
};
```

---

## Polling en Frontend

```typescript
// En NetworkView.vue
const fetchNodeStats = async () => {
  try {
    const res = await fetch(`${API_URL}/api/network/nodes/${nodeId}`, {
      credentials: 'include',
      headers: authStore.getAuthHeaders()
    });
    
    if (res.ok) {
      nodeStats.value = await res.json();
    }
  } catch (error) {
    console.error('Error al cargar estadísticas del nodo:', error);
  }
};

// Iniciar polling cada 3 segundos
const startPolling = () => {
  fetchNodeStats();
  pollingInterval = setInterval(fetchNodeStats, 3000);
};
```

---

## Datos de Prueba

```sql
INSERT INTO network_nodes (
  node_id, name, status,
  transmit_power, download_frequency, upload_frequency,
  throughput_download, throughput_upload,
  gps_latitude, gps_longitude, gps_altitude,
  signal_quality, uptime, temperature,
  acp_endpoint
) VALUES (
  'NODE-001', 'Nodo Central Santa Marta', 'active',
  23.5, 2450, 2450,
  145.2, 98.7,
  11.018224, -74.850678, 12,
  87, 3456789, 42,
  'http://192.168.1.100/api/stats'
);
```

---

## Resumen

1. **Base de datos:** Tabla `network_nodes` con todos los datos del nodo
2. **Endpoints:** GET nodes, GET node by ID, POST register, PUT update stats, POST sync ACP
3. **ACP Integration:** Cada nodo expone endpoint HTTP con sus estadísticas
4. **Polling:** Frontend consulta cada 3 segundos para mantener datos actualizados
5. **Formato:** Respuestas JSON estructuradas con throughput, GPS, RF stats
