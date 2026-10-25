-- CreateEnum (new role set)
CREATE TYPE "UserRole_new" AS ENUM ('super_admin', 'admin', 'procurement_officer', 'hod', 'requester');

-- AlterTable (map legacy roles onto the new roles)
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING (
    CASE "role"::text
        WHEN 'store_manager' THEN 'admin'
        WHEN 'doctor' THEN 'requester'
        WHEN 'department_head' THEN 'hod'
        WHEN 'viewer' THEN 'requester'
        ELSE "role"::text
    END
)::"UserRole_new";

-- DropEnum
DROP TYPE "UserRole";

-- RenameEnum
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- AlterTable (new default role)
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'requester';

-- CreateTable
CREATE TABLE "sessions" (
    "session_id" VARCHAR(64) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(300),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
