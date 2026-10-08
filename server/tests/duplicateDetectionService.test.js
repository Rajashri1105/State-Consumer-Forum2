const test = require('node:test');
const assert = require('node:assert/strict');

// duplicateDetectionService requires config/db at module load time, but the
// two functions under test (jaccardSimilarity, stringSimilarity) are pure —
// they never touch the database. We stub the db module before requiring the
// service so these tests can run without a live PostgreSQL connection.
const Module = require('module');
const dbPath = require.resolve('../config/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {} };

const { jaccardSimilarity, stringSimilarity } = require('../services/duplicateDetectionService');

function tokenize(text) {
  return new Set(text.toLowerCase().split(/\s+/));
}

test('jaccardSimilarity: identical descriptions score 1.0', () => {
  const a = tokenize('defective refrigerator warranty claim denied');
  const b = tokenize('defective refrigerator warranty claim denied');
  assert.equal(jaccardSimilarity(a, b), 1);
});

test('jaccardSimilarity: completely unrelated descriptions score 0', () => {
  const a = tokenize('defective refrigerator warranty claim');
  const b = tokenize('bank loan interest dispute');
  assert.equal(jaccardSimilarity(a, b), 0);
});

test('jaccardSimilarity: partial overlap scores between 0 and 1', () => {
  const a = tokenize('defective refrigerator purchased warranty claim denied');
  const b = tokenize('defective refrigerator bought warranty claim rejected');
  const score = jaccardSimilarity(a, b);
  assert.ok(score > 0 && score < 1, `expected score strictly between 0 and 1, got ${score}`);
});

test('jaccardSimilarity: two empty sets score 0 (not NaN/division-by-zero)', () => {
  assert.equal(jaccardSimilarity(new Set(), new Set()), 0);
});

test('stringSimilarity: identical strings score 1.0', () => {
  assert.equal(stringSimilarity('ABC Traders', 'ABC Traders'), 1);
});

test('stringSimilarity: substring/near-match scores high but not 1.0', () => {
  const score = stringSimilarity('ABC Traders', 'ABC Traders Pvt Ltd');
  assert.ok(score > 0.4 && score < 1, `expected a high-but-imperfect score, got ${score}`);
});

test('stringSimilarity: unrelated strings score low', () => {
  const score = stringSimilarity('ABC Traders', 'XYZ Corp');
  assert.ok(score < 0.3, `expected a low score for unrelated names, got ${score}`);
});

test('stringSimilarity: case-insensitive comparison', () => {
  assert.equal(stringSimilarity('abc traders', 'ABC TRADERS'), 1);
});
