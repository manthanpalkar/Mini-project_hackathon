import React, { useMemo, useState } from 'react';
import {
  Compass,
  Navigation,
  Car,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Moon,
  Sun,
  Layers,
  MapPin,
  CheckCircle,
  ArrowRight,
  CornerUpRight,
  Train,
  Building,
  Zap,
  LocateFixed
} from 'lucide-react';

// Geographically calibrated nodes for S.P.I.T. and surrounding transit hubs
const NODES_DATA = [
  { id: 'versova_metro', name: 'Versova Metro (Line 1)', lat: 19.1317, lng: 72.8172, type: 'transit_metro', color: '#0A84FF', shortName: 'Versova Metro', category: 'metro' },
  { id: 'four_bungalows', name: 'Four Bungalows RTO', lat: 19.1278, lng: 72.8256, type: 'hub', color: '#BF5AF2', shortName: '4 Bungalows', category: 'junction' },
  { id: 'dn_nagar_metro', name: 'DN Nagar Interchange', lat: 19.1251, lng: 72.8298, type: 'transit_metro', color: '#0A84FF', shortName: 'DN Nagar Metro', category: 'metro' },
  { id: 'azad_nagar_metro', name: 'Azad Nagar Metro', lat: 19.1298, lng: 72.8363, type: 'transit_metro', color: '#0A84FF', shortName: 'Azad Nagar Metro', category: 'metro' },
  { id: 'spit_main_gate', name: 'S.P.I.T. Main Gate', lat: 19.1232, lng: 72.8361, type: 'campus_core', color: '#30D158', shortName: 'S.P.I.T. Campus', category: 'campus' },
  { id: 'bhavans_lake', name: 'Bhavans Lake North Gate', lat: 19.1245, lng: 72.8375, type: 'campus_perimeter', color: '#30D158', shortName: 'Bhavans Lake Gate', category: 'campus' },
  { id: 'amboli_phatak', name: 'Amboli Phatak Crossing', lat: 19.1211, lng: 72.8423, type: 'corridor', color: '#FF9F0A', shortName: 'Amboli Crossing', category: 'junction' },
  { id: 'andheri_station_west', name: 'Andheri Station (West)', lat: 19.1197, lng: 72.8464, type: 'transit_hub', color: '#FF375F', shortName: 'Andheri Station', category: 'railway' },
  { id: 'cooper_hospital', name: 'Cooper Hospital Junction', lat: 19.1152, lng: 72.8398, type: 'corridor', color: '#FF9F0A', shortName: 'Cooper Hospital', category: 'junction' },
  { id: 'jvpd_circle', name: 'JVPD Circle Juhu', lat: 19.1105, lng: 72.8302, type: 'corridor', color: '#5E5CE6', shortName: 'JVPD Circle', category: 'junction' }
];

