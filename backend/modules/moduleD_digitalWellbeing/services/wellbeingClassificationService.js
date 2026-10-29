/**
 * wellbeingClassificationService.js
 * Pure, unit-testable classification engine for domain and URL pattern matching.
 * Implements user-defined priority precedence and academic developer presets.
 */

const SYSTEM_DEFAULT_RULES = [
  // High-priority Academic & SPIT Portal Rules
  {
    ruleName: 'S.P.I.T. Academic Portals',
    pattern: 'spit.ac.in',
    matchType: 'domain_suffix',
    category: 'learning',
    priority: 100,
    isEnabled: true
  },
  {
    ruleName: 'Moodle LMS',
    pattern: 'moodle.',
    matchType: 'contains',
    category: 'learning',
    priority: 95,
    isEnabled: true
  },
  // Developer & Coding Learning Hubs
  {
    ruleName: 'GitHub Code Repositories',
    pattern: 'github.com',
    matchType: 'domain_suffix',
    category: 'learning',
    priority: 90,
    isEnabled: true
  },
  {
    ruleName: 'StackOverflow Technical Q&A',
    pattern: 'stackoverflow.com',
    matchType: 'domain_suffix',
    category: 'learning',
    priority: 90,
    isEnabled: true
  },
  {
    ruleName: 'LeetCode Problem Solving',
    pattern: 'leetcode.com',
    matchType: 'domain_suffix',
    category: 'learning',
    priority: 90,
    isEnabled: true
  },
  {
    ruleName: 'MDN Web Docs',
    pattern: 'developer.mozilla.org',
    matchType: 'domain_suffix',
    category: 'learning',
    priority: 85,
    isEnabled: true
  },
  // Productivity Suites
  {
    ruleName: 'Notion Workspace',
    pattern: 'notion.so',
    matchType: 'domain_suffix',
    category: 'productive',
    priority: 80,
    isEnabled: true
  },
  {
    ruleName: 'Google Workspace Docs',
    pattern: 'docs.google.com',
    matchType: 'domain_suffix',
    category: 'productive',
    priority: 80,
    isEnabled: true
  },
  {
    ruleName: 'Overleaf LaTeX Editor',
    pattern: 'overleaf.com',
    matchType: 'domain_suffix',
    category: 'productive',
    priority: 80,
    isEnabled: true
  },
  // Entertainment & Social Distractions
  {
    ruleName: 'YouTube Streaming',
    pattern: 'youtube.com',
    matchType: 'domain_suffix',
    category: 'distracting',
    priority: 75,
    isEnabled: true
  },
  {
    ruleName: 'Instagram Media',
    pattern: 'instagram.com',
    matchType: 'domain_suffix',
    category: 'distracting',
    priority: 75,
    isEnabled: true
  },
  {
    ruleName: 'Reddit Forums',
    pattern: 'reddit.com',
    matchType: 'domain_suffix',
    category: 'distracting',
    priority: 75,
    isEnabled: true
  },
  {
    ruleName: 'Twitter / X',
    pattern: 'twitter.com',
    matchType: 'domain_suffix',
    category: 'distracting',
    priority: 75,
    isEnabled: true
  },
  {
    ruleName: 'Netflix',
    pattern: 'netflix.com',
    matchType: 'domain_suffix',
    category: 'distracting',
    priority: 75,
    isEnabled: true
  },
  // General Neutral Search
  {
    ruleName: 'Google Search Engine',
    pattern: 'google.com',
    matchType: 'domain_suffix',
    category: 'neutral',
    priority: 50,
    isEnabled: true
  },
  {
    ruleName: 'Wikipedia Encyclopedia',
    pattern: 'wikipedia.org',
    matchType: 'domain_suffix',
    category: 'neutral',
    priority: 50,
    isEnabled: true
  }
];

/**
 * Normalizes input domain string:
 * - Strips protocol (http://, https://)
 * - Strips leading 'www.'
 * - Strips paths, query parameters, hashes, and ports
 * - Lowercases and trims whitespace
 */
function normalizeDomain(input) {
  if (!input || typeof input !== 'string') return '';
  let str = input.trim().toLowerCase();

  // Remove protocol
  str = str.replace(/^[a-zA-Z]+:\/\//, '');

  // Remove credentials if any
  if (str.includes('@')) {
    str = str.split('@')[1];
  }

  // Remove path, query params, hash
  str = str.split('/')[0];
  str = str.split('?')[0];
  str = str.split('#')[0];

  // Remove port
  str = str.split(':')[0];

  // Remove leading www.
  if (str.startsWith('www.')) {
    str = str.substring(4);
  }

  return str.trim();
}

/**
 * Checks whether candidate domain matches a single rule pattern
 */
function matchesPattern(domain, pattern, matchType) {
  if (!domain || !pattern) return false;
  const d = domain.toLowerCase();
  const p = pattern.toLowerCase();

  switch (matchType) {
    case 'exact_host':
      return d === p;
    case 'contains':
      return d.includes(p);
    case 'domain_suffix':
    default:
      return d === p || d.endsWith('.' + p);
  }
}

/**
 * Classifies a domain against a set of user rules, falling back to system defaults.
 * Rules are evaluated by descending priority.
 *
 * @param {string} domainInput Raw or normalized domain
 * @param {Array} userRules Array of user-defined rules
 * @param {boolean} includeSystemDefaults Whether to fallback to system defaults
 * @returns {object} Classification result { category, ruleId, ruleName, matchedPattern, matchType }
 */
function classifyDomain(domainInput, userRules = [], includeSystemDefaults = true) {
  const domain = normalizeDomain(domainInput);
  if (!domain) {
    return {
      category: 'uncategorized',
      ruleId: null,
      ruleName: 'Empty Domain',
      matchedPattern: null,
      matchType: 'none'
    };
  }

  // Filter and sort active user rules by priority descending
  const activeUserRules = (userRules || [])
    .filter(r => r.isEnabled !== false)
    .sort((a, b) => (b.priority || 10) - (a.priority || 10));

  for (const rule of activeUserRules) {
    if (matchesPattern(domain, rule.pattern, rule.matchType)) {
      return {
        category: rule.category || 'productive',
        ruleId: rule._id ? rule._id.toString() : null,
        ruleName: rule.ruleName || 'User Rule',
        matchedPattern: rule.pattern,
        matchType: rule.matchType || 'domain_suffix'
      };
    }
  }

  // Evaluate system defaults if not matched by user rules
  if (includeSystemDefaults) {
    const activeSystemRules = SYSTEM_DEFAULT_RULES
      .filter(r => r.isEnabled)
      .sort((a, b) => b.priority - a.priority);

    for (const sysRule of activeSystemRules) {
      if (matchesPattern(domain, sysRule.pattern, sysRule.matchType)) {
        return {
          category: sysRule.category,
          ruleId: null,
          ruleName: sysRule.ruleName,
          matchedPattern: sysRule.pattern,
          matchType: sysRule.matchType
        };
      }
    }
  }

  // Fallback for unrecognized domains
  return {
    category: 'uncategorized',
    ruleId: null,
    ruleName: 'Default Uncategorized',
    matchedPattern: null,
    matchType: 'none'
  };
}

module.exports = {
  SYSTEM_DEFAULT_RULES,
  normalizeDomain,
  matchesPattern,
  classifyDomain
};
