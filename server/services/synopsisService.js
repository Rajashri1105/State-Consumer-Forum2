// --------------------------------------------------------------------------
// Feature 2: AI-Assisted Complaint Drafting
//
// Deliberately isolated in its own module (per the implementation notes)
// so the LLM integration point can be demoed/debugged independently of
// the rest of the complaint workflow. Everything downstream (the
// controller, the "Generate Formal Synopsis" button, PDF export) only
// ever calls `generateSynopsis()` below — it never talks to the LLM
// provider directly.
//
// Supports Gemini or OpenAI, selected via LLM_PROVIDER. If no API key is
// configured, falls back to a deterministic rule-based synopsis template
// so the rest of the feature (editable draft, PDF export, storage on the
// complaint record) can still be demoed end-to-end without live keys.
// --------------------------------------------------------------------------

const logger = require('../config/logger');

const PROVIDER = (process.env.LLM_PROVIDER || 'none').toLowerCase(); // 'gemini' | 'openai' | 'none'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

function buildPrompt({ category, sellerName, oppositePartyName, claimAmount, description }) {
  return `You are a paralegal assistant drafting a formal complaint synopsis for an Indian State Consumer Disputes Redressal Forum, under the Consumer Protection Act, 2019.

Given the details below, produce:
1. A short, formal "Synopsis of Facts" paragraph (plain, neutral, legal drafting style).
2. A numbered "Index of Documents/Relief Sought" draft listing the likely relief the complainant would seek (e.g. refund, compensation, replacement) based on the description.

Complaint category: ${category || 'Not specified'}
Seller / Trader: ${sellerName || 'Not specified'}
Opposite Party: ${oppositePartyName || 'Not specified'}
Claim Amount: Rs. ${claimAmount || 0}
Consumer's plain-language description:
"""
${description}
"""

Respond with plain text only, using the headings "SYNOPSIS OF FACTS" and "INDEX / RELIEF SOUGHT".`;
}

async function callOpenAI(prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 700,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function callGemini(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

/**
 * Deterministic fallback used when no LLM provider is configured, or when
 * the live call fails — keeps the feature demoable offline and ensures a
 * synopsis is always available to satisfy the Document Completeness
 * Checker (Feature 3).
 */
function ruleBasedFallback({ category, sellerName, oppositePartyName, claimAmount, description }) {
  const trimmedDescription = (description || '').trim();
  return [
    'SYNOPSIS OF FACTS',
    `The Complainant purchased goods/availed services from the Opposite Party, ${oppositePartyName || 'the Opposite Party'}` +
      `${sellerName ? ` (through ${sellerName})` : ''}, falling under the category of ${category || 'general consumer disputes'}. ` +
      `The Complainant states as follows: ${trimmedDescription} ` +
      `The Complainant claims a total amount of Rs. ${Number(claimAmount || 0).toLocaleString('en-IN')} towards deficiency in service / defect in goods, and has approached this Forum for redressal under the Consumer Protection Act, 2019.`,
    '',
    'INDEX / RELIEF SOUGHT',
    '1. Direct the Opposite Party to refund/replace the goods or rectify the deficiency in service complained of.',
    `2. Award compensation to the Complainant in the sum of Rs. ${Number(claimAmount || 0).toLocaleString('en-IN')} for the loss, harassment, and mental agony suffered.`,
    '3. Award the cost of these proceedings.',
    '4. Pass such other order(s) as this Forum may deem fit and proper in the facts and circumstances of the case.',
  ].join('\n');
}

/**
 * Generates a formal legal synopsis + index draft from the consumer's
 * plain-language complaint description. Returns { text, source } where
 * source is 'openai' | 'gemini' | 'fallback' so the UI/audit trail can
 * show whether it was AI-generated or rule-based.
 */
async function generateSynopsis(complaintDetails) {
  try {
    const prompt = buildPrompt(complaintDetails);

    if (PROVIDER === 'openai' && OPENAI_API_KEY) {
      const text = await callOpenAI(prompt);
      if (text) return { text, source: 'openai' };
    } else if (PROVIDER === 'gemini' && GEMINI_API_KEY) {
      const text = await callGemini(prompt);
      if (text) return { text, source: 'gemini' };
    }
  } catch (err) {
    logger.error('Synopsis LLM call failed, falling back to rule-based draft:', err.message);
  }

  return { text: ruleBasedFallback(complaintDetails), source: 'fallback' };
}

module.exports = { generateSynopsis };
