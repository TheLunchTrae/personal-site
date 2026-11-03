import { localX, type RunState } from './engine';

export interface View {
  readonly width: number;
  readonly height: number;
  readonly labels: readonly string[];
  readonly reducedMotion: boolean;
}

/** The tempo the neon pulses at, like the beat-synced levels it echoes. The theme plays no sound. */
const pulseBpm = 128;

/** One hue per section; the sky shifts toward the next as its portal nears. */
const hues = [196, 278, 326, 150, 32];

const font = (weight: number, size: number) => `${weight} ${size}px ui-sans-serif, system-ui, sans-serif`;

function hash(n: number): number {
  const value = Math.sin(n * 127.1) * 43_758.545_3;
  return value - Math.floor(value);
}

function skyHue(state: RunState): number {
  const { level } = state;
  const x = localX(level, state.body.x);
  const portals = level.portals;
  let segment = portals.findIndex((portal) => portal.x >= x);
  if (segment === -1) {
    segment = 0;
  }
  const end = portals[segment]?.x ?? level.length;
  const start = segment === 0 ? 0 : (portals[segment - 1]?.x ?? 0);
  const progress = (x - start) / Math.max(1, end - start);
  const from = hues[segment % hues.length] ?? 0;
  const to = hues[(segment + 1) % hues.length] ?? 0;
  const blend = Math.min(1, Math.max(0, (progress - 0.85) / 0.15));
  const delta = ((to - from + 540) % 360) - 180;
  return from + delta * blend;
}

