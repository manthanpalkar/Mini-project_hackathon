const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { RideMatchingService } = require('../modules/moduleB_ridePooling/services/rideMatchingService');
const { campusGraphInstance } = require('../modules/moduleB_ridePooling/services/campusGraphService');

describe('Module B - Ride Matching Engine & Route Insertion', () => {
  const matcher = new RideMatchingService(campusGraphInstance);
  const baseTime = new Date('2026-10-30T09:00:00Z');

  // Candidate rides
  const testRides = [
    {
      _id: 'ride-1-direct',
      driverEmail: 'driver1@spit.ac.in',
      driverName: 'Rohit Sharma',
      originNodeId: 'andheri_station_west',
      destinationNodeId: 'spit_library',
      currentRoute: ['andheri_station_west', 'spit_main_gate', 'spit_library'],
      departureTime: new Date('2026-10-30T09:05:00Z'),
      totalSeats: 4,
      availableSeats: 3,
      costPerSeat: 10,
      maxDetourKm: 2.0,
      status: 'open'
    },
    {
      _id: 'ride-2-hostel',
      driverEmail: 'driver2@spit.ac.in',
      driverName: 'Ananya Verma',
      originNodeId: 'azad_nagar_metro',
      destinationNodeId: 'spit_hostel_boys',
      currentRoute: ['azad_nagar_metro', 'spit_main_gate', 'bhavans_lake', 'spit_hostel_boys'],
      departureTime: new Date('2026-10-30T09:10:00Z'),
      totalSeats: 3,
      availableSeats: 2,
      costPerSeat: 0, // free carpool
      maxDetourKm: 1.5,
      status: 'open'
    },
    {
      _id: 'ride-3-full',
      driverEmail: 'driver3@spit.ac.in',
      driverName: 'Kunal Patil',
      originNodeId: 'andheri_station_west',
      destinationNodeId: 'spit_main_gate',
      currentRoute: ['andheri_station_west', 'spit_main_gate'],
      departureTime: new Date('2026-10-30T09:00:00Z'),
      totalSeats: 3,
      availableSeats: 0,
      status: 'full'
    },
    {
      _id: 'ride-4-late',
      driverEmail: 'driver4@spit.ac.in',
      driverName: 'Pooja Nair',
      originNodeId: 'andheri_station_west',
      destinationNodeId: 'spit_library',
      currentRoute: ['andheri_station_west', 'spit_library'],
      departureTime: new Date('2026-10-30T11:30:00Z'), // 2.5 hours late
      totalSeats: 4,
      availableSeats: 4,
      status: 'open'
    }
  ];

  test('Matches exact on-path route with 0 km detour', () => {
    // Passenger wants from spit_main_gate to spit_library
    // Ride 1 passes through spit_main_gate -> spit_library
    const result = matcher.matchRides({
      passengerEmail: 'passenger@spit.ac.in',
      pickupNodeId: 'spit_main_gate',
      dropoffNodeId: 'spit_library',
      desiredDepartureTime: baseTime,
      seatsRequested: 1,
      departureWindowMins: 30
    }, testRides);

    assert.ok(result.matchesCount >= 1);
    const topMatch = result.matches[0];
    assert.equal(topMatch.rideId, 'ride-1-direct');
    assert.equal(topMatch.detourKm, 0);
    assert.ok(topMatch.matchScore > 85);
    assert.match(topMatch.explanation, /0 km detour/);
  });

  test('Calculates feasible route insertion for off-path passenger', () => {
    // Passenger from azad_nagar_metro to spit_library
    // Ride 1 (andheri -> main gate -> library) can pick up at azad nagar with detour
    const result = matcher.matchRides({
      passengerEmail: 'passenger@spit.ac.in',
      pickupNodeId: 'azad_nagar_metro',
      dropoffNodeId: 'spit_library',
      desiredDepartureTime: baseTime,
      seatsRequested: 1,
      maxDetourKm: 3.0,
      departureWindowMins: 30
    }, testRides);

    assert.ok(result.matchesCount >= 1);
    const match = result.matches.find(m => m.rideId === 'ride-1-direct');
    assert.ok(match);
    assert.ok(match.detourKm > 0);
    assert.ok(match.sharedRouteWaypoints.includes('azad_nagar_metro'));
  });

  test('Rejects candidate when remaining capacity is less than requested seats', () => {
    const result = matcher.matchRides({
      passengerEmail: 'passenger@spit.ac.in',
      pickupNodeId: 'andheri_station_west',
      dropoffNodeId: 'spit_main_gate',
      desiredDepartureTime: baseTime,
      seatsRequested: 4 // Only 3 seats in ride-1
    }, testRides);

    const ride1Reject = result.rejected.find(r => r.rideId === 'ride-1-direct');
    assert.ok(ride1Reject);
    assert.match(ride1Reject.reason, /Insufficient capacity/);
  });

  test('Rejects full or cancelled rides', () => {
    const result = matcher.matchRides({
      passengerEmail: 'passenger@spit.ac.in',
      pickupNodeId: 'andheri_station_west',
      dropoffNodeId: 'spit_main_gate',
      desiredDepartureTime: baseTime,
      seatsRequested: 1
    }, testRides);

    const fullReject = result.rejected.find(r => r.rideId === 'ride-3-full');
    assert.ok(fullReject);
    assert.match(fullReject.reason, /must be 'open'/);
  });

  test('Rejects rides departing outside the allowed time window', () => {
    const result = matcher.matchRides({
      passengerEmail: 'passenger@spit.ac.in',
      pickupNodeId: 'andheri_station_west',
      dropoffNodeId: 'spit_library',
      desiredDepartureTime: baseTime,
      departureWindowMins: 30
    }, testRides);

    const lateReject = result.rejected.find(r => r.rideId === 'ride-4-late');
    assert.ok(lateReject);
    assert.match(lateReject.reason, /Departure time difference/);
  });

  test('Rejects driver attempting to request seat on their own ride', () => {
    const result = matcher.matchRides({
      passengerEmail: 'driver1@spit.ac.in', // Same as driver
      pickupNodeId: 'andheri_station_west',
      dropoffNodeId: 'spit_library',
      desiredDepartureTime: baseTime
    }, testRides);

    const selfReject = result.rejected.find(r => r.rideId === 'ride-1-direct');
    assert.ok(selfReject);
    assert.match(selfReject.reason, /cannot be a passenger on their own ride/);
  });

  test('Rejects when detour exceeds driver or passenger threshold', () => {
    // Passenger wants large detour across versova link road
    const result = matcher.matchRides({
      passengerEmail: 'passenger@spit.ac.in',
      pickupNodeId: 'versova_link_road',
      dropoffNodeId: 'spit_library',
      desiredDepartureTime: baseTime,
      maxDetourKm: 0.1 // Unrealistically tight detour threshold
    }, testRides);

    const detourReject = result.rejected.find(r => r.rideId === 'ride-1-direct');
    assert.ok(detourReject);
    assert.match(detourReject.reason, /exceeds maximum allowable detour/);
  });
});
