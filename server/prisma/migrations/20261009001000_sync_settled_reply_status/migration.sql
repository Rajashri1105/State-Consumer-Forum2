UPDATE "complaints"
SET "replyStatus" = 'SETTLED'
WHERE "status" = 'SETTLED'
  AND "replyStatus" <> 'SETTLED';
