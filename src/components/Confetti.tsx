'use client';
import { useEffect, useRef } from 'react';

const COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b', '#cc5de8', '#f06595', '#ffffff'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  color: string;
  w: number;
  h: number;
  wobble: number;
  wobbleSpeed: number;
}

export default function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const COUNT = 180;
    const particles: Particle[] = [];

    for (let i = 0; i < COUNT; i++) {
      // 中央上部からバースト + 画面上端からレイン（Vercel風ミックス）
      const burst = i < COUNT * 0.6;
      particles.push({
        x: burst
          ? canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 0.4
          : Math.random() * canvas.width,
        y: burst ? -10 - Math.random() * 60 : -10 - Math.random() * 200,
        vx: (Math.random() - 0.5) * (burst ? 10 : 4),
        vy: burst ? -6 - Math.random() * 10 : 1 + Math.random() * 2,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.25,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        w: 7 + Math.random() * 7,
        h: 3 + Math.random() * 4,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.05 + Math.random() * 0.05,
      });
    }

    const DURATION = 4200;
    let start: number | null = null;
    let raf: number;

    const draw = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / DURATION, 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.vy += 0.18; // 重力
        p.vx *= 0.995; // 空気抵抗
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 0.8;
        p.y += p.vy;
        p.angle += p.spin;

        const alpha = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (progress < 1) {
        raf = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}
    />
  );
}
