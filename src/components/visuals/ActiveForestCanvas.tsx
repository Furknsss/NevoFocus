import React, { useEffect, useRef } from 'react';

interface ActiveForestCanvasProps {
  progress: number; // 0 to 1
  isPaused: boolean;
  elapsedSeconds: number;
}

export const ActiveForestCanvas: React.FC<ActiveForestCanvasProps> = ({
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

    // Continuous floating sakura petals & magical spores
    const petals = Array.from({ length: 70 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 1200,
      size: Math.random() * 3.5 + 1.2,
      speedX: Math.random() * 1.5 + 0.6,
      speedY: Math.random() * 1.2 + 0.4,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.05,
      isFlower: Math.random() > 0.45,
      opacity: Math.random() * 0.7 + 0.3,
    }));

    // Flying butterflies around the blooming tree
    const butterflies = [
      { x: 300, y: 300, color: '#f472b6', size: 8, angle: 0 },
      { x: 800, y: 250, color: '#38bdf8', size: 9, angle: 2 },
    ];

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

      // 1. MYSTICAL ENCHANTED FOREST BACKGROUND
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#03140f');
      bg.addColorStop(0.4, '#06261d');
      bg.addColorStop(0.75, '#0a382a');
      bg.addColorStop(1, '#041610');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 2. CELESTIAL GOD RAYS / SUNBEAMS
      ctx.save();
      const rayAlpha = 0.08 + Math.sin(time * 0.8) * 0.03;
      ctx.fillStyle = `rgba(167, 243, 208, ${rayAlpha})`;
      for (let i = 0; i < 4; i++) {
        const sweep = Math.sin(time * 0.4 + i) * 35 * dpr;
        ctx.beginPath();
        ctx.moveTo(w * 0.5 + sweep, 0);
        ctx.lineTo(w * (0.1 + i * 0.25) + sweep, h);
        ctx.lineTo(w * (0.2 + i * 0.25) + sweep, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // 3. FERTILE FOREST FLOOR & ROOT PLATFORM
      const treeBaseX = w * 0.5;
      const treeBaseY = h * 0.84;

      // Mossy hill
      ctx.fillStyle = '#061f17';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.quadraticCurveTo(treeBaseX, h * 0.76, w, h);
      ctx.fill();

      // Rich soil bedding
      ctx.fillStyle = '#03120d';
      ctx.beginPath();
      ctx.ellipse(treeBaseX, treeBaseY + 6 * dpr, 95 * dpr, 20 * dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glowing bio-soil nutrient roots
      const rootGlow = ctx.createRadialGradient(treeBaseX, treeBaseY, 2, treeBaseX, treeBaseY, 60 * dpr);
      rootGlow.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
      rootGlow.addColorStop(0.6, 'rgba(5, 150, 105, 0.15)');
      rootGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = rootGlow;
      ctx.beginPath();
      ctx.ellipse(treeBaseX, treeBaseY, 60 * dpr, 15 * dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // 4. THE TREE: STAGE 1 (SEED) TO STAGE 4 (ANCIENT GUARDIAN TREE)
      if (p < 0.12) {
        // --- STAGE 1: SEEDLING (Tohum & İlk Yeşil Filiz) ---
        const seedScale = Math.min(1, p / 0.12);
        // Golden glowing seed
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.ellipse(treeBaseX, treeBaseY - 2 * dpr, 7 * dpr, 4 * dpr, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Tiny green sprout rising
        const sproutH = seedScale * 30 * dpr;
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3 * dpr;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(treeBaseX, treeBaseY);
        ctx.quadraticCurveTo(treeBaseX + Math.sin(time * 2) * 2 * dpr, treeBaseY - sproutH * 0.5, treeBaseX, treeBaseY - sproutH);
        ctx.stroke();

        // Two tender baby leaves
        if (seedScale > 0.4) {
          ctx.fillStyle = '#34d399';
          ctx.beginPath();
          ctx.ellipse(treeBaseX - 5 * dpr, treeBaseY - sproutH, 6 * dpr, 3 * dpr, -0.6, 0, Math.PI * 2);
          ctx.ellipse(treeBaseX + 5 * dpr, treeBaseY - sproutH, 6 * dpr, 3 * dpr, 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // --- STAGES 2 - 4: SAPLING TO FULL ANCIENT TREE ---
        const growthT = (p - 0.12) / 0.88; // 0 to 1

        const trunkHeight = (45 + growthT * 180) * dpr;
        const trunkThickness = (8 + growthT * 26) * dpr;
        const sway = Math.sin(time * 1.5) * 4 * dpr;

        // Trunk
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#1a3325';
        ctx.lineWidth = trunkThickness;
        ctx.beginPath();
        ctx.moveTo(treeBaseX, treeBaseY);
        ctx.quadraticCurveTo(
          treeBaseX + sway * 0.5,
          treeBaseY - trunkHeight * 0.5,
          treeBaseX + sway,
          treeBaseY - trunkHeight
        );
        ctx.stroke();

        // Roots spreading into earth
        ctx.lineWidth = trunkThickness * 0.35;
        ctx.beginPath();
        ctx.moveTo(treeBaseX, treeBaseY);
        ctx.lineTo(treeBaseX - 35 * dpr, treeBaseY + 6 * dpr);
        ctx.moveTo(treeBaseX, treeBaseY);
        ctx.lineTo(treeBaseX + 40 * dpr, treeBaseY + 8 * dpr);
        ctx.stroke();

        // Primary Branches (Left & Right)
        if (growthT > 0.15) {
          const bT = Math.min(1, (growthT - 0.15) / 0.85);

          // Left branch
          ctx.lineWidth = trunkThickness * 0.45;
          ctx.beginPath();
          const b1StartX = treeBaseX + sway * 0.5;
          const b1StartY = treeBaseY - trunkHeight * 0.5;
          const b1EndX = b1StartX - (35 + bT * 85) * dpr;
          const b1EndY = b1StartY - (25 + bT * 65) * dpr;
          ctx.moveTo(b1StartX, b1StartY);
          ctx.quadraticCurveTo(b1StartX - 25 * dpr, b1StartY - 10 * dpr, b1EndX, b1EndY);
          ctx.stroke();

          // Right branch
          ctx.beginPath();
          const b2StartX = treeBaseX + sway * 0.6;
          const b2StartY = treeBaseY - trunkHeight * 0.6;
          const b2EndX = b2StartX + (40 + bT * 95) * dpr;
          const b2EndY = b2StartY - (30 + bT * 70) * dpr;
          ctx.moveTo(b2StartX, b2StartY);
          ctx.quadraticCurveTo(b2StartX + 25 * dpr, b2StartY - 12 * dpr, b2EndX, b2EndY);
          ctx.stroke();

          // Canopy Foliage Clusters (Lush Bioluminescent Emerald Orbs)
          const clusters = [
            { x: treeBaseX + sway, y: treeBaseY - trunkHeight - 15 * dpr, r: (24 + bT * 48) * dpr },
            { x: b1EndX, y: b1EndY, r: (20 + bT * 42) * dpr },
            { x: b2EndX, y: b2EndY, r: (22 + bT * 44) * dpr },
            { x: treeBaseX + sway - 35 * dpr, y: treeBaseY - trunkHeight * 0.85, r: (18 + bT * 36) * dpr },
            { x: treeBaseX + sway + 38 * dpr, y: treeBaseY - trunkHeight * 0.88, r: (19 + bT * 38) * dpr },
          ];

          clusters.forEach((c, idx) => {
            const pulse = Math.sin(time * 2 + idx) * 3 * dpr;
            const foliageGrad = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.r + pulse);
            foliageGrad.addColorStop(0, '#10b981');
            foliageGrad.addColorStop(0.5, '#059669');
            foliageGrad.addColorStop(0.85, '#047857');
            foliageGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = foliageGrad;
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.r + pulse, 0, Math.PI * 2);
            ctx.fill();

            // Sakura Blossom Pink Highlights (when growthT > 0.5)
            if (growthT > 0.5) {
              const sakuraAlpha = (growthT - 0.5) * 2;
              ctx.fillStyle = `rgba(244, 114, 182, ${sakuraAlpha * 0.8})`;
              for (let f = 0; f < 5; f++) {
                const fx = c.x + Math.sin(f * 1.5 + idx) * (c.r * 0.55);
                const fy = c.y + Math.cos(f * 1.5 + idx) * (c.r * 0.55);
                ctx.beginPath();
                ctx.arc(fx, fy, 4 * dpr, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          });
        }
        ctx.restore();
      }

      // 5. CONTINUOUS DRIFTING SAKURA PETALS & SPORES (Infinite Flow, No 1-Second Loop)
      petals.forEach((pt) => {
        pt.x += pt.speedX * dpr;
        pt.y += pt.speedY * dpr;
        pt.rot += pt.rotSpeed;

        if (pt.x > w + 40) pt.x = -40;
        if (pt.y > h + 40) pt.y = -20;

        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);

        if (pt.isFlower) {
          // Pink Sakura Blossom Petal
          ctx.fillStyle = `rgba(244, 114, 182, ${pt.opacity})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, pt.size * 1.5 * dpr, pt.size * 0.8 * dpr, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Bioluminescent Emerald Spore
          ctx.fillStyle = `rgba(52, 211, 153, ${pt.opacity})`;
          ctx.beginPath();
          ctx.arc(0, 0, pt.size * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // 6. BUTTERFLIES DANCING AROUND CANOPY (When tree is blooming)
      if (p > 0.45) {
        butterflies.forEach((b, idx) => {
          b.angle += 0.03;
          const bx = treeBaseX + Math.sin(b.angle + idx * 3) * 120 * dpr;
          const by = treeBaseY - 140 * dpr + Math.cos(b.angle * 1.4 + idx) * 50 * dpr;

          ctx.save();
          ctx.translate(bx, by);
          const flap = Math.sin(time * 18 + idx) * 0.7;
          ctx.scale(1, flap);

          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.ellipse(-b.size * 0.5 * dpr, 0, b.size * dpr, (b.size * 0.5) * dpr, -0.4, 0, Math.PI * 2);
          ctx.ellipse(b.size * 0.5 * dpr, 0, b.size * dpr, (b.size * 0.5) * dpr, 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }

      // 7. VICTORY CELEBRATION (p >= 0.95 / Mature Ancient Tree Reached)
      if (p >= 0.95) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        const bannerW = 320 * dpr;
        const bannerH = 48 * dpr;
        ctx.roundRect((w - bannerW) * 0.5, h * 0.12, bannerW, bannerH, 14 * dpr);
        ctx.fill();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.font = `bold ${12 * dpr}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('🌳 KADİM AĞAÇ TAMAMLANDI! 🌳', w * 0.5, h * 0.12 + 20 * dpr);

        ctx.fillStyle = '#6ee7b7';
        ctx.font = `${10 * dpr}px monospace`;
        ctx.fillText('Tohumdan Ulu Ağaca Dönüştü · Ormanına Eklendi', w * 0.5, h * 0.12 + 36 * dpr);
        ctx.restore();
      }

      // 8. LIVE GROWTH METRICS OVERLAY HUD
      const treeHeightMeters = (0.2 + p * 5.6).toFixed(1);
      const leafCount = Math.round(10 + p * 420);
      const stageName =
        p < 0.15
          ? 'Tohum & Filiz'
          : p < 0.45
          ? 'Büyüyen Fidan'
          : p < 0.8
          ? 'Çiçek Açan Genç Ağaç'
          : 'Kadim Zümrüt Ağacı';

      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.roundRect(16 * dpr, 16 * dpr, 230 * dpr, 48 * dpr, 12 * dpr);
      ctx.fill();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.font = `${9 * dpr}px monospace`;
      ctx.fillText(stageName.toUpperCase(), 26 * dpr, 32 * dpr);

      ctx.fillStyle = '#10b981';
      ctx.font = `bold ${14 * dpr}px monospace`;
      ctx.fillText(`${treeHeightMeters}m · ${leafCount} YAPRAK`, 26 * dpr, 52 * dpr);

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${11 * dpr}px sans-serif`;
      ctx.fillText(`%${Math.round(p * 100)}`, 195 * dpr, 52 * dpr);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};
