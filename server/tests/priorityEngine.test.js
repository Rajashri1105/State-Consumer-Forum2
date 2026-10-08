const test = require('node:test');
const assert = require('node:assert/strict');

// Stub config/db with a fake Prisma client exposing just what
// priorityEngine.js needs, so this test runs without a live database.
// (node --test runs each test file in its own process, so this stub
// cannot leak into other test files.)
const FAKE_RULES = [
  { keyword: 'medical negligence', priority: 'HIGH', isActive: true },
  { keyword: 'senior citizen', priority: 'HIGH', isActive: true },
  { keyword: 'warranty', priority: 'LOW', isActive: true },
  { keyword: 'refund', priority: 'LOW', isActive: true },
  { keyword: 'banking', priority: 'MEDIUM', isActive: true },
  { keyword: 'inactive rule', priority: 'HIGH', isActive: false },
];

const dbPath = require.resolve('../config/db');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    priorityRule: {
      findMany: async ({ where } = {}) => FAKE_RULES.filter((r) => where?.isActive === undefined || r.isActive === where.isActive),
    },
  },
};

const { computePriority } = require('../services/priorityEngine');

test('computePriority: matches a HIGH keyword rule', async () => {
  const result = await computePriority({
    description: 'My elderly mother, a senior citizen, faced medical negligence at the hospital.',
    category: { name: 'Healthcare', defaultPriority: 'MEDIUM' },
  });
  assert.equal(result.priority, 'HIGH');
  assert.ok(result.matchedRule);
});

test('computePriority: matches a LOW keyword rule', async () => {
  const result = await computePriority({
    description: 'The product warranty claim was denied by the seller.',
    category: { name: 'Electronics', defaultPriority: 'MEDIUM' },
  });
  assert.equal(result.priority, 'LOW');
  assert.equal(result.matchedRule, 'warranty');
});

test('computePriority: when multiple rules match, the highest-ranked priority wins', async () => {
  // Contains both a LOW keyword ("refund") and a HIGH keyword ("senior citizen")
  const result = await computePriority({
    description: 'As a senior citizen I am requesting a refund for this product.',
    category: { name: 'Retail', defaultPriority: 'MEDIUM' },
  });
  assert.equal(result.priority, 'HIGH');
});

test('computePriority: falls back to category default when no rule matches', async () => {
  const result = await computePriority({
    description: 'The delivery was late by three days.',
    category: { name: 'Logistics', defaultPriority: 'MEDIUM' },
  });
  assert.equal(result.priority, 'MEDIUM');
  assert.equal(result.matchedRule, null);
});

test('computePriority: inactive rules are never matched', async () => {
  const result = await computePriority({
    description: 'This complaint mentions the inactive rule keyword directly.',
    category: { name: 'General', defaultPriority: 'LOW' },
  });
  assert.equal(result.matchedRule, null);
  assert.equal(result.priority, 'LOW');
});

test('computePriority: matching is case-insensitive', async () => {
  const result = await computePriority({
    description: 'MEDICAL NEGLIGENCE occurred during the procedure.',
    category: { name: 'Healthcare', defaultPriority: 'MEDIUM' },
  });
  assert.equal(result.priority, 'HIGH');
});
