/*
  Warnings:

  - The `recents` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/

-- Rename the old column instead of dropping it
ALTER TABLE "User" RENAME COLUMN "recents" TO "recents_old";

-- Add the new column
ALTER TABLE "User" ADD COLUMN "recents" JSONB NOT NULL DEFAULT '[]';

-- Backfill data
UPDATE "User"
SET "recents" = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', n.id,
        'title', substring(n.content from 1 for 50),
        'lastUsed', n.lastuse
      )
    )
    FROM unnest("recents_old") AS rid
    JOIN "notes" n ON n.id = rid
  ),
  '[]'::jsonb
);

-- Drop the old column
ALTER TABLE "User" DROP COLUMN "recents_old";

-- RenameIndex
ALTER INDEX "User.email_unique" RENAME TO "User_email_key";

-- RenameIndex
ALTER INDEX "User.google_id_unique" RENAME TO "User_google_id_key";
