// --------------------------------------------------------------------------
// Feature 3: Document Completeness Checker
//
// Pure rule-based validation (no API calls). The client shows the same
// four checks live as a green/red checklist while the consumer fills the
// filing form (see RegisterComplaint.jsx). This module is the
// authoritative, server-side re-check: a complaint is not allowed to
// leave "SUBMITTED" for clerk verification until every rule passes,
// which guarantees a partial complaint can never progress through the
// workflow even if the client-side checklist were bypassed.
// --------------------------------------------------------------------------

const CHECKLIST_ITEMS = [
  { key: 'claimAmount', label: 'Claim amount is greater than zero' },
  { key: 'oppositeParty', label: 'At least one opposite party specified' },
  { key: 'evidence', label: 'At least one evidence document uploaded' },
  { key: 'synopsis', label: 'Synopsis generated or manually filled' },
];

/**
 * Evaluates the four completeness rules against a complaint-shaped
 * object. `evidenceCount` is passed separately since it isn't always
 * loaded on every fetch of a complaint.
 *
 * @param {{ complaintAmount: number|string, oppositePartyName?: string, evidenceCount: number, synopsisText?: string, synopsisManualConfirm?: boolean }} input
 */
function checkCompleteness({ complaintAmount, oppositePartyName, evidenceCount = 0, synopsisText, synopsisManualConfirm }) {
  const results = {
    claimAmount: Number(complaintAmount) > 0,
    oppositeParty: Boolean(oppositePartyName && oppositePartyName.trim()),
    evidence: Number(evidenceCount) > 0,
    synopsis: Boolean((synopsisText && synopsisText.trim()) || synopsisManualConfirm),
  };

  const checklist = CHECKLIST_ITEMS.map((item) => ({ ...item, passed: results[item.key] }));
  const isComplete = checklist.every((item) => item.passed);
  const missing = checklist.filter((item) => !item.passed).map((item) => item.label);

  return { isComplete, checklist, missing };
}

module.exports = { checkCompleteness, CHECKLIST_ITEMS };
