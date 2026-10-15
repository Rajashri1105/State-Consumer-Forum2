-- Migration: Add reappealCount to complaints
-- Tracks how many times a consumer has re-appealed after a scrutiny rejection.
-- Maximum allowed is 1; a second rejection is final — consumer must file a new complaint.

ALTER TABLE "complaints" ADD COLUMN "reappealCount" INTEGER NOT NULL DEFAULT 0;
