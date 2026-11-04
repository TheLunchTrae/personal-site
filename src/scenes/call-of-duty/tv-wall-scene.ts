import * as THREE from 'three';
import { canvasTexture, disposeTree, MenuScene, type MenuCallbacks, type MenuTarget, stageRegion } from './scene-kit';

// The TV wall menu: a stack of old CRT sets in a dark room. Each section
// broadcasts on its own set; the rest only show static. Pointing at a set
// tunes it in, and choosing it pushes the camera into the glass.

const ROOM = '#07080a';
const PHOSPHOR = '#e9e4da';
const RED = '#e04a3f';
const CASES = ['#2a2420', '#1d1f22', '#3a2f24', '#25221f', '#30302c'] as const;
const ENTER_SECONDS = 0.6;

/** One set in a layout: center, screen size, depth nudge, and section slot. */
interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  /** Index into the targets, or -1 for a set that only shows static. */
  section: number;
}

// Landscape: an uneven stack of three rows. Portrait: a tower two sets wide,
// so each stays big enough to tap. Sections fill slots by index, the first
// ones in the front sets where the eye lands first; a slot with no section
// shows static.
const WIDE: readonly Slot[] = [
  { x: -2.35, y: 0.62, w: 1.5, h: 1.12, z: 0.05, section: -1 },
  { x: -0.78, y: 0.7, w: 1.42, h: 1.06, z: 0.12, section: 0 },
  { x: 0.82, y: 0.66, w: 1.5, h: 1.1, z: 0.04, section: 1 },
  { x: 2.38, y: 0.6, w: 1.38, h: 1.04, z: 0.1, section: -1 },
  { x: -1.6, y: 2.02, w: 1.36, h: 1.02, z: 0.0, section: 2 },
  { x: 0.02, y: 2.06, w: 1.28, h: 0.96, z: 0.08, section: -1 },
  { x: 1.58, y: 2.0, w: 1.4, h: 1.04, z: 0.02, section: 3 },
  { x: -0.82, y: 3.22, w: 1.14, h: 0.86, z: -0.04, section: -1 },
  { x: 0.86, y: 3.2, w: 1.06, h: 0.8, z: 0.0, section: 4 },
];

const TALL: readonly Slot[] = [
  { x: -0.8, y: 0.62, w: 1.44, h: 1.08, z: 0.1, section: 0 },
  { x: 0.8, y: 0.6, w: 1.44, h: 1.08, z: 0.04, section: 1 },
  { x: -0.8, y: 1.98, w: 1.44, h: 1.08, z: 0.02, section: 2 },
  { x: 0.8, y: 2.0, w: 1.44, h: 1.08, z: 0.1, section: 3 },
  { x: -0.8, y: 3.34, w: 1.44, h: 1.08, z: 0.0, section: 4 },
  { x: 0.8, y: 3.36, w: 1.3, h: 0.98, z: 0.06, section: -1 },
];

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// An original CRT look: barrel curve, broadcast image mixed with snow by
// signal strength, scanlines, a slow rolling bar, and a vignette.
const FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform float time;
uniform float signal;
uniform float power;
uniform float seed;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed * 17.0) * 43758.5453);
}

