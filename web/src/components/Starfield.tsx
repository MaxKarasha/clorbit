import { useEffect, useRef } from 'react';
import { useSetting } from '../lib/settings';

/**
 * Quiet starry sky behind the analytics pages: three star layers with slow drift
 * and twinkle. ~24 fps, paused in a background tab, static with reduced motion (OS or Clorbit setting).
 */
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduceSetting = useSetting((s) => s.interface.reduceMotion);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const reduce = reduceSetting || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let dpr = 1;
    type Star = { x: number; y: number; r: number; a: number; tw: number; ph: number; layer: number; hue: number };
    let stars: Star[] = [];

    const seed = () => {
      const count = Math.round((w * h) / 5200);
      stars = Array.from({ length: count }, () => {
        const layer = Math.random() < 0.7 ? 0 : Math.random() < 0.8 ? 1 : 2;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: layer === 0 ? 0.35 + Math.random() * 0.45 : layer === 1 ? 0.6 + Math.random() * 0.5 : 0.9 + Math.random() * 0.7,
          a: layer === 0 ? 0.25 + Math.random() * 0.35 : 0.45 + Math.random() * 0.45,
          tw: 0.4 + Math.random() * 1.4,
          ph: Math.random() * Math.PI * 2,
          layer,
          hue: Math.random() < 0.18 ? 200 + Math.random() * 60 : Math.random() < 0.08 ? 320 : 220,
        };
      });
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      draw(performance.now());
    };

    const speeds = [0.6, 1.4, 2.6]; // px/s
    let last = performance.now();
    const draw = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        if (!reduce) {
          s.x -= speeds[s.layer] * dt;
          if (s.x < -2) s.x = w + 2;
        }
        const flicker = reduce ? 1 : 0.65 + 0.35 * Math.sin(t / 1000 * s.tw + s.ph);
        const alpha = s.a * flicker;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue}, 80%, ${s.hue === 220 ? 92 : 80}%, ${alpha})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.layer === 2) {
          ctx.beginPath();
          ctx.fillStyle = `hsla(${s.hue}, 90%, 75%, ${alpha * 0.12})`;
          ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    let raf = 0;
    let acc = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - acc < 42) return;
      acc = t;
      draw(t);
    };

    resize();
    window.addEventListener('resize', resize);
    if (!reduce) raf = requestAnimationFrame(loop);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reduceSetting]);

  return (
    <div className="sky" aria-hidden>
      <div className="sky__nebula" />
      <canvas ref={ref} className="sky__stars" />
    </div>
  );
}
