import React, { useMemo } from 'react';
import { MapPin, Navigation, Compass, Layers, CheckCircle, Car } from 'lucide-react';

// Geographically calibrated nodes for S.P.I.T. and surrounding transit hubs
const NODES_DATA = [
  { id: 'versova_metro', name: 'Versova Metro (Line 1)', lat: 19.1317, lng: 72.8172, type: 'transit_metro', color: '#3B82F6' },
  { id: 'four_bungalows', name: 'Four Bungalows RTO', lat: 19.1278, lng: 72.8256, type: 'hub', color: '#8B5CF6' },
  { id: 'dn_nagar_metro', name: 'DN Nagar Interchange', lat: 19.1251, lng: 72.8298, type: 'transit_metro', color: '#3B82F6' },
  { id: 'azad_nagar_metro', name: 'Azad Nagar Metro', lat: 19.1298, lng: 72.8363, type: 'transit_metro', color: '#3B82F6' },
  { id: 'spit_main_gate', name: 'S.P.I.T. Main Gate', lat: 19.1232, lng: 72.8361, type: 'campus_core', color: '#10B981' },
  { id: 'bhavans_lake', name: 'Bhavans Lake North Gate', lat: 19.1245, lng: 72.8375, type: 'campus_perimeter', color: '#059669' },
  { id: 'amboli_phatak', name: 'Amboli Phatak Crossing', lat: 19.1211, lng: 72.8423, type: 'corridor', color: '#F59E0B' },
  { id: 'andheri_station_west', name: 'Andheri Station (West)', lat: 19.1197, lng: 72.8464, type: 'transit_hub', color: '#EC4899' },
  { id: 'cooper_hospital', name: 'Cooper Hospital Junction', lat: 19.1152, lng: 72.8398, type: 'corridor', color: '#F59E0B' },
  { id: 'jvpd_circle', name: 'JVPD Circle Juhu', lat: 19.1105, lng: 72.8302, type: 'corridor', color: '#6366F1' }
];

const EDGES_DATA = [
  { from: 'andheri_station_west', to: 'amboli_phatak' },
  { from: 'amboli_phatak', to: 'bhavans_lake' },
  { from: 'bhavans_lake', to: 'spit_main_gate' },
  { from: 'andheri_station_west', to: 'cooper_hospital' },
  { from: 'cooper_hospital', to: 'jvpd_circle' },
  { from: 'cooper_hospital', to: 'spit_main_gate' },
  { from: 'jvpd_circle', to: 'dn_nagar_metro' },
  { from: 'dn_nagar_metro', to: 'four_bungalows' },
  { from: 'four_bungalows', to: 'versova_metro' },
  { from: 'dn_nagar_metro', to: 'azad_nagar_metro' },
  { from: 'dn_nagar_metro', to: 'spit_main_gate' },
  { from: 'azad_nagar_metro', to: 'spit_main_gate' },
  { from: 'azad_nagar_metro', to: 'bhavans_lake' },
  { from: 'versova_metro', to: 'dn_nagar_metro' }
];

