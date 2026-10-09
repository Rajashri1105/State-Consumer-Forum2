export function getComplaintTitle(complaint) {
  const consumerName = complaint?.consumer?.name || 'Consumer';
  const oppositePartyName = complaint?.oppositePartyName || 'Opposite Party';
  return `${consumerName} vs ${oppositePartyName}`;
}
