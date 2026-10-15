// --------------------------------------------------------------------------
// Feature 3: Document Completeness Checker
//
// Pure rule-based validation (no API calls). The client shows the checklist
// live while the consumer fills the filing form (RegisterComplaint.jsx).
// This module is the authoritative, server-side re-check before clerk verification.
//
// For APPEAL:
//   Requires "District Commission order attached" (evidence of type DISTRICT_ORDER).
// --------------------------------------------------------------------------

const BASE_CHECKLIST_ITEMS = [
  { key: 'claimAmount', label: 'Claim amount is greater than zero' },
  { key: 'oppositeParty', label: 'At least one opposite party specified' },
  { key: 'evidence', label: 'At least one evidence document uploaded' },
  { key: 'synopsis', label: 'Synopsis generated or manually filled' },
];

const APPEAL_CHECKLIST_ITEM = {
  key: 'districtOrderProof',
  label: 'District Commission order attached',
};

/**
 * Evaluates completeness rules against a complaint-shaped object.
 *
 * @param {{
 *   caseType?: string,
 *   complaintAmount: number|string,
 *   oppositePartyName?: string,
 *   evidenceCount: number,
 *   synopsisText?: string,
 *   synopsisManualConfirm?: boolean,
 *   evidenceTypes?: string[],
 *   hasDistrictOrderProof?: boolean
 * }} input
 */
function checkCompleteness({
  caseType = 'NEW_COMPLAINT',
  complaintAmount,
  oppositePartyName,
  evidenceCount = 0,
  synopsisText,
  synopsisManualConfirm,
  evidenceTypes = [],
  hasDistrictOrderProof,
}) {
  const isAppeal = caseType === 'APPEAL';
  const hasOrderProof = hasDistrictOrderProof !== undefined
    ? Boolean(hasDistrictOrderProof)
    : evidenceTypes.includes('DISTRICT_ORDER');

  const items = isAppeal
    ? [...BASE_CHECKLIST_ITEMS, APPEAL_CHECKLIST_ITEM]
    : BASE_CHECKLIST_ITEMS;

  const results = {
    claimAmount: Number(complaintAmount) > 0,
    oppositeParty: Boolean(oppositePartyName && oppositePartyName.trim()),
    evidence: Number(evidenceCount) > 0,
    synopsis: Boolean((synopsisText && synopsisText.trim()) || synopsisManualConfirm),
    districtOrderProof: hasOrderProof,
  };

  const checklist = items.map((item) => ({ ...item, passed: Boolean(results[item.key]) }));
  const isComplete = checklist.every((item) => item.passed);
  const missing = checklist.filter((item) => !item.passed).map((item) => item.label);

  return { isComplete, checklist, missing };
}

module.exports = { checkCompleteness, BASE_CHECKLIST_ITEMS, APPEAL_CHECKLIST_ITEM };
