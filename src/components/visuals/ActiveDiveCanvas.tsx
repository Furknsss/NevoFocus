import React, { useEffect, useRef } from 'react';

interface ActiveDiveCanvasProps {
  progress: number; // 0 to 1
  isPaused: boolean;
  elapsedSeconds: number;
}

export const ActiveDiveCanvas: React.FC<ActiveDiveCanvasProps> = ({
  progress,
  isPaused,
  elapsedSeconds,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const progressRef = useRef(progress);
  progressRef.current = progress;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const elapsedSecondsRef = useRef(elapsedSeconds);
  elapsedSecondsRef.current = elapsedSeconds;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;
    let localDiveTimer = 0;
    let currentRenderProgress = progressRef.current;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // High quality balanced bubbles (reduced quantity, refined glass shading)
    const bubbles = Array.from({ length: 18 }, () => ({
      x: Math.random() * 2500,
      y: Math.random() * 1600,
      size: Math.random() * 3.2 + 1.6,
      speedY: -Math.random() * 4 - 2.5,
      wobbleSpeed: Math.random() * 2.5 + 1.2,
      wobbleAmp: Math.random() * 1.5 + 0.8,
      opacity: Math.random() * 0.45 + 0.2,
    }));

    // Ambient bioluminescent deep sea plankton (ethereal, subtle luminescence)
    const plankton = Array.from({ length: 26 }, () => ({
      x: Math.random() * 2500,
      y: Math.random() * 1600,
      size: Math.random() * 1.6 + 0.8,
      speedY: -Math.random() * 1.8 - 1,
      glowHue: Math.random() > 0.4 ? 178 : 196,
      pulseOffset: Math.random() * Math.PI * 2,
    }));

    // Caustics nodes for realistic underwater light refraction ripples
    const causticWaves = Array.from({ length: 12 }, (_, i) => ({
      freq: 0.008 + i * 0.004,
      speed: 1.2 + (i % 3) * 0.4,
      phase: i * 1.3,
    }));

    // Initial escape splash droplets
    const splashDrops: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      life: number;
    }[] = [];

    // Water ripple expansion rings
    const ripples: { x: number; y: number; r: number; maxR: number; alpha: number }[] = [];

    // Marine wildlife appearing smoothly across depth zones
    const marineCreatures = [
      { type: 'turtle', x: -160, targetDepthRatio: 0.16, speed: 1.1, size: 38 },
      { type: 'manta', x: 2600, targetDepthRatio: 0.40, speed: -1.2, size: 62 },
      { type: 'jellyfish_swarm', x: 420, targetDepthRatio: 0.64, speed: -0.35, size: 28 },
      { type: 'angler', x: -140, targetDepthRatio: 0.83, speed: 0.9, size: 40 },
    ];

    let hasSpawnedSplash = false;

    const render = () => {
      animId = requestAnimationFrame(render);
      const dt = 0.016;

      if (!isPausedRef.current) {
        time += dt;
        localDiveTimer += dt;
      }

      const w = canvas.width;
      const h = canvas.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Smooth progress lerp
      currentRenderProgress += (progressRef.current - currentRenderProgress) * 0.05;
      const sessionProg = Math.max(0, Math.min(1, currentRenderProgress));

      // JUMP TIMING: 3.0 seconds total escape cinematic
      const JUMP_DURATION = 3.0;
      const jumpProgress = Math.min(1, localDiveTimer / JUMP_DURATION);
      const isCinematicJumping = jumpProgress < 1.0;

      // CONTINUOUS DEPTH CALCULATION: 0 to 1 -> 0m to 1,000m
      let effectiveDepthRatio = 0;
      if (sessionProg > 0.001) {
        const microAdvancement = (elapsedSecondsRef.current > 0 ? (elapsedSecondsRef.current % 60) * 0.00015 : 0);
        effectiveDepthRatio = Math.min(1.0, sessionProg + microAdvancement);
      } else {
        if (isCinematicJumping) {
          effectiveDepthRatio = jumpProgress * 0.03;
        } else {
          const divingTime = localDiveTimer - JUMP_DURATION;
          // Smooth deep continuous journey to Balık Şehri
          effectiveDepthRatio = Math.min(1.0, 0.03 + divingTime * 0.0125);
        }
      }

      const currentDepthMeters = Math.round(effectiveDepthRatio * 1000);

      // =========================================================================
      // 1. HIGH-FIDELITY OCEAN WATER LAYERS & VOLUMETRIC GRADIENTS
      // =========================================================================
      const oceanBg = ctx.createLinearGradient(0, 0, 0, h);
      if (effectiveDepthRatio < 0.22) {
        // Epipelagic (Sunlight Zone): Rich azure sapphire into dark turquoise
        oceanBg.addColorStop(0, '#0a4253');
        oceanBg.addColorStop(0.35, '#062d3a');
        oceanBg.addColorStop(0.75, '#041d27');
        oceanBg.addColorStop(1, '#02121a');
      } else if (effectiveDepthRatio < 0.65) {
        // Mesopelagic (Twilight Zone): Oceanic indigo to deep midnight velvet
        const t = (effectiveDepthRatio - 0.22) / 0.43;
        oceanBg.addColorStop(0, `rgb(${Math.round(4 - t * 2)}, ${Math.round(26 - t * 18)}, ${Math.round(34 - t * 22)})`);
        oceanBg.addColorStop(0.5, `rgb(${Math.round(3 - t * 1)}, ${Math.round(18 - t * 12)}, ${Math.round(25 - t * 15)})`);
        oceanBg.addColorStop(1, '#01080e');
      } else {
        // Bathypelagic & Abyss (Balık Şehri radiance illuminates bottom)
        oceanBg.addColorStop(0, '#010609');
        oceanBg.addColorStop(0.45, '#020b12');
        oceanBg.addColorStop(0.85, '#041c2c');
        oceanBg.addColorStop(1, '#08334c');
      }
      ctx.fillStyle = oceanBg;
      ctx.fillRect(0, 0, w, h);

      // =========================================================================
      // 2. OCEANIC UNDERWATER CAUSTICS (Water Surface Light Patterns)
      // High-quality animated light refraction ripples across the sea
      // =========================================================================
      if (effectiveDepthRatio < 0.40) {
        const causticsAlpha = Math.max(0, (1 - effectiveDepthRatio / 0.40) * 0.12);
        ctx.save();
        ctx.globalAlpha = causticsAlpha;
        ctx.strokeStyle = '#5eead4';
        ctx.lineWidth = 1.4 * dpr;

        for (let i = 0; i < 6; i++) {
          const cy = h * (0.15 + i * 0.14) + Math.sin(time * 0.9 + i) * 15 * dpr;
          ctx.beginPath();
          for (let x = 0; x <= w; x += 30 * dpr) {
            const wave1 = Math.sin(x * 0.015 + time * 1.4 + i) * 12 * dpr;
            const wave2 = Math.cos(x * 0.025 - time * 0.8 + i * 2) * 8 * dpr;
            if (x === 0) ctx.moveTo(x, cy + wave1 + wave2);
            else ctx.lineTo(x, cy + wave1 + wave2);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // =========================================================================
      // 3. SUNLIGHT GOD RAYS (Cinematic Volumetric Light Shafts)
      // =========================================================================
      if (effectiveDepthRatio < 0.30) {
        const rayAlpha = Math.max(0, (1 - effectiveDepthRatio / 0.30) * 0.14);
        ctx.save();
        for (let i = 0; i < 4; i++) {
          const shift = Math.sin(time * 0.6 + i * 1.5) * 28 * dpr;
          const rayGrad = ctx.createLinearGradient(0, 0, 0, h);
          rayGrad.addColorStop(0, `rgba(94, 234, 212, ${rayAlpha * 1.4})`);
          rayGrad.addColorStop(0.7, `rgba(45, 212, 191, ${rayAlpha * 0.4})`);
          rayGrad.addColorStop(1, 'transparent');

          ctx.fillStyle = rayGrad;
          ctx.beginPath();
          ctx.moveTo(w * (0.12 + i * 0.24) + shift, 0);
          ctx.lineTo(w * (0.28 + i * 0.24) + shift, h);
          ctx.lineTo(w * (0.36 + i * 0.24) + shift, h);
          ctx.lineTo(w * (0.18 + i * 0.24) + shift, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Camera World Scroll Y:
      const worldScrollY = isCinematicJumping
        ? (jumpProgress > 0.5 ? (jumpProgress - 0.5) / 0.5 : 0) * (h * 0.45)
        : Math.min(h * 1.5, h * 0.45 + effectiveDepthRatio * (h * 1.05));

      // =========================================================================
      // 4. HIGH QUALITY WOODEN BOAT & DETAILED FISHERMAN
      // =========================================================================
      const surfaceY = h * 0.22 - worldScrollY;
      const boatX = w * 0.5 - 75 * dpr;
      const boatY = surfaceY - 14 * dpr;
      const boatAlpha = Math.max(0, 1 - (worldScrollY / (h * 0.4)));

      if (boatAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = boatAlpha;

        // Realistic shimmering sea surface line
        const waterGrad = ctx.createLinearGradient(0, surfaceY - 4 * dpr, 0, surfaceY + 12 * dpr);
        waterGrad.addColorStop(0, 'rgba(153, 246, 228, 0.7)');
        waterGrad.addColorStop(1, 'rgba(45, 212, 191, 0.15)');
        ctx.fillStyle = waterGrad;
        ctx.beginPath();
        ctx.moveTo(0, surfaceY);
        for (let x = 0; x <= w; x += 12 * dpr) {
          const wave = Math.sin(time * 2.2 + x * 0.015) * 5 * dpr;
          ctx.lineTo(x, surfaceY + wave);
        }
        ctx.lineTo(w, surfaceY + 14 * dpr);
        ctx.lineTo(0, surfaceY + 14 * dpr);
        ctx.closePath();
        ctx.fill();

        // Rocking boat
        const rock = Math.sin(time * 1.6) * 0.035;
        ctx.translate(boatX, boatY);
        ctx.rotate(rock);

        // Boat Hull Shading
        const hullGrad = ctx.createLinearGradient(0, 0, 0, 26 * dpr);
        hullGrad.addColorStop(0, '#854d0e');
        hullGrad.addColorStop(0.5, '#713f12');
        hullGrad.addColorStop(1, '#451a03');
        ctx.fillStyle = hullGrad;
        ctx.beginPath();
        ctx.moveTo(-82 * dpr, 0);
        ctx.quadraticCurveTo(-70 * dpr, 26 * dpr, -55 * dpr, 26 * dpr);
        ctx.lineTo(65 * dpr, 26 * dpr);
        ctx.quadraticCurveTo(80 * dpr, 24 * dpr, 88 * dpr, 0);
        ctx.closePath();
        ctx.fill();

        // Wooden Hull Details & Rim
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 2.5 * dpr;
        ctx.stroke();

        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.moveTo(-74 * dpr, 10 * dpr);
        ctx.lineTo(76 * dpr, 10 * dpr);
        ctx.moveTo(-62 * dpr, 19 * dpr);
        ctx.lineTo(62 * dpr, 19 * dpr);
        ctx.stroke();

        // Detailed Fisherman
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.ellipse(-20 * dpr, -6 * dpr, 13 * dpr, 17 * dpr, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(-20 * dpr, -27 * dpr, 8.5 * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Straw Hat with woven band
        ctx.fillStyle = '#ca8a04';
        ctx.beginPath();
        ctx.ellipse(-20 * dpr, -32 * dpr, 21 * dpr, 4.5 * dpr, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a16207';
        ctx.beginPath();
        ctx.arc(-20 * dpr, -34 * dpr, 10 * dpr, Math.PI, 0);
        ctx.fill();

        // Fishing Rod
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(-15 * dpr, -15 * dpr);
        ctx.lineTo(-76 * dpr, -54 * dpr);
        ctx.stroke();

        // Fisherman's bucket from which the fish leaped!
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.roundRect(26 * dpr, -14 * dpr, 22 * dpr, 18 * dpr, 3 * dpr);
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();

        // Water shine inside bucket
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(28 * dpr, -13 * dpr, 18 * dpr, 5 * dpr);

        ctx.restore();
      }

      // =========================================================================
      // 5. HIGH-QUALITY BALIK ŞEHRİ (ATLANTIS-LIKE BIOLUMINESCENT METROPOLIS)
      // Multi-layer underwater architecture, glowing spires, palace arches,
      // coral gardens, crystal bridges, and resident sea citizens!
      // =========================================================================
      const cityAlpha = Math.min(1, Math.max(0, (effectiveDepthRatio - 0.45) / 0.42));
      if (cityAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = cityAlpha;

        const cityRiseProgress = Math.min(1, Math.max(0, (effectiveDepthRatio - 0.45) / 0.55));
        const cityBaseY = h * 1.28 - cityRiseProgress * (h * 0.40);

        // Ambient city aurora illumination radiating from the seafloor
        const cityRadiance = ctx.createRadialGradient(
          w * 0.5,
          cityBaseY - 80 * dpr,
          30 * dpr,
          w * 0.5,
          cityBaseY - 80 * dpr,
          w * 0.95
        );
        cityRadiance.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
        cityRadiance.addColorStop(0.35, 'rgba(20, 184, 166, 0.28)');
        cityRadiance.addColorStop(0.7, 'rgba(14, 116, 144, 0.15)');
        cityRadiance.addColorStop(1, 'transparent');
        ctx.fillStyle = cityRadiance;
        ctx.fillRect(0, 0, w, h);

        // --- LAYER A: BACKGROUND SILHOUETTE CITADEL SPIRES ---
        const bgSpires = [
          { x: w * 0.08, w: 45 * dpr, h: 220 * dpr, color: '#0369a1' },
          { x: w * 0.22, w: 60 * dpr, h: 290 * dpr, color: '#0f766e' },
          { x: w * 0.40, w: 75 * dpr, h: 360 * dpr, color: '#0284c7' },
          { x: w * 0.60, w: 75 * dpr, h: 350 * dpr, color: '#0f766e' },
          { x: w * 0.78, w: 60 * dpr, h: 280 * dpr, color: '#0369a1' },
          { x: w * 0.92, w: 45 * dpr, h: 210 * dpr, color: '#0f766e' },
        ];
        bgSpires.forEach((sp) => {
          ctx.fillStyle = '#021824';
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.lineWidth = 1.5 * dpr;
          ctx.beginPath();
          ctx.moveTo(sp.x - sp.w * 0.5, cityBaseY);
          ctx.lineTo(sp.x, cityBaseY - sp.h);
          ctx.lineTo(sp.x + sp.w * 0.5, cityBaseY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Spire pinnacle crystal light
          ctx.fillStyle = '#67e8f9';
          ctx.beginPath();
          ctx.arc(sp.x, cityBaseY - sp.h, 3 * dpr, 0, Math.PI * 2);
          ctx.fill();
        });

        // --- LAYER B: HIGH-TECH CRYSTAL TOWERS & DOMES OF BALIK ŞEHRİ ---
        const mainPalaces = [
          { x: w * 0.16, w: 70 * dpr, h: 190 * dpr, domeR: 35 * dpr, accent: '#38bdf8' },
          { x: w * 0.33, w: 95 * dpr, h: 270 * dpr, domeR: 48 * dpr, accent: '#2dd4bf' },
          { x: w * 0.50, w: 140 * dpr, h: 360 * dpr, domeR: 70 * dpr, accent: '#67e8f9', isCapital: true },
          { x: w * 0.67, w: 95 * dpr, h: 260 * dpr, domeR: 48 * dpr, accent: '#2dd4bf' },
          { x: w * 0.84, w: 70 * dpr, h: 180 * dpr, domeR: 35 * dpr, accent: '#38bdf8' },
        ];

        mainPalaces.forEach((p) => {
          const topY = cityBaseY - p.h;

          // Tower Body with Glass Gradient
          const towerGrad = ctx.createLinearGradient(p.x - p.w * 0.5, 0, p.x + p.w * 0.5, 0);
          towerGrad.addColorStop(0, '#041f2d');
          towerGrad.addColorStop(0.5, '#08334a');
          towerGrad.addColorStop(1, '#041f2d');

          ctx.fillStyle = towerGrad;
          ctx.strokeStyle = p.accent;
          ctx.lineWidth = 2 * dpr;

          ctx.beginPath();
          ctx.moveTo(p.x - p.w * 0.5, cityBaseY);
          ctx.lineTo(p.x - p.w * 0.38, topY + p.domeR * 0.6);
          ctx.lineTo(p.x + p.w * 0.38, topY + p.domeR * 0.6);
          ctx.lineTo(p.x + p.w * 0.5, cityBaseY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Luminescent Biodome Roof
          const domeGrad = ctx.createRadialGradient(p.x, topY, 5 * dpr, p.x, topY, p.domeR);
          domeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
          domeGrad.addColorStop(0.35, p.accent);
          domeGrad.addColorStop(1, 'rgba(4, 31, 45, 0.8)');
          ctx.fillStyle = domeGrad;
          ctx.beginPath();
          ctx.arc(p.x, topY + p.domeR * 0.6, p.domeR, Math.PI, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5 * dpr;
          ctx.stroke();

          // Spire Needle Antenna
          ctx.strokeStyle = '#67e8f9';
          ctx.lineWidth = 2 * dpr;
          ctx.beginPath();
          ctx.moveTo(p.x, topY - p.domeR * 0.4);
          ctx.lineTo(p.x, topY - p.domeR * 0.4 - 32 * dpr);
          ctx.stroke();

          // Pulsing Beacon on Spire Top
          const beaconPulse = 0.5 + 0.5 * Math.sin(time * 4 + p.x);
          ctx.fillStyle = `rgba(103, 232, 249, ${beaconPulse})`;
          ctx.beginPath();
          ctx.arc(p.x, topY - p.domeR * 0.4 - 32 * dpr, 4.5 * dpr, 0, Math.PI * 2);
          ctx.fill();

          // Bioluminescent Tiered Palace Windows
          const windowRows = p.isCapital ? 6 : 4;
          for (let r = 0; r < windowRows; r++) {
            const winY = cityBaseY - 45 * dpr - r * 38 * dpr;
            if (winY > topY + p.domeR) {
              const winCount = p.isCapital ? 4 : 2;
              for (let c = 0; c < winCount; c++) {
                const winX = p.x + (c - (winCount - 1) * 0.5) * (18 * dpr);
                const winGlow = 0.6 + 0.4 * Math.sin(time * 3 + winX * 0.05 + r);
                ctx.fillStyle = `rgba(103, 232, 249, ${winGlow})`;
                ctx.beginPath();
                ctx.roundRect(winX - 4 * dpr, winY - 6 * dpr, 8 * dpr, 12 * dpr, 3 * dpr);
                ctx.fill();
              }
            }
          }
        });

        // --- LAYER C: ELEVATED AQUA BRIDGES (Connecting the towers) ---
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 2.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(w * 0.16, cityBaseY - 120 * dpr);
        ctx.quadraticCurveTo(w * 0.245, cityBaseY - 140 * dpr, w * 0.33, cityBaseY - 130 * dpr);
        ctx.quadraticCurveTo(w * 0.415, cityBaseY - 160 * dpr, w * 0.50, cityBaseY - 145 * dpr);
        ctx.quadraticCurveTo(w * 0.585, cityBaseY - 160 * dpr, w * 0.67, cityBaseY - 130 * dpr);
        ctx.quadraticCurveTo(w * 0.755, cityBaseY - 140 * dpr, w * 0.84, cityBaseY - 120 * dpr);
        ctx.stroke();

        // --- LAYER D: GRAND ROYAL PALACE GATE (The Final Freedom Gate!) ---
        const gateX = w * 0.5;
        const gateW = 80 * dpr;
        const gateH = 100 * dpr;
        const gateY = cityBaseY - gateH * 0.6;

        // Radiant portal gradient inside the archway
        const portalGrad = ctx.createRadialGradient(gateX, gateY, 5 * dpr, gateX, gateY, gateW * 0.7);
        portalGrad.addColorStop(0, '#ffffff');
        portalGrad.addColorStop(0.35, '#38bdf8');
        portalGrad.addColorStop(0.7, '#0891b2');
        portalGrad.addColorStop(1, 'rgba(2, 24, 36, 0.9)');

        ctx.fillStyle = portalGrad;
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 4 * dpr;
        ctx.beginPath();
        ctx.arc(gateX, gateY - 20 * dpr, gateW * 0.5, Math.PI, 0);
        ctx.lineTo(gateX + gateW * 0.5, cityBaseY);
        ctx.lineTo(gateX - gateW * 0.5, cityBaseY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Ornate palace columns flanking the portal
        [-1, 1].forEach((dir) => {
          const colX = gateX + dir * (gateW * 0.55);
          ctx.fillStyle = '#0e7490';
          ctx.beginPath();
          ctx.roundRect(colX - 6 * dpr, gateY - 35 * dpr, 12 * dpr, cityBaseY - (gateY - 35 * dpr), 4 * dpr);
          ctx.fill();
          ctx.strokeStyle = '#a5f3fc';
          ctx.lineWidth = 1.5 * dpr;
          ctx.stroke();

          // Column beacon crystal
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(colX, gateY - 38 * dpr, 4 * dpr, 0, Math.PI * 2);
          ctx.fill();
        });

        // --- LAYER E: RESIDENT FISH CITIZEN SCHOOLS CELEBRATING ---
        for (let i = 0; i < 16; i++) {
          const schoolX = w * 0.18 + (i * 48 * dpr) % (w * 0.64) + Math.sin(time * 2.5 + i * 0.8) * 20 * dpr;
          const schoolY = cityBaseY - 80 * dpr + Math.cos(time * 1.8 + i * 0.6) * 24 * dpr;
          const schoolHue = i % 2 === 0 ? '#38bdf8' : '#2dd4bf';

          ctx.fillStyle = schoolHue;
          ctx.beginPath();
          ctx.ellipse(schoolX, schoolY, 7 * dpr, 3.5 * dpr, Math.sin(time + i) * 0.2, 0, Math.PI * 2);
          ctx.fill();

          // Mini tail flutter
          ctx.beginPath();
          ctx.moveTo(schoolX - 6 * dpr, schoolY);
          ctx.lineTo(schoolX - 11 * dpr, schoolY - 3 * dpr);
          ctx.lineTo(schoolX - 11 * dpr, schoolY + 3 * dpr);
          ctx.closePath();
          ctx.fill();
        }

        // --- LAYER F: LUMINOUS CORAL SEABED REEF & ANEMONES ---
        const reefGrad = ctx.createLinearGradient(0, cityBaseY - 25 * dpr, 0, h);
        reefGrad.addColorStop(0, '#042838');
        reefGrad.addColorStop(1, '#02121a');
        ctx.fillStyle = reefGrad;
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(0, cityBaseY + 15 * dpr);
        for (let x = 0; x <= w; x += 35 * dpr) {
          const reefWave = Math.sin(x * 0.02) * 14 * dpr + Math.cos(x * 0.05) * 6 * dpr;
          ctx.lineTo(x, cityBaseY + 10 * dpr + reefWave);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      // =========================================================================
      // 6. DETAILED PASSING MARINE CREATURES ACROSS DEPTHS
      // =========================================================================
      marineCreatures.forEach((c) => {
        const creatureDist = Math.abs(effectiveDepthRatio - c.targetDepthRatio);
        if (creatureDist < 0.22) {
          c.x += c.speed * dpr * 1.8;
          if (c.speed > 0 && c.x > w + 160) c.x = -160;
          if (c.speed < 0 && c.x < -160) c.x = w + 160;

          const cy = h * 0.5 + (c.targetDepthRatio - effectiveDepthRatio) * h * 1.8 + Math.sin(time * 1.4 + c.x * 0.01) * 18 * dpr;

          if (c.type === 'turtle') {
            ctx.save();
            ctx.translate(c.x, cy);
            // Turtle Shell with Pattern
            ctx.fillStyle = '#0d9488';
            ctx.beginPath();
            ctx.ellipse(0, 0, c.size * dpr, c.size * 0.65 * dpr, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#2dd4bf';
            ctx.lineWidth = 1.5 * dpr;
            ctx.stroke();

            // Shell scutes
            ctx.fillStyle = '#115e59';
            ctx.beginPath();
            ctx.ellipse(0, 0, c.size * 0.5 * dpr, c.size * 0.35 * dpr, 0, 0, Math.PI * 2);
            ctx.fill();

            // Flippers
            const fWave = Math.sin(time * 3) * 6 * dpr;
            ctx.fillStyle = '#14b8a6';
            ctx.beginPath();
            ctx.ellipse(14 * dpr, -15 * dpr + fWave, 13 * dpr, 5 * dpr, -0.4, 0, Math.PI * 2);
            ctx.ellipse(14 * dpr, 15 * dpr - fWave, 13 * dpr, 5 * dpr, 0.4, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.beginPath();
            ctx.arc(c.size * dpr + 4 * dpr, 0, 7 * dpr, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else if (c.type === 'manta') {
            ctx.save();
            ctx.translate(c.x, cy);
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.8 * dpr;
            const wingFlap = Math.sin(time * 2.2) * 11 * dpr;
            ctx.beginPath();
            ctx.moveTo(-c.size * dpr, 0);
            ctx.quadraticCurveTo(0, -wingFlap - 14 * dpr, c.size * dpr, 0);
            ctx.quadraticCurveTo(0, wingFlap + 14 * dpr, -c.size * dpr, 0);
            ctx.fill();
            ctx.stroke();

            // Luminous wing tips
            ctx.fillStyle = '#67e8f9';
            ctx.beginPath();
            ctx.arc(-c.size * dpr + 6 * dpr, 0, 2.5 * dpr, 0, Math.PI * 2);
            ctx.arc(c.size * dpr - 6 * dpr, 0, 2.5 * dpr, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else if (c.type === 'jellyfish_swarm') {
            ctx.save();
            ctx.translate(c.x, cy);
            const pulse = Math.sin(time * 2.5) * 4 * dpr;
            // Bell dome
            const jGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, c.size * 0.7 * dpr);
            jGrad.addColorStop(0, 'rgba(244, 114, 182, 0.85)');
            jGrad.addColorStop(1, 'rgba(192, 132, 252, 0.3)');
            ctx.fillStyle = jGrad;
            ctx.beginPath();
            ctx.arc(0, 0, c.size * 0.6 * dpr + pulse, Math.PI, 0);
            ctx.fill();
            ctx.strokeStyle = 'rgba(232, 121, 249, 0.8)';
            ctx.lineWidth = 1.4 * dpr;
            ctx.stroke();

            // Flowing bioluminescent tentacles
            for (let t = -12; t <= 12; t += 6) {
              ctx.beginPath();
              ctx.moveTo(t * dpr, 0);
              ctx.quadraticCurveTo(
                t * dpr + Math.sin(time * 3 + t) * 7 * dpr,
                22 * dpr,
                t * dpr,
                42 * dpr
              );
              ctx.stroke();
            }
            ctx.restore();
          } else if (c.type === 'angler') {
            ctx.save();
            ctx.translate(c.x, cy);
            ctx.fillStyle = '#090d16';
            ctx.beginPath();
            ctx.ellipse(0, 0, c.size * dpr, c.size * 0.7 * dpr, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 1.8 * dpr;
            ctx.stroke();

            // Glowing Angler Lure
            ctx.beginPath();
            ctx.moveTo(c.size * 0.8 * dpr, -c.size * 0.3 * dpr);
            ctx.quadraticCurveTo(c.size * 1.2 * dpr, -c.size * 1.1 * dpr, c.size * 0.9 * dpr, -c.size * 0.9 * dpr);
            ctx.stroke();
            const lurePulse = 0.6 + 0.4 * Math.sin(time * 5);
            ctx.fillStyle = `rgba(103, 232, 249, ${lurePulse})`;
            ctx.beginPath();
            ctx.arc(c.size * 0.9 * dpr, -c.size * 0.9 * dpr, 6 * dpr, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      });

      // =========================================================================
      // 7. HIGH-QUALITY GLASS BUBBLES & BIOLUMINESCENT PLANKTON
      // Controlled, crisp glass refraction circles (clean & elegant, not cluttered)
      // =========================================================================
      bubbles.forEach((b) => {
        b.y += b.speedY * dpr;
        b.x += Math.sin(time * b.wobbleSpeed) * b.wobbleAmp * 0.35 * dpr;
        if (b.y < -30) {
          b.y = h + 30;
          b.x = Math.random() * w;
        }

        // Glass sphere shading
        const bGrad = ctx.createRadialGradient(
          b.x - b.size * 0.3 * dpr,
          b.y - b.size * 0.3 * dpr,
          b.size * 0.1 * dpr,
          b.x,
          b.y,
          b.size * dpr
        );
        bGrad.addColorStop(0, `rgba(255, 255, 255, ${b.opacity * 0.9})`);
        bGrad.addColorStop(0.6, `rgba(186, 230, 253, ${b.opacity * 0.3})`);
        bGrad.addColorStop(1, `rgba(56, 189, 248, ${b.opacity * 0.1})`);

        ctx.fillStyle = bGrad;
        ctx.strokeStyle = `rgba(255, 255, 255, ${b.opacity * 0.7})`;
        ctx.lineWidth = 0.9 * dpr;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // Ambient bioluminescent plankton dust
      plankton.forEach((p) => {
        p.y += p.speedY * dpr;
        if (p.y < -20) {
          p.y = h + 20;
          p.x = Math.random() * w;
        }
        const pulse = 0.4 + 0.6 * Math.sin(time * 2.8 + p.pulseOffset);
        ctx.fillStyle = `hsla(${p.glowHue}, 90%, 65%, ${pulse * 0.7})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * dpr, 0, Math.PI * 2);
        ctx.fill();
      });

      // =========================================================================
      // 8. HERO ESCAPING GOLDEN FISH (ORGANIC SWIMMING, NO TELEPORTATION)
      // =========================================================================
      let fishX = w * 0.5;
      let fishY = h * 0.46;
      let fishAngle = Math.PI * 0.5;
      let fishScale = 1.0;

      const boatDeckX = boatX + 35 * dpr;
      const boatDeckY = boatY - 14 * dpr;
      const waterEntryX = boatX + 120 * dpr;
      const waterEntryY = surfaceY + 14 * dpr;

      if (isCinematicJumping) {
        if (jumpProgress <= 0.60) {
          const tAir = jumpProgress / 0.60;
          fishX = boatDeckX + (waterEntryX - boatDeckX) * tAir;
          const arcHeight = 90 * dpr * Math.sin(tAir * Math.PI);
          fishY = boatDeckY + (waterEntryY - boatDeckY) * tAir - arcHeight;
          fishAngle = -0.4 + tAir * 2.1;
        } else {
          const tDive = (jumpProgress - 0.60) / 0.40;

          if (!hasSpawnedSplash) {
            hasSpawnedSplash = true;
            for (let i = 0; i < 28; i++) {
              const ang = Math.PI + (Math.random() - 0.5) * 1.8;
              const spd = Math.random() * 8 + 3;
              splashDrops.push({
                x: waterEntryX,
                y: waterEntryY,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                size: Math.random() * 3.2 + 1.2,
                life: 1.0,
              });
            }
            ripples.push({
              x: waterEntryX,
              y: waterEntryY,
              r: 8 * dpr,
              maxR: 90 * dpr,
              alpha: 1.0,
            });
          }

          const targetCruisingY = h * 0.46;
          fishX = waterEntryX + (w * 0.5 - waterEntryX) * tDive;
          fishY = waterEntryY + (targetCruisingY - waterEntryY) * tDive;
          fishAngle = Math.PI * 0.5 + Math.sin(time * 4) * 0.12;
        }
      } else {
        // Continuous, Never-Teleporting Deep Ocean Navigation
        const sway1 = Math.sin(time * 1.8) * 45 * dpr;
        const sway2 = Math.cos(time * 0.9) * 22 * dpr;
        fishX = w * 0.5 + sway1 + sway2;

        const tailThrust = Math.sin(time * 5.5);
        const naturalSurge = Math.max(0, tailThrust) * 7 * dpr;
        const verticalBob = Math.sin(time * 1.3) * 14 * dpr;

        let gateApproachY = 0;
        if (effectiveDepthRatio > 0.85) {
          const gateT = (effectiveDepthRatio - 0.85) / 0.15;
          gateApproachY = gateT * (h * 0.24);
        }

        fishY = h * 0.44 + verticalBob + naturalSurge + gateApproachY;

        const horizontalVelocity = (Math.cos(time * 1.8) * 45 * 1.8 - Math.sin(time * 0.9) * 22 * 0.9) * 0.005;
        const tailKickAngle = Math.cos(time * 5.5) * 0.12;
        fishAngle = Math.PI * 0.5 + horizontalVelocity + tailKickAngle;

        if (effectiveDepthRatio >= 0.92) {
          const entryT = (effectiveDepthRatio - 0.92) / 0.08;
          fishScale = 1.0 - entryT * 0.38;
        }
      }

      // Splash ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        rip.r += 2.5 * dpr;
        rip.alpha = Math.max(0, 1 - rip.r / rip.maxR);
        if (rip.alpha <= 0.02) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(255, 255, 255, ${rip.alpha * 0.85})`;
        ctx.lineWidth = 2.2 * dpr;
        ctx.beginPath();
        ctx.ellipse(rip.x, rip.y, rip.r, rip.r * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Splash drops
      for (let i = splashDrops.length - 1; i >= 0; i--) {
        const drop = splashDrops[i];
        drop.x += drop.vx * dpr;
        drop.y += drop.vy * dpr;
        drop.vy += 0.35 * dpr;
        drop.life -= 0.022;

        if (drop.life <= 0) {
          splashDrops.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${drop.life * 0.9})`;
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.size * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // High-quality tail bubble stream (clean, non-cluttered)
      if (!isPausedRef.current && Math.random() < 0.22) {
        bubbles.push({
          x: fishX + (Math.random() - 0.5) * 10 * dpr,
          y: fishY + 22 * dpr,
          size: Math.random() * 2.2 + 1.2,
          speedY: -Math.random() * 4 - 3,
          wobbleSpeed: 4,
          wobbleAmp: 1.5,
          opacity: 0.7,
        });
        if (bubbles.length > 25) {
          bubbles.shift();
        }
      }

      // =========================================================================
      // 9. HIGH RESOLUTION HERO FISH VECTOR MODEL
      // =========================================================================
      ctx.save();
      ctx.translate(fishX, fishY);
      ctx.rotate(fishAngle);
      ctx.scale(fishScale, fishScale);

      // Bioluminescent golden radiance
      const fishHalo = ctx.createRadialGradient(0, 0, 3, 0, 0, 36 * dpr);
      fishHalo.addColorStop(0, 'rgba(251, 146, 60, 0.95)');
      fishHalo.addColorStop(0.4, 'rgba(249, 115, 22, 0.4)');
      fishHalo.addColorStop(1, 'transparent');
      ctx.fillStyle = fishHalo;
      ctx.beginPath();
      ctx.arc(0, 0, 36 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // Fish Body Shading (Rich Koi Orange with belly highlight)
      const bodyGrad = ctx.createRadialGradient(4 * dpr, -2 * dpr, 3 * dpr, 0, 0, 22 * dpr);
      bodyGrad.addColorStop(0, '#fdba74');
      bodyGrad.addColorStop(0.4, '#ea580c');
      bodyGrad.addColorStop(1, '#9a3412');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 23 * dpr, 12.5 * dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Propulsive Tail Fin
      const tailWag = Math.sin(time * 11) * 9.5 * dpr;
      const finGrad = ctx.createLinearGradient(-18 * dpr, 0, -34 * dpr, 0);
      finGrad.addColorStop(0, '#f97316');
      finGrad.addColorStop(1, '#ea580c');
      ctx.fillStyle = finGrad;
      ctx.beginPath();
      ctx.moveTo(-18 * dpr, 0);
      ctx.lineTo(-34 * dpr, -13 * dpr + tailWag);
      ctx.lineTo(-28 * dpr, 0);
      ctx.lineTo(-34 * dpr, 13 * dpr + tailWag);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fdba74';
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();

      // Elegant clownfish stripes
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.roundRect(-4 * dpr, -11.5 * dpr, 5 * dpr, 23 * dpr, 2 * dpr);
      ctx.roundRect(8 * dpr, -9.5 * dpr, 4.5 * dpr, 19 * dpr, 2 * dpr);
      ctx.fill();

      // Expressive eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(14 * dpr, -4 * dpr, 4.8 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(15.5 * dpr, -4 * dpr, 2.5 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(16.5 * dpr, -5 * dpr, 1.1 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // Pectoral flipper fin
      const finFlutter = Math.sin(time * 9) * 3 * dpr;
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.ellipse(2 * dpr, 10 * dpr + finFlutter, 7 * dpr, 3.5 * dpr, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fdba74';
      ctx.lineWidth = 0.8 * dpr;
      ctx.stroke();

      ctx.restore();

      // =========================================================================
      // 10. VICTORY CELEBRATION PARTICLES (Balık Şehri Reached!)
      // =========================================================================
      if (effectiveDepthRatio >= 0.98) {
        // Celebration floating golden sparkles in fish city waters
        for (let i = 0; i < 14; i++) {
          const bx = w * 0.5 + Math.sin(time * 3 + i) * 85 * dpr;
          const by = h * 0.55 - ((time * 40 + i * 32) % (h * 0.42));
          ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
          ctx.beginPath();
          ctx.arc(bx, by, 3.5 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};
