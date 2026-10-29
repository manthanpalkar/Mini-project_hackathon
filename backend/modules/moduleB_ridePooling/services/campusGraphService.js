/**
 * PriorityQueue implementation for Dijkstra's algorithm
 * Min-Heap based implementation for O((V + E) log V) efficiency
 */
class MinPriorityQueue {
  constructor() {
    this.heap = [];
  }

  push(item, priority) {
    this.heap.push({ item, priority });
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const min = this.heap[0];
    const end = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = end;
      this._sinkDown(0);
    }
    return min.item;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  _bubbleUp(index) {
    const element = this.heap[index];
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIdx];
      if (element.priority >= parent.priority) break;
      this.heap[index] = parent;
      this.heap[parentIdx] = element;
      index = parentIdx;
    }
  }

  _sinkDown(index) {
    const length = this.heap.length;
    const element = this.heap[index];
    while (true) {
      let leftChildIdx = 2 * index + 1;
      let rightChildIdx = 2 * index + 2;
      let swap = null;

      if (leftChildIdx < length) {
        if (this.heap[leftChildIdx].priority < element.priority) {
          swap = leftChildIdx;
        }
      }

      if (rightChildIdx < length) {
        const leftPriority = swap === null ? element.priority : this.heap[leftChildIdx].priority;
        if (this.heap[rightChildIdx].priority < leftPriority) {
          swap = rightChildIdx;
        }
      }

      if (swap === null) break;
      this.heap[index] = this.heap[swap];
      this.heap[swap] = element;
      index = swap;
    }
  }
}

/**
 * SPIT Campus and Surrounding Transit Demonstration Graph
 * Clearly labeled as synthetic demonstration graph for Bhavan's / SPIT campus & Andheri hub
 */
const CAMPUS_NODES = {
  'spit_main_gate': {
    id: 'spit_main_gate',
    name: "SPIT Main Gate (Bhavan's Campus)",
    shortName: 'Main Gate',
    category: 'campus_gate',
    x: 480,
    y: 320,
    coordinates: [19.1232, 72.8361],
    description: "Primary vehicular & pedestrian access point to Sardar Patel Institute of Technology on Munshi Nagar road."
  },
  'andheri_station_west': {
    id: 'andheri_station_west',
    name: 'Andheri Railway Station (West)',
    shortName: 'Andheri Stn',
    category: 'transit_station',
    x: 120,
    y: 500,
    coordinates: [19.1197, 72.8464],
    description: "Major suburban railway terminal (Western & Harbour Lines) and auto-rickshaw feeder hub."
  },
  'azad_nagar_metro': {
    id: 'azad_nagar_metro',
    name: 'Azad Nagar Metro Station (Line 1)',
    shortName: 'Azad Nagar Metro',
    category: 'transit_station',
    x: 280,
    y: 180,
    coordinates: [19.1296, 72.8362],
    description: "Mumbai Metro Line 1 station connecting Versova-Ghatkopar, 900m north of SPIT."
  },
  'dn_nagar_metro': {
    id: 'dn_nagar_metro',
    name: 'D.N. Nagar Metro Station (Line 1 & 2A)',
    shortName: 'D.N. Nagar Metro',
    category: 'transit_station',
    x: 180,
    y: 330,
    coordinates: [19.1252, 72.8315],
    description: "Metro interchange hub between Line 1 (Blue) and Line 2A (Yellow)."
  },
  'bhavans_lake': {
    id: 'bhavans_lake',
    name: "Bhavan's Lake & Botanical Garden",
    shortName: "Bhavan's Lake",
    category: 'campus_landmark',
    x: 570,
    y: 220,
    coordinates: [19.1245, 72.8340],
    description: "Scenic campus landmark and central junction connecting academic blocks and hostels."
  },
  'spit_library': {
    id: 'spit_library',
    name: 'SPIT Central Library & Academic Quad',
    shortName: 'Academic Quad',
    category: 'academic_building',
    x: 650,
    y: 340,
    coordinates: [19.1238, 72.8365],
    description: "Central Academic building housing classrooms, CS/IT computer labs, and engineering auditoriums."
  },
  'spit_hostel_boys': {
    id: 'spit_hostel_boys',
    name: "Bhavan's Boys Hostel Campus",
    shortName: 'Boys Hostel',
    category: 'hostel',
    x: 740,
    y: 180,
    coordinates: [19.1255, 72.8330],
    description: "Undergraduate student residential complex located north-east of the campus lake."
  },
  'spit_hostel_girls': {
    id: 'spit_hostel_girls',
    name: "Bhavan's Girls Hostel Campus",
    shortName: 'Girls Hostel',
    category: 'hostel',
    x: 820,
    y: 220,
    coordinates: [19.1250, 72.8335],
    description: "Women's residential campus with dedicated 24/7 security booth and pickup bay."
  },
  'spit_gymkhana': {
    id: 'spit_gymkhana',
    name: 'SPIT Sports Gymkhana & Ground',
    shortName: 'Gymkhana Ground',
    category: 'recreation',
    x: 520,
    y: 450,
    coordinates: [19.1220, 72.8350],
    description: "Outdoor sports pavilion, cricket grounds, and student parking bay."
  },
  'versova_link_road': {
    id: 'versova_link_road',
    name: 'Versova Link Road Junction',
    shortName: 'Versova Link Rd',
    category: 'transit_point',
    x: 100,
    y: 160,
    coordinates: [19.1310, 72.8280],
    description: "Major vehicular artery connecting Andheri West, Lokhandwala, and Versova."
  }
};

