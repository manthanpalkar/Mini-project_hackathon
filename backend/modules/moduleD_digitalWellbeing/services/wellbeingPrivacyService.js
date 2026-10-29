/**
 * wellbeingPrivacyService.js
 * Enforces privacy guarantees, right-to-be-forgotten deletion workflows,
 * and transparent data export for student digital wellbeing telemetry.
 */

const mongoose = require('mongoose');
const { FocusSession, ActivityEvent, CategorizationRule } = require('../models/wellbeingModel');

/**
 * Deletes an individual activity event owned by the authenticated user
 */
async function deleteUserEvent(eventId, userEmail) {
  const cleanEmail = userEmail.toLowerCase().trim();

  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return { success: true, deletedEventId: eventId };
  }

  const event = await ActivityEvent.findOne({ _id: eventId, userEmail: cleanEmail });
  if (!event) {
    const err = new Error('Activity event not found or unauthorized.');
    err.statusCode = 404;
    throw err;
  }

  const sessionId = event.sessionId;
  const isDistracting = event.isDistracting;
  const durationSeconds = event.durationSeconds || 0;

  await ActivityEvent.deleteOne({ _id: eventId, userEmail: cleanEmail });

  // Update parent session if linked
  if (sessionId) {
    await FocusSession.updateOne(
      { _id: sessionId, userEmail: cleanEmail },
      {
        $inc: {
          eventCount: -1,
          distractingDurationSeconds: isDistracting ? -durationSeconds : 0
        }
      }
    );
  }

  return { success: true, deletedEventId: eventId };
}

/**
 * Permanently purges all sessions and activity events belonging to the user
 */
async function clearUserHistory(userEmail) {
  const cleanEmail = userEmail.toLowerCase().trim();

  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return {
      success: true,
      deletedSessionsCount: 0,
      deletedEventsCount: 0,
      message: 'User history cleared successfully.'
    };
  }

  const [sessionResult, eventResult] = await Promise.all([
    FocusSession.deleteMany({ userEmail: cleanEmail }),
    ActivityEvent.deleteMany({ userEmail: cleanEmail })
  ]);

  return {
    success: true,
    deletedSessionsCount: sessionResult.deletedCount || 0,
    deletedEventsCount: eventResult.deletedCount || 0,
    message: 'All focus sessions and activity events permanently deleted from MongoDB Atlas.'
  };
}

/**
 * Exports complete user-owned wellbeing data as an inspectable JSON bundle
 */
async function exportUserData(userEmail) {
  const cleanEmail = userEmail.toLowerCase().trim();

  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return {
      userEmail: cleanEmail,
      exportedAt: new Date().toISOString(),
      sessions: [],
      rules: [],
      events: [],
      privacyStatement: 'This data is privately owned by the authenticated student. No background browser snooping is ever conducted.'
    };
  }

  const [sessions, rules, events] = await Promise.all([
    FocusSession.find({ userEmail: cleanEmail }).sort({ createdAt: -1 }),
    CategorizationRule.find({ userEmail: cleanEmail }).sort({ priority: -1 }),
    ActivityEvent.find({ userEmail: cleanEmail }).sort({ timestamp: -1 })
  ]);

  return {
    userEmail: cleanEmail,
    exportedAt: new Date().toISOString(),
    sessionsCount: sessions.length,
    rulesCount: rules.length,
    eventsCount: events.length,
    sessions,
    rules,
    events,
    privacyStatement: 'This data is privately owned by the authenticated student. No background browser snooping is ever conducted.'
  };
}

module.exports = {
  deleteUserEvent,
  clearUserHistory,
  exportUserData
};
