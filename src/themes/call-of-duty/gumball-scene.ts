import * as THREE from 'three';
import type { GameSectionId } from '@/site/sections';
import type { NoirStreet } from './noir-street';
import type { Quality } from './quality';
import { canvasTexture, MenuScene, type MenuCallbacks, type MenuTarget } from './scene-kit';

// The gumball menu: an art deco gumball machine against a pillar in a rainy
// plaza under a burning sky, after the first room of Shadows of Evil. Each
// page is a gum color. Turning the crank drops one gum into the tray, a paper
// ticket with the page's name pops up, and the camera leans in before the
// page opens. The plaza's neon signs are baked scenery; the sign of the
// chosen page brightens.
// The street and the machine's body come from a baked Blender scene loaded
// on demand (noir-street.ts); the gumballs, plate, gum, and ticket live here.

const ENTER_SECONDS = 2.3;
const CRANK_SECONDS = 0.9;
const DROP_AT = 0.6;
const DROP_SECONDS = 0.6;
const TICKET_AT = 1.1;
const TICKET_SECONDS = 0.45;
const LEAN_AT = 1.45;
const GUMBALLS = 46;
const GUM_RADIUS = 0.075;
const GLOBE_RADIUS = 0.55;
const GLOBE_Y = 2.15;
/** Behind the machine until the sky panorama arrives. */
const NIGHT = '#1a0d0b';

interface Framing {
  fov: number;
  size: { width: number; height: number };
  region: { width: number; height: number; x: number; y: number };
  /**
   * Degrees the camera tips up, so the sky and the worm fill the top of the
   * frame. It is applied after frameBox, so the machine sits lower than
   * `region` says; region and pitch were tuned together for the framing.
   */
  pitch: number;
}

/**
 * The machine's framing, wide and tall. Must match WIDE and TALL in
 * art/noir-street/build.py, which bakes the street's reflections from here.
 */
const WIDE: Framing = {
  fov: 46,
  size: { width: 4.6, height: 3.9 },
  region: { width: 0.9, height: 0.7, x: 0, y: 0.25 },
  pitch: 5,
};
const TALL: Framing = {
  fov: 56,
  size: { width: 2.3, height: 3.6 },
  region: { width: 0.94, height: 0.66, x: 0, y: 0.2 },
  pitch: 4,
};

/** One gum color per page, matching its neon sign (NEON in noir-street.ts); the link bar reuses them. */
const GUM_COLORS: Readonly<Record<GameSectionId, string>> = { home: '#efe2c8', story: '#e04a3f' };
const gumColors = new Map<string, string>(Object.entries(GUM_COLORS));

export function gumColor(id: string): string {
  return gumColors.get(id) ?? '#f4ead8';
}

interface MachineCallbacks extends MenuCallbacks {
  /** The visitor pressed the machine itself; the menu decides which gum. */
  onMachine: (plateId: string | null) => void;
  /** The street failed to load, so the menu can't run here. */
  onFail: () => void;
}

