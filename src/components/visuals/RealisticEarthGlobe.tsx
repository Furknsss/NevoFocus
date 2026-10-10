import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FlightAirport } from '../../types';
import {
  Compass,
  Navigation2,
  Eye,
  RotateCcw,
  Plane,
  Layers,
  Sparkles,
  Maximize2
} from 'lucide-react';

interface RealisticEarthGlobeProps {
  origin: FlightAirport;
  destination: FlightAirport;
  progress: number; // 0 to 1
  isFlightActive?: boolean;
}

export const RealisticEarthGlobe: React.FC<RealisticEarthGlobeProps> = ({
  origin,
  destination,
  progress,
  isFlightActive = false,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Camera views: 'chase' (behind plane), 'satellite' (top-down), 'cockpit' (front pilot), 'wing' (side window)
  const [cameraView, setCameraView] = useState<'chase' | 'satellite' | 'cockpit' | 'wing'>('chase');
  const cameraViewRef = useRef<'chase' | 'satellite' | 'cockpit' | 'wing'>('chase');
  cameraViewRef.current = cameraView;

  // Flight progress ref for buttery 60 FPS animation without tearing down WebGL scene
  const progressRef = useRef<number>(progress);
  progressRef.current = progress;

  const isFlightActiveRef = useRef<boolean>(isFlightActive);
  isFlightActiveRef.current = isFlightActive;

  // Interactive User Orbit Controls (drag to inspect around the tracked aircraft)
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const orbitOffsetRef = useRef<{ yaw: number; pitch: number; zoom: number }>({
    yaw: 0,
    pitch: 0,
    zoom: 1.0,
  });

  const resetOrbit = () => {
    orbitOffsetRef.current = { yaw: 0, pitch: 0, zoom: 1.0 };
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    // 1. Scene, Camera, WebGL Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 1000);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 2. Photorealistic Google Earth Satellite Map Canvas (2048x1024)
    // Equirectangular projection: x: [-180..+180], y: [+90..-90]
    const texWidth = 2048;
    const texHeight = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = texWidth;
    canvas.height = texHeight;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Deep ocean bathymetry base (realistic deep sea gradient matching Google Earth)
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, texHeight);
      oceanGrad.addColorStop(0, '#0a1d33');
      oceanGrad.addColorStop(0.2, '#0f2f52');
      oceanGrad.addColorStop(0.4, '#13406f');
      oceanGrad.addColorStop(0.5, '#16487d');
      oceanGrad.addColorStop(0.6, '#13406f');
      oceanGrad.addColorStop(0.8, '#0f2f52');
      oceanGrad.addColorStop(1, '#071627');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, texWidth, texHeight);

      // Helper: lat/lng to canvas x,y
      const toXY = (lat: number, lng: number) => ({
        x: ((lng + 180) / 360) * texWidth,
        y: ((90 - lat) / 180) * texHeight,
      });

      // Helper to draw realistic landmass with coastal turquoise shelf and biomes
      const drawPolyLand = (
        points: { lat: number; lng: number }[],
        vegColor: string,
        shelf = true
      ) => {
        if (points.length < 3) return;
        const coords = points.map((p) => toXY(p.lat, p.lng));

        // Shallow coastal water shelf halo
        if (shelf) {
          ctx.save();
          ctx.strokeStyle = 'rgba(20, 184, 214, 0.4)';
          ctx.lineWidth = 14;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(coords[0].x, coords[0].y);
          for (let i = 1; i < coords.length; i++) ctx.lineTo(coords[i].x, coords[i].y);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        // Land body
        ctx.fillStyle = vegColor;
        ctx.beginPath();
        ctx.moveTo(coords[0].x, coords[0].y);
        for (let i = 1; i < coords.length; i++) ctx.lineTo(coords[i].x, coords[i].y);
        ctx.closePath();
        ctx.fill();
      };

      // Helper: Elliptical biome patch (mountains, deserts, forests)
      const drawBiomePatch = (
        lat: number,
        lng: number,
        radiusKmLat: number,
        radiusKmLng: number,
        color: string
      ) => {
        const center = toXY(lat, lng);
        const ry = (radiusKmLat / 111 / 180) * texHeight;
        const rx = (radiusKmLng / 111 / 360) * texWidth;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, Math.max(2, rx), Math.max(2, ry), 0, 0, Math.PI * 2);
        ctx.fill();
      };

      // A. ANATOLIA / TURKEY & MEDITERRANEAN (Accurate Geographic Geometry)
      // Turkey borders: Lat ~36°N to 42°N, Lng ~26°E to 45°E
      drawPolyLand(
        [
          { lat: 41.8, lng: 28.0 }, // Thrace / Black sea
          { lat: 42.0, lng: 32.0 }, // Sinop / Kastamonu
          { lat: 41.5, lng: 37.0 }, // Samsun
          { lat: 41.2, lng: 41.5 }, // Trabzon / Hopa
          { lat: 40.0, lng: 44.5 }, // Kars / Agri
          { lat: 37.5, lng: 44.0 }, // Hakkari
          { lat: 37.0, lng: 41.0 }, // Mardin / Urfa
          { lat: 36.5, lng: 36.0 }, // Hatay / Iskenderun
          { lat: 36.5, lng: 34.0 }, // Mersin
          { lat: 36.1, lng: 31.0 }, // Antalya / Alanya
          { lat: 36.7, lng: 28.0 }, // Mugla / Marmaris
          { lat: 38.5, lng: 26.5 }, // Izmir / Aegean
          { lat: 40.0, lng: 26.2 }, // Canakkale
          { lat: 40.8, lng: 28.5 }, // Marmara / Istanbul
        ],
        '#2d5e37' // Rich Anatolian green
      );

      // Central Anatolian plateau & Taurus Mountain ranges
      drawBiomePatch(39.0, 33.5, 120, 220, '#665c3b'); // Central Anatolia steppe
      drawBiomePatch(37.5, 33.0, 60, 240, '#4a3d2c'); // Taurus mountains
      drawBiomePatch(40.5, 38.0, 60, 220, '#214629'); // Pontic / Black Sea forest

      // B. EUROPE & BALKANS
      drawPolyLand(
        [
          { lat: 36.0, lng: -5.5 }, // Gibraltar
          { lat: 43.5, lng: -9.0 }, // Galicia
          { lat: 48.0, lng: -4.5 }, // Brittany
          { lat: 54.0, lng: 8.5 }, // Denmark
          { lat: 55.0, lng: 18.0 }, // Baltic
          { lat: 45.0, lng: 35.0 }, // Crimea
          { lat: 40.5, lng: 23.0 }, // Greece
          { lat: 38.0, lng: 15.5 }, // Italy / Sicily
          { lat: 43.5, lng: 7.0 }, // French Riviera
        ],
        '#2d6338'
      );
      // Alps snow patch
      drawBiomePatch(46.5, 10.0, 80, 220, '#859c8a');

      // British Isles & Scandinavia
      drawPolyLand(
        [
          { lat: 50.0, lng: -5.0 },
          { lat: 58.5, lng: -5.0 },
          { lat: 58.0, lng: -2.0 },
          { lat: 51.5, lng: 1.5 },
        ],
        '#316c3b'
      );
      drawPolyLand(
        [
          { lat: 58.0, lng: 6.0 },
          { lat: 70.0, lng: 20.0 },
          { lat: 60.0, lng: 24.0 },
        ],
        '#224d2c'
      );

      // C. AFRICA & SAHARA (Hero golden desert matching Google Earth)
      drawPolyLand(
        [
          { lat: 35.0, lng: -6.0 }, // Morocco
          { lat: 37.0, lng: 10.0 }, // Tunisia
          { lat: 31.5, lng: 32.0 }, // Nile Delta / Egypt
          { lat: 12.0, lng: 51.0 }, // Horn of Africa
          { lat: -34.5, lng: 18.5 }, // Cape of Good Hope
          { lat: -15.0, lng: 12.0 }, // Angola
          { lat: 4.5, lng: 9.0 }, // Cameroon
          { lat: 14.5, lng: -17.5 }, // Senegal
        ],
        '#c4975d' // Sahara sandy beige
      );
      // Central Africa tropical rainforest
      drawBiomePatch(0.0, 22.0, 900, 1100, '#1d4d25');
      // Southern Africa savannah
      drawBiomePatch(-24.0, 26.0, 700, 800, '#827443');
      // Nile river green ribbon
      drawBiomePatch(26.0, 32.5, 500, 40, '#2e6b36');

      // D. MIDDLE EAST & ARABIAN PENINSULA
      drawPolyLand(
        [
          { lat: 31.5, lng: 34.5 }, // Levant
          { lat: 30.0, lng: 48.0 }, // Kuwait
          { lat: 24.0, lng: 56.0 }, // Oman / UAE
          { lat: 12.5, lng: 44.0 }, // Yemen
          { lat: 27.5, lng: 35.5 }, // Red Sea
        ],
        '#d4a366'
      );

      // E. ASIA, INDIA & SIBERIA
      drawPolyLand(
        [
          { lat: 42.0, lng: 48.0 }, // Caspian
          { lat: 70.0, lng: 60.0 }, // Urals
          { lat: 68.0, lng: 170.0 }, // Siberia
          { lat: 38.0, lng: 128.0 }, // Korea
          { lat: 22.0, lng: 114.0 }, // Hong Kong
          { lat: 8.0, lng: 77.0 }, // India south tip
          { lat: 25.0, lng: 62.0 }, // Pakistan
        ],
        '#2a5a32'
      );
      // Tibetan plateau & Himalayas
      drawBiomePatch(32.0, 88.0, 400, 900, '#756852');
      // Gobi desert
      drawBiomePatch(42.0, 105.0, 300, 700, '#b89461');
      // Indian subcontinent greenery
      drawBiomePatch(20.0, 78.0, 600, 500, '#295f32');
      // Japan
      drawPolyLand(
        [
          { lat: 31.0, lng: 130.0 },
          { lat: 43.5, lng: 144.0 },
          { lat: 36.0, lng: 138.0 },
        ],
        '#265930'
      );

      // F. NORTH AMERICA
      drawPolyLand(
        [
          { lat: 70.0, lng: -140.0 }, // Alaska
          { lat: 50.0, lng: -125.0 }, // Vancouver
          { lat: 32.0, lng: -117.0 }, // California
          { lat: 15.0, lng: -92.0 }, // Mexico / Guatemala
          { lat: 25.0, lng: -80.0 }, // Florida
          { lat: 45.0, lng: -65.0 }, // Maine
          { lat: 60.0, lng: -65.0 }, // Labrador
        ],
        '#2c5d35'
      );
      // Rocky Mountains & Southwest Desert
      drawBiomePatch(38.0, -108.0, 600, 350, '#706048');
      drawBiomePatch(34.0, -114.0, 350, 400, '#ba9562');

      // G. SOUTH AMERICA
      drawPolyLand(
        [
          { lat: 12.0, lng: -72.0 }, // Colombia
          { lat: -5.0, lng: -35.0 }, // Brazil tip
          { lat: -35.0, lng: -55.0 }, // Buenos Aires
          { lat: -54.0, lng: -68.0 }, // Tierra del Fuego
          { lat: -18.0, lng: -70.0 }, // Peru / Chile
          { lat: -2.0, lng: -80.0 }, // Ecuador
        ],
        '#1d4f26' // Amazon deep emerald
      );
      // Andes mountain cordillera
      drawBiomePatch(-25.0, -68.0, 1600, 120, '#594d39');

      // H. AUSTRALIA & OCEANIA
      drawPolyLand(
        [
          { lat: -12.0, lng: 132.0 },
          { lat: -22.0, lng: 150.0 },
          { lat: -38.0, lng: 145.0 },
          { lat: -33.0, lng: 116.0 },
          { lat: -21.0, lng: 114.0 },
        ],
        '#bf7e45' // Red Aussie outback
      );

      // I. POLAR ICE CAPS (Crystalline Glaciers)
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, texWidth, texHeight * 0.08); // Arctic
      ctx.fillRect(0, texHeight * 0.91, texWidth, texHeight * 0.09); // Antarctica
      // Greenland ice sheet
      drawBiomePatch(74.0, -40.0, 750, 450, '#f1f5f9');

      // J. SUBTLE LATITUDE/LONGITUDE GOOGLE EARTH GRID LINES
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 1;
      // Parallels
      for (let lat = -60; lat <= 60; lat += 30) {
        const y = ((90 - lat) / 180) * texHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(texWidth, y);
        ctx.stroke();
      }
      // Meridians
      for (let lng = -150; lng <= 180; lng += 30) {
        const x = ((lng + 180) / 360) * texWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, texHeight);
        ctx.stroke();
      }

      // K. NIGHT CITY LIGHTS (Glow on continents)
      ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
      const drawCityLight = (lat: number, lng: number, size = 3) => {
        const p = toXY(lat, lng);
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      };
      // Turkish cities
      drawCityLight(41.0, 29.0, 5); // Istanbul
      drawCityLight(39.9, 32.8, 4); // Ankara
      drawCityLight(38.4, 27.1, 4); // Izmir
      drawCityLight(36.9, 30.7, 4); // Antalya
      drawCityLight(41.0, 39.7, 3); // Trabzon
      drawCityLight(37.0, 35.3, 3); // Adana
      // Major world hubs
      drawCityLight(51.5, -0.1, 5); // London
      drawCityLight(48.8, 2.3, 5); // Paris
      drawCityLight(25.2, 55.3, 5); // Dubai
      drawCityLight(30.0, 31.2, 4); // Cairo
      drawCityLight(35.6, 139.7, 5); // Tokyo
      drawCityLight(40.7, -74.0, 5); // New York
    }

    const earthTexture = new THREE.CanvasTexture(canvas);
    earthTexture.colorSpace = THREE.SRGBColorSpace;
    earthTexture.wrapS = THREE.ClampToEdgeWrapping;
    earthTexture.wrapT = THREE.ClampToEdgeWrapping;

    // 3. Volumetric Clouds Texture Canvas
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 1024;
    cloudCanvas.height = 512;
    const cCtx = cloudCanvas.getContext('2d');
    if (cCtx) {
      cCtx.clearRect(0, 0, 1024, 512);
      cCtx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      for (let i = 0; i < 140; i++) {
        const cx = Math.random() * 1024;
        const cy = 60 + Math.random() * 392;
        const cr = 20 + Math.random() * 55;
        cCtx.beginPath();
        cCtx.arc(cx, cy, cr, 0, Math.PI * 2);
        cCtx.arc(cx + 26, cy - 6, cr * 0.8, 0, Math.PI * 2);
        cCtx.arc(cx - 22, cy + 6, cr * 0.7, 0, Math.PI * 2);
        cCtx.fill();
      }
    }
    const cloudTexture = new THREE.CanvasTexture(cloudCanvas);

    // 4. Earth Sphere Mesh (CRITICAL: THIS NEVER ROTATES! "Dünya dönmesin!")
    const earthRadius = 1.0;
    const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthMaterial = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.65,
      metalness: 0.08,
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthMesh.rotation.set(0, 0, 0); // STATIC ASTRONOMICAL ORIENTATION
    scene.add(earthMesh);

    // 5. Cloud Shell Mesh (Clouds drift independently without rotating the planet)
    const cloudGeometry = new THREE.SphereGeometry(earthRadius * 1.012, 48, 48);
    const cloudMaterial = new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.45,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    scene.add(cloudMesh);

    // 6. Atmospheric Rayleigh Scattering Rim Glow (Google Earth Blue Halo)
    const atmosphereGeometry = new THREE.SphereGeometry(earthRadius * 1.15, 32, 32);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
          gl_FragColor = vec4(0.25, 0.7, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphereMesh);

    // 7. Space Deep Starfield
    const starsCount = 900;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      const radius = 9 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = radius * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.038,
      transparent: true,
      opacity: 0.85,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 8. Sun & Ambient Illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff6ea, 2.5);
    sunLight.position.set(5, 3, 4);
    scene.add(sunLight);

    // Secondary fill light for night side soft visibility
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    fillLight.position.set(-5, -2, -4);
    scene.add(fillLight);

    // Helper: Lat/Lng to Vector3 on sphere
    const toVector3 = (lat: number, lng: number, r: number) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);
      const x = -(r * Math.sin(phi) * Math.cos(theta));
      const z = r * Math.sin(phi) * Math.sin(theta);
      const y = r * Math.cos(phi);
      return new THREE.Vector3(x, y, z);
    };

    // 9. Flight Route 3D Arc & Airport Markers
    const vOrig = toVector3(origin.lat, origin.lng, earthRadius);
    const vDest = toVector3(destination.lat, destination.lng, earthRadius);

    // Create glowing 3D beacon pin with pulsating radar ring
    const createAirportBeacon = (pos: THREE.Vector3, colorHex: number, label: string) => {
      const group = new THREE.Group();

      // Pin core
      const pinGeo = new THREE.SphereGeometry(0.022, 16, 16);
      const pinMat = new THREE.MeshBasicMaterial({ color: colorHex });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      group.add(pinMesh);

      // Pulse ring
      const ringGeo = new THREE.RingGeometry(0.028, 0.042, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.lookAt(pos);
      group.add(ring);

      // Vertical beacon ray beam
      const beamGeo = new THREE.CylinderGeometry(0.003, 0.008, 0.1, 8);
      const beamMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.6,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.copy(pos.clone().normalize().multiplyScalar(0.05));
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
      group.add(beam);

      // Label sprite
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 160;
      labelCanvas.height = 48;
      const lCtx = labelCanvas.getContext('2d');
      if (lCtx) {
        lCtx.fillStyle = 'rgba(0,0,0,0.7)';
        lCtx.roundRect(4, 4, 152, 40, 10);
        lCtx.fill();
        lCtx.strokeStyle = '#ffffff';
        lCtx.lineWidth = 2;
        lCtx.stroke();
        lCtx.fillStyle = '#ffffff';
        lCtx.font = 'bold 20px monospace';
        lCtx.textAlign = 'center';
        lCtx.textBaseline = 'middle';
        lCtx.fillText(label, 80, 24);
      }
      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const spriteMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(0.12, 0.036, 1);
      sprite.position.copy(pos.clone().normalize().multiplyScalar(1.08));
      group.add(sprite);

      group.position.copy(pos);
      return { group, ring };
    };

    const origBeacon = createAirportBeacon(vOrig, 0x38bdf8, origin.code);
    const destBeacon = createAirportBeacon(vDest, 0xff5500, destination.code);
    earthMesh.add(origBeacon.group);
    earthMesh.add(destBeacon.group);

    // 3D Geodesic Great Circle Flight Arc
    const arcPointsCount = 64;
    const curvePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= arcPointsCount; i++) {
      const t = i / arcPointsCount;
      const interpolated = new THREE.Vector3().lerpVectors(vOrig, vDest, t).normalize();
      // Cruising flight altitude elevation curve
      const elevation = 1.0 + Math.sin(t * Math.PI) * 0.15;
      interpolated.multiplyScalar(elevation);
      curvePoints.push(interpolated);
    }
    const flightCurve = new THREE.CatmullRomCurve3(curvePoints);
    const tubeGeo = new THREE.TubeGeometry(flightCurve, 60, 0.005, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.8,
    });
    const flightTube = new THREE.Mesh(tubeGeo, tubeMat);
    earthMesh.add(flightTube);

    // 10. Photorealistic Detailed 3D Passenger Aircraft
    const planeGroup = new THREE.Group();

    // Fuselage
    const fuselageGeo = new THREE.CylinderGeometry(0.015, 0.018, 0.13, 16);
    const fuselageMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.2,
      metalness: 0.25,
    });
    const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
    fuselage.rotation.x = Math.PI / 2;
    planeGroup.add(fuselage);

    // Aerodynamic Nose Cone
    const noseGeo = new THREE.ConeGeometry(0.015, 0.045, 16);
    const nose = new THREE.Mesh(noseGeo, fuselageMat);
    nose.position.z = 0.085;
    nose.rotation.x = Math.PI / 2;
    planeGroup.add(nose);

    // Cockpit Tinted Windows
    const cockpitGeo = new THREE.BoxGeometry(0.018, 0.008, 0.022);
    const cockpitMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 0.014, 0.065);
    planeGroup.add(cockpit);

    // Swept-Back Wings with Winglets
    const wingGeo = new THREE.BoxGeometry(0.2, 0.0035, 0.038);
    const wings = new THREE.Mesh(wingGeo, fuselageMat);
    wings.position.set(0, 0, 0.01);
    planeGroup.add(wings);

    // Winglet tips
    const wingletGeo = new THREE.BoxGeometry(0.003, 0.016, 0.018);
    const wingletMat = new THREE.MeshBasicMaterial({ color: 0xef4444 }); // Red winglets
    const wingletL = new THREE.Mesh(wingletGeo, wingletMat);
    wingletL.position.set(-0.1, 0.008, 0.01);
    const wingletR = new THREE.Mesh(wingletGeo, wingletMat);
    wingletR.position.set(0.1, 0.008, 0.01);
    planeGroup.add(wingletL);
    planeGroup.add(wingletR);

    // Vertical Tail Fin with Turkish Aviation Red Accent
    const tailFinGeo = new THREE.BoxGeometry(0.003, 0.038, 0.028);
    const tailFinMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Red stabilizer
      roughness: 0.3,
    });
    const tailFin = new THREE.Mesh(tailFinGeo, tailFinMat);
    tailFin.position.set(0, 0.022, -0.055);
    planeGroup.add(tailFin);

    // Horizontal Stabilizers
    const hStabGeo = new THREE.BoxGeometry(0.068, 0.002, 0.018);
    const hStab = new THREE.Mesh(hStabGeo, fuselageMat);
    hStab.position.set(0, 0.005, -0.06);
    planeGroup.add(hStab);

    // Dual Turbofan Jet Engines
    const engineGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.032, 12);
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 });
    const engineL = new THREE.Mesh(engineGeo, engineMat);
    engineL.rotation.x = Math.PI / 2;
    engineL.position.set(-0.045, -0.01, 0);
    const engineR = engineL.clone();
    engineR.position.set(0.045, -0.01, 0);
    planeGroup.add(engineL);
    planeGroup.add(engineR);

    // Aerodynamic Engine Vapor Contrails (Twin white trails behind jet engines)
    const contrailGeo = new THREE.CylinderGeometry(0.002, 0.012, 0.16, 6);
    const contrailMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    });
    const contrailL = new THREE.Mesh(contrailGeo, contrailMat);
    contrailL.rotation.x = Math.PI / 2;
    contrailL.position.set(-0.045, -0.01, -0.095);
    const contrailR = contrailL.clone();
    contrailR.position.set(0.045, -0.01, -0.095);
    planeGroup.add(contrailL);
    planeGroup.add(contrailR);

    // Blinking FAA Navigation Strobe Lights
    const navLightGeo = new THREE.SphereGeometry(0.003, 8, 8);
    const navLightPort = new THREE.Mesh(navLightGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 })); // Port red
    navLightPort.position.set(-0.1, 0.002, 0.01);
    const navLightStbd = new THREE.Mesh(navLightGeo, new THREE.MeshBasicMaterial({ color: 0x22c55e })); // Starboard green
    navLightStbd.position.set(0.1, 0.002, 0.01);
    planeGroup.add(navLightPort);
    planeGroup.add(navLightStbd);

    earthMesh.add(planeGroup);

    // 11. UÇAK TAKİP SİSTEMİ & DÜNYA DÖNMESİN (Camera Follows Aircraft, Earth Stays Still)
    let currentPlanePos = new THREE.Vector3();
    let currentTangent = new THREE.Vector3();

    const updatePlaneAndTrackingCamera = (p: number) => {
      const clampedP = Math.max(0, Math.min(1, p));
      const planePos = flightCurve.getPointAt(clampedP);
      currentPlanePos.copy(planePos);

      // Tangent & Normal for aircraft rotation
      const tangent = flightCurve.getTangentAt(clampedP).normalize();
      currentTangent.copy(tangent);
      const normal = planePos.clone().normalize();
      const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();
      const trueUp = new THREE.Vector3().crossVectors(tangent, binormal).normalize();

      planeGroup.matrix.makeBasis(binormal, trueUp, tangent.clone().negate());
      planeGroup.matrix.setPosition(planePos);
      planeGroup.matrixAutoUpdate = false;

      // CAMERA TRACKING (Anchored to Plane position + User Orbit Adjustments)
      const view = cameraViewRef.current;
      const { yaw, pitch, zoom } = orbitOffsetRef.current;

      // Base offset vector relative to aircraft coordinate frame
      let baseOffset = new THREE.Vector3();
      let lookTarget = planePos.clone();

      if (view === 'chase') {
        // 1. Chase Cam: Positioned behind and slightly above the aircraft looking forward
        baseOffset = normal.clone().multiplyScalar(0.24 * zoom).add(tangent.clone().multiplyScalar(-0.32 * zoom));
        lookTarget = planePos.clone().add(tangent.clone().multiplyScalar(0.25));
      } else if (view === 'satellite') {
        // 2. Satellite Cam: High-altitude top-down looking directly down onto aircraft and Earth
        baseOffset = normal.clone().multiplyScalar(0.68 * zoom);
        lookTarget = planePos.clone();
      } else if (view === 'cockpit') {
        // 3. Cockpit Cam: First-person pilot view over the nose
        baseOffset = normal.clone().multiplyScalar(0.035 * zoom).add(tangent.clone().multiplyScalar(0.02));
        lookTarget = planePos.clone().add(tangent.clone().multiplyScalar(0.8));
      } else if (view === 'wing') {
        // 4. Wing Cam: Side passenger window looking over the wing at the globe curvature
        baseOffset = binormal.clone().multiplyScalar(0.22 * zoom).add(normal.clone().multiplyScalar(0.12 * zoom)).add(tangent.clone().multiplyScalar(-0.1));
        lookTarget = planePos.clone().add(tangent.clone().multiplyScalar(0.15));
      }

      // Apply user interactive drag orbit (yaw/pitch offsets around the aircraft)
      if (yaw !== 0 || pitch !== 0) {
        baseOffset.applyAxisAngle(normal, yaw);
        baseOffset.applyAxisAngle(binormal, pitch);
      }

      const targetCamPos = planePos.clone().add(baseOffset);
      camera.position.lerp(targetCamPos, 0.15);
      camera.lookAt(lookTarget);
    };

    // 12. Interactive Drag Orbit & Mouse Wheel Listeners
    const onPointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      orbitOffsetRef.current.yaw += dx * 0.008;
      orbitOffsetRef.current.pitch = Math.max(-0.6, Math.min(0.6, orbitOffsetRef.current.pitch + dy * 0.008));
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * 0.0012;
      orbitOffsetRef.current.zoom = Math.max(0.4, Math.min(2.5, orbitOffsetRef.current.zoom + delta));
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });

    // 13. High Performance 60 FPS Render Loop: "Dünya Dönmesin & Sürekli Akan Uçuş!"
    let animId: number;
    let clock = new THREE.Clock();
    let currentRenderProgress = progressRef.current;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Clouds gently drift across the upper atmosphere without spinning the Earth
      cloudMesh.rotation.y = elapsedTime * 0.0015;

      // Pulse beacon rings
      const pulseScale = 1.0 + Math.sin(elapsedTime * 4) * 0.25;
      origBeacon.ring.scale.set(pulseScale, pulseScale, 1);
      destBeacon.ring.scale.set(pulseScale, pulseScale, 1);

      // Flashing navigation strobes
      const strobe = Math.floor(elapsedTime * 3) % 2 === 0;
      navLightPort.visible = strobe;
      navLightStbd.visible = strobe;

      // Continuous, fluid flight progression:
      if (isFlightActiveRef.current) {
        // During active flight: smooth continuous lerp towards current target
        currentRenderProgress += (progressRef.current - currentRenderProgress) * 0.08;
      } else {
        // In preview / setup mode: continuous flowing demonstration cruise along route!
        if (progressRef.current <= 0.15) {
          currentRenderProgress = (elapsedTime * 0.035) % 1.0;
        } else {
          currentRenderProgress = progressRef.current;
        }
      }

      // Track the plane along its flight path without moving Earth!
      updatePlaneAndTrackingCamera(currentRenderProgress);

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('wheel', onWheel);

      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [origin, destination]); // Only reinit if airport endpoints change; progress updates via ref!

  // Live Flight Telemetry Calculation
  const distanceKmTotal = Math.round(
    Math.hypot(destination.lat - origin.lat, destination.lng - origin.lng) * 111
  );
  const distanceCoveredKm = Math.round(distanceKmTotal * progress);
  const distanceRemainingKm = Math.max(0, distanceKmTotal - distanceCoveredKm);
  const currentSpeed = isFlightActive ? 865 : 0;
  const currentAltitude = Math.round(11280 * Math.sin(Math.max(0.08, progress) * Math.PI));

  // Determine flight stage
  const flightStage =
    progress < 0.15
      ? 'Kalkış & Tırmanış (Climb)'
      : progress > 0.85
      ? 'Alçalma & İniş (Descent)'
      : 'Seyir İrtifası (Cruise)';

  return (
    <div className="relative w-full h-full select-none overflow-hidden touch-none">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* Flight Camera Mode Switcher Pill Bar (Google Earth Style) */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 p-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 shadow-xl">
        <button
          type="button"
          onClick={() => {
            setCameraView('chase');
            resetOrbit();
          }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
            cameraView === 'chase'
              ? 'bg-[#38bdf8] text-black shadow-md'
              : 'text-neutral-300 hover:text-white'
          }`}
          title="Uçak arkasından takip kamerası"
        >
          <Navigation2 className="w-3.5 h-3.5 rotate-45" />
          <span>Uçak Takibi</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCameraView('satellite');
            resetOrbit();
          }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
            cameraView === 'satellite'
              ? 'bg-[#38bdf8] text-black shadow-md'
              : 'text-neutral-300 hover:text-white'
          }`}
          title="Tepeden uydu takip kamerası"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Uydu Bakışı</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCameraView('cockpit');
            resetOrbit();
          }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
            cameraView === 'cockpit'
              ? 'bg-[#38bdf8] text-black shadow-md'
              : 'text-neutral-300 hover:text-white'
          }`}
          title="Kokpit pilot görüşü"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Kokpit</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCameraView('wing');
            resetOrbit();
          }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
            cameraView === 'wing'
              ? 'bg-[#38bdf8] text-black shadow-md'
              : 'text-neutral-300 hover:text-white'
          }`}
          title="Yolcu penceresinden kanat görüşü"
        >
          <Plane className="w-3.5 h-3.5" />
          <span>Kanat Penceresi</span>
        </button>

        <button
          type="button"
          onClick={resetOrbit}
          className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Kamera Açısını Sıfırla"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Earth Lock Badge */}
      <div className="hidden sm:flex absolute top-3 right-3 z-10 items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-sky-500/30 text-[11px] font-mono text-sky-400">
        <Sparkles className="w-3 h-3 text-sky-300 animate-pulse" />
        <span>Dünya Sabit · Uçak Takipte</span>
      </div>

      {/* Arrival Celebration Banner at Destination */}
      {progress >= 0.95 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-6 py-3 rounded-2xl bg-black/85 backdrop-blur-md border border-sky-400/50 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="flex items-center justify-center gap-2 text-sky-400 text-sm font-black mb-0.5">
            <Plane className="w-4 h-4 fill-current rotate-45" />
            <span>{destination.city} ({destination.code}) Havalimanına İniş Tamamlandı!</span>
          </div>
          <span className="text-[11px] text-neutral-300 font-mono">
            Uçuş Rotası Başarıyla Tamamlandı · Hoş Geldiniz!
          </span>
        </div>
      )}

      {/* Live Airplane Telemetry HUD Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-black/75 backdrop-blur-md border border-white/10 text-xs font-mono shadow-2xl">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-[9px] text-neutral-400 block uppercase">ROTA</span>
            <strong className="text-white text-xs">
              {origin.code} ✈ {destination.code} ({origin.city} → {destination.city})
            </strong>
          </div>
          <div className="h-6 w-[1px] bg-white/10" />
          <div>
            <span className="text-[9px] text-neutral-400 block uppercase">AŞAMA</span>
            <strong className="text-emerald-400 text-xs">{flightStage}</strong>
          </div>
          <div className="h-6 w-[1px] bg-white/10" />
          <div>
            <span className="text-[9px] text-neutral-400 block uppercase">İRTİFA</span>
            <strong className="text-sky-400 text-xs">
              FL{Math.round(currentAltitude / 30.48)} ({currentAltitude.toLocaleString('tr-TR')} m)
            </strong>
          </div>
          <div className="h-6 w-[1px] bg-white/10" />
          <div>
            <span className="text-[9px] text-neutral-400 block uppercase">HIZ</span>
            <strong className="text-white text-xs">{currentSpeed} km/s</strong>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[9px] text-neutral-400 block uppercase">KALAN MESAFE</span>
          <strong className="text-[#ff5500] text-xs">
            {distanceRemainingKm.toLocaleString('tr-TR')} km (%{Math.round(progress * 100)})
          </strong>
        </div>
      </div>
    </div>
  );
};
