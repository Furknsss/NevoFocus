import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plane,
  Navigation,
  Compass,
  MapPin,
  Maximize2,
  Gauge,
  CheckCircle2,
  ArrowRight,
  Minimize2
} from 'lucide-react';
import { FlightAirport } from '../../types';
import { soundEngine } from '../../utils/audio';

interface WorldMap2DFlightProps {
  origin: FlightAirport;
  destination: FlightAirport;
  progress: number; // 0 to 1
  isFlightActive?: boolean;
}

// Convert geographic coordinates (lat, lng) to equirectangular map projection (0..2000, 0..1125)
function geoToMapCoords(lat: number, lng: number): { x: number; y: number } {
  // Longitude: -180..+180 -> 0..2000
  const x = ((lng + 180) / 360) * 2000;
  // Latitude: Mercator-like calibrated for 16:9 world cartography
  const clampedLat = Math.max(-75, Math.min(80, lat));
  const y = ((85 - clampedLat) / 165) * 1125;
  return { x, y };
}

export const WorldMap2DFlight: React.FC<WorldMap2DFlightProps> = ({
  origin,
  destination,
  progress,
  isFlightActive = false,
}) => {
  const [isWideView, setIsWideView] = useState(false);
  const [showLandingBanner, setShowLandingBanner] = useState(false);

  // Compute map coordinates for origin and destination
  const origCoord = useMemo(() => geoToMapCoords(origin.lat, origin.lng), [origin]);
  const destCoord = useMemo(() => geoToMapCoords(destination.lat, destination.lng), [destination]);

  // Generate geodesic flight arc curve
  const {
    controlPt,
    currentPos,
    planeAngle,
    distanceKm,
    distanceNm,
    viewBox,
  } = useMemo(() => {
    const x1 = origCoord.x;
    const y1 = origCoord.y;
    const x2 = destCoord.x;
    const y2 = destCoord.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);

    // Natural geodesic great-circle northern curve
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const arcLift = Math.min(180, Math.max(40, dist * 0.24));
    const cx = midX;
    const cy = Math.max(30, midY - arcLift);

    // Plane position at progress t (0 to 1) along quadratic bezier curve
    const t = Math.max(0, Math.min(1, progress));
    const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
    const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;

    // Heading direction tangent derivative: dx/dt, dy/dt
    const tangentX = 2 * (1 - t) * (cx - x1) + 2 * t * (x2 - cx);
    const tangentY = 2 * (1 - t) * (cy - y1) + 2 * t * (y2 - cy);
    const angleRad = Math.atan2(tangentY, tangentX);
    const angleDeg = (angleRad * 180) / Math.PI;

    // Real nautical and metric distance estimate
    const dKm = Math.round(
      Math.hypot(destination.lat - origin.lat, destination.lng - origin.lng) * 111.3
    );
    const dNm = Math.round(dKm * 0.539957);

    // DYNAMIC CAMERA TRACKING (Zoomed-in segment view as requested in image.png)
    // Dynamic tracking bounding box following the airplane smoothly towards destination
    let vbX = 0;
    let vbY = 0;
    let vbW = 2000;
    let vbH = 1125;

    if (!isWideView) {
      // Focus window around the route segment and current plane position
      const sectorMinX = Math.min(x1, x2, px);
      const sectorMaxX = Math.max(x1, x2, px);
      const sectorMinY = Math.min(y1, y2, cy, py);
      const sectorMaxY = Math.max(y1, y2, py);

      const spanX = Math.max(380, sectorMaxX - sectorMinX + 220);
      const spanY = Math.max(240, sectorMaxY - sectorMinY + 180);

      // Keep 16:9 aspect ratio
      const targetW = Math.max(spanX, spanY * (16 / 9));
      const targetH = targetW * (9 / 16);

      // Center camera dynamically between current plane position and next leg
      const focusCenterX = px * 0.7 + (x1 + x2) * 0.15;
      const focusCenterY = py * 0.7 + (y1 + y2) * 0.15;

      vbX = Math.max(0, Math.min(2000 - targetW, focusCenterX - targetW / 2));
      vbY = Math.max(0, Math.min(1125 - targetH, focusCenterY - targetH / 2));
      vbW = targetW;
      vbH = targetH;
    }

    return {
      controlPt: { x: cx, y: cy },
      currentPos: { x: px, y: py },
      planeAngle: angleDeg,
      distanceKm: Math.max(450, dKm),
      distanceNm: Math.max(240, dNm),
      viewBox: `${vbX} ${vbY} ${vbW} ${vbH}`,
    };
  }, [origCoord, destCoord, progress, origin, destination, isWideView]);

  // Touchdown landing trigger
  useEffect(() => {
    if (progress >= 0.985) {
      setShowLandingBanner(true);
    } else {
      setShowLandingBanner(false);
    }
  }, [progress]);

  // Aviation Telemetry Metrics (Realistic Cruise/Descent)
  const completedKm = Math.round(distanceKm * progress);
  const remainingKm = Math.max(0, distanceKm - completedKm);
  const remainingNm = Math.round(remainingKm * 0.539957);

  // Altitude in FEET (Cruising at 37,000 FT / FL370)
  const currentAltitudeFeet = progress <= 0.02 || progress >= 0.985
    ? 0
    : Math.round(37000 * Math.sin(Math.max(0.06, Math.min(0.94, progress)) * Math.PI));

  // Speed in KNOTS & KM/H (Normal commercial airliner cruise speed: 485 kts = 898 km/h)
  const currentSpeedKnots = isFlightActive ? (progress >= 0.98 ? 140 : 485) : 0;
  const currentSpeedKmh = Math.round(currentSpeedKnots * 1.852);
  const flightLevel = Math.round(currentAltitudeFeet / 100);
  const headingNorm = Math.round((planeAngle + 360) % 360);
  const flightCode = `TK-${Math.abs((origin.code.charCodeAt(0) * 31 + destination.code.charCodeAt(0) * 17) % 900) + 100}`;

  // Paths: Solid trail behind plane, dashed line ahead to destination (matching image.png)
  const fullPathD = `M ${origCoord.x} ${origCoord.y} Q ${controlPt.x} ${controlPt.y} ${destCoord.x} ${destCoord.y}`;

  // Subdivided paths for solid trail vs dashed future path
  const solidTrailD = `M ${origCoord.x} ${origCoord.y} Q ${(origCoord.x + controlPt.x) / 2} ${(origCoord.y + controlPt.y) / 2} ${currentPos.x} ${currentPos.y}`;
  const dashedFutureD = `M ${currentPos.x} ${currentPos.y} Q ${(destCoord.x + controlPt.x) / 2} ${(destCoord.y + controlPt.y) / 2} ${destCoord.x} ${destCoord.y}`;

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#0d1117] flex flex-col justify-between">
      
      {/* Dynamic Tracking Map Viewport */}
      <div className="absolute inset-0 overflow-hidden">
        <svg
          viewBox={viewBox}
          className="w-full h-full block transition-all duration-700 ease-out"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Map styling & airplane drop shadow */}
            <filter id="airplane-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="3" dy="6" stdDeviation="4" floodColor="#000000" floodOpacity="0.8" />
            </filter>
            <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* High Resolution World Cartography Image as Map Backdrop */}
          <image
            href="/src/assets/images/world_map_2d_radar_1791796277059.jpg"
            x="0"
            y="0"
            width="2000"
            height="1125"
            preserveAspectRatio="none"
            opacity="0.9"
          />

          {/* Subtle dark aviation atmosphere vignette */}
          <rect
            x="0"
            y="0"
            width="2000"
            height="1125"
            fill="rgba(5, 8, 14, 0.25)"
          />

          {/* 1. SOLID TRAILED PATH (Flown route from origin to plane, like in photo) */}
          <path
            d={fullPathD}
            fill="none"
            stroke="rgba(255, 255, 255, 0.85)"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#route-glow)"
            strokeDasharray="2000"
            strokeDashoffset={2000 * (1 - progress)}
          />

          {/* 2. DASHED PATH AHEAD (From airplane to destination, exactly matching photo image.png) */}
          <path
            d={fullPathD}
            fill="none"
            stroke="rgba(226, 232, 240, 0.65)"
            strokeWidth="2.8"
            strokeDasharray="9 9"
            strokeLinecap="round"
          />

          {/* 3. ORIGIN AIRPORT PIN */}
          <circle
            cx={origCoord.x}
            cy={origCoord.y}
            r="7"
            fill="#ffffff"
            stroke="#0284c7"
            strokeWidth="3"
          />
          <circle
            cx={origCoord.x}
            cy={origCoord.y}
            r="16"
            fill="none"
            stroke="rgba(56, 189, 248, 0.4)"
            strokeWidth="2"
          />
          {/* Origin Text Tag */}
          <text
            x={origCoord.x}
            y={origCoord.y - 14}
            fill="#ffffff"
            fontSize="18"
            fontWeight="bold"
            fontFamily="monospace"
            textAnchor="middle"
            filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.9))"
          >
            {origin.code} · {origin.city}
          </text>

          {/* 4. DESTINATION AIRPORT PIN */}
          <circle
            cx={destCoord.x}
            cy={destCoord.y}
            r="7"
            fill="#f59e0b"
            stroke="#ffffff"
            strokeWidth="3"
          />
          <circle
            cx={destCoord.x}
            cy={destCoord.y}
            r="18"
            fill="none"
            stroke="rgba(245, 158, 11, 0.5)"
            strokeWidth="2"
          />
          {/* Destination Text Tag */}
          <text
            x={destCoord.x}
            y={destCoord.y - 14}
            fill="#fef08a"
            fontSize="18"
            fontWeight="bold"
            fontFamily="monospace"
            textAnchor="middle"
            filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.9))"
          >
            {destination.code} · {destination.city}
          </text>

          {/* 5. COMMERCIAL PASSENGER AIRLINER (Detailed white twin-engine jet matching image.png) */}
          <g
            transform={`translate(${currentPos.x}, ${currentPos.y}) rotate(${planeAngle})`}
            filter="url(#airplane-shadow)"
          >
            {/* Passenger Jet Vector Model */}
            {/* Shadow underbody */}
            <path
              d="M 0 -28 L 3 -24 L 4 -10 L 32 10 L 32 15 L 4 6 L 4 20 L 14 27 L 14 30 L 0 28 L -14 30 L -14 27 L -4 20 L -4 6 L -32 15 L -32 10 L -4 -10 L -3 -24 Z"
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth="0.8"
            />
            {/* Jet Fuselage centerline */}
            <ellipse cx="0" cy="0" rx="3.5" ry="26" fill="#f8fafc" />
            {/* Cockpit windshield glass */}
            <ellipse cx="0" cy="-21" rx="2" ry="1.4" fill="#0f172a" />
            {/* Twin Jet Engines on wings (underwing nacelles) */}
            <rect x="12" y="2" width="3.2" height="11" rx="1.6" fill="#64748b" />
            <rect x="-15.2" y="2" width="3.2" height="11" rx="1.6" fill="#64748b" />
            {/* Engine intake glow */}
            <ellipse cx="13.6" cy="2" rx="1.6" ry="1" fill="#38bdf8" />
            <ellipse cx="-13.6" cy="2" rx="1.6" ry="1" fill="#38bdf8" />
            {/* Wings wingtips */}
            <path d="M 31 10 L 33 8 L 31 14 Z" fill="#38bdf8" />
            <path d="M -31 10 L -33 8 L -31 14 Z" fill="#38bdf8" />
          </g>
        </svg>
      </div>

      {/* Top Floating View Switcher (Bottom right or top right, zero conflict with top left header) */}
      <div className="absolute top-4 right-4 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsWideView(!isWideView)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/75 hover:bg-black/90 border border-white/20 text-neutral-300 hover:text-white text-xs font-bold shadow-xl backdrop-blur-md transition-all cursor-pointer"
          title={isWideView ? 'Uçağa Odaklan (Kamera Takibi)' : 'Tüm Harita Geniş Görünüm'}
        >
          {isWideView ? <Minimize2 className="w-3.5 h-3.5 text-sky-400" /> : <Maximize2 className="w-3.5 h-3.5 text-sky-400" />}
          <span>{isWideView ? 'Uçağa Yakınlaş' : 'Geniş Harita'}</span>
        </button>
      </div>

      {/* Touchdown Landing Celebration Modal */}
      {showLandingBanner && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto">
          <div className="max-w-md w-full bg-gradient-to-b from-neutral-900 to-black border-2 border-amber-500/60 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl">
              <Plane className="w-8 h-8 rotate-45" />
            </div>

            <div>
              <span className="text-[11px] font-mono font-bold text-amber-400 tracking-wider uppercase block mb-1">
                🛬 İniş Başarıyla Gerçekleşti
              </span>
              <h3 className="text-xl font-black text-white">
                {destination.city} ({destination.code}) Havalimanına İndiniz!
              </h3>
              <p className="text-xs text-neutral-300 mt-1">
                Kaptan pilotunuz konuşuyor: Seferimiz tamamlanmıştır. Tebrikler, odaklanma hedefinizi başarıyla tamamladınız!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-neutral-900/90 p-3 rounded-2xl border border-white/10 text-xs text-left">
              <div>
                <span className="text-neutral-500 block text-[10px]">Katedilen Mesafe:</span>
                <span className="font-bold text-white font-mono">{distanceKm} km ({distanceNm} NM)</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[10px]">İniş Durumu:</span>
                <span className="font-bold text-emerald-400">Piste İndi · Güvenli</span>
              </div>
            </div>

            <button
              onClick={() => setShowLandingBanner(false)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-black font-black text-xs shadow-lg transition-all cursor-pointer"
            >
              Uçuşu Tamamla ✓
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom Aviation Telemetry Dock (Accurate Feet, Knots, HDG, NM) */}
      <div className="relative z-20 w-full p-3 sm:p-5 pointer-events-auto">
        <div className="max-w-4xl mx-auto rounded-2xl sm:rounded-3xl bg-neutral-950/85 backdrop-blur-xl border border-white/10 p-3 sm:p-4 shadow-2xl space-y-3">
          
          {/* Top Line: Origin -> Flight Arc Line -> Destination */}
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
                <span className="text-sky-300 font-bold">%{Math.round(progress * 100)} Uçuldu</span>
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

          {/* Bottom Telemetry Strip (Accurate FEET, KNOTS, HEADING) */}
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
                    : progress >= 0.95
                    ? 'Son Yaklaşma (Final)'
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