/**
 * Weighted edges with explicit distance (km) and travel duration (minutes)
 * Mode: 'driving' (car/auto/bike accessible)
 */
const CAMPUS_EDGES = [
  // Transit to campus access
  { from: 'andheri_station_west', to: 'azad_nagar_metro', distanceKm: 1.8, durationMins: 6, mode: 'driving' },
  { from: 'andheri_station_west', to: 'dn_nagar_metro', distanceKm: 1.6, durationMins: 5, mode: 'driving' },
  { from: 'andheri_station_west', to: 'spit_gymkhana', distanceKm: 1.9, durationMins: 7, mode: 'driving' },
  { from: 'andheri_station_west', to: 'spit_main_gate', distanceKm: 2.2, durationMins: 8, mode: 'driving' },

  // Metro connections
  { from: 'azad_nagar_metro', to: 'dn_nagar_metro', distanceKm: 1.1, durationMins: 4, mode: 'driving' },
  { from: 'azad_nagar_metro', to: 'spit_main_gate', distanceKm: 0.9, durationMins: 3, mode: 'driving' },
  { from: 'dn_nagar_metro', to: 'versova_link_road', distanceKm: 1.2, durationMins: 4, mode: 'driving' },
  { from: 'azad_nagar_metro', to: 'versova_link_road', distanceKm: 1.4, durationMins: 5, mode: 'driving' },

  // Internal campus network
  { from: 'spit_main_gate', to: 'spit_gymkhana', distanceKm: 0.4, durationMins: 2, mode: 'driving' },
  { from: 'spit_main_gate', to: 'spit_library', distanceKm: 0.3, durationMins: 1, mode: 'driving' },
  { from: 'spit_main_gate', to: 'bhavans_lake', distanceKm: 0.5, durationMins: 2, mode: 'driving' },
  { from: 'spit_gymkhana', to: 'bhavans_lake', distanceKm: 0.6, durationMins: 2, mode: 'driving' },
  { from: 'spit_library', to: 'bhavans_lake', distanceKm: 0.4, durationMins: 1, mode: 'driving' },

  // Hostels and residential connections
  { from: 'bhavans_lake', to: 'spit_hostel_boys', distanceKm: 0.4, durationMins: 2, mode: 'driving' },
  { from: 'spit_hostel_boys', to: 'spit_hostel_girls', distanceKm: 0.2, durationMins: 1, mode: 'driving' },
  { from: 'spit_library', to: 'spit_hostel_girls', distanceKm: 0.6, durationMins: 2, mode: 'driving' },
  { from: 'spit_hostel_boys', to: 'azad_nagar_metro', distanceKm: 0.8, durationMins: 3, mode: 'driving' },
  { from: 'spit_hostel_girls', to: 'dn_nagar_metro', distanceKm: 1.0, durationMins: 3, mode: 'driving' }
];

class CampusGraphService {
  constructor(nodes = CAMPUS_NODES, edges = CAMPUS_EDGES) {
    this.nodes = { ...nodes };
    this.adjacency = new Map();
    this._buildAdjacency(edges);
  }

  _buildAdjacency(edges) {
    for (const nodeId of Object.keys(this.nodes)) {
      this.adjacency.set(nodeId, []);
    }
    for (const edge of edges) {
      if (!this.nodes[edge.from] || !this.nodes[edge.to]) continue;
      
      // Symmetrical bidirectional roads
      this.adjacency.get(edge.from).push({
        to: edge.to,
        distanceKm: edge.distanceKm,
        durationMins: edge.durationMins,
        mode: edge.mode || 'driving'
      });
      this.adjacency.get(edge.to).push({
        to: edge.from,
        distanceKm: edge.distanceKm,
        durationMins: edge.durationMins,
        mode: edge.mode || 'driving'
      });
    }
  }

  /**
   * Get list of all registered nodes
   */
  getNodes() {
    return Object.values(this.nodes);
  }

