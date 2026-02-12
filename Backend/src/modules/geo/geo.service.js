import { prisma } from "../../config/prisma.js";

export const GeoService = {
  //////////////////////////////////////////////////
  // USERS GEO TRACKING
  //////////////////////////////////////////////////

  /**
   * Obtiene todos los usuarios con ubicación activa
   * @returns {Promise<Array>} Lista de usuarios con ubicación
   */
  async getUsers() {
    try {
      const geoUsers = await prisma.geoUser.findMany({
        where: { online: true },
        include: {
          account: {
            select: {
              id: true,
              name: true,
              username: true,
              role: true,
            },
          },
        },
        orderBy: { lastUpdate: 'desc' },
      });

      // Transformar al formato esperado por el frontend
      return geoUsers.map(geoUser => ({
        id: geoUser.id,
        accountId: geoUser.accountId,
        name: geoUser.account.name,
        username: geoUser.account.username,
        role: geoUser.account.role,
        location: {
          latitude: parseFloat(geoUser.latitude),
          longitude: parseFloat(geoUser.longitude),
        },
        online: geoUser.online,
        timestamp: geoUser.lastUpdate.getTime(),
      }));
    } catch (error) {
      console.error('Error al obtener usuarios geo:', error);
      throw new Error('Error al obtener usuarios con ubicación');
    }
  },

  /**
   * Actualiza o crea la ubicación de un usuario
   * @param {string} accountId - ID de la cuenta del usuario
   * @param {number} latitude - Latitud
   * @param {number} longitude - Longitud
   * @returns {Promise<Object>} Usuario geo actualizado
   */
  async updateUserLocation(accountId, latitude, longitude) {
    try {
      const geoUser = await prisma.geoUser.upsert({
        where: { accountId },
        update: {
          latitude,
          longitude,
          online: true,
          lastUpdate: new Date(),
        },
        create: {
          accountId,
          latitude,
          longitude,
          online: true,
        },
        include: {
          account: {
            select: {
              id: true,
              name: true,
              username: true,
              role: true,
            },
          },
        },
      });

      return {
        id: geoUser.id,
        accountId: geoUser.accountId,
        name: geoUser.account.name,
        username: geoUser.account.username,
        role: geoUser.account.role,
        location: {
          latitude: parseFloat(geoUser.latitude),
          longitude: parseFloat(geoUser.longitude),
        },
        online: geoUser.online,
        timestamp: geoUser.lastUpdate.getTime(),
      };
    } catch (error) {
      console.error('Error al actualizar ubicación de usuario:', error);
      throw new Error('Error al actualizar ubicación');
    }
  },

  /**
   * Marca un usuario como offline
   * @param {string} accountId - ID de la cuenta del usuario
   */
  async setUserOffline(accountId) {
    try {
      await prisma.geoUser.update({
        where: { accountId },
        data: { online: false },
      });
    } catch (error) {
      console.error('Error al marcar usuario offline:', error);
    }
  },

  //////////////////////////////////////////////////
  // DEVICES GEO TRACKING
  //////////////////////////////////////////////////

  /**
   * Obtiene todos los dispositivos/sensores activos
   * @returns {Promise<Array>} Lista de dispositivos con ubicación
   */
  async getDevices() {
    try {
      const devices = await prisma.geoDevice.findMany({
        where: { online: true },
        orderBy: { lastUpdate: 'desc' },
      });

      // Transformar al formato esperado por el frontend
      return devices.map(device => ({
        id: device.id,
        name: device.name,
        type: device.type,
        location: {
          latitude: parseFloat(device.latitude),
          longitude: parseFloat(device.longitude),
        },
        online: device.online,
        sensorData: device.sensorData || {},
        timestamp: device.lastUpdate.getTime(),
      }));
    } catch (error) {
      console.error('Error al obtener dispositivos geo:', error);
      throw new Error('Error al obtener dispositivos');
    }
  },

  /**
   * Crea o actualiza un dispositivo geo
   * @param {Object} deviceData - Datos del dispositivo
   * @returns {Promise<Object>} Dispositivo creado/actualizado
   */
  async upsertDevice({ id, name, type, latitude, longitude, sensorData }) {
    try {
      const device = await prisma.geoDevice.upsert({
        where: { id: id || 'new-device' },
        update: {
          name,
          type,
          latitude,
          longitude,
          sensorData,
          online: true,
          lastUpdate: new Date(),
        },
        create: {
          name,
          type,
          latitude,
          longitude,
          sensorData,
          online: true,
        },
      });

      return {
        id: device.id,
        name: device.name,
        type: device.type,
        location: {
          latitude: parseFloat(device.latitude),
          longitude: parseFloat(device.longitude),
        },
        online: device.online,
        sensorData: device.sensorData || {},
        timestamp: device.lastUpdate.getTime(),
      };
    } catch (error) {
      console.error('Error al crear/actualizar dispositivo:', error);
      throw new Error('Error al guardar dispositivo');
    }
  },

  /**
   * Actualiza los datos de sensores de un dispositivo
   * @param {string} deviceId - ID del dispositivo
   * @param {Object} sensorData - Datos del sensor
   */
  async updateDeviceSensorData(deviceId, sensorData) {
    try {
      await prisma.geoDevice.update({
        where: { id: deviceId },
        data: {
          sensorData,
          lastUpdate: new Date(),
        },
      });
    } catch (error) {
      console.error('Error al actualizar datos de sensor:', error);
      throw new Error('Error al actualizar datos');
    }
  },

  /**
   * Marca un dispositivo como offline
   * @param {string} deviceId - ID del dispositivo
   */
  async setDeviceOffline(deviceId) {
    try {
      await prisma.geoDevice.update({
        where: { id: deviceId },
        data: { online: false },
      });
    } catch (error) {
      console.error('Error al marcar dispositivo offline:', error);
    }
  },
};
