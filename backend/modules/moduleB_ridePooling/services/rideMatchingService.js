const { campusGraphInstance } = require('./campusGraphService');

/**
 * Emission factor: Average urban commuter trip (auto-rickshaw / small car) produces ~120 g CO2 / km
 * Standard Mumbai auto fare baseline: ₹23 base flagfall (first 1.5 km) + ₹15.33/km thereafter
 */
const EMISSION_FACTOR_G_PER_KM = 120;
const BASE_AUTO_FARE_RUPEES = 23;
const PER_KM_AUTO_FARE_RUPEES = 15.33;

class RideMatchingService {
  constructor(graph = campusGraphInstance) {
    this.graph = graph;
  }

  /**
   * Calculate direct auto fare baseline for distance
   */
  calculateIndividualCommuteCost(distanceKm) {
    if (distanceKm <= 0) return 0;
    if (distanceKm <= 1.5) return BASE_AUTO_FARE_RUPEES;
    return Math.round(BASE_AUTO_FARE_RUPEES + (distanceKm - 1.5) * PER_KM_AUTO_FARE_RUPEES);
  }

  /**
   * Finds the best route insertion for passenger pickup and dropoff along driver's route
   * @param {string[]} originalRoute - Ordered list of node IDs [D_orig, ..., D_dest]
   * @param {string} pickupNode - Passenger pickup node ID
   * @param {string} dropoffNode - Passenger dropoff node ID
   * @returns {Object|null} Best insertion with route, totalDistance, detourKm, and duration
   */
  findOptimalInsertion(originalRoute, pickupNode, dropoffNode) {
    if (!Array.isArray(originalRoute) || originalRoute.length < 2) {
      return null;
    }

    const baseRoute = this.graph.computeMultiStopRoute(originalRoute);
    if (!baseRoute) return null;
    const baseDistance = baseRoute.totalDistance;

    // Direct match: pickup and dropoff already appear in order on driver's existing route
    const pickupIdx = originalRoute.indexOf(pickupNode);
    const dropoffIdx = originalRoute.indexOf(dropoffNode);

    if (pickupIdx !== -1 && dropoffIdx !== -1 && pickupIdx <= dropoffIdx) {
      // 0 km detour! Perfect on-path match
      return {
        sharedRouteWaypoints: originalRoute,
        fullPath: baseRoute.path,
        totalDistance: baseRoute.totalDistance,
        totalDuration: baseRoute.totalDuration,
        detourKm: 0,
        detourRatio: 0,
        extraDurationMins: 0,
        isZeroDetourOnPath: true
      };
    }

    // Otherwise, explore feasible insertion positions
    // Driver starts at originalRoute[0] and ends at originalRoute[last]
    let bestCandidate = null;
    let minDetour = Infinity;

    const n = originalRoute.length;

    // i is index after which to insert pickup (from 0 to n-1)
    for (let i = 0; i < n; i++) {
      // j is index after which to insert dropoff (from i to n-1)
      for (let j = i; j < n; j++) {
        const candidateWaypoints = [];

        // Add prefix up to index i
        for (let k = 0; k <= i; k++) {
          candidateWaypoints.push(originalRoute[k]);
        }

        // Insert pickup if not already the same as previous
        if (candidateWaypoints[candidateWaypoints.length - 1] !== pickupNode) {
          candidateWaypoints.push(pickupNode);
        }

        // Add intermediate original points between i+1 and j
        for (let k = i + 1; k <= j; k++) {
          if (candidateWaypoints[candidateWaypoints.length - 1] !== originalRoute[k]) {
            candidateWaypoints.push(originalRoute[k]);
          }
        }

        // Insert dropoff if not already the same as previous
        if (candidateWaypoints[candidateWaypoints.length - 1] !== dropoffNode) {
          candidateWaypoints.push(dropoffNode);
        }

        // Add suffix after index j
        for (let k = j + 1; k < n; k++) {
          if (candidateWaypoints[candidateWaypoints.length - 1] !== originalRoute[k]) {
            candidateWaypoints.push(originalRoute[k]);
          }
        }

        const computed = this.graph.computeMultiStopRoute(candidateWaypoints);
        if (!computed) continue;

        const detour = Math.max(0, Math.round((computed.totalDistance - baseDistance) * 100) / 100);
        if (detour < minDetour) {
          minDetour = detour;
          const extraTime = Math.max(0, computed.totalDuration - baseRoute.totalDuration);
          const detourRatio = baseDistance > 0 ? Math.round((detour / baseDistance) * 1000) / 1000 : 0;

          bestCandidate = {
            sharedRouteWaypoints: candidateWaypoints,
            fullPath: computed.path,
            totalDistance: computed.totalDistance,
            totalDuration: computed.totalDuration,
            detourKm: detour,
            detourRatio,
            extraDurationMins: extraTime,
            isZeroDetourOnPath: detour === 0
          };
        }
      }
    }

    return bestCandidate;
  }

