/*
  Warnings:

  - You are about to drop the column `authToken` on the `Device` table. All the data in the column will be lost.
  - You are about to drop the column `firmwareVersion` on the `Device` table. All the data in the column will be lost.
  - You are about to drop the column `firstSeenAt` on the `Device` table. All the data in the column will be lost.
  - You are about to drop the column `lastSeenAt` on the `Device` table. All the data in the column will be lost.
  - You are about to drop the column `manufacturer` on the `Device` table. All the data in the column will be lost.
  - You are about to drop the column `model` on the `Device` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Device" DROP COLUMN "authToken",
DROP COLUMN "firmwareVersion",
DROP COLUMN "firstSeenAt",
DROP COLUMN "lastSeenAt",
DROP COLUMN "manufacturer",
DROP COLUMN "model",
ADD COLUMN     "samplingInterval" INTEGER NOT NULL DEFAULT 3000,
ALTER COLUMN "status" SET DEFAULT 'INACTIVE';
