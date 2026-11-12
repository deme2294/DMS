/**
 * AI Feedback Detection & Tenant Quick-Response Generator
 * Detects whether tenant feedback highlights "what should be kept up" (positive),
 * "what should be changed" (improvement), or both, and automatically drafts
 * tailored, ready-to-send tenant responses.
 *
 * Uses Gemini or OpenAI automatically if GEMINI_API_KEY / OPENAI_API_KEY is
 * configured in the environment, and includes a built-in NLP analyzer engine
 * so it works reliably with zero external configuration.
 */

const KEEP_UP_KEYWORDS = [
  'good', 'great', 'excellent', 'awesome', 'amazing', 'fast', 'quick', 'helpful',
  'professional', 'polite', 'friendly', 'smooth', 'clean', 'responsive', 'satisfied',
  'appreciate', 'thank', 'thanks', 'love', 'nice', 'well done', 'keep it up',
  'keep up', 'working well', 'impressive', 'efficient', 'clear', 'accurate', 'reliable',
];

const CHANGE_KEYWORDS = [
  'change', 'improve', 'improvement', 'slow', 'delay', 'delayed', 'late', 'issue',
  'problem', 'wrong', 'missing', 'fix', 'better', 'need', 'needs', 'should', 'must',
  'wait', 'waiting', 'hard', 'difficult', 'broken', 'unclear', 'lack', 'update',
  'upgrade', 'confusing', 'bad', 'poor', 'unhelpful', 'rude', 'error', 'fail', 'failed',
  'not working', 'doesn\'t work', 'does not work', 'too long', 'reduce', 'add',
];

const cleanText = (val) => (typeof val === 'string' ? val.trim() : '');

const splitSentences = (text) =>
  cleanText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

const countKeywordMatches = (text, keywords) => {
  const lower = text.toLowerCase();
  return keywords.reduce((count, kw) => (lower.includes(kw) ? count + 1 : count), 0);
};

