-- Add from_past column to medications table
ALTER TABLE "medications" ADD COLUMN IF NOT EXISTS "from_past" BOOLEAN NOT NULL DEFAULT false;
