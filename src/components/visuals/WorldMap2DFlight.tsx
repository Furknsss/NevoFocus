import React, { useState, useEffect, useMemo } from 'react';
import {
  Plane,
  Navigation,
  Compass,
  MapPin,
  Maximize2,
  Gauge,
  Minimize2,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { FlightAirport } from '../../types';
import { ALL_AIRPORTS, TURKEY_AIRPORTS, WORLD_AIRPORTS } from '../../utils/airports';

interface WorldMap2DFlightProps {
  origin: FlightAirport;
  destination: FlightAirport;
  progress: number; // 0 to 1
  isFlightActive?: boolean;
  onSelectAirports?: (origin: FlightAirport, destination: FlightAirport) => void;
  onCompleteLanding?: () => void;
}

/**
 * High-definition, smooth equirectangular projection mapping geographic (lat, lng) to (0..1600, 0..900)
 * Longitude: -180..+180 -> 0..1600
 * Latitude: +82..-70 -> 0..900
 */
function geoToMapCoords(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * 1600;
  const clampedLat = Math.max(-70, Math.min(82, lat));
  // Mercator-like smoothed latitude scaling
  const y = ((82 - clampedLat) / 152) * 900;
  return { x, y };
}

// Crisp, stylized, modern vector continents designed for clear visual aesthetics
const MAP_CONTINENTS = [
  // Europe, Scandinavia & Anatolia
  {
    id: 'europe',
    name: 'Avrupa & Anadolu',
    d: `M 780 150 Q 820 130 870 140 Q 910 160 930 200 Q 940 230 920 260 
        Q 890 280 910 300 Q 960 290 980 310 Q 950 330 900 325 Q 870 335 845 320 
        Q 820 330 790 320 Q 765 305 750 285 Q 740 240 760 210 Q 770 180 780 150 Z 
        M 900 295 Q 945 295 985 305 Q 970 325 930 320 Q 900 310 900 295 Z`,
  },
  // Great Britain & Ireland
  {
    id: 'uk_ireland',
    name: 'Birleşik Krallık',
    d: `M 765 175 Q 785 165 780 195 Q 765 210 758 195 Z M 750 185 Q 760 185 755 200 Q 745 195 750 185 Z`,
  },
  // Scandinavia
  {
    id: 'scandinavia',
    name: 'İskandinavya',
    d: `M 805 100 Q 845 90 870 115 Q 855 150 830 175 Q 815 150 805 100 Z`,
  },
  // Asia & Siberia & East Asia
  {
    id: 'asia',
    name: 'Asya',
    d: `M 940 150 Q 1100 110 1300 120 Q 1460 130 1480 180 Q 1400 230 1370 280 
        Q 1320 330 1260 345 Q 1200 380 1140 345 Q 1080 310 1050 280 Q 1000 260 980 220 
        Q 960 180 940 150 Z 
        M 1160 350 Q 1220 340 1245 390 Q 1210 455 1165 420 Q 1150 380 1160 350 Z
        M 1355 275 Q 1405 260 1435 295 Q 1410 335 1370 320 Z`,
  },
  // Japan Archipelago
  {
    id: 'japan',
    name: 'Japonya',
    d: `M 1410 260 Q 1430 250 1440 280 Q 1425 310 1405 290 Z M 1435 230 Q 1445 225 1450 245 Q 1438 255 1435 230 Z`,
  },
  // Middle East & Arabian Peninsula
  {
    id: 'middle_east',
    name: 'Orta Doğu',
    d: `M 960 320 Q 1015 325 1045 360 Q 1030 425 990 430 Q 970 405 960 360 Z`,
  },
  // Africa
  {
    id: 'africa',
    name: 'Afrika',
    d: `M 765 330 Q 845 320 935 340 Q 970 400 995 470 Q 960 580 925 660 
        Q 885 730 860 690 Q 830 600 790 500 Q 735 420 755 355 Z 
        M 995 580 Q 1020 570 1010 645 Q 995 635 995 580 Z`,
  },
  // North America
  {
    id: 'north_america',
    name: 'Kuzey Amerika',
    d: `M 240 110 Q 420 100 560 125 Q 610 190 550 260 Q 495 310 450 360 
        Q 410 395 385 370 Q 345 345 320 295 Q 255 245 210 190 Q 200 135 240 110 Z 
        M 580 70 Q 670 60 685 115 Q 640 155 590 130 Z`,
  },
  // South America
  {
    id: 'south_america',
    name: 'Güney Amerika',
    d: `M 430 390 Q 500 380 560 440 Q 600 510 570 600 Q 520 710 480 780 
        Q 450 750 450 660 Q 435 575 420 495 Q 410 430 430 390 Z`,
  },
  // Australia
  {
    id: 'australia',
    name: 'Avustralya',
    d: `M 1275 560 Q 1370 545 1435 585 Q 1460 640 1405 690 Q 1325 700 1275 650 Q 1250 600 1275 560 Z`,
  },
];

export const WorldMap2DFlight: React.FC<WorldMap2DFlightProps> = ({
  origin,
  destination,
  progress,
  isFlightActive = false,
  onSelectAirports,
  onCompleteLanding,
}) => {
  const [isWideView, setIsWideView] = useState(false);
  const [showTouchdownBanner, setShowTouchdownBanner] = useState(false);
  const [isQuickSelectorOpen, setIsQuickSelectorOpen] = useState(false);

  // Geographic coordinates for departure and arrival airports
  const origCoord = useMemo(() => geoToMapCoords(origin.lat, origin.lng), [origin]);
  const destCoord = useMemo(() => geoToMapCoords(destination.lat, destination.lng), [destination]);

  // Compute Bezier flight arc, tangent direction & dynamic camera tracking
  const flightCalculations = useMemo(() => {
    const x1 = origCoord.x;
    const y1 = origCoord.y;
    const x2 = destCoord.x;
    const y2 = destCoord.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);

    // Natural geodesic arc lofting above the direct flight line
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const arcHeight = Math.max(30, Math.min(130, dist * 0.2));
    const cx = midX;
    const cy = Math.max(35, midY - arcHeight);

    // Current position of the plane along the quadratic Bezier at progress t (0 to 1)
    const t = Math.max(0, Math.min(1, progress));
    const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
    const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;

    // Heading direction tangent derivative: dx/dt, dy/dt
    const tangentX = 2 * (1 - t) * (cx - x1) + 2 * t * (x2 - cx);
    const tangentY = 2 * (1 - t) * (cy - y1) + 2 * t * (y2 - cy);
    const angleRad = Math.atan2(tangentY, tangentX);
    const deg = (angleRad * 180) / Math.PI;

    // Calculate real distances
    const dKm = Math.round(
      Math.hypot(destination.lat - origin.lat, destination.lng - origin.lng) * 111.3
    );
    const dNm = Math.round(dKm * 0.539957);

    // 3 Aviation Navigation Waypoints along the airway
    const waypoints = [0.25, 0.5, 0.75].map((frac, idx) => {
      const wx = (1 - frac) * (1 - frac) * x1 + 2 * (1 - frac) * frac * cx + frac * frac * x2;
      const wy = (1 - frac) * (1 - frac) * y1 + 2 * (1 - frac) * frac * cy + frac * frac * y2;
      return { id: `NAV-${idx + 1}`, x: wx, y: wy };
    });

    // Dynamic Camera Tracking Frame (Zooms comfortably on the flight corridor)
    let vbX = 0;
    let vbY = 0;
    let vbW = 1600;
    let vbH = 900;

    if (!isWideView) {
      const minX = Math.min(x1, x2, px);
      const maxX = Math.max(x1, x2, px);
      const minY = Math.min(y1, y2, cy, py);
      const maxY = Math.max(y1, y2, py);

      const spanX = Math.max(360, maxX - minX + 220);
      const spanY = Math.max(220, maxY - minY + 180);

      // 16:9 view ratio
      const targetW = Math.max(spanX, spanY * (16 / 9));
      const targetH = targetW * (9 / 16);

      const centerX = px * 0.65 + ((x1 + x2) / 2) * 0.35;
      const centerY = py * 0.65 + ((y1 + y2) / 2) * 0.35;

      vbX = Math.max(0, Math.min(1600 - targetW, centerX - targetW / 2));
      vbY = Math.max(0, Math.min(900 - targetH, centerY - targetH / 2));
      vbW = targetW;
      vbH = targetH;
    }

    return {
      controlPt: { x: cx, y: cy },
      currentPos: { x: px, y: py },
      headingDeg: deg,
      distanceKm: Math.max(450, dKm),
      distanceNm: Math.max(240, dNm),
      viewBox: `${vbX} ${vbY} ${vbW} ${vbH}`,
      waypoints,
      fullPathD: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,
    };
  }, [origCoord, destCoord, progress, origin, destination, isWideView]);

  // Handle landing / touchdown when progress reaches completion
  useEffect(() => {
    if (progress >= 0.985) {
      setShowTouchdownBanner(true);
    } else {
      setShowTouchdownBanner(false);
    }
  }, [progress]);

  // Telemetry Calculations
  const completedKm = Math.round(flightCalculations.distanceKm * progress);
  const remainingKm = Math.max(0, flightCalculations.distanceKm - completedKm);
  const remainingNm = Math.round(remainingKm * 0.539957);

  // Altitude (Climb smoothly to FL360 then glide down for touchdown)
  const isTouchdown = progress >= 0.985;
  const currentAltitudeFeet = progress <= 0.02 || isTouchdown
    ? 0
    : Math.round(36000 * Math.sin(Math.max(0.04, Math.min(0.96, progress)) * Math.PI));

  // Ground speed
  const currentSpeedKnots = isFlightActive
    ? isTouchdown
      ? 0
      : progress >= 0.92
      ? 160
      : 480
    : 0;
  const currentSpeedKmh = Math.round(currentSpeedKnots * 1.852);
  const flightLevel = Math.round(currentAltitudeFeet / 100);
  const headingNorm = Math.round((flightCalculations.headingDeg + 360) % 360);
  const flightCode = `TK-${Math.abs((origin.code.charCodeAt(0) * 31 + destination.code.charCodeAt(0) * 17) % 900) + 100}`;

  // Popular quick flight routes
  const QUICK_ROUTES = [
    { from: TURKEY_AIRPORTS[0], to: WORLD_AIRPORTS[2], label: 'İstanbul ✈️ Tokyo' },
    { from: TURKEY_AIRPORTS[0], to: WORLD_AIRPORTS[0], label: 'İstanbul ✈️ Londra' },
    { from: TURKEY_AIRPORTS[2], to: WORLD_AIRPORTS[3], label: 'Ankara ✈️ Paris' },
    { from: TURKEY_AIRPORTS[0], to: WORLD_AIRPORTS[1], label: 'İstanbul ✈️ New York' },
    { from: TURKEY_AIRPORTS[4], to: WORLD_AIRPORTS[6], label: 'Antalya ✈️ Frankfurt' },
    { from: TURKEY_AIRPORTS[3], to: WORLD_AIRPORTS[16], label: 'İzmir ✈️ Roma' },
  ];

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#060b14] flex flex-col justify-between font-sans">
      
      {/* 1. Vector Map Canvas */}
      <div className="absolute inset-0 overflow-hidden">
        <svg
          viewBox={flightCalculations.viewBox}
          className="w-full h-full block transition-all duration-700 ease-out"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Glow filters for flight path and airplane */}
            <filter id="route-glow-subtle" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="airplane-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow
                dx={isTouchdown ? 0 : 3}
                dy={isTouchdown ? 2 : 8}
                stdDeviation={isTouchdown ? 2 : 6}
                floodColor="#000000"
                floodOpacity="0.8"
              />
            </filter>

            {/* Jet Contrail Gradient */}
            <linearGradient id="contrail-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Deep Navy Ocean Background */}
          <rect x="0" y="0" width="1600" height="900" fill="#070e1c" />

          {/* Aviation Navigation Coordinates Grid */}
          <g stroke="rgba(56, 189, 248, 0.06)" strokeWidth="1" strokeDasharray="5 5">
            <line x1="0" y1="150" x2="1600" y2="150" />
            <line x1="0" y1="300" x2="1600" y2="300" />
            <line x1="0" y1="450" x2="1600" y2="450" />
            <line x1="0" y1="600" x2="1600" y2="600" />
            <line x1="0" y1="750" x2="1600" y2="750" />

            <line x1="266" y1="0" x2="266" y2="900" />
            <line x1="533" y1="0" x2="533" y2="900" />
            <line x1="800" y1="0" x2="800" y2="900" />
            <line x1="1066" y1="0" x2="1066" y2="900" />
            <line x1="1333" y1="0" x2="1333" y2="900" />
          </g>

          {/* Clean Geopolitical Landmasses (Sharp vector contours) */}
          <g>
            {MAP_CONTINENTS.map((c) => (
              <path
                key={c.id}
                d={c.d}
                fill="#131c2b"
                stroke="#25354e"
                strokeWidth="1.5"
                strokeLinejoin="round"
                opacity="0.95"
              />
            ))}
          </g>

          {/* Pulsing Radar Range Rings for Origin Airport */}
          <circle cx={origCoord.x} cy={origCoord.y} r="25" fill="none" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1" />
          <circle cx={origCoord.x} cy={origCoord.y} r="50" fill="none" stroke="rgba(56, 189, 248, 0.12)" strokeWidth="1" strokeDasharray="4 4" />

          {/* Pulsing Radar Range Rings for Destination Airport */}
          <circle cx={destCoord.x} cy={destCoord.y} r="25" fill="none" stroke="rgba(245, 158, 11, 0.25)" strokeWidth="1" />
          <circle cx={destCoord.x} cy={destCoord.y} r="50" fill="none" stroke="rgba(245, 158, 11, 0.15)" strokeWidth="1" strokeDasharray="4 4" />

          {/* 1. DASHED FUTURE FLIGHT PATH (Çizgili Rota) */}
          <path
            d={flightCalculations.fullPathD}
            fill="none"
            stroke="rgba(226, 232, 240, 0.45)"
            strokeWidth="2.5"
            strokeDasharray="8 8"
            strokeLinecap="round"
          />

          {/* 2. GLOWING SOLID TRAIL FOR FLOWN PORTION */}
          <path
            d={flightCalculations.fullPathD}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#route-glow-subtle)"
            strokeDasharray="2000"
            strokeDashoffset={2000 * (1 - progress)}
          />

          {/* Navigation Waypoint Diamonds */}
          {flightCalculations.waypoints.map((wp) => (
            <g key={wp.id} transform={`translate(${wp.x}, ${wp.y})`}>
              <polygon points="0,-3 3,0 0,3 -3,0" fill="#38bdf8" opacity="0.7" />
              <text y="-6" fill="rgba(56, 189, 248, 0.5)" fontSize="9" fontFamily="monospace" textAnchor="middle">
                {wp.id}
              </text>
            </g>
          ))}

          {/* Departure Airport Pin (Kalkış Şehri) */}
          <g transform={`translate(${origCoord.x}, ${origCoord.y})`}>
            <circle r="6" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
            <text
              y="-12"
              fill="#ffffff"
              fontSize="14"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
              filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.95))"
            >
              {origin.code} · {origin.city}
            </text>
          </g>

          {/* Destination Airport Pin (Varış Şehri) */}
          <g transform={`translate(${destCoord.x}, ${destCoord.y})`}>
            <circle r="6" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
            <text
              y="-12"
              fill="#fef08a"
              fontSize="14"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
              filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.95))"
            >
              {destination.code} · {destination.city}
            </text>
          </g>

          {/* 3. AIRPLANE (Rotada Gittiği Yöne Doğru Baksın & Çizgili Rota Boyunca İlerlesin) */}
          {/* Note: Airplane SVG is drawn pointing UP (-Y). Rotating by (headingDeg + 90) aligns nose EXACTLY with motion trajectory! */}
          <g
            transform={`translate(${flightCalculations.currentPos.x}, ${flightCalculations.currentPos.y}) rotate(${flightCalculations.headingDeg + 90})`}
            filter="url(#airplane-shadow)"
          >
            {/* Jet Engine Contrails (Buhar İzi) when cruising */}
            {isFlightActive && !isTouchdown && (
              <g opacity="0.6">
                <line x1="11" y1="12" x2="11" y2="35" stroke="url(#contrail-grad)" strokeWidth="1.5" />
                <line x1="-11" y1="12" x2="-11" y2="35" stroke="url(#contrail-grad)" strokeWidth="1.5" />
              </g>
            )}

            {/* Aerodynamic Fuselage & Swept Delta Wings Model */}
            <path
              d="M 0 -22 L 3 -16 L 3.5 -6 L 24 9 L 24 13 L 3.5 6 L 3.5 15 L 10 21 L 10 24 L 0 22 L -10 24 L -10 21 L -3.5 15 L -3.5 6 L -24 13 L -24 9 L -3.5 -6 L -3 -16 Z"
              fill={isTouchdown ? '#cbd5e1' : '#ffffff'}
              stroke="#64748b"
              strokeWidth="0.8"
            />
            {/* Fuselage Center Spine */}
            <ellipse cx="0" cy="1" rx="3.2" ry="20" fill="#f8fafc" />
            {/* Cockpit Windshield */}
            <ellipse cx="0" cy="-15" rx="1.8" ry="1.4" fill="#0f172a" />
            {/* Twin Turbofan Engines */}
            <rect x="8.5" y="1" width="2.8" height="8" rx="1.4" fill="#475569" />
            <rect x="-11.3" y="1" width="2.8" height="8" rx="1.4" fill="#475569" />
            {/* Jet Exhaust Flame Glow */}
            {!isTouchdown && (
              <>
                <circle cx="9.9" cy="10" r="1.3" fill="#38bdf8" />
                <circle cx="-9.9" cy="10" r="1.3" fill="#38bdf8" />
              </>
            )}
            {/* Winglet Navigation Lights (Red Left, Green Right) */}
            <circle cx="-23" cy="11" r="1.3" fill="#ef4444" />
            <circle cx="23" cy="11" r="1.3" fill="#22c55e" />

            {/* Touchdown Landing Smoke / Wheels deployed when landed */}
            {isTouchdown && (
              <g transform="translate(0, 10)">
                <circle cx="0" cy="0" r="4" fill="#ffffff" opacity="0.7" />
                <circle cx="-8" cy="2" r="3" fill="#ffffff" opacity="0.5" />
                <circle cx="8" cy="2" r="3" fill="#ffffff" opacity="0.5" />
              </g>
            )}
          </g>
        </svg>
      </div>

      {/* Top Floating Controls Bar */}
      <div className="relative z-20 w-full p-4 flex items-center justify-between pointer-events-auto">
        {/* City Pair Indicator */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 shadow-lg">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <span className="text-sky-400 font-mono">{origin.city} ({origin.code})</span>
            <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-amber-400 font-mono">{destination.city} ({destination.code})</span>
          </span>
          {onSelectAirports && (
            <button
              type="button"
              onClick={() => setIsQuickSelectorOpen(!isQuickSelectorOpen)}
              className="ml-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 underline cursor-pointer"
            >
              Rota Değiştir
            </button>
          )}
        </div>

        {/* Viewport Camera Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsWideView(!isWideView)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/75 hover:bg-black/90 border border-white/20 text-neutral-300 hover:text-white text-xs font-bold shadow-xl backdrop-blur-md transition-all cursor-pointer"
            title={isWideView ? 'Uçağa ve Rotaya Yaklaş' : 'Tüm Harita Görünümü'}
          >
            {isWideView ? <Minimize2 className="w-3.5 h-3.5 text-sky-400" /> : <Maximize2 className="w-3.5 h-3.5 text-sky-400" />}
            <span>{isWideView ? 'Rotaya Yakınlaş' : 'Tüm Harita'}</span>
          </button>
        </div>
      </div>

      {/* Quick Route Selector Popover */}
      {isQuickSelectorOpen && onSelectAirports && (
        <div className="absolute top-16 left-4 z-30 w-80 bg-neutral-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl pointer-events-auto animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
            <span className="text-xs font-bold text-white">Popüler Uçuş Rotaları</span>
            <button
              onClick={() => setIsQuickSelectorOpen(false)}
              className="text-xs text-neutral-400 hover:text-white cursor-pointer"
            >
              Kapat
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {QUICK_ROUTES.map((route, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onSelectAirports(route.from, route.to);
                  setIsQuickSelectorOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                  origin.code === route.from.code && destination.code === route.to.code
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 hover:text-white'
                }`}
              >
                <span>{route.label}</span>
                <span className="text-[10px] font-mono text-neutral-400">
                  {route.from.code} → {route.to.code}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Touchdown Landing Celebration Modal / Banner (Süre Bitince İniş) */}
      {showTouchdownBanner && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto">
          <div className="max-w-md w-full bg-gradient-to-b from-[#0b1322] to-black border-2 border-amber-500/70 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl">
              <Plane className="w-8 h-8 rotate-45" />
            </div>

            <div>
              <span className="text-[11px] font-mono font-bold text-amber-400 tracking-wider uppercase block mb-1">
                🛬 Teker Koydu · Piste İndi
              </span>
              <h3 className="text-xl font-black text-white">
                {destination.city} ({destination.code}) Havalimanına İndiniz!
              </h3>
              <p className="text-xs text-neutral-300 mt-1">
                Kaptan pilotunuz konuşuyor: Seferimiz rota boyunca başarıyla tamamlanmış ve uçağımız güvenle piste teker koymuştur. Harika odaklandınız!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-neutral-900/90 p-3 rounded-2xl border border-white/10 text-xs text-left">
              <div>
                <span className="text-neutral-500 block text-[10px]">Uçulan Rota:</span>
                <span className="font-bold text-white font-mono">{origin.city} → {destination.city}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[10px]">Pist Durumu:</span>
                <span className="font-bold text-emerald-400">İniş Tamamlandı (0 FT)</span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowTouchdownBanner(false);
                if (onCompleteLanding) onCompleteLanding();
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-black font-black text-xs shadow-lg transition-all cursor-pointer"
            >
              Uçuşu Tamamla ✓
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom Aviation Telemetry Dock */}
      <div className="relative z-20 w-full p-3 sm:p-5 pointer-events-auto">
        <div className="max-w-4xl mx-auto rounded-2xl sm:rounded-3xl bg-neutral-950/85 backdrop-blur-xl border border-white/10 p-3 sm:p-4 shadow-2xl space-y-3">
          
          {/* Top Line: Departure -> Progress Line -> Arrival */}
          <div className="flex items-center justify-between gap-3 text-xs">
            {/* Departure */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                <Plane className="w-3.5 h-3.5 -rotate-45" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-black text-white block truncate">{origin.city}</span>
                <span className="text-[10px] font-mono text-sky-400 font-bold">{origin.code}</span>
              </div>
            </div>

            {/* Flight Route Progress Line */}
            <div className="flex-1 max-w-md px-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mb-1">
                <span>{flightCode}</span>
                <span className="text-sky-300 font-bold">%{Math.round(progress * 100)} Rota Tamamlandı</span>
                <span>{remainingNm} NM ({remainingKm} km) kaldı</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 to-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, progress * 100)}%` }}
                />
              </div>
            </div>

            {/* Arrival */}
            <div className="flex items-center gap-2 min-w-0 text-right">
              <div className="min-w-0">
                <span className="text-xs font-black text-white block truncate">{destination.city}</span>
                <span className="text-[10px] font-mono text-amber-400 font-bold">{destination.code}</span>
              </div>
              <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <MapPin className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Bottom Telemetry Strip: Altitude, Speed, Heading, Flight Phase */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5 text-[11px]">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-neutral-900/60 border border-white/5">
              <Navigation className="w-3.5 h-3.5 text-sky-400" />
              <div>
                <span className="text-neutral-400 block text-[9px] uppercase font-bold">İrtifa (Altitude)</span>
                <span className="font-mono font-bold text-white">
                  {currentAltitudeFeet.toLocaleString('tr-TR')} FT {flightLevel > 0 ? `(FL${flightLevel})` : ''}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-neutral-900/60 border border-white/5">
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
              <div>
                <span className="text-neutral-400 block text-[9px] uppercase font-bold">Hız (Ground Speed)</span>
                <span className="font-mono font-bold text-white">
                  {currentSpeedKnots} KTS <span className="text-neutral-500 text-[10px]">({currentSpeedKmh} km/s)</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-neutral-900/60 border border-white/5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <div>
                <span className="text-neutral-400 block text-[9px] uppercase font-bold">İstikamet (Heading)</span>
                <span className="font-mono font-bold text-white">
                  HDG {String(headingNorm).padStart(3, '0')}°
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-neutral-900/60 border border-white/5">
              <Plane className="w-3.5 h-3.5 text-purple-400" />
              <div>
                <span className="text-neutral-400 block text-[9px] uppercase font-bold">Uçuş Aşaması</span>
                <span className="font-mono font-bold text-white">
                  {progress <= 0.05
                    ? 'Tırmanış (Climb)'
                    : isTouchdown
                    ? 'Piste İndi (Touchdown)'
                    : progress >= 0.92
                    ? 'Alçalış & Yaklaşma (Final)'
                    : 'Seyir (Cruise)'}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
