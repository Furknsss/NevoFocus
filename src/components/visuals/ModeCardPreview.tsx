import React, { useEffect, useRef } from 'react';
import { FocusModeType } from '../../types';

interface ModeCardPreviewProps {
  mode: FocusModeType;
  isActive: boolean;
}

export const ModeCardPreview = React.memo<ModeCardPreviewProps>(({ mode, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const dprVal = Math.min(window.devicePixelRatio || 1, 2);
    const updateSize = () => {
      const clientW = canvas.clientWidth || 320;
      const clientH = canvas.clientHeight || 180;
      const targetW = Math.floor(clientW * dprVal);
      const targetH = Math.floor(clientH * dprVal);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };
    updateSize();

    let resizeTimer: number;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(updateSize, 100);
    };
    window.addEventListener('resize', handleResize);

    const w = () => canvas.width;
    const h = () => canvas.height;
    const dpr = () => dprVal;

    // Multi-layer particle streams for continuous flow
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * 800,
      y: Math.random() * 500,
      size: Math.random() * 2.5 + 1,
      speedX: Math.random() * 1.5 + 0.5,
      speedY: Math.random() * 1.2 + 0.3,
      opacity: Math.random() * 0.7 + 0.3,
      rot: Math.random() * Math.PI * 2,
    }));

    const render = () => {
      animId = requestAnimationFrame(render);
      time += 0.02;

      const cw = w();
      const ch = h();
      const cdpr = dpr();

      ctx.clearRect(0, 0, cw, ch);

      if (mode === 'forest') {
        // --- 1. CONTINUOUS FLOWING SAKURA FOREST ---
        const grad = ctx.createLinearGradient(0, 0, 0, ch);
        grad.addColorStop(0, '#041610');
        grad.addColorStop(0.5, '#072b20');
        grad.addColorStop(1, '#02120d');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);

        // Ground mound
        ctx.beginPath();
        ctx.fillStyle = '#061e16';
        ctx.moveTo(0, ch);
        ctx.quadraticCurveTo(cw * 0.5, ch * 0.76, cw, ch);
        ctx.fill();

        // Glowing Tree Trunk
        const centerX = cw * 0.5;
        const baseY = ch * 0.88;
        const sway = Math.sin(time * 1.5) * 4 * cdpr;

        ctx.save();
        ctx.strokeStyle = '#1e382b';
        ctx.lineWidth = 14 * cdpr;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(centerX, baseY);
        ctx.quadraticCurveTo(centerX + sway * 0.5, baseY - 45 * cdpr, centerX + sway, baseY - 70 * cdpr);
        ctx.stroke();

        // Branches
        ctx.lineWidth = 5 * cdpr;
        ctx.beginPath();
        ctx.moveTo(centerX + sway * 0.5, baseY - 45 * cdpr);
        ctx.quadraticCurveTo(centerX - 30 * cdpr, baseY - 60 * cdpr, centerX - 48 * cdpr, baseY - 78 * cdpr);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX + sway * 0.6, baseY - 50 * cdpr);
        ctx.quadraticCurveTo(centerX + 30 * cdpr, baseY - 65 * cdpr, centerX + 50 * cdpr, baseY - 82 * cdpr);
        ctx.stroke();

        // Bioluminescent emerald foliage clusters
        const foliage = [
          { x: centerX + sway, y: baseY - 85 * cdpr, r: 24 * cdpr },
          { x: centerX - 48 * cdpr, y: baseY - 80 * cdpr, r: 18 * cdpr },
          { x: centerX + 50 * cdpr, y: baseY - 84 * cdpr, r: 20 * cdpr },
        ];

        foliage.forEach((f, i) => {
          const pulse = Math.sin(time * 2 + i) * 3 * cdpr;
          const fGrad = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.r + pulse);
          fGrad.addColorStop(0, '#10b981');
          fGrad.addColorStop(0.6, '#059669');
          fGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = fGrad;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r + pulse, 0, Math.PI * 2);
          ctx.fill();

          // Sakura flowers
          ctx.fillStyle = '#f472b6';
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.arc(f.x + Math.sin(k * 2) * 8 * cdpr, f.y + Math.cos(k * 2) * 8 * cdpr, 2.5 * cdpr, 0, Math.PI * 2);
            ctx.fill();
          }
        });
        ctx.restore();

        // Continuous wind stream of pink petals (Never resets abruptly!)
        particles.forEach((p) => {
          p.x += p.speedX * cdpr;
          p.y += p.speedY * cdpr;
          if (p.x > cw + 20) p.x = -20;
          if (p.y > ch + 20) p.y = -20;

          ctx.fillStyle = `rgba(244, 114, 182, ${p.opacity})`;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * 1.5 * cdpr, p.size * 0.8 * cdpr, time, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (mode === 'climb') {
        // --- 2. CONTINUOUS FLOWING MOUNTAIN BLIZZARD & EXPEDITION ---
        const grad = ctx.createLinearGradient(0, 0, 0, ch);
        grad.addColorStop(0, '#0c0717');
        grad.addColorStop(0.5, '#1e122b');
        grad.addColorStop(1, '#3b1c31');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);

        // Summit Massif
        const summitX = cw * 0.52;
        const summitY = ch * 0.22;
        ctx.fillStyle = '#170e22';
        ctx.beginPath();
        ctx.moveTo(cw * 0.05, ch);
        ctx.lineTo(summitX, summitY);
        ctx.lineTo(cw * 0.95, ch);
        ctx.fill();

        // Glacier Crest
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(summitX, summitY);
        ctx.lineTo(summitX + 35 * cdpr, summitY + 45 * cdpr);
        ctx.lineTo(summitX + 12 * cdpr, summitY + 38 * cdpr);
        ctx.lineTo(summitX - 10 * cdpr, summitY + 48 * cdpr);
        ctx.lineTo(summitX - 30 * cdpr, summitY + 40 * cdpr);
        ctx.closePath();
        ctx.fill();

        // Summit Beacon
        const beaconPulse = Math.sin(time * 3) * 4 * cdpr;
        const bGrad = ctx.createRadialGradient(summitX, summitY, 2, summitX, summitY, 24 * cdpr + beaconPulse);
        bGrad.addColorStop(0, 'rgba(249, 115, 22, 0.9)');
        bGrad.addColorStop(0.5, 'rgba(234, 88, 12, 0.3)');
        bGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(summitX, summitY, 24 * cdpr + beaconPulse, 0, Math.PI * 2);
        ctx.fill();

        // Climber climbing up along the ridge
        const climbT = (time * 0.15) % 1; // Smooth climbing step
        const climberX = summitX + (1 - climbT) * 55 * cdpr;
        const climberY = summitY + 45 * cdpr + (1 - climbT) * 55 * cdpr;

        // Headlamp glow
        ctx.fillStyle = 'rgba(254, 240, 138, 0.8)';
        ctx.beginPath();
        ctx.arc(climberX, climberY, 3.5 * cdpr, 0, Math.PI * 2);
        ctx.fill();

        // Continuous snow blizzard stream
        particles.forEach((p) => {
          p.x -= (p.speedX + 1.2) * cdpr;
          p.y += p.speedY * cdpr;
          if (p.x < -20) p.x = cw + 20;
          if (p.y > ch + 20) p.y = -20;

          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.85})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * cdpr, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (mode === 'flight') {
        // --- 3. CONTINUOUS FLOWING JET HORIZON ---
        const grad = ctx.createLinearGradient(0, 0, 0, ch);
        grad.addColorStop(0, '#0c2138');
        grad.addColorStop(0.5, '#1e3f65');
        grad.addColorStop(1, '#3a6692');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);

        // Continuous scrolling cloud formations
        for (let i = 0; i < 4; i++) {
          const cx = (cw - ((time * 45 + i * 90 * cdpr) % (cw + 120))) - 40;
          const cy = ch * (0.3 + i * 0.18);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
          ctx.beginPath();
          ctx.arc(cx, cy, 26 * cdpr, 0, Math.PI * 2);
          ctx.arc(cx + 25 * cdpr, cy - 8 * cdpr, 32 * cdpr, 0, Math.PI * 2);
          ctx.arc(cx + 52 * cdpr, cy, 24 * cdpr, 0, Math.PI * 2);
          ctx.fill();
        }

        // Center Cruising Jet
        const jetX = cw * 0.5;
        const jetY = ch * 0.48 + Math.sin(time * 2) * 4 * cdpr;
        ctx.save();
        ctx.translate(jetX, jetY);

        // Jet Fuselage
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(35 * cdpr, 0);
        ctx.lineTo(-20 * cdpr, -6 * cdpr);
        ctx.lineTo(-30 * cdpr, -2 * cdpr);
        ctx.lineTo(-30 * cdpr, 2 * cdpr);
        ctx.lineTo(-20 * cdpr, 6 * cdpr);
        ctx.closePath();
        ctx.fill();

        // Wings
        ctx.beginPath();
        ctx.moveTo(5 * cdpr, 0);
        ctx.lineTo(-12 * cdpr, -32 * cdpr);
        ctx.lineTo(-18 * cdpr, -32 * cdpr);
        ctx.lineTo(-8 * cdpr, 0);
        ctx.lineTo(-18 * cdpr, 32 * cdpr);
        ctx.lineTo(-12 * cdpr, 32 * cdpr);
        ctx.closePath();
        ctx.fill();

        // Red Tail Fin
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(-20 * cdpr, 0);
        ctx.lineTo(-32 * cdpr, -14 * cdpr);
        ctx.lineTo(-28 * cdpr, -14 * cdpr);
        ctx.lineTo(-16 * cdpr, 0);
        ctx.closePath();
        ctx.fill();

        // Twin vapor contrails streaming behind jet
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillRect(-80 * cdpr, -10 * cdpr, 55 * cdpr, 2.5 * cdpr);
        ctx.fillRect(-80 * cdpr, 8 * cdpr, 55 * cdpr, 2.5 * cdpr);

        ctx.restore();
      } else if (mode === 'dive') {
        // --- 4. HIGH QUALITY OCEAN DIVE & BIOLUMINESCENT BALIK ŞEHRİ ---
        const grad = ctx.createLinearGradient(0, 0, 0, ch);
        grad.addColorStop(0, '#062d3a');
        grad.addColorStop(0.5, '#021822');
        grad.addColorStop(0.85, '#042233');
        grad.addColorStop(1, '#08334c');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);

        // Water surface light caustics
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.22)';
        ctx.lineWidth = 1 * cdpr;
        for (let i = 0; i < 3; i++) {
          const cy = ch * (0.2 + i * 0.15) + Math.sin(time + i) * 6 * cdpr;
          ctx.beginPath();
          for (let x = 0; x <= cw; x += 15 * cdpr) {
            const wave = Math.sin(x * 0.03 + time * 2 + i) * 4 * cdpr;
            if (x === 0) ctx.moveTo(x, cy + wave);
            else ctx.lineTo(x, cy + wave);
          }
          ctx.stroke();
        }

        // Shimmering water surface line & Wooden Boat at top
        ctx.strokeStyle = 'rgba(153, 246, 228, 0.6)';
        ctx.lineWidth = 1.8 * cdpr;
        ctx.beginPath();
        for (let x = 0; x <= cw; x += 10) {
          const wave = Math.sin(time * 2 + x * 0.03) * 3 * cdpr;
          if (x === 0) ctx.moveTo(x, 16 * cdpr + wave);
          else ctx.lineTo(x, 16 * cdpr + wave);
        }
        ctx.stroke();

        // Wooden Boat silhouette
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.moveTo(cw * 0.5 - 28 * cdpr, 8 * cdpr);
        ctx.lineTo(cw * 0.5 - 20 * cdpr, 18 * cdpr);
        ctx.lineTo(cw * 0.5 + 20 * cdpr, 18 * cdpr);
        ctx.lineTo(cw * 0.5 + 32 * cdpr, 8 * cdpr);
        ctx.closePath();
        ctx.fill();

        // High quality Balık Şehri Citadel Towers at seabed
        const cityTowers = [
          { x: cw * 0.18, h: 26 * cdpr, r: 8 * cdpr, c: '#38bdf8' },
          { x: cw * 0.38, h: 42 * cdpr, r: 12 * cdpr, c: '#2dd4bf' },
          { x: cw * 0.50, h: 56 * cdpr, r: 16 * cdpr, c: '#67e8f9', gate: true },
          { x: cw * 0.62, h: 42 * cdpr, r: 12 * cdpr, c: '#2dd4bf' },
          { x: cw * 0.82, h: 26 * cdpr, r: 8 * cdpr, c: '#38bdf8' },
        ];
        cityTowers.forEach((t) => {
          ctx.fillStyle = '#031b27';
          ctx.strokeStyle = t.c;
          ctx.lineWidth = 1.4 * cdpr;
          ctx.beginPath();
          ctx.moveTo(t.x - t.r * 1.2, ch);
          ctx.lineTo(t.x, ch - t.h);
          ctx.lineTo(t.x + t.r * 1.2, ch);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Bioluminescent dome cap
          ctx.fillStyle = t.c;
          ctx.beginPath();
          ctx.arc(t.x, ch - t.h, 3 * cdpr, 0, Math.PI * 2);
          ctx.fill();

          // Palace archway portal in center tower
          if (t.gate) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
            ctx.strokeStyle = '#67e8f9';
            ctx.lineWidth = 1.5 * cdpr;
            ctx.beginPath();
            ctx.arc(t.x, ch - 12 * cdpr, 9 * cdpr, Math.PI, 0);
            ctx.lineTo(t.x + 9 * cdpr, ch);
            ctx.lineTo(t.x - 9 * cdpr, ch);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        });

        // Swimming Escaping Mascot Fish (Cruising dynamically downward toward Fish City)
        const fishX = cw * 0.5 + Math.sin(time * 2.2) * 16 * cdpr;
        const fishY = ch * 0.44 + Math.sin(time * 1.4) * 8 * cdpr;
        ctx.save();
        ctx.translate(fishX, fishY);
        ctx.rotate(Math.PI * 0.5 + Math.cos(time * 2.2) * 0.15);

        // Golden aura
        ctx.fillStyle = 'rgba(251, 146, 60, 0.35)';
        ctx.beginPath();
        ctx.arc(0, 0, 16 * cdpr, 0, Math.PI * 2);
        ctx.fill();

        // Fish Body
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14 * cdpr, 8 * cdpr, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tail flapping
        const tailWag = Math.sin(time * 8) * 5 * cdpr;
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(-12 * cdpr, 0);
        ctx.lineTo(-20 * cdpr, -7 * cdpr + tailWag);
        ctx.lineTo(-17 * cdpr, 0);
        ctx.lineTo(-20 * cdpr, 7 * cdpr + tailWag);
        ctx.closePath();
        ctx.fill();

        // White stripes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2 * cdpr, -6 * cdpr, 2.5 * cdpr, 12 * cdpr);
        ctx.fillRect(4 * cdpr, -5 * cdpr, 2 * cdpr, 10 * cdpr);
        ctx.restore();

        // Controlled crystal clear bubbles (only first 12 particles used to avoid clutter)
        particles.slice(0, 12).forEach((p) => {
          p.y -= (p.speedY + 0.8) * cdpr;
          if (p.y < -15) {
            p.y = ch + 15;
            p.x = Math.random() * cw;
          }

          ctx.strokeStyle = `rgba(255, 255, 255, ${p.opacity * 0.55})`;
          ctx.fillStyle = `rgba(186, 230, 253, ${p.opacity * 0.18})`;
          ctx.lineWidth = 0.9 * cdpr;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.min(2.8 * cdpr, p.size * cdpr), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      } else if (mode === 'clock') {
        // PURE AMOLED BLACK IPAD DIGITAL STOPWATCH PREVIEW
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, cw, ch);

        // Soft center ambient glow
        const glow = ctx.createRadialGradient(cw / 2, ch / 2, 5 * cdpr, cw / 2, ch / 2, 70 * cdpr);
        glow.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, cw, ch);

        // Mini subtle Spotify indicator in top-left
        ctx.fillStyle = '#1DB954';
        ctx.beginPath();
        ctx.arc(18 * cdpr, 18 * cdpr, 3.5 * cdpr, 0, Math.PI * 2);
        ctx.fill();

        // Animated digital seconds calculation
        const secVal = Math.floor((time * 2.5) % 60);
        const padSec = String(secVal).padStart(2, '0');

        // Central Stopwatch Typography
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Main Digits: "00:41"
        ctx.font = `600 ${32 * cdpr}px monospace, ui-monospace, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('00:41', cw / 2 - 16 * cdpr, ch / 2 - 6 * cdpr);

        // Smaller Seconds: ":15"
        ctx.font = `400 ${20 * cdpr}px monospace, ui-monospace, sans-serif`;
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`:${padSec}`, cw / 2 + 38 * cdpr, ch / 2 - 2 * cdpr);

        // Mode subtitle label
        ctx.font = `700 ${8.5 * cdpr}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillText('KRONOMETRE', cw / 2, ch / 2 + 22 * cdpr);

        // Apple-style bottom dots/buttons preview
        ctx.fillStyle = '#262626';
        ctx.beginPath();
        ctx.arc(cw / 2 - 40 * cdpr, ch - 22 * cdpr, 7 * cdpr, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#14532d';
        ctx.beginPath();
        ctx.arc(cw / 2 + 40 * cdpr, ch - 22 * cdpr, 7 * cdpr, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, [mode, isActive]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
});
