import * as THREE from 'three';
import { canvasTexture, MenuScene, type MenuCallbacks, type MenuTarget, stageRegion } from './scene-kit';

// The globe menu: a dark, dotted planet hanging in smoke and embers. Each
// section is a marked site on its surface. Dragging turns the planet; the
// site that ends up facing the viewer is the one selected, and the globe
// settles onto it when the drag ends.

const RADIUS = 1.6;
const DOTS = 5200;
const EMBERS = 140;
const ENTER_SECONDS = 0.7;
const DRAG_SPEED = 0.0065;
const BONE = new THREE.Color('#e9e4da');
const ASH = new THREE.Color('#3b2f2b');
const RED = '#e04a3f';
const RING_RED = new THREE.Color(RED);
const RING_EMBER = new THREE.Color('#f0a35c');

// Places for up to five sites, in the order sections take them, so the
// first two sit on opposite sides and the rest fill in between.
const SITES = [
  { lat: 18, lon: -160 },
  { lat: -24, lon: 60 },
  { lat: 36, lon: -14 },
  { lat: 10, lon: 132 },
  { lat: -14, lon: -88 },
] as const;

interface GlobeCallbacks extends MenuCallbacks {
  /** Screen position of the selected site, in CSS pixels, for its DOM tag. */
  onAnchor: (x: number, y: number, visible: boolean) => void;
}

interface Site {
  target: MenuTarget;
  lat: number;
  lon: number;
  /** Unit direction of the site on the untilted globe. */
  normal: THREE.Vector3;
  root: THREE.Group;
  ring: THREE.Mesh;
  beam: THREE.Mesh;
  hit: THREE.Mesh;
}

function latLon(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(lat);
  const lambda = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    radius * Math.cos(phi) * Math.sin(lambda),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.cos(lambda),
  );
}

function hash3(x: number, y: number, z: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(p: THREE.Vector3): number {
  const ix = Math.floor(p.x);
  const iy = Math.floor(p.y);
  const iz = Math.floor(p.z);
  const fx = p.x - ix;
  const fy = p.y - iy;
  const fz = p.z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);
  const corner = (dx: number, dy: number, dz: number) => hash3(ix + dx, iy + dy, iz + dz);
  const lerp = THREE.MathUtils.lerp;
  const x00 = lerp(corner(0, 0, 0), corner(1, 0, 0), sx);
  const x10 = lerp(corner(0, 1, 0), corner(1, 1, 0), sx);
  const x01 = lerp(corner(0, 0, 1), corner(1, 0, 1), sx);
  const x11 = lerp(corner(0, 1, 1), corner(1, 1, 1), sx);
  return lerp(lerp(x00, x10, sy), lerp(x01, x11, sy), sz);
}

function landness(direction: THREE.Vector3): number {
  // A few octaves of value noise carve continents out of a unit sphere.
  const p = direction.clone().multiplyScalar(1.7).addScalar(11.3);
  let total = 0;
  let amplitude = 0.55;
  for (let octave = 0; octave < 4; octave++) {
    total += valueNoise(p) * amplitude;
    p.multiplyScalar(2.03);
    amplitude *= 0.5;
  }
  return total;
}

function dotTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, (ctx) => {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.85)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  });
}