const summarizeSnippet = (text, maxLen = 140) => {
  const cleaned = cleanText(text).replace(/\s+/g, ' ');
  if (!cleaned) return '';
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trim()}…`;
};

const analyzeWithBuiltInNlp = (feedback) => {
  const whatIsCorrect = cleanText(feedback.whatIsCorrect);
  const whatShouldChange = cleanText(feedback.whatShouldChange);
  const whatIsWrong = cleanText(feedback.whatIsWrong);
  const howItShouldGo = cleanText(feedback.howItShouldGo);
  const message = cleanText(feedback.message);
  const subject = cleanText(feedback.subject);
  const rating = Number(feedback.rating) || 0;

  const keepUpHighlights = [];
  const changeHighlights = [];

  if (whatIsCorrect) {
    keepUpHighlights.push(summarizeSnippet(whatIsCorrect));
  }
  if (whatShouldChange) {
    changeHighlights.push(summarizeSnippet(whatShouldChange));
  }
  if (whatIsWrong && whatIsWrong !== whatShouldChange) {
    changeHighlights.push(summarizeSnippet(whatIsWrong));
  }
  if (howItShouldGo && howItShouldGo !== whatShouldChange) {
    changeHighlights.push(summarizeSnippet(howItShouldGo));
  }

  // Analyze message & subject sentences for additional keep-up / change signals
  const sentences = splitSentences(`${subject}. ${message}`);
  let positiveScore = whatIsCorrect ? 2 : 0;
  let changeScore = whatShouldChange || whatIsWrong || howItShouldGo ? 2 : 0;

  if (rating >= 4) positiveScore += 2;
  else if (rating > 0 && rating <= 2) changeScore += 2;
  else if (rating === 3) {
    positiveScore += 1;
    changeScore += 1;
  }

  for (const sentence of sentences) {
    const posHits = countKeywordMatches(sentence, KEEP_UP_KEYWORDS);
    const chgHits = countKeywordMatches(sentence, CHANGE_KEYWORDS);
    positiveScore += posHits;
    changeScore += chgHits;

    if (posHits > chgHits && keepUpHighlights.length < 3) {
      const snippet = summarizeSnippet(sentence);
      if (snippet && !keepUpHighlights.includes(snippet)) {
        keepUpHighlights.push(snippet);
      }
    } else if (chgHits > posHits && changeHighlights.length < 3) {
      const snippet = summarizeSnippet(sentence);
      if (snippet && !changeHighlights.includes(snippet)) {
        changeHighlights.push(snippet);
      }
    } else if (chgHits > 0 && posHits > 0) {
      const snippet = summarizeSnippet(sentence);
      if (snippet && changeHighlights.length < 3 && !changeHighlights.includes(snippet)) {
        changeHighlights.push(snippet);
      }
    }
  }

  // Determine detected feedback category
  let detectedType = 'mixed';
  const hasKeepUp = keepUpHighlights.length > 0 || positiveScore > 0;
  const hasChange = changeHighlights.length > 0 || changeScore > 0;

  if (hasKeepUp && hasChange) {
    // If one overwhelmingly dominates and structured field for the other is empty
    if (!whatShouldChange && !whatIsWrong && positiveScore >= changeScore * 2 && rating >= 4) {
      detectedType = 'keep_it_up';
    } else if (!whatIsCorrect && changeScore >= positiveScore * 2 && (rating === 0 || rating <= 3)) {
      detectedType = 'needs_change';
    } else {
      detectedType = 'mixed';
    }
  } else if (hasKeepUp) {
    detectedType = 'keep_it_up';
  } else if (hasChange) {
    detectedType = 'needs_change';
  } else if (rating >= 4) {
    detectedType = 'keep_it_up';
  } else {
    detectedType = 'needs_change';
  }

  const detectedLabel =
    detectedType === 'keep_it_up'
      ? 'What to Keep Up (Positive Feedback)'
      : detectedType === 'needs_change'
        ? 'What Should Be Changed (Improvement Needed)'
        : 'Both: What to Keep Up & What Should Be Changed';

  const tenantName = cleanText(feedback.submitterName) || cleanText(feedback.tenantName) || cleanText(feedback.contactPerson) || 'Valued Tenant';
  const area = cleanText(feedback.serviceName) || cleanText(feedback.departmentName) || cleanText(feedback.categoryName) || 'our service';
  const keepUpFocus = keepUpHighlights[0] || `the positive experience you shared regarding ${area}`;
  const changeFocus = changeHighlights[0] || `the improvements you suggested for ${area}`;

  let quickResponses = [];

  if (detectedType === 'keep_it_up') {
    quickResponses = [
      {
        id: 'recommended',
        label: 'Appreciative & Keep It Up',
        tone: 'Warm & Encouraging',
        text: `Dear ${tenantName}, thank you for your encouraging feedback on ${area}! We are glad to hear about ${keepUpFocus}. We have shared your kind words with the responsible team so we can keep up this standard of service for you.`,
      },
      {
        id: 'concise',
        label: 'Quick Thank You',
        tone: 'Concise',
        text: `Thank you for your positive feedback, ${tenantName}! We truly appreciate you letting us know what is working well with ${area}, and our team will keep up the good work.`,
      },
      {
        id: 'commitment',
        label: 'Service Commitment',
        tone: 'Professional',
        text: `Dear ${tenantName}, we appreciate your feedback regarding ${area}. Knowing that ${keepUpFocus} is working well motivates our team to maintain and build on this quality moving forward.`,
      },
    ];
  } else if (detectedType === 'needs_change') {
    quickResponses = [
      {
        id: 'recommended',
        label: 'Action & Improvement Plan',
        tone: 'Empathetic & Action-Oriented',
        text: `Dear ${tenantName}, thank you for bringing this to our attention regarding ${area}. We hear your feedback about ${changeFocus}, and we have shared these needed changes with the responsible team to improve your experience as quickly as possible.`,
      },
      {
        id: 'concise',
        label: 'Quick Improvement Ack',
        tone: 'Concise',
        text: `Thank you for your honest feedback, ${tenantName}. We have noted what needs to be changed regarding ${area} and our team is actively working on the improvement.`,
      },
      {
        id: 'followup',
        label: 'Change Confirmation',
        tone: 'Reassuring',
        text: `Dear ${tenantName}, we value your feedback on ${area}. Your suggestions regarding ${changeFocus} have been reviewed and assigned for action so we can deliver a better experience going forward.`,
      },
    ];
  } else {
    quickResponses = [
      {
        id: 'recommended',
        label: 'Balanced (Keep Up + Changes)',
        tone: 'Balanced & Constructive',
        text: `Dear ${tenantName}, thank you for your thoughtful feedback on ${area}! We are glad to know what is working well (${keepUpFocus}) and will keep that up. At the same time, we have noted what should be changed (${changeFocus}) and shared it with our team for improvement.`,
      },
      {
        id: 'concise',
        label: 'Quick Balanced Reply',
        tone: 'Concise',
        text: `Thank you for your feedback, ${tenantName}! We appreciate what you highlighted to keep up in ${area} and are taking action on the improvements you suggested.`,
      },
      {
        id: 'team_update',
        label: 'Team Action Update',
        tone: 'Professional',
        text: `Dear ${tenantName}, we appreciate your balanced feedback regarding ${area}. Our team is committed to maintaining the strengths you noted while making the requested changes to serve you better.`,
      },
    ];
  }

  return {
    detectedType,
    detectedLabel,
    keepUpHighlights,
    changeHighlights,
    recommendedResponse: quickResponses[0].text,
    quickResponses,
    source: 'ai-nlp-engine',
  };
};

const buildPromptPayload = (feedback) => ({
  subject: cleanText(feedback.subject),
  message: cleanText(feedback.message),
  whatIsCorrect: cleanText(feedback.whatIsCorrect),
  whatShouldChange: cleanText(feedback.whatShouldChange),
  whatIsWrong: cleanText(feedback.whatIsWrong),
  howItShouldGo: cleanText(feedback.howItShouldGo),
  rating: feedback.rating || null,
  serviceName: cleanText(feedback.serviceName),
  departmentName: cleanText(feedback.departmentName),
  categoryName: cleanText(feedback.categoryName),
  submitterName: cleanText(feedback.submitterName) || 'Valued Tenant',
});

const tryGeminiAnalysis = async (feedback) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const prompt = [
    'You are an AI assistant for a Help Desk Management System.',
    'Analyze the tenant feedback JSON below and detect whether the feedback is:',
    '- "keep_it_up" (mostly praising what is working well and should be kept up)',
    '- "needs_change" (mostly pointing out what should be changed or improved)',
    '- "mixed" (contains both what should be kept up and what should be changed)',
    'Return ONLY valid JSON with keys:',
    '{"detectedType":"keep_it_up|needs_change|mixed","detectedLabel":"string","keepUpHighlights":["string"],"changeHighlights":["string"],"recommendedResponse":"string","quickResponses":[{"id":"recommended","label":"string","tone":"string","text":"string"},{"id":"concise","label":"string","tone":"string","text":"string"},{"id":"followup","label":"string","tone":"string","text":"string"}]}',
    'Keep responses warm, concise (2-3 sentences), specific to the tenant feedback, and ready to send.',
    `Feedback: ${JSON.stringify(buildPromptPayload(feedback))}`,
  ].join('\n');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;

  const parsed = JSON.parse(rawText);
  if (!parsed?.recommendedResponse || !Array.isArray(parsed?.quickResponses)) return null;
  return {
    detectedType: parsed.detectedType || 'mixed',
    detectedLabel: parsed.detectedLabel || 'AI Feedback Analysis',
    keepUpHighlights: Array.isArray(parsed.keepUpHighlights) ? parsed.keepUpHighlights : [],
    changeHighlights: Array.isArray(parsed.changeHighlights) ? parsed.changeHighlights : [],
    recommendedResponse: parsed.recommendedResponse,
    quickResponses: parsed.quickResponses,
    source: 'gemini',
  };
};

const tryOpenAiAnalysis = async (feedback) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Analyze tenant feedback to detect whether it is "keep_it_up", "needs_change", or "mixed". Return JSON with detectedType, detectedLabel, keepUpHighlights (array), changeHighlights (array), recommendedResponse (string), and quickResponses (array of 3 {id, label, tone, text}).',
        },
        { role: 'user', content: JSON.stringify(buildPromptPayload(feedback)) },
      ],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) return null;

  const parsed = JSON.parse(rawText);
  if (!parsed?.recommendedResponse || !Array.isArray(parsed?.quickResponses)) return null;
  return {
    detectedType: parsed.detectedType || 'mixed',
    detectedLabel: parsed.detectedLabel || 'AI Feedback Analysis',
    keepUpHighlights: Array.isArray(parsed.keepUpHighlights) ? parsed.keepUpHighlights : [],
    changeHighlights: Array.isArray(parsed.changeHighlights) ? parsed.changeHighlights : [],
    recommendedResponse: parsed.recommendedResponse,
    quickResponses: parsed.quickResponses,
    source: 'openai',
  };
};

export const analyzeAndGenerateTenantResponse = async (feedback) => {
  try {
    const geminiResult = await tryGeminiAnalysis(feedback);
    if (geminiResult) return geminiResult;
  } catch {
    // Fall back gracefully
  }

  try {
    const openAiResult = await tryOpenAiAnalysis(feedback);
    if (openAiResult) return openAiResult;
  } catch {
    // Fall back gracefully
  }

  return analyzeWithBuiltInNlp(feedback);
};

