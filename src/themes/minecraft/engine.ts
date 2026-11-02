import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  EdgesGeometry,
  Fog,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { GameSectionId } from '@/site/sections';
import { meshWorld, type MeshArrays } from './mesher';
import { paintAtlas } from './textures';
import { B, type BlockId, createWorld, LANDMARKS, type Landmark, SPAWN, type World } from './world';

export interface EngineOptions {
  reducedMotion: boolean;
  onNearby: (section: GameSectionId | null) => void;
  onArrive: (section: GameSectionId) => void;
  onHeld: (block: BlockId | null) => void;
  labelFor: (section: GameSectionId) => HTMLElement | null;
}

export interface Engine {
  walkTo: (section: GameSectionId) => void;
  placeAt: (section: GameSectionId) => void;
  setPaused: (paused: boolean) => void;
  setMoveInput: (strafe: number, forward: number) => void;
  look: (dx: number, dy: number) => void;
  jump: () => void;
  enterNearby: () => void;
  reset: () => void;
  dispose: () => void;
}

const SKY = new Color('#9cc7ef');
const HALF_WIDTH = 0.3;
const HEIGHT = 1.8;
const EYE = 1.62;
const GRAVITY = 28;
const JUMP_SPEED = 8.6;
const WALK_SPEED = 4.4;
const AUTO_SPEED = 5.6;
const REACH = 6;
const NEARBY_RADIUS = 2.4;
const PLAZA_CORNERS = [
  { x: 29.5, z: 29.5 },
  { x: 35.5, z: 29.5 },
  { x: 35.5, z: 35.5 },
  { x: 29.5, z: 35.5 },
];

interface Point {
  x: number;
  z: number;
}

function landmarkFor(section: GameSectionId): Landmark | undefined {
  return LANDMARKS.find((landmark) => landmark.section === section);
}

function distance2d(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function nearestCorner(point: Point): number {
  let best = 0;
  PLAZA_CORNERS.forEach((corner, index) => {
    const current = PLAZA_CORNERS[best];
    if (current !== undefined && distance2d(point, corner) < distance2d(point, current)) {
      best = index;
    }
  });
  return best;
}

function toGeometry(arrays: MeshArrays): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(arrays.positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(arrays.uvs, 2));
  geometry.setAttribute('color', new BufferAttribute(arrays.colors, 3));
  geometry.setIndex(new BufferAttribute(arrays.indices, 1));
  return geometry;
}

export function webglAvailable(): boolean {
  try {
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return context !== null;
  } catch {
    return false;
  }
}