/** Draws one frame of the run. Pure: reads state, never changes it. */
export function render(ctx: CanvasRenderingContext2D, state: RunState, view: View): void {
  const { width, height } = view;
  const block = Math.min(height / 6.2, width / 15);
  const groundY = height - block * 1.25;
  const cameraX = state.body.x - (width * 0.26) / block;
  const sx = (x: number) => (x - cameraX) * block;
  const sy = (y: number) => groundY - y * block;
  const hue = skyHue(state);
  const beat = (state.time * pulseBpm) / 60;
  const pulse = view.reducedMotion ? 0.25 : Math.exp(-(beat % 1) * 5);
  const neon = `hsl(${hue} 100% 72%)`;

  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, `hsl(${hue} 70% 10%)`);
  sky.addColorStop(1, `hsl(${hue + 35} 75% 24%)`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, groundY);

  // Far layer: slow, rotated outlines.
  ctx.save();
  ctx.strokeStyle = `hsl(${hue} 90% 80%)`;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.07 + pulse * 0.05;
  const farSpacing = 9;
  const farCamera = cameraX * 0.25;
  for (
    let index = Math.floor(farCamera / farSpacing) - 1;
    index * farSpacing < farCamera + width / block + farSpacing;
    index += 1
  ) {
    const size = (2 + hash(index) * 3) * block;
    const x = (index * farSpacing - farCamera) * block;
    const y = groundY * (0.2 + hash(index + 9) * 0.5);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
  ctx.restore();

  // Mid layer: bars that bounce on the beat.
  ctx.save();
  const barCamera = cameraX * 0.5;
  const barSpacing = 1.5;
  ctx.fillStyle = `hsl(${hue + 20} 90% 60%)`;
  ctx.globalAlpha = 0.12;
  for (
    let index = Math.floor(barCamera / barSpacing) - 1;
    index * barSpacing < barCamera + width / block + 2;
    index += 1
  ) {
    const base = 0.6 + hash(index * 3.7) * 2.2;
    const bar = (base + pulse * hash(index + Math.floor(beat)) * 1.6) * block;
    const x = (index * barSpacing - barCamera) * block;
    ctx.fillRect(x, groundY - bar, block * 0.9, bar);
  }
  ctx.restore();

  // Ground.
  ctx.fillStyle = `hsl(${hue + 35} 60% 9%)`;
  ctx.fillRect(0, groundY, width, height - groundY);
  ctx.save();
  ctx.strokeStyle = `hsl(${hue} 80% 60%)`;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1;
  for (let x = Math.floor(cameraX); x < cameraX + width / block + 1; x += 1) {
    ctx.strokeRect(sx(x), groundY, block, block);
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = neon;
  ctx.lineWidth = 3;
  ctx.shadowColor = neon;
  ctx.shadowBlur = 10 + pulse * 10;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(width, groundY);
  ctx.stroke();
  ctx.restore();

  const { level } = state;
  const lap = state.body.x - localX(level, state.body.x);
  const visible = (x: number) => sx(x) > -block * 3 && sx(x) < width + block * 3;
  const placements = (x: number) => [lap - level.length + x, lap + x, lap + level.length + x].filter(visible);

  // Checkpoints: small pennants on the ground.
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = neon;
  ctx.fillStyle = neon;
  ctx.lineWidth = 2;
  for (const checkpoint of level.checkpoints) {
    for (const x of placements(checkpoint)) {
      ctx.beginPath();
      ctx.moveTo(sx(x + 0.5), sy(0));
      ctx.lineTo(sx(x + 0.5), sy(0.9));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx(x + 0.5), sy(0.9));
      ctx.lineTo(sx(x + 0.85), sy(0.78));
      ctx.lineTo(sx(x + 0.5), sy(0.66));
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();

  // Obstacles.
  for (const obstacle of level.obstacles) {
    for (const x of placements(obstacle.x)) {
      switch (obstacle.kind) {
        case 'spike':
          ctx.save();
          ctx.fillStyle = '#07071a';
          ctx.strokeStyle = neon;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx(x + 0.06), sy(0));
          ctx.lineTo(sx(x + 0.5), sy(0.92));
          ctx.lineTo(sx(x + 0.94), sy(0));
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.moveTo(sx(x + 0.3), sy(0));
          ctx.lineTo(sx(x + 0.5), sy(0.45));
          ctx.lineTo(sx(x + 0.7), sy(0));
          ctx.stroke();
          ctx.restore();
          break;
        case 'block':
          ctx.save();
          ctx.fillStyle = '#07071a';
          ctx.fillRect(sx(x), sy(1), block, block);
          ctx.strokeStyle = neon;
          ctx.lineWidth = 2;
          ctx.strokeRect(sx(x) + 1, sy(1) + 1, block - 2, block - 2);
          ctx.globalAlpha = 0.45;
          ctx.strokeRect(sx(x + 0.22), sy(0.78), block * 0.56, block * 0.56);
          ctx.restore();
          break;
        case 'pad':
          // A spring plate with chevrons pointing up.
          ctx.save();
          ctx.fillStyle = '#ffb547';
          ctx.strokeStyle = '#ffb547';
          ctx.shadowColor = '#ffb547';
          ctx.shadowBlur = 10 + pulse * 8;
          ctx.fillRect(sx(x + 0.1), sy(0.12), block * 0.8, block * 0.12);
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.5 + pulse * 0.5;
          for (let chevron = 0; chevron < 2; chevron += 1) {
            const y = sy(0.3 + chevron * 0.2);
            ctx.beginPath();
            ctx.moveTo(sx(x + 0.25), y);
            ctx.lineTo(sx(x + 0.5), y - block * 0.12);
            ctx.lineTo(sx(x + 0.75), y);
            ctx.stroke();
          }
          ctx.restore();
          break;
      }
    }
  }

  // Gates: run under to pass, jump through to enter.
  for (const portal of level.portals) {
    for (const x of placements(portal.x)) {
      const here = portal.section === state.current;
      const centerX = sx(x + 0.5);
      const color = here ? 'hsl(0 0% 70%)' : `hsl(${hues[portal.section % hues.length] ?? hue} 100% 70%)`;
      const left = sx(x + 0.1);
      const top = sy(3.2);
      const gateWidth = block * 0.8;
      const gateHeight = block * 1.9;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = here ? 0 : 14 + pulse * 12;
      ctx.lineWidth = 3;
      if (here) {
        ctx.setLineDash([5, 5]);
      } else {
        ctx.globalAlpha = 0.18 + pulse * 0.12;
        ctx.fillRect(left, top, gateWidth, gateHeight);
        ctx.globalAlpha = 1;
      }
      ctx.strokeRect(left, top, gateWidth, gateHeight);
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      // Rungs across the opening read as a doorway, not a ring.
      ctx.globalAlpha = here ? 0.4 : 0.7;
      ctx.lineWidth = 1.5;
      for (let rung = 1; rung < 4; rung += 1) {
        const y = top + (gateHeight * rung) / 4;
        ctx.beginPath();
        ctx.moveTo(left + 3, y);
        ctx.lineTo(left + gateWidth - 3, y);
        ctx.stroke();
      }
      ctx.globalAlpha = here ? 0.6 : 1;
      const labelSize = Math.max(11, block * 0.36);
      ctx.font = font(800, labelSize);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(view.labels[portal.section] ?? '', centerX, sy(3.4));
      if (here) {
        ctx.font = font(600, Math.max(9, block * 0.22));
        ctx.fillText('YOU ARE HERE', centerX, sy(3.4) - labelSize - 2);
      }
      ctx.restore();
    }
  }

  // Trail: fading dots.
  const size = block;
  ctx.save();
  ctx.fillStyle = '#ff8a5c';
  for (const [index, ghost] of state.trail.entries()) {
    ctx.globalAlpha = ((index + 1) / state.trail.length) * 0.35;
    ctx.beginPath();
    ctx.arc(sx(ghost.x + 0.5), sy(ghost.y + 0.5), size * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Runner: a coral block with a lit core. Its art is symmetric under quarter
  // turns because landings snap the spin to the nearest quarter turn.
  if (state.alive) {
    ctx.save();
    ctx.translate(sx(state.body.x + 0.5), sy(state.body.y + 0.5));
    ctx.rotate(state.rotation);
    ctx.shadowColor = '#ff8a5c';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ff8a5c';
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2a1030';
    ctx.fillRect(-size * 0.32, -size * 0.32, size * 0.64, size * 0.64);
    ctx.fillStyle = '#ff8a5c';
    ctx.fillRect(-size * 0.2, -size * 0.2, size * 0.4, size * 0.4);
    ctx.fillStyle = '#fff4d6';
    ctx.globalAlpha = 0.6 + pulse * 0.4;
    ctx.fillRect(-size * 0.1, -size * 0.1, size * 0.2, size * 0.2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a1030';
    for (const [cornerX, cornerY] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      ctx.fillRect(cornerX * size * 0.42 - size * 0.04, cornerY * size * 0.42 - size * 0.04, size * 0.08, size * 0.08);
    }
    ctx.restore();
  }

  // Shatter.
  ctx.save();
  ctx.fillStyle = '#ff8a5c';
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, particle.life));
    ctx.fillRect(sx(particle.x), sy(particle.y), particle.size * block, particle.size * block);
  }
  ctx.restore();

  // HUD: run count, and a strip along the bottom edge marking the loop and its gates.
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.75;
  ctx.font = font(700, 12);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`RUN ${state.attempts}`, 12, 10);
  const stripY = height - 4;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(0, stripY, width, 4);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = neon;
  ctx.fillRect(0, stripY, (width * localX(level, state.body.x)) / level.length, 4);
  for (const portal of level.portals) {
    ctx.fillStyle = `hsl(${hues[portal.section % hues.length] ?? hue} 100% 70%)`;
    ctx.fillRect((width * portal.x) / level.length - 1, stripY - 4, 3, 8);
  }
  ctx.restore();
}
