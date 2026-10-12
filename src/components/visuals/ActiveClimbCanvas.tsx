import React, { useEffect, useRef } from 'react';

interface ActiveClimbCanvasProps {
  progress: number; // 0 to 1
  isPaused: boolean;
  isCampActive: boolean;
  elapsedSeconds: number;
  breakSeconds: number;
}

export const ActiveClimbCanvas: React.FC<ActiveClimbCanvasProps> = ({
  progress,
  isPaused,
  isCampActive,
  elapsedSeconds,
  breakSeconds,
}) => {
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

      // 1. SKY GRADIENT (Smooth daylight-to-alpine-twilight transition based on progress & camp)
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      if (camping) {
        // Midnight Violet Campfire Sky
        sky.addColorStop(0, '#04020a');
        sky.addColorStop(0.4, '#0a0518');
        sky.addColorStop(0.8, '#180a22');
        sky.addColorStop(1, '#0e0414');
      } else {
        // Alpine twilight transitioning towards crisp summit dawn
        const dawnShift = Math.min(1, smoothProgress);
        sky.addColorStop(0, '#090814');
        sky.addColorStop(0.3, '#130d22');
        sky.addColorStop(0.65, dawnShift > 0.7 ? '#4a1e35' : '#2b1428');
        sky.addColorStop(1, dawnShift > 0.7 ? '#6b2d2a' : '#1f0d1f');
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
      mtnGrad.addColorStop(0, '#241731');
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
      ctx.fillStyle = camping ? '#7e8f9e' : '#e2e8f0';
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

      // 4. CONTINUOUS TRAIL WAYPOINTS & PATH
      const waypoints = [
        { x: w * 0.84, y: h * 0.84, name: 'Ana Kamp (1,850m)' },
        { x: w * 0.74, y: h * 0.65, name: 'Buzul Sırtı (2,600m)' },
        { x: w * 0.63, y: h * 0.44, name: 'İleri Kamp (3,200m)' },
        { x: summitX, y: summitY, name: 'Kaçkar Zirvesi (3,937m)' },
      ];

      // Draw flowing dashed climbing route
      ctx.save();
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
      ctx.lineWidth = 2.5 * dpr;
      ctx.setLineDash([6 * dpr, 6 * dpr]);
      ctx.lineDashOffset = -time * 15; // CONTINUOUS FLOWING TRAIL DASHES!
      ctx.beginPath();
      ctx.moveTo(waypoints[0].x, waypoints[0].y);
      ctx.quadraticCurveTo(w * 0.78, h * 0.74, waypoints[1].x, waypoints[1].y);
      ctx.quadraticCurveTo(w * 0.69, h * 0.54, waypoints[2].x, waypoints[2].y);
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
        // 6. ACTIVE STEPPING CLIMBER (Canlı tırmanan dağcı modeli)
        const cX = climberX;
        const cY = climberY - walkBounce;

        // Headlamp Beam projecting forward onto the snow ridge
        const beamAngle = -0.55;
        const beamLength = 45 * dpr;
        const beamGrad = ctx.createRadialGradient(cX, cY - 8 * dpr, 2, cX - 30 * dpr, cY - 25 * dpr, beamLength);
        beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
        beamGrad.addColorStop(0.5, 'rgba(254, 240, 138, 0.25)');
        beamGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(cX, cY - 8 * dpr);
        ctx.lineTo(cX - 38 * dpr, cY - 32 * dpr);
        ctx.lineTo(cX - 22 * dpr, cY - 42 * dpr);
        ctx.closePath();
        ctx.fill();

        // Climber Body
        // Head / Helmet
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cX, cY - 14 * dpr, 4.5 * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Headlamp
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(cX - 3 * dpr, cY - 14 * dpr, 2 * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Torso / Alpine Parka
        ctx.fillStyle = '#ea580c'; // Vibrant Orange Mountaineering Jacket
        ctx.fillRect(cX - 4 * dpr, cY - 10 * dpr, 8 * dpr, 10 * dpr);

        // Backpack
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(cX + 2 * dpr, cY - 9 * dpr, 5 * dpr, 8 * dpr);

        // Stepping Legs (Dynamic climbing animation!)
        const legSwing = Math.sin(stepCycle) * 6 * dpr;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5 * dpr;
        ctx.lineCap = 'round';
        // Left leg
        ctx.beginPath();
        ctx.moveTo(cX - 2 * dpr, cY);
        ctx.lineTo(cX - 5 * dpr - legSwing, cY + 8 * dpr);
        ctx.stroke();
        // Right leg
        ctx.beginPath();
        ctx.moveTo(cX + 2 * dpr, cY);
        ctx.lineTo(cX + 1 * dpr + legSwing, cY + 8 * dpr);
        ctx.stroke();

        // Swinging Arm with Ice Axe (Kazma sallama)
        const armSwing = Math.cos(stepCycle) * 5 * dpr;
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(cX - 3 * dpr, cY - 8 * dpr);
        ctx.lineTo(cX - 8 * dpr, cY - 4 * dpr + armSwing);
        ctx.stroke();
        // Ice axe head
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(cX - 11 * dpr, cY - 6 * dpr + armSwing);
        ctx.lineTo(cX - 6 * dpr, cY - 2 * dpr + armSwing);
        ctx.stroke();
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
