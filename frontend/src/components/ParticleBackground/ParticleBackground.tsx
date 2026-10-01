import { useEffect, useRef } from 'react';

type ParticleBackgroundProps = {
  className?: string;
  id?: string;
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  radius: number;
  color: string;
  glowColor: string;
  alpha: number;
  pulseSpeed: number;
  pulseAngle: number;
  hasGlow: boolean;
}

export default function ParticleBackground({ className, id }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let mouse = { x: -9999, y: -9999, radius: 150 };

    // Brand color palette: Ethiopian IT Park vibrant cyan, sky, electric sapphire, and indigo
    const PALETTE = [
      { color: 'rgb(6, 182, 212)', glow: 'rgba(6, 182, 212, 0.85)' },    // Vibrant Cyan
      { color: 'rgb(56, 189, 248)', glow: 'rgba(56, 189, 248, 0.9)' },   // Sky Blue
      { color: 'rgb(96, 165, 250)', glow: 'rgba(96, 165, 250, 0.8)' },   // Electric Blue
      { color: 'rgb(129, 140, 248)', glow: 'rgba(129, 140, 248, 0.75)' }, // Indigo
      { color: 'rgb(20, 184, 166)', glow: 'rgba(20, 184, 166, 0.85)' },  // Teal
    ];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.offsetWidth || window.innerWidth;
      const height = canvas.offsetHeight || window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    const createParticles = () => {
      particles = [];
      const width = canvas.offsetWidth || window.innerWidth;
      const height = canvas.offsetHeight || window.innerHeight;
      
      // Calculate balanced density so it looks rich and prominent without clutter
      const count = Math.max(55, Math.min(130, Math.floor((width * height) / 10000)));

      for (let i = 0; i < count; i++) {
        const theme = PALETTE[Math.floor(Math.random() * PALETTE.length)];
        const baseRadius = Math.random() * 2.2 + 1.6; // 1.6px to 3.8px
        const hasGlow = Math.random() > 0.45; // 55% have radiant glow

        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.75, // smooth, noticeable drift
          vy: (Math.random() - 0.5) * 0.75,
          baseRadius,
          radius: baseRadius,
          color: theme.color,
          glowColor: theme.glow,
          alpha: Math.random() * 0.4 + 0.55, // 0.55 to 0.95 high visibility
          pulseSpeed: Math.random() * 0.03 + 0.015,
          pulseAngle: Math.random() * Math.PI * 2,
          hasGlow,
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const animate = () => {
      const width = canvas.offsetWidth || window.innerWidth;
      const height = canvas.offsetHeight || window.innerHeight;

      ctx.clearRect(0, 0, width, height);

      // Connection threshold distance
      const maxDistance = 145;

      // 1. Draw glowing connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const lineAlpha = (1 - dist / maxDistance) * 0.32; // Crisp, clearly visible
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            
            // Dual-tone stroke for extra tech depth
            ctx.strokeStyle = `rgba(56, 189, 248, ${lineAlpha})`;
            ctx.lineWidth = lineAlpha * 2.2 + 0.4;
            ctx.stroke();
            ctx.restore();
          }
        }

        // Draw connections to mouse cursor for high-tech interactivity
        const mouseDx = particles[i].x - mouse.x;
        const mouseDy = particles[i].y - mouse.y;
        const mouseDist = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);

        if (mouseDist < mouse.radius) {
          const mouseAlpha = (1 - mouseDist / mouse.radius) * 0.65;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(6, 182, 212, ${mouseAlpha})`;
          ctx.lineWidth = mouseAlpha * 2.5 + 0.8;
          ctx.shadowBlur = 10;
          ctx.shadowColor = 'rgba(6, 182, 212, 0.9)';
          ctx.stroke();
          ctx.restore();

          // Subtle magnetic tug towards cursor
          const force = (1 - mouseDist / mouse.radius) * 0.04;
          particles[i].vx -= (mouseDx / mouseDist) * force;
          particles[i].vy -= (mouseDy / mouseDist) * force;
        }
      }

      // 2. Update and draw particles with glowing halo
      particles.forEach((p) => {
        // Position update
        p.x += p.vx;
        p.y += p.vy;

        // Dampen velocity to avoid over-acceleration from cursor
        p.vx *= 0.99;
        p.vy *= 0.99;

        // Re-inject slight momentum if slowed down too much
        if (Math.abs(p.vx) < 0.15) p.vx += (Math.random() - 0.5) * 0.1;
        if (Math.abs(p.vy) < 0.15) p.vy += (Math.random() - 0.5) * 0.1;

        // Wrap edges seamlessly
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        // Pulse radius animation
        p.pulseAngle += p.pulseSpeed;
        const pulse = Math.sin(p.pulseAngle) * 0.45;
        p.radius = Math.max(1, p.baseRadius + pulse);

        ctx.save();

        // Outer ambient glow ring for radiant particles
        if (p.hasGlow) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = p.glowColor;

          // Soft translucent halo
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, 0.18)`;
          ctx.fill();
        }

        // Crisp solid core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();

        // Highlight center dot for ultra-sharp high-tech feel
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.6, p.radius * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.9;
        ctx.fill();

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    resize();
    createParticles();
    animate();

    const handleResize = () => {
      resize();
      createParticles();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id={id}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

