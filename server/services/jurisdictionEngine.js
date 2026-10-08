// --------------------------------------------------------------------------
// Feature 1: Jurisdiction Determination Engine
//
// Pure rule-based logic (no API calls) — fires the moment the consumer
// enters the claim amount, same event as the existing court-fee
// calculator (see complaintController.createComplaint / the client-side
// preview in RegisterComplaint.jsx).
//
// Thresholds (Consumer Protection Act, 2019 slabs used by this forum):
//   Claim amount <= 50,00,000                    -> District Commission
//   50,00,001 - 2,00,00,000                       -> State Commission
//   > 2,00,00,000                                 -> National Commission
// --------------------------------------------------------------------------

const DISTRICT_MAX = 5000000; // ₹50,00,000
const STATE_MAX = 20000000; // ₹2,00,00,000

const JURISDICTION_LABELS = {
  DISTRICT_COMMISSION: 'District Commission',
  STATE_COMMISSION: 'State Commission',
  NATIONAL_COMMISSION: 'National Commission',
};

/**
 * @param {number|string} claimAmount
 * @returns {{ level: 'DISTRICT_COMMISSION'|'STATE_COMMISSION'|'NATIONAL_COMMISSION', label: string }}
 */
function determineJurisdiction(claimAmount) {
  const amount = Number(claimAmount) || 0;

  let level;
  if (amount <= DISTRICT_MAX) {
    level = 'DISTRICT_COMMISSION';
  } else if (amount <= STATE_MAX) {
    level = 'STATE_COMMISSION';
  } else {
    level = 'NATIONAL_COMMISSION';
  }

  return { level, label: JURISDICTION_LABELS[level] };
}

module.exports = { determineJurisdiction, JURISDICTION_LABELS, DISTRICT_MAX, STATE_MAX };
