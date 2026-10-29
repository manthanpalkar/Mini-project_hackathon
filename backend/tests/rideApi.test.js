const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app, JWT_SECRET, userAuthCache } = require('../server');
const { RideOffer, RideRequest } = require('../modules/moduleB_ridePooling/models/rideModel');

describe('Module B - Ride-Pooling API Integration & Authorization Test Suite', () => {
  let server;
  let baseUrl;
  let originalReadyState;

  const driverEmail = 'driver.test@spit.ac.in';
  const passengerEmail = 'passenger.test@spit.ac.in';
  const otherUserEmail = 'other.student@spit.ac.in';

  let driverToken;
  let passengerToken;
  let otherToken;

  // In-memory data store for isolated testing
  const ridesStore = new Map();
  const requestsStore = new Map();

  let origOfferCreate, origOfferFind, origOfferFindById, origOfferFindOneAndUpdate, origOfferCount;
  let origReqCreate, origReqFind, origReqFindOne, origReqFindById, origReqUpdateMany;

  before(async () => {
    originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

    userAuthCache.set(driverEmail, { email: driverEmail, name: 'Test Driver', role: 'Student', status: 'Active', onboarded: true });
    userAuthCache.set(passengerEmail, { email: passengerEmail, name: 'Test Passenger', role: 'Student', status: 'Active', onboarded: true });
    userAuthCache.set(otherUserEmail, { email: otherUserEmail, name: 'Other User', role: 'Student', status: 'Active', onboarded: true });

    driverToken = jwt.sign({ email: driverEmail, role: 'Student', name: 'Test Driver' }, JWT_SECRET, { expiresIn: '1h' });
    passengerToken = jwt.sign({ email: passengerEmail, role: 'Student', name: 'Test Passenger' }, JWT_SECRET, { expiresIn: '1h' });
    otherToken = jwt.sign({ email: otherUserEmail, role: 'Student', name: 'Other User' }, JWT_SECRET, { expiresIn: '1h' });

    // Mock RideOffer methods
    origOfferCreate = RideOffer.create;
    origOfferFind = RideOffer.find;
    origOfferFindById = RideOffer.findById;
    origOfferFindOneAndUpdate = RideOffer.findOneAndUpdate;
    origOfferCount = RideOffer.countDocuments;

    RideOffer.create = async (doc) => {
      const id = new mongoose.Types.ObjectId().toString();
      const newRide = {
        _id: id,
        id,
        ...doc,
        save: async function() { return this; },
        toObject: function() { return { ...this }; }
      };
      ridesStore.set(id, newRide);
      return newRide;
    };

    RideOffer.find = (query = {}) => {
      let list = Array.from(ridesStore.values());
      if (query.driverEmail) {
        if (typeof query.driverEmail === 'string') {
          list = list.filter(r => r.driverEmail.toLowerCase() === query.driverEmail.toLowerCase());
        } else if (query.driverEmail.$ne) {
          list = list.filter(r => r.driverEmail.toLowerCase() !== query.driverEmail.$ne.toLowerCase());
        }
      }
      return {
        sort: () => ({
          lean: async () => list
        }),
        lean: async () => list
      };
    };

    RideOffer.findById = async (id) => {
      const ride = ridesStore.get(String(id));
      if (!ride) return null;
      return {
        ...ride,
        save: async function() {
          ridesStore.set(String(id), this);
          return this;
        },
        lean: async () => ({ ...ride })
      };
    };

    RideOffer.findOneAndUpdate = async (filter, update) => {
      const ride = ridesStore.get(String(filter._id));
      if (!ride) return null;

      if (filter.availableSeats && filter.availableSeats.$gte !== undefined) {
        if (ride.availableSeats < filter.availableSeats.$gte) {
          return null; // Atomic condition failed: not enough seats
        }
      }

      if (update.$inc) {
        if (update.$inc.availableSeats) ride.availableSeats += update.$inc.availableSeats;
        if (update.$inc.confirmedPassengerCount) ride.confirmedPassengerCount += update.$inc.confirmedPassengerCount;
      }
      if (update.$push && update.$push.confirmedPassengers) {
        ride.confirmedPassengers = ride.confirmedPassengers || [];
        ride.confirmedPassengers.push(update.$push.confirmedPassengers);
      }
      if (update.$set) {
        Object.assign(ride, update.$set);
      }

      ride.save = async function() {
        ridesStore.set(String(filter._id), this);
        return this;
      };

      ridesStore.set(String(filter._id), ride);
      return ride;
    };

    RideOffer.countDocuments = async () => ridesStore.size;

    // Mock RideRequest methods
    origReqCreate = RideRequest.create;
    origReqFind = RideRequest.find;
    origReqFindOne = RideRequest.findOne;
    origReqFindById = RideRequest.findById;
    origReqUpdateMany = RideRequest.updateMany;

    RideRequest.create = async (doc) => {
      const id = new mongoose.Types.ObjectId().toString();
      const req = {
        _id: id,
        id,
        ...doc,
        save: async function() { return this; }
      };
      requestsStore.set(id, req);
      return req;
    };

    RideRequest.findOne = async (query = {}) => {
      for (const req of requestsStore.values()) {
        if (query.rideOfferId && String(req.rideOfferId) !== String(query.rideOfferId)) continue;
        if (query.passengerEmail && req.passengerEmail !== query.passengerEmail) continue;
        if (query.status && query.status.$in && !query.status.$in.includes(req.status)) continue;
        return req;
      }
      return null;
    };

    RideRequest.find = (query = {}) => {
      let list = Array.from(requestsStore.values());
      if (query.passengerEmail) list = list.filter(r => r.passengerEmail === query.passengerEmail);
      if (query.rideOfferId) list = list.filter(r => String(r.rideOfferId) === String(query.rideOfferId));
      if (query.status) list = list.filter(r => r.status === query.status);
      return {
        populate: () => ({
          sort: () => ({ lean: async () => list })
        }),
        sort: () => ({ lean: async () => list }),
        lean: async () => list
      };
    };

    RideRequest.findById = async (id) => {
      const req = requestsStore.get(String(id));
      if (!req) return null;
      return {
        ...req,
        save: async function() {
          requestsStore.set(String(id), this);
          return this;
        }
      };
    };

    RideRequest.updateMany = async (filter, update) => {
      let count = 0;
      for (const req of requestsStore.values()) {
        if (filter.rideOfferId && String(req.rideOfferId) !== String(filter.rideOfferId)) continue;
        if (filter.status && req.status !== filter.status) continue;
        if (update.$set) Object.assign(req, update.$set);
        count++;
      }
      return { modifiedCount: count };
    };

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Restore mocks
    RideOffer.create = origOfferCreate;
    RideOffer.find = origOfferFind;
    RideOffer.findById = origOfferFindById;
    RideOffer.findOneAndUpdate = origOfferFindOneAndUpdate;
    RideOffer.countDocuments = origOfferCount;

    RideRequest.create = origReqCreate;
    RideRequest.find = origReqFind;
    RideRequest.findOne = origReqFindOne;
    RideRequest.findById = origReqFindById;
    RideRequest.updateMany = origReqUpdateMany;

    if (originalReadyState !== undefined) {
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: originalReadyState,
        configurable: true
      });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // 1. Graph & Locations
  test('GET /api/modules/b/locations returns all SPIT campus and transit nodes', async () => {
    const res = await fetch(`${baseUrl}/api/modules/b/locations`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.count >= 8);
    const mainGate = json.data.find(n => n.id === 'spit_main_gate');
    assert.ok(mainGate);
    assert.equal(mainGate.category, 'campus_gate');
  });

  test('GET /api/modules/b/graph returns graph nodes and edges for visualization', async () => {
    const res = await fetch(`${baseUrl}/api/modules/b/graph`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data.nodes));
    assert.ok(Array.isArray(json.data.edges));
  });

  test('GET /api/modules/b/routes calculates shortest route between two nodes', async () => {
    const res = await fetch(`${baseUrl}/api/modules/b/routes?from=andheri_station_west&to=spit_main_gate`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.path[0], 'andheri_station_west');
    assert.equal(json.data.path[json.data.path.length - 1], 'spit_main_gate');
    assert.ok(json.data.totalDistance > 0);
  });

  test('GET /api/modules/b/routes returns 400 when missing from or to query parameters', async () => {
    const res = await fetch(`${baseUrl}/api/modules/b/routes?from=andheri_station_west`);
    assert.equal(res.status, 400);
  });

  // 2. Driver Ride Offer Lifecycle
  let createdRideId;
  test('POST /api/modules/b/rides creates a new ride offer for authenticated driver', async () => {
    const departure = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await fetch(`${baseUrl}/api/modules/b/rides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`
      },
      body: JSON.stringify({
        originNodeId: 'andheri_station_west',
        destinationNodeId: 'spit_library',
        departureTime: departure,
        totalSeats: 3,
        costPerSeat: 10,
        maxDetourKm: 1.5,
        vehicleType: 'car',
        vehicleModel: 'Honda City',
        vehicleNumber: 'MH-02-AB-1234'
      })
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.driverEmail, driverEmail);
    assert.equal(json.data.totalSeats, 3);
    assert.equal(json.data.availableSeats, 3);
    assert.ok(json.data.originalRoute.length >= 2);
    createdRideId = json.data._id;
  });

  test('POST /api/modules/b/rides rejects invalid or identical nodes', async () => {
    const res = await fetch(`${baseUrl}/api/modules/b/rides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`
      },
      body: JSON.stringify({
        originNodeId: 'spit_library',
        destinationNodeId: 'spit_library',
        departureTime: new Date().toISOString(),
        totalSeats: 3
      })
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /distinct/);
  });

  test('POST /api/modules/b/rides rejects invalid seat count (> 6 or < 1)', async () => {
    const res = await fetch(`${baseUrl}/api/modules/b/rides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`
      },
      body: JSON.stringify({
        originNodeId: 'andheri_station_west',
        destinationNodeId: 'spit_library',
        departureTime: new Date().toISOString(),
        totalSeats: 10
      })
    });

    assert.equal(res.status, 400);
  });

  // 3. Ride Search & Matching
  test('POST /api/modules/b/rides/search returns ranked compatible rides', async () => {
    const searchTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await fetch(`${baseUrl}/api/modules/b/rides/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken}`
      },
      body: JSON.stringify({
        pickupNodeId: 'spit_main_gate',
        dropoffNodeId: 'spit_library',
        desiredDepartureTime: searchTime,
        seatsRequested: 1,
        departureWindowMins: 60
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.matches.length >= 1);
    const match = json.matches.find(m => String(m.rideId) === String(createdRideId));
    assert.ok(match);
    assert.ok(match.matchScore > 50);
    assert.ok(match.explanation.length > 0);
  });

  // 4. Passenger Seat Requests
  let createdRequestId;
  test('POST /api/modules/b/rides/:id/requests allows passenger to request a seat', async () => {
    const res = await fetch(`${baseUrl}/api/modules/b/rides/${createdRideId}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken}`
      },
      body: JSON.stringify({
        pickupNodeId: 'spit_main_gate',
        dropoffNodeId: 'spit_library',
        seatsRequested: 1
      })
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.passengerEmail, passengerEmail);
    assert.equal(json.data.status, 'pending');
    createdRequestId = json.data._id;
  });

  test('POST /api/modules/b/rides/:id/requests prevents duplicate active requests', async () => {
    const res = await fetch(`${baseUrl}/api/modules/b/rides/${createdRideId}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken}`
      },
      body: JSON.stringify({
        pickupNodeId: 'spit_main_gate',
        dropoffNodeId: 'spit_library',
        seatsRequested: 1
      })
    });

    assert.equal(res.status, 409);
    const json = await res.json();
    assert.match(json.error, /already have an active request/);
  });

  test('POST /api/modules/b/rides/:id/requests prevents driver requesting seat on own ride', async () => {
    const res = await fetch(`${baseUrl}/api/modules/b/rides/${createdRideId}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`
      },
      body: JSON.stringify({
        pickupNodeId: 'spit_main_gate',
        dropoffNodeId: 'spit_library',
        seatsRequested: 1
      })
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /driving/);
  });

  // 5. Driver Request Management (Accept / Reject)
  test('POST /api/modules/b/requests/:id/accept allows driver to accept request and decrements available seats', async () => {
    const res = await fetch(`${baseUrl}/api/modules/b/requests/${createdRequestId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`
      }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.request.status, 'accepted');
    assert.equal(json.data.ride.availableSeats, 2); // 3 - 1 = 2
    assert.equal(json.data.ride.confirmedPassengerCount, 1);
  });

  test('POST /api/modules/b/requests/:id/accept rejects non-driver user with 403', async () => {
    const res = await fetch(`${baseUrl}/api/modules/b/requests/${createdRequestId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${otherToken}`
      }
    });

    assert.equal(res.status, 403);
  });

  // 6. Passenger Cancellation
  test('POST /api/modules/b/requests/:id/cancel allows passenger to cancel and restores seats', async () => {
    const res = await fetch(`${baseUrl}/api/modules/b/requests/${createdRequestId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken}`
      }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.status, 'cancelled');

    // Verify seat was restored on RideOffer
    const ride = await RideOffer.findById(createdRideId);
    assert.equal(ride.availableSeats, 3);
    assert.equal(ride.confirmedPassengerCount, 0);
  });

  // 7. Driver Ride Cancellation
  test('POST /api/modules/b/rides/:id/cancel allows driver to cancel their ride', async () => {
    const res = await fetch(`${baseUrl}/api/modules/b/rides/${createdRideId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`
      },
      body: JSON.stringify({ reason: 'Trip rescheduled' })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.status, 'cancelled');
  });

  // 8. Sustainability Metrics
  test('GET /api/modules/b/metrics returns live aggregated mobility and CO2 statistics', async () => {
    const res = await fetch(`${baseUrl}/api/modules/b/metrics`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.totalRides >= 1);
    assert.ok(json.data.estimatedCo2SavedKg > 0);
    assert.ok(json.data.totalPassengersCarpooled > 0);
    assert.match(json.data.emissionFactorBaseline, /120 g CO2\/km/);
  });
});
