-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('FIXED', 'MOBILE');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ALERT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "device_id" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(100),
    "network_type" VARCHAR(20) NOT NULL DEFAULT 'wifi',
    "has_gps" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DECIMAL(10,8) NOT NULL DEFAULT 11.019464,
    "longitude" DECIMAL(11,8) NOT NULL DEFAULT -74.851522,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sampling_interval" INTEGER NOT NULL DEFAULT 5,
    "sensors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_users" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT true,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_devices" (
    "id" TEXT NOT NULL,
    "device_id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(500),
    "type" VARCHAR(50) NOT NULL,
    "network_type" VARCHAR(20) NOT NULL DEFAULT 'wifi',
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "has_gps" BOOLEAN NOT NULL DEFAULT false,
    "sensor_data" JSONB,
    "sensor_config" JSONB,
    "sampling_interval" INTEGER NOT NULL DEFAULT 5,
    "programmed_by" VARCHAR(255),
    "programmed_at" TIMESTAMP(3),
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_change_logs" (
    "id" TEXT NOT NULL,
    "device_id" VARCHAR(50) NOT NULL,
    "sensor_name" VARCHAR(100) NOT NULL,
    "previousValue" INTEGER,
    "newValue" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Device_device_id_key" ON "Device"("device_id");

-- CreateIndex
CREATE INDEX "Device_device_id_idx" ON "Device"("device_id");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "Device_updated_at_idx" ON "Device"("updated_at");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_receiverId_idx" ON "Message"("receiverId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "geo_users_account_id_key" ON "geo_users"("account_id");

-- CreateIndex
CREATE INDEX "geo_users_online_idx" ON "geo_users"("online");

-- CreateIndex
CREATE INDEX "geo_users_last_update_idx" ON "geo_users"("last_update");

-- CreateIndex
CREATE UNIQUE INDEX "geo_devices_device_id_key" ON "geo_devices"("device_id");

-- CreateIndex
CREATE INDEX "geo_devices_device_id_idx" ON "geo_devices"("device_id");

-- CreateIndex
CREATE INDEX "geo_devices_type_idx" ON "geo_devices"("type");

-- CreateIndex
CREATE INDEX "geo_devices_last_update_idx" ON "geo_devices"("last_update");

-- CreateIndex
CREATE INDEX "sensor_change_logs_device_id_idx" ON "sensor_change_logs"("device_id");

-- CreateIndex
CREATE INDEX "sensor_change_logs_sensor_name_idx" ON "sensor_change_logs"("sensor_name");

-- CreateIndex
CREATE INDEX "sensor_change_logs_changed_at_idx" ON "sensor_change_logs"("changed_at");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_users" ADD CONSTRAINT "geo_users_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_change_logs" ADD CONSTRAINT "sensor_change_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "geo_devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;
