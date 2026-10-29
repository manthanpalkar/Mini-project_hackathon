const { RideRating, RideOffer } = require('../models/rideModel');
const { createNotification } = require('./rideNotificationService');

/**
 * UniVerse Module B: Post-Ride Ratings, Safety Feedback & Driver Trust Service
 */
class RideRatingService {
  /**
   * Submits a rating and optional safety feedback for a completed ride.
   */
  async submitRating({
    rideOfferId,
    raterEmail,
    raterName = '',
    ratedUserEmail,
    rating,
    categories = [],
    comment = '',
    isSafetyConcern = false,
    safetyCategory = '',
    safetyDetails = ''
  }) {
    if (!rideOfferId || !raterEmail || !ratedUserEmail) {
      throw { status: 400, message: 'Missing required rating parameters.' };
    }

    const cleanRater = raterEmail.toLowerCase().trim();
    const cleanRated = ratedUserEmail.toLowerCase().trim();

    if (cleanRater === cleanRated) {
      throw { status: 400, message: 'Self-rating is strictly prohibited.' };
    }

    const numRating = parseInt(rating, 10);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      throw { status: 400, message: 'Rating must be an integer between 1 and 5 stars.' };
    }

    const ride = await RideOffer.findById(rideOfferId);
    if (!ride) {
      throw { status: 404, message: 'Ride offer not found.' };
    }

    if (ride.status !== 'completed') {
      throw { status: 400, message: 'Feedback can only be submitted after a ride is marked completed.' };
    }

    // Eligibility check: both rater and rated must be verified participants
    const isRaterDriver = ride.driverEmail.toLowerCase() === cleanRater;
    const isRaterPassenger = (ride.confirmedPassengers || []).some(
      p => p.passengerEmail.toLowerCase() === cleanRater
    );

    if (!isRaterDriver && !isRaterPassenger) {
      throw {
        status: 403,
        message: 'Forbidden: Only confirmed participants on this completed ride are eligible to submit feedback.'
      };
    }

    const isRatedDriver = ride.driverEmail.toLowerCase() === cleanRated;
    const isRatedPassenger = (ride.confirmedPassengers || []).some(
      p => p.passengerEmail.toLowerCase() === cleanRated
    );

    if (!isRatedDriver && !isRatedPassenger) {
      throw {
        status: 400,
        message: 'The specified recipient was not a confirmed participant on this ride.'
      };
    }

    // Determine direction
    const role = isRaterPassenger ? 'passenger_to_driver' : 'driver_to_passenger';

    // Check duplicate rating submission
    const existing = await RideRating.findOne({
      rideOfferId: ride._id,
      raterEmail: cleanRater,
      ratedUserEmail: cleanRated
    });

    if (existing) {
      throw { status: 409, message: 'You have already submitted a rating for this participant on this ride.' };
    }

    // Sanitize comment
    const sanitizedComment = String(comment || '').slice(0, 300).trim();
    const sanitizedSafetyDetails = String(safetyDetails || '').slice(0, 1000).trim();

    const newRating = await RideRating.create({
      rideOfferId: ride._id,
      raterEmail: cleanRater,
      raterName,
      ratedUserEmail: cleanRated,
      role,
      rating: numRating,
      categories: Array.isArray(categories) ? categories : [],
      comment: sanitizedComment,
      isSafetyConcern: Boolean(isSafetyConcern),
      safetyCategory: isSafetyConcern ? safetyCategory : '',
      safetyDetails: isSafetyConcern ? sanitizedSafetyDetails : '',
      safetyStatus: isSafetyConcern ? 'reported' : 'none'
    });

    // Update driver ratings summary if rating was for driver
    if (isRatedDriver) {
      await this.recalculateDriverRating(cleanRated);
    }

    // Notify recipient of positive review
    await createNotification({
      recipientEmail: cleanRated,
      actorEmail: cleanRater,
      actorName: raterName || 'Campus Commuter',
      eventType: 'RATING_INVITATION',
      rideOfferId: ride._id,
      title: 'Feedback Received',
      message: `${raterName || 'A commuter'} left a ${numRating}-star rating for your recent campus ride.`,
      actionLink: '/campus-rides'
    }).catch(() => {});

    return newRating;
  }

  /**
   * Recalculates driver average rating and rating count.
   */
  async recalculateDriverRating(driverEmail) {
    const cleanEmail = driverEmail.toLowerCase().trim();
    const ratings = await RideRating.find({
      ratedUserEmail: cleanEmail,
      role: 'passenger_to_driver'
    }).lean();

    const count = ratings.length;
    let avg = 0;
    if (count > 0) {
      const sum = ratings.reduce((acc, r) => acc + (r.rating || 0), 0);
      avg = parseFloat((sum / count).toFixed(2));
    }

    // Update on all open/scheduled/mine RideOffers for this driver
    await RideOffer.updateMany(
      { driverEmail: cleanEmail },
      { $set: { 'ratingsSummary.averageRating': avg, 'ratingsSummary.ratingsCount': count } }
    );

    return { averageRating: avg, ratingsCount: count };
  }

  /**
   * Retrieves public rating summary for a driver (prevents zero-star false impression).
   */
  async getDriverRatingSummary(driverEmail) {
    const cleanEmail = driverEmail.toLowerCase().trim();
    const ratings = await RideRating.find({
      ratedUserEmail: cleanEmail,
      role: 'passenger_to_driver'
    }).lean();

    if (ratings.length === 0) {
      return {
        driverEmail: cleanEmail,
        hasRatings: false,
        averageRating: null,
        ratingsCount: 0,
        displayBadge: 'New driver · No ratings yet',
        categoriesCount: {}
      };
    }

    const count = ratings.length;
    const sum = ratings.reduce((acc, r) => acc + (r.rating || 0), 0);
    const avg = parseFloat((sum / count).toFixed(1));

    // Category tallies
    const categoryTallies = {};
    ratings.forEach(r => {
      (r.categories || []).forEach(cat => {
        categoryTallies[cat] = (categoryTallies[cat] || 0) + 1;
      });
    });

    return {
      driverEmail: cleanEmail,
      hasRatings: true,
      averageRating: avg,
      ratingsCount: count,
      displayBadge: `${avg} ★ · ${count} ${count === 1 ? 'rating' : 'ratings'}`,
      categoryTallies
    };
  }
}

let ratingInstance = null;
function getRideRatingInstance() {
  if (!ratingInstance) ratingInstance = new RideRatingService();
  return ratingInstance;
}

module.exports = {
  RideRatingService,
  getRideRatingInstance
};
