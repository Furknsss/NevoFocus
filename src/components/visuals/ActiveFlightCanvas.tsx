import React, { useEffect, useRef } from 'react';

interface ActiveFlightCanvasProps {
  progress: number; // 0 to 1
  isPaused: boolean;
  elapsedSeconds: number;
}

export const ActiveFlightCanvas: React.FC<ActiveFlightCanvasProps> = ({
  progress,
  isPaused,
  elapsedSeconds,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

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

    // Multi-layered clouds with continuous parallax speeds
    const bgClouds = Array.from({ length: 12 }, () => ({
      x: Math.random() * 2000,
      y: 150 + Math.random() * 450,
      radius: 50 + Math.random() * 70,
      speed: 1.2 + Math.random() * 0.8,
      opacity: 0.18 + Math.random() * 0.2,
    }));

    const fgClouds = Array.from({ length: 8 }, () => ({
      x: Math.random() * 2000,
      y: 350 + Math.random() * 350,
      radius: 70 + Math.random() * 90,
      speed: 2.8 + Math.random() * 1.5,
      opacity: 0.25 + Math.random() * 0.25,
    }));

    // Jet contrail particle stream
    const contrailPuffs: { x: number; y: number; size: number; opacity: number }[] = [];

    const render = () => {
      animId = requestAnimationFrame(render);
      if (!isPausedRef.current) {
        time += 0.016;
      }

      smoothProgress += (progressRef.current - smoothProgress) * 0.05;
      const p = Math.max(0, Math.min(1, smoothProgress));

      const w = canvas.width;
      const h = canvas.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      ctx.clearRect(0, 0, w, h);

      // 1. STRATOSPHERIC FLIGHT SKY GRADIENT
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#09182d');
      sky.addColorStop(0.35, '#132f54');
      sky.addColorStop(0.7, '#244e7c');
      sky.addColorStop(0.9, '#4a6f95');
      sky.addColorStop(1, '#786e74'); // Warm golden sunset haze on horizon
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // 2. SUNSET AURA & GOLDEN GLOW ON HORIZON
      const sunGlow = ctx.createRadialGradient(w * 0.82, h * 0.88, 10, w * 0.82, h * 0.88, w * 0.5);
      sunGlow.addColorStop(0, 'rgba(253, 186, 116, 0.45)');
      sunGlow.addColorStop(0.4, 'rgba(251, 146, 60, 0.2)');
      sunGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, w, h);

      // 3. CONTINUOUS BACKGROUND CLOUD PARALLAX STREAM
      bgClouds.forEach((c) => {
        c.x -= c.speed * dpr;
        if (c.x < -200) c.x = w + 200;

        ctx.fillStyle = `rgba(255, 255, 255, ${c.opacity})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius * dpr, 0, Math.PI * 2);
        ctx.arc(c.x + 40 * dpr, c.y - 15 * dpr, (c.radius * 0.85) * dpr, 0, Math.PI * 2);
        ctx.arc(c.x + 85 * dpr, c.y, (c.radius * 0.95) * dpr, 0, Math.PI * 2);
        ctx.fill();
      });

      // 4. SPEED STREAKS / ATMOSPHERIC WIND PARTICLES
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1.5 * dpr;
      for (let i = 0; i < 5; i++) {
        const sx = ((w - ((time * 800 + i * 280 * dpr) % (w + 200)))) - 50;
        const sy = h * (0.2 + i * 0.15);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 50 * dpr, sy);
        ctx.stroke();
      }

      // 5. CENTER CRUISING AIRLINER (Uçan Jet Modeli)
      const jetX = w * 0.48;
      const jetY = h * 0.45 + Math.sin(time * 1.8) * 5 * dpr;
      const jetBank = -0.05 + Math.sin(time * 1.2) * 0.025;

      ctx.save();
      ctx.translate(jetX, jetY);
      ctx.rotate(jetBank);

      // Jet Contrail Puff generation
      if (Math.floor(time * 60) % 2 === 0) {
        contrailPuffs.push({
          x: jetX - 45 * dpr,
          y: jetY + 12 * dpr,
          size: 4 * dpr,
          opacity: 0.55,
        });
        contrailPuffs.push({
          x: jetX - 45 * dpr,
          y: jetY - 4 * dpr,
          size: 4 * dpr,
          opacity: 0.55,
        });
      }

      // Sleek Airliner Fuselage
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(65 * dpr, 0);
      ctx.lineTo(-40 * dpr, -10 * dpr);
      ctx.lineTo(-65 * dpr, -4 * dpr);
      ctx.lineTo(-65 * dpr, 4 * dpr);
      ctx.lineTo(-40 * dpr, 10 * dpr);
      ctx.closePath();
      ctx.fill();

      // Tinted Cockpit Glass
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(45 * dpr, -2 * dpr, 9 * dpr, 4 * dpr, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Swept Wings with Red Winglets
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(10 * dpr, 0);
      ctx.lineTo(-20 * dpr, -58 * dpr);
      ctx.lineTo(-30 * dpr, -58 * dpr);
      ctx.lineTo(-12 * dpr, 0);
      ctx.lineTo(-30 * dpr, 58 * dpr);
      ctx.lineTo(-20 * dpr, 58 * dpr);
      ctx.closePath();
      ctx.fill();

      // Red Sharklet Wingtips
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-28 * dpr, -62 * dpr, 10 * dpr, 4 * dpr);
      ctx.fillRect(-28 * dpr, 58 * dpr, 10 * dpr, 4 * dpr);

      // Red Turkish Aviation Vertical Stabilizer
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(-42 * dpr, 0);
      ctx.lineTo(-65 * dpr, -28 * dpr);
      ctx.lineTo(-58 * dpr, -28 * dpr);
      ctx.lineTo(-35 * dpr, 0);
      ctx.closePath();
      ctx.fill();

      // Jet Engines under wings
      ctx.fillStyle = '#475569';
      ctx.fillRect(-15 * dpr, -24 * dpr, 24 * dpr, 7 * dpr);
      ctx.fillRect(-15 * dpr, 17 * dpr, 24 * dpr, 7 * dpr);

      ctx.restore();

      // 6. CONTINUOUS JET VAPOR CONTRAILS STREAMING BEHIND AIRCRAFT
      for (let i = contrailPuffs.length - 1; i >= 0; i--) {
        const cp = contrailPuffs[i];
        cp.x -= 3.8 * dpr;
        cp.size += 0.25 * dpr;
        cp.opacity -= 0.008;

        if (cp.opacity <= 0 || cp.x < -100) {
          contrailPuffs.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${cp.opacity})`;
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, cp.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 7. FOREGROUND FAST CLOUDS
      fgClouds.forEach((c) => {
        c.x -= c.speed * dpr;
        if (c.x < -250) c.x = w + 250;

        ctx.fillStyle = `rgba(255, 255, 255, ${c.opacity})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius * dpr, 0, Math.PI * 2);
        ctx.arc(c.x + 50 * dpr, c.y - 18 * dpr, (c.radius * 0.85) * dpr, 0, Math.PI * 2);
        ctx.arc(c.x + 105 * dpr, c.y, (c.radius * 0.95) * dpr, 0, Math.PI * 2);
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