export default function CampusNetworkMap({
  activeRoute = [],
  pickupNodeId = '',
  dropoffNodeId = '',
  onSelectNode = null,
  simulationMode = false,
  progressFraction = 0, // 0 to 1
  remainingMins = null,
  passengerPickupEtaMins = null
}) {
  const width = 760;
  const height = 440;
  const paddingX = 80;
  const paddingY = 60;

  // Compute bounding box for projection
  const bounds = useMemo(() => {
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    NODES_DATA.forEach(n => {
      if (n.lat < minLat) minLat = n.lat;
      if (n.lat > maxLat) maxLat = n.lat;
      if (n.lng < minLng) minLng = n.lng;
      if (n.lng > maxLng) maxLng = n.lng;
    });
    return { minLat, maxLat, minLng, maxLng };
  }, []);

  const project = (lat, lng) => {
    const latRange = bounds.maxLat - bounds.minLat || 1;
    const lngRange = bounds.maxLng - bounds.minLng || 1;
    const x = paddingX + ((lng - bounds.minLng) / lngRange) * (width - 2 * paddingX);
    const y = height - (paddingY + ((lat - bounds.minLat) / latRange) * (height - 2 * paddingY));
    return { x, y };
  };

  const nodePositions = useMemo(() => {
    const map = {};
    NODES_DATA.forEach(node => {
      map[node.id] = { ...node, ...project(node.lat, node.lng) };
    });
    return map;
  }, [bounds]);

  // Interpolate vehicle position along the route
  const vehiclePosition = useMemo(() => {
    if (!simulationMode || !activeRoute || activeRoute.length < 2) return null;
    const segmentsCount = activeRoute.length - 1;
    const clampedFrac = Math.max(0, Math.min(1, progressFraction));
    const rawIndex = clampedFrac * segmentsCount;
    const segIdx = Math.min(segmentsCount - 1, Math.floor(rawIndex));
    const segT = rawIndex - segIdx;

    const fromNode = nodePositions[activeRoute[segIdx]];
    const toNode = nodePositions[activeRoute[segIdx + 1]];
    if (!fromNode || !toNode) return null;

    return {
      x: fromNode.x + segT * (toNode.x - fromNode.x),
      y: fromNode.y + segT * (toNode.y - fromNode.y),
      fromName: fromNode.name,
      toName: toNode.name
    };
  }, [simulationMode, activeRoute, progressFraction, nodePositions]);

  // Check if an edge is part of the highlighted route
  const getEdgeRouteStatus = (fromId, toId) => {
    if (!activeRoute || activeRoute.length < 2) return 'none';
    for (let i = 0; i < activeRoute.length - 1; i++) {
      if (
        (activeRoute[i] === fromId && activeRoute[i + 1] === toId) ||
        (activeRoute[i] === toId && activeRoute[i + 1] === fromId)
      ) {
        if (!simulationMode) return 'active';
        const segmentsCount = activeRoute.length - 1;
        const currentSegment = Math.floor(progressFraction * segmentsCount);
        return i <= currentSegment ? 'completed' : 'upcoming';
      }
    }
    return 'none';
  };

  return (
    <div style={{
      position: 'relative',
      background: 'var(--bg-secondary)',
      borderRadius: '16px',
      border: '1px solid var(--border-color)',
      padding: '1.25rem',
      overflow: 'hidden'
    }}>
      {/* Map Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Compass size={18} style={{ color: 'var(--accent-blue, #0071E3)' }} />
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.02em' }}>
            SPIT Campus & Metro Mobility Network
          </h3>
          {simulationMode ? (
            <span style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3B82F6',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <Car size={12} /> SIMULATED PROGRESS (Dijkstra Waypoints)
            </span>
          ) : (
            <span style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10B981',
              fontWeight: 600
            }}>
              Dijkstra Shortest Path Enabled
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} /> SPIT Campus
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6' }} /> Metro Station
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EC4899' }} /> Railway Hub
          </span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '420px',
            background: 'linear-gradient(135deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.08) 100%)',
            borderRadius: '12px'
          }}
        >
          <defs>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#0071E3" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="vehicleGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid Background Pattern */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border-color)" strokeWidth="0.5" strokeOpacity="0.4" />
          </pattern>
          <rect width={width} height={height} fill="url(#grid)" />

          {/* Road Edges */}
          {EDGES_DATA.map((edge, idx) => {
            const p1 = nodePositions[edge.from];
            const p2 = nodePositions[edge.to];
            if (!p1 || !p2) return null;
            const status = getEdgeRouteStatus(edge.from, edge.to);

            let strokeColor = 'var(--border-color)';
            let strokeWidth = 1.8;
            let strokeDash = 'none';
            let strokeOpacity = 0.45;

            if (status === 'completed') {
              strokeColor = '#10B981';
              strokeWidth = 4.5;
              strokeOpacity = 0.9;
            } else if (status === 'upcoming') {
              strokeColor = '#0071E3';
              strokeWidth = 4.5;
              strokeDash = '6 3';
              strokeOpacity = 0.85;
            } else if (status === 'active') {
              strokeColor = 'url(#routeGradient)';
              strokeWidth = 4.5;
              strokeDash = '6 3';
              strokeOpacity = 1;
            }

            return (
              <line
                key={`edge-${idx}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDash}
                strokeOpacity={strokeOpacity}
                style={{
                  transition: 'all 0.3s ease'
                }}
              />
            );
          })}

          {/* Nodes */}
          {Object.values(nodePositions).map(node => {
            const isPickup = node.id === pickupNodeId;
            const isDropoff = node.id === dropoffNodeId;
            const isInActiveRoute = activeRoute?.includes(node.id);
            const isCampus = node.id === 'spit_main_gate';

            let nodeFill = node.color;
            let nodeRadius = isCampus ? 10 : 7.5;
            if (isPickup) {
              nodeFill = '#10B981';
              nodeRadius = 11;
            } else if (isDropoff) {
              nodeFill = '#EF4444';
              nodeRadius = 11;
            }

            return (
              <g
                key={node.id}
                onClick={() => onSelectNode && onSelectNode(node.id)}
                style={{ cursor: onSelectNode ? 'pointer' : 'default' }}
              >
                {/* Pulse Ring for active/selected nodes */}
                {(isPickup || isDropoff || isCampus) && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={nodeRadius + 6}
                    fill={nodeFill}
                    fillOpacity="0.2"
                  >
                    <animate
                      attributeName="r"
                      values={`${nodeRadius + 2};${nodeRadius + 12};${nodeRadius + 2}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.6;0.1;0.6"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Main Node Circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={nodeRadius}
                  fill={nodeFill}
                  stroke="#FFFFFF"
                  strokeWidth={2.2}
                  filter={isInActiveRoute ? 'url(#glow)' : 'none'}
                />

                {/* Node Label */}
                <text
                  x={node.x}
                  y={node.y + (node.y > height - 40 ? -14 : 18)}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={isCampus || isPickup || isDropoff ? '700' : '600'}
                  fill="var(--text-primary)"
                  style={{
                    pointerEvents: 'none',
                    letterSpacing: '0.01em',
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)'
                  }}
                >
                  {isPickup ? `🟢 Pickup: ${node.name}` : isDropoff ? `🔴 Dropoff: ${node.name}` : node.name}
                </text>
              </g>
            );
          })}

          {/* SIMULATED MOVING VEHICLE MARKER */}
          {vehiclePosition && (
            <g transform={`translate(${vehiclePosition.x}, ${vehiclePosition.y})`} filter="url(#vehicleGlow)">
              <circle r="14" fill="#3B82F6" fillOpacity="0.3">
                <animate attributeName="r" values="12;18;12" dur="1.5s" repeatCount="indefinite" />
              </circle>
              <circle r="10" fill="#1D4ED8" stroke="#FFFFFF" strokeWidth="2" />
              <text textAnchor="middle" dy="3.5" fontSize="10" fill="#FFFFFF">
                🚗
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Dynamic Route Info Legend */}
      <div style={{
        marginTop: '0.85rem',
        padding: '0.75rem 1rem',
        background: 'var(--bg-primary)',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        fontSize: '0.8rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        {simulationMode && vehiclePosition ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#3B82F6', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Car size={14} /> Leg: {vehiclePosition.fromName?.split(' ')[0]} ➔ {vehiclePosition.toName?.split(' ')[0]}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Progress: <strong>{Math.round(progressFraction * 100)}%</strong>
            </span>
            {passengerPickupEtaMins !== null && (
              <span style={{ color: '#10B981', fontWeight: 700 }}>
                Pickup ETA: <strong>{passengerPickupEtaMins === 0 ? 'Arrived!' : `${passengerPickupEtaMins} mins`}</strong>
              </span>
            )}
            {remainingMins !== null && (
              <span style={{ color: 'var(--text-secondary)' }}>
                Destination ETA: <strong>{remainingMins} mins</strong>
              </span>
            )}
          </div>
        ) : activeRoute && activeRoute.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Navigation size={14} style={{ color: '#10B981' }} />
            <span style={{ fontWeight: 600 }}>Active Route Trajectory:</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {activeRoute.map(nid => nodePositions[nid]?.name?.split(' ')[0] || nid).join(' ➔ ')}
            </span>
          </div>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>Select origin and destination to preview shortest road routing.</span>
        )}

        {activeRoute && activeRoute.length > 0 && (
          <span style={{ color: '#10B981', fontWeight: 600 }}>
            {activeRoute.length - 1} connected hops
          </span>
        )}
      </div>
    </div>
  );
}
