/**
 * rulesEngine.js
 * Domain normalization, categorization rules precedence, and website classification.
 * Shared between Chrome extension background worker, popup, options, and tests.
 */

export const DEFAULT_SYSTEM_RULES = [
  // High-priority Academic & SPIT Portals
  { id: 'sys_spit', ruleName: 'S.P.I.T. Academic Portal', pattern: 'spit.ac.in', matchType: 'domain_suffix', category: 'learning', priority: 100, isEnabled: true },
  { id: 'sys_moodle', ruleName: 'Moodle LMS', pattern: 'moodle.', matchType: 'contains', category: 'learning', priority: 95, isEnabled: true },

  // Coding & Learning Platforms
  { id: 'sys_github', ruleName: 'GitHub Repositories', pattern: 'github.com', matchType: 'domain_suffix', category: 'learning', priority: 90, isEnabled: true },
  { id: 'sys_so', ruleName: 'StackOverflow', pattern: 'stackoverflow.com', matchType: 'domain_suffix', category: 'learning', priority: 90, isEnabled: true },
  { id: 'sys_leetcode', ruleName: 'LeetCode Practice', pattern: 'leetcode.com', matchType: 'domain_suffix', category: 'learning', priority: 90, isEnabled: true },
  { id: 'sys_mdn', ruleName: 'MDN Web Docs', pattern: 'developer.mozilla.org', matchType: 'domain_suffix', category: 'learning', priority: 85, isEnabled: true },
  { id: 'sys_pydocs', ruleName: 'Python Documentation', pattern: 'docs.python.org', matchType: 'domain_suffix', category: 'learning', priority: 85, isEnabled: true },

  // Productivity Tools
  { id: 'sys_notion', ruleName: 'Notion Workspace', pattern: 'notion.so', matchType: 'domain_suffix', category: 'productive', priority: 80, isEnabled: true },
  { id: 'sys_gdocs', ruleName: 'Google Docs', pattern: 'docs.google.com', matchType: 'domain_suffix', category: 'productive', priority: 80, isEnabled: true },
  { id: 'sys_overleaf', ruleName: 'Overleaf LaTeX', pattern: 'overleaf.com', matchType: 'domain_suffix', category: 'productive', priority: 80, isEnabled: true },

  // Entertainment & Social Distractions
  { id: 'sys_youtube', ruleName: 'YouTube', pattern: 'youtube.com', matchType: 'domain_suffix', category: 'distracting', priority: 75, isEnabled: true },
  { id: 'sys_instagram', ruleName: 'Instagram', pattern: 'instagram.com', matchType: 'domain_suffix', category: 'distracting', priority: 75, isEnabled: true },
  { id: 'sys_reddit', ruleName: 'Reddit', pattern: 'reddit.com', matchType: 'domain_suffix', category: 'distracting', priority: 75, isEnabled: true },
  { id: 'sys_twitter', ruleName: 'Twitter / X', pattern: 'twitter.com', matchType: 'domain_suffix', category: 'distracting', priority: 75, isEnabled: true },
  { id: 'sys_x', ruleName: 'X (Twitter)', pattern: 'x.com', matchType: 'domain_suffix', category: 'distracting', priority: 75, isEnabled: true },
  { id: 'sys_netflix', ruleName: 'Netflix', pattern: 'netflix.com', matchType: 'domain_suffix', category: 'distracting', priority: 75, isEnabled: true },

  // Neutral Search & General Reference
  { id: 'sys_google', ruleName: 'Google Search', pattern: 'google.com', matchType: 'domain_suffix', category: 'neutral', priority: 50, isEnabled: true },
  { id: 'sys_wiki', ruleName: 'Wikipedia', pattern: 'wikipedia.org', matchType: 'domain_suffix', category: 'neutral', priority: 50, isEnabled: true }
];

export const INTERNAL_SCHEMES = [
  'chrome:',
  'chrome-extension:',
  'edge:',
  'about:',
  'devtools:',
  'view-source:',
  'brave:',
  'opera:'
];

