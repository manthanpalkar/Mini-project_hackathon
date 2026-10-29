const { RideOffer, RideRequest, StudentSustainabilityOutcome } = require('../models/rideModel');
const { campusGraphInstance } = require('./campusGraphService');
const { createNotification } = require('./rideNotificationService');

const EMISSION_FACTOR_G_PER_KM = 120; // Urban commuter baseline

/**
 * UniVerse Module B: Ride Progression & Simulation Service
 * Handles authoritative ride lifecycle transitions (start, complete, in_transit simulation)
 * and idempotent durable sustainability outcome accounting.
 */
class RideProgressionService {
  constructor() {
    this.graph = campusGraphInstance;
  }

  /**
   * Driver starts ride.
   * State machine: open/full/scheduled -> in_transit
   */
  async startRide(rideId, driverEmail) {
    const ride = await RideOffer.findById(rideId);
    if (!ride) {
      throw { status: 404, message: 'Ride offer not found.' };
    }

    if (ride.driverEmail.toLowerCase() !== driverEmail.toLowerCase()) {
      throw { status: 403, message: 'Forbidden: Only the offering driver can start this ride.' };
    }

    if (ride.status === 'in_transit' || ride.status === 'in_progress') {
      // Idempotent: return existing in_transit ride
      return ride;
    }

    if (ride.status === 'completed' || ride.status === 'cancelled') {
      throw { status: 400, message: `Cannot start a ride in '${ride.status}' status.` };
    }

    const now = new Date();
    ride.status = 'in_transit';
    ride.startedAt = now;
    ride.simulation = {
      currentWaypointIndex: 0,
      progressFraction: 0,
      lastSimulatedAt: now,
      status: 'running'
    };

    await ride.save();

    // Notify all confirmed passengers
    if (ride.confirmedPassengers && ride.confirmedPassengers.length > 0) {
      for (const pass of ride.confirmedPassengers) {
        await createNotification({
          recipientEmail: pass.passengerEmail,
          actorEmail: ride.driverEmail,
          actorName: ride.driverName,
          eventType: 'RIDE_STARTED',
          rideOfferId: ride._id,
          requestId: pass.requestId,
          title: 'Ride Started',
          message: `${ride.driverName} has started the campus ride towards ${ride.destinationName}. Track live progress on the campus map.`,
          actionLink: '/campus-rides'
        }).catch(err => console.error('[NOTIFICATION_WARN] Failed to notify passenger of ride start:', err.message));
      }
    }

    return ride;
  }

  /**
   * Driver completes ride.
   * State machine: in_transit -> completed
   * Idempotent: persists exactly-once StudentSustainabilityOutcome records.
   */
  async completeRide(rideId, driverEmail) {
    const ride = await RideOffer.findById(rideId);
    if (!ride) {
      throw { status: 404, message: 'Ride offer not found.' };
    }

    if (ride.driverEmail.toLowerCase() !== driverEmail.toLowerCase()) {
      throw { status: 403, message: 'Forbidden: Only the offering driver can complete this ride.' };
    }

    if (ride.status === 'completed') {
      // Idempotent: return completed ride
      return ride;
    }

    if (ride.status !== 'in_transit' && ride.status !== 'in_progress') {
      throw { status: 400, message: `Cannot complete ride in '${ride.status}' status. Ride must be in_transit first.` };
    }

    const now = new Date();
    ride.status = 'completed';
    ride.completedAt = now;
    if (!ride.simulation) ride.simulation = {};
    ride.simulation.status = 'completed';
    ride.simulation.progressFraction = 1.0;
    ride.simulation.currentWaypointIndex = Math.max(0, (ride.currentRoute || []).length - 1);
    ride.simulation.lastSimulatedAt = now;

    await ride.save();

    // Durable Exactly-Once Sustainability Outcome Processing
    const routeDistance = ride.currentDistanceKm || ride.originalDistanceKm || 0;
    const passengerCount = (ride.confirmedPassengers || []).length;
    const totalAvoidedDistance = routeDistance * passengerCount;
    const totalCo2Saved = Math.round(totalAvoidedDistance * EMISSION_FACTOR_G_PER_KM);

    // 1. Driver outcome
    await StudentSustainabilityOutcome.findOneAndUpdate(
      { rideOfferId: ride._id, studentEmail: ride.driverEmail.toLowerCase() },
      {
        $setOnInsert: {
          rideOfferId: ride._id,
          studentEmail: ride.driverEmail.toLowerCase(),
          role: 'driver',
          completionTimestamp: now,
          routeDistanceKm: routeDistance,
          sharedDistanceKm: totalAvoidedDistance,
          estimatedCo2SavedGrams: totalCo2Saved,
          monetarySavedRupees: (ride.costPerSeat || 0) * passengerCount,
          calculationMethodology: 'UniVerse v1.0 Urban Commute Baseline (120g CO2/km)',
          source: 'driver_confirmed_simulated_trip'
        }
      },
      { upsert: true, new: true }
    );

    // 2. Passenger outcomes & notifications
    if (ride.confirmedPassengers && ride.confirmedPassengers.length > 0) {
      for (const pass of ride.confirmedPassengers) {
        const passSavedGrams = passengerCount > 0 ? Math.round(totalCo2Saved / passengerCount) : 0;
        await StudentSustainabilityOutcome.findOneAndUpdate(
          { rideOfferId: ride._id, studentEmail: pass.passengerEmail.toLowerCase() },
          {
            $setOnInsert: {
              rideOfferId: ride._id,
              studentEmail: pass.passengerEmail.toLowerCase(),
              role: 'passenger',
              completionTimestamp: now,
              routeDistanceKm: routeDistance,
              sharedDistanceKm: routeDistance,
              estimatedCo2SavedGrams: passSavedGrams,
              monetarySavedRupees: Math.max(0, 40 - (pass.fareTotal || 0)),
              calculationMethodology: 'UniVerse v1.0 Urban Commute Baseline (120g CO2/km)',
              source: 'driver_confirmed_simulated_trip'
            }
          },
          { upsert: true, new: true }
        );

        // Notify passenger of completion & rating eligibility
        await createNotification({
          recipientEmail: pass.passengerEmail,
          actorEmail: ride.driverEmail,
          actorName: ride.driverName,
          eventType: 'RIDE_COMPLETED',
          rideOfferId: ride._id,
          requestId: pass.requestId,
          title: 'Ride Completed',
          message: `Your campus ride to ${ride.destinationName} has been completed! Please rate your commute experience.`,
          actionLink: '/campus-rides'
        }).catch(() => {});
      }
    }

    return ride;
  }