export function startEngine(host: HTMLElement, canvas: HTMLCanvasElement, options: EngineOptions): Engine {
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  scene.background = SKY;
  scene.fog = new Fog(SKY, 28, 70);
  const camera = new PerspectiveCamera(72, 1, 0.1, 200);
  camera.rotation.order = 'YXZ';

  const atlas = new CanvasTexture(paintAtlas());
  atlas.magFilter = NearestFilter;
  atlas.minFilter = NearestFilter;
  atlas.generateMipmaps = false;
  atlas.colorSpace = SRGBColorSpace;
  const opaqueMaterial = new MeshBasicMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5 });
  const translucentMaterial = new MeshBasicMaterial({
    map: atlas,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });

  let world: World = createWorld();
  let opaqueMesh: Mesh | undefined;
  let translucentMesh: Mesh | undefined;
  const rebuild = () => {
    const arrays = meshWorld(world);
    for (const mesh of [opaqueMesh, translucentMesh]) {
      if (mesh !== undefined) {
        scene.remove(mesh);
        mesh.geometry.dispose();
      }
    }
    opaqueMesh = new Mesh(toGeometry(arrays.opaque), opaqueMaterial);
    translucentMesh = new Mesh(toGeometry(arrays.translucent), translucentMaterial);
    translucentMesh.renderOrder = 1;
    scene.add(opaqueMesh, translucentMesh);
  };
  rebuild();

  const cloudMaterial = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
  const clouds: Mesh[] = [];
  for (const [x, z, w, d] of [
    [10, 8, 9, 5],
    [40, 4, 12, 6],
    [52, 40, 8, 7],
    [20, 50, 11, 5],
    [-6, 30, 10, 6],
  ] as const) {
    const cloud = new Mesh(new BoxGeometry(w, 1.2, d), cloudMaterial);
    cloud.position.set(x, 34, z);
    clouds.push(cloud);
    scene.add(cloud);
  }

  const highlight = new LineSegments(
    new EdgesGeometry(new BoxGeometry(1.002, 1.002, 1.002)),
    new LineBasicMaterial({ color: '#1d1a17' }),
  );
  highlight.visible = false;
  scene.add(highlight);

  // Player state.
  const position = new Vector3(SPAWN.x, SPAWN.y, SPAWN.z);
  const velocity = new Vector3();
  let yaw = 0;
  let pitch = -0.12;
  let onGround = false;
  const keys = new Set<string>();
  const stick = { strafe: 0, forward: 0 };
  let jumpQueued = false;
  let held: BlockId | null = null;
  let nearby: GameSectionId | null = null;
  let route: { section: GameSectionId; waypoints: Point[]; lastDistance: number; stalled: number } | null = null;

  const collides = (x: number, y: number, z: number) => {
    for (let bx = Math.floor(x - HALF_WIDTH); bx <= Math.floor(x + HALF_WIDTH); bx += 1) {
      for (let by = Math.floor(y); by <= Math.floor(y + HEIGHT - 0.01); by += 1) {
        for (let bz = Math.floor(z - HALF_WIDTH); bz <= Math.floor(z + HALF_WIDTH); bz += 1) {
          if (world.isSolid(bx, by, bz)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  // Moves along one axis in small steps and stops at the first collision.
  const moveAxis = (axis: 'x' | 'y' | 'z', delta: number): boolean => {
    const steps = Math.ceil(Math.abs(delta) / 0.1);
    const step = delta / Math.max(steps, 1);
    for (let i = 0; i < steps; i += 1) {
      position[axis] += step;
      if (collides(position.x, position.y, position.z)) {
        position[axis] -= step;
        return true;
      }
    }
    return false;
  };

  const placePlayer = (point: Point, facing: Point) => {
    position.set(point.x, world.surfaceY(Math.floor(point.x), Math.floor(point.z)), point.z);
    while (collides(position.x, position.y, position.z)) {
      position.y += 1;
    }
    velocity.set(0, 0, 0);
    yaw = Math.atan2(-(facing.x - point.x), -(facing.z - point.z));
    pitch = -0.05;
  };

  const lineIsWalkable = (from: Point, to: Point) => {
    const length = distance2d(from, to);
    const feet = Math.floor(position.y + 0.01);
    for (let t = 0; t <= length; t += 0.3) {
      const x = from.x + ((to.x - from.x) * t) / length;
      const z = from.z + ((to.z - from.z) * t) / length;
      for (const [ox, oz] of [
        [HALF_WIDTH, HALF_WIDTH],
        [-HALF_WIDTH, HALF_WIDTH],
        [HALF_WIDTH, -HALF_WIDTH],
        [-HALF_WIDTH, -HALF_WIDTH],
      ] as const) {
        if (world.isSolid(Math.floor(x + ox), feet + 1, Math.floor(z + oz))) {
          return false;
        }
      }
    }
    return true;
  };

  const planRoute = (landmark: Landmark): Point[] => {
    const here = { x: position.x, z: position.z };
    const corners: Point[] = [];
    let index = nearestCorner(here);
    const goal = nearestCorner(landmark.approach);
    corners.push(PLAZA_CORNERS[index] ?? here);
    while (index !== goal) {
      const clockwise = (goal - index + 4) % 4 <= 2;
      index = (index + (clockwise ? 1 : 3)) % 4;
      corners.push(PLAZA_CORNERS[index] ?? here);
    }
    const waypoints = [...corners, landmark.approach, landmark.door];
    // Skip ahead to the farthest waypoint reachable in a straight line.
    let start = 0;
    for (let i = waypoints.length - 1; i > 0; i -= 1) {
      const target = waypoints[i];
      if (target !== undefined && lineIsWalkable(here, target)) {
        start = i;
        break;
      }
    }
    return waypoints.slice(start);
  };

  const arrive = (landmark: Landmark) => {
    route = null;
    velocity.x = 0;
    velocity.z = 0;
    yaw = Math.atan2(-(landmark.sign.x - position.x), -(landmark.sign.z - position.z));
    options.onArrive(landmark.section);
  };

  const raycast = () => {
    // Steps through voxels along the view ray (Amanatides and Woo).
    const origin = new Vector3(position.x, position.y + EYE, position.z);
    const direction = new Vector3();
    camera.getWorldDirection(direction);
    const cell = [Math.floor(origin.x), Math.floor(origin.y), Math.floor(origin.z)];
    const dir = [direction.x, direction.y, direction.z];
    const org = [origin.x, origin.y, origin.z];
    const step = dir.map((d) => (d > 0 ? 1 : -1));
    const tDelta = dir.map((d) => (d === 0 ? Infinity : Math.abs(1 / d)));
    const tMax = dir.map((d, axis) => {
      if (d === 0) {
        return Infinity;
      }
      const o = org[axis] ?? 0;
      const c = cell[axis] ?? 0;
      return d > 0 ? (c + 1 - o) / d : (o - c) / -d;
    });
    const normal = [0, 0, 0];
    let travelled = 0;
    while (travelled <= REACH) {
      const [cx = 0, cy = 0, cz = 0] = cell;
      const block = world.get(cx, cy, cz);
      if (block !== B.air && block !== B.water) {
        return {
          cell: [cx, cy, cz] as const,
          normal: [normal[0] ?? 0, normal[1] ?? 0, normal[2] ?? 0] as const,
          block,
        };
      }
      const [mx = 0, my = 0, mz = 0] = tMax;
      const axis = mx < my ? (mx < mz ? 0 : 2) : my < mz ? 1 : 2;
      travelled = tMax[axis] ?? Infinity;
      cell[axis] = (cell[axis] ?? 0) + (step[axis] ?? 0);
      tMax[axis] = travelled + (tDelta[axis] ?? 0);
      normal.fill(0);
      normal[axis] = -(step[axis] ?? 0);
    }
    return null;
  };

  const breakTarget = () => {
    const hit = raycast();
    if (hit === null || hit.block === B.bedrock) {
      return;
    }
    const [x, y, z] = hit.cell;
    world.set(x, y, z, B.air);
    held = hit.block;
    options.onHeld(held);
    rebuild();
  };

  const placeHeld = () => {
    const hit = raycast();
    if (hit === null || held === null) {
      return;
    }
    const [x, y, z] = hit.cell;
    const [nx, ny, nz] = hit.normal;
    const target: [number, number, number] = [x + nx, y + ny, z + nz];
    if (world.get(...target) !== B.air) {
      return;
    }
    world.set(...target, held);
    if (collides(position.x, position.y, position.z)) {
      world.set(...target, B.air);
      return;
    }
    rebuild();
  };

  const updateNearby = () => {
    let best: GameSectionId | null = null;
    let bestDistance = NEARBY_RADIUS;
    for (const landmark of LANDMARKS) {
      if (landmark.section === 'home') {
        continue;
      }
      const d = distance2d(position, landmark.door);
      if (d < bestDistance) {
        best = landmark.section;
        bestDistance = d;
      }
    }
    if (best !== nearby) {
      nearby = best;
      options.onNearby(best);
    }
  };

  const projected = new Vector3();
  const updateLabels = (width: number, height: number) => {
    for (const landmark of LANDMARKS) {
      const label = options.labelFor(landmark.section);
      if (label === null) {
        continue;
      }
      projected.set(landmark.sign.x, landmark.sign.y, landmark.sign.z).project(camera);
      const far = distance2d(position, landmark.sign) > 48;
      const visible = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1 && !far;
      label.style.visibility = visible ? 'visible' : 'hidden';
      if (visible) {
        const x = ((projected.x + 1) / 2) * width;
        const y = ((1 - projected.y) / 2) * height;
        label.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      }
    }
  };

  const step = (dt: number) => {
    // Input: keyboard, the touch stick, or the walk route.
    let forward = stick.forward;
    let strafe = stick.strafe;
    if (keys.has('KeyW') || keys.has('ArrowUp')) {
      forward += 1;
    }
    if (keys.has('KeyS') || keys.has('ArrowDown')) {
      forward -= 1;
    }
    if (keys.has('KeyD')) {
      strafe += 1;
    }
    if (keys.has('KeyA')) {
      strafe -= 1;
    }
    if (keys.has('ArrowLeft')) {
      yaw += dt * 2.2;
    }
    if (keys.has('ArrowRight')) {
      yaw -= dt * 2.2;
    }
    if (route !== null && (forward !== 0 || strafe !== 0)) {
      route = null;
    }

    let speed = WALK_SPEED;
    let wishX = 0;
    let wishZ = 0;
    if (route !== null) {
      const target = route.waypoints[0];
      const landmark = landmarkFor(route.section);
      if (target === undefined || landmark === undefined) {
        route = null;
      } else {
        const d = distance2d(position, target);
        if (d < (route.waypoints.length === 1 ? 0.35 : 0.8)) {
          route.waypoints.shift();
          route.lastDistance = Infinity;
          route.stalled = 0;
          if (route.waypoints.length === 0) {
            arrive(landmark);
          }
        } else {
          const desired = Math.atan2(-(target.x - position.x), -(target.z - position.z));
          let turn = desired - yaw;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          yaw += turn * Math.min(1, dt * 8);
          pitch += (-0.08 - pitch) * Math.min(1, dt * 4);
          wishX = (target.x - position.x) / d;
          wishZ = (target.z - position.z) / d;
          speed = AUTO_SPEED;
          if (d < route.lastDistance - 0.05) {
            route.lastDistance = d;
            route.stalled = 0;
          } else {
            route.stalled += dt;
          }
          // A route that stops making progress skips to its next waypoint.
          if (route.stalled > 2) {
            placePlayer(target, landmark.sign);
            route.lastDistance = Infinity;
            route.stalled = 0;
          }
        }
      }
    } else {
      const length = Math.hypot(forward, strafe);
      if (length > 0) {
        const f = forward / Math.max(1, length);
        const s = strafe / Math.max(1, length);
        wishX = -Math.sin(yaw) * f + Math.cos(yaw) * s;
        wishZ = -Math.cos(yaw) * f - Math.sin(yaw) * s;
      }
    }

    const inWater = world.get(Math.floor(position.x), Math.floor(position.y + 0.2), Math.floor(position.z)) === B.water;
    if (inWater) {
      speed *= 0.55;
    }
    velocity.x = wishX * speed;
    velocity.z = wishZ * speed;
    velocity.y -= GRAVITY * dt * (inWater ? 0.4 : 1);
    if ((jumpQueued || keys.has('Space')) && (onGround || inWater)) {
      velocity.y = inWater ? 4 : JUMP_SPEED;
    }
    jumpQueued = false;

    const blockedX = moveAxis('x', velocity.x * dt);
    const blockedZ = moveAxis('z', velocity.z * dt);
    // Step up single blocks without a jump key, like walking up stairs.
    if ((blockedX || blockedZ) && onGround && (wishX !== 0 || wishZ !== 0)) {
      const aheadX = position.x + wishX * 0.4;
      const aheadZ = position.z + wishZ * 0.4;
      if (!collides(aheadX, position.y + 1.05, aheadZ)) {
        velocity.y = JUMP_SPEED;
      }
    }
    const hitY = moveAxis('y', velocity.y * dt);
    onGround = hitY && velocity.y < 0;
    if (hitY) {
      velocity.y = 0;
    }
    if (position.y < -10) {
      placePlayer(SPAWN, { x: SPAWN.x, z: SPAWN.z - 4 });
    }

    camera.position.set(position.x, position.y + EYE, position.z);
    camera.rotation.set(pitch, yaw, 0);

    if (!options.reducedMotion) {
      for (const cloud of clouds) {
        cloud.position.x += dt * 0.6;
        if (cloud.position.x > 80) {
          cloud.position.x = -16;
        }
      }
    }

    const hit = raycast();
    highlight.visible = hit !== null;
    if (hit !== null) {
      highlight.position.set(hit.cell[0] + 0.5, hit.cell[1] + 0.5, hit.cell[2] + 0.5);
    }
    updateNearby();
  };

  let width = 1;
  let height = 1;
  const resize = () => {
    width = host.clientWidth > 0 ? host.clientWidth : window.innerWidth;
    height = host.clientHeight > 0 ? host.clientHeight : window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  let paused = false;
  let frame = 0;
  let last = performance.now();
  const render = () => {
    renderer.render(scene, camera);
    updateLabels(width, height);
  };
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    render();
    frame = requestAnimationFrame(loop);
  };
  const resume = () => {
    cancelAnimationFrame(frame);
    last = performance.now();
    frame = requestAnimationFrame(loop);
  };

  const placeAt = (section: GameSectionId) => {
    const landmark = landmarkFor(section);
    if (landmark !== undefined && distance2d(position, landmark.door) > NEARBY_RADIUS) {
      route = null;
      placePlayer(landmark.door, landmark.sign);
      render();
    }
  };
  const enterNearby = () => {
    if (nearby !== null) {
      options.onArrive(nearby);
    }
  };
  const reset = () => {
    world = createWorld();
    held = null;
    options.onHeld(null);
    rebuild();
    placePlayer(SPAWN, { x: SPAWN.x, z: SPAWN.z - 4 });
  };
  const look = (dx: number, dy: number) => {
    yaw -= dx * 0.005;
    pitch = Math.max(-1.45, Math.min(1.45, pitch - dy * 0.005));
  };

  // Movement keys only apply while the world has focus, so page keys work.
  const gameKeys = new Set([
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Space',
  ]);
  const onKeyDown = (event: KeyboardEvent) => {
    if (paused || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (gameKeys.has(event.code)) {
      keys.add(event.code);
      event.preventDefault();
    } else if (event.code === 'KeyE' || event.code === 'Enter') {
      enterNearby();
    } else if (event.code === 'KeyR') {
      reset();
    }
  };
  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
  const onBlur = () => keys.clear();

  // Drag to look; a click without a drag breaks the targeted block.
  let drag: { x: number; y: number; moved: number; button: number } | null = null;
  const onPointerDown = (event: PointerEvent) => {
    if (paused) {
      return;
    }
    host.focus({ preventScroll: true });
    drag = { x: event.clientX, y: event.clientY, moved: 0, button: event.button };
    canvas.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (drag === null) {
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.x = event.clientX;
    drag.y = event.clientY;
    look(dx, dy);
  };
  const onPointerUp = (event: PointerEvent) => {
    if (drag !== null && drag.moved < 6 && event.pointerType === 'mouse') {
      if (drag.button === 0) {
        breakTarget();
      } else if (drag.button === 2) {
        placeHeld();
      }
    }
    drag = null;
  };
  const onContextMenu = (event: Event) => event.preventDefault();

  host.addEventListener('keydown', onKeyDown);
  host.addEventListener('keyup', onKeyUp);
  host.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu', onContextMenu);

  const engine: Engine = {
    walkTo: (section) => {
      const landmark = landmarkFor(section);
      if (landmark === undefined) {
        return;
      }
      if (options.reducedMotion) {
        placeAt(section);
        options.onArrive(section);
        return;
      }
      route = { section, waypoints: planRoute(landmark), lastDistance: Infinity, stalled: 0 };
      host.focus({ preventScroll: true });
    },
    placeAt,
    setPaused: (next) => {
      paused = next;
      keys.clear();
      if (paused) {
        cancelAnimationFrame(frame);
        render();
      } else {
        resume();
      }
    },
    setMoveInput: (strafe, forward) => {
      stick.strafe = strafe;
      stick.forward = forward;
    },
    look,
    jump: () => {
      jumpQueued = true;
    },
    enterNearby,
    reset,
    dispose: () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('keydown', onKeyDown);
      host.removeEventListener('keyup', onKeyUp);
      host.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      for (const mesh of [opaqueMesh, translucentMesh, ...clouds]) {
        mesh?.geometry.dispose();
      }
      highlight.geometry.dispose();
      highlight.material.dispose();
      for (const material of [opaqueMaterial, translucentMaterial, cloudMaterial]) {
        material.dispose();
      }
      atlas.dispose();
      renderer.dispose();
    },
  };

  placePlayer(SPAWN, { x: SPAWN.x, z: SPAWN.z - 4 });
  resume();
  return engine;
}
