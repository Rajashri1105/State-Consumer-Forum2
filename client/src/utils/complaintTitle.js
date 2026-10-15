export function getComplaintTitle(complaint) {
  if (complaint?.title) return complaint.title;
  const consumerName = complaint?.consumerName || complaint?.consumer?.name || 'Consumer';
  const oppositePartyName = complaint?.oppositePartyName || 'Opposite Party';
  return `${consumerName} vs ${oppositePartyName}`;
}