void main() {
  vec2 centered = vUv * 2.0 - 1.0;
  centered *= 1.0 + 0.07 * dot(centered, centered);
  vec2 uv = centered * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  float weak = 1.0 - signal;
  float wobble = weak * 0.018 * sin(time * 37.0 + uv.y * 28.0);
  vec3 image = texture2D(map, vec2(uv.x + wobble, uv.y)).rgb;
  float snow = hash(floor(uv * vec2(220.0, 165.0)) + floor(time * 24.0));
  vec3 color = mix(vec3(snow) * 0.62, image, signal);
  color *= 0.8 + 0.2 * sin(uv.y * 620.0);
  float roll = fract(uv.y * 0.6 - time * 0.11);
  color += 0.05 * smoothstep(0.0, 0.08, roll) * smoothstep(0.2, 0.08, roll);
  color *= smoothstep(1.32, 0.42, length(centered));
  gl_FragColor = vec4(color * power, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

interface TvSet {
  slot: Slot;
  root: THREE.Group;
  shell: THREE.Mesh;
  screen: THREE.Mesh;
  glow: THREE.Mesh;
  uniforms: {
    map: { value: THREE.Texture };
    time: { value: number };
    signal: { value: number };
    power: { value: number };
    seed: { value: number };
  };
  target: MenuTarget | null;
  channel: number;
}

function channelTexture(
  target: MenuTarget,
  channel: number,
  here: boolean,
  display: string,
  type: string,
): THREE.CanvasTexture {
  return canvasTexture(512, 384, (ctx) => {
    const glow = ctx.createRadialGradient(256, 200, 20, 256, 200, 320);
    glow.addColorStop(0, '#2b2d33');
    glow.addColorStop(1, '#0c0d10');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 512, 384);
    ctx.fillStyle = RED;
    ctx.font = `400 30px ${type}`;
    ctx.fillText(`CH ${String(channel).padStart(2, '0')}`, 34, 58);
    ctx.fillStyle = PHOSPHOR;
    ctx.font = `400 80px ${display}`;
    ctx.fillText(target.title.toUpperCase(), 34, 210, 444);
    ctx.fillStyle = 'rgba(233, 228, 218, 0.72)';
    ctx.font = `400 24px ${type}`;
    ctx.fillText(here ? 'You are here' : 'Tune in', 36, 262, 440);
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(462, 48, 9, 0, Math.PI * 2);
    ctx.fill();
  });
}

function noSignalTexture(type: string): THREE.CanvasTexture {
  return canvasTexture(256, 192, (ctx) => {
    ctx.fillStyle = '#101114';
    ctx.fillRect(0, 0, 256, 192);
    ctx.fillStyle = 'rgba(233, 228, 218, 0.8)';
    ctx.font = `400 22px ${type}`;
    ctx.textAlign = 'center';
    ctx.fillText('NO SIGNAL', 128, 104);
  });
}

function glowTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (ctx) => {
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  });
}

function bulgedPlane(width: number, height: number): THREE.PlaneGeometry {
  // CRT glass bows outward, so push the plane's middle toward the viewer.
  const geometry = new THREE.PlaneGeometry(width, height, 16, 12);
  const position = geometry.attributes['position'];
  if (position !== undefined) {
    for (let i = 0; i < position.count; i++) {
      const u = position.getX(i) / (width / 2);
      const v = position.getY(i) / (height / 2);
      position.setZ(i, 0.07 * (1 - u * u) * (1 - v * v));
    }
    geometry.computeVertexNormals();
  }
  return geometry;
}

export class TvWallScene extends MenuScene {
  private readonly sets: TvSet[] = [];
  private readonly targets: readonly MenuTarget[];
  private readonly wall = new THREE.Group();
  private readonly pointer = new THREE.Vector2();
  private readonly lamp = new THREE.PointLight(PHOSPHOR, 6, 7);
  private readonly drift = new THREE.Vector3();
  private readonly enterFrom = new THREE.Vector3();
  private readonly enterTo = new THREE.Vector3();
  private readonly home = new THREE.Vector3();
  private readonly glowMap = glowTexture();
  private selectedId: string | null = null;
  private portrait = false;

  constructor(
    container: HTMLElement,
    targets: readonly MenuTarget[],
    callbacks: MenuCallbacks,
    reducedMotion: boolean,
  ) {
    super(container, callbacks, reducedMotion);
    this.targets = targets;
    this.selectedId = targets[0]?.id ?? null;
    this.buildRoom();
    this.scene.add(this.wall);
    this.canvas.addEventListener('pointermove', (event) => this.handleHover(event), { signal: this.signal });
    // click, not pointerdown, so a touch that starts a scroll never selects.
    this.canvas.addEventListener('click', (event) => this.handleClick(event), { signal: this.signal });
    this.start();
  }

  select(id: string): void {
    if (this.entering === null && this.targets.some((target) => target.id === id)) {
      this.selectedId = id;
    }
  }

