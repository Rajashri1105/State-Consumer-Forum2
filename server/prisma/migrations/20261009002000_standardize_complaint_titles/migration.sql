UPDATE complaints AS complaint
SET title = CONCAT(
  COALESCE(NULLIF(BTRIM(consumer.name), ''), 'Consumer'),
  ' vs ',
  COALESCE(NULLIF(BTRIM(complaint."oppositePartyName"), ''), 'Opposite Party')
)
FROM users AS consumer
WHERE complaint."consumerId" = consumer.id;