  /**
   * Match and rank ride offers against passenger request
   * @param {Object} passengerRequest
   * @param {string} passengerRequest.passengerEmail
   * @param {string} passengerRequest.pickupNodeId
   * @param {string} passengerRequest.dropoffNodeId
   * @param {Date|string} passengerRequest.desiredDepartureTime
   * @param {number} passengerRequest.seatsRequested (default 1)
   * @param {number} passengerRequest.maxDetourKm (default 2.5)
   * @param {number} passengerRequest.departureWindowMins (default 30)
   * @param {Array} candidateRides - List of active RideOffer documents
   * @returns {Object} { matches: [...ranked], rejected: [...] }
   */
  matchRides(passengerRequest, candidateRides = []) {
    const {
      passengerEmail = '',
      pickupNodeId,
      dropoffNodeId,
      desiredDepartureTime,
      seatsRequested = 1,
      maxDetourKm = 2.5,
      departureWindowMins = 30
    } = passengerRequest;

    const matches = [];
    const rejected = [];

    // Pre-check graph nodes
    if (!this.graph.isValidNode(pickupNodeId) || !this.graph.isValidNode(dropoffNodeId)) {
      return {
        matches: [],
        rejected: [{ reason: 'Invalid or unrecognized pickup/dropoff campus node ID.' }],
        error: 'Invalid origin or destination node.'
      };
    }

    if (pickupNodeId === dropoffNodeId) {
      return {
        matches: [],
        rejected: [{ reason: 'Pickup and dropoff nodes cannot be identical.' }],
        error: 'Origin and destination must be distinct.'
      };
    }

    const passengerDirectRoute = this.graph.findShortestPath(pickupNodeId, dropoffNodeId, 'distance');
    if (!passengerDirectRoute) {
      return {
        matches: [],
        rejected: [{ reason: 'No navigable path exists between selected pickup and dropoff nodes.' }],
        error: 'Unreachable route.'
      };
    }

    const passDirectDistance = passengerDirectRoute.totalDistance;
    const passDirectDuration = passengerDirectRoute.totalDuration;
    const individualFare = this.calculateIndividualCommuteCost(passDirectDistance);

    const passengerReqTime = new Date(desiredDepartureTime).getTime();

    for (const ride of candidateRides) {
      const rideData = typeof ride.toObject === 'function' ? ride.toObject() : ride;
      const rideId = rideData._id || rideData.id;

      // Stage 1: Hard Eligibility Constraints
      if (rideData.status !== 'open' && rideData.status !== 'scheduled') {
        rejected.push({ rideId, reason: `Ride status is '${rideData.status}'; must be 'open'.` });
        continue;
      }

      const availableSeats = rideData.availableSeats !== undefined ? rideData.availableSeats : (rideData.totalSeats - (rideData.confirmedPassengerCount || 0));
      if (availableSeats < seatsRequested) {
        rejected.push({
          rideId,
          reason: `Insufficient capacity: requested ${seatsRequested} seat(s), only ${availableSeats} available.`
        });
        continue;
      }

      if (passengerEmail && rideData.driverEmail && passengerEmail.toLowerCase() === rideData.driverEmail.toLowerCase()) {
        rejected.push({ rideId, reason: 'Driver cannot be a passenger on their own ride.' });
        continue;
      }

      const rideDepTime = new Date(rideData.departureTime).getTime();
      const timeDiffMinutes = Math.abs(rideDepTime - passengerReqTime) / (60 * 1000);

      if (timeDiffMinutes > departureWindowMins) {
        rejected.push({
          rideId,
          reason: `Departure time difference (${Math.round(timeDiffMinutes)} mins) exceeds allowed window (±${departureWindowMins} mins).`
        });
        continue;
      }

      // Stage 2: Route Compatibility & Insertion
      const driverWaypoints = rideData.currentRoute && rideData.currentRoute.length >= 2 
        ? rideData.currentRoute 
        : [rideData.originNodeId, rideData.destinationNodeId];

      const insertion = this.findOptimalInsertion(driverWaypoints, pickupNodeId, dropoffNodeId);
      if (!insertion) {
        rejected.push({ rideId, reason: 'Unable to construct a contiguous route accommodating pickup and dropoff.' });
        continue;
      }

      const allowedDetourKm = Math.min(maxDetourKm, rideData.maxDetourKm || 2.5);
      if (insertion.detourKm > allowedDetourKm) {
        rejected.push({
          rideId,
          reason: `Detour (${insertion.detourKm} km) exceeds maximum allowable detour threshold (${allowedDetourKm} km).`
        });
        continue;
      }

      // Stage 3: Sustainability, Cost & Scoring
      // Avoided single-occupant trip distance minus the driver's extra detour
      const netDistanceSavedKm = Math.max(0, Math.round((passDirectDistance - insertion.detourKm) * 100) / 100);
      const estimatedCo2SavedGrams = Math.round(netDistanceSavedKm * EMISSION_FACTOR_G_PER_KM);
      
      const costPerSeat = rideData.costPerSeat || 0;
      const totalCostForSeats = costPerSeat * seatsRequested;
      const monetarySavings = Math.max(0, individualFare * seatsRequested - totalCostForSeats);

      // Deterministic explainable scoring formula:
      // Weight 35: Detour efficiency (0 km detour = 35 pts)
      const detourScore = 35 * (1 - Math.min(1, insertion.detourKm / allowedDetourKm));
      // Weight 30: Schedule alignment (0 min difference = 30 pts)
      const scheduleScore = 30 * (1 - Math.min(1, timeDiffMinutes / departureWindowMins));
      // Weight 20: Cost factor (free carpool / low fare = up to 20 pts)
      const costScore = 20 * (1 - Math.min(1, costPerSeat / 100));
      // Weight 15: Seat safety margin (more available seats = up to 15 pts)
      const seatScore = 15 * Math.min(1, availableSeats / 4);

      const matchScore = Math.round((detourScore + scheduleScore + costScore + seatScore) * 10) / 10;

      // Human-readable explanation generator
      let explanation = '';
      if (insertion.isZeroDetourOnPath) {
        explanation = `Direct match on driver's active path (0 km detour). Departs within ${Math.round(timeDiffMinutes)} mins of requested time. Saves ${estimatedCo2SavedGrams}g of CO₂.`;
      } else {
        explanation = `Feasible pickup: Adds ${insertion.detourKm} km (${insertion.extraDurationMins} min) detour. ${availableSeats} seat(s) open. Departs in ${Math.round(timeDiffMinutes)} mins difference.`;
      }

      matches.push({
        ride: rideData,
        rideId,
        matchScore,
        detourKm: insertion.detourKm,
        detourRatio: insertion.detourRatio,
        extraDurationMins: insertion.extraDurationMins,
        timeDiffMinutes: Math.round(timeDiffMinutes),
        sharedRouteWaypoints: insertion.sharedRouteWaypoints,
        sharedPath: insertion.fullPath,
        availableSeats,
        seatsRequested,
        costPerSeat,
        totalCost: totalCostForSeats,
        individualEstimatedFare: individualFare * seatsRequested,
        estimatedMonetarySavings: monetarySavings,
        netDistanceSavedKm,
        estimatedCo2SavedGrams,
        passengerDirectDistanceKm: passDirectDistance,
        passengerDirectDurationMins: passDirectDuration,
        explanation
      });
    }

    // Sort descending by matchScore
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return {
      passengerRoute: {
        pickupNodeId,
        dropoffNodeId,
        directDistanceKm: passDirectDistance,
        directDurationMins: passDirectDuration,
        individualFare
      },
      matchesCount: matches.length,
      matches,
      rejectedCount: rejected.length,
      rejected
    };
  }
}

const rideMatchingInstance = new RideMatchingService();

module.exports = {
  RideMatchingService,
  rideMatchingInstance,
  EMISSION_FACTOR_G_PER_KM
};
