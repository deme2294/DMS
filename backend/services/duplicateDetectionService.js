/**
 * Duplicate Ticket Detection Service
 * Analyzes ticket text, metadata, tenant context, and timestamps to suggest potential duplicates.
 * NOTE: As per system rules, this service only SUGGESTS potential duplicates.
 * It NEVER automatically merges tickets without human confirmation.
 */

const STOP_WORDS = new Set([
  'the', 'and', 'a', 'an', 'is', 'of', 'to', 'in', 'for', 'with', 'on', 'at', 'by',
  'from', 'up', 'about', 'into', 'over', 'after', 'ticket', 'issue', 'problem',
  'request', 'help', 'please', 'urgent', 'error', 'broken', 'not', 'working', 'hd', 'test'
]);

export const CATEGORY_CLUSTERS = {
  internet_network: [
    'internet', 'network', 'ethernet', 'wifi', 'wi-fi', 'broadband', 'connection', 'connectivity',
    'lan', 'wan', 'wlan', 'router', 'modem', 'switch', 'cable', 'rj45', 'port', 'dns', 'ip',
    'ping', 'latency', 'bandwidth', 'disconnect', 'disconnected', 'disconnecting', 'offline',
    'slow internet', 'no internet', 'server', 'server down', 'server without work', 'server not working',
    'troubleshoot', 'troubleshooting', 'it support', 'technical support', 'fiber', 'optical'
  ],
  hardware: [
    'hardware', 'computer', 'pc', 'laptop', 'desktop', 'monitor', 'screen', 'display', 'keyboard',
    'mouse', 'printer', 'scanner', 'copier', 'toner', 'cartridge', 'power supply', 'cpu', 'ram',
    'hard drive', 'ssd', 'usb', 'dock', 'docking'
  ],
  software_account: [
    'software', 'application', 'app', 'system', 'os', 'windows', 'linux', 'mac', 'license',
    'login', 'log in', 'signin', 'sign in', 'password', 'credential', 'auth', 'authentication',
    'access', 'permission', 'portal', 'account', 'email', 'outlook', 'gmail', 'mailbox', 'inbox'
  ],
  facility_office: [
    'facility', 'power', 'electricity', 'blackout', 'generator', 'ups', 'cooling', 'ac', 'hvac',
    'air conditioning', 'temperature', 'water', 'leak', 'plumbing', 'lighting', 'light', 'bulb',
    'office', 'desk', 'chair', 'furniture', 'door', 'lock', 'access card', 'key'
  ]
};

export const getCategoryCluster = (text) => {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  for (const [clusterKey, keywords] of Object.entries(CATEGORY_CLUSTERS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return clusterKey;
      }
    }
  }
  return null;
};

export const normalizeString = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

export const extractKeywords = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
};

export const calculateKeywordOverlap = (tokensA, tokensB) => {
  if (!tokensA.length || !tokensB.length) return { score: 0, matches: [] };
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const matches = [...setA].filter((token) => setB.has(token));
  const unionSize = new Set([...setA, ...setB]).size;
  const jaccard = unionSize > 0 ? matches.length / unionSize : 0;
  return { score: jaccard, matches };
};

/**
 * Compare two tickets and compute similarity score (0 to 100), duplicate pattern, and rationale.
 * Strongly flags and prioritizes:
 *  1. Tickets with the SAME TITLE submitted by DIFFERENT TENANTS (Cross-Tenant Incident)
 *  2. Tickets with the SAME TITLE submitted at DIFFERENT TIMES (Time-Shifted / Recurring Issue)
 */
