const { RideNotification, RideOffer } = require('../models/rideModel');

/**
 * UniVerse Module B: In-App Notifications & Privacy-Aware Driver Contact Service
 */

/**
 * Creates an in-app notification record.
 */
async function createNotification({
  recipientEmail,
  actorEmail = '',
  actorName = '',
  eventType,
  rideOfferId = null,
  requestId = null,
  title,
  message,
  actionLink = '/campus-rides'
}) {
  if (!recipientEmail || !eventType || !title || !message) {
    throw new Error('Missing required notification parameters.');
  }

  const notification = await RideNotification.create({
    recipientEmail: recipientEmail.toLowerCase().trim(),
    actorEmail: actorEmail ? actorEmail.toLowerCase().trim() : '',
    actorName,
    eventType,
    rideOfferId,
    requestId,
    title,
    message,
    read: false,
    actionLink
  });

  return notification;
}

/**
 * Retrieves notifications for an authenticated user.
 */
async function getUserNotifications(userEmail, limit = 20, unreadOnly = false) {
  const query = { recipientEmail: userEmail.toLowerCase().trim() };
  if (unreadOnly) {
    query.read = false;
  }

  return await RideNotification.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(50, Math.max(1, limit)))
    .lean();
}

/**
 * Counts unread notifications for a user.
 */
async function getUnreadCount(userEmail) {
  return await RideNotification.countDocuments({
    recipientEmail: userEmail.toLowerCase().trim(),
    read: false
  });
}

/**
 * Marks a notification as read (with recipient authorization check).
 */
async function markNotificationAsRead(notificationId, userEmail) {
  const notification = await RideNotification.findById(notificationId);
  if (!notification) {
    throw { status: 404, message: 'Notification not found.' };
  }

  if (notification.recipientEmail.toLowerCase() !== userEmail.toLowerCase()) {
    throw { status: 403, message: 'Forbidden: You cannot mark another user\'s notification as read.' };
  }

  notification.read = true;
  notification.readAt = new Date();
  await notification.save();
  return notification;
}

/**
 * Marks all notifications for a user as read.
 */
async function markAllNotificationsAsRead(userEmail) {
  const res = await RideNotification.updateMany(
    { recipientEmail: userEmail.toLowerCase().trim(), read: false },
    { $set: { read: true, readAt: new Date() } }
  );
  return { updatedCount: res.modifiedCount || 0 };
}

/**
 * Normalizes phone numbers to standard E.164 (without plus sign for WhatsApp).
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`; // India standard country code
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits;
}

/**
 * Authoritatively retrieves driver contact actions strictly for confirmed ride participants.
 * Privacy Protection:
 * 1. Checks that requester is a confirmed passenger on the ride or the driver.
 * 2. Checks that driver has contact sharing enabled.
 * 3. Never publishes phone numbers in public ride search listings.
 */
async function getAuthorizedDriverContact(rideId, requesterEmail) {
  const ride = await RideOffer.findById(rideId).lean();
  if (!ride) {
    throw { status: 404, message: 'Ride offer not found.' };
  }

  const cleanReqEmail = requesterEmail.toLowerCase().trim();
  const isDriver = ride.driverEmail.toLowerCase() === cleanReqEmail;
  const isConfirmedPassenger = (ride.confirmedPassengers || []).some(
    p => p.passengerEmail.toLowerCase() === cleanReqEmail
  );

  if (!isDriver && !isConfirmedPassenger) {
    throw {
      status: 403,
      message: 'Access restricted: Driver contact is strictly available to confirmed ride participants.'
    };
  }

  const sharing = ride.contactSharing || {};
  const phone = sharing.phone || ride.driverPhone || '';

  if (!sharing.enabled && !isDriver) {
    return {
      sharingEnabled: false,
      message: 'The driver has opted for in-app trip notifications and has not enabled direct contact sharing.'
    };
  }

  if (!phone) {
    return {
      sharingEnabled: false,
      message: 'No contact number was registered for this driver.'
    };
  }

  const normalizedDigits = normalizePhoneNumber(phone);
  const safeMessage = encodeURIComponent(`Hi ${ride.driverName}, I am confirmed on your UniVerse campus ride from ${ride.originName} to ${ride.destinationName}.`);

  return {
    sharingEnabled: true,
    driverName: ride.driverName,
    driverEmail: ride.driverEmail,
    allowWhatsApp: sharing.allowWhatsApp !== false,
    allowCall: sharing.allowCall !== false,
    whatsappUrl: sharing.allowWhatsApp !== false ? `https://wa.me/${normalizedDigits}?text=${safeMessage}` : null,
    telUri: sharing.allowCall !== false ? `tel:+${normalizedDigits}` : null,
    maskedDisplay: `+91 ••••• ••${normalizedDigits.slice(-4)}`
  };
}

module.exports = {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  normalizePhoneNumber,
  getAuthorizedDriverContact
};
