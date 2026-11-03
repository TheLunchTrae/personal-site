import type { Level, Obstacle } from './level';

/** Simulation constants in blocks and seconds. The run is a little slower than genre norms so it stays readable. */
export const physics = {
  speed: 8.6,
  gravity: 72,
  jumpVelocity: 18,
  padVelocity: 25,
  /** Seconds a jump press is remembered before landing. */
  jumpBuffer: 0.12,
  /** Seconds the shatter plays before respawning. */
  respawnDelay: 0.7,
  step: 1 / 240,
} as const;

const portalBottom = 1.3;
const portalTop = 3.2;
const blockTop = 1;
const epsilon = 1e-6;

/** The part of the runner that physics moves. Kept small so the assist can copy it cheaply. */
export interface Body {
  x: number;
  y: number;
  vy: number;
  grounded: boolean;
}

export type StepEvent =
  | { readonly type: 'jump' }
  | { readonly type: 'pad' }
  | { readonly type: 'death' }
  | { readonly type: 'checkpoint' }
  | { readonly type: 'portal'; readonly section: number };

type Contact = 'none' | 'dead' | 'pad';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

export interface RunState {
  readonly level: Level;
  body: Body;
  rotation: number;
  /** False until the first input, and again after a respawn when assist is off. */
  running: boolean;
  alive: boolean;
  deadFor: number;
  attempts: number;
  checkpointX: number;
  jumpHeld: boolean;
  jumpBuffered: number;
  assist: boolean;
  /** Section the assist steers into, or null to run past every portal. */
  target: number | null;
  /** Section of the page being viewed; its portal is signage only. */
  current: number;
  /** Portal the runner is inside, so one pass fires once. */
  portalLatch: number | null;
  /** World x where the assist has planned its next jump. */
  assistJumpAt: number | null;
  time: number;
  trail: { x: number; y: number; rotation: number }[];
  particles: Particle[];
  seed: number;
}

export function createRun(level: Level, current: number): RunState {
  const start = level.checkpoints[0] ?? 0;
  return {
    level,
    body: { x: start, y: 0, vy: 0, grounded: true },
    rotation: 0,
    running: false,
    alive: true,
    deadFor: 0,
    attempts: 1,
    checkpointX: start,
    jumpHeld: false,
    jumpBuffered: 0,
    assist: false,
    target: null,
    current,
    portalLatch: null,
    assistJumpAt: null,
    time: 0,
    trail: [],
    particles: [],
    seed: 7,
  };
}

/** Position of a world x inside the looping level. */
export function localX(level: Level, x: number): number {
  return ((x % level.length) + level.length) % level.length;
}

function overlaps(
  ax0: number,
  ax1: number,
  ay0: number,
  ay1: number,
  bx0: number,
  bx1: number,
  by0: number,
  by1: number,
) {
  return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
}

function nearby(level: Level, x: number): Obstacle[] {
  const base = Math.floor(localX(level, x));
  const found: Obstacle[] = [];
  for (let offset = -1; offset <= 2; offset += 1) {
    const column = (base + offset + level.length) % level.length;
    for (const obstacle of level.columns[column] ?? []) {
      found.push(obstacle);
    }
  }
  return found;
}

/** Obstacle x placed in the same lap as the body, so the loop seam needs no special case. */
function alignedX(level: Level, bodyX: number, obstacleX: number): number {
  const lapStart = bodyX - localX(level, bodyX);
  const candidate = lapStart + obstacleX;
  if (candidate - bodyX > level.length / 2) {
    return candidate - level.length;
  }
  if (bodyX - candidate > level.length / 2) {
    return candidate + level.length;
  }
  return candidate;
}

function supported(level: Level, body: Body): boolean {
  if (body.y <= epsilon) {
    return true;
  }
  if (Math.abs(body.y - blockTop) > epsilon) {
    return false;
  }
  return nearby(level, body.x).some((obstacle) => {
    if (obstacle.kind !== 'block') {
      return false;
    }
    const bx = alignedX(level, body.x, obstacle.x);
    return body.x + 1 > bx + 0.05 && body.x < bx + 0.95;
  });
}

/**
 * Advances the body one fixed step. Returns what it touched. Shared by the
 * live run and the assist's look-ahead so both obey the same rules.
 */
