const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { RideNotification, RideOffer } = require('../modules/moduleB_ridePooling/models/rideModel');
const {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  getAuthorizedDriverContact,
  normalizePhoneNumber
} = require('../modules/moduleB_ridePooling/services/rideNotificationService');

describe('Module B - In-App Notifications & Privacy-Aware Contact Access', () => {
  const notifStore = new Map();
  const ridesStore = new Map();

  before(() => {
    RideNotification.create = async (doc) => {
      const id = new mongoose.Types.ObjectId().toString();
      const n = { _id: id, id, ...doc, save: async function() { return this; } };
      notifStore.set(id, n);
      return n;
    };

    RideNotification.find = (query) => {
      const list = Array.from(notifStore.values()).filter(n => {
        if (query.recipientEmail && n.recipientEmail !== query.recipientEmail) return false;
        if (query.read !== undefined && n.read !== query.read) return false;
        return true;
      });
      return {
        sort: () => ({
          limit: () => ({
            lean: async () => list
          })
        })
      };
    };

    RideNotification.countDocuments = async (query) => {
      return Array.from(notifStore.values()).filter(n => {
        if (query.recipientEmail && n.recipientEmail !== query.recipientEmail) return false;
        if (query.read !== undefined && n.read !== query.read) return false;
        return true;
      }).length;
    };

    RideNotification.findById = async (id) => notifStore.get(String(id)) || null;

    RideOffer.findById = (id) => ({
      lean: async () => ridesStore.get(String(id)) || null
    });
  });

  test('Creates in-app notification with unread status', async () => {
    const notif = await createNotification({
      recipientEmail: 'student@spit.ac.in',
      actorEmail: 'driver@spit.ac.in',
      actorName: 'Driver Dave',
      eventType: 'REQUEST_ACCEPTED',
      title: 'Seat Confirmed',
      message: 'Your seat to SPIT Main Gate has been reserved.'
    });

    assert.strictEqual(notif.recipientEmail, 'student@spit.ac.in');
    assert.strictEqual(notif.read, false);
    assert.strictEqual(notif.eventType, 'REQUEST_ACCEPTED');

    const unread = await getUnreadCount('student@spit.ac.in');
    assert.ok(unread >= 1);
  });

  test('User can mark their own notification as read', async () => {
    const list = await getUserNotifications('student@spit.ac.in');
    const first = list[0];
    const updated = await markNotificationAsRead(first._id, 'student@spit.ac.in');
    assert.strictEqual(updated.read, true);
  });

  test('Cross-user notification read manipulation is blocked with 403 Forbidden', async () => {
    const list = await getUserNotifications('student@spit.ac.in');
    const first = list[0];
    await assert.rejects(
      async () => await markNotificationAsRead(first._id, 'intruder@spit.ac.in'),
      { status: 403 }
    );
  });

  test('Phone number normalization formats Indian standard numbers for WhatsApp', () => {
    assert.strictEqual(normalizePhoneNumber('9876543210'), '919876543210');
    assert.strictEqual(normalizePhoneNumber('+91 98765 43210'), '919876543210');
    assert.strictEqual(normalizePhoneNumber('09876543210'), '09876543210');
  });

  test('Driver contact is blocked for unconfirmed users or random browsers', async () => {
    const rideId = 'ride-contact-1';
    ridesStore.set(rideId, {
      _id: rideId,
      driverEmail: 'safe.driver@spit.ac.in',
      driverPhone: '9876543210',
      contactSharing: { enabled: true },
      confirmedPassengers: [{ passengerEmail: 'confirmed.passenger@spit.ac.in' }]
    });

    await assert.rejects(
      async () => await getAuthorizedDriverContact(rideId, 'curious.stranger@spit.ac.in'),
      { status: 403 }
    );
  });

  test('Confirmed passenger can access driver contact when sharing is enabled', async () => {
    const rideId = 'ride-contact-1';
    const contact = await getAuthorizedDriverContact(rideId, 'confirmed.passenger@spit.ac.in');
    assert.strictEqual(contact.sharingEnabled, true);
    assert.ok(contact.whatsappUrl.startsWith('https://wa.me/919876543210'));
    assert.strictEqual(contact.telUri, 'tel:+919876543210');
    assert.ok(contact.maskedDisplay.includes('•••••'));
  });

  test('If driver has disabled contact sharing, returns polite explanation without revealing number', async () => {
    const rideId = 'ride-contact-optout';
    ridesStore.set(rideId, {
      _id: rideId,
      driverEmail: 'private.driver@spit.ac.in',
      driverPhone: '9876543210',
      contactSharing: { enabled: false }, // Driver opted out
      confirmedPassengers: [{ passengerEmail: 'confirmed.passenger@spit.ac.in' }]
    });

    const contact = await getAuthorizedDriverContact(rideId, 'confirmed.passenger@spit.ac.in');
    assert.strictEqual(contact.sharingEnabled, false);
    assert.ok(contact.message.includes('in-app trip notifications'));
  });
});
