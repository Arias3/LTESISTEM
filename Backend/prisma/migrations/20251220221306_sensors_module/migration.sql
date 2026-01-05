/*
  Warnings:

  - You are about to drop the column `pirDetected` on the `SensorReading` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `SensorReading` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "SensorReading" DROP CONSTRAINT "SensorReading_deviceId_fkey";

-- DropIndex
DROP INDEX "SensorReading_timestamp_idx";

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "lastSeen" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SensorReading" DROP COLUMN "pirDetected",
DROP COLUMN "timestamp",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deviceName" TEXT,
ADD COLUMN     "hasGPS" BOOLEAN,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "lastSeen" TIMESTAMP(3),
ADD COLUMN     "pirActive" BOOLEAN,
ADD COLUMN     "pirValue" BOOLEAN,
ADD COLUMN     "status" TEXT,
ALTER COLUMN "deviceId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "SensorReading_createdAt_idx" ON "SensorReading"("createdAt");

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