/** Deterministic noise, so the gumballs sit the same way every visit. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function ease(t: number): number {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

export class GumballScene extends MenuScene {
  private readonly targets: readonly MenuTarget[];
  private readonly machine = new THREE.Group();
  private readonly gumballs: THREE.InstancedMesh;
  private readonly gumIndex: number[] = [];
  private readonly gum: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private readonly ticket: THREE.Sprite;
  private readonly plate: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly pointer = new THREE.Vector2();
  private readonly home = new THREE.Vector3();
  private readonly drift = new THREE.Vector3();
  private readonly enterFrom = new THREE.Vector3();
  private readonly enterTo = new THREE.Vector3();
  private readonly chute = new THREE.Vector3(0, 1.0, 0.47);
  private readonly tray = new THREE.Vector3(0, 1.03, 0.62);
  private readonly color = new THREE.Color();
  private readonly callbacksWithMachine: MachineCallbacks;
  private readonly container: HTMLElement;
  /** The loaded street; null until it arrives. */
  private street: NoirStreet | null = null;
  /** Stands in for the crank until the street arrives. */
  private crank = new THREE.Object3D();
  private effects: boolean;
  private readonly quality: Quality;
  /** The camera's upward tip at rest, in radians; the lean into the tray levels it. */
  private pitch = 0;
  private gone = false;
  /** With reduced motion the scene draws only when something changed. */
  private stale = true;
  /** The page the name plate shows; during a roll it waits for the ticket. */
  private plateId: string | null;
  private ticketFor: string | null = null;

  constructor(
    container: HTMLElement,
    targets: readonly MenuTarget[],
    callbacks: MachineCallbacks,
    options: { reducedMotion: boolean; selected: string | null; effects: boolean; quality: Quality },
  ) {
    super(container, callbacks, options.reducedMotion);
    this.container = container;
    this.targets = targets;
    this.callbacksWithMachine = callbacks;
    this.plateId = options.selected;
    this.effects = options.effects;
    this.quality = options.quality;
    this.scene.background = new THREE.Color(NIGHT);
    this.addLights();
    this.gumballs = this.buildGumballs();
    this.gum = new THREE.Mesh(
      new THREE.SphereGeometry(GUM_RADIUS * 1.15, 24, 16),
      new THREE.MeshStandardMaterial({ roughness: 0.3, emissive: '#000000' }),
    );
    this.gum.visible = false;
    this.scene.add(this.gum);
    this.ticket = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    this.ticket.visible = false;
    this.ticket.renderOrder = 4;
    this.scene.add(this.ticket);
    this.plate = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.2), new THREE.MeshBasicMaterial({ transparent: true }));
    this.plate.position.set(0, 1.47, 0.425);
    this.machine.add(this.plate);
    this.scene.add(this.machine);
    this.tintGumballs();
    this.canvas.addEventListener('pointermove', (event) => this.handleHover(event), { signal: this.signal });
    this.canvas.addEventListener('click', (event) => this.handleClick(event), { signal: this.signal });
    this.start();
    this.loadStreet();
  }

  select(id: string): void {
    if (this.entering !== null || !this.targets.some((target) => target.id === id)) {
      return;
    }
    this.showOnPlate(id);
  }

  enter(id: string): boolean {
    const target = this.targets.find((candidate) => candidate.id === id);
    if (target === undefined || !this.beginEnter(id, ENTER_SECONDS)) {
      return false;
    }
    this.gum.material.color.set(gumColor(id));
    this.gum.material.emissive.set(gumColor(id)).multiplyScalar(0.25);
    this.drawTicket(target);
    this.enterFrom.copy(this.camera.position);
    this.enterTo.set(this.tray.x, this.tray.y + 0.2, this.tray.z + 1.15);
    if (this.reducedMotion) {
      // No crank or drop: the gum and its ticket are simply there.
      this.placeGum(1, 1);
      this.showOnPlate(id);
      this.finishEnter();
    }
    return true;
  }

  /** Turns the bloom and the weather on or off; the street and machine stay as they are. */
  setEffects(on: boolean): void {
    this.effects = on;
    this.street?.setEffects(on);
    this.street?.setSize(this.width, this.height);
    this.stale = true;
  }

  override resize(): void {
    super.resize();
    this.street?.setSize(this.width, this.height);
    this.stale = true;
  }

  override dispose(): void {
    this.gone = true;
    this.street?.dispose();
    super.dispose();
  }

  protected layout(aspect: number): void {
    // Wider than the stage's usual region at the bottom, so the link bar sits on the plaza.
    const framing = aspect < 0.9 ? TALL : WIDE;
    this.camera.fov = framing.fov;
    this.camera.updateProjectionMatrix();
    this.frameBox(new THREE.Vector3(0, 1.75, 0), framing.size, framing.region);
    this.pitch = THREE.MathUtils.degToRad(framing.pitch);
    this.camera.rotation.set(this.pitch, 0, 0);
    this.home.copy(this.camera.position);
  }

  protected redrawText(): void {
    this.showOnPlate(this.plateId);
    this.ticketFor = null;
    const entering = this.entering;
    const target = this.targets.find((candidate) => candidate.id === entering?.id);
    if (target !== undefined) {
      this.drawTicket(target);
    }
  }

  protected override draw(): void {
    // Nothing to show until the street arrives; the poster fills in meanwhile.
    if (this.street === null || (this.reducedMotion && !this.stale)) {
      return;
    }
    this.stale = false;
    this.street.render(this.camera);
  }

  protected update(now: number, delta: number): void {
    this.street?.update(now, this.reducedMotion);
    const entering = this.entering;
    if (entering === null) {
      this.crank.rotation.z = THREE.MathUtils.damp(this.crank.rotation.z, 0, 6, delta);
      this.gum.visible = false;
      this.ticket.visible = false;
      if (this.reducedMotion) {
        this.camera.position.copy(this.home);
        this.camera.rotation.x = this.pitch;
      } else {
        this.drift.set(this.home.x + this.pointer.x * 0.15, this.home.y + this.pointer.y * 0.08, this.home.z);
        this.camera.position.lerp(this.drift, 0.05);
        // Back to the resting tip after a lean into the tray.
        this.camera.rotation.x = THREE.MathUtils.damp(this.camera.rotation.x, this.pitch, 4, delta);
      }
      return;
    }
    if (this.reducedMotion) {
      return;
    }
    const t = now - entering.at;
    this.crank.rotation.z = -ease(t / CRANK_SECONDS) * Math.PI * 2;
    this.placeGum((t - DROP_AT) / DROP_SECONDS, (t - TICKET_AT) / TICKET_SECONDS);
    if (t >= TICKET_AT && this.plateId !== entering.id) {
      this.showOnPlate(entering.id);
    }
    const lean = ease((t - LEAN_AT) / (ENTER_SECONDS - LEAN_AT));
    this.camera.position.lerpVectors(this.enterFrom, this.enterTo, lean);
    this.camera.rotation.x = this.pitch * (1 - lean);
    if (t >= ENTER_SECONDS) {
      this.finishEnter();
    }
  }

  /** Fetches the street; the stage shows a poster frame until it is in. */
  private loadStreet(): void {
    const { container } = this;
    // The poster shows at once, before the scene's code or files arrive.
    container.style.backgroundImage = `url(/scenes/noir-street/${this.camera.aspect < 0.9 ? 'poster-tall' : 'poster-wide'}.webp)`;
    container.dataset['loading'] = 'true';
    void import('./noir-street')
      .then(
        async ({ NoirStreet }) => {
          const street = await NoirStreet.load(this.scene, this.renderer, this.quality, this.effects, this.signal);
          if (street === null) {
            return;
          }
          if (this.gone) {
            street.dispose();
            return;
          }
          this.street = street;
          // The switch may have changed while the files were loading.
          street.setEffects(this.effects);
          this.crank = street.machine.crank;
          this.machine.add(...street.machine.meshes);
          this.stale = true;
          this.resize();
          this.showOnPlate(this.plateId);
          delete container.dataset['loading'];
        },
        () => {
          throw new Error('The street failed to load.');
        },
      )
      .catch(() => {
        if (!this.gone) {
          this.callbacksWithMachine.onFail();
        }
      });
  }

  /** Places the dropped gum along its roll and the ticket along its pop, both 0 to 1. */
  private placeGum(drop: number, pop: number): void {
    if (drop <= 0) {
      this.gum.visible = false;
      this.ticket.visible = false;
      return;
    }
    const d = THREE.MathUtils.clamp(drop, 0, 1);
    this.gum.visible = true;
    this.gum.position.lerpVectors(this.chute, this.tray, ease(d));
    // Out of the chute in a small arc, then one bounce in the tray.
    this.gum.position.y +=
      d < 0.7 ? Math.sin((d / 0.7) * Math.PI) * 0.05 : Math.sin(((d - 0.7) / 0.3) * Math.PI) * 0.025;
    this.gum.rotation.x = d * 6;
    const p = ease(pop);
    this.ticket.visible = p > 0;
    this.ticket.position.set(this.tray.x, this.tray.y + 0.16 + p * 0.14, this.tray.z + 0.06);
    this.ticket.scale.set(0.62 * p, 0.2 * p, 1);
    this.stale = true;
  }

  private showOnPlate(id: string | null): void {
    // The plate is the one record of the chosen page; the link bar follows it.
    const changed = id !== this.plateId;
    this.plateId = id;
    if (changed && id !== null) {
      this.callbacks.onSelect(id);
    }
    const target = this.targets.find((candidate) => candidate.id === id);
    const here = id !== null && id === this.current;
    const { display, type } = this.fonts;
    const texture = canvasTexture(512, 156, (ctx) => {
      ctx.fillStyle = '#2a0b0b';
      ctx.fillRect(0, 0, 512, 156);
      ctx.strokeStyle = '#c8954a';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, 500, 144);
      ctx.fillStyle = '#c8954a';
      ctx.font = `400 22px ${type}`;
      ctx.fillText(here ? 'YOU ARE HERE' : 'TURN FOR', 28, 44);
      if (target !== undefined) {
        ctx.fillStyle = gumColor(target.id);
        ctx.beginPath();
        ctx.arc(462, 92, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4ead8';
        ctx.font = `400 60px ${display}`;
        ctx.fillText(target.title.toUpperCase(), 28, 112, 400);
      }
    });
    this.plate.material.map?.dispose();
    this.plate.material.map = texture;
    this.plate.material.needsUpdate = true;
    this.tintGumballs();
    this.street?.highlight(id);
    this.stale = true;
  }

  private drawTicket(target: MenuTarget): void {
    if (this.ticketFor === target.id && this.ticket.material.map !== null) {
      return;
    }
    this.ticketFor = target.id;
    const { display, type } = this.fonts;
    const texture = canvasTexture(512, 166, (ctx) => {
      ctx.fillStyle = '#f1e6cf';
      ctx.fillRect(0, 0, 512, 166);
      ctx.fillStyle = '#c8b894';
      for (let x = 8; x < 512; x += 16) {
        ctx.fillRect(x, 0, 8, 4);
        ctx.fillRect(x, 162, 8, 4);
      }
      ctx.fillStyle = '#7a1a14';
      ctx.font = `400 22px ${type}`;
      ctx.textAlign = 'center';
      ctx.fillText('YOUR PAGE', 256, 42);
      ctx.fillStyle = '#1a1210';
      ctx.font = `400 70px ${display}`;
      ctx.fillText(target.title.toUpperCase(), 256, 122, 470);
    });
    this.ticket.material.map?.dispose();
    this.ticket.material.map = texture;
    this.ticket.material.needsUpdate = true;
    this.stale = true;
  }

  /** Brightens the gumballs of the page on the plate and dims the rest. */
  private tintGumballs(): void {
    const chosen = this.targets.findIndex((target) => target.id === this.plateId);
    for (let i = 0; i < this.gumIndex.length; i++) {
      const page = this.gumIndex[i] ?? 0;
      this.color
        .set(gumColor(this.targets[page]?.id ?? ''))
        .multiplyScalar(chosen === -1 || page === chosen ? 1 : 0.45);
      this.gumballs.setColorAt(i, this.color);
    }
    if (this.gumballs.instanceColor !== null) {
      this.gumballs.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Light for the live machine, placed as the bake's lights are: the pillar's
   * arm lamp, a warm fill from the front, the burning sky behind, and a touch
   * of the teal neon across the plaza. The street's own light is baked.
   */
  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight('#6a3a2a', '#0a0708', 0.45));
    const lamp = new THREE.PointLight('#ffcf94', 5, 6, 1.6);
    lamp.position.set(-0.73, 3.3, 0.72);
    const fill = new THREE.PointLight('#ffe2c0', 3.5, 7, 1.6);
    fill.position.set(1.8, 3.2, 3.0);
    const sky = new THREE.PointLight('#ff6a2a', 5, 7, 1.4);
    sky.position.set(0.6, 3.2, -2.4);
    const neon = new THREE.PointLight('#3fd8c8', 1.6, 7, 1.4);
    neon.position.set(2.6, 2.6, -1.2);
    this.scene.add(lamp, fill, sky, neon);
  }

  /** The gumballs inside the globe, one color per page, so the plate's page can stand out. */
  private buildGumballs(): THREE.InstancedMesh {
    const balls = new THREE.InstancedMesh(
      new THREE.SphereGeometry(GUM_RADIUS, 16, 12),
      new THREE.MeshStandardMaterial({ roughness: 0.32 }),
      GUMBALLS,
    );
    const random = seeded(7);
    const matrix = new THREE.Matrix4();
    const spot = new THREE.Vector3();
    let placed = 0;
    // Fill the lower part of the globe; overlapping a little reads as a pile.
    for (let tries = 0; placed < GUMBALLS && tries < 4000; tries++) {
      spot.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).multiplyScalar(GLOBE_RADIUS - GUM_RADIUS * 1.1);
      if (spot.length() > GLOBE_RADIUS - GUM_RADIUS * 1.1 || spot.y > 0.12) {
        continue;
      }
      matrix.setPosition(spot.x, GLOBE_Y + spot.y, spot.z);
      balls.setMatrixAt(placed, matrix);
      this.gumIndex.push(placed % this.targets.length);
      placed++;
    }
    balls.count = placed;
    this.machine.add(balls);
    return balls;
  }

  private pickMachine(event: MouseEvent): boolean {
    this.raycaster.setFromCamera(this.pointerToNdc(event, new THREE.Vector2()), this.camera);
    return this.raycaster.intersectObject(this.machine, true).length > 0;
  }

  private handleHover(event: PointerEvent): void {
    this.pointerToNdc(event, this.pointer);
    if (this.entering === null) {
      this.canvas.style.cursor = this.pickMachine(event) ? 'pointer' : 'default';
    }
  }

  private handleClick(event: MouseEvent): void {
    if (event.button !== 0 || this.entering !== null || !this.pickMachine(event)) {
      return;
    }
    this.callbacksWithMachine.onMachine(this.plateId);
  }
}
