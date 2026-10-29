const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { RideOffer, RideRating, RideNotification } = require('../modules/moduleB_ridePooling/models/rideModel');
const { getRideRatingInstance } = require('../modules/moduleB_ridePooling/services/rideRatingService');

describe('Module B - Post-Ride Peer Ratings & Safety Feedback', () => {
  let ratingService;
  const ridesStore = new Map();
  const ratingsStore = new Map();

  before(() => {
    ratingService = getRideRatingInstance();
    RideNotification.create = async (doc) => ({ _id: new mongoose.Types.ObjectId().toString(), ...doc });

    // Mock RideOffer
    RideOffer.findById = async (id) => {
      const r = ridesStore.get(String(id));
      if (!r) return null;
      return {
        ...r,
        save: async function() {
          ridesStore.set(String(id), this);
          return this;
        }
      };
    };

    RideOffer.updateMany = async () => ({ modifiedCount: 1 });

    // Mock RideRating
    RideRating.create = async (doc) => {
      const id = new mongoose.Types.ObjectId().toString();
      const r = { _id: id, ...doc };
      ratingsStore.set(`${doc.rideOfferId}_${doc.raterEmail}_${doc.ratedUserEmail}`, r);
      return r;
    };

    RideRating.findOne = async (query) => {
      const key = `${query.rideOfferId}_${query.raterEmail}_${query.ratedUserEmail}`;
      return ratingsStore.get(key) || null;
    };

    RideRating.find = (query) => {
      const list = Array.from(ratingsStore.values()).filter(r => {
        if (query.ratedUserEmail && r.ratedUserEmail !== query.ratedUserEmail) return false;
        if (query.role && r.role !== query.role) return false;
        return true;
      });
      return { lean: async () => list };
    };
  });

  test('Unrated driver returns friendly fallback badge (no zero-star penalty)', async () => {
    const summary = await ratingService.getDriverRatingSummary('newdriver@spit.ac.in');
    assert.strictEqual(summary.hasRatings, false);
    assert.strictEqual(summary.averageRating, null);
    assert.strictEqual(summary.displayBadge, 'New driver · No ratings yet');
  });

  test('Confirmed passenger can submit 5-star rating for completed ride', async () => {
    const rideId = 'ride-rating-1';
    ridesStore.set(rideId, {
      _id: rideId,
      driverEmail: 'prof.smith@spit.ac.in',
      status: 'completed',
      confirmedPassengers: [
        { passengerEmail: 'student.bob@spit.ac.in', passengerName: 'Bob' }
      ]
    });

    const rating = await ratingService.submitRating({
      rideOfferId: rideId,
      raterEmail: 'student.bob@spit.ac.in',
      raterName: 'Bob',
      ratedUserEmail: 'prof.smith@spit.ac.in',
      rating: 5,
      categories: ['punctuality', 'driving_safety'],
      comment: 'Excellent, smooth commute to college.'
    });

    assert.strictEqual(rating.rating, 5);
    assert.strictEqual(rating.role, 'passenger_to_driver');
    assert.strictEqual(rating.isSafetyConcern, false);
  });

  test('Self-rating is strictly prohibited', async () => {
    const rideId = 'ride-rating-1';
    await assert.rejects(
      async () => await ratingService.submitRating({
        rideOfferId: rideId,
        raterEmail: 'prof.smith@spit.ac.in',
        ratedUserEmail: 'prof.smith@spit.ac.in',
        rating: 5
      }),
      { status: 400 }
    );
  });

  test('Non-participant cannot rate a ride', async () => {
    const rideId = 'ride-rating-1';
    await assert.rejects(
      async () => await ratingService.submitRating({
        rideOfferId: rideId,
        raterEmail: 'outsider@spit.ac.in',
        ratedUserEmail: 'prof.smith@spit.ac.in',
        rating: 4
      }),
      { status: 403 }
    );
  });

  test('Duplicate ratings on the same completed ride are rejected with 409 Conflict', async () => {
    const rideId = 'ride-rating-1';
    await assert.rejects(
      async () => await ratingService.submitRating({
        rideOfferId: rideId,
        raterEmail: 'student.bob@spit.ac.in',
        ratedUserEmail: 'prof.smith@spit.ac.in',
        rating: 4
      }),
      { status: 409 }
    );
  });

  test('Ratings for in-progress or open rides are rejected', async () => {
    const rideId = 'ride-rating-uncompleted';
    ridesStore.set(rideId, {
      _id: rideId,
      driverEmail: 'prof.smith@spit.ac.in',
      status: 'in_transit',
      confirmedPassengers: [{ passengerEmail: 'student.bob@spit.ac.in' }]
    });

    await assert.rejects(
      async () => await ratingService.submitRating({
        rideOfferId: rideId,
        raterEmail: 'student.bob@spit.ac.in',
        ratedUserEmail: 'prof.smith@spit.ac.in',
        rating: 5
      }),
      { status: 400 }
    );
  });

  test('Driver average rating and categories are aggregated accurately', async () => {
    const summary = await ratingService.getDriverRatingSummary('prof.smith@spit.ac.in');
    assert.strictEqual(summary.hasRatings, true);
    assert.strictEqual(summary.averageRating, 5);
    assert.strictEqual(summary.ratingsCount, 1);
    assert.strictEqual(summary.displayBadge, '5 ★ · 1 rating');
    assert.strictEqual(summary.categoryTallies.punctuality, 1);
  });

  test('Safety concerns are recorded with private status without automatic penalty', async () => {
    const rideId = 'ride-rating-safety';
    ridesStore.set(rideId, {
      _id: rideId,
      driverEmail: 'reckless@spit.ac.in',
      status: 'completed',
      confirmedPassengers: [{ passengerEmail: 'student.charlie@spit.ac.in' }]
    });

    const report = await ratingService.submitRating({
      rideOfferId: rideId,
      raterEmail: 'student.charlie@spit.ac.in',
      ratedUserEmail: 'reckless@spit.ac.in',
      rating: 2,
      isSafetyConcern: true,
      safetyCategory: 'reckless_driving',
      safetyDetails: 'Driver ran a red light near Cooper Hospital.'
    });

    assert.strictEqual(report.isSafetyConcern, true);
    assert.strictEqual(report.safetyCategory, 'reckless_driving');
    assert.strictEqual(report.safetyStatus, 'reported');
  });
});