const RIM_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 world = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-world.xyz);
  gl_Position = projectionMatrix * world;
}
`;

// The planet's body: near black, with a red fresnel edge.
const BODY_FRAGMENT = /* glsl */ `
uniform vec3 rimColor;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.0);
  gl_FragColor = vec4(mix(vec3(0.004, 0.003, 0.003), rimColor, rim * 0.8), 1.0);
  #include <colorspace_fragment>
}
`;

// A haze drawn on an outer shell's back faces: zero at the shell's edge,
// rising toward the planet's limb, hidden behind the planet itself.
const HAZE_FRAGMENT = /* glsl */ `
uniform vec3 rimColor;
uniform float strength;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float glow = pow(max(0.0, -dot(vNormal, vView)), 2.2) * strength;
  gl_FragColor = vec4(rimColor, clamp(glow, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;

export class GlobeScene extends MenuScene {
  private readonly targets: readonly MenuTarget[];
  private readonly onAnchor: GlobeCallbacks['onAnchor'];
  private readonly globe = new THREE.Group();
  private readonly sites: Site[] = [];
  private readonly embers: THREE.Points;
  private readonly emberSeeds: Float32Array;
  private readonly haze: { strength: { value: number }; rimColor: { value: THREE.Color } };
  private readonly pointer = new THREE.Vector2();
  private readonly world = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly home = new THREE.Vector3();
  private readonly enterTo = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private goalYaw = 0;
  private velocity = 0;
  private drag: { id: number; x: number; travel: number; movedAt: number } | null = null;
  private readonly probe = new THREE.Euler();
  private readonly facing = new THREE.Vector3();
  private selectedId: string | null = null;

  constructor(
    container: HTMLElement,
    targets: readonly MenuTarget[],
    callbacks: GlobeCallbacks,
    reducedMotion: boolean,
  ) {
    super(container, callbacks, reducedMotion);
    this.targets = targets;
    this.onAnchor = callbacks.onAnchor;
    this.canvas.classList.add('cod-draggable');
    this.scene.background = new THREE.Color('#060506');
    this.scene.add(this.globe);
    this.haze = { strength: { value: 0.9 }, rimColor: { value: new THREE.Color(RED) } };
    this.buildPlanet();
    this.buildSites();
    this.buildSky();
    this.emberSeeds = new Float32Array(EMBERS);
    this.embers = this.buildEmbers();
    const first = this.sites[0];
    if (first !== undefined) {
      this.selectedId = first.target.id;
      this.goalYaw = this.yawFor(first);
      this.yaw = this.goalYaw + (this.reducedMotion ? 0 : 0.9);
      this.pitch = THREE.MathUtils.degToRad(first.lat);
    }
    const { signal } = this;
    this.canvas.addEventListener('pointerdown', (event) => this.handleDown(event), { signal });
    this.canvas.addEventListener('pointermove', (event) => this.handleMove(event), { signal });
    this.canvas.addEventListener('pointerup', (event) => this.handleUp(event), { signal });
    this.canvas.addEventListener('pointercancel', () => this.release(), { signal });
    this.start();
  }

  select(id: string): void {
    const site = this.sites.find((candidate) => candidate.target.id === id);
    if (site !== undefined && this.entering === null) {
      this.selectedId = id;
      this.velocity = 0;
      this.goalYaw = this.nearestTurn(this.yawFor(site));
    }
  }

  /** Turns to the next or previous site, for the arrow buttons and keys; null mid-exit. */
  step(direction: 1 | -1): string | null {
    // Mid-exit the globe holds its course to the page it opens.
    if (this.entering !== null) {
      return null;
    }
    const index = this.sites.findIndex((site) => site.target.id === this.selectedId);
    const next = this.sites.at((index + direction) % this.sites.length);
    if (next === undefined) {
      return null;
    }
    this.select(next.target.id);
    return next.target.id;
  }

  enter(id: string): boolean {
    const site = this.sites.find((candidate) => candidate.target.id === id);
    if (site === undefined || this.entering !== null) {
      return false;
    }
    this.select(id);
    if (!this.beginEnter(id, ENTER_SECONDS)) {
      return false;
    }
    if (this.reducedMotion) {
      this.finishEnter();
    }
    return true;
  }

  protected layout(aspect: number): void {
    const portrait = aspect < 0.9;
    this.camera.fov = portrait ? 46 : 38;
    this.camera.updateProjectionMatrix();
    const span = RADIUS * 2.7;
    this.frameBox(new THREE.Vector3(), { width: span, height: span }, stageRegion(aspect));
    this.home.copy(this.camera.position);
  }

  protected redrawText(): void {
    // Site names are DOM tags, so the globe has no text textures to redraw.
  }

  protected update(now: number, delta: number): void {
    if (this.drag === null) {
      // After a fling, glide, then settle on whichever site faces the viewer.
      if (Math.abs(this.velocity) > 0.0004) {
        this.goalYaw += this.velocity;
        this.velocity *= 0.9;
        this.trackFront();
      } else if (this.velocity !== 0) {
        this.velocity = 0;
        this.snapToSelected();
      }
    }
    const selected = this.sites.find((site) => site.target.id === this.selectedId);
    const goalPitch = selected === undefined ? 0 : THREE.MathUtils.degToRad(selected.lat);
    if (this.reducedMotion) {
      this.yaw = this.goalYaw;
      this.pitch = goalPitch;
    } else {
      this.yaw = THREE.MathUtils.damp(this.yaw, this.goalYaw, this.drag === null ? 5 : 18, delta);
      this.pitch = THREE.MathUtils.damp(this.pitch, goalPitch, 4, delta);
    }
    this.globe.rotation.set(this.pitch, this.yaw, 0);
    this.globe.updateMatrixWorld();
    this.updateSites(now, delta);
    this.updateEmbers(delta);
    this.haze.strength.value = this.reducedMotion ? 0.9 : 0.85 + Math.sin(now * 1.3) * 0.08;
    this.updateCamera(now);
  }

  private updateCamera(now: number): void {
    const entering = this.entering;
    if (entering === null) {
      // Ease back out after arriving on a page.
      if (this.reducedMotion) {
        this.camera.position.copy(this.home);
      } else {
        this.camera.position.lerp(this.home, 0.06);
      }
      return;
    }
    const t = Math.min(1, (now - entering.at) / ENTER_SECONDS);
    const eased = t * t * (3 - 2 * t);
    const site = this.sites.find((candidate) => candidate.target.id === entering.id);
    if (site !== undefined) {
      site.root.getWorldPosition(this.enterTo);
      this.enterTo.z += 0.55;
    }
    this.camera.position.lerpVectors(this.home, this.enterTo, eased);
    this.haze.strength.value += eased * 1.4;
    if (t >= 1) {
      this.finishEnter();
    }
  }

  private updateSites(now: number, delta: number): void {
    for (const [index, site] of this.sites.entries()) {
      const selected = site.target.id === this.selectedId;
      const pulse = this.reducedMotion ? 0 : (Math.sin(now * 3 + index) + 1) * 0.5;
      const goal = selected ? 1.5 + pulse * 0.35 : 0.9;
      site.ring.scale.setScalar(THREE.MathUtils.damp(site.ring.scale.x, goal, 8, delta));
      const beam: unknown = site.beam.material;
      if (beam instanceof THREE.MeshBasicMaterial) {
        beam.opacity = selected ? 0.75 : 0.22;
      }
      // The page the visitor is on burns ember instead of red.
      const ring: unknown = site.ring.material;
      if (ring instanceof THREE.MeshBasicMaterial) {
        ring.color.copy(site.target.id === this.current ? RING_EMBER : RING_RED);
      }
      if (selected) {
        site.root.getWorldPosition(this.world);
        this.projected.copy(this.world).project(this.camera);
        this.onAnchor(
          ((this.projected.x + 1) / 2) * this.width,
          ((1 - this.projected.y) / 2) * this.height,
          this.world.z > RADIUS * 0.4 && this.entering === null,
        );
      }
    }
  }

  private updateEmbers(delta: number): void {
    if (this.reducedMotion) {
      return;
    }
    const position = this.embers.geometry.attributes['position'];
    if (position === undefined) {
      return;
    }
    for (let i = 0; i < EMBERS; i++) {
      const seed = this.emberSeeds[i] ?? 0;
      let y = position.getY(i) + delta * (0.18 + seed * 0.3);
      if (y > 3) {
        y = -3;
      }
      position.setXYZ(i, position.getX(i) + Math.sin(y * 2 + seed * 9) * delta * 0.05, y, position.getZ(i));
    }
    position.needsUpdate = true;
  }

  private buildPlanet(): void {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 0.994, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: { rimColor: { value: new THREE.Color('#5a1612') } },
        vertexShader: RIM_VERTEX,
        fragmentShader: BODY_FRAGMENT,
      }),
    );
    this.globe.add(body);

    // Fibonacci points spread dots evenly; continents keep bright dots and
    // the seas keep a sparse ash grid.
    const positions: number[] = [];
    const colors: number[] = [];
    const direction = new THREE.Vector3();
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < DOTS; i++) {
      const y = 1 - (i / (DOTS - 1)) * 2;
      const ring = Math.sqrt(1 - y * y);
      direction.set(Math.cos(golden * i) * ring, y, Math.sin(golden * i) * ring);
      const land = landness(direction) > 0.5;
      if (!land && i % 4 !== 0) {
        continue;
      }
      positions.push(direction.x * RADIUS, direction.y * RADIUS, direction.z * RADIUS);
      const color = land ? BONE : ASH;
      colors.push(color.r, color.g, color.b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const dots = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.034,
        map: dotTexture(),
        vertexColors: true,
        transparent: true,
        alphaTest: 0.2,
      }),
    );
    this.globe.add(dots);

    for (const lat of [-60, -30, 0, 30, 60]) {
      const points = Array.from({ length: 97 }, (_, i) => latLon(lat, (i / 96) * 360, RADIUS * 1.004));
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: '#3a2422', transparent: true, opacity: 0.6 }),
      );
      this.globe.add(line);
    }

    const haze = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 1.22, 48, 32),
      new THREE.ShaderMaterial({
        uniforms: this.haze,
        vertexShader: RIM_VERTEX,
        fragmentShader: HAZE_FRAGMENT,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(haze);
  }

  private buildSites(): void {
    for (const [index, target] of this.targets.entries()) {
      const place = SITES[index % SITES.length] ?? SITES[0];
      const root = new THREE.Group();
      root.position.copy(latLon(place.lat, place.lon, RADIUS));
      // Point the site's local +z out of the planet.
      root.lookAt(latLon(place.lat, place.lon, RADIUS * 2));
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: RED }));
      root.add(core);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.075, 0.095, 40),
        new THREE.MeshBasicMaterial({ color: RED, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
      );
      ring.position.z = 0.01;
      root.add(ring);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.018, 0.32, 8, 1, true),
        new THREE.MeshBasicMaterial({
          color: '#ff6a4d',
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      beam.rotation.x = Math.PI / 2;
      beam.position.z = 0.16;
      root.add(beam);
      // A larger invisible sphere makes small sites easy to tap.
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      root.add(hit);
      this.globe.add(root);
      this.sites.push({
        target,
        lat: place.lat,
        lon: place.lon,
        normal: latLon(place.lat, place.lon, 1),
        root,
        ring,
        beam,
        hit,
      });
    }
  }

  private buildSky(): void {
    const positions: number[] = [];
    for (let i = 0; i < 420; i++) {
      const direction = new THREE.Vector3(hash3(i, 1, 2) - 0.5, hash3(i, 3, 4) - 0.5, -hash3(i, 5, 6)).normalize();
      positions.push(direction.x * 30, direction.y * 30, direction.z * 30 - 4);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.scene.add(
      new THREE.Points(
        geometry,
        new THREE.PointsMaterial({ color: '#8c8478', size: 0.06, transparent: true, opacity: 0.5 }),
      ),
    );
  }

  private buildEmbers(): THREE.Points {
    const positions: number[] = [];
    for (let i = 0; i < EMBERS; i++) {
      this.emberSeeds[i] = hash3(i, 7, 9);
      const angle = hash3(i, 2, 8) * Math.PI * 2;
      const distance = RADIUS * (1.15 + hash3(i, 4, 1) * 1.1);
      positions.push(Math.cos(angle) * distance, hash3(i, 6, 3) * 6 - 3, Math.sin(angle) * distance * 0.6);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const embers = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: '#ff7a3d',
        size: 0.045,
        map: dotTexture(),
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(embers);
    return embers;
  }

  private yawFor(site: Site): number {
    return -THREE.MathUtils.degToRad(site.lon);
  }

  /** The turn equal to the given yaw that is closest to where the globe aims. */
  private nearestTurn(yaw: number): number {
    const full = Math.PI * 2;
    return yaw + Math.round((this.goalYaw - yaw) / full) * full;
  }

  private trackFront(): void {
    // The site nearest the viewer is the selection while the globe turns.
    const probe = this.probe.set(this.pitch, this.goalYaw, 0);
    let best: Site | undefined;
    let bestZ = -Infinity;
    for (const site of this.sites) {
      const z = this.facing.copy(site.normal).applyEuler(probe).z;
      if (z > bestZ) {
        bestZ = z;
        best = site;
      }
    }
    if (best !== undefined && best.target.id !== this.selectedId) {
      this.selectedId = best.target.id;
      this.callbacks.onSelect(best.target.id);
    }
  }

  private snapToSelected(): void {
    const site = this.sites.find((candidate) => candidate.target.id === this.selectedId);
    if (site !== undefined) {
      this.goalYaw = this.nearestTurn(this.yawFor(site));
    }
  }

  private pick(event: MouseEvent): Site | undefined {
    this.raycaster.setFromCamera(this.pointerToNdc(event, this.pointer), this.camera);
    // Only sites on the near side can be picked; the planet hides the rest.
    const near = this.sites.filter((site) => site.root.getWorldPosition(this.world).z > RADIUS * 0.2);
    const [hit] = this.raycaster.intersectObjects(
      near.map((site) => site.hit),
      false,
    );
    return near.find((site) => site.hit === hit?.object);
  }

  private handleDown(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0 || this.entering !== null) {
      return;
    }
    this.drag = { id: event.pointerId, x: event.clientX, travel: 0, movedAt: event.timeStamp };
    this.velocity = 0;
    this.canvas.setPointerCapture(event.pointerId);
  }

  private handleMove(event: PointerEvent): void {
    const drag = this.drag;
    if (drag === null) {
      const site = this.pick(event);
      this.canvas.style.cursor = site === undefined ? 'grab' : 'pointer';
      return;
    }
    if (event.pointerId !== drag.id) {
      return;
    }
    const dx = event.clientX - drag.x;
    drag.x = event.clientX;
    drag.travel += Math.abs(dx);
    drag.movedAt = event.timeStamp;
    this.canvas.style.cursor = 'grabbing';
    this.goalYaw += dx * DRAG_SPEED;
    this.velocity = dx * DRAG_SPEED * 0.6;
    this.trackFront();
  }

  private handleUp(event: PointerEvent): void {
    const drag = this.drag;
    if (drag === null || event.pointerId !== drag.id) {
      return;
    }
    // A drag that paused before letting go settles where it is.
    if (event.timeStamp - drag.movedAt > 80) {
      this.velocity = 0;
    }
    // A press that barely moved is a tap: pick a site instead of turning.
    if (drag.travel < 6) {
      this.velocity = 0;
      const site = this.pick(event);
      if (site !== undefined) {
        if (site.target.id === this.selectedId) {
          this.enter(site.target.id);
        } else {
          this.select(site.target.id);
          this.callbacks.onSelect(site.target.id);
        }
      }
    }
    this.release();
  }

  private release(): void {
    this.drag = null;
    this.canvas.style.cursor = 'grab';
    if (this.velocity === 0) {
      this.snapToSelected();
    }
  }
}
