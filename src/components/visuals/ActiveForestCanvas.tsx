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

    // Floating magical spores & petals (Forest app serene atmosphere)
    const petals = Array.from({ length: 40 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 1200,
      size: Math.random() * 2.8 + 1.2,
      speedX: Math.random() * 0.8 + 0.3,
      speedY: Math.random() * 0.6 + 0.3,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.03,
      opacity: Math.random() * 0.6 + 0.3,
      color: Math.random() > 0.4 ? '#6ee7b7' : '#fbcfe8', // emerald or soft sakura petal
    }));

    // Butterflies around the blooming tree
    const butterflies = [
      { x: 0, y: 0, angle: 0, baseRadius: 110, speed: 1.4, color: '#f472b6' },
      { x: 0, y: 0, angle: Math.PI, baseRadius: 135, speed: -1.1, color: '#38bdf8' },
    ];

    const render = () => {
      animId = requestAnimationFrame(render);
      if (!isPausedRef.current) {
        time += 0.016;
      }

      // Smooth progress interpolation
      smoothProgress += (progressRef.current - smoothProgress) * 0.04;
      const p = Math.max(0, Math.min(1, smoothProgress));

      const w = canvas.width;
      const h = canvas.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      ctx.clearRect(0, 0, w, h);

      // 1. FOREST APP SERENE ATMOSPHERE (Deep tranquil forest dawn)
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#041610');
      bg.addColorStop(0.35, '#07241b');
      bg.addColorStop(0.7, '#0a3327');
      bg.addColorStop(1, '#051812');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 2. CELESTIAL GOD RAYS (Soft volumetric sunbeams)
      ctx.save();
      const rayAlpha = 0.06 + Math.sin(time * 0.6) * 0.02;
      ctx.fillStyle = `rgba(167, 243, 208, ${rayAlpha})`;
      for (let i = 0; i < 4; i++) {
        const sweep = Math.sin(time * 0.3 + i * 1.5) * 40 * dpr;
        ctx.beginPath();
        ctx.moveTo(w * 0.5 + sweep, 0);
        ctx.lineTo(w * (0.05 + i * 0.28) + sweep, h);
        ctx.lineTo(w * (0.16 + i * 0.28) + sweep, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // 3. FLOATING PETALS & POLLEN DUST
      petals.forEach((petal) => {
        petal.y += petal.speedY * dpr;
        petal.x += petal.speedX * dpr;
        petal.rot += petal.rotSpeed;

        if (petal.y > h + 20) {
          petal.y = -20;
          petal.x = Math.random() * w;
        }
        if (petal.x > w + 20) {
          petal.x = -20;
        }

        ctx.save();
        ctx.translate(petal.x, petal.y);
        ctx.rotate(petal.rot);
        ctx.fillStyle = petal.color;
        ctx.globalAlpha = petal.opacity;
        ctx.beginPath();
        ctx.ellipse(0, 0, petal.size * 1.6 * dpr, petal.size * 0.9 * dpr, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 4. FOREST APP SIGNATURE MOUND & SOIL ISLAND
      const islandX = w * 0.5;
      const islandY = h * 0.78;
      const islandWidth = Math.min(w * 0.75, 480 * dpr);
      const islandHeight = 55 * dpr;

      // Soft ambient ground shadow underneath island
      const shadowGrad = ctx.createRadialGradient(islandX, islandY + 30 * dpr, 10, islandX, islandY + 30 * dpr, islandWidth * 0.55);
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
      shadowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(islandX, islandY + 32 * dpr, islandWidth * 0.55, 26 * dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Layered earthy soil platform
      ctx.fillStyle = '#261910';
      ctx.beginPath();
      ctx.ellipse(islandX, islandY + 14 * dpr, islandWidth * 0.44, islandHeight * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rich fertile topsoil
      ctx.fillStyle = '#3a2416';
      ctx.beginPath();
      ctx.ellipse(islandX, islandY + 6 * dpr, islandWidth * 0.46, islandHeight * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      // Lush grassy top mound (Forest app vibrant green hill)
      const grassGrad = ctx.createRadialGradient(islandX, islandY - 8 * dpr, 20, islandX, islandY, islandWidth * 0.48);
      grassGrad.addColorStop(0, '#10b981');
      grassGrad.addColorStop(0.55, '#059669');
      grassGrad.addColorStop(1, '#047857');
      ctx.fillStyle = grassGrad;
      ctx.beginPath();
      ctx.ellipse(islandX, islandY, islandWidth * 0.48, islandHeight * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();

      // Decorative field daisies / grass tufts on mound
      const tuftAngles = [-0.35, -0.2, 0.15, 0.32];
      tuftAngles.forEach((ang, i) => {
        const tx = islandX + Math.sin(ang * Math.PI) * (islandWidth * 0.38);
        const ty = islandY + Math.cos(ang * Math.PI) * (islandHeight * 0.35);
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(tx, ty, (2.8 + (i % 2)) * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Tiny white daisy flower
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(tx + 4 * dpr, ty - 3 * dpr, 2.2 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(tx + 4 * dpr, ty - 3 * dpr, 1.0 * dpr, 0, Math.PI * 2);
        ctx.fill();
      });

      // Bio-nutrient roots glowing softly into the earth
      const rootGlow = ctx.createRadialGradient(islandX, islandY, 2, islandX, islandY, 70 * dpr);
      rootGlow.addColorStop(0, 'rgba(52, 211, 153, 0.45)');
      rootGlow.addColorStop(0.6, 'rgba(16, 185, 129, 0.12)');
      rootGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = rootGlow;
      ctx.beginPath();
      ctx.arc(islandX, islandY, 70 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // 5. PROCEDURAL FOREST APP TREE RENDERING (Cute, Stylized, Alive)
      const treeBaseX = islandX;
      const treeBaseY = islandY + 2 * dpr;

      // Gentle natural wind sway
      const windSway = Math.sin(time * 1.8) * 0.035;

      ctx.save();
      ctx.translate(treeBaseX, treeBaseY);

      if (p < 0.20) {
        // =========================================================================
        // STAGE 1: CUTE LITTLE SPROUT (0% - 20%)
        // =========================================================================
        const sproutProgress = p / 0.20;
        const stemHeight = (18 + sproutProgress * 28) * dpr;
        const leafScale = 0.5 + sproutProgress * 0.5;

        // Little green sprout stem
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 3.5 * dpr;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(windSway * 30 * dpr, -stemHeight * 0.5, windSway * 40 * dpr, -stemHeight);
        ctx.stroke();

        // Left cotyledon leaf
        ctx.save();
        ctx.translate(windSway * 40 * dpr, -stemHeight);
        ctx.rotate(-0.55 + windSway);
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.ellipse(-10 * dpr * leafScale, -4 * dpr * leafScale, 12 * dpr * leafScale, 6 * dpr * leafScale, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Right cotyledon leaf
        ctx.save();
        ctx.translate(windSway * 40 * dpr, -stemHeight);
        ctx.rotate(0.55 + windSway);
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.ellipse(10 * dpr * leafScale, -4 * dpr * leafScale, 12 * dpr * leafScale, 6 * dpr * leafScale, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Sparkle of water dewdrop on leaf tip
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(windSway * 40 * dpr + 15 * dpr * leafScale, -stemHeight - 6 * dpr * leafScale, 2.0 * dpr, 0, Math.PI * 2);
        ctx.fill();

      } else if (p < 0.50) {
        // =========================================================================
        // STAGE 2: GROWING SAPLING WITH BRANCHLETS (20% - 50%)
        // =========================================================================
        const saplingProg = (p - 0.20) / 0.30;
        const trunkHeight = (45 + saplingProg * 45) * dpr;

        // Young wooden trunk
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 7 * dpr;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(windSway * 25 * dpr, -trunkHeight * 0.5, windSway * 40 * dpr, -trunkHeight);
        ctx.stroke();

        // Small branching foliage puffs (Forest app cloud clumps)
        const puffSize = (22 + saplingProg * 18) * dpr;

        // Left leaf clump
        drawFoliagePuff(ctx, -18 * dpr + windSway * 20 * dpr, -trunkHeight * 0.75, puffSize * 0.75, '#059669', '#10b981', '#6ee7b7');
        // Right leaf clump
        drawFoliagePuff(ctx, 18 * dpr + windSway * 30 * dpr, -trunkHeight * 0.85, puffSize * 0.8, '#047857', '#10b981', '#34d399');
        // Top crown leaf clump
        drawFoliagePuff(ctx, windSway * 40 * dpr, -trunkHeight - puffSize * 0.4, puffSize, '#065f46', '#059669', '#34d399');

      } else {
        // =========================================================================
        // STAGE 3 & 4: MAJESTIC FLUFFY FOREST APP TREE (50% - 100%)
        // =========================================================================
        const matureProg = (p - 0.50) / 0.50;
        const treeScale = 0.85 + matureProg * 0.35;
        const trunkH = (95 + matureProg * 35) * dpr * treeScale;

        // Robust organic tree trunk (Layered rich warm bark)
        ctx.save();
        ctx.rotate(windSway * 0.6);

        // Trunk base taper
        ctx.fillStyle = '#5c2d12';
        ctx.beginPath();
        ctx.moveTo(-16 * dpr * treeScale, 0);
        ctx.lineTo(16 * dpr * treeScale, 0);
        ctx.quadraticCurveTo(8 * dpr * treeScale, -trunkH * 0.45, 6 * dpr * treeScale, -trunkH);
        ctx.lineTo(-6 * dpr * treeScale, -trunkH);
        ctx.quadraticCurveTo(-8 * dpr * treeScale, -trunkH * 0.45, -16 * dpr * treeScale, 0);
        ctx.closePath();
        ctx.fill();

        // Trunk bark highlight
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3 * dpr;
        ctx.beginPath();
        ctx.moveTo(-3 * dpr, -4 * dpr);
        ctx.lineTo(-2 * dpr, -trunkH * 0.7);
        ctx.stroke();

        // Primary branches
        ctx.strokeStyle = '#5c2d12';
        ctx.lineWidth = 8 * dpr * treeScale;
        ctx.lineCap = 'round';

        // Left bough
        ctx.beginPath();
        ctx.moveTo(0, -trunkH * 0.65);
        ctx.quadraticCurveTo(-25 * dpr * treeScale, -trunkH * 0.8, -48 * dpr * treeScale, -trunkH * 0.95);
        ctx.stroke();

        // Right bough
        ctx.beginPath();
        ctx.moveTo(0, -trunkH * 0.7);
        ctx.quadraticCurveTo(28 * dpr * treeScale, -trunkH * 0.85, 52 * dpr * treeScale, -trunkH * 1.05);
        ctx.stroke();

        ctx.restore();

        // FOREST APP SIGNATURE LAYERED CLOUD FOLIAGE PUFFS
        // Layer 1: Back shadows
        const fScale = treeScale;
        const topY = -trunkH - 20 * dpr * fScale;
        const sX = windSway * 45 * dpr;

        // Left canopy lobe
        drawFoliagePuff(ctx, -56 * dpr * fScale + sX * 0.7, topY + 22 * dpr, 46 * dpr * fScale, '#064e3b', '#059669', '#34d399');
        // Right canopy lobe
        drawFoliagePuff(ctx, 58 * dpr * fScale + sX * 0.9, topY + 16 * dpr, 50 * dpr * fScale, '#064e3b', '#059669', '#34d399');
        // Bottom center lobe
        drawFoliagePuff(ctx, sX * 0.8, topY + 36 * dpr, 55 * dpr * fScale, '#065f46', '#10b981', '#6ee7b7');
        // Left upper lobe
        drawFoliagePuff(ctx, -32 * dpr * fScale + sX * 0.85, topY - 14 * dpr, 52 * dpr * fScale, '#047857', '#10b981', '#6ee7b7');
        // Right upper lobe
        drawFoliagePuff(ctx, 34 * dpr * fScale + sX * 0.95, topY - 20 * dpr, 56 * dpr * fScale, '#059669', '#10b981', '#a7f3d0');
        // Main crowning crown puff
        drawFoliagePuff(ctx, sX, topY - 38 * dpr * fScale, 64 * dpr * fScale, '#065f46', '#10b981', '#a7f3d0');

        // Adorable Blossom / Berry Sprinkles on mature tree (Forest app charm!)
        if (p >= 0.70) {
          const flowerPositions = [
            { x: -38, y: -24, color: '#f472b6' },
            { x: 28, y: -32, color: '#fbcfe8' },
            { x: -16, y: -50, color: '#f472b6' },
            { x: 18, y: -62, color: '#fbbf24' },
            { x: -50, y: 12, color: '#fbcfe8' },
            { x: 44, y: 8, color: '#f472b6' },
          ];

          flowerPositions.forEach((fl) => {
            const fx = fl.x * dpr * fScale + sX;
            const fy = topY + fl.y * dpr * fScale;
            ctx.fillStyle = fl.color;
            ctx.beginPath();
            ctx.arc(fx, fy, 3.2 * dpr, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(fx, fy, 1.2 * dpr, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        // Cute animated flying butterflies when full grown!
        if (p >= 0.75) {
          butterflies.forEach((b) => {
            b.angle += b.speed * 0.02;
            const bx = sX + Math.cos(b.angle) * (b.baseRadius * dpr * fScale);
            const by = topY + Math.sin(b.angle * 2) * (35 * dpr * fScale) - 20 * dpr;

            // Butterfly flapping wings
            const wingFlap = Math.sin(time * 18);
            ctx.save();
            ctx.translate(bx, by);
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.ellipse(-3 * dpr, 0, 5 * dpr, 3.5 * dpr * Math.abs(wingFlap), 0.3, 0, Math.PI * 2);
            ctx.ellipse(3 * dpr, 0, 5 * dpr, 3.5 * dpr * Math.abs(wingFlap), -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });
        }
      }

      ctx.restore();

      // 6. 100% COMPLETION CELEBRATION (Golden laurels & forest celebration banner)
      if (p >= 0.98) {
        ctx.save();
        const bannerY = h * 0.86;
        ctx.fillStyle = 'rgba(6, 38, 29, 0.92)';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.8 * dpr;
        ctx.beginPath();
        ctx.roundRect(w * 0.5 - 170 * dpr, bannerY - 22 * dpr, 340 * dpr, 44 * dpr, 22 * dpr);
        ctx.fill();
        ctx.stroke();

        ctx.font = `bold ${12 * dpr}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#6ee7b7';
        ctx.fillText('🌳 ULU AĞACIN BAŞARIYLA BÜYÜDÜ! 🌳', w * 0.5, bannerY - 3 * dpr);

        ctx.font = `600 ${10 * dpr}px sans-serif`;
        ctx.fillStyle = '#d1fae5';
        ctx.fillText('Kişisel Orman Koruna Eklendi · Tebrikler!', w * 0.5, bannerY + 12 * dpr);
        ctx.restore();
      }
    };

    // Helper: Draw signature Forest-app puffy cloud foliage sphere
    function drawFoliagePuff(
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      radius: number,
      cShadow: string,
      cBody: string,
      cHighlight: string
    ) {
      // 1. Dark bottom shadow hemisphere
      c.fillStyle = cShadow;
      c.beginPath();
      c.arc(x, y + radius * 0.12, radius, 0, Math.PI * 2);
      c.fill();

      // 2. Vibrant lush body sphere
      const bodyGrad = c.createRadialGradient(x - radius * 0.2, y - radius * 0.25, 2, x, y, radius * 0.95);
      bodyGrad.addColorStop(0, cHighlight);
      bodyGrad.addColorStop(0.5, cBody);
      bodyGrad.addColorStop(1, cShadow);
      c.fillStyle = bodyGrad;
      c.beginPath();
      c.arc(x, y, radius * 0.92, 0, Math.PI * 2);
      c.fill();

      // 3. Sunny golden highlight crescent on top
      c.fillStyle = cHighlight;
      c.globalAlpha = 0.35;
      c.beginPath();
      c.ellipse(x - radius * 0.22, y - radius * 0.35, radius * 0.45, radius * 0.22, -0.2, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1.0;
    }

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};