  /**
   * Get node by ID
   */
  getNode(id) {
    return this.nodes[id] || null;
  }

  /**
   * Get raw graph definition (for visualization)
   */
  getGraphData() {
    return {
      nodes: this.getNodes(),
      edges: CAMPUS_EDGES
    };
  }

  /**
   * Validates if node exists in graph
   */
  isValidNode(id) {
    return Boolean(this.nodes[id]);
  }

  /**
   * Shortest Path via Dijkstra's Algorithm
   * @param {string} startNodeId - Source node ID
   * @param {string} endNodeId - Destination node ID
   * @param {string} metric - 'distance' (default) or 'time'
   * @returns {Object|null} { path, totalDistance, totalDuration, steps } or null if unreachable
   */
  findShortestPath(startNodeId, endNodeId, metric = 'distance') {
    if (!this.isValidNode(startNodeId) || !this.isValidNode(endNodeId)) {
      return null;
    }

    if (startNodeId === endNodeId) {
      const node = this.nodes[startNodeId];
      return {
        path: [startNodeId],
        totalDistance: 0,
        totalDuration: 0,
        steps: [{ from: startNodeId, to: startNodeId, distanceKm: 0, durationMins: 0, nodeName: node.name }]
      };
    }

    const distances = new Map();
    const durations = new Map();
    const previous = new Map();
    const visited = new Set();
    const pq = new MinPriorityQueue();

    for (const nodeId of Object.keys(this.nodes)) {
      distances.set(nodeId, Infinity);
      durations.set(nodeId, Infinity);
    }

    distances.set(startNodeId, 0);
    durations.set(startNodeId, 0);
    pq.push(startNodeId, 0);

    while (!pq.isEmpty()) {
      const current = pq.pop();
      if (!current) break;
      if (visited.has(current)) continue;
      visited.add(current);

      if (current === endNodeId) break;

      const neighbors = this.adjacency.get(current) || [];
      for (const edge of neighbors) {
        if (visited.has(edge.to)) continue;

        const weight = metric === 'time' ? edge.durationMins : edge.distanceKm;
        const currentCost = metric === 'time' ? durations.get(current) : distances.get(current);
        const newCost = currentCost + weight;

        const targetCost = metric === 'time' ? durations.get(edge.to) : distances.get(edge.to);

        if (newCost < targetCost) {
          distances.set(edge.to, distances.get(current) + edge.distanceKm);
          durations.set(edge.to, durations.get(current) + edge.durationMins);
          previous.set(edge.to, { from: current, edge });
          pq.push(edge.to, newCost);
        }
      }
    }

    // Check if destination is reachable
    if (!previous.has(endNodeId)) {
      return null;
    }

    // Reconstruct path
    const path = [];
    const steps = [];
    let curr = endNodeId;

    while (curr && curr !== startNodeId) {
      path.unshift(curr);
      const prevInfo = previous.get(curr);
      if (!prevInfo) break;
      steps.unshift({
        from: prevInfo.from,
        to: curr,
        fromName: this.nodes[prevInfo.from]?.name || prevInfo.from,
        toName: this.nodes[curr]?.name || curr,
        distanceKm: prevInfo.edge.distanceKm,
        durationMins: prevInfo.edge.durationMins
      });
      curr = prevInfo.from;
    }
    path.unshift(startNodeId);

    const totalDistance = Math.round(distances.get(endNodeId) * 100) / 100;
    const totalDuration = Math.round(durations.get(endNodeId));

    return {
      path,
      totalDistance,
      totalDuration,
      steps
    };
  }

  /**
   * Computes route connecting an ordered list of waypoints
   * e.g. [D_orig, P_pickup, P_dropoff, D_dest]
   * @param {string[]} waypoints - List of node IDs in sequence
   * @returns {Object|null}
   */
  computeMultiStopRoute(waypoints) {
    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      return null;
    }

    let fullPath = [];
    let totalDistance = 0;
    let totalDuration = 0;
    let steps = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];

      if (from === to) continue;

      const leg = this.findShortestPath(from, to, 'distance');
      if (!leg) return null; // Unreachable leg breaks route

      totalDistance += leg.totalDistance;
      totalDuration += leg.totalDuration;
      steps.push(...leg.steps);

      if (fullPath.length === 0) {
        fullPath.push(...leg.path);
      } else {
        // Omit first element to avoid duplicate consecutive nodes
        fullPath.push(...leg.path.slice(1));
      }
    }

    return {
      path: fullPath,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalDuration: Math.round(totalDuration),
      steps
    };
  }
}

const campusGraphInstance = new CampusGraphService();

module.exports = {
  CampusGraphService,
  campusGraphInstance,
  CAMPUS_NODES,
  CAMPUS_EDGES
};
