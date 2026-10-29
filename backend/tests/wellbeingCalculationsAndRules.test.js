const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeDomain,
  matchesPattern,
  classifyDomain,
  SYSTEM_DEFAULT_RULES
} = require('../modules/moduleD_digitalWellbeing/services/wellbeingClassificationService');

const {
  calculateContextSwitches
} = require('../modules/moduleD_digitalWellbeing/services/wellbeingAnalyticsService');

describe('Module D: Categorization Rules & Analytics Unit Tests', () => {

  describe('1. Domain Normalization (normalizeDomain)', () => {
    test('strips https:// and trailing paths', () => {
      assert.equal(normalizeDomain('https://github.com/manthanpalkar/project'), 'github.com');
    });

    test('strips http:// and query parameters', () => {
      assert.equal(normalizeDomain('http://spit.ac.in/departments/cse?year=2026'), 'spit.ac.in');
    });

    test('strips leading www.', () => {
      assert.equal(normalizeDomain('https://www.youtube.com/watch?v=123'), 'youtube.com');
    });

    test('strips ports and fragments', () => {
      assert.equal(normalizeDomain('http://localhost:5173/#/dashboard'), 'localhost');
    });

    test('handles empty or non-string gracefully', () => {
      assert.equal(normalizeDomain(''), '');
      assert.equal(normalizeDomain(null), '');
      assert.equal(normalizeDomain(undefined), '');
    });
  });

  describe('2. Pattern Matching (matchesPattern)', () => {
    test('matches domain suffix correctly', () => {
      assert.equal(matchesPattern('moodle.spit.ac.in', 'spit.ac.in', 'domain_suffix'), true);
      assert.equal(matchesPattern('spit.ac.in', 'spit.ac.in', 'domain_suffix'), true);
      assert.equal(matchesPattern('notsspit.ac.in', 'spit.ac.in', 'domain_suffix'), false);
    });

    test('matches exact host correctly', () => {
      assert.equal(matchesPattern('github.com', 'github.com', 'exact_host'), true);
      assert.equal(matchesPattern('gist.github.com', 'github.com', 'exact_host'), false);
    });

    test('matches contains pattern correctly', () => {
      assert.equal(matchesPattern('moodle.spit.ac.in', 'moodle', 'contains'), true);
      assert.equal(matchesPattern('portal.spit.ac.in', 'moodle', 'contains'), false);
    });
  });

  describe('3. Rule Priority Precedence & Fallbacks (classifyDomain)', () => {
    test('user rule overrides system rule', () => {
      const userRules = [
        {
          _id: 'custom_1',
          ruleName: 'Custom YouTube for Study',
          pattern: 'youtube.com',
          matchType: 'domain_suffix',
          category: 'learning', // User classifies YouTube as learning
          priority: 95,
          isEnabled: true
        }
      ];

      const res = classifyDomain('youtube.com', userRules, true);
      assert.equal(res.category, 'learning');
      assert.equal(res.ruleName, 'Custom YouTube for Study');
    });

    test('disabled user rule is skipped and falls back to system rule', () => {
      const userRules = [
        {
          _id: 'custom_1',
          ruleName: 'Disabled Rule',
          pattern: 'youtube.com',
          matchType: 'domain_suffix',
          category: 'learning',
          priority: 99,
          isEnabled: false // Disabled!
        }
      ];

      const res = classifyDomain('youtube.com', userRules, true);
      assert.equal(res.category, 'distracting'); // System default is distracting
    });

    test('higher priority user rule beats lower priority user rule', () => {
      const userRules = [
        {
          _id: 'r_low',
          ruleName: 'General Dev',
          pattern: 'github.com',
          matchType: 'domain_suffix',
          category: 'neutral',
          priority: 20,
          isEnabled: true
        },
        {
          _id: 'r_high',
          ruleName: 'Priority Learning',
          pattern: 'github.com',
          matchType: 'domain_suffix',
          category: 'learning',
          priority: 80,
          isEnabled: true
        }
      ];

      const res = classifyDomain('github.com', userRules, true);
      assert.equal(res.category, 'learning');
    });

    test('unrecognized domain falls back to uncategorized', () => {
      const res = classifyDomain('random-unknown-site-123.xyz', [], true);
      assert.equal(res.category, 'uncategorized');
    });
  });

  describe('4. Context Switch Counting (calculateContextSwitches)', () => {
    test('zero switches for empty or single event', () => {
      assert.equal(calculateContextSwitches([]), 0);
      assert.equal(calculateContextSwitches([{ category: 'learning' }]), 0);
    });

    test('zero switches for consecutive events in the same category', () => {
      const events = [
        { category: 'learning' },
        { category: 'learning' },
        { category: 'learning' }
      ];
      assert.equal(calculateContextSwitches(events), 0);
    });

    test('accurately counts transitions between differing categories', () => {
      const events = [
        { category: 'learning' },     // start
        { category: 'distracting' },  // switch 1
        { category: 'distracting' },  // same
        { category: 'productive' },   // switch 2
        { category: 'learning' }      // switch 3
      ];
      assert.equal(calculateContextSwitches(events), 3);
    });
  });

});
