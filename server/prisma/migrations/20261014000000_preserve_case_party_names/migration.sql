ALTER TABLE "complaints" ADD COLUMN "consumerName" TEXT;

UPDATE "complaints"
SET "consumerName" = split_part("title", ' vs ', 1)
WHERE "title" IS NOT NULL AND "title" LIKE '% vs %';

UPDATE "complaints"
SET "oppositePartyName" = split_part("title", ' vs ', 2)
WHERE "oppositePartyName" = 'Deleted account'
  AND "title" IS NOT NULL
  AND "title" LIKE '% vs %'
  AND split_part("title", ' vs ', 2) <> '';
