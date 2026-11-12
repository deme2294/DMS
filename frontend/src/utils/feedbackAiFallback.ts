import type { Feedback, FeedbackAiDetectionType, FeedbackAiResponseResult } from '../types/feedback';

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
  'not working', "doesn't work", 'does not work', 'too long', 'reduce', 'add',
];

const cleanText = (val?: string | null) => (typeof val === 'string' ? val.trim() : '');

const summarizeSnippet = (text: string, maxLen = 140) => {
  const cleaned = cleanText(text).replace(/\s+/g, ' ');
  if (!cleaned) return '';
  return cleaned.length <= maxLen ? cleaned : `${cleaned.slice(0, maxLen - 1).trim()}…`;
};

const countMatches = (text: string, keywords: string[]) => {
  const lower = text.toLowerCase();
  return keywords.reduce((count, kw) => (lower.includes(kw) ? count + 1 : count), 0);
};

const formatFeedbackTypeLabel = (type?: string) => {
  if (!type) return 'General';
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export function analyzeFeedbackLocally(
  feedback: Partial<Feedback>,
  previousFeedbacks: Feedback[] = []
): FeedbackAiResponseResult {
  const whatIsCorrect = cleanText(feedback.whatIsCorrect);
  const whatShouldChange = cleanText(feedback.whatShouldChange);
  const whatIsWrong = cleanText(feedback.whatIsWrong);
  const howItShouldGo = cleanText(feedback.howItShouldGo);
  const message = cleanText(feedback.message);
  const subject = cleanText(feedback.subject);
  const feedbackType = (feedback.feedbackType || 'general').toLowerCase();
  const feedbackTypeLabel = formatFeedbackTypeLabel(feedbackType);
  const rating = Number(feedback.rating) || 0;

  const keepUpHighlights: string[] = [];
  const changeHighlights: string[] = [];

  if (whatIsCorrect) keepUpHighlights.push(summarizeSnippet(whatIsCorrect));
  if (whatShouldChange) changeHighlights.push(summarizeSnippet(whatShouldChange));
  if (whatIsWrong && whatIsWrong !== whatShouldChange) changeHighlights.push(summarizeSnippet(whatIsWrong));
  if (howItShouldGo && howItShouldGo !== whatShouldChange) changeHighlights.push(summarizeSnippet(howItShouldGo));

  const sentences = `${subject}. ${message}`
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  let positiveScore = whatIsCorrect ? 2 : 0;
  let changeScore = whatShouldChange || whatIsWrong || howItShouldGo ? 2 : 0;

  // Factor in tenant's submitted feedbackType
  if (feedbackType === 'complaint' || feedbackType === 'bug') {
    changeScore += 2;
  } else if (feedbackType === 'suggestion' || feedbackType === 'improvement') {
    changeScore += 1;
  }

  if (rating >= 4) positiveScore += 2;
  else if (rating > 0 && rating <= 2) changeScore += 2;
  else if (rating === 3) {
    positiveScore += 1;
    changeScore += 1;
  }

  for (const sentence of sentences) {
    const posHits = countMatches(sentence, KEEP_UP_KEYWORDS);
    const chgHits = countMatches(sentence, CHANGE_KEYWORDS);
    positiveScore += posHits;
    changeScore += chgHits;

    const snippet = summarizeSnippet(sentence);
    if (!snippet) continue;

    if (posHits > chgHits && keepUpHighlights.length < 3 && !keepUpHighlights.includes(snippet)) {
      keepUpHighlights.push(snippet);
    } else if (chgHits > 0 && changeHighlights.length < 3 && !changeHighlights.includes(snippet)) {
      changeHighlights.push(snippet);
    }
  }

  // Check tenant's previous ("before") feedback
  const priorItems = previousFeedbacks.filter((item) => item.id !== feedback.id);
  const relatedPrior = priorItems.find(
    (item) =>
      (feedback.categoryId && item.categoryId === feedback.categoryId) ||
      (feedback.departmentId && item.departmentId === feedback.departmentId) ||
      (feedback.serviceName && item.serviceName === feedback.serviceName)
  );
  const latestPrior = relatedPrior || priorItems[0];
  const previousFeedbackCount = priorItems.length;
  const historySummary =
    previousFeedbackCount > 0
      ? `Checked ${previousFeedbackCount} prior feedback item${previousFeedbackCount === 1 ? '' : 's'} from this tenant${latestPrior?.subject ? ` (latest: "${summarizeSnippet(latestPrior.subject, 55)}")` : ''}.`
      : 'First recorded feedback from this tenant.';

  let detectedType: FeedbackAiDetectionType = 'mixed';
  const hasKeepUp = keepUpHighlights.length > 0 || positiveScore > 0;
  const hasChange = changeHighlights.length > 0 || changeScore > 0;

  if (hasKeepUp && hasChange) {
    if (!whatShouldChange && !whatIsWrong && positiveScore >= changeScore * 2 && rating >= 4 && feedbackType !== 'complaint' && feedbackType !== 'bug') {
      detectedType = 'keep_it_up';
    } else if (!whatIsCorrect && changeScore >= positiveScore * 2 && (rating === 0 || rating <= 3 || feedbackType === 'complaint' || feedbackType === 'bug')) {
      detectedType = 'needs_change';
    } else {
      detectedType = 'mixed';
    }
  } else if (hasKeepUp) {
    detectedType = 'keep_it_up';
  } else if (hasChange) {
    detectedType = 'needs_change';
  } else if (rating >= 4 && feedbackType !== 'complaint' && feedbackType !== 'bug') {
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

  const tenantName = cleanText(feedback.tenantName) || cleanText(feedback.contactPerson) || 'Valued Tenant';
  const area = cleanText(feedback.serviceName) || cleanText(feedback.departmentName) || cleanText(feedback.categoryName) || 'our service';
  const keepUpFocus = keepUpHighlights[0] || `the positive experience you shared regarding ${area}`;
  const changeFocus = changeHighlights[0] || `the improvements you requested for ${area}`;

  const priorContextClause =
    previousFeedbackCount > 0
      ? relatedPrior
        ? ` We also reviewed your earlier ${formatFeedbackTypeLabel(relatedPrior.feedbackType).toLowerCase()} feedback on this same area to ensure continuity.`
        : ` We also reviewed your ${previousFeedbackCount} earlier feedback submission${previousFeedbackCount === 1 ? '' : 's'} to keep full context.`
      : '';

  const typeLead =
    feedbackType === 'complaint'
      ? 'thank you for raising this complaint and sharing your honest experience'
      : feedbackType === 'bug'
        ? 'thank you for reporting this technical issue and helping us catch it'
        : feedbackType === 'suggestion' || feedbackType === 'improvement'
          ? `thank you for your constructive ${feedbackType} regarding`
          : feedbackType === 'office_inquiry'
            ? 'thank you for reaching out with your office inquiry regarding'
            : 'thank you for taking the time to share your feedback on';

  const quickResponses =
    detectedType === 'keep_it_up'
      ? [
          {
            id: 'recommended',
            label: 'Thank You & Keep It Up',
            tone: 'Warm & Appreciative',
            text: `Dear ${tenantName}, ${typeLead} ${area}. We are delighted to hear about ${keepUpFocus}, and we have shared your appreciation with our team so we keep up this standard.${priorContextClause}`,
          },
          {
            id: 'concise',
            label: 'Quick Thank You',
            tone: 'Concise',
            text: `Thank you for your positive ${feedbackTypeLabel.toLowerCase()} feedback, ${tenantName}! We truly appreciate you highlighting what is working well with ${area}, and our team will keep up the great service.`,
          },
          {
            id: 'commitment',
            label: 'Service Commitment',
            tone: 'Professional',
            text: `Dear ${tenantName}, we appreciate your ${feedbackTypeLabel.toLowerCase()} feedback regarding ${area}. Knowing that ${keepUpFocus} is working well motivates our team to maintain this quality moving forward.${priorContextClause}`,
          },
        ]
      : detectedType === 'needs_change'
        ? [
            {
              id: 'recommended',
              label: `Address ${feedbackTypeLabel} & Improve`,
              tone: 'Empathetic & Action-Oriented',
              text: `Dear ${tenantName}, ${typeLead} ${area}. We hear your concern regarding ${changeFocus}, and we have shared these needed changes with the responsible team for prompt improvement.${priorContextClause}`,
            },
            {
              id: 'concise',
              label: 'Quick Improvement Reply',
              tone: 'Concise',
              text: `Thank you for your ${feedbackTypeLabel.toLowerCase()}, ${tenantName}. We have noted what needs to be changed regarding ${area} and our team is actively working on the requested improvement.`,
            },
            {
              id: 'followup',
              label: 'Change Confirmation',
              tone: 'Reassuring',
              text: `Dear ${tenantName}, we value your ${feedbackTypeLabel.toLowerCase()} on ${area}. Your points regarding ${changeFocus} have been reviewed and assigned for action so we can deliver a better experience going forward.${priorContextClause}`,
            },
          ]
        : [
            {
              id: 'recommended',
              label: 'Thank You (Keep Up + Changes)',
              tone: 'Balanced & Constructive',
              text: `Dear ${tenantName}, ${typeLead} ${area}. We are glad to know what is working well (${keepUpFocus}) and will keep that up, while also addressing what should be changed (${changeFocus}) with our team.${priorContextClause}`,
            },
            {
              id: 'concise',
              label: 'Quick Balanced Reply',
              tone: 'Concise',
              text: `Thank you for your ${feedbackTypeLabel.toLowerCase()} feedback, ${tenantName}! We appreciate what you highlighted to keep up in ${area} and are taking action on the improvements you suggested.`,
            },
            {
              id: 'team_update',
              label: 'Team Action Update',
              tone: 'Professional',
              text: `Dear ${tenantName}, we appreciate your balanced ${feedbackTypeLabel.toLowerCase()} regarding ${area}. Our team is committed to maintaining the strengths you noted while making the requested changes to serve you better.${priorContextClause}`,
            },
          ];

  return {
    detectedType,
    detectedLabel,
    feedbackTypeUsed: feedbackTypeLabel,
    previousFeedbackCount,
    historySummary,
    keepUpHighlights,
    changeHighlights,
    recommendedResponse: quickResponses[0].text,
    quickResponses,
    source: 'ai-nlp-engine',
  };
}
