// --------------------------------------------------------------------------
// Court Fee Service
//
// Single source of truth for computing court fee based on case type and claim amount.
// Rules:
//   - APPEAL: ₹0 ("No court fee for appeals")
//   - NEW_COMPLAINT:
//       amount <= ₹1,00,00,000 (1 crore)  -> ₹2,000
//       amount >  ₹1,00,00,000 and <= ₹2,00,00,000 -> ₹2,500
// --------------------------------------------------------------------------

/**
 * Computes the court fee for a given case type and claim amount.
 * @param {string} caseType - 'NEW_COMPLAINT' | 'APPEAL'
 * @param {number|string} claimAmount
 * @returns {number} Fee amount in INR
 */
function computeCourtFee(caseType, claimAmount) {
  if (caseType === 'APPEAL') {
    return 0;
  }

  const amount = Number(claimAmount) || 0;
  if (amount <= 10000000) {
    return 2000;
  }
  if (amount <= 20000000) {
    return 2500;
  }
  return 0;
}

module.exports = { computeCourtFee };
