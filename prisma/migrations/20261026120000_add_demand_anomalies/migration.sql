-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "dept_id" INTEGER,
ADD COLUMN     "demand_request_id" INTEGER,
ADD COLUMN     "related_request_id" INTEGER;

-- CreateIndex
CREATE INDEX "alerts_alert_type_status_dept_id_idx" ON "alerts"("alert_type", "status", "dept_id");

-- CreateIndex
CREATE INDEX "alerts_demand_request_id_idx" ON "alerts"("demand_request_id");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "departments"("dept_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_demand_request_id_fkey" FOREIGN KEY ("demand_request_id") REFERENCES "demand_requests"("request_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_related_request_id_fkey" FOREIGN KEY ("related_request_id") REFERENCES "demand_requests"("request_id") ON DELETE SET NULL ON UPDATE CASCADE;
