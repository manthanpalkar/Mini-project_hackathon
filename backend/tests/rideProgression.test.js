const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { RideOffer, StudentSustainabilityOutcome, RideNotification } = require('../modules/moduleB_ridePooling/models/rideModel');
const { getRideProgressionInstance } = require('../modules/moduleB_ridePooling/services/rideProgressionService');

describe('Module B - Active Trip Progression & Simulation Lifecycle', () => {
  let progressionService;
  const ridesStore = new Map();
  const outcomesStore = new Map();
  const validObjectId = new mongoose.Types.ObjectId().toString();

  before(() => {
    progressionService = getRideProgressionInstance();

    // Mock RideNotification to prevent un-connected Mongoose buffering
    RideNotification.create = async (doc) => ({ _id: new mongoose.Types.ObjectId().toString(), ...doc });

    // Mock RideOffer.findById supporting both direct await and .lean()
    RideOffer.findById = (id) => {
      const r = ridesStore.get(String(id));
      return {
        lean: async () => r ? ({ ...r }) : null,
        then: (resolve) => {
          if (!r) return resolve(null);
          return resolve({
            ...r,
            save: async function() {
              ridesStore.set(String(id), this);
              return this;
            }
          });
        }
      };
    };

    // Mock StudentSustainabilityOutcome.findOneAndUpdate (idempotent upsert)
    StudentSustainabilityOutcome.findOneAndUpdate = async (filter, update, options) => {
      const key = `${filter.rideOfferId}_${filter.studentEmail}`;
      if (outcomesStore.has(key)) {
        return outcomesStore.get(key);
      }
      const doc = {
        _id: new mongoose.Types.ObjectId().toString(),
        ...filter,
        ...(update.$setOnInsert || update.$set || {})
      };
      outcomesStore.set(key, doc);
      return doc;
    };
  });

  test('Driver starts ride successfully, transitioning status to in_transit', async () => {
    const rideId = validObjectId;
    ridesStore.set(rideId, {
      _id: rideId,
      driverEmail: 'driver@spit.ac.in',
      driverName: 'Driver Bob',
      originNodeId: 'andheri_station_west',
      destinationNodeId: 'spit_main_gate',
      status: 'open',
      currentRoute: ['andheri_station_west', 'amboli_phatak', 'bhavans_lake', 'spit_main_gate'],
      confirmedPassengers: [
        { passengerEmail: 'alice@spit.ac.in', passengerName: 'Alice', pickupNodeId: 'bhavans_lake', seatsBooked: 1, requestId: new mongoose.Types.ObjectId().toString() }
      ]
    });

    const started = await progressionService.startRide(rideId, 'driver@spit.ac.in');
    assert.strictEqual(started.status, 'in_transit');
    assert.ok(started.startedAt instanceof Date);
    assert.strictEqual(started.simulation.status, 'running');
    assert.strictEqual(started.simulation.progressFraction, 0);
  });

  test('Start ride is rejected for unauthorized non-driver user', async () => {
    const rideId = validObjectId;
    await assert.rejects(
      async () => await progressionService.startRide(rideId, 'hacker@spit.ac.in'),
      { status: 403 }
    );
  });

  test('Start ride is idempotent when called repeatedly on in_transit ride', async () => {
    const rideId = validObjectId;
    const startedAgain = await progressionService.startRide(rideId, 'driver@spit.ac.in');
    assert.strictEqual(startedAgain.status, 'in_transit');
  });

  test('Authoritative progress calculates ETA to passenger pickup waypoint', async () => {
    const rideId = validObjectId;
    // Alice is getting picked up at bhavans_lake (index 2 of 4)
    const prog = await progressionService.getRideProgress(rideId, 'alice@spit.ac.in');
    assert.strictEqual(prog.isSimulated, true);
    assert.strictEqual(prog.passengerPickupNodeId, 'bhavans_lake');
    assert.ok(typeof prog.passengerPickupEtaMins === 'number');
    assert.ok(prog.passengerPickupEtaMins >= 0);
  });

  test('Driver can advance simulated progress monotonically', async () => {
    const rideId = validObjectId;
    const advanced = await progressionService.advanceSimulatedProgress(rideId, 'driver@spit.ac.in', 0.5);
    assert.ok(advanced.progressFraction >= 0.5);
    assert.strictEqual(advanced.currentWaypointNodeId, 'bhavans_lake');
  });

  test('Driver completes ride, persisting exactly-once sustainability outcomes for driver and passenger', async () => {
    const rideId = validObjectId;
    const completed = await progressionService.completeRide(rideId, 'driver@spit.ac.in');
    assert.strictEqual(completed.status, 'completed');
    assert.ok(completed.completedAt instanceof Date);
    assert.strictEqual(completed.simulation.status, 'completed');
    assert.strictEqual(completed.simulation.progressFraction, 1.0);

    // Verify outcomes store has driver and passenger outcomes
    assert.ok(outcomesStore.has(`${rideId}_driver@spit.ac.in`));
    assert.ok(outcomesStore.has(`${rideId}_alice@spit.ac.in`));

    const driverOutcome = outcomesStore.get(`${rideId}_driver@spit.ac.in`);
    assert.strictEqual(driverOutcome.role, 'driver');
    assert.strictEqual(driverOutcome.source, 'driver_confirmed_simulated_trip');

    const passOutcome = outcomesStore.get(`${rideId}_alice@spit.ac.in`);
    assert.strictEqual(passOutcome.role, 'passenger');
  });

  test('Repeated completeRide call is idempotent and does not duplicate outcomes', async () => {
    const rideId = validObjectId;
    const initialSize = outcomesStore.size;
    await progressionService.completeRide(rideId, 'driver@spit.ac.in');
    assert.strictEqual(outcomesStore.size, initialSize);
  });

  test('Completed ride cannot be started again', async () => {
    const rideId = validObjectId;
    await assert.rejects(
      async () => await progressionService.startRide(rideId, 'driver@spit.ac.in'),
      { status: 400 }
    );
  });
});
