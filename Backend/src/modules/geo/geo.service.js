import { prisma } from "../../config/prisma.js";

export const GeoService = {
  USER_ONLINE_TIMEOUT_MS: 90_000,
  DEFAULT_DEVICE_LAT: 11.019464,
  DEFAULT_DEVICE_LNG: -74.851522,

  //////////////////////////////////////////////////
  // USERS GEO TRACKING
  //////////////////////////////////////////////////

  async markStaleUsersOffline(timeoutMs = 90_000) {
    try {
      const cutoff = new Date(Date.now() - timeoutMs);
      await prisma.geoUser.updateMany({
        where: {
          online: true,
          lastUpdate: { lt: cutoff },
        },
        data: { online: false },
      });
    } catch (error) {
      console.error("Error limpiando usuarios stale:", error);
    }
  },

  async getUsers(includeOffline = true) {
    try {
      await this.markStaleUsersOffline(this.USER_ONLINE_TIMEOUT_MS);

      const users = await prisma.user.findMany({
        where: {
          NOT: {
            username: {
              startsWith: "ESP32-",
            },
          },
        },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          geoLocation: {
            select: {
              id: true,
              latitude: true,
              longitude: true,
              online: true,
              lastUpdate: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      const mapped = users.map((user) => {
        const geo = user.geoLocation;
        const hasLocation =
          geo &&
          geo.latitude !== null &&
          geo.longitude !== null;
        const lastUpdateMs = geo?.lastUpdate ? geo.lastUpdate.getTime() : 0;
        const isRecent = lastUpdateMs > 0 && Date.now() - lastUpdateMs <= this.USER_ONLINE_TIMEOUT_MS;

        return {
          id: geo?.id || user.id,
          accountId: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          location: hasLocation
            ? {
                latitude: parseFloat(geo.latitude),
                longitude: parseFloat(geo.longitude),
              }
            : null,
          online: Boolean(geo?.online) && isRecent,
          timestamp: lastUpdateMs,
          lastUpdate: geo?.lastUpdate ? geo.lastUpdate.toISOString() : null,
        };
      });

      if (includeOffline) return mapped;
      return mapped.filter((u) => u.online);
    } catch (error) {
      console.error('Error al obtener usuarios geo:', error);
      throw new Error('Error al obtener usuarios con ubicación');
    }
  },

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
  // DEVICES / ESP32
  //////////////////////////////////////////////////

  /** Formato estándar de dispositivo para respuestas */
  _formatDevice(device) {
    return {
      id: device.id,
      deviceId: device.deviceId,
      name: device.name,
      description: device.description,
      type: device.type,
      networkType: device.networkType,
      hasGps: device.hasGps,
      latitude: parseFloat(device.latitude),
      longitude: parseFloat(device.longitude),
      location: {
        latitude: parseFloat(device.latitude),
        longitude: parseFloat(device.longitude),
      },
      sensorData: device.sensorData || {},
      sensorConfig: device.sensorConfig || {},
      samplingInterval: device.samplingInterval,
      programmedBy: device.programmedBy,
      programmedAt: device.programmedAt,
      lastUpdate: device.lastUpdate.toISOString(),
      timestamp: device.lastUpdate.getTime(),
    };
  },

  _formatCatalogWithGeo(catalogDevice, geoDevice) {
    const latitude = geoDevice ? parseFloat(geoDevice.latitude) : parseFloat(catalogDevice.latitude);
    const longitude = geoDevice ? parseFloat(geoDevice.longitude) : parseFloat(catalogDevice.longitude);
    const lastUpdateDate = geoDevice?.lastUpdate || catalogDevice.updatedAt;

    return {
      id: geoDevice?.id || catalogDevice.id,
      catalogId: catalogDevice.id,
      deviceId: catalogDevice.deviceId,
      name: geoDevice?.name || catalogDevice.displayName,
      description: geoDevice?.description || null,
      type: geoDevice?.type || "sensor",
      networkType: geoDevice?.networkType || catalogDevice.networkType || "wifi",
      hasGps: geoDevice?.hasGps ?? catalogDevice.hasGps,
      latitude,
      longitude,
      location: { latitude, longitude },
      sensorData: geoDevice?.sensorData || {},
      sensorConfig: geoDevice?.sensorConfig || catalogDevice.sensors || {},
      samplingInterval: geoDevice?.samplingInterval || catalogDevice.samplingInterval || 5,
      programmedBy: geoDevice?.programmedBy || null,
      programmedAt: geoDevice?.programmedAt || null,
      lastUpdate: lastUpdateDate?.toISOString?.() || new Date().toISOString(),
      timestamp: lastUpdateDate?.getTime?.() || Date.now(),
      ipAddress: catalogDevice.ipAddress || null,
    };
  },

  async _upsertCatalogDevice({
    deviceId,
    displayName,
    networkType,
    hasGps,
    latitude,
    longitude,
    samplingInterval,
    sensors,
    status,
  }) {
    const existing = await prisma.device.findUnique({ where: { deviceId } });

    const latitudeNum = Number(latitude);
    const longitudeNum = Number(longitude);
    const hasValidCoordinates =
      Number.isFinite(latitudeNum) &&
      Number.isFinite(longitudeNum) &&
      latitudeNum >= -90 && latitudeNum <= 90 &&
      longitudeNum >= -180 && longitudeNum <= 180;

    const hasGpsEnabled = hasGps === true;
    const shouldUseIncomingGpsLocation = hasGpsEnabled && hasValidCoordinates;

    const resolvedLatitude = shouldUseIncomingGpsLocation
      ? latitudeNum
      : (existing ? Number(existing.latitude) : this.DEFAULT_DEVICE_LAT);

    const resolvedLongitude = shouldUseIncomingGpsLocation
      ? longitudeNum
      : (existing ? Number(existing.longitude) : this.DEFAULT_DEVICE_LNG);

    if (existing) {
      return prisma.device.update({
        where: { deviceId },
        data: {
          displayName: displayName || existing.displayName,
          networkType: networkType || existing.networkType,
          hasGps: hasGps !== undefined ? hasGps : existing.hasGps,
          latitude: resolvedLatitude,
          longitude: resolvedLongitude,
          samplingInterval: samplingInterval || existing.samplingInterval || 5,
          sensors: sensors || existing.sensors || {},
          status: status || existing.status || "ACTIVE",
        },
      });
    }

    return prisma.device.create({
      data: {
        deviceId,
        displayName: displayName || deviceId,
        networkType: networkType || "wifi",
        hasGps: hasGps || false,
        latitude: resolvedLatitude,
        longitude: resolvedLongitude,
        samplingInterval: samplingInterval || 5,
        sensors: sensors || {},
        status: status || "ACTIVE",
      },
    });
  },

  /** Todos los dispositivos */
  async getDevices(onlineOnly = false) {
    try {
      const [catalogDevices, geoDevices] = await Promise.all([
        prisma.device.findMany({
          orderBy: { updatedAt: "desc" },
        }),
        prisma.geoDevice.findMany({
          orderBy: { lastUpdate: "desc" },
        }),
      ]);

      const geoByDeviceId = new Map(geoDevices.map((d) => [d.deviceId, d]));

      const merged = catalogDevices
        .map((catalog) => this._formatCatalogWithGeo(catalog, geoByDeviceId.get(catalog.deviceId)));

      const catalogIds = new Set(catalogDevices.map((d) => d.deviceId));
      for (const geo of geoDevices) {
        if (catalogIds.has(geo.deviceId)) continue;
        merged.push(this._formatDevice(geo));
      }

      merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return merged;
    } catch (error) {
      console.error("Error al obtener dispositivos:", error);
      throw new Error("Error al obtener dispositivos");
    }
  },

  /** Buscar por hardware ID */
  async findByDeviceId(deviceId) {
    try {
      const [catalog, geo] = await Promise.all([
        prisma.device.findUnique({ where: { deviceId } }),
        prisma.geoDevice.findUnique({ where: { deviceId } }),
      ]);

      if (!catalog && !geo) return null;
      if (catalog) return this._formatCatalogWithGeo(catalog, geo || null);
      return this._formatDevice(geo);
    } catch (error) {
      console.error("Error buscando dispositivo:", error);
      return null;
    }
  },

  /** Registra un ESP32 (crea si no existe, marca online si existe) */
  async registerDevice({
    deviceId,
    name,
    type,
    networkType,
    latitude,
    longitude,
    hasGps,
    sensorConfig,
    samplingInterval,
  }) {
    try {
      const latitudeNum = Number(latitude);
      const longitudeNum = Number(longitude);
      const hasValidCoordinates =
        Number.isFinite(latitudeNum) &&
        Number.isFinite(longitudeNum) &&
        latitudeNum >= -90 && latitudeNum <= 90 &&
        longitudeNum >= -180 && longitudeNum <= 180;

      const hasGpsEnabled = hasGps === true;
      const shouldUseIncomingGpsLocation = hasGpsEnabled && hasValidCoordinates;

      const existing = await prisma.geoDevice.findUnique({ where: { deviceId } });

      await this._upsertCatalogDevice({
        deviceId,
        displayName: name || deviceId,
        networkType: networkType || "wifi",
        hasGps: hasGps || false,
        latitude: shouldUseIncomingGpsLocation ? latitudeNum : this.DEFAULT_DEVICE_LAT,
        longitude: shouldUseIncomingGpsLocation ? longitudeNum : this.DEFAULT_DEVICE_LNG,
        samplingInterval: samplingInterval || 5,
        sensors: sensorConfig || {},
        status: "ACTIVE",
      });

      if (existing) {
        const device = await prisma.geoDevice.update({
          where: { deviceId },
          data: {
            name: name || undefined,
            type: type || undefined,
            networkType: networkType || undefined,
            hasGps: hasGps !== undefined ? hasGps : undefined,
            samplingInterval: samplingInterval || undefined,
            latitude: shouldUseIncomingGpsLocation ? latitudeNum : undefined,
            longitude: shouldUseIncomingGpsLocation ? longitudeNum : undefined,
            sensorConfig: sensorConfig || undefined,
            lastUpdate: new Date(),
          },
        });
        
        // Log PIR status change if sensorConfig has PIR
        if (sensorConfig?.pir && typeof sensorConfig.pir === 'object') {
          const pirValue = sensorConfig.pir.value ?? sensorConfig.pir.detected;
          if (typeof pirValue === 'number' && (pirValue === 0 || pirValue === 1)) {
            const lastLog = await prisma.sensorChangeLog.findFirst({
              where: { deviceId, sensorName: 'pir' },
              orderBy: { changedAt: 'desc' },
            });
            if (!lastLog || lastLog.newValue !== pirValue) {
              await prisma.sensorChangeLog.create({
                data: {
                  deviceId,
                  sensorName: 'pir',
                  previousValue: lastLog?.newValue ?? null,
                  newValue: pirValue,
                  changedAt: new Date(),
                },
              });
            }
          }
        }
        
        return this._formatDevice(device);
      }

      const initialLatitude = shouldUseIncomingGpsLocation ? latitudeNum : this.DEFAULT_DEVICE_LAT;
      const initialLongitude = shouldUseIncomingGpsLocation ? longitudeNum : this.DEFAULT_DEVICE_LNG;

      const created = await prisma.geoDevice.create({
        data: {
          deviceId,
          name: name || `ESP32-${deviceId.slice(-4)}`,
          type: type || "sensor",
          networkType: networkType || "wifi",
          latitude: initialLatitude,
          longitude: initialLongitude,
          hasGps: hasGps || false,
          sensorConfig: sensorConfig || {},
          samplingInterval: samplingInterval || 5,
        },
      });
      
      // Log PIR status change on first registration if sensorConfig has PIR
      if (sensorConfig?.pir && typeof sensorConfig.pir === 'object') {
        const pirValue = sensorConfig.pir.value ?? sensorConfig.pir.detected;
        if (typeof pirValue === 'number' && (pirValue === 0 || pirValue === 1)) {
          await prisma.sensorChangeLog.create({
            data: {
              deviceId: created.deviceId,
              sensorName: 'pir',
              previousValue: null,  // First registration has no previous value
              newValue: pirValue,
              changedAt: new Date(),
            },
          });
        }
      }

      return this._formatDevice(created);
    } catch (error) {
      console.error("Error registrando dispositivo:", error);
      throw new Error("Error al registrar dispositivo");
    }
  },

  /** Actualiza config desde el frontend */
  async updateDeviceConfig(deviceId, config) {
    try {
      const data = {};
      const catalogData = {};
      if (config.name !== undefined) data.name = String(config.name).trim();
      if (config.name !== undefined) catalogData.displayName = String(config.name).trim();
      if (config.description !== undefined) {
        const description = String(config.description).trim();
        data.description = description.length > 0 ? description : null;
      }
      if (config.type !== undefined) data.type = String(config.type).trim();

      if (config.hasGps !== undefined) {
        const hasGps = Boolean(config.hasGps);
        data.hasGps = hasGps;
        catalogData.hasGps = hasGps;
      }

      if (config.networkType !== undefined) {
        const networkType = String(config.networkType).trim();
        if (networkType) {
          data.networkType = networkType;
          catalogData.networkType = networkType;
        }
      }

      if (config.latitude !== undefined) {
        const latitude = Number(config.latitude);
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
          throw new Error("Latitud inválida");
        }
        data.latitude = latitude;
        catalogData.latitude = latitude;
      }

      if (config.longitude !== undefined) {
        const longitude = Number(config.longitude);
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
          throw new Error("Longitud inválida");
        }
        data.longitude = longitude;
        catalogData.longitude = longitude;
      }

      if (config.samplingInterval !== undefined) {
        const samplingInterval = Number(config.samplingInterval);
        if (!Number.isInteger(samplingInterval) || samplingInterval < 1 || samplingInterval > 300) {
          throw new Error("Intervalo de muestreo inválido");
        }
        data.samplingInterval = samplingInterval;
        catalogData.samplingInterval = samplingInterval;
      }

      if (config.sensorConfig !== undefined) {
        data.sensorConfig = config.sensorConfig || {};
        catalogData.sensors = config.sensorConfig || {};
      }

      catalogData.status = "ACTIVE";

      await prisma.device.update({
        where: { deviceId },
        data: catalogData,
      });

      if (config.programmedBy !== undefined) {
        const programmedBy = String(config.programmedBy).trim();
        data.programmedBy = programmedBy.length > 0 ? programmedBy : null;
      }

      if (config.programmedAt !== undefined && config.programmedAt !== null && String(config.programmedAt).trim() !== "") {
        const programmedAt = new Date(config.programmedAt);
        if (Number.isNaN(programmedAt.getTime())) {
          throw new Error("Fecha de programación inválida");
        }
        data.programmedAt = programmedAt;
      }

      data.lastUpdate = new Date();

      const existingGeo = await prisma.geoDevice.findUnique({ where: { deviceId } });
      if (existingGeo) {
        await prisma.geoDevice.update({
          where: { deviceId },
          data,
        });
      } else {
        const catalog = await prisma.device.findUnique({ where: { deviceId } });
        if (!catalog) throw new Error("Dispositivo no encontrado");

        await prisma.geoDevice.create({
          data: {
            deviceId,
            name: String(catalogData.displayName || catalog.displayName || deviceId),
            type: String(data.type || "sensor"),
            networkType: String(data.networkType || catalog.networkType || "wifi"),
            latitude: data.latitude !== undefined ? Number(data.latitude) : Number(catalog.latitude),
            longitude: data.longitude !== undefined ? Number(data.longitude) : Number(catalog.longitude),
            hasGps: data.hasGps !== undefined ? Boolean(data.hasGps) : Boolean(catalog.hasGps),
            sensorConfig: data.sensorConfig || catalog.sensors || {},
            samplingInterval: data.samplingInterval || catalog.samplingInterval || 5,
            description: data.description || null,
            online: false,
          },
        });
      }

      return this.findByDeviceId(deviceId);
    } catch (error) {
      console.error("Error actualizando config:", error);
      throw new Error(error?.message || "Error al actualizar configuración");
    }
  },

  /** Actualiza sensor data en tiempo real (ESP32) */
  async updateDeviceSensorData(deviceId, sensorData) {
    try {
      const existingGeo = await prisma.geoDevice.findUnique({ where: { deviceId } });
      if (!existingGeo) {
        const catalog = await prisma.device.findUnique({ where: { deviceId } });
        if (!catalog) return;

        await prisma.geoDevice.create({
          data: {
            deviceId,
            name: catalog.displayName || deviceId,
            type: "sensor",
            networkType: catalog.networkType || "wifi",
            latitude: Number(catalog.latitude),
            longitude: Number(catalog.longitude),
            hasGps: Boolean(catalog.hasGps),
            sensorConfig: catalog.sensors || {},
            samplingInterval: catalog.samplingInterval || 5,
            sensorData,
          },
        });
      } else {
        await prisma.geoDevice.update({
          where: { deviceId },
          data: {
            sensorData,
            lastUpdate: new Date(),
          },
        });
      }

      // Registrar cambios de PIR en el log si hay datos nuevos
      if (sensorData?.pir && (typeof sensorData.pir.value === 'number' || typeof sensorData.pir.value === 'string')) {
        const pirValue = Number(sensorData.pir.value);
        if (pirValue === 0 || pirValue === 1) {
          const lastLog = await prisma.sensorChangeLog.findFirst({
            where: {
              deviceId,
              sensorName: 'pir',
            },
            orderBy: { changedAt: 'desc' },
            take: 1,
          });

          const previousValue = lastLog?.newValue ?? null;
          if (previousValue !== pirValue) {
            await prisma.sensorChangeLog.create({
              data: {
                deviceId,
                sensorName: 'pir',
                previousValue,
                newValue: pirValue,
              },
            });
          }
        }
      }

      await prisma.device.update({
        where: { deviceId },
        data: {
          status: "ACTIVE",
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Error actualizando sensor data:", error);
    }
  },

  /** Marca un dispositivo como vivo por heartbeat y opcionalmente actualiza ubicación */
  async touchDeviceAlive(deviceId, { latitude, longitude } = {}) {
    try {
      const currentDevice = await prisma.geoDevice.findUnique({
        where: { deviceId },
        select: { hasGps: true },
      });
      if (!currentDevice) return;

      const data = {
        lastUpdate: new Date(),
      };

      if (currentDevice.hasGps === true) {
        if (latitude !== undefined && latitude !== null) data.latitude = latitude;
        if (longitude !== undefined && longitude !== null) data.longitude = longitude;
      }

      await prisma.geoDevice.update({
        where: { deviceId },
        data,
      });

      await prisma.device.update({
        where: { deviceId },
        data: {
          status: "ACTIVE",
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Error actualizando heartbeat del dispositivo:", error);
    }
  },

  /** Marca offline (nota: online es ahora dinámico basado en socket connection) */
  async setDeviceOffline(deviceId) {
    try {
      // Online es determinado dinámicamente por el gateway basado en conexión socket
      // Por lo que no necesitamos actualizarlo en la DB
      // Solo actualizamos el status del catálogo si es necesario
      const existingCatalog = await prisma.device.findUnique({ where: { deviceId } });
      if (existingCatalog) {
        await prisma.device.update({
          where: { deviceId },
          data: {
            status: "INACTIVE",
            updatedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error("Error al marcar dispositivo offline:", error);
    }
  },
};
