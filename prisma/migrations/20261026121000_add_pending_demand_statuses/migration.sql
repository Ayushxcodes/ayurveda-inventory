-- The shared database may already contain these approval-stage statuses.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'DemandStatus' AND e.enumlabel = 'pending_hod'
  ) THEN
    ALTER TYPE "DemandStatus" ADD VALUE 'pending_hod';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'DemandStatus' AND e.enumlabel = 'pending_admin'
  ) THEN
    ALTER TYPE "DemandStatus" ADD VALUE 'pending_admin';
  END IF;
END
$$;
