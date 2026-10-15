// --------------------------------------------------------------------------
// Feature 1: Jurisdiction Determination Engine
//
// Pure rule-based logic for State Commission Portal.
//
// Rules:
//   - STATE_MIN_EXCLUSIVE = 5000000   (₹50,00,000)
//   - STATE_MAX_INCLUSIVE = 20000000  (₹2,00,00,000)
//
// NEW_COMPLAINT:
//   Accept only amount > STATE_MIN_EXCLUSIVE and amount <= STATE_MAX_INCLUSIVE.
//   Rejection messages:
//     amount <= 50 lakh -> "Claims up to ₹50,00,000 are filed with the District Commission, not the State Commission."
//     amount > 2 crore  -> "Claims above ₹2,00,00,000 are filed with the National Commission."
//
// APPEAL:
//   Range check does NOT apply. Amount must be > 0.
//
// jurisdictionLevel is always STATE_COMMISSION for accepted filings.
// --------------------------------------------------------------------------

const STATE_MIN_EXCLUSIVE = 5000000;  // ₹50,00,000
const STATE_MAX_INCLUSIVE = 20000000; // ₹2,00,00,000

const JURISDICTION_LABELS = {
  DISTRICT_COMMISSION: 'District Commission',
  STATE_COMMISSION: 'State Commission',
  NATIONAL_COMMISSION: 'National Commission',
};

/**
 * Validates filing claim amount and returns jurisdiction level.
 * @param {string} caseType - 'NEW_COMPLAINT' | 'APPEAL'
 * @param {number|string} claimAmount
 * @returns {{ valid: boolean, message?: string, level: 'STATE_COMMISSION' }}
 */
function validateAndDetermineJurisdiction(caseType = 'NEW_COMPLAINT', claimAmount) {
  const amount = Number(claimAmount) || 0;

  if (caseType === 'APPEAL') {
    if (amount <= 0) {
      return {
        valid: false,
        message: 'Amount awarded or in dispute must be greater than zero.',
        level: 'STATE_COMMISSION',
      };
    }
    return { valid: true, level: 'STATE_COMMISSION' };
  }

  // NEW_COMPLAINT
  if (amount <= STATE_MIN_EXCLUSIVE) {
    return {
      valid: false,
      message: 'Claims up to ₹50,00,000 are filed with the District Commission, not the State Commission.',
      level: 'STATE_COMMISSION',
    };
  }

  if (amount > STATE_MAX_INCLUSIVE) {
    return {
      valid: false,
      message: 'Claims above ₹2,00,00,000 are filed with the National Commission.',
      level: 'STATE_COMMISSION',
    };
  }

  return { valid: true, level: 'STATE_COMMISSION' };
}

/**
 * Backward-compatible function for determining jurisdiction level.
 * @param {number|string} claimAmount
 * @returns {{ level: 'STATE_COMMISSION', label: string }}
 */
function determineJurisdiction(claimAmount) {
  return { level: 'STATE_COMMISSION', label: JURISDICTION_LABELS.STATE_COMMISSION };
}

module.exports = {
  validateAndDetermineJurisdiction,
  determineJurisdiction,
  JURISDICTION_LABELS,
  STATE_MIN_EXCLUSIVE,
  STATE_MAX_INCLUSIVE,
};
