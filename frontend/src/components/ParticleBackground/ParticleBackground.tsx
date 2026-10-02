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
  isHub: boolean;
  radarRadius: number;
}

interface DataPulse {
  fromIndex: number;
  toIndex: number;
  progress: number;
  speed: number;
  color: string;
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
    let dataPulses: DataPulse[] = [];
    let mouse = { x: -9999, y: -9999, radius: 160 };

    // Brand color palette from the Ethiopian IT Park logo:
    // Signature Teal (#087d93), Vibrant Aqua (#77cbc6), Bright Cyan (#06b6d4), Sky Blue (#38bdf8)
    const PALETTE = [
      { color: 'rgb(8, 125, 147)', glow: 'rgba(8, 125, 147, 0.95)' },    // Official Logo Teal (#087d93)
      { color: 'rgb(119, 203, 198)', glow: 'rgba(119, 203, 198, 0.95)' }, // Official Logo Aqua (#77cbc6)
      { color: 'rgb(6, 182, 212)', glow: 'rgba(6, 182, 212, 0.95)' },    // Cyber Cyan
      { color: 'rgb(56, 189, 248)', glow: 'rgba(56, 189, 248, 0.95)' },   // Sky Blue
      { color: 'rgb(96, 165, 250)', glow: 'rgba(96, 165, 250, 0.9)' },    // Electric Blue
      { color: 'rgb(45, 212, 191)', glow: 'rgba(45, 212, 191, 0.95)' },   // Emerald Teal
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
      dataPulses = [];
      const width = canvas.offsetWidth || window.innerWidth;
      const height = canvas.offsetHeight || window.innerHeight;

      // Balanced count for smooth enterprise performance and elegant spacing
      const count = Math.max(55, Math.min(120, Math.floor((width * height) / 11000)));

      // Number of primary hub nodes (mirroring the logo's connected main circles)
      const hubCount = Math.max(4, Math.floor(count * 0.08));

      for (let i = 0; i < count; i++) {
        const isHub = i < hubCount;
        const theme = PALETTE[Math.floor(Math.random() * PALETTE.length)];
        const baseRadius = isHub 
          ? Math.random() * 1.5 + 3.2 // Hubs: 3.2px to 4.7px
          : Math.random() * 1.6 + 1.5; // Standard: 1.5px to 3.1px

        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * (isHub ? 0.35 : 0.65), // Hubs drift slower, majestically
          vy: (Math.random() - 0.5) * (isHub ? 0.35 : 0.65),
          baseRadius,
          radius: baseRadius,
          color: theme.color,
          glowColor: theme.glow,
          alpha: isHub ? 0.95 : Math.random() * 0.35 + 0.55,
          pulseSpeed: Math.random() * 0.025 + 0.015,
          pulseAngle: Math.random() * Math.PI * 2,
          hasGlow: isHub || Math.random() > 0.4,
          isHub,
          radarRadius: 0,
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

      const maxDistance = 165;
      const activeConnections: { from: number; to: number; dist: number }[] = [];

      // 1. Draw connections between nearby nodes
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const lineAlpha = (1 - dist / maxDistance) * 0.48;
            activeConnections.push({ from: i, to: j, dist });

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);

            // Subtle gradient stroke between connected nodes
            const gradient = ctx.createLinearGradient(
              particles[i].x,
              particles[i].y,
              particles[j].x,
              particles[j].y
            );
            gradient.addColorStop(0, `rgba(8, 125, 147, ${lineAlpha})`);
            gradient.addColorStop(1, `rgba(119, 203, 198, ${lineAlpha})`);

            ctx.strokeStyle = gradient;
            ctx.lineWidth = lineAlpha * 2.0 + 0.4;
            ctx.stroke();
            ctx.restore();
          }
        }

        // Draw connections to mouse cursor for interactive responsiveness
        const mouseDx = particles[i].x - mouse.x;
        const mouseDy = particles[i].y - mouse.y;
        const mouseDist = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);

        if (mouseDist < mouse.radius) {
          const mouseAlpha = (1 - mouseDist / mouse.radius) * 0.65;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(119, 203, 198, ${mouseAlpha})`;
          ctx.lineWidth = mouseAlpha * 2.2 + 0.6;
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
          ctx.stroke();
          ctx.restore();

          // Subtle magnetic response
          const force = (1 - mouseDist / mouse.radius) * 0.035;
          particles[i].vx -= (mouseDx / mouseDist) * force;
          particles[i].vy -= (mouseDy / mouseDist) * force;
        }
      }

      // 2. Manage and draw traveling data packets along connections
      if (activeConnections.length > 0 && dataPulses.length < 14 && Math.random() < 0.15) {
        const conn = activeConnections[Math.floor(Math.random() * activeConnections.length)];
        dataPulses.push({
          fromIndex: conn.from,
          toIndex: conn.to,
          progress: 0,
          speed: Math.random() * 0.015 + 0.01,
          color: Math.random() > 0.5 ? '#77cbc6' : '#ffffff',
        });
      }

      for (let pIdx = dataPulses.length - 1; pIdx >= 0; pIdx--) {
        const pulse = dataPulses[pIdx];
        pulse.progress += pulse.speed;

        if (pulse.progress >= 1) {
          dataPulses.splice(pIdx, 1);
          continue;
        }

        const pA = particles[pulse.fromIndex];
        const pB = particles[pulse.toIndex];
        if (!pA || !pB) {
          dataPulses.splice(pIdx, 1);
          continue;
        }

        const px = pA.x + (pB.x - pA.x) * pulse.progress;
        const py = pA.y + (pB.y - pA.y) * pulse.progress;

        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = pulse.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = pulse.color;
        ctx.fill();
        ctx.restore();
      }

      // 3. Update and draw particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        p.vx *= 0.99;
        p.vy *= 0.99;

        if (Math.abs(p.vx) < 0.1) p.vx += (Math.random() - 0.5) * 0.08;
        if (Math.abs(p.vy) < 0.1) p.vy += (Math.random() - 0.5) * 0.08;

        if (p.x < -15) p.x = width + 15;
        if (p.x > width + 15) p.x = -15;
        if (p.y < -15) p.y = height + 15;
        if (p.y > height + 15) p.y = -15;

        p.pulseAngle += p.pulseSpeed;
        const pulse = Math.sin(p.pulseAngle) * 0.4;
        p.radius = Math.max(1, p.baseRadius + pulse);

        ctx.save();

        // Expanding radar rings for hub nodes (like cybersecurity hubs)
        if (p.isHub) {
          p.radarRadius = (p.radarRadius + 0.35) % 28;
          const radarAlpha = Math.max(0, (1 - p.radarRadius / 28) * 0.45);

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + p.radarRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(119, 203, 198, ${radarAlpha})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Ambient glow
        if (p.hasGlow) {
          ctx.shadowBlur = p.isHub ? 16 : 10;
          ctx.shadowColor = p.glowColor;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 2.0, 0, Math.PI * 2);
          ctx.fillStyle = p.isHub ? 'rgba(119, 203, 198, 0.22)' : 'rgba(8, 125, 147, 0.15)';
          ctx.fill();
        }

        // Solid core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();

        // White focal spark
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.6, p.radius * 0.38), 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.95;
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
