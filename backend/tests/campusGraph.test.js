const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { CampusGraphService, CAMPUS_NODES, CAMPUS_EDGES } = require('../modules/moduleB_ridePooling/services/campusGraphService');

describe('Module B - Campus Mobility Graph & Dijkstra Router', () => {
  const graph = new CampusGraphService(CAMPUS_NODES, CAMPUS_EDGES);

  test('Validates existing nodes accurately', () => {
    assert.equal(graph.isValidNode('spit_main_gate'), true);
    assert.equal(graph.isValidNode('andheri_station_west'), true);
    assert.equal(graph.isValidNode('non_existent_node'), false);
  });

  test('Finds shortest path between Andheri Station and SPIT Main Gate', () => {
    const route = graph.findShortestPath('andheri_station_west', 'spit_main_gate', 'distance');
    assert.ok(route);
    assert.equal(route.path[0], 'andheri_station_west');
    assert.equal(route.path[route.path.length - 1], 'spit_main_gate');
    assert.ok(route.totalDistance > 0 && route.totalDistance <= 2.5);
    assert.ok(route.totalDuration > 0);
    assert.ok(Array.isArray(route.steps));
  });

  test('Finds shortest path by travel time', () => {
    const route = graph.findShortestPath('azad_nagar_metro', 'spit_library', 'time');
    assert.ok(route);
    assert.equal(route.path[0], 'azad_nagar_metro');
    assert.equal(route.path[route.path.length - 1], 'spit_library');
    assert.ok(route.totalDuration <= 5);
  });

  test('Handles identical origin and destination (distance = 0)', () => {
    const route = graph.findShortestPath('spit_library', 'spit_library');
    assert.ok(route);
    assert.deepEqual(route.path, ['spit_library']);
    assert.equal(route.totalDistance, 0);
    assert.equal(route.totalDuration, 0);
  });

  test('Returns null for missing or invalid nodes', () => {
    assert.equal(graph.findShortestPath('invalid_origin', 'spit_main_gate'), null);
    assert.equal(graph.findShortestPath('spit_main_gate', 'invalid_dest'), null);
  });

  test('Handles disconnected subgraph / unreachable nodes gracefully', () => {
    // Custom graph with an isolated island node
    const testNodes = {
      ...CAMPUS_NODES,
      'isolated_island': { id: 'isolated_island', name: 'Isolated Island', category: 'isolated' }
    };
    const disconnectedGraph = new CampusGraphService(testNodes, CAMPUS_EDGES);
    const route = disconnectedGraph.findShortestPath('spit_main_gate', 'isolated_island');
    assert.equal(route, null);
  });

  test('Computes multi-stop route sequence (e.g. Driver with Passenger pickup/dropoff)', () => {
    const waypoints = ['andheri_station_west', 'azad_nagar_metro', 'spit_main_gate', 'spit_library'];
    const multiRoute = graph.computeMultiStopRoute(waypoints);
    assert.ok(multiRoute);
    assert.equal(multiRoute.path[0], 'andheri_station_west');
    assert.equal(multiRoute.path[multiRoute.path.length - 1], 'spit_library');
    assert.ok(multiRoute.totalDistance > 2.0);
    assert.ok(multiRoute.steps.length >= 3);
  });

  test('Multi-stop route fails if any intermediate segment is unreachable', () => {
    const testNodes = {
      ...CAMPUS_NODES,
      'isolated_island': { id: 'isolated_island', name: 'Isolated Island' }
    };
    const disconnectedGraph = new CampusGraphService(testNodes, CAMPUS_EDGES);
    const multiRoute = disconnectedGraph.computeMultiStopRoute(['spit_main_gate', 'isolated_island', 'spit_library']);
    assert.equal(multiRoute, null);
  });
});
