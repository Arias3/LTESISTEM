import { prisma } from "../../config/prisma.js";
import axios from "axios";

export const SensorsService = {
  //////////////////////////////////////////////////
  // DEVICES MANAGEMENT
  //////////////////////////////////////////////////

  async registerDevice({ displayName, ipAddress, samplingInterval = 3000 }) {
    if (!ipAddress) throw new Error("IP requerida para registrar dispositivo");
    if (!displayName) throw new Error("displayName es requerido");

    // Primero hacemos un GET al ESP para obtener los datos iniciales
    let espData;
    try {
        const port = 8000; // puerto donde corre el ESP simulado
        const resp = await axios.get(`http://${ipAddress}:${port}/init`, { timeout: 5000 });
        espData = resp.data;
    } catch (error) {
        throw new Error(`No se pudo conectar al ESP en ${ipAddress}: ${error.message}`);
    }

    // Validar que el ESP devuelva los campos necesarios
    if (!espData || !espData.sensors || !Array.isArray(espData.sensors)) {
        throw new Error("El ESP no devolvió información válida de sensores");
    }

    // Crear el dispositivo en la base de datos, guardando los sensores como JSON
    const device = await prisma.device.create({
        data: {
        displayName: displayName,
        ipAddress: ipAddress,
        status: "ACTIVE",          // Si conectó correctamente, lo dejamos activo
        samplingInterval,          // ms
        sensors: espData.sensors   // Guardamos el JSON completo de sensores
        },
        });
        return device;
  },

  async getDevices() {
    return prisma.device.findMany({
      orderBy: { createdAt: "desc" }
    });
  },

  async getDeviceById(deviceId) {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: { sensors: true },
    });

    if (!device) throw new Error("Dispositivo no encontrado");
    return device;
  },

  async setDeviceName(deviceId, name) {
    return prisma.device.update({
      where: { id: deviceId },
      data: { displayName: name },
    });
  },

  async setDeviceStatus(deviceId, status) {
    if (!["ACTIVE", "INACTIVE"].includes(status))
      throw new Error("Solo se puede cambiar entre ACTIVE e INACTIVE manualmente");
    return prisma.device.update({
      where: { id: deviceId },
      data: { status },
    });
  },

  /**
   * Verifica manualmente un dispositivo defectuoso
   * Si responde correctamente, lo marca como ACTIVE
   * Si falla, sigue en DEFECTUOSO
   */
  async verifyDefective(deviceId) {
    const device = await this.getDeviceById(deviceId);
    try {
      const url = `http://${device.ipAddress}/data`;
      await axios.get(url, { timeout: 5000 });

      // Si responde, lo marcamos como ACTIVE
      await prisma.device.update({
        where: { id: device.id },
        data: { status: "ACTIVE" },
      });
      return { success: true, deviceId: device.id };
    } catch (error) {
      // Sigue defectuoso
      return { success: false, deviceId: device.id };
    }
  },

  //////////////////////////////////////////////////
  // POLLING AUTOMÁTICO
  //////////////////////////////////////////////////

  /**
   * Polling de un dispositivo activo
   */
  async pollDevice(device) {
    if (device.status !== "ACTIVE") return null;
    if (!device.ipAddress) throw new Error("El dispositivo no tiene IP registrada");

    const url = `http://${device.ipAddress}/data`;
    const now = new Date();

    try {
      const response = await axios.get(url, { timeout: 5000 });
      const data = response.data;

      // Actualizar estado del dispositivo como activo
      await prisma.device.update({
        where: { id: device.id },
        data: { status: "ACTIVE", lastSeenAt: now },
      });

      // Iterar sensores recibidos del ESP
      if (data.sensors && Array.isArray(data.sensors)) {
        for (const s of data.sensors) {
          const existing = await prisma.sensor.findFirst({
            where: { deviceId: device.id, type: s.type },
          });

          if (existing) {
            await prisma.sensor.update({
              where: { id: existing.id },
              data: {
                friendlyName: s.friendlyName || existing.friendlyName,
                unit: s.unit || existing.unit,
                lastValue: s.value,
                lastUpdateAt: now,
              },
            });
          } else {
            await prisma.sensor.create({
              data: {
                deviceId: device.id,
                type: s.type,
                friendlyName: s.friendlyName || s.type,
                unit: s.unit || null,
                lastValue: s.value,
                lastUpdateAt: now,
                isEnabled: true,
              },
            });
          }
        }
      }

      return { success: true, deviceId: device.id };
    } catch (error) {
      // Si falla polling, lo marcamos como DEFECTUOSO
      await prisma.device.update({
        where: { id: device.id },
        data: { status: "DEFECTUOSO" },
      });
      console.error(`Polling failed for device ${device.id}:`, error.message);
      return { success: false, deviceId: device.id };
    }
  },

  /**
   * Polling automático de todos los dispositivos activos
   */
  async pollAllDevices() {
    const devices = await prisma.device.findMany({
      where: { status: "ACTIVE" },
    });

    for (const device of devices) {
      await this.pollDevice(device);
    }
  },

  //////////////////////////////////////////////////
  // DATA READING (CONSULTAS)
  //////////////////////////////////////////////////

  async getLastReading(deviceId) {
    return prisma.sensor.findMany({
      where: { deviceId },
      orderBy: { lastUpdateAt: "desc" },
      take: 1,
    });
  },

  async getHistory(deviceId, limit = 50) {
    return prisma.sensor.findMany({
      where: { deviceId },
      orderBy: { lastUpdateAt: "desc" },
      take: limit,
    });
  },
};