export const compareTicketsForDuplicate = (ticketA, ticketB) => {
  // STRICT RULE: Tickets with different categories can NEVER be merged or suggested as duplicates.
  // Only tickets belonging to the EXACT SAME category can be evaluated and suggested as duplicate/merge candidates.
  const getCatStr = (t) => {
    if (!t) return '';
    if (typeof t.category === 'string') return t.category.toLowerCase().trim();
    if (typeof t.category_name === 'string') return t.category_name.toLowerCase().trim();
    if (typeof t.categoryName === 'string') return t.categoryName.toLowerCase().trim();
    if (t.category && typeof t.category.name === 'string') return t.category.name.toLowerCase().trim();
    return '';
  };
  const catA = getCatStr(ticketA);
  const catB = getCatStr(ticketB);
  if (!catA || !catB || catA !== catB) {
    return {
      score: 0,
      confidence: 'none',
      reasons: [`Different categories: "${ticketA.category || catA || 'Unspecified'}" vs "${ticketB.category || catB || 'Unspecified'}" (merging across different categories is strictly prohibited)`],
      isSuggestedDuplicate: false,
      pattern: 'different_category',
      patternLabel: 'Different Category',
      isCrossTenant: false,
      isTimeShifted: false,
      isSameTenant: false,
      isSameTenantRepeated: false,
      isSameCategory: false,
      hoursDiff: null,
      daysDiff: null,
    };
  }

  let score = 0;
  const reasons = [];

  const normTitleA = normalizeString(ticketA.title);
  const normTitleB = normalizeString(ticketB.title);
  const isExactTitle = normTitleA.length >= 3 && normTitleA === normTitleB;
  const isSubstringTitle =
    (normTitleA.length >= 5 && normTitleB.includes(normTitleA)) ||
    (normTitleB.length >= 5 && normTitleA.includes(normTitleB));

  const titleTokensA = extractKeywords(ticketA.title);
  const titleTokensB = extractKeywords(ticketB.title);
  const titleOverlap = calculateKeywordOverlap(titleTokensA, titleTokensB);

  // Tenant comparison (handles snake_case and camelCase and user creator)
  const tenantA = ticketA.tenant_id ? String(ticketA.tenant_id) : (ticketA.tenantId ? String(ticketA.tenantId) : null);
  const tenantB = ticketB.tenant_id ? String(ticketB.tenant_id) : (ticketB.tenantId ? String(ticketB.tenantId) : null);
  const userA = ticketA.created_by ? String(ticketA.created_by) : (ticketA.createdBy ? String(ticketA.createdBy) : null);
  const userB = ticketB.created_by ? String(ticketB.created_by) : (ticketB.createdBy ? String(ticketB.createdBy) : null);

  const isSameTenant = Boolean((tenantA && tenantB && tenantA === tenantB) || (userA && userB && userA === userB));
  const isDifferentTenant = Boolean(tenantA && tenantB && tenantA !== tenantB);

  // Time comparison (handles snake_case and camelCase)
  const dateA = ticketA.created_at || ticketA.createdAt ? new Date(ticketA.created_at || ticketA.createdAt).getTime() : null;
  const dateB = ticketB.created_at || ticketB.createdAt ? new Date(ticketB.created_at || ticketB.createdAt).getTime() : null;
  let hoursDiff = null;
  let daysDiff = null;
  let isDifferentTime = false;
  if (dateA && dateB) {
    const timeDiffMs = Math.abs(dateA - dateB);
    hoursDiff = timeDiffMs / (1000 * 60 * 60);
    daysDiff = Math.round(hoursDiff / 24);
    // Submissions 30 minutes or more apart count as distinct submission timestamps (time-shifted/recurring)
    if (hoursDiff >= 0.5) {
      isDifferentTime = true;
    }
  }

  // Determine Pattern Flags
  let isCrossTenant = false;
  let isTimeShifted = false;

  // 1. Exact Title Match (High Priority)
  if (isExactTitle) {
    score += 55;
    reasons.push(`Identical Title: "${ticketA.title}"`);

    // (A) Cross-Tenant Incident: Different tenants reporting the same title
    if (isDifferentTenant) {
      score += 25;
      isCrossTenant = true;
      const tA = ticketA.tenant_name || ticketA.tenantName || ticketA.tenant_organization || 'Tenant A';
      const tB = ticketB.tenant_name || ticketB.tenantName || ticketB.tenant_organization || 'Tenant B';
      reasons.push(`Cross-Tenant Duplicate: Reported by different tenants (${tA} & ${tB})`);
    } else if (isSameTenant) {
      score += 25;
      reasons.push(`Same Tenant: Repeated report by same tenant`);
    }

    // (B) Time-Shifted / Recurring Incident: Same title reported at different times
    if (isDifferentTime) {
      score += 20;
      isTimeShifted = true;
      const timeStr = daysDiff > 0 ? (daysDiff === 1 ? '1 day' : `${daysDiff} days`) : (hoursDiff === 1 ? '1 hour' : `${Math.round(hoursDiff * 10) / 10} hours`);
      reasons.push(`Time-Shifted Duplicate: Reported at different times (${timeStr} apart)`);
    } else if (hoursDiff !== null && hoursDiff < 0.5) {
      score += 10;
      reasons.push(`Close Proximity: Reported within minutes of each other`);
    }
  }
  // 2. High Title Keyword Overlap or Substring Match
  else if (titleOverlap.matches.length > 0 || isSubstringTitle) {
    const basePts = isSubstringTitle ? 40 : Math.round(titleOverlap.score * 45) + (titleOverlap.matches.length >= 2 ? 15 : 5);
    score += Math.min(45, basePts);
    if (titleOverlap.matches.length > 0) {
      reasons.push(`Title keywords matched: "${titleOverlap.matches.slice(0, 4).join(', ')}"`);
    } else if (isSubstringTitle) {
      reasons.push(`Title contains matching phrases`);
    }

    if (isDifferentTenant && (titleOverlap.score >= 0.5 || isSubstringTitle)) {
      score += 20;
      isCrossTenant = true;
      const tA = ticketA.tenant_name || ticketA.tenantName || ticketA.tenant_organization || 'Tenant A';
      const tB = ticketB.tenant_name || ticketB.tenantName || ticketB.tenant_organization || 'Tenant B';
      reasons.push(`Cross-Tenant Overlap: Reported by different tenants (${tA} & ${tB})`);
    } else if (isSameTenant) {
      score += 20;
      reasons.push(`Same Tenant: Matching issue from same tenant`);
    }

    if (isDifferentTime) {
      score += 15;
      isTimeShifted = true;
      const timeStr = daysDiff > 0 ? `${daysDiff} day(s)` : `${Math.round(hoursDiff * 10) / 10} hour(s)`;
      reasons.push(`Time-Shifted Overlap: Reported at different times (${timeStr} apart)`);
    } else if (hoursDiff !== null && hoursDiff < 1) {
      score += 10;
      reasons.push(`Created in close proximity`);
    }
  }

  // 3. Category & Semantic Domain Analysis (e.g. Internet, Ethernet, Server, Troubleshooting)
  const isExactCategory = Boolean(catA && catB && catA === catB);

  const fullTextA = `${ticketA.title || ''} ${ticketA.description || ''} ${catA}`.toLowerCase();
  const fullTextB = `${ticketB.title || ''} ${ticketB.description || ''} ${catB}`.toLowerCase();

  const clusterA = getCategoryCluster(catA) || getCategoryCluster(fullTextA);
  const clusterB = getCategoryCluster(catB) || getCategoryCluster(fullTextB);
  const isClusterMatch = Boolean(clusterA && clusterB && clusterA === clusterB);

  // Common technical issue words across tickets
  const matchedDomainKeywords = [];
  if (isClusterMatch && CATEGORY_CLUSTERS[clusterA]) {
    for (const kw of CATEGORY_CLUSTERS[clusterA]) {
      if (fullTextA.includes(kw) && fullTextB.includes(kw) && kw.length >= 4) {
        matchedDomainKeywords.push(kw);
      }
    }
  }

  if (isExactCategory) {
    score += 30;
    reasons.push(`Same category: ${ticketA.category}`);
  } else if (isClusterMatch) {
    score += 25;
    const clusterLabel = clusterA === 'internet_network' ? 'Internet & Network' : clusterA.replace(/_/g, ' ');
    reasons.push(`Matching issue domain: ${clusterLabel} (${ticketA.category || 'General'} / ${ticketB.category || 'General'})`);
  }

  // Repeated ticket submission by SAME TENANT in the SAME CATEGORY or DOMAIN
  // E.g., multiple reports of internet, troubleshooting, ethernet, server without work
  let isSameTenantRepeated = false;
  if (isSameTenant) {
    if (isExactCategory || isClusterMatch) {
      isSameTenantRepeated = true;
      score += 45; // Strongly boost repeated submissions by the same tenant in the same category
      reasons.push(`Repeated ticket creation by same tenant in "${ticketA.category || ticketB.category || 'Internet'}" domain`);

      if (isDifferentTime) {
        isTimeShifted = true;
        const timeStr = daysDiff > 0 ? (daysDiff === 1 ? '1 day' : `${daysDiff} days`) : (hoursDiff === 1 ? '1 hour' : `${Math.round(hoursDiff * 10) / 10} hours`);
        reasons.push(`Repeated submission over time: submitted ${timeStr} apart`);
      }
    }
  }

  // Domain fault keyword overlap (ethernet, server, troubleshooting, etc.)
  if (matchedDomainKeywords.length > 0) {
    const uniqueKws = Array.from(new Set(matchedDomainKeywords)).slice(0, 4);
    score += Math.min(25, 10 + uniqueKws.length * 5);
    reasons.push(`Shared technical fault details: "${uniqueKws.join(', ')}"`);
  }

  // 4. Department match (up to 10 points)
  const deptA = ticketA.department_id || ticketA.departmentId;
  const deptB = ticketB.department_id || ticketB.departmentId;
  if (deptA && deptB && String(deptA) === String(deptB)) {
    score += 10;
    reasons.push(`Same assigned department`);
  }

  // 5. Description keyword overlap (up to 15 bonus points)
  const descA = extractKeywords(ticketA.description);
  const descB = extractKeywords(ticketB.description);
  const descOverlap = calculateKeywordOverlap(descA, descB);
  if (descOverlap.matches.length >= 2) {
    score += 15;
    reasons.push(`Description details overlap ("${descOverlap.matches.slice(0, 3).join(', ')}")`);
  }

  // Classify pattern
  let pattern = 'general_similarity';
  let patternLabel = 'Similar Issue';
  if (isSameTenantRepeated) {
    pattern = 'same_tenant_repeated';
    patternLabel = 'Same Tenant · Repeated Category Issue';
  } else if (isCrossTenant && isTimeShifted) {
    pattern = 'cross_tenant_time_shifted';
    patternLabel = 'Cross-Tenant & Time-Shifted';
  } else if (isCrossTenant) {
    pattern = 'cross_tenant';
    patternLabel = 'Cross-Tenant Incident';
  } else if (isTimeShifted) {
    pattern = 'time_shifted';
    patternLabel = 'Time-Shifted / Recurring';
  } else if (isSameTenant) {
    pattern = 'same_tenant';
    patternLabel = 'Same Tenant Duplicate';
  }

  // Normalize final score to 0 - 100
  const finalScore = Math.min(100, Math.max(0, score));

  let confidence = 'low';
  if (finalScore >= 65) confidence = 'high';
  else if (finalScore >= 40) confidence = 'medium';

  return {
    score: finalScore,
    confidence,
    reasons,
    isSuggestedDuplicate: finalScore >= 40,
    pattern,
    patternLabel,
    isCrossTenant,
    isTimeShifted,
    isSameTenant,
    isSameTenantRepeated,
    isSameCategory: Boolean(isExactCategory || isClusterMatch),
    hoursDiff,
    daysDiff,
  };
};

