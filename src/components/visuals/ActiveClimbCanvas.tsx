import React, { useEffect, useRef, useState } from 'react';
import { getStoredMountainDesign, MOUNTAIN_PRESETS, MountainDesignConfig } from '../../utils/mountainDesign';

interface ActiveClimbCanvasProps {
  progress: number; // 0 to 1
  isPaused: boolean;
  isCampActive: boolean;
  elapsedSeconds: number;
  breakSeconds: number;
  mountainDesign?: MountainDesignConfig;
}

export const ActiveClimbCanvas: React.FC<ActiveClimbCanvasProps> = ({
  progress,
  isPaused,
  isCampActive,
  elapsedSeconds,
  breakSeconds,
  mountainDesign,
}) => {
  const [currentDesign, setCurrentDesign] = useState<MountainDesignConfig>(mountainDesign || getStoredMountainDesign());

  useEffect(() => {
    if (mountainDesign) {
      setCurrentDesign(mountainDesign);
    }
  }, [mountainDesign]);

  useEffect(() => {
    const handleDesignUpdate = (e: any) => {
      if (e.detail) {
        setCurrentDesign(e.detail);
      }
    };
    window.addEventListener('fokus_mountain_design_updated', handleDesignUpdate);
    return () => window.removeEventListener('fokus_mountain_design_updated', handleDesignUpdate);
  }, []);

  const designRef = useRef(currentDesign);
  designRef.current = currentDesign;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const isCampActiveRef = useRef(isCampActive);
  isCampActiveRef.current = isCampActive;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;
    let smoothProgress = progressRef.current;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Multi-layered continuous snow & wind particles
    const snowflakes = Array.from({ length: 85 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 1200,
      size: Math.random() * 2.5 + 0.8,
      speedX: -Math.random() * 2.5 - 1.2,
      speedY: Math.random() * 1.6 + 0.8,
      opacity: Math.random() * 0.7 + 0.3,
    }));

    // Campfire embers
    const embers = Array.from({ length: 35 }, () => ({
      x: 0,
      y: 0,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -Math.random() * 2.5 - 1.0,
      life: Math.random(),
    }));

    // Twinkling summit stars
    const stars = Array.from({ length: 110 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 800,
      size: Math.random() * 1.8 + 0.5,
      speed: Math.random() * 0.05 + 0.02,
      offset: Math.random() * Math.PI * 2,
    }));

    const render = () => {
      animId = requestAnimationFrame(render);
      if (!isPausedRef.current || isCampActiveRef.current) {
        time += 0.016;
      }

      // Smooth progression interpolation for silky fluid movement
      smoothProgress += (progressRef.current - smoothProgress) * 0.05;

      const w = canvas.width;
      const h = canvas.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      ctx.clearRect(0, 0, w, h);

      const camping = isCampActiveRef.current;

      const design = designRef.current;
      const preset = MOUNTAIN_PRESETS.find((p) => p.id === design.style) || MOUNTAIN_PRESETS[0];

      // 1. SKY GRADIENT (Smooth daylight-to-alpine-twilight transition based on progress & camp)
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      if (camping) {
        // Midnight Violet Campfire Sky
        sky.addColorStop(0, '#04020a');
        sky.addColorStop(0.4, '#0a0518');
        sky.addColorStop(0.8, '#180a22');
        sky.addColorStop(1, '#0e0414');
      } else {
        // Preset sky transitioning smoothly towards summit dawn
        const dawnShift = Math.min(1, smoothProgress);
        sky.addColorStop(0, preset.skyTop);
        sky.addColorStop(0.4, preset.skyBottom);
        sky.addColorStop(1, dawnShift > 0.7 ? '#4a1e35' : preset.skyBottom);
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // 2. STARS & AURORA BOREALIS MIST
      stars.forEach((s) => {
        const twinkle = Math.sin(time * 2 + s.offset) * 0.35 + 0.65;
        ctx.fillStyle = `rgba(255, 255, 255, ${camping ? twinkle * 0.95 : twinkle * 0.65})`;
        ctx.beginPath();
        ctx.arc((s.x / 2000) * w, (s.y / 800) * h * 0.6, s.size * dpr, 0, Math.PI * 2);
        ctx.fill();
      });

      // Distant mountain ranges with subtle horizontal parallax flow
      const bgShift = (time * 8) % (w * 0.3);
      ctx.fillStyle = '#120c1d';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * 0.65);
      ctx.lineTo(w * 0.18, h * 0.52);
      ctx.lineTo(w * 0.38, h * 0.62);
      ctx.lineTo(w * 0.68, h * 0.44);
      ctx.lineTo(w * 0.88, h * 0.56);
      ctx.lineTo(w, h * 0.48);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // 3. HERO MOUNTAIN MASSIF (Kaçkar / Everest Summit)
      const summitX = w * 0.52;
      const summitY = h * 0.20;
      const baseLeftX = w * 0.05;
      const baseRightX = w * 0.96;

      const mtnGrad = ctx.createLinearGradient(summitX, summitY, summitX, h);
      mtnGrad.addColorStop(0, preset.mountainColor);
      mtnGrad.addColorStop(0.5, '#191024');
      mtnGrad.addColorStop(1, '#0e0816');
      ctx.fillStyle = mtnGrad;

      ctx.beginPath();
      ctx.moveTo(baseLeftX, h);
      ctx.lineTo(summitX, summitY);
      ctx.lineTo(baseRightX, h);
      ctx.closePath();
      ctx.fill();

      // Mountain Snow Crest & Glacial Caps
      ctx.fillStyle = camping ? '#7e8f9e' : preset.capColor;
      ctx.beginPath();
      ctx.moveTo(summitX, summitY);
      ctx.lineTo(summitX + 70 * dpr, summitY + 95 * dpr);
      ctx.lineTo(summitX + 30 * dpr, summitY + 75 * dpr);
      ctx.lineTo(summitX - 15 * dpr, summitY + 110 * dpr);
      ctx.lineTo(summitX - 55 * dpr, summitY + 80 * dpr);
      ctx.closePath();
      ctx.fill();

      // Glacial blue shadow on ice
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.beginPath();
      ctx.moveTo(summitX, summitY);
      ctx.lineTo(summitX - 55 * dpr, summitY + 80 * dpr);
      ctx.lineTo(summitX - 10 * dpr, summitY + 50 * dpr);
      ctx.closePath();
      ctx.fill();

      // 4. CONTINUOUS TRAIL WAYPOINTS & PATH (Elevated and centered so climber is always fully visible)
      const waypoints = [
        { x: w * 0.76, y: h * 0.70, name: 'Ana Kamp (1,850m)' },
        { x: w * 0.67, y: h * 0.54, name: 'Buzul Sırtı (2,600m)' },
        { x: w * 0.58, y: h * 0.38, name: 'İleri Kamp (3,200m)' },
        { x: summitX, y: summitY, name: 'Kaçkar Zirvesi (3,937m)' },
      ];

      // Draw flowing dashed climbing route
      ctx.save();
      ctx.strokeStyle = design.trailGlowColor || 'rgba(249, 115, 22, 0.5)';
      ctx.lineWidth = 2.8 * dpr;
      ctx.setLineDash([7 * dpr, 7 * dpr]);
      ctx.lineDashOffset = -time * 18; // CONTINUOUS FLOWING TRAIL DASHES!
      ctx.beginPath();
      ctx.moveTo(waypoints[0].x, waypoints[0].y);
      ctx.quadraticCurveTo(w * 0.72, h * 0.62, waypoints[1].x, waypoints[1].y);
      ctx.quadraticCurveTo(w * 0.63, h * 0.46, waypoints[2].x, waypoints[2].y);
      ctx.quadraticCurveTo(summitX + 25 * dpr, summitY + 25 * dpr, waypoints[3].x, waypoints[3].y);
      ctx.stroke();
      ctx.restore();

      // Calculate smooth climber coordinates along the continuous path
      const p = Math.max(0, Math.min(1, smoothProgress));
      let climberX = waypoints[0].x;
      let climberY = waypoints[0].y;

      if (p <= 0.33) {
        const t = p / 0.33;
        climberX = waypoints[0].x + (waypoints[1].x - waypoints[0].x) * t;
        climberY = waypoints[0].y + (waypoints[1].y - waypoints[0].y) * t;
      } else if (p <= 0.66) {
        const t = (p - 0.33) / 0.33;
        climberX = waypoints[1].x + (waypoints[2].x - waypoints[1].x) * t;
        climberY = waypoints[1].y + (waypoints[2].y - waypoints[1].y) * t;
      } else {
        const t = (p - 0.66) / 0.34;
        climberX = waypoints[2].x + (waypoints[3].x - waypoints[2].x) * t;
        climberY = waypoints[2].y + (waypoints[3].y - waypoints[2].y) * t;
      }

      // Add gentle stepping bounce when climbing actively
      const stepCycle = time * 8;
      const walkBounce = (!camping && !isPausedRef.current) ? Math.abs(Math.sin(stepCycle)) * 4 * dpr : 0;

      // 5. CAMP MODE (Ateş, Çadır, Mola Dinlenmesi)
      if (camping) {
        const campX = climberX;
        const campY = climberY;

        // Warm flickering campfire light dome
        const flicker = Math.sin(time * 12) * 8 * dpr + Math.cos(time * 18) * 4 * dpr;
        const fireGlow = ctx.createRadialGradient(
          campX,
          campY - 12 * dpr,
          2,
          campX,
          campY - 12 * dpr,
          65 * dpr + flicker
        );
        fireGlow.addColorStop(0, 'rgba(255, 140, 0, 0.9)');
        fireGlow.addColorStop(0.35, 'rgba(234, 88, 12, 0.45)');
        fireGlow.addColorStop(0.7, 'rgba(194, 65, 12, 0.15)');
        fireGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = fireGlow;
        ctx.beginPath();
        ctx.arc(campX, campY - 12 * dpr, 65 * dpr + flicker, 0, Math.PI * 2);
        ctx.fill();

        // 3D Expedition Tent
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(campX - 35 * dpr, campY + 6 * dpr);
        ctx.lineTo(campX - 12 * dpr, campY - 26 * dpr);
        ctx.lineTo(campX + 6 * dpr, campY + 6 * dpr);
        ctx.closePath();
        ctx.fill();

        // Tent inner warmth entrance
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.moveTo(campX - 28 * dpr, campY + 6 * dpr);
        ctx.lineTo(campX - 12 * dpr, campY - 18 * dpr);
        ctx.lineTo(campX - 6 * dpr, campY + 6 * dpr);
        ctx.closePath();
        ctx.fill();

        // Campfire logs
        ctx.fillStyle = '#44403c';
        ctx.fillRect(campX + 12 * dpr, campY + 3 * dpr, 18 * dpr, 5 * dpr);

        // Dynamic flowing campfire flames
        const flameHeight = (18 + Math.sin(time * 15) * 6) * dpr;
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(campX + 14 * dpr, campY + 3 * dpr);
        ctx.quadraticCurveTo(campX + 21 * dpr, campY - flameHeight, campX + 28 * dpr, campY + 3 * dpr);
        ctx.fill();

        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(campX + 16 * dpr, campY + 3 * dpr);
        ctx.quadraticCurveTo(campX + 21 * dpr, campY - flameHeight * 0.7, campX + 26 * dpr, campY + 3 * dpr);
        ctx.fill();

        // Rising swirling embers
        embers.forEach((e) => {
          e.life += 0.025;
          if (e.life >= 1) {
            e.life = 0;
            e.x = campX + 21 * dpr + (Math.random() - 0.5) * 10 * dpr;
            e.y = campY;
          }
          e.x += e.vx * dpr;
          e.y += e.vy * dpr;
          const alpha = (1 - e.life) * 0.9;
          ctx.fillStyle = `rgba(254, 215, 170, ${alpha})`;
          ctx.beginPath();
          ctx.arc(e.x, e.y, (1.8 * (1 - e.life * 0.5)) * dpr, 0, Math.PI * 2);
          ctx.fill();
        });
      } else {
        // 6. ACTIVE STEPPING CLIMBER (Büyük, Canlı, Dinamik Tırmanan Dağcı Modeli)
        const cScale = 1.75 * dpr; // Belirgin derecede büyük, net ve dinamik
        const strideCycle = time * 7.5;
        const stepPhase = Math.sin(strideCycle);
        const stepCos = Math.cos(strideCycle);
        const walkBounce = (!camping && !isPausedRef.current) ? Math.abs(stepPhase) * 4.5 * dpr : 0;

        // Dynamic forward slope stride: dağcı dağa doğru aktif şekilde tırmanır
        const stepStride = (!camping && !isPausedRef.current) ? (Math.max(0, stepPhase) * 5.0 * dpr) : 0;
        const cX = climberX - stepStride * 0.7;
        const cY = climberY - walkBounce - stepStride * 0.5;

        const currentAltitude = Math.round(1850 + p * (3937 - 1850));

        // Warm ambient spotlight around the climber
        const haloGrad = ctx.createRadialGradient(cX, cY - 10 * cScale, 4, cX, cY - 10 * cScale, 55 * dpr);
        haloGrad.addColorStop(0, 'rgba(251, 146, 60, 0.4)');
        haloGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.15)');
        haloGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(cX, cY - 10 * cScale, 55 * dpr, 0, Math.PI * 2);
        ctx.fill();

        // 1. Safety Rope anchored down the mountain slope
        ctx.save();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(cX + 24 * cScale, cY + 20 * cScale);
        ctx.quadraticCurveTo(cX + 14 * cScale, cY + 14 * cScale, cX + 2 * cScale, cY - 2 * cScale);
        ctx.stroke();

        // Safety anchor piton in rock
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(cX + 24 * cScale, cY + 20 * cScale, 2.8 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. Snow crunch / kick particles under boots
        if (!isPausedRef.current) {
          const kickAlpha = Math.max(0, stepPhase * 0.8);
          ctx.fillStyle = `rgba(255, 255, 255, ${kickAlpha})`;
          ctx.beginPath();
          ctx.arc(cX + 8 * cScale, cY + 14 * cScale, 2.2 * dpr, 0, Math.PI * 2);
          ctx.arc(cX + 12 * cScale, cY + 16 * cScale, 1.6 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. Headlamp Beam projecting forward onto the snow ridge
        const beamLength = 65 * dpr;
        const beamGrad = ctx.createRadialGradient(cX - 8 * cScale, cY - 14 * cScale, 2, cX - 45 * dpr, cY - 35 * dpr, beamLength);
        beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
        beamGrad.addColorStop(0.4, 'rgba(254, 240, 138, 0.3)');
        beamGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(cX - 8 * cScale, cY - 14 * cScale);
        ctx.lineTo(cX - 55 * dpr, cY - 42 * dpr);
        ctx.lineTo(cX - 35 * dpr, cY - 55 * dpr);
        ctx.closePath();
        ctx.fill();

        ctx.save();
        ctx.translate(cX, cY);
        // Leaning into the mountain slope
        ctx.rotate(-0.28);

        // Backpack with foam sleeping pad roll
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(4 * cScale, -13 * cScale, 7 * cScale, 13 * cScale);
        // Sleeping pad roll
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.ellipse(7.5 * cScale, -14 * cScale, 4.5 * cScale, 2.5 * cScale, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Climber Torso (Alpine GORE-TEX Parka)
        const jacketGrad = ctx.createLinearGradient(-5 * cScale, -14 * cScale, 5 * cScale, 0);
        jacketGrad.addColorStop(0, '#f97316');
        jacketGrad.addColorStop(1, '#ea580c');
        ctx.fillStyle = jacketGrad;
        ctx.beginPath();
        ctx.roundRect(-6 * cScale, -14 * cScale, 11 * cScale, 14 * cScale, 3 * dpr);
        ctx.fill();

        // Black shoulder reinforcement pads
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-6 * cScale, -14 * cScale, 11 * cScale, 3.5 * cScale);

        // Climbing Harness around waist
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-6 * cScale, -2 * cScale, 11 * cScale, 2.5 * cScale);

        // Head / Climbing Helmet
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-2 * cScale, -19 * cScale, 6 * cScale, 0, Math.PI * 2);
        ctx.fill();

        // Dark Visor / Goggles
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.roundRect(-7 * cScale, -20 * cScale, 5 * cScale, 3 * cScale, 1.5 * dpr);
        ctx.fill();

        // Headlamp Unit
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(-7 * cScale, -21 * cScale, 2.4 * cScale, 0, Math.PI * 2);
        ctx.fill();

        // Cold Alpine Breath Steam Puff
        if (!isPausedRef.current) {
          const breathPhase = Math.sin(time * 3.5);
          if (breathPhase > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${breathPhase * 0.45})`;
            ctx.beginPath();
            ctx.arc(-11 * cScale - breathPhase * 4 * dpr, -20 * cScale - breathPhase * 5 * dpr, (2 + breathPhase * 3) * dpr, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Stepping Leg 1 (Front Leg - Bending and Driving Upward)
        const frontHipX = -2 * cScale;
        const frontHipY = 0;
        const frontKneeX = frontHipX - 4 * cScale - stepPhase * 5 * cScale;
        const frontKneeY = frontHipY + 6 * cScale - Math.max(0, stepPhase) * 6 * cScale;
        const frontFootX = frontKneeX - 2 * cScale;
        const frontFootY = frontKneeY + 7 * cScale;

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3.5 * dpr;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(frontHipX, frontHipY);
        ctx.lineTo(frontKneeX, frontKneeY);
        ctx.lineTo(frontFootX, frontFootY);
        ctx.stroke();

        // Front Mountain Boot with Crampons
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(frontFootX - 3.5 * cScale, frontFootY - 1 * cScale, 6 * cScale, 3.5 * cScale);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(frontFootX - 4 * cScale, frontFootY + 2.5 * cScale, 6.5 * cScale, 1.2 * cScale);

        // Stepping Leg 2 (Back Leg - Pushing Off Slope)
        const backHipX = 2 * cScale;
        const backHipY = 0;
        const backKneeX = backHipX + 4 * cScale + stepPhase * 5 * cScale;
        const backKneeY = backHipY + 7 * cScale + Math.max(0, -stepPhase) * 4 * cScale;
        const backFootX = backKneeX + 2 * cScale;
        const backFootY = backKneeY + 7 * cScale;

        ctx.beginPath();
        ctx.moveTo(backHipX, backHipY);
        ctx.lineTo(backKneeX, backKneeY);
        ctx.lineTo(backFootX, backFootY);
        ctx.stroke();

        // Back Boot
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(backFootX - 2.5 * cScale, backFootY - 1 * cScale, 6 * cScale, 3.5 * cScale);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(backFootX - 3 * cScale, backFootY + 2.5 * cScale, 6.5 * cScale, 1.2 * cScale);

        // Climbing Arm 1: Reaching Up with Ice Axe (Kazma Sallama & Buz Kırma)
        const axeSwing = stepCos * 7 * cScale;
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 3 * dpr;
        ctx.beginPath();
        ctx.moveTo(-4 * cScale, -11 * cScale);
        ctx.lineTo(-10 * cScale, -8 * cScale + axeSwing * 0.5);
        ctx.lineTo(-15 * cScale, -5 * cScale + axeSwing);
        ctx.stroke();

        // Technical Ice Axe Pick & Head
        ctx.save();
        ctx.translate(-15 * cScale, -5 * cScale + axeSwing);
        ctx.rotate(-0.4);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(-5 * cScale, -2 * cScale);
        ctx.lineTo(3 * cScale, 2 * cScale);
        ctx.stroke();
        // Sharp curved adze/pick
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(-5 * cScale, -2 * cScale);
        ctx.lineTo(-7 * cScale, 3 * cScale);
        ctx.stroke();
        ctx.restore();

        // Climbing Arm 2: Alpine Trekking Pole
        const poleSwing = -stepCos * 5 * cScale;
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 2.8 * dpr;
        ctx.beginPath();
        ctx.moveTo(2 * cScale, -10 * cScale);
        ctx.lineTo(6 * cScale, -4 * cScale + poleSwing * 0.5);
        ctx.lineTo(10 * cScale, 2 * cScale + poleSwing);
        ctx.stroke();
        // Pole shaft down into the snow
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(10 * cScale, 2 * cScale + poleSwing);
        ctx.lineTo(13 * cScale, 15 * cScale + poleSwing);
        ctx.stroke();

        ctx.restore();

        // 4. Live Altitude & Progress HUD Badge Floating Smoothly Above Climber
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1 * dpr;
        const badgeText = `▲ ${currentAltitude.toLocaleString('tr-TR')}m · %${Math.round(p * 100)}`;
        ctx.font = `bold ${Math.round(11 * dpr)}px ui-sans-serif, system-ui, sans-serif`;
        const textMetrics = ctx.measureText(badgeText);
        const bW = textMetrics.width + 16 * dpr;
        const bH = 20 * dpr;
        const bX = cX - bW * 0.5;
        const bY = cY - 48 * dpr;
        ctx.beginPath();
        ctx.roundRect(bX, bY, bW, bH, 6 * dpr);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, cX, bY + bH * 0.5);
        ctx.restore();
      }

      // 7. VICTORY BANNER AT SUMMIT (When progress >= 0.95)
      if (p >= 0.95) {
        // Flagpole
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 * dpr;
        ctx.beginPath();
        ctx.moveTo(summitX, summitY);
        ctx.lineTo(summitX, summitY - 32 * dpr);
        ctx.stroke();

        // Fluttering Red Turkish Flag Banner
        const flagWave = Math.sin(time * 8) * 4 * dpr;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(summitX, summitY - 32 * dpr);
        ctx.quadraticCurveTo(
          summitX + 16 * dpr,
          summitY - 30 * dpr + flagWave,
          summitX + 28 * dpr,
          summitY - 26 * dpr
        );
        ctx.lineTo(summitX + 28 * dpr, summitY - 14 * dpr);
        ctx.quadraticCurveTo(
          summitX + 14 * dpr,
          summitY - 18 * dpr + flagWave,
          summitX,
          summitY - 18 * dpr
        );
        ctx.closePath();
        ctx.fill();

        // Crescent & Star
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(summitX + 12 * dpr, summitY - 23 * dpr + flagWave * 0.4, 2.5 * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Celebration Banner at Summit (Clean bottom center positioning)
        ctx.save();
        ctx.fillStyle = 'rgba(15, 10, 25, 0.88)';
        const bannerW = 340 * dpr;
        const bannerH = 46 * dpr;
        ctx.roundRect((w - bannerW) * 0.5, h * 0.84, bannerW, bannerH, 23 * dpr);
        ctx.fill();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.font = `bold ${12 * dpr}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('🏔️ ZİRVEYE ULAŞILDI! (3,937m) 🏔️', w * 0.5, h * 0.84 + 19 * dpr);

        ctx.fillStyle = '#fdba74';
        ctx.font = `600 ${10 * dpr}px sans-serif`;
        ctx.fillText('Kaçkar Zirvesi Fethedildi · Zafer Bayrağı Dikildi', w * 0.5, h * 0.84 + 34 * dpr);
        ctx.restore();
      }

      // Camp Active Cinematic Checkpoint Banner
      if (camping) {
        ctx.save();
        const campBannerW = 350 * dpr;
        const campBannerH = 44 * dpr;
        ctx.fillStyle = 'rgba(24, 10, 34, 0.9)';
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 1.5 * dpr;
        ctx.roundRect((w - campBannerW) * 0.5, h * 0.84, campBannerW, campBannerH, 22 * dpr);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.font = `bold ${12 * dpr}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('⛺ İLERİ KAMP KURULDU · 2,850m', w * 0.5, h * 0.84 + 18 * dpr);

        ctx.fillStyle = '#fed7aa';
        ctx.font = `600 ${10 * dpr}px sans-serif`;
        ctx.fillText('Sıcak Çay & Kamp Ateşi Molası · Enerji Toplanıyor', w * 0.5, h * 0.84 + 33 * dpr);
        ctx.restore();
      }

      // 8. CONTINUOUS BLIZZARD & SNOW DRIFT (Never a 1-second loop, infinite stream!)
      snowflakes.forEach((f) => {
        f.x += f.speedX * dpr;
        f.y += f.speedY * dpr;
        if (f.x < 0) f.x = w + Math.random() * 50;
        if (f.y > h) f.y = -20;

        ctx.fillStyle = `rgba(255, 255, 255, ${f.opacity})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size * dpr, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};
