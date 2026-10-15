import React, { useEffect, useRef } from 'react';

interface ActiveForestCanvasProps {
  progress: number; // 0 to 1
  isPaused: boolean;
  elapsedSeconds: number;
  treeSpecies?: string;
  isCampActive?: boolean;
}

export const ActiveForestCanvas: React.FC<ActiveForestCanvasProps> = ({
  progress,
  isPaused,
  elapsedSeconds,
  treeSpecies = 'Meşe Ağacı',
  isCampActive = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const speciesRef = useRef(treeSpecies);
  speciesRef.current = treeSpecies;
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

    // Floating particles (sakura petals, pine pollen, forest spores)
    const particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 1200,
      size: Math.random() * 3.2 + 1.2,
      speedX: Math.random() * 0.9 + 0.3,
      speedY: Math.random() * 0.7 + 0.3,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04,
      opacity: Math.random() * 0.6 + 0.3,
    }));

    // Butterflies around the blooming tree
    const butterflies = [
      { x: 0, y: 0, angle: 0, baseRadius: 115, speed: 1.4, color: '#f472b6' },
      { x: 0, y: 0, angle: Math.PI, baseRadius: 140, speed: -1.1, color: '#38bdf8' },
    ];

    const render = () => {
      animId = requestAnimationFrame(render);
      if (!isPausedRef.current) {
        time += 0.016;
      }

      smoothProgress += (progressRef.current - smoothProgress) * 0.04;
      const p = Math.max(0, Math.min(1, smoothProgress));
      const w = canvas.width;
      const h = canvas.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const currentSpecies = speciesRef.current || 'Meşe Ağacı';
      const isSakura = currentSpecies.includes('Sakura') || currentSpecies.includes('Kiraz');
      const isPine = currentSpecies.includes('Çam');
      const isSequoia = currentSpecies.includes('Sekoya');
      const isOak = !isSakura && !isPine && !isSequoia;

      ctx.clearRect(0, 0, w, h);

      // 1. ATMOSPHERE GRADIENT
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      if (isSakura) {
        bg.addColorStop(0, '#1a0d18');
        bg.addColorStop(0.35, '#261220');
        bg.addColorStop(0.7, '#1f0e24');
        bg.addColorStop(1, '#0c0710');
      } else if (isPine) {
        bg.addColorStop(0, '#04161b');
        bg.addColorStop(0.35, '#07242c');
        bg.addColorStop(0.7, '#0a3138');
        bg.addColorStop(1, '#05181b');
      } else if (isSequoia) {
        bg.addColorStop(0, '#1c0f0a');
        bg.addColorStop(0.35, '#291811');
        bg.addColorStop(0.7, '#1f1a14');
        bg.addColorStop(1, '#0f0a07');
      } else {
        // Meşe (Lush Temperate Forest)
        bg.addColorStop(0, '#041610');
        bg.addColorStop(0.35, '#07241b');
        bg.addColorStop(0.7, '#0a3327');
        bg.addColorStop(1, '#051812');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 2. CELESTIAL GOD RAYS
      ctx.save();
      const rayAlpha = 0.06 + Math.sin(time * 0.6) * 0.02;
      ctx.fillStyle = isSakura
        ? `rgba(251, 207, 232, ${rayAlpha * 1.2})`
        : isPine
        ? `rgba(186, 230, 253, ${rayAlpha})`
        : isSequoia
        ? `rgba(254, 215, 170, ${rayAlpha * 1.3})`
        : `rgba(167, 243, 208, ${rayAlpha})`;

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

      // 3. FLOATING PETALS / SPORES
      particles.forEach((petal) => {
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
        ctx.fillStyle = isSakura
          ? '#fbcfe8'
          : isPine
          ? '#a7f3d0'
          : isSequoia
          ? '#fde68a'
          : '#6ee7b7';
        ctx.globalAlpha = petal.opacity;
        ctx.beginPath();
        if (isSakura) {
          // Heart-notched cherry petal
          ctx.ellipse(0, 0, petal.size * 1.8 * dpr, petal.size * 1.1 * dpr, 0, 0, Math.PI * 2);
        } else if (isPine) {
          // Slender pine pollen
          ctx.ellipse(0, 0, petal.size * 1.4 * dpr, petal.size * 0.7 * dpr, 0, 0, Math.PI * 2);
        } else {
          ctx.arc(0, 0, petal.size * dpr, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
      });

      // 4. SIGNATURE MOUND & SOIL ISLAND
      const islandX = w * 0.5;
      const islandY = h * 0.78;
      const islandWidth = Math.min(w * 0.75, 480 * dpr);
      const islandHeight = 55 * dpr;

      // Soft ambient ground shadow
      const shadowGrad = ctx.createRadialGradient(
        islandX,
        islandY + 30 * dpr,
        10,
        islandX,
        islandY + 30 * dpr,
        islandWidth * 0.55
      );
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
      shadowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(islandX, islandY + 32 * dpr, islandWidth * 0.55, 26 * dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Earthy soil platform
      ctx.fillStyle = '#261910';
      ctx.beginPath();
      ctx.ellipse(islandX, islandY + 14 * dpr, islandWidth * 0.44, islandHeight * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();

      // Fertile topsoil
      ctx.fillStyle = '#3a2416';
      ctx.beginPath();
      ctx.ellipse(islandX, islandY + 6 * dpr, islandWidth * 0.46, islandHeight * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      // Lush grassy mound
      const grassGrad = ctx.createRadialGradient(
        islandX,
        islandY - 8 * dpr,
        20,
        islandX,
        islandY,
        islandWidth * 0.48
      );
      grassGrad.addColorStop(0, isSakura ? '#15803d' : '#10b981');
      grassGrad.addColorStop(0.55, isPine ? '#047857' : '#059669');
      grassGrad.addColorStop(1, '#047857');
      ctx.fillStyle = grassGrad;
      ctx.beginPath();
      ctx.ellipse(islandX, islandY, islandWidth * 0.48, islandHeight * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();

      // Mound flowers & tufts
      const tuftAngles = [-0.35, -0.2, 0.15, 0.32];
      tuftAngles.forEach((ang, i) => {
        const tx = islandX + Math.sin(ang * Math.PI) * (islandWidth * 0.38);
        const ty = islandY + Math.cos(ang * Math.PI) * (islandHeight * 0.35);
        ctx.fillStyle = isSakura ? '#f472b6' : '#34d399';
        ctx.beginPath();
        ctx.arc(tx, ty, (2.8 + (i % 2)) * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Tiny flower blossom
        ctx.fillStyle = isSakura ? '#ffffff' : '#ffffff';
        ctx.beginPath();
        ctx.arc(tx + 4 * dpr, ty - 3 * dpr, 2.2 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isSakura ? '#fbcfe8' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(tx + 4 * dpr, ty - 3 * dpr, 1.0 * dpr, 0, Math.PI * 2);
        ctx.fill();
      });

      // Bio-nutrient root glow
      const rootGlow = ctx.createRadialGradient(islandX, islandY, 2, islandX, islandY, 70 * dpr);
      rootGlow.addColorStop(0, isSakura ? 'rgba(244, 114, 182, 0.35)' : 'rgba(52, 211, 153, 0.45)');
      rootGlow.addColorStop(0.6, 'rgba(16, 185, 129, 0.12)');
      rootGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = rootGlow;
      ctx.beginPath();
      ctx.arc(islandX, islandY, 70 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // 5. PROCEDURAL BOTANICAL TREE RENDERING
      const treeBaseX = islandX;
      const treeBaseY = islandY + 2 * dpr;
      const windSway = Math.sin(time * 1.8) * 0.035;

      ctx.save();
      ctx.translate(treeBaseX, treeBaseY);

      if (p < 0.20) {
        // =========================================================================
        // AŞAMA 1: FİZLİZLENME / FİDAN AŞAMASI (0% - 20%)
        // =========================================================================
        const sproutProgress = p / 0.20;
        const stemHeight = (18 + sproutProgress * 28) * dpr;
        const leafScale = 0.5 + sproutProgress * 0.5;

        // Gövde sürgünü
        ctx.strokeStyle = isSequoia ? '#9a3412' : isSakura ? '#e879f9' : '#34d399';
        ctx.lineWidth = 3.5 * dpr;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(windSway * 30 * dpr, -stemHeight * 0.5, windSway * 40 * dpr, -stemHeight);
        ctx.stroke();

        // Sol yaprakçık
        ctx.save();
        ctx.translate(windSway * 40 * dpr, -stemHeight);
        ctx.rotate(-0.55 + windSway);
        ctx.fillStyle = isSakura ? '#f472b6' : '#10b981';
        ctx.beginPath();
        ctx.ellipse(-10 * dpr * leafScale, -4 * dpr * leafScale, 12 * dpr * leafScale, 6 * dpr * leafScale, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Sağ yaprakçık
        ctx.save();
        ctx.translate(windSway * 40 * dpr, -stemHeight);
        ctx.rotate(0.55 + windSway);
        ctx.fillStyle = isSakura ? '#fbcfe8' : '#34d399';
        ctx.beginPath();
        ctx.ellipse(10 * dpr * leafScale, -4 * dpr * leafScale, 12 * dpr * leafScale, 6 * dpr * leafScale, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else if (p < 0.50) {
        // =========================================================================
        // AŞAMA 2: GENÇ FİDAN DALLANMASI (20% - 50%)
        // =========================================================================
        const saplingProg = (p - 0.20) / 0.30;
        const trunkHeight = (45 + saplingProg * 45) * dpr;

        // Ağaç türüne uygun gövde
        ctx.strokeStyle = isSequoia ? '#7c2d12' : isSakura ? '#4a1525' : '#78350f';
        ctx.lineWidth = (isSequoia ? 9 : 7) * dpr;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(windSway * 25 * dpr, -trunkHeight * 0.5, windSway * 40 * dpr, -trunkHeight);
        ctx.stroke();

        const puffSize = (22 + saplingProg * 18) * dpr;

        if (isPine) {
          // Genç çam: katmanlı üçgen iğne katmanları
          drawPineTier(ctx, windSway * 30 * dpr, -trunkHeight * 0.65, 24 * dpr, 16 * dpr);
          drawPineTier(ctx, windSway * 35 * dpr, -trunkHeight * 0.85, 20 * dpr, 14 * dpr);
          drawPineTier(ctx, windSway * 40 * dpr, -trunkHeight, 14 * dpr, 12 * dpr);
        } else if (isSakura) {
          drawFoliagePuff(ctx, -18 * dpr + windSway * 20 * dpr, -trunkHeight * 0.75, puffSize * 0.75, '#831843', '#db2777', '#fbcfe8');
          drawFoliagePuff(ctx, 18 * dpr + windSway * 30 * dpr, -trunkHeight * 0.85, puffSize * 0.8, '#9d174d', '#f472b6', '#fdf2f8');
          drawFoliagePuff(ctx, windSway * 40 * dpr, -trunkHeight - puffSize * 0.4, puffSize, '#be185d', '#ec4899', '#ffffff');
        } else {
          // Meşe & Sekoya genç yaprakları
          drawFoliagePuff(ctx, -18 * dpr + windSway * 20 * dpr, -trunkHeight * 0.75, puffSize * 0.75, '#059669', '#10b981', '#6ee7b7');
          drawFoliagePuff(ctx, 18 * dpr + windSway * 30 * dpr, -trunkHeight * 0.85, puffSize * 0.8, '#047857', '#10b981', '#34d399');
          drawFoliagePuff(ctx, windSway * 40 * dpr, -trunkHeight - puffSize * 0.4, puffSize, '#065f46', '#059669', '#34d399');
        }

      } else {
        // =========================================================================
        // AŞAMA 3 & 4: BOTANİK OLARAK TAM MODELENMİŞ 4 AĞAÇ (50% - 100%)
        // =========================================================================
        const matureProg = (p - 0.50) / 0.50;
        const treeScale = 0.85 + matureProg * 0.35;
        const sX = windSway * 45 * dpr;

        if (isOak) {
          // -------------------------------------------------------------
          // 1. MEŞE AĞACI (ULU, GENİŞ VE GÜÇLÜ MEŞE)
          // -------------------------------------------------------------
          const trunkH = (95 + matureProg * 35) * dpr * treeScale;

          // Kalın, damarlı, organik genişleyen meşe gövdesi
          ctx.save();
          ctx.rotate(windSway * 0.5);

          ctx.fillStyle = '#451a03';
          ctx.beginPath();
          ctx.moveTo(-18 * dpr * treeScale, 0);
          ctx.lineTo(18 * dpr * treeScale, 0);
          ctx.quadraticCurveTo(10 * dpr * treeScale, -trunkH * 0.4, 8 * dpr * treeScale, -trunkH);
          ctx.lineTo(-8 * dpr * treeScale, -trunkH);
          ctx.quadraticCurveTo(-10 * dpr * treeScale, -trunkH * 0.4, -18 * dpr * treeScale, 0);
          ctx.closePath();
          ctx.fill();

          // Gövde kabuk çizgileri
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 3 * dpr;
          ctx.beginPath();
          ctx.moveTo(-4 * dpr, -6 * dpr);
          ctx.lineTo(-3 * dpr, -trunkH * 0.7);
          ctx.moveTo(5 * dpr, -10 * dpr);
          ctx.lineTo(3 * dpr, -trunkH * 0.65);
          ctx.stroke();

          // Genişleyen meşe ana dalları (boughs)
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 10 * dpr * treeScale;
          ctx.lineCap = 'round';
          // Sol ana dal
          ctx.beginPath();
          ctx.moveTo(0, -trunkH * 0.6);
          ctx.quadraticCurveTo(-35 * dpr * treeScale, -trunkH * 0.75, -55 * dpr * treeScale, -trunkH * 0.95);
          ctx.stroke();
          // Sağ ana dal
          ctx.beginPath();
          ctx.moveTo(0, -trunkH * 0.65);
          ctx.quadraticCurveTo(38 * dpr * treeScale, -trunkH * 0.8, 60 * dpr * treeScale, -trunkH * 1.05);
          ctx.stroke();

          ctx.restore();

          // Dolgun, geniş, yuvarlak meşe yaprak kümeleri (Oak Crown)
          const topY = -trunkH - 20 * dpr * treeScale;
          drawFoliagePuff(ctx, -62 * dpr * treeScale + sX * 0.7, topY + 24 * dpr, 48 * dpr * treeScale, '#064e3b', '#059669', '#34d399');
          drawFoliagePuff(ctx, 64 * dpr * treeScale + sX * 0.9, topY + 18 * dpr, 52 * dpr * treeScale, '#064e3b', '#059669', '#34d399');
          drawFoliagePuff(ctx, sX * 0.8, topY + 38 * dpr, 58 * dpr * treeScale, '#065f46', '#10b981', '#6ee7b7');
          drawFoliagePuff(ctx, -34 * dpr * treeScale + sX * 0.85, topY - 14 * dpr, 55 * dpr * treeScale, '#047857', '#10b981', '#6ee7b7');
          drawFoliagePuff(ctx, 36 * dpr * treeScale + sX * 0.95, topY - 20 * dpr, 58 * dpr * treeScale, '#059669', '#10b981', '#a7f3d0');
          drawFoliagePuff(ctx, sX, topY - 42 * dpr * treeScale, 66 * dpr * treeScale, '#065f46', '#10b981', '#a7f3d0');

          // Meşe palamutları (Acorns)
          if (p >= 0.75) {
            const acornPositions = [
              { x: -38, y: 15 },
              { x: 35, y: 10 },
              { x: -15, y: 25 },
              { x: 18, y: 30 },
            ];
            acornPositions.forEach((ac) => {
              const ax = ac.x * dpr * treeScale + sX;
              const ay = topY + ac.y * dpr * treeScale;
              // Palamut şapkası
              ctx.fillStyle = '#78350f';
              ctx.beginPath();
              ctx.arc(ax, ay, 4 * dpr, Math.PI, 0);
              ctx.fill();
              // Palamut gövdesi
              ctx.fillStyle = '#b45309';
              ctx.beginPath();
              ctx.ellipse(ax, ay + 3 * dpr, 3.5 * dpr, 5 * dpr, 0, 0, Math.PI * 2);
              ctx.fill();
            });
          }

        } else if (isPine) {
          // -------------------------------------------------------------
          // 2. ÇAM AĞACI (KATMANLI PİRAMİT DAĞ ÇAMI)
          // -------------------------------------------------------------
          const trunkH = (110 + matureProg * 40) * dpr * treeScale;

          // Düz, uzun çam gövdesi
          ctx.save();
          ctx.rotate(windSway * 0.4);
          ctx.fillStyle = '#3e2723';
          ctx.beginPath();
          ctx.moveTo(-11 * dpr * treeScale, 0);
          ctx.lineTo(11 * dpr * treeScale, 0);
          ctx.lineTo(5 * dpr * treeScale, -trunkH);
          ctx.lineTo(-5 * dpr * treeScale, -trunkH);
          ctx.closePath();
          ctx.fill();

          // Çam kabuk dokusu
          ctx.strokeStyle = '#5d4037';
          ctx.lineWidth = 2 * dpr;
          for (let yStep = 0; yStep < trunkH * 0.8; yStep += 14 * dpr) {
            ctx.beginPath();
            ctx.moveTo(-7 * dpr, -yStep);
            ctx.lineTo(7 * dpr, -yStep - 4 * dpr);
            ctx.stroke();
          }
          ctx.restore();

          // 5 Katmanlı Piramit İğne Yaprak Katmanları (Tiered Conifer Canopy)
          const tiers = [
            { yRatio: 0.42, wTier: 110, hTier: 40, c1: '#064e3b', c2: '#047857' },
            { yRatio: 0.58, wTier: 94, hTier: 36, c1: '#065f46', c2: '#059669' },
            { yRatio: 0.72, wTier: 78, hTier: 34, c1: '#047857', c2: '#10b981' },
            { yRatio: 0.86, wTier: 60, hTier: 30, c1: '#059669', c2: '#34d399' },
            { yRatio: 1.00, wTier: 40, hTier: 26, c1: '#10b981', c2: '#6ee7b7' },
          ];

          tiers.forEach((tier, idx) => {
            const tierY = -trunkH * tier.yRatio;
            const tierX = sX * (tier.yRatio * 0.8);
            drawPineTier(
              ctx,
              tierX,
              tierY,
              tier.wTier * dpr * treeScale,
              tier.hTier * dpr * treeScale,
              tier.c1,
              tier.c2
            );

            // Altına asılan çam kozalakları (Pine Cones)
            if (p >= 0.70 && idx < 3) {
              [-0.35, 0.35].forEach((offset) => {
                const coneX = tierX + offset * tier.wTier * dpr * treeScale;
                const coneY = tierY + 4 * dpr;
                ctx.fillStyle = '#4e342e';
                ctx.beginPath();
                ctx.ellipse(coneX, coneY, 3 * dpr, 6 * dpr, 0.1, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#6d4c41';
                ctx.beginPath();
                ctx.arc(coneX, coneY - 3 * dpr, 2.5 * dpr, 0, Math.PI * 2);
                ctx.fill();
              });
            }
          });

        } else if (isSakura) {
          // -------------------------------------------------------------
          // 3. KİRAZ ÇİÇEĞİ (SAKURA / JAPON BAHARI)
          // -------------------------------------------------------------
          const trunkH = (95 + matureProg * 30) * dpr * treeScale;

          // Zarif S-kıvrımlı koyu kiraz ağacı gövdesi
          ctx.save();
          ctx.rotate(windSway * 0.6);

          ctx.strokeStyle = '#2d151e';
          ctx.lineWidth = 14 * dpr * treeScale;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(
            -22 * dpr * treeScale,
            -trunkH * 0.35,
            18 * dpr * treeScale,
            -trunkH * 0.65,
            -6 * dpr * treeScale,
            -trunkH
          );
          ctx.stroke();

          // Zarif dallar
          ctx.lineWidth = 6 * dpr * treeScale;
          ctx.beginPath();
          ctx.moveTo(-10 * dpr * treeScale, -trunkH * 0.55);
          ctx.quadraticCurveTo(-45 * dpr * treeScale, -trunkH * 0.7, -65 * dpr * treeScale, -trunkH * 0.9);
          ctx.moveTo(6 * dpr * treeScale, -trunkH * 0.65);
          ctx.quadraticCurveTo(45 * dpr * treeScale, -trunkH * 0.75, 65 * dpr * treeScale, -trunkH * 1.02);
          ctx.stroke();

          ctx.restore();

          // Pembe çiçek bulutları (Blossom Puffs)
          const topY = -trunkH - 18 * dpr * treeScale;
          drawFoliagePuff(ctx, -58 * dpr * treeScale + sX * 0.7, topY + 22 * dpr, 46 * dpr * treeScale, '#831843', '#db2777', '#fbcfe8');
          drawFoliagePuff(ctx, 60 * dpr * treeScale + sX * 0.9, topY + 16 * dpr, 50 * dpr * treeScale, '#9d174d', '#f472b6', '#fdf2f8');
          drawFoliagePuff(ctx, sX * 0.8, topY + 36 * dpr, 54 * dpr * treeScale, '#be185d', '#ec4899', '#fce7f3');
          drawFoliagePuff(ctx, -32 * dpr * treeScale + sX * 0.85, topY - 14 * dpr, 52 * dpr * treeScale, '#9d174d', '#f472b6', '#fff1f2');
          drawFoliagePuff(ctx, 34 * dpr * treeScale + sX * 0.95, topY - 20 * dpr, 56 * dpr * treeScale, '#db2777', '#f472b6', '#ffffff');
          drawFoliagePuff(ctx, sX, topY - 38 * dpr * treeScale, 62 * dpr * treeScale, '#ec4899', '#fbcfe8', '#ffffff');

          // Kiraz Çiçeği Detayları (Açmış 5 yapraklı sakura çiçekleri)
          const blossomSpots = [
            { x: -40, y: -20 },
            { x: 32, y: -26 },
            { x: -14, y: -48 },
            { x: 22, y: -58 },
            { x: -48, y: 14 },
            { x: 46, y: 12 },
            { x: 0, y: 18 },
          ];

          blossomSpots.forEach((bSpot) => {
            const bx = bSpot.x * dpr * treeScale + sX;
            const by = topY + bSpot.y * dpr * treeScale;
            // 5 taç yaprak
            for (let petal = 0; petal < 5; petal++) {
              const ang = (petal * Math.PI * 2) / 5;
              ctx.fillStyle = '#fce7f3';
              ctx.beginPath();
              ctx.arc(bx + Math.cos(ang) * 4 * dpr, by + Math.sin(ang) * 4 * dpr, 2.5 * dpr, 0, Math.PI * 2);
              ctx.fill();
            }
            // Çiçek sarı göbek
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(bx, by, 1.8 * dpr, 0, Math.PI * 2);
            ctx.fill();
          });

        } else if (isSequoia) {
          // -------------------------------------------------------------
          // 4. DEV SEKOYA (DEVASA KIZIL GÖVDELİ ASIRLIK GÖK DELEN)
          // -------------------------------------------------------------
          const trunkH = (125 + matureProg * 45) * dpr * treeScale;

          // Çok kalın, tabana doğru genişçe yayılan kırmızımsı dev sekoya gövdesi
          ctx.save();
          ctx.rotate(windSway * 0.3);

          const buttressW = 28 * dpr * treeScale;
          ctx.fillStyle = '#7c2d12'; // Rich redwood cinnamon bark
          ctx.beginPath();
          ctx.moveTo(-buttressW, 0);
          ctx.lineTo(buttressW, 0);
          ctx.quadraticCurveTo(14 * dpr * treeScale, -trunkH * 0.35, 10 * dpr * treeScale, -trunkH);
          ctx.lineTo(-10 * dpr * treeScale, -trunkH);
          ctx.quadraticCurveTo(-14 * dpr * treeScale, -trunkH * 0.35, -buttressW, 0);
          ctx.closePath();
          ctx.fill();

          // Dikey lifli derin sekoya kabuk yarıkları
          ctx.strokeStyle = '#9a3412';
          ctx.lineWidth = 3 * dpr;
          [-0.5, -0.2, 0.15, 0.45].forEach((pos) => {
            ctx.beginPath();
            ctx.moveTo(pos * buttressW, -4 * dpr);
            ctx.lineTo(pos * 10 * dpr * treeScale, -trunkH * 0.9);
            ctx.stroke();
          });

          ctx.restore();

          // Sekoya yüksek, heybetli iğneli konifer tacı
          const topY = -trunkH - 12 * dpr * treeScale;
          drawFoliagePuff(ctx, -42 * dpr * treeScale + sX * 0.6, topY + 28 * dpr, 42 * dpr * treeScale, '#064e3b', '#047857', '#34d399');
          drawFoliagePuff(ctx, 44 * dpr * treeScale + sX * 0.8, topY + 22 * dpr, 44 * dpr * treeScale, '#064e3b', '#047857', '#34d399');
          drawFoliagePuff(ctx, sX * 0.7, topY + 36 * dpr, 50 * dpr * treeScale, '#065f46', '#059669', '#6ee7b7');
          drawFoliagePuff(ctx, -26 * dpr * treeScale + sX * 0.75, topY - 10 * dpr, 46 * dpr * treeScale, '#047857', '#10b981', '#6ee7b7');
          drawFoliagePuff(ctx, 28 * dpr * treeScale + sX * 0.85, topY - 14 * dpr, 48 * dpr * treeScale, '#059669', '#10b981', '#a7f3d0');
          drawFoliagePuff(ctx, sX, topY - 45 * dpr * treeScale, 56 * dpr * treeScale, '#065f46', '#10b981', '#a7f3d0');
        }

        // Kelebekler (tüm olgun ağaçlarda uçar)
        if (p >= 0.75) {
          butterflies.forEach((b) => {
            b.angle += b.speed * 0.02;
            const bx = sX + Math.cos(b.angle) * (b.baseRadius * dpr * treeScale);
            const by = -120 * dpr * treeScale + Math.sin(b.angle * 2) * (35 * dpr * treeScale);

            const wingFlap = Math.sin(time * 18);
            ctx.save();
            ctx.translate(bx, by);
            ctx.fillStyle = isSakura ? '#f472b6' : b.color;
            ctx.beginPath();
            ctx.ellipse(-3 * dpr, 0, 5 * dpr, 3.5 * dpr * Math.abs(wingFlap), 0.3, 0, Math.PI * 2);
            ctx.ellipse(3 * dpr, 0, 5 * dpr, 3.5 * dpr * Math.abs(wingFlap), -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });
        }
      }

      ctx.restore();

      // 6. KUTLAMA PANKARTI (100% Tamamlandığında)
      if (p >= 0.98) {
        ctx.save();
        const bannerY = h * 0.86;
        ctx.fillStyle = 'rgba(6, 38, 29, 0.92)';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.8 * dpr;
        ctx.beginPath();
        ctx.roundRect(w * 0.5 - 175 * dpr, bannerY - 22 * dpr, 350 * dpr, 44 * dpr, 22 * dpr);
        ctx.fill();
        ctx.stroke();

        ctx.font = `bold ${12 * dpr}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#6ee7b7';
        ctx.fillText(`🌳 ${currentSpecies.toUpperCase()} BAŞARIYLA BÜYÜDÜ! 🌳`, w * 0.5, bannerY - 3 * dpr);

        ctx.font = `600 ${10 * dpr}px sans-serif`;
        ctx.fillStyle = '#d1fae5';
        ctx.fillText('Kişisel Orman Koruna Eklendi · Harika Odaklanma!', w * 0.5, bannerY + 12 * dpr);
        ctx.restore();
      }
    };

    // Helper: Yuvarlak bulut yaprak kümesi (Foliage Puff)
    function drawFoliagePuff(
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      radius: number,
      cShadow: string,
      cBody: string,
      cHighlight: string
    ) {
      // Gölge altı
      c.fillStyle = cShadow;
      c.beginPath();
      c.arc(x, y + radius * 0.12, radius, 0, Math.PI * 2);
      c.fill();

      // Gövde gradyanı
      const bodyGrad = c.createRadialGradient(x - radius * 0.2, y - radius * 0.25, 2, x, y, radius * 0.95);
      bodyGrad.addColorStop(0, cHighlight);
      bodyGrad.addColorStop(0.5, cBody);
      bodyGrad.addColorStop(1, cShadow);
      c.fillStyle = bodyGrad;
      c.beginPath();
      c.arc(x, y, radius * 0.92, 0, Math.PI * 2);
      c.fill();

      // Üst aydınlık hilal
      c.fillStyle = cHighlight;
      c.globalAlpha = 0.35;
      c.beginPath();
      c.ellipse(x - radius * 0.22, y - radius * 0.35, radius * 0.45, radius * 0.22, -0.2, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1.0;
    }

    // Helper: Çam Ağacı Katman Çizimi (Serrations and Pine Needle Shelf)
    function drawPineTier(
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      wTier: number,
      hTier: number,
      cDark = '#064e3b',
      cLight = '#10b981'
    ) {
      c.save();
      c.translate(x, y);

      // Koyu alt gölge
      c.fillStyle = cDark;
      c.beginPath();
      c.moveTo(0, -hTier);
      c.lineTo(wTier * 0.5, 0);
      c.lineTo(wTier * 0.35, -hTier * 0.2);
      c.lineTo(0, -hTier * 0.1);
      c.lineTo(-wTier * 0.35, -hTier * 0.2);
      c.lineTo(-wTier * 0.5, 0);
      c.closePath();
      c.fill();

      // İğneli çam üçgeni
      const tierGrad = c.createLinearGradient(0, -hTier, 0, 0);
      tierGrad.addColorStop(0, cLight);
      tierGrad.addColorStop(1, cDark);
      c.fillStyle = tierGrad;

      c.beginPath();
      c.moveTo(0, -hTier);
      c.lineTo(wTier * 0.48, 0);
      // Dişli iğne yaprak kenarı
      c.lineTo(wTier * 0.3, -hTier * 0.25);
      c.lineTo(wTier * 0.15, -hTier * 0.05);
      c.lineTo(0, -hTier * 0.2);
      c.lineTo(-wTier * 0.15, -hTier * 0.05);
      c.lineTo(-wTier * 0.3, -hTier * 0.25);
      c.lineTo(-wTier * 0.48, 0);
      c.closePath();
      c.fill();

      c.restore();
    }

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};