const EDGES_DATA = [
  { from: 'andheri_station_west', to: 'amboli_phatak', roadName: 'Caesar Rd / Station Approach' },
  { from: 'amboli_phatak', to: 'bhavans_lake', roadName: 'Bhavans Campus Rd' },
  { from: 'bhavans_lake', to: 'spit_main_gate', roadName: 'Campus Internal Link' },
  { from: 'andheri_station_west', to: 'cooper_hospital', roadName: 'S.V. Road' },
  { from: 'cooper_hospital', to: 'jvpd_circle', roadName: 'Gulmohar Rd' },
  { from: 'cooper_hospital', to: 'spit_main_gate', roadName: 'Munshi Nagar Rd' },
  { from: 'jvpd_circle', to: 'dn_nagar_metro', roadName: 'Juhu-Versova Link Rd' },
  { from: 'dn_nagar_metro', to: 'four_bungalows', roadName: 'J.P. Road (Metro L1)' },
  { from: 'four_bungalows', to: 'versova_metro', roadName: 'J.P. Road (Metro L1)' },
  { from: 'dn_nagar_metro', to: 'azad_nagar_metro', roadName: 'Link Rd Corridor' },
  { from: 'dn_nagar_metro', to: 'spit_main_gate', roadName: 'Dadabhai Rd' },
  { from: 'azad_nagar_metro', to: 'spit_main_gate', roadName: 'Bhavans College Rd' },
  { from: 'azad_nagar_metro', to: 'bhavans_lake', roadName: 'Lake Approach Rd' },
  { from: 'versova_metro', to: 'dn_nagar_metro', roadName: 'Metro 1 Expressway' }
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
  const [mapTheme, setMapTheme] = useState('light'); // 'dark' | 'light'
  const [zoomLevel, setZoomLevel] = useState(1); // 0.85, 1, 1.25, 1.5
  const [showTraffic, setShowTraffic] = useState(true);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState(null);

  // SVG Base Canvas Dimensions
  const baseWidth = 840;
  const baseHeight = 490;
  const paddingX = 90;
  const paddingY = 70;

  // Geographic bounds with calibrated margins for coast on west & railway on east
  const bounds = useMemo(() => ({
    minLat: 19.1080,
    maxLat: 19.1340,
    minLng: 72.8130,
    maxLng: 72.8495
  }), []);

  // Standard Mercator-like 2D projection
  const project = (lat, lng) => {
    const latRange = bounds.maxLat - bounds.minLat || 1;
    const lngRange = bounds.maxLng - bounds.minLng || 1;
    const x = paddingX + ((lng - bounds.minLng) / lngRange) * (baseWidth - 2 * paddingX);
    const y = baseHeight - (paddingY + ((lat - bounds.minLat) / latRange) * (baseHeight - 2 * paddingY));
    return { x, y };
  };

  const nodePositions = useMemo(() => {
    const map = {};
    NODES_DATA.forEach(node => {
      map[node.id] = { ...node, ...project(node.lat, node.lng) };
    });
    return map;
  }, [bounds]);

  // Projected coastal shoreline points (Arabian Sea / Versova Beach on West)
  const coastalPath = useMemo(() => {
    const p1 = project(19.1350, 72.8130);
    const p2 = project(19.1310, 72.8145);
    const p3 = project(19.1260, 72.8160);
    const p4 = project(19.1200, 72.8180);
    const p5 = project(19.1140, 72.8195);
    const p6 = project(19.1070, 72.8210);
    return `M 0 0 L ${p1.x} 0 Q ${p2.x} ${p2.y} ${p3.x} ${p3.y} T ${p4.x} ${p4.y} T ${p5.x} ${p5.y} T ${p6.x} ${baseHeight} L 0 ${baseHeight} Z`;
  }, [bounds]);

  // Bhavan's Lake polygon coordinates
  const lakeShape = useMemo(() => {
    const center = project(19.1240, 72.8372);
    return {
      cx: center.x,
      cy: center.y,
      rx: 34,
      ry: 22
    };
  }, [bounds]);

  // Bhavan's Educational Campus Park zone
  const campusZone = useMemo(() => {
    const p1 = project(19.1258, 72.8342);
    const p2 = project(19.1256, 72.8395);
    const p3 = project(19.1215, 72.8390);
    const p4 = project(19.1218, 72.8340);
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z`;
  }, [bounds]);

  // Railway line path on East (Andheri Station West)
  const railwayPath = useMemo(() => {
    const pTop = project(19.1340, 72.8475);
    const pStation = project(19.1197, 72.8464);
    const pBottom = project(19.1070, 72.8455);
    return `M ${pTop.x} ${pTop.y} L ${pStation.x} ${pStation.y} L ${pBottom.x} ${pBottom.y}`;
  }, [bounds]);

  // Metro Line 1 elevated transit line (Versova -> 4 Bungalows -> DN Nagar -> Azad Nagar -> Andheri)
  const metroLine1Path = useMemo(() => {
    const pVersova = nodePositions['versova_metro'];
    const p4Bung = nodePositions['four_bungalows'];
    const pDN = nodePositions['dn_nagar_metro'];
    const pAzad = nodePositions['azad_nagar_metro'];
    const pAndheri = nodePositions['andheri_station_west'];
    if (!pVersova || !p4Bung || !pDN || !pAzad || !pAndheri) return '';
    return `M ${pVersova.x} ${pVersova.y} L ${p4Bung.x} ${p4Bung.y} L ${pDN.x} ${pDN.y} L ${pAzad.x} ${pAzad.y} L ${pAndheri.x} ${pAndheri.y - 12}`;
  }, [nodePositions]);

  // Secondary city street grid lines for authentic Apple Maps cartography
  const streetGridLines = useMemo(() => {
    const lines = [];
    // Cross streets in Andheri West / Juhu
    for (let lat = 19.1120; lat <= 19.1330; lat += 0.0035) {
      const start = project(lat, 72.8170);
      const end = project(lat, 72.8460);
      lines.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    }
    for (let lng = 72.8220; lng <= 72.8440; lng += 0.0050) {
      const start = project(19.1100, lng);
      const end = project(19.1320, lng);
      lines.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    }
    return lines;
  }, [bounds]);

  // Vehicle position interpolation for simulation
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

    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    return {
      x: fromNode.x + segT * dx,
      y: fromNode.y + segT * dy,
      angle: angleDeg,
      fromName: fromNode.shortName,
      toName: toNode.shortName
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

  // Build active trajectory continuous path
  const activeRoutePolyline = useMemo(() => {
    if (!activeRoute || activeRoute.length < 2) return '';
    return activeRoute
      .map(id => nodePositions[id])
      .filter(Boolean)
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');
  }, [activeRoute, nodePositions]);

  // Dynamic Apple Maps Theme Colors
  const isDark = mapTheme === 'dark';
  const theme = {
    canvasBg: isDark ? '#151C28' : '#FFFFFF',
    landColor: isDark ? '#1A2332' : '#F4F6F9',
    waterColor: isDark ? '#102238' : '#CCE3F9',
    waterBorder: isDark ? '#183658' : '#B0D3F8',
    parkColor: isDark ? 'rgba(48, 209, 88, 0.12)' : '#D7F5E4',
    parkBorder: isDark ? '#1E4633' : '#86EFAC',
    lakeColor: isDark ? '#0E3E4A' : '#BCE0FD',
    lakeBorder: isDark ? '#155B6C' : '#60A5FA',
    minorStreet: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)',
    metroLine: isDark ? '#0284C7' : '#0284C7',
    railwayLine: isDark ? '#475569' : '#64748B',
    edgeCasing: isDark ? '#1E293B' : '#CBD5E1',
    edgeFill: isDark ? '#334155' : '#FFFFFF',
    textPrimary: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    panelBg: isDark ? 'rgba(21, 28, 40, 0.88)' : 'rgba(255, 255, 255, 0.94)',
    panelBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'
  };

  // Zoom viewBox computation
  const viewBoxWidth = baseWidth / zoomLevel;
  const viewBoxHeight = baseHeight / zoomLevel;
  const viewBoxX = (baseWidth - viewBoxWidth) / 2;
  const viewBoxY = (baseHeight - viewBoxHeight) / 2;

  return (
    <div
      style={{
        position: 'relative',
        background: theme.canvasBg,
        borderRadius: '22px',
        border: `1px solid ${theme.panelBorder}`,
        boxShadow: isDark
          ? '0 20px 40px -15px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)'
          : '0 20px 40px -15px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
        padding: '1.25rem',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif',
        transition: 'all 0.3s ease'
      }}
    >
      {/* 1. APPLE MAPS FLOATING TOP HEADER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.85rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
          position: 'relative',
          zIndex: 10
        }}
      >
        {/* Title with Cupertino pill styling */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0A84FF 0%, #0056B3 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(10, 132, 255, 0.35)'
            }}
          >
            <Compass size={18} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '0.98rem',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: theme.textPrimary
                }}
              >
                SPIT Campus & Metro Mobility Network
              </h3>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: isDark ? 'rgba(10, 132, 255, 0.2)' : 'rgba(10, 132, 255, 0.1)',
                  color: '#0A84FF',
                  border: '1px solid rgba(10, 132, 255, 0.3)'
                }}
              >
                Apple Maps UI
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginTop: '2px' }}>
              Andheri West • Versova • Bhavan's Educational Precinct
            </div>
          </div>
        </div>

        {/* Apple Maps Floating Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Live Traffic Pill */}
          <button
            onClick={() => setShowTraffic(!showTraffic)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '5px 10px',
              borderRadius: '20px',
              border: `1px solid ${theme.panelBorder}`,
              background: theme.panelBg,
              backdropFilter: 'blur(20px)',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: theme.textPrimary,
              cursor: 'pointer'
            }}
            title="Toggle Live Traffic Layer"
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: showTraffic ? '#30D158' : '#8E8E93',
                boxShadow: showTraffic ? '0 0 8px #30D158' : 'none'
              }}
            />
            {showTraffic ? 'Live Traffic: Flowing' : 'Traffic Off'}
          </button>

          {/* Map Theme Toggle */}
          <button
            onClick={() => setMapTheme(isDark ? 'light' : 'dark')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '5px 10px',
              borderRadius: '20px',
              border: `1px solid ${theme.panelBorder}`,
              background: theme.panelBg,
              backdropFilter: 'blur(20px)',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: theme.textPrimary,
              cursor: 'pointer'
            }}
            title="Switch Map Appearance"
          >
            {isDark ? <Sun size={13} color="#FF9F0A" /> : <Moon size={13} color="#5E5CE6" />}
            {isDark ? 'Dark Nav' : 'Light Nav'}
          </button>

          {/* Zoom Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: theme.panelBg,
              backdropFilter: 'blur(20px)',
              borderRadius: '20px',
              border: `1px solid ${theme.panelBorder}`,
              overflow: 'hidden'
            }}
          >
            <button
              onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.25))}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '5px 8px',
                color: theme.textPrimary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(0.85, prev - 0.25))}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '5px 8px',
                color: theme.textPrimary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '5px 8px',
                color: theme.textPrimary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Recenter"
            >
              <LocateFixed size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN SVG APPLE MAPS CANVAS */}
      <div
        style={{
          width: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          position: 'relative',
          background: theme.landColor,
          border: `1px solid ${theme.panelBorder}`
        }}
      >
        <svg
          viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
          style={{
            width: '100%',
            height: 'auto',
            minHeight: '430px',
            maxHeight: '490px',
            display: 'block',
            transition: 'viewBox 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <defs>
            {/* Apple Maps Signature Navigation Gradient */}
            <linearGradient id="appleNavGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0A84FF" />
              <stop offset="60%" stopColor="#00C7FF" />
              <stop offset="100%" stopColor="#30D158" />
            </linearGradient>

            {/* Apple Maps Completed Route Gradient */}
            <linearGradient id="appleCompletedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#30D158" />
              <stop offset="100%" stopColor="#34C759" />
            </linearGradient>

            {/* Apple Maps Intense Neon Blur Glow */}
            <filter id="navGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Turn Marker Outer Aura */}
            <filter id="pinAura" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Vehicle Headlights Beam */}
            <radialGradient id="headlightBeam" cx="10%" cy="50%" r="80%">
              <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </radialGradient>

            {/* Railway Hatch Pattern */}
            <pattern id="railwayHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke={theme.railwayLine} strokeWidth="2" />
            </pattern>
          </defs>

          {/* --- LAYER 1: BASE LANDMASS & WATER BODIES --- */}
          {/* Base Landmass */}
          <rect x="0" y="0" width={baseWidth} height={baseHeight} fill={theme.landColor} />

          {/* Arabian Sea / Coastline on West */}
          <path d={coastalPath} fill={theme.waterColor} stroke={theme.waterBorder} strokeWidth="2.5" />
          <text
            x={project(19.1280, 72.8138).x}
            y={project(19.1280, 72.8138).y}
            fill={isDark ? '#2D5B88' : '#7BB4E8'}
            fontSize="10"
            fontWeight="700"
            letterSpacing="0.1em"
            transform={`rotate(-75, ${project(19.1280, 72.8138).x}, ${project(19.1280, 72.8138).y})`}
          >
            ARABIAN SEA (VERSOVA COAST)
          </text>

          {/* Bhavan's Educational Campus Park Area */}
          <path d={campusZone} fill={theme.parkColor} stroke={theme.parkBorder} strokeWidth="1.5" strokeDasharray="5 3" />
          <text
            x={project(19.1248, 72.8350).x}
            y={project(19.1248, 72.8350).y}
            fill={isDark ? '#30D158' : '#15803D'}
            fontSize="9"
            fontWeight="700"
            letterSpacing="0.06em"
          >
            BHAVAN'S CAMPUS PRECINCT
          </text>

          {/* Bhavan's Lake */}
          <ellipse
            cx={lakeShape.cx}
            cy={lakeShape.cy}
            rx={lakeShape.rx}
            ry={lakeShape.ry}
            fill={theme.lakeColor}
            stroke={theme.lakeBorder}
            strokeWidth="2"
          />
          <text
            x={lakeShape.cx}
            y={lakeShape.cy + 3}
            fill={isDark ? '#5EEAD4' : '#0369A1'}
            fontSize="8.5"
            fontWeight="700"
            textAnchor="middle"
            letterSpacing="0.04em"
          >
            Bhavan's Lake
          </text>

          {/* --- LAYER 2: URBAN STREET GRID & MINOR ROADS --- */}
          {streetGridLines.map((line, idx) => (
            <line
              key={`grid-line-${idx}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={theme.minorStreet}
              strokeWidth="1.4"
            />
          ))}

          {/* Western Railway Tracks on East */}
          <path d={railwayPath} stroke={theme.railwayLine} strokeWidth="6" strokeLinecap="round" />
          <path d={railwayPath} stroke="url(#railwayHatch)" strokeWidth="5" />
          <text
            x={project(19.1280, 72.8480).x}
            y={project(19.1280, 72.8480).y}
            fill={theme.textSecondary}
            fontSize="8"
            fontWeight="700"
            transform={`rotate(85, ${project(19.1280, 72.8480).x}, ${project(19.1280, 72.8480).y})`}
          >
            WESTERN RAILWAY MAINLINE
          </text>

          {/* Metro Line 1 Elevated Viaduct */}
          {metroLine1Path && (
            <g opacity={0.85}>
              <path
                d={metroLine1Path}
                fill="none"
                stroke={theme.metroLine}
                strokeWidth="4"
                strokeDasharray="8 4"
                strokeLinecap="round"
              />
              <path
                d={metroLine1Path}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="1.2"
                strokeDasharray="2 10"
              />
            </g>
          )}

          {/* --- LAYER 3: ALL ROAD CORRIDORS (GRAPH EDGES) --- */}
          {/* Base Road Casings - Ensures HIGH VISIBILITY even when inactive */}
          {EDGES_DATA.map((edge, idx) => {
            const p1 = nodePositions[edge.from];
            const p2 = nodePositions[edge.to];
            if (!p1 || !p2) return null;
            const status = getEdgeRouteStatus(edge.from, edge.to);

            return (
              <g key={`edge-casing-${idx}`}>
                {/* Outer Road Casing */}
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={theme.edgeCasing}
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Inner Road Bed */}
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={theme.edgeFill}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
                {/* Traffic indicator on non-active edges */}
                {showTraffic && status === 'none' && (
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="rgba(48, 209, 88, 0.5)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                )}
              </g>
            );
          })}

          {/* --- LAYER 4: ACTIVE NAVIGATION ROUTE TRAJECTORY (APPLE MAPS TURN-BY-TURN) --- */}
          {activeRoutePolyline && (
            <g>
              {/* Layer 4A: Outer Atmospheric Blue/Cyan Glow */}
              <path
                d={activeRoutePolyline}
                fill="none"
                stroke="#00F0FF"
                strokeWidth="18"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isDark ? 0.45 : 0.28}
                filter="url(#navGlow)"
              />

              {/* Layer 4B: Signature Navigation Beam */}
              <path
                d={activeRoutePolyline}
                fill="none"
                stroke={simulationMode ? 'url(#appleCompletedGradient)' : 'url(#appleNavGradient)'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Layer 4C: Crisp Inner White Core Runner */}
              <path
                d={activeRoutePolyline}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
              />

              {/* Layer 4D: Traveling Chevron Flow Animation */}
              <path
                d={activeRoutePolyline}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="3.5"
                strokeDasharray="6 22"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.8}
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="56"
                  to="0"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          )}

          {/* --- LAYER 5: INTERACTIVE GRAPH NODES & APPLE MAPS PINS --- */}
          {Object.values(nodePositions).map(node => {
            const isPickup = node.id === pickupNodeId;
            const isDropoff = node.id === dropoffNodeId;
            const isInActiveRoute = activeRoute?.includes(node.id);
            const isCampus = node.id === 'spit_main_gate';

            // Pin styling
            let pinColor = node.color;
            let pinRadius = isCampus ? 11 : 8.5;
            if (isPickup) {
              pinColor = '#30D158'; // Apple Maps vibrant green
              pinRadius = 13;
            } else if (isDropoff) {
              pinColor = '#FF453A'; // Apple Maps vibrant red
              pinRadius = 13;
            }

            return (
              <g
                key={node.id}
                onClick={() => {
                  setSelectedNodeDetails(node);
                  if (onSelectNode) onSelectNode(node.id);
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* Pulsing Radar Wave on active / pickup / dropoff / campus nodes */}
                {(isPickup || isDropoff || isCampus || isInActiveRoute) && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={pinRadius + 7}
                    fill={pinColor}
                    fillOpacity={0.25}
                  >
                    <animate
                      attributeName="r"
                      values={`${pinRadius + 4};${pinRadius + 18};${pinRadius + 4}`}
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.7;0.1;0.7"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Node Outer Drop Shadow / Halo */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={pinRadius + 2.5}
                  fill={isDark ? '#000000' : '#FFFFFF'}
                  fillOpacity={0.65}
                />

                {/* Main Node Body */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={pinRadius}
                  fill={pinColor}
                  stroke="#FFFFFF"
                  strokeWidth="2.8"
                  filter={isInActiveRoute ? 'url(#pinAura)' : 'none'}
                />

                {/* Inner Icon / Glyph */}
                {isCampus ? (
                  <circle cx={node.x} cy={node.y} r="4" fill="#FFFFFF" />
                ) : isPickup ? (
                  <circle cx={node.x} cy={node.y} r="4.5" fill="#FFFFFF" />
                ) : isDropoff ? (
                  <circle cx={node.x} cy={node.y} r="4.5" fill="#FFFFFF" />
                ) : node.category === 'metro' ? (
                  <circle cx={node.x} cy={node.y} r="3" fill="#FFFFFF" />
                ) : (
                  <circle cx={node.x} cy={node.y} r="2.5" fill="#FFFFFF" />
                )}

                {/* Apple Maps Callout Bubble for Pickup / Dropoff */}
                {isPickup && (
                  <g transform={`translate(${node.x}, ${node.y - 28})`}>
                    <rect
                      x="-48"
                      y="-12"
                      width="96"
                      height="22"
                      rx="11"
                      fill="#30D158"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                    <text
                      x="0"
                      y="3.5"
                      fill="#FFFFFF"
                      fontSize="9.5"
                      fontWeight="800"
                      textAnchor="middle"
                      letterSpacing="0.02em"
                    >
                      🟢 PICKUP
                    </text>
                  </g>
                )}

                {isDropoff && (
                  <g transform={`translate(${node.x}, ${node.y - 28})`}>
                    <rect
                      x="-52"
                      y="-12"
                      width="104"
                      height="22"
                      rx="11"
                      fill="#FF453A"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                    <text
                      x="0"
                      y="3.5"
                      fill="#FFFFFF"
                      fontSize="9.5"
                      fontWeight="800"
                      textAnchor="middle"
                      letterSpacing="0.02em"
                    >
                      🔴 DROPOFF
                    </text>
                  </g>
                )}

                {/* Apple Maps Permanent Street Label */}
                {!isPickup && !isDropoff && (
                  <g transform={`translate(${node.x}, ${node.y + (node.y > baseHeight - 45 ? -18 : 20)})`}>
                    <rect
                      x={-(node.shortName.length * 3.4 + 8)}
                      y="-9"
                      width={node.shortName.length * 6.8 + 16}
                      height="18"
                      rx="9"
                      fill={isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)'}
                      stroke={isInActiveRoute ? '#0A84FF' : theme.panelBorder}
                      strokeWidth={isInActiveRoute ? '1.5' : '0.8'}
                    />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight={isCampus || isInActiveRoute ? '800' : '600'}
                      fill={isInActiveRoute ? '#0A84FF' : theme.textPrimary}
                      letterSpacing="0.01em"
                    >
                      {node.shortName}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* --- LAYER 6: SIMULATED MOVING VEHICLE (LIVE IN-TRANSIT) --- */}
          {vehiclePosition && (
            <g transform={`translate(${vehiclePosition.x}, ${vehiclePosition.y}) rotate(${vehiclePosition.angle})`}>
              {/* Headlights casting forward beam */}
              <polygon
                points="12,-8 48,-24 48,24 12,8"
                fill="url(#headlightBeam)"
                opacity="0.85"
              />

              {/* Pulsing Radar Wave */}
              <circle r="18" fill="#0A84FF" fillOpacity="0.3">
                <animate attributeName="r" values="14;24;14" dur="1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0.1;0.8" dur="1.2s" repeatCount="indefinite" />
              </circle>

              {/* 3D-styled Vehicle Marker Body */}
              <rect
                x="-14"
                y="-9"
                width="28"
                height="18"
                rx="6"
                fill="#0056B3"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                filter="url(#pinAura)"
              />
              <circle cx="5" cy="0" r="3" fill="#60A5FA" />
              <rect x="-8" y="-6" width="6" height="12" rx="2" fill="#93C5FD" opacity="0.9" />

              {/* Vehicle Badge Icon */}
              <text textAnchor="middle" dy="3.5" dx="-1" fontSize="10" fill="#FFFFFF">
                🚗
              </text>
            </g>
          )}
        </svg>

        {/* Selected Node Inspector Flyout */}
        {selectedNodeDetails && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              background: theme.panelBg,
              backdropFilter: 'blur(25px)',
              border: `1px solid ${theme.panelBorder}`,
              borderRadius: '16px',
              padding: '0.85rem 1.1rem',
              boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
              maxWidth: '300px',
              zIndex: 20
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: theme.textPrimary }}>
                {selectedNodeDetails.name}
              </span>
              <button
                onClick={() => setSelectedNodeDetails(null)}
                style={{ background: 'transparent', border: 'none', color: theme.textSecondary, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>
              Type: <strong>{selectedNodeDetails.category.toUpperCase()}</strong> • Coordinates: {selectedNodeDetails.lat.toFixed(4)}, {selectedNodeDetails.lng.toFixed(4)}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {onSelectNode && (
                <button
                  onClick={() => onSelectNode(selectedNodeDetails.id)}
                  style={{
                    background: '#0A84FF',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Set as Waypoint
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. APPLE MAPS CARPLAY-STYLE TURN-BY-TURN GUIDANCE BAR */}
      <div
        style={{
          marginTop: '0.85rem',
          padding: '0.95rem 1.25rem',
          background: theme.panelBg,
          backdropFilter: 'blur(30px)',
          borderRadius: '18px',
          border: `1px solid ${theme.panelBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: isDark
            ? '0 10px 25px rgba(0,0,0,0.4)'
            : '0 10px 25px rgba(0,0,0,0.05)'
        }}
      >
        {/* Left: Maneuver Icon & Waypoint Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: '260px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: simulationMode
                ? 'linear-gradient(135deg, #30D158 0%, #15803D 100%)'
                : 'linear-gradient(135deg, #0A84FF 0%, #0056B3 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: simulationMode
                ? '0 4px 15px rgba(48, 209, 88, 0.4)'
                : '0 4px 15px rgba(10, 132, 255, 0.4)',
              color: '#FFFFFF',
              flexShrink: 0
            }}
          >
            {simulationMode ? <Car size={20} /> : <CornerUpRight size={20} />}
          </div>

          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {simulationMode ? (
                <span>Trip in Progress • {vehiclePosition?.fromName} ➔ {vehiclePosition?.toName}</span>
              ) : activeRoute && activeRoute.length > 0 ? (
                <span>Optimal Route Trajectory ({activeRoute.length - 1} hops)</span>
              ) : (
                <span>Campus Navigation Ready</span>
              )}
            </div>

            <div style={{ fontSize: '0.74rem', color: theme.textSecondary, marginTop: '2px' }}>
              {activeRoute && activeRoute.length > 0 ? (
                activeRoute.map(nid => nodePositions[nid]?.shortName || nid).join(' ➔ ')
              ) : (
                'Select origin & destination to calculate Dijkstra road path.'
              )}
            </div>
          </div>
        </div>

        {/* Right: Apple Maps CarPlay ETA Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {simulationMode && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: theme.textSecondary, fontWeight: 700 }}>
                Progress
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#30D158' }}>
                {Math.round(progressFraction * 100)}%
              </div>
            </div>
          )}

          {passengerPickupEtaMins !== null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: theme.textSecondary, fontWeight: 700 }}>
                Pickup ETA
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0A84FF' }}>
                {passengerPickupEtaMins === 0 ? 'Arrived!' : `${passengerPickupEtaMins}m`}
              </div>
            </div>
          )}

          {remainingMins !== null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: theme.textSecondary, fontWeight: 700 }}>
                Destination ETA
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: theme.textPrimary }}>
                {remainingMins} min
              </div>
            </div>
          )}

          {activeRoute && activeRoute.length > 0 && !simulationMode && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '6px 12px',
                borderRadius: '12px',
                background: isDark ? 'rgba(48, 209, 88, 0.15)' : 'rgba(52, 199, 89, 0.15)',
                color: isDark ? '#30D158' : '#15803D',
                fontWeight: 800,
                fontSize: '0.78rem'
              }}
            >
              <Zap size={14} />
              <span>Dijkstra Shortest Path</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