  enter(id: string): boolean {
    const set = this.sets.find((candidate) => candidate.target?.id === id);
    if (set === undefined || !this.beginEnter(id, ENTER_SECONDS)) {
      return false;
    }
    this.selectedId = id;
    this.enterFrom.copy(this.camera.position);
    set.screen.getWorldPosition(this.enterTo);
    this.enterTo.z += set.slot.h * 0.95;
    if (this.reducedMotion) {
      this.finishEnter();
    }
    return true;
  }

  protected layout(aspect: number): void {
    const portrait = aspect < 0.9;
    if (portrait !== this.portrait || this.sets.length === 0) {
      this.portrait = portrait;
      this.buildWall(portrait ? TALL : WIDE);
    }
    this.camera.fov = portrait ? 50 : 40;
    // Measure the cases only; the glow planes around each screen are larger.
    // A freshly built wall has stale world matrices until the first render.
    this.wall.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const set of this.sets) {
      box.expandByObject(set.shell);
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    // frameBox needs the final fov before it measures the view.
    this.camera.updateProjectionMatrix();
    this.frameBox(center, { width: size.x, height: size.y }, stageRegion(aspect));
    this.home.copy(this.camera.position);
    const distance = this.camera.position.z - center.z;
    this.scene.fog = new THREE.Fog(ROOM, distance + 1.5, distance + 9);
  }

  protected redrawText(): void {
    for (const set of this.sets) {
      set.uniforms.map.value.dispose();
      set.uniforms.map.value = this.screenTexture(set);
    }
  }

  protected update(now: number, delta: number): void {
    const entering = this.entering;
    for (const set of this.sets) {
      const selected = set.target !== null && set.target.id === this.selectedId;
      let signal = 0.12;
      if (set.target !== null) {
        signal = selected ? 1 : 0.74;
      }
      let power = selected ? 1.25 : 0.82;
      if (entering !== null && set.target?.id === entering.id) {
        power = 1.25 + Math.min(1, (now - entering.at) / ENTER_SECONDS) * 1.6;
      }
      const { uniforms } = set;
      uniforms.time.value = this.reducedMotion ? 0 : now;
      uniforms.signal.value = this.reducedMotion
        ? signal
        : THREE.MathUtils.damp(uniforms.signal.value, signal, 7, delta);
      uniforms.power.value = THREE.MathUtils.damp(uniforms.power.value, power, 9, delta);
      const glowMaterial: unknown = set.glow.material;
      if (glowMaterial instanceof THREE.MeshBasicMaterial) {
        glowMaterial.opacity = selected ? 0.32 : 0.1;
      }
      if (selected) {
        set.screen.getWorldPosition(this.lamp.position);
        this.lamp.position.z += 1.4;
      }
    }
    // A slight flicker on the room light sells the old sets.
    this.lamp.intensity = this.reducedMotion ? 6 : 6 + Math.sin(now * 31) * 0.4 + Math.sin(now * 7.3) * 0.6;
    if (entering === null) {
      // Drift with the pointer, and ease back out after arriving on a page.
      if (this.reducedMotion) {
        this.camera.position.copy(this.home);
      } else {
        this.drift.set(this.home.x + this.pointer.x * 0.12, this.home.y + this.pointer.y * 0.08, this.home.z);
        this.camera.position.lerp(this.drift, 0.05);
      }
      return;
    }
    const t = Math.min(1, (now - entering.at) / ENTER_SECONDS);
    const eased = t * t * (3 - 2 * t);
    this.camera.position.lerpVectors(this.enterFrom, this.enterTo, eased);
    if (t >= 1) {
      this.finishEnter();
    }
  }

