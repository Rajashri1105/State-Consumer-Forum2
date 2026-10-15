const test = require('node:test');
const assert = require('node:assert/strict');

const { validateAndDetermineJurisdiction } = require('../services/jurisdictionEngine');
const { computeCourtFee } = require('../services/courtFeeService');
const { checkCompleteness } = require('../services/completenessChecker');

// --------------------------------------------------------------------------
// 1. NEW_COMPLAINT Jurisdiction & Court Fee Tests
// --------------------------------------------------------------------------
test('NEW_COMPLAINT: claim of ₹50,00,000 (boundary) is rejected (District Commission level)', () => {
  const result = validateAndDetermineJurisdiction('NEW_COMPLAINT', 5000000);
  assert.equal(result.valid, false);
  assert.match(result.message, /District Commission/);
});

test('NEW_COMPLAINT: claim of ₹50,00,001 is accepted with ₹2,000 court fee', () => {
  const jur = validateAndDetermineJurisdiction('NEW_COMPLAINT', 5000001);
  assert.equal(jur.valid, true);
  assert.equal(jur.level, 'STATE_COMMISSION');

  const fee = computeCourtFee('NEW_COMPLAINT', 5000001);
  assert.equal(fee, 2000);
});

test('NEW_COMPLAINT: claim of ₹1,00,00,000 is accepted with ₹2,000 court fee', () => {
  const jur = validateAndDetermineJurisdiction('NEW_COMPLAINT', 10000000);
  assert.equal(jur.valid, true);
  assert.equal(jur.level, 'STATE_COMMISSION');

  const fee = computeCourtFee('NEW_COMPLAINT', 10000000);
  assert.equal(fee, 2000);
});

test('NEW_COMPLAINT: claim of ₹1,00,00,001 is accepted with ₹2,500 court fee', () => {
  const jur = validateAndDetermineJurisdiction('NEW_COMPLAINT', 10000001);
  assert.equal(jur.valid, true);
  assert.equal(jur.level, 'STATE_COMMISSION');

  const fee = computeCourtFee('NEW_COMPLAINT', 10000001);
  assert.equal(fee, 2500);
});

test('NEW_COMPLAINT: claim of ₹2,00,00,000 is accepted with ₹2,500 court fee', () => {
  const jur = validateAndDetermineJurisdiction('NEW_COMPLAINT', 20000000);
  assert.equal(jur.valid, true);
  assert.equal(jur.level, 'STATE_COMMISSION');

  const fee = computeCourtFee('NEW_COMPLAINT', 20000000);
  assert.equal(fee, 2500);
});

test('NEW_COMPLAINT: claim of ₹2,00,00,001 (boundary) is rejected (National Commission level)', () => {
  const result = validateAndDetermineJurisdiction('NEW_COMPLAINT', 20000001);
  assert.equal(result.valid, false);
  assert.match(result.message, /National Commission/);
});

// --------------------------------------------------------------------------
// 2. APPEAL Jurisdiction & Court Fee Tests
// --------------------------------------------------------------------------
test('APPEAL: any positive claim amount is accepted without range restriction', () => {
  const smallAppeal = validateAndDetermineJurisdiction('APPEAL', 5000);
  assert.equal(smallAppeal.valid, true);
  assert.equal(smallAppeal.level, 'STATE_COMMISSION');

  const largeAppeal = validateAndDetermineJurisdiction('APPEAL', 50000000);
  assert.equal(largeAppeal.valid, true);
  assert.equal(largeAppeal.level, 'STATE_COMMISSION');
});

test('APPEAL: court fee is always 0', () => {
  assert.equal(computeCourtFee('APPEAL', 10000), 0);
  assert.equal(computeCourtFee('APPEAL', 7500000), 0);
  assert.equal(computeCourtFee('APPEAL', 30000000), 0);
});

test('APPEAL: invalid/non-positive claim amount is rejected', () => {
  const result = validateAndDetermineJurisdiction('APPEAL', 0);
  assert.equal(result.valid, false);
});

// --------------------------------------------------------------------------
// 3. Completeness Checker Tests for Appeals vs New Complaints
// --------------------------------------------------------------------------
test('checkCompleteness: APPEAL without DISTRICT_ORDER evidence document is incomplete', () => {
  const result = checkCompleteness({
    caseType: 'APPEAL',
    complaintAmount: 50000,
    oppositePartyName: 'ABC Traders',
    evidenceCount: 1,
    synopsisText: 'Appeal synopsis text here...',
    evidenceTypes: ['OTHER'],
  });
  assert.equal(result.isComplete, false);
  assert.ok(result.missing.some((m) => m.includes('District Commission order')));
});

test('checkCompleteness: APPEAL with DISTRICT_ORDER evidence document is complete', () => {
  const result = checkCompleteness({
    caseType: 'APPEAL',
    complaintAmount: 50000,
    oppositePartyName: 'ABC Traders',
    evidenceCount: 1,
    synopsisText: 'Appeal synopsis text here...',
    evidenceTypes: ['DISTRICT_ORDER'],
  });
  assert.equal(result.isComplete, true);
  assert.equal(result.missing.length, 0);
});

test('checkCompleteness: NEW_COMPLAINT with evidence is complete without DISTRICT_ORDER', () => {
  const result = checkCompleteness({
    caseType: 'NEW_COMPLAINT',
    complaintAmount: 6000000,
    oppositePartyName: 'XYZ Corp',
    evidenceCount: 1,
    synopsisText: 'Complaint synopsis text here...',
    evidenceTypes: ['OTHER'],
  });
  assert.equal(result.isComplete, true);
});
