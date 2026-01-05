/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Sensor` table. All the data in the column will be lost.
  - You are about to drop the column `isEnabled` on the `Sensor` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Sensor` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Sensor" DROP CONSTRAINT "Sensor_deviceId_fkey";

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "sensors" JSONB,
ALTER COLUMN "status" SET DEFAULT 'pending',
ALTER COLUMN "samplingInterval" SET DEFAULT 3;

-- AlterTable
ALTER TABLE "Sensor" DROP COLUMN "createdAt",
DROP COLUMN "isEnabled",
DROP COLUMN "updatedAt";
