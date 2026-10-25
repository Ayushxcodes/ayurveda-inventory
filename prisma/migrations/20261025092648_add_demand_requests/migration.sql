-- CreateEnum
CREATE TYPE "DemandStatus" AS ENUM ('pending', 'approved', 'rejected', 'fulfilled', 'cancelled');

-- CreateTable
CREATE TABLE "demand_requests" (
    "request_id" SERIAL NOT NULL,
    "request_number" VARCHAR(30) NOT NULL,
    "dept_id" INTEGER NOT NULL,
    "requested_by" INTEGER NOT NULL,
    "status" "DemandStatus" NOT NULL DEFAULT 'pending',
    "needed_by" DATE,
    "justification" TEXT,
    "review_notes" TEXT,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "fulfilled_by" INTEGER,
    "fulfilled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demand_requests_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "demand_request_items" (
    "demand_item_id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "demand_request_items_pkey" PRIMARY KEY ("demand_item_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "demand_requests_request_number_key" ON "demand_requests"("request_number");

-- CreateIndex
CREATE INDEX "demand_requests_dept_id_status_idx" ON "demand_requests"("dept_id", "status");

-- CreateIndex
CREATE INDEX "demand_requests_requested_by_idx" ON "demand_requests"("requested_by");

-- CreateIndex
CREATE INDEX "demand_request_items_request_id_idx" ON "demand_request_items"("request_id");

-- CreateIndex
CREATE INDEX "demand_request_items_item_id_idx" ON "demand_request_items"("item_id");

-- AddForeignKey
ALTER TABLE "demand_requests" ADD CONSTRAINT "demand_requests_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "departments"("dept_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_requests" ADD CONSTRAINT "demand_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_requests" ADD CONSTRAINT "demand_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_requests" ADD CONSTRAINT "demand_requests_fulfilled_by_fkey" FOREIGN KEY ("fulfilled_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_request_items" ADD CONSTRAINT "demand_request_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "demand_requests"("request_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_request_items" ADD CONSTRAINT "demand_request_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;
