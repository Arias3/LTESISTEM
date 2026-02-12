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
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT true,
    "sensor_data" JSONB,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "geo_users_account_id_key" ON "geo_users"("account_id");

-- CreateIndex
CREATE INDEX "geo_users_online_idx" ON "geo_users"("online");

-- CreateIndex
CREATE INDEX "geo_users_last_update_idx" ON "geo_users"("last_update");

-- CreateIndex
CREATE INDEX "geo_devices_type_idx" ON "geo_devices"("type");

-- CreateIndex
CREATE INDEX "geo_devices_online_idx" ON "geo_devices"("online");

-- CreateIndex
CREATE INDEX "geo_devices_last_update_idx" ON "geo_devices"("last_update");

-- AddForeignKey
ALTER TABLE "geo_users" ADD CONSTRAINT "geo_users_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
