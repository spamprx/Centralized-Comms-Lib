-- Simplify Visibility enum to: PUBLIC | PRIVATE_TO_GROUP
-- Maps legacy values (PRIVATE, HIDDEN, ARCHIVED) to PUBLIC and clears visibilityGroupId.

-- Ensure legacy rows won't fail enum cast.
UPDATE "contents"
SET "visibility" = 'PUBLIC',
    "visibilityGroupId" = NULL
WHERE "visibility" NOT IN ('PUBLIC', 'PRIVATE_TO_GROUP');

-- Recreate enum type without removed values (Postgres cannot DROP enum values).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Visibility_new') THEN
    -- no-op (migration re-run safety)
  ELSE
    CREATE TYPE "Visibility_new" AS ENUM ('PUBLIC', 'PRIVATE_TO_GROUP');
  END IF;
END $$;

ALTER TABLE "contents"
  ALTER COLUMN "visibility" TYPE "Visibility_new"
  USING ("visibility"::text::"Visibility_new");

-- Replace old enum type.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Visibility') THEN
    ALTER TYPE "Visibility" RENAME TO "Visibility_old";
  END IF;
END $$;

ALTER TYPE "Visibility_new" RENAME TO "Visibility";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Visibility_old') THEN
    DROP TYPE "Visibility_old";
  END IF;
END $$;

