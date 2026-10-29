import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeHostname,
  matchesPattern,
  classifyHostname,
  isInternalBrowserUrl
} from '../shared/rulesEngine.js';

describe('Chrome Extension: Rules Engine & Domain Classification', () => {

  test('normalizeHostname correctly strips protocols, paths, query params and www', () => {
    assert.equal(normalizeHostname('https://www.github.com/manthanpalkar/project?tab=code#readme'), 'github.com');
    assert.equal(normalizeHostname('http://spit.ac.in:8080/portal/index.php'), 'spit.ac.in');
    assert.equal(normalizeHostname('https://moodle.spit.ac.in/my/'), 'moodle.spit.ac.in');
    assert.equal(normalizeHostname('   LEETCODE.COM/problems   '), 'leetcode.com');
    assert.equal(normalizeHostname(''), '');
  });

  test('isInternalBrowserUrl recognizes browser-internal URLs', () => {
    assert.equal(isInternalBrowserUrl('chrome://extensions/'), true);
    assert.equal(isInternalBrowserUrl('chrome-extension://abcdef/popup.html'), true);
    assert.equal(isInternalBrowserUrl('edge://settings/'), true);
    assert.equal(isInternalBrowserUrl('about:blank'), true);
    assert.equal(isInternalBrowserUrl('https://spit.ac.in'), false);
    assert.equal(isInternalBrowserUrl('http://localhost:5173'), false);
  });

  test('matchesPattern validates match types accurately', () => {
    // domain_suffix
    assert.equal(matchesPattern('docs.python.org', 'python.org', 'domain_suffix'), true);
    assert.equal(matchesPattern('python.org', 'python.org', 'domain_suffix'), true);
    assert.equal(matchesPattern('notpython.org', 'python.org', 'domain_suffix'), false);

    // exact_host
    assert.equal(matchesPattern('github.com', 'github.com', 'exact_host'), true);
    assert.equal(matchesPattern('gist.github.com', 'github.com', 'exact_host'), false);

    // contains
    assert.equal(matchesPattern('moodle.spit.ac.in', 'moodle', 'contains'), true);
    assert.equal(matchesPattern('spit.ac.in', 'moodle', 'contains'), false);
  });

  test('classifyHostname: user-defined rule overrides system default', () => {
    const userRules = [
      {
        id: 'u1',
        ruleName: 'Study YouTube',
        pattern: 'youtube.com',
        matchType: 'domain_suffix',
        category: 'learning', // User overrides default distracting
        priority: 95,
        isEnabled: true
      }
    ];

    const result = classifyHostname('https://www.youtube.com/watch?v=123', userRules);
    assert.equal(result.category, 'learning');
    assert.equal(result.ruleName, 'Study YouTube');
    assert.equal(result.isExcluded, false);
  });

  test('classifyHostname: excluded domain is respected and marked', () => {
    const excluded = ['localhost', 'internal-spit.ac.in'];
    const result = classifyHostname('http://localhost:5173/dashboard', [], excluded);
    assert.equal(result.isExcluded, true);
    assert.equal(result.category, 'neutral');
  });

  test('classifyHostname: system default fallback', () => {
    const result = classifyHostname('https://leetcode.com/problemset', []);
    assert.equal(result.category, 'learning');
    assert.equal(result.matchedPattern, 'leetcode.com');
  });

  test('classifyHostname: unconfigured domain falls back to uncategorized', () => {
    const result = classifyHostname('https://some-random-unknown-domain-xyz.net', []);
    assert.equal(result.category, 'uncategorized');
    assert.equal(result.isExcluded, false);
  });

});
