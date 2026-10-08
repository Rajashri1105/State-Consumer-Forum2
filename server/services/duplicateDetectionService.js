const prisma = require('../config/db');

const SIMILARITY_THRESHOLD = 0.55;
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'is', 'was', 'to', 'of', 'in', 'on', 'for', 'with', 'my', 'i', 'this', 'that', 'it', 'has', 'have', 'been']);

function tokenize(text) {
  return new Set(
    (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

/** Jaccard similarity between two token sets: |intersection| / |union| */
function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersectionSize = 0;
  for (const token of setA) {
    if (setB.has(token)) intersectionSize++;
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/** Normalized Levenshtein similarity (1 = identical, 0 = completely different) */
function stringSimilarity(a = '', b = '') {
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const distance = dp[a.length][b.length];
  return 1 - distance / Math.max(a.length, b.length);
}

/**
 * Scans existing complaints for likely duplicates of a new/candidate
 * complaint. Rule-based text similarity only — no AI/ML involved.
 *
 * Compares: consumer identity, opposite party name, and description
 * text (Jaccard word-overlap). Complaints already REJECTED or CLOSED
 * are excluded, since a duplicate warning is not useful for dead cases.
 *
 * @param {{consumerId: string, oppositePartyName: string, description: string, excludeComplaintId?: string}} candidate
 * @returns {Promise<Array<{complaint: object, similarityScore: number, reasons: string[]}>>}
 */
async function findPossibleDuplicates(candidate) {
  const { consumerId, oppositePartyName, description, excludeComplaintId } = candidate;

  const existing = await prisma.complaint.findMany({
    where: {
      status: { notIn: ['REJECTED', 'CLOSED'] },
      ...(excludeComplaintId ? { id: { not: excludeComplaintId } } : {}),
    },
    select: {
      id: true,
      complaintNumber: true,
      consumerId: true,
      oppositePartyName: true,
      description: true,
      status: true,
      submittedAt: true,
    },
  });

  const candidateTokens = tokenize(description);
  const results = [];

  for (const existingComplaint of existing) {
    const reasons = [];
    const sameConsumer = existingComplaint.consumerId === consumerId;
    const partySimilarity = stringSimilarity(existingComplaint.oppositePartyName, oppositePartyName);
    const descSimilarity = jaccardSimilarity(candidateTokens, tokenize(existingComplaint.description));

    if (sameConsumer) reasons.push('Same consumer');
    if (partySimilarity >= 0.75) reasons.push('Highly similar opposite party name');
    if (descSimilarity >= 0.4) reasons.push('Highly similar complaint description');

    // Weighted combined score: description overlap matters most, then
    // opposite party match, then a smaller boost if it's the same consumer.
    const combinedScore = descSimilarity * 0.5 + partySimilarity * 0.3 + (sameConsumer ? 0.2 : 0);

    if (combinedScore >= SIMILARITY_THRESHOLD && reasons.length > 0) {
      results.push({ complaint: existingComplaint, similarityScore: Math.round(combinedScore * 100) / 100, reasons });
    }
  }

  return results.sort((a, b) => b.similarityScore - a.similarityScore);
}

module.exports = { findPossibleDuplicates, jaccardSimilarity, stringSimilarity };