function advance(level: Level, body: Body, jump: boolean): { contact: Contact; jumped: boolean } {
  const dt = physics.step;
  let jumped = false;
  if (body.grounded && !supported(level, body)) {
    body.grounded = false;
  }
  if (body.grounded && jump) {
    body.vy = physics.jumpVelocity;
    body.grounded = false;
    jumped = true;
  }

  const previousY = body.y;
  body.x += physics.speed * dt;
  if (!body.grounded) {
    body.vy -= physics.gravity * dt;
    body.y += body.vy * dt;
  }
  if (body.y <= 0) {
    body.y = 0;
    body.vy = 0;
    body.grounded = true;
  }

  let contact: Contact = 'none';
  for (const obstacle of nearby(level, body.x)) {
    const ox = alignedX(level, body.x, obstacle.x);
    switch (obstacle.kind) {
      case 'block':
        if (overlaps(body.x, body.x + 1, body.y, body.y + 1, ox, ox + 1, 0, blockTop)) {
          if (previousY >= blockTop - 0.05 && body.vy <= 0) {
            body.y = blockTop;
            body.vy = 0;
            body.grounded = true;
          } else {
            return { contact: 'dead', jumped };
          }
        }
        break;
      case 'spike':
        if (overlaps(body.x + 0.15, body.x + 0.85, body.y + 0.1, body.y + 0.9, ox + 0.3, ox + 0.7, 0, 0.55)) {
          return { contact: 'dead', jumped };
        }
        break;
      case 'pad':
        if (body.vy <= 0 && overlaps(body.x, body.x + 1, body.y, body.y + 1, ox + 0.1, ox + 0.9, 0, 0.35)) {
          body.vy = physics.padVelocity;
          body.grounded = false;
          contact = 'pad';
        }
        break;
    }
  }
  return { contact, jumped };
}

function portalAt(level: Level, body: Body): number | null {
  for (const portal of level.portals) {
    const px = alignedX(level, body.x, portal.x);
    if (overlaps(body.x, body.x + 1, body.y, body.y + 1, px + 0.2, px + 0.8, portalBottom, portalTop)) {
      return portal.section;
    }
  }
  return null;
}

type Outcome =
  | { readonly kind: 'safe' }
  | { readonly kind: 'dead' }
  | { readonly kind: 'portal'; readonly section: number };

/**
 * Runs a copy of the body: wait `delay` steps, optionally jump, then coast
 * until it lands again or `horizon` steps pass.
 */
function lookAhead(state: RunState, delay: number, jump: boolean, horizon: number): Outcome {
  const body = { ...state.body };
  let airborne = false;
  for (let step = 0; step < horizon; step += 1) {
    const { contact, jumped } = advance(state.level, body, jump && step === delay);
    if (contact === 'dead') {
      return { kind: 'dead' };
    }
    const portal = portalAt(state.level, body);
    if (portal !== null && portal !== state.current) {
      return { kind: 'portal', section: portal };
    }
    if (jumped || contact === 'pad') {
      airborne = true;
    }
    if (jump && airborne && body.grounded && step > delay) {
      return { kind: 'safe' };
    }
  }
  return { kind: 'safe' };
}

const horizonSteps = Math.round(0.7 / physics.step);
const searchStride = 2;

function isGood(outcome: Outcome, target: number | null): boolean {
  switch (outcome.kind) {
    case 'safe':
      return true;
    case 'dead':
      return false;
    case 'portal':
      return outcome.section === target;
  }
}

/**
 * Picks a jump delay, in steps, inside the window of delays whose outcome
 * passes `accept`, leaning late so jumps read as deliberate. Null if the
 * window is empty.
 */
function plannedJump(state: RunState, accept: (outcome: Outcome) => boolean): number | null {
  let latest: number | null = null;
  let earliest: number | null = null;
  for (let delay = horizonSteps - 1; delay >= 0; delay -= searchStride) {
    const good = accept(lookAhead(state, delay, true, delay + horizonSteps));
    if (good) {
      latest ??= delay;
      earliest = delay;
    } else if (latest !== null) {
      break;
    }
  }
  if (latest === null || earliest === null) {
    return null;
  }
  return Math.round(earliest + (latest - earliest) * 0.7);
}

/**
 * The assist plans a jump that clears the next hazard or lands in
 * the target portal, then holds that plan; the world is deterministic, so a
 * plan stays valid until it fires.
 */
