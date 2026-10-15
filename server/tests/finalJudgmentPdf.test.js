const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const { generateComplaintReceipt, generateFinalJudgmentPdf } = require('../services/pdfService');

test('generates a complaint receipt when its description contains the rupee symbol', async () => {
  const receipt = await generateComplaintReceipt({
    complaintNumber: 'SCF-2026-000002',
    caseType: 'NEW_COMPLAINT',
    status: 'SUBMITTED',
    priority: 'MEDIUM',
    complaintAmount: 2500,
    courtFee: 100,
    submittedAt: new Date('2026-01-05T00:00:00Z'),
    description: 'The product cost ₹2,500 and was defective.',
    consumer: { name: 'Consumer Name' },
    oppositePartyName: 'Opposite Party Name',
    category: { name: 'Product Complaint' },
  });
  const document = await PDFDocument.load(receipt);

  assert.equal(document.getPageCount(), 1);
});

test('generates a valid final judgment PDF and paginates long summaries', async () => {
  const complaint = {
    complaintNumber: 'SCF-2026-000001',
    caseType: 'NEW_COMPLAINT',
    submittedAt: new Date('2026-01-05T00:00:00Z'),
    consumer: { name: 'Consumer Name' },
    oppositePartyName: 'Opposite Party Name',
    assignedJudge: { user: { name: 'Judge Name' } },
    bench: { name: 'Bench 1' },
  };
  const judgment = {
    verdict: 'In favor of Consumer',
    summary: Array(200).fill('The forum reviewed the evidence and records presented.').join(' '),
  };
  const attendance = {
    consumerPresent: true,
    oppositePartyPresent: false,
    witnessDetails: 'Witness One',
    advocateDetails: 'Advocate One',
  };

  const bytes = await generateFinalJudgmentPdf(complaint, judgment, attendance, new Date('2026-02-01T00:00:00Z'));
  const document = await PDFDocument.load(bytes);

  assert.equal(Buffer.from(bytes).subarray(0, 4).toString(), '%PDF');
  assert.ok(document.getPageCount() > 1);
});
