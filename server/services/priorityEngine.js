const prisma = require('../config/db');

const PRIORITY_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

/**
 * Determines complaint priority using admin-configurable keyword rules,
 * falling back to the complaint category's default priority.
 *
 * Rule-based only — no ML/AI. Matching is case-insensitive substring
 * matching against the complaint's description, category name, product,
 * and service fields. When multiple rules match, the highest-ranked
 * priority wins.
 *
 * @param {{description: string, product?: string, service?: string, category: {name: string, defaultPriority: string}}} complaintData
 * @returns {Promise<{priority: 'HIGH'|'MEDIUM'|'LOW', matchedRule: string|null, reason: string}>}
 */
async function computePriority(complaintData) {
  const { description = '', product = '', service = '', category } = complaintData;

  const haystack = `${description} ${product} ${service} ${category?.name || ''}`.toLowerCase();

  const activeRules = await prisma.priorityRule.findMany({ where: { isActive: true } });

  let bestMatch = null;
  for (const rule of activeRules) {
    if (haystack.includes(rule.keyword.toLowerCase())) {
      if (!bestMatch || PRIORITY_RANK[rule.priority] > PRIORITY_RANK[bestMatch.priority]) {
        bestMatch = rule;
      }
    }
  }

  if (bestMatch) {
    return {
      priority: bestMatch.priority,
      matchedRule: bestMatch.keyword,
      reason: `Matched configured keyword rule "${bestMatch.keyword}".`,
    };
  }

  return {
    priority: category?.defaultPriority || 'MEDIUM',
    matchedRule: null,
    reason: `No keyword rule matched. Falling back to default priority for category "${category?.name || 'Unknown'}".`,
  };
}

module.exports = { computePriority, PRIORITY_RANK };