function assistWantsJump(state: RunState): boolean {
  if (!state.body.grounded) {
    return false;
  }
  if (state.assistJumpAt !== null) {
    if (state.body.x + 1e-9 < state.assistJumpAt) {
      return false;
    }
    state.assistJumpAt = null;
    return true;
  }

  const reachesTarget = (outcome: Outcome) => outcome.kind === 'portal' && outcome.section === state.target;
  let delay: number | null = null;
  if (state.target !== null && reachesTarget(lookAhead(state, 0, true, horizonSteps))) {
    delay = plannedJump(state, reachesTarget);
  } else if (!isGood(lookAhead(state, 0, false, horizonSteps), state.target)) {
    delay = plannedJump(state, (outcome) => isGood(outcome, state.target)) ?? 0;
  }
  if (delay === null) {
    return false;
  }
  if (delay === 0) {
    return true;
  }
  state.assistJumpAt = state.body.x + delay * physics.speed * physics.step;
  return false;
}

function random(state: RunState): number {
  // Small LCG so renders and tests repeat exactly.
  state.seed = (state.seed * 1_103_515_245 + 12_345) % 2_147_483_648;
  return state.seed / 2_147_483_648;
}

function shatter(state: RunState): void {
  for (let index = 0; index < 18; index += 1) {
    const angle = random(state) * Math.PI * 2;
    const speed = 3 + random(state) * 7;
    state.particles.push({
      x: state.body.x + 0.5,
      y: state.body.y + 0.5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed + 3,
      life: 0.6 + random(state) * 0.4,
      size: 0.12 + random(state) * 0.18,
    });
  }
}

function updateParticles(state: RunState, dt: number): void {
  for (const particle of state.particles) {
    particle.life -= dt;
    particle.vy -= 18 * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function respawn(state: RunState): void {
  state.alive = true;
  state.deadFor = 0;
  state.attempts += 1;
  state.body = { x: state.checkpointX, y: 0, vy: 0, grounded: true };
  state.rotation = 0;
  state.trail = [];
  state.portalLatch = null;
  state.assistJumpAt = null;
  state.running = state.assist;
}

/** Registers a jump press. The first press also starts the run. */
export function pressJump(state: RunState): void {
  state.jumpHeld = true;
  // A manual jump changes the trajectory, so any planned assist jump is stale.
  state.assistJumpAt = null;
  state.jumpBuffered = physics.jumpBuffer;
  if (state.alive) {
    state.running = true;
  }
}

export function releaseJump(state: RunState): void {
  state.jumpHeld = false;
}

/** Advances the run by one fixed step and reports what happened. */
export function step(state: RunState): StepEvent[] {
  const dt = physics.step;
  const events: StepEvent[] = [];
  state.time += dt;
  updateParticles(state, dt);

  if (!state.alive) {
    state.deadFor += dt;
    if (state.deadFor >= physics.respawnDelay) {
      respawn(state);
    }
    return events;
  }
  if (!state.running) {
    return events;
  }

  state.jumpBuffered = Math.max(0, state.jumpBuffered - dt);
  const wantsJump = state.jumpHeld || state.jumpBuffered > 0 || (state.assist && assistWantsJump(state));
  const passedFrom = localX(state.level, state.body.x);
  const { contact, jumped } = advance(state.level, state.body, wantsJump);
  if (jumped) {
    state.jumpBuffered = 0;
    events.push({ type: 'jump' });
  }
  if (contact === 'pad') {
    events.push({ type: 'pad' });
  }
  if (contact === 'dead') {
    state.alive = false;
    state.running = false;
    shatter(state);
    events.push({ type: 'death' });
    return events;
  }

  if (state.body.grounded) {
    state.rotation = Math.round(state.rotation / (Math.PI / 2)) * (Math.PI / 2);
  } else {
    state.rotation += 7.2 * dt;
  }

  const passedTo = localX(state.level, state.body.x);
  for (const checkpoint of state.level.checkpoints) {
    const crossed = passedFrom <= passedTo ? passedFrom < checkpoint && checkpoint <= passedTo : checkpoint <= passedTo;
    if (crossed) {
      state.checkpointX = state.body.x - (passedTo - checkpoint);
      events.push({ type: 'checkpoint' });
    }
  }

  const portal = portalAt(state.level, state.body);
  if (portal !== state.portalLatch) {
    state.portalLatch = portal;
    if (portal !== null && portal !== state.current) {
      events.push({ type: 'portal', section: portal });
    }
  }

  if (Math.round(state.time / dt) % 6 === 0) {
    state.trail.push({ x: state.body.x, y: state.body.y, rotation: state.rotation });
    if (state.trail.length > 10) {
      state.trail.shift();
    }
  }
  return events;
}