  /**
   * Retrieves authoritative simulated progress for a ride.
   * If userEmail is a confirmed passenger, calculates ETA specific to their pickup node.
   */
  async getRideProgress(rideId, userEmail = '') {
    const ride = await RideOffer.findById(rideId).lean();
    if (!ride) {
      throw { status: 404, message: 'Ride offer not found.' };
    }

    const route = ride.currentRoute && ride.currentRoute.length > 0
      ? ride.currentRoute
      : ride.originalRoute || [];

    const totalDuration = ride.currentDurationMins || ride.originalDurationMins || 15;
    let fraction = 0;
    let currentIndex = 0;

    if (ride.status === 'completed') {
      fraction = 1.0;
      currentIndex = Math.max(0, route.length - 1);
    } else if (ride.status === 'in_transit' || ride.status === 'in_progress') {
      if (ride.startedAt) {
        const elapsedMinutes = (Date.now() - new Date(ride.startedAt).getTime()) / (60 * 1000);
        // Time-derived or explicit simulation fraction, bounded between 0 and 0.99 until completed
        fraction = Math.min(0.99, Math.max(0, elapsedMinutes / totalDuration));
      }
      if (ride.simulation && typeof ride.simulation.progressFraction === 'number' && ride.simulation.progressFraction > fraction) {
        fraction = Math.min(0.99, ride.simulation.progressFraction);
      }
      currentIndex = Math.min(route.length - 1, Math.floor(fraction * route.length));
    }

    // Check if user is a passenger and locate their pickup
    let passengerPickupEtaMins = null;
    let passengerPickupNodeId = null;

    if (userEmail && ride.confirmedPassengers) {
      const pass = ride.confirmedPassengers.find(p => p.passengerEmail.toLowerCase() === userEmail.toLowerCase());
      if (pass) {
        passengerPickupNodeId = pass.pickupNodeId;
        const pickupIndex = route.indexOf(pass.pickupNodeId);
        if (pickupIndex !== -1) {
          if (currentIndex >= pickupIndex) {
            passengerPickupEtaMins = 0; // Arrived at or passed pickup
          } else {
            // Fraction of remaining route to pickup
            const fractionToPickup = pickupIndex / route.length;
            const remainingFraction = Math.max(0, fractionToPickup - fraction);
            passengerPickupEtaMins = Math.max(1, Math.round(remainingFraction * totalDuration));
          }
        }
      }
    }

    const remainingMins = ride.status === 'completed'
      ? 0
      : Math.max(1, Math.round((1 - fraction) * totalDuration));

    return {
      rideId: ride._id,
      status: ride.status,
      route,
      currentWaypointIndex: currentIndex,
      currentWaypointNodeId: route[currentIndex] || null,
      progressFraction: parseFloat(fraction.toFixed(3)),
      totalDurationMins: totalDuration,
      remainingDurationMins: remainingMins,
      startedAt: ride.startedAt,
      completedAt: ride.completedAt,
      passengerPickupNodeId,
      passengerPickupEtaMins,
      isSimulated: true,
      simulationLabel: 'SIMULATED PROGRESS (Dijkstra Waypoint Route)'
    };
  }

  /**
   * Advance simulated waypoint progress monotonically (for demo control).
   */
  async advanceSimulatedProgress(rideId, driverEmail, stepIncrement = 0.25) {
    const ride = await RideOffer.findById(rideId);
    if (!ride) throw { status: 404, message: 'Ride offer not found.' };

    if (ride.driverEmail.toLowerCase() !== driverEmail.toLowerCase()) {
      throw { status: 403, message: 'Forbidden: Only the driver can advance simulation progress.' };
    }

    if (ride.status !== 'in_transit' && ride.status !== 'in_progress') {
      throw { status: 400, message: 'Ride must be in_transit to advance simulation.' };
    }

    const currentFrac = (ride.simulation && ride.simulation.progressFraction) || 0;
    const newFrac = Math.min(0.95, currentFrac + stepIncrement);
    const route = ride.currentRoute || [];
    const newIndex = Math.min(route.length - 1, Math.floor(newFrac * route.length));

    ride.simulation = {
      currentWaypointIndex: newIndex,
      progressFraction: newFrac,
      lastSimulatedAt: new Date(),
      status: 'running'
    };

    await ride.save();
    return this.getRideProgress(ride._id, driverEmail);
  }
}

let instance = null;
function getRideProgressionInstance() {
  if (!instance) instance = new RideProgressionService();
  return instance;
}

module.exports = {
  RideProgressionService,
  getRideProgressionInstance
};
