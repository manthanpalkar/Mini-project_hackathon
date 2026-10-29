/**
 * wellbeingSyntheticService.js
 * Deterministic synthetic demo activity generator.
 * Produces reproducible browsing-like events for demonstration purposes,
 * explicitly labeled as 'synthetic_demo' with zero surveillance.
 */

const mongoose = require('mongoose');
const { ActivityEvent, FocusSession, CategorizationRule } = require('../models/wellbeingModel');
const { classifyDomain } = require('./wellbeingClassificationService');

/**
 * 32-bit deterministic Mulberry32 PRNG
 */
function createPrng(seed = 42) {
  let s = Math.abs(typeof seed === 'string' ? hashStringTo32Bit(seed) : (seed || 42));
  return function() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashStringTo32Bit(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

const DOMAIN_POOLS = {
  learning: [
    { domain: 'spit.ac.in', label: 'SPIT Student Portal & Noticeboard' },
    { domain: 'moodle.spit.ac.in', label: 'Course LMS & Assignment Submission' },
    { domain: 'github.com', label: 'UniVerse Project Repository' },
    { domain: 'stackoverflow.com', label: 'MongoDB Schema Debugging' },
    { domain: 'leetcode.com', label: 'Algorithm Practice & Graph Traversal' },
    { domain: 'developer.mozilla.org', label: 'MDN Web APIs & Service Workers' },
    { domain: 'docs.python.org', label: 'Official Standard Library Reference' }
  ],
  productive: [
    { domain: 'notion.so', label: 'Semester Exam Study Roadmap' },
    { domain: 'docs.google.com', label: 'Mini-Project Technical Report' },
    { domain: 'overleaf.com', label: 'Research Paper LaTeX Draft' },
    { domain: 'figma.com', label: 'UI Wireframe & Design System' }
  ],
  distracting: [
    { domain: 'youtube.com', label: 'Entertainment Video Stream' },
    { domain: 'instagram.com', label: 'Social Media Feed' },
    { domain: 'reddit.com', label: 'Online Discussion Forum' },
    { domain: 'twitter.com', label: 'Microblogging Timeline' },
    { domain: 'netflix.com', label: 'Video Streaming Media' }
  ],
  neutral: [
    { domain: 'google.com', label: 'Web Query Search' },
    { domain: 'wikipedia.org', label: 'Computer Science History Encyclopedia' }
  ]
};

/**
 * Generates synthetic activity events for a user and session
 *
 * @param {object} params
 * @param {string} params.userEmail
 * @param {string} params.sessionId
 * @param {string} params.scenario 'focused_study' | 'mixed_study' | 'frequent_switching' | 'minimal_activity'
 * @param {number} params.eventCount Number of events to generate (1 - 50)
 * @param {number|string} params.seed Optional seed for deterministic reproducibility
 */
async function generateSyntheticScenario({
  userEmail,
  sessionId = null,
  scenario = 'focused_study',
  eventCount = 8,
  seed = 42
}) {
  const cleanEmail = userEmail.toLowerCase().trim();
  const count = Math.min(50, Math.max(1, parseInt(eventCount, 10) || 8));
  const prng = createPrng(seed);

  // Fetch user rules if available
  let userRules = [];
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    userRules = await CategorizationRule.find({ userEmail: cleanEmail, isEnabled: true }).sort({ priority: -1 });
  }

  // Determine category probability sequence based on scenario
  const sequence = [];
  let previousCategory = null;

  for (let i = 0; i < count; i++) {
    let poolKey;
    const r = prng();

    switch (scenario) {
      case 'focused_study':
        // 75% learning, 20% productive, 5% neutral (very high focus)
        poolKey = r < 0.75 ? 'learning' : (r < 0.95 ? 'productive' : 'neutral');
        break;

      case 'mixed_study':
        // Alternating 50% study (learning/productive), 45% distracting, 5% neutral
        if (i % 2 === 0) {
          poolKey = r < 0.7 ? 'learning' : 'productive';
        } else {
          poolKey = r < 0.85 ? 'distracting' : 'neutral';
        }
        break;

      case 'frequent_switching':
        // Rapid cycling to intentionally trigger context switches
        const keys = ['learning', 'distracting', 'productive', 'neutral'];
        const choices = keys.filter(k => k !== previousCategory);
        poolKey = choices[Math.floor(prng() * choices.length)];
        break;

      case 'minimal_activity':
        // 1 or 2 deep, sustained learning events
        poolKey = r < 0.85 ? 'learning' : 'productive';
        break;

      default:
        poolKey = 'learning';
    }

    previousCategory = poolKey;
    const candidates = DOMAIN_POOLS[poolKey] || DOMAIN_POOLS.learning;
    const item = candidates[Math.floor(prng() * candidates.length)];

    // Classify using user rules + system rules
    const classification = classifyDomain(item.domain, userRules, true);

    // Event duration in seconds (between 45s and 360s)
    let durationSeconds = Math.floor(60 + prng() * 240);
    if (scenario === 'minimal_activity') {
      durationSeconds = Math.floor(300 + prng() * 600); // 5-15 mins per event
    }

    sequence.push({
      userEmail: cleanEmail,
      sessionId: sessionId ? (mongoose.Types.ObjectId.isValid(sessionId) ? new mongoose.Types.ObjectId(sessionId) : null) : null,
      timestamp: new Date(Date.now() - (count - i) * durationSeconds * 1000),
      domain: item.domain,
      category: classification.category,
      durationSeconds,
      ruleId: classification.ruleId ? new mongoose.Types.ObjectId(classification.ruleId) : null,
      source: 'synthetic_demo',
      label: item.label,
      isDistracting: classification.category === 'distracting'
    });
  }

  // Calculate context switches across the sequence
  let contextSwitchCount = 0;
  let totalDistractingSeconds = 0;

  for (let i = 0; i < sequence.length; i++) {
    if (sequence[i].category === 'distracting') {
      totalDistractingSeconds += sequence[i].durationSeconds;
    }
    if (i > 0 && sequence[i].category !== sequence[i - 1].category) {
      contextSwitchCount++;
    }
  }

  let createdEvents = [];
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    createdEvents = await ActivityEvent.insertMany(sequence);

    // If an associated session ID was passed, update its telemetry stats
    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
      await FocusSession.updateOne(
        { _id: sessionId, userEmail: cleanEmail },
        {
          $inc: {
            eventCount: createdEvents.length,
            contextSwitchCount: contextSwitchCount,
            distractingDurationSeconds: totalDistractingSeconds
          },
          $set: { isSimulated: true }
        }
      );
    }
  } else {
    createdEvents = sequence.map((ev, idx) => ({
      _id: new mongoose.Types.ObjectId(),
      ...ev
    }));
  }

  return {
    success: true,
    scenario,
    seed,
    eventCount: createdEvents.length,
    contextSwitchCount,
    totalDistractingSeconds,
    totalDurationSeconds: sequence.reduce((acc, e) => acc + e.durationSeconds, 0),
    events: createdEvents,
    disclaimer: 'SIMULATED DEMO DATA · Synthetic activity generated for demonstration; zero real browser monitoring.'
  };
}

module.exports = {
  DOMAIN_POOLS,
  createPrng,
  generateSyntheticScenario
};
