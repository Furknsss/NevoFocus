import React, { useEffect, useRef, useState } from 'react';
import { Waves, Sparkles, Trophy, Anchor, Compass } from 'lucide-react';

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

  const [fishCityImage, setFishCityImage] = useState<HTMLImageElement | null>(null);

  // Preload high-res Fish City Atlantis image
  useEffect(() => {
    const img = new Image();
    img.src = '/src/assets/images/fish_city_atlantis_1791796247111.jpg';
    img.onload = () => {
      setFishCityImage(img);
    };
  }, []);

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

    // Dynamic deep sea bubbles rising up as fish descends down
    const bubbles = Array.from({ length: 24 }, () => ({
      x: Math.random() * 2500,
      y: Math.random() * 1600,
      size: Math.random() * 3.5 + 1.5,
      speedY: -Math.random() * 3.5 - 2.0,
      wobbleSpeed: Math.random() * 2.5 + 1.2,
      wobbleAmp: Math.random() * 1.5 + 0.8,
      opacity: Math.random() * 0.5 + 0.2,
    }));

    // Bioluminescent deep sea plankton
    const plankton = Array.from({ length: 30 }, () => ({
      x: Math.random() * 2500,
      y: Math.random() * 1600,
      size: Math.random() * 1.8 + 0.8,
      speedY: -Math.random() * 1.5 - 0.8,
      glowHue: Math.random() > 0.4 ? 175 : 195,
      pulseOffset: Math.random() * Math.PI * 2,
    }));

    // Splash drops from the initial jump
    const splashDrops: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      life: number;
    }[] = [];

    const ripples: { x: number; y: number; r: number; maxR: number; alpha: number }[] = [];

    // Swimming schools of deep fish passing by
    const schools = Array.from({ length: 8 }, (_, i) => ({
      x: Math.random() * 2000,
      y: Math.random() * 1000,
      speed: (Math.random() * 0.8 + 0.6) * (i % 2 === 0 ? 1 : -1),
      depthLevel: 0.2 + (i * 0.1),
      size: Math.random() * 12 + 8,
    }));

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
      currentRenderProgress += (progressRef.current - currentRenderProgress) * 0.04;
      const sessionProg = Math.max(0, Math.min(1, currentRenderProgress));

      // NATURAL ESCAPE JUMP: 3.8s total duration at normal, realistic speed
      const JUMP_DURATION = 3.8;
      const jumpProgress = Math.min(1, localDiveTimer / JUMP_DURATION);
      const isCinematicJumping = jumpProgress < 1.0;

      // CONTINUOUS DEPTH CALCULATION: 0m to 1,000m
      let effectiveDepthRatio = 0;
      if (sessionProg > 0.001) {
        effectiveDepthRatio = Math.min(1.0, sessionProg);
      } else {
        if (isCinematicJumping) {
          effectiveDepthRatio = jumpProgress * 0.04;
        } else {
          const divingTime = localDiveTimer - JUMP_DURATION;
          effectiveDepthRatio = Math.min(1.0, 0.04 + divingTime * 0.015);
        }
      }

      const currentDepthMeters = Math.round(effectiveDepthRatio * 1000);

      // =========================================================================
      // 1. DYNAMIC OCEAN DEPTH GRADIENT (Simulates true deep abyss journey)
      // =========================================================================
      const oceanBg = ctx.createLinearGradient(0, 0, 0, h);
      if (effectiveDepthRatio < 0.25) {
        // Epipelagic (Sunlight Zone 0-200m)
        oceanBg.addColorStop(0, '#0c4a6e');
        oceanBg.addColorStop(0.5, '#075985');
        oceanBg.addColorStop(1, '#0369a1');
      } else if (effectiveDepthRatio < 0.60) {
        // Mesopelagic (Twilight Zone 200-600m)
        oceanBg.addColorStop(0, '#082f49');
        oceanBg.addColorStop(0.5, '#0c4a6e');
        oceanBg.addColorStop(1, '#021827');
      } else if (effectiveDepthRatio < 0.88) {
        // Bathypelagic (Midnight Abyss 600-880m)
        oceanBg.addColorStop(0, '#020617');
        oceanBg.addColorStop(0.5, '#031a29');
        oceanBg.addColorStop(1, '#020d18');
      } else {
        // Balık Şehri (Sanctuary of Fish City 880-1000m)
        oceanBg.addColorStop(0, '#020d1a');
        oceanBg.addColorStop(0.5, '#082f49');
        oceanBg.addColorStop(1, '#042132');
      }
      ctx.fillStyle = oceanBg;
      ctx.fillRect(0, 0, w, h);

      // =========================================================================
      // 2. SUNBEAMS / CAUSTICS (Gradually fade as depth increases)
      // =========================================================================
      if (effectiveDepthRatio < 0.40) {
        const lightRayAlpha = (1 - effectiveDepthRatio / 0.40) * 0.12;
        ctx.save();
        ctx.fillStyle = `rgba(186, 230, 253, ${lightRayAlpha})`;
        for (let i = 0; i < 4; i++) {
          const sweep = Math.sin(time * 0.5 + i) * 40 * dpr;
          ctx.beginPath();
          ctx.moveTo(w * (0.2 + i * 0.2) + sweep, 0);
          ctx.lineTo(w * (0.1 + i * 0.25) + sweep, h * 0.8);
          ctx.lineTo(w * (0.25 + i * 0.25) + sweep, h * 0.8);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // =========================================================================
      // 3. BALIK ŞEHRİ CINEMATIC (At depth >= 900m / progress >= 90%)
      // =========================================================================
      if (effectiveDepthRatio >= 0.88 && fishCityImage) {
        const cityAlpha = Math.min(1.0, (effectiveDepthRatio - 0.88) / 0.12);
        ctx.save();
        ctx.globalAlpha = cityAlpha * 0.85;

        // Render high-res glowing fish city backdrop
        const cityW = w;
        const cityH = h * 0.72;
        const cityY = h - cityH;
        ctx.drawImage(fishCityImage, 0, cityY, cityW, cityH);

        // Volumetric golden bio-glow rising from city
        const cityGlow = ctx.createLinearGradient(0, h * 0.4, 0, h);
        cityGlow.addColorStop(0, 'transparent');
        cityGlow.addColorStop(0.6, 'rgba(56, 189, 248, 0.18)');
        cityGlow.addColorStop(1, 'rgba(251, 191, 36, 0.25)');
        ctx.fillStyle = cityGlow;
        ctx.fillRect(0, 0, w, h);

        ctx.restore();
      }

      // =========================================================================
      // 4. FLOATING BUBBLES & BIOLUMINESCENCE
      // =========================================================================
      // Deep bubbles rising up as fish plunges down
      bubbles.forEach((b) => {
        b.y += b.speedY * dpr;
        b.x += Math.sin(time * b.wobbleSpeed) * b.wobbleAmp * dpr;
        if (b.y < -30) {
          b.y = h + 20;
          b.x = Math.random() * w;
        }

        ctx.fillStyle = `rgba(186, 230, 253, ${b.opacity * 0.5})`;
        ctx.strokeStyle = `rgba(255, 255, 255, ${b.opacity * 0.7})`;
        ctx.lineWidth = 0.8 * dpr;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // Ambient bioluminescent plankton
      plankton.forEach((p) => {
        p.y += p.speedY * dpr;
        if (p.y < -20) {
          p.y = h + 20;
          p.x = Math.random() * w;
        }
        const pulse = 0.4 + 0.6 * Math.sin(time * 2.5 + p.pulseOffset);
        ctx.fillStyle = `hsla(${p.glowHue}, 90%, 65%, ${pulse * 0.7})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * dpr, 0, Math.PI * 2);
        ctx.fill();
      });

      // =========================================================================
      // 5. HERO FISH JUMP & DEEP DIVE PHYSICS
      // =========================================================================
      let fishX = w * 0.5;
      let fishY = h * 0.46;
      let fishAngle = Math.PI * 0.5;
      let fishScale = 1.0;

      // Surface coordinates for initial boat vault
      const boatDeckX = w * 0.32;
      const boatDeckY = h * 0.22;
      const waterEntryX = w * 0.50;
      const waterEntryY = h * 0.32;

      if (isCinematicJumping) {
        if (jumpProgress <= 0.65) {
          // Graceful air leap (normal velocity, true gravity arc)
          const tAir = jumpProgress / 0.65;
          fishX = boatDeckX + (waterEntryX - boatDeckX) * tAir;
          // Smooth parabolic leap with realistic apex
          const arcHeight = 70 * dpr * Math.sin(tAir * Math.PI);
          fishY = boatDeckY + (waterEntryY - boatDeckY) * tAir - arcHeight;
          // Body rotation from upward vault to downward head-first dive
          fishAngle = -0.3 + tAir * 1.9;
        } else {
          // Water entry and transition into deep dive
          const tDive = (jumpProgress - 0.65) / 0.35;

          if (!hasSpawnedSplash) {
            hasSpawnedSplash = true;
            for (let i = 0; i < 22; i++) {
              const ang = Math.PI + (Math.random() - 0.5) * 1.8;
              const spd = Math.random() * 6 + 2;
              splashDrops.push({
                x: waterEntryX,
                y: waterEntryY,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                size: Math.random() * 2.8 + 1.2,
                life: 1.0,
              });
            }
            ripples.push({
              x: waterEntryX,
              y: waterEntryY,
              r: 6 * dpr,
              maxR: 80 * dpr,
              alpha: 1.0,
            });
          }

          const targetY = h * 0.48;
          fishX = waterEntryX + (w * 0.5 - waterEntryX) * tDive;
          fishY = waterEntryY + (targetY - waterEntryY) * tDive;
          fishAngle = Math.PI * 0.5 + Math.sin(time * 3) * 0.1;
        }
      } else {
        // GENUINE DEEP OCEAN SWIMMING: Fish swims downwards towards Balık Şehri!
        const swayX = Math.sin(time * 1.6) * 36 * dpr;
        fishX = w * 0.5 + swayX;

        // Downward stroke undulating with tail surges
        const tailThrust = Math.sin(time * 5.2);
        const naturalSurge = Math.max(0, tailThrust) * 6 * dpr;
        const verticalBob = Math.sin(time * 1.2) * 10 * dpr;

        // At end of session (near fish city), fish descends towards the sunken gates
        let cityDescent = 0;
        if (effectiveDepthRatio >= 0.85) {
          const cT = (effectiveDepthRatio - 0.85) / 0.15;
          cityDescent = cT * (h * 0.18);
          fishScale = 1.0 - cT * 0.3; // swimming into the distance
        }

        fishY = h * 0.44 + verticalBob + naturalSurge + cityDescent;

        // Slight downward angle indicating steady descent
        const descentAngle = 0.08 + Math.cos(time * 5.2) * 0.08;
        fishAngle = Math.PI * 0.5 + (swayX * 0.003) + descentAngle;
      }

      // Splash ripples animation
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        rip.r += 2 * dpr;
        rip.alpha = Math.max(0, 1 - rip.r / rip.maxR);
        if (rip.alpha <= 0.02) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(255, 255, 255, ${rip.alpha * 0.75})`;
        ctx.lineWidth = 1.8 * dpr;
        ctx.beginPath();
        ctx.ellipse(rip.x, rip.y, rip.r, rip.r * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Splash droplets
      for (let i = splashDrops.length - 1; i >= 0; i--) {
        const drop = splashDrops[i];
        drop.x += drop.vx * dpr;
        drop.y += drop.vy * dpr;
        drop.vy += 0.3 * dpr;
        drop.life -= 0.025;
        if (drop.life <= 0) {
          splashDrops.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(255, 255, 255, ${drop.life * 0.85})`;
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.size * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // =========================================================================
      // 6. HERO GOLDEN KOI / REEF FISH RENDERING
      // =========================================================================
      ctx.save();
      ctx.translate(fishX, fishY);
      ctx.rotate(fishAngle);
      ctx.scale(fishScale, fishScale);

      // Bioluminescent golden halo
      const fishHalo = ctx.createRadialGradient(0, 0, 2, 0, 0, 34 * dpr);
      fishHalo.addColorStop(0, 'rgba(251, 146, 60, 0.9)');
      fishHalo.addColorStop(0.4, 'rgba(249, 115, 22, 0.35)');
      fishHalo.addColorStop(1, 'transparent');
      ctx.fillStyle = fishHalo;
      ctx.beginPath();
      ctx.arc(0, 0, 34 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // Fish Body Shading
      const bodyGrad = ctx.createRadialGradient(3 * dpr, -2 * dpr, 2 * dpr, 0, 0, 20 * dpr);
      bodyGrad.addColorStop(0, '#fed7aa');
      bodyGrad.addColorStop(0.35, '#f97316');
      bodyGrad.addColorStop(1, '#9a3412');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 22 * dpr, 12 * dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tail Fin with smooth wag
      const tailWag = Math.sin(time * 10) * 8.5 * dpr;
      const finGrad = ctx.createLinearGradient(-16 * dpr, 0, -32 * dpr, 0);
      finGrad.addColorStop(0, '#f97316');
      finGrad.addColorStop(1, '#ea580c');
      ctx.fillStyle = finGrad;
      ctx.beginPath();
      ctx.moveTo(-16 * dpr, 0);
      ctx.lineTo(-32 * dpr, -12 * dpr + tailWag);
      ctx.lineTo(-26 * dpr, 0);
      ctx.lineTo(-32 * dpr, 12 * dpr + tailWag);
      ctx.closePath();
      ctx.fill();

      // Striping
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.roundRect(-3 * dpr, -11 * dpr, 4.5 * dpr, 22 * dpr, 2 * dpr);
      ctx.roundRect(7 * dpr, -9 * dpr, 4 * dpr, 18 * dpr, 2 * dpr);
      ctx.fill();

      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(13 * dpr, -4 * dpr, 4.5 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(14.5 * dpr, -4 * dpr, 2.2 * dpr, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // =========================================================================
      // 7. BALIK ŞEHRİ VICTORY BANNER (Bottom Center, never colliding with top)
      // =========================================================================
      if (effectiveDepthRatio >= 0.95) {
        ctx.save();
        const bannerY = h * 0.84;
        ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.roundRect(w * 0.5 - 180 * dpr, bannerY - 24 * dpr, 360 * dpr, 48 * dpr, 24 * dpr);
        ctx.fill();
        ctx.stroke();

        ctx.font = `bold ${13 * dpr}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('🏛️ KADİM BALIK ŞEHRİNE ULAŞILDI 🏛️', w * 0.5, bannerY - 3 * dpr);

        ctx.font = `600 ${10 * dpr}px sans-serif`;
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText('1,000m Okyanus Derinliği · Batık Atlantis Krallığı', w * 0.5, bannerY + 13 * dpr);
        ctx.restore();
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [fishCityImage]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};