/**
 * Scan a collection of tickets and detect duplicate pairs/clusters.
 * Excludes already merged tickets and avoids reciprocal pairs.
 */
export const scanForDuplicates = (tickets, options = {}) => {
  if (!Array.isArray(tickets) || tickets.length < 2) return [];

  const minScore = options.minScore || 40;
  const suggestions = [];
  const seenPairs = new Set();

  for (let i = 0; i < tickets.length; i++) {
    const tA = tickets[i];
    if (tA.merged_into) continue;

    for (let j = i + 1; j < tickets.length; j++) {
      const tB = tickets[j];
      if (tB.merged_into || tA.id === tB.id) continue;

      const pairKey = [tA.id, tB.id].sort().join(':');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const comparison = compareTicketsForDuplicate(tA, tB);
      if (comparison.score >= minScore) {
        // Designate the earlier created ticket as primary candidate by default
        const dateA = new Date(tA.created_at || 0).getTime();
        const dateB = new Date(tB.created_at || 0).getTime();
        const [primaryCandidate, duplicateCandidate] = dateA <= dateB ? [tA, tB] : [tB, tA];

        suggestions.push({
          ticketA: primaryCandidate,
          ticketB: duplicateCandidate,
          primaryCandidate,
          duplicateCandidate,
          score: comparison.score,
          confidence: comparison.confidence,
          reasons: comparison.reasons,
          pattern: comparison.pattern,
          patternLabel: comparison.patternLabel,
          isCrossTenant: comparison.isCrossTenant,
          isTimeShifted: comparison.isTimeShifted,
          isSameTenant: comparison.isSameTenant,
          isSameTenantRepeated: comparison.isSameTenantRepeated,
          isSameCategory: comparison.isSameCategory,
          daysDiff: comparison.daysDiff,
          hoursDiff: comparison.hoursDiff,
        });
      }
    }
  }

  // Sort by highest similarity score first
  suggestions.sort((a, b) => b.score - a.score);
  return suggestions;
};