/**
 * Checks if a raw URL is an internal browser page that should never be tracked
 */
export function isInternalBrowserUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return true;
  const trimmed = rawUrl.trim().toLowerCase();
  return INTERNAL_SCHEMES.some(scheme => trimmed.startsWith(scheme));
}

/**
 * Normalizes input domain or URL to a clean hostname string:
 * Strips protocol, port, paths, query parameters, fragments, and leading www.
 */
export function normalizeHostname(input) {
  if (!input || typeof input !== 'string') return '';
  let str = input.trim().toLowerCase();

  // If full URL with protocol, extract hostname safely
  if (str.includes('://')) {
    try {
      const parsed = new URL(str);
      str = parsed.hostname;
    } catch {
      str = str.replace(/^[a-zA-Z]+:\/\//, '');
      str = str.split('/')[0].split('?')[0].split('#')[0];
    }
  } else {
    str = str.split('/')[0].split('?')[0].split('#')[0];
  }

  // Strip credentials if present
  if (str.includes('@')) {
    str = str.split('@')[1];
  }

  // Strip port
  str = str.split(':')[0];

  // Strip leading www.
  if (str.startsWith('www.')) {
    str = str.substring(4);
  }

  return str.trim();
}

/**
 * Checks whether candidate hostname matches a single rule pattern
 */
export function matchesPattern(hostname, pattern, matchType) {
  if (!hostname || !pattern) return false;
  const h = hostname.toLowerCase();
  const p = pattern.toLowerCase();

  switch (matchType) {
    case 'exact_host':
      return h === p;
    case 'contains':
      return h.includes(p);
    case 'domain_suffix':
    default:
      return h === p || h.endsWith('.' + p);
  }
}

/**
 * Classifies a hostname against active user rules, falling back to system presets.
 * Returns { category, ruleName, matchedPattern, matchType }
 */
export function classifyHostname(rawInput, userRules = [], excludedDomains = []) {
  const hostname = normalizeHostname(rawInput);
  if (!hostname) {
    return {
      category: 'uncategorized',
      ruleName: 'Empty Hostname',
      matchedPattern: null,
      matchType: 'none',
      isExcluded: false
    };
  }

  // Check user excluded domains
  const isExcluded = (excludedDomains || []).some(ex => {
    const cleanEx = normalizeHostname(ex);
    return cleanEx && (hostname === cleanEx || hostname.endsWith('.' + cleanEx));
  });

  if (isExcluded) {
    return {
      category: 'neutral',
      ruleName: 'Excluded Domain',
      matchedPattern: hostname,
      matchType: 'excluded',
      isExcluded: true
    };
  }

  // 1. Evaluate User-Defined Rules by priority descending
  const activeUserRules = (userRules || [])
    .filter(r => r.isEnabled !== false)
    .sort((a, b) => (b.priority || 10) - (a.priority || 10));

  for (const rule of activeUserRules) {
    if (matchesPattern(hostname, rule.pattern, rule.matchType)) {
      return {
        category: rule.category || 'productive',
        ruleName: rule.ruleName || 'User Rule',
        matchedPattern: rule.pattern,
        matchType: rule.matchType || 'domain_suffix',
        isExcluded: false
      };
    }
  }

  // 2. Evaluate System Default Rules
  const activeSystemRules = DEFAULT_SYSTEM_RULES
    .filter(r => r.isEnabled !== false)
    .sort((a, b) => (b.priority || 10) - (a.priority || 10));

  for (const sysRule of activeSystemRules) {
    if (matchesPattern(hostname, sysRule.pattern, sysRule.matchType)) {
      return {
        category: sysRule.category,
        ruleName: sysRule.ruleName,
        matchedPattern: sysRule.pattern,
        matchType: sysRule.matchType,
        isExcluded: false
      };
    }
  }

  // 3. Fallback for unclassified domains
  return {
    category: 'uncategorized',
    ruleName: 'Default Uncategorized',
    matchedPattern: null,
    matchType: 'none',
    isExcluded: false
  };
}