  private buildRoom(): void {
    const { scene } = this;
    scene.background = new THREE.Color(ROOM);
    scene.add(new THREE.HemisphereLight('#4a4f5a', '#0a0705', 0.5));
    const rim = new THREE.DirectionalLight('#ffb98a', 0.5);
    rim.position.set(-4, 5, 3);
    scene.add(rim);
    scene.add(this.lamp);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 20),
      new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, -2);
    scene.add(floor);
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 12),
      new THREE.MeshStandardMaterial({ color: '#111216', roughness: 1 }),
    );
    back.position.set(0, 5, -1.6);
    scene.add(back);
  }

  private buildWall(slots: readonly Slot[]): void {
    // Rebuilding on an orientation change is cheap: a handful of boxes.
    for (const set of this.sets) {
      set.root.removeFromParent();
      disposeTree(set.root);
    }
    this.sets.length = 0;
    for (const [index, slot] of slots.entries()) {
      this.sets.push(this.buildSet(slot, index));
    }
  }

  private buildSet(slot: Slot, index: number): TvSet {
    const root = new THREE.Group();
    const caseColor = CASES[index % CASES.length] ?? CASES[0];
    const depth = slot.h * 0.95;
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(slot.w + 0.34, slot.h + 0.24, depth),
      new THREE.MeshStandardMaterial({ color: caseColor, roughness: 0.7, metalness: 0.05 }),
    );
    shell.position.z = -depth / 2;
    root.add(shell);
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(slot.w + 0.06, slot.h + 0.06, 0.06),
      new THREE.MeshStandardMaterial({ color: '#0b0b0c', roughness: 0.5 }),
    );
    bezel.position.set(-0.08, 0, 0.02);
    root.add(bezel);
    // A knob column on the right of every set.
    for (const [k, y] of [0.22, -0.12].entries()) {
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.05, 16),
        new THREE.MeshStandardMaterial({ color: k === 0 ? '#9a8f7c' : '#4a4540', roughness: 0.4 }),
      );
      knob.rotation.x = Math.PI / 2;
      knob.position.set(slot.w / 2 + 0.07, y * slot.h, 0.03);
      root.add(knob);
    }
    const target = slot.section >= 0 ? (this.targets[slot.section] ?? null) : null;
    const set: TvSet = {
      slot,
      root,
      shell,
      screen: new THREE.Mesh(),
      glow: new THREE.Mesh(),
      uniforms: {
        map: { value: new THREE.Texture() },
        time: { value: 0 },
        signal: { value: target === null ? 0.12 : 0.74 },
        power: { value: 0.82 },
        seed: { value: index * 1.37 },
      },
      target,
      channel: slot.section + 1,
    };
    set.uniforms.map.value = this.screenTexture(set);
    const screen = new THREE.Mesh(
      bulgedPlane(slot.w - 0.04, slot.h - 0.04),
      new THREE.ShaderMaterial({ uniforms: set.uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT }),
    );
    screen.position.set(-0.08, 0, 0.055);
    root.add(screen);
    set.screen = screen;
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(slot.w * 2.2, slot.h * 2.2),
      new THREE.MeshBasicMaterial({
        map: this.glowMap,
        color: '#c9d4ff',
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.position.set(-0.08, 0, 0.2);
    root.add(glow);
    set.glow = glow;
    // Sets sit a little crooked, the way a real pile would.
    root.position.set(slot.x, slot.y, slot.z);
    root.rotation.z = (((index * 7) % 5) - 2) * 0.012;
    root.rotation.y = (((index * 3) % 5) - 2) * 0.03;
    this.wall.add(root);
    return set;
  }

  private screenTexture(set: TvSet): THREE.CanvasTexture {
    return set.target === null
      ? noSignalTexture(this.fonts.type)
      : channelTexture(set.target, set.channel, set.target.id === this.current, this.fonts.display, this.fonts.type);
  }

  private pick(event: MouseEvent): TvSet | undefined {
    this.raycaster.setFromCamera(this.pointerToNdc(event, this.pointer), this.camera);
    const live = this.sets.filter((set) => set.target !== null);
    const [hit] = this.raycaster.intersectObjects(
      live.map((set) => set.screen),
      false,
    );
    return live.find((set) => set.screen === hit?.object);
  }

  private handleHover(event: PointerEvent): void {
    if (this.entering !== null) {
      return;
    }
    const set = this.pick(event);
    this.canvas.style.cursor = set === undefined ? 'default' : 'pointer';
    if (set !== undefined && set.target !== null && set.target.id !== this.selectedId) {
      this.selectedId = set.target.id;
      this.callbacks.onSelect(set.target.id);
    }
  }

  private handleClick(event: MouseEvent): void {
    if (event.button !== 0 || this.entering !== null) {
      return;
    }
    const set = this.pick(event);
    if (set !== undefined && set.target !== null) {
      this.enter(set.target.id);
    }
  }
}
