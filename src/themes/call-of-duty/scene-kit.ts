import * as THREE from 'three';

// Shared plumbing for the Call of Duty theme's three menu scenes: one renderer
// per scene on a canvas the scene owns, a frame loop that pauses offscreen,
// font-aware label textures, and full cleanup. Subclasses only build their
// world, lay it out for an aspect ratio, and animate it.

export interface MenuTarget {
  id: string;
  title: string;
}

export interface MenuCallbacks {
  /** The highlighted entry changed, from pointer, drag, or keyboard. */
  onSelect: (id: string) => void;
  /** The visitor committed to an entry and the scene's exit move starts. */
  onEnterStart: (id: string) => void;
  /** The exit move finished; time to navigate. */
  onEnter: (id: string) => void;
}

/** A share of the view: fractions of its size and a center in NDC. */
interface ViewRegion {
  width: number;
  height: number;
  x: number;
  y: number;
}

/**
 * Where a scene may draw inside its stage: clear of the link bar along the
 * bottom and the menu switch at the top.
 */
export function stageRegion(aspect: number): ViewRegion {
  if (aspect < 0.9) {
    return { width: 0.94, height: 0.66, x: 0, y: 0.1 };
  }
  return { width: 0.9, height: 0.7, x: 0, y: 0.12 };
}

/** Fonts the theme loads through next/font, read from its CSS variables. */
interface SceneFonts {
  display: string;
  type: string;
}

function readFont(variable: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

export function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx !== null) {
    draw(ctx);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function disposeMaterial(material: unknown): void {
  if (!(material instanceof THREE.Material)) {
    return;
  }
  if (material instanceof THREE.ShaderMaterial) {
    for (const uniform of Object.values(material.uniforms)) {
      const value: unknown = uniform.value;
      if (value instanceof THREE.Texture) {
        value.dispose();
      }
    }
  } else if (
    material instanceof THREE.MeshBasicMaterial ||
    material instanceof THREE.MeshStandardMaterial ||
    material instanceof THREE.PointsMaterial ||
    material instanceof THREE.SpriteMaterial
  ) {
    material.map?.dispose();
  }
  if (material instanceof THREE.MeshStandardMaterial) {
    material.emissiveMap?.dispose();
  }
  material.dispose();
}

export function disposeTree(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (
      !(
        node instanceof THREE.Mesh ||
        node instanceof THREE.Points ||
        node instanceof THREE.Line ||
        node instanceof THREE.Sprite
      )
    ) {
      return;
    }
    // These classes are generic over any; narrow each part before disposing.
    const geometry: unknown = node.geometry;
    const material: unknown = node.material;
    if (geometry instanceof THREE.BufferGeometry) {
      geometry.dispose();
    }
    const materials: readonly unknown[] = Array.isArray(material) ? material : [material];
    for (const entry of materials) {
      disposeMaterial(entry);
    }
  });
}

export abstract class MenuScene {
  protected readonly renderer: THREE.WebGLRenderer;
  protected readonly scene = new THREE.Scene();
  protected readonly camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 80);
  protected readonly timer = new THREE.Timer();
  protected readonly raycaster = new THREE.Raycaster();
  protected readonly canvas = document.createElement('canvas');
  protected readonly reducedMotion: boolean;
  protected readonly signal: AbortSignal;
  protected readonly fonts: SceneFonts;
  protected width = 1;
  protected height = 1;
  /** The page the visitor is on; its entry reads as "you are here". */
  protected current: string | null = null;
  /** The exit move in progress, from enter() until the next page arrives. */
  protected entering: { id: string; at: number; reported: boolean } | null = null;
  protected readonly callbacks: MenuCallbacks;
  private readonly abort = new AbortController();
  private readonly visibility: IntersectionObserver;
  private frame = 0;
  private enterTimer = 0;
  private running = false;
  private disposed = false;

  /** Throws when WebGL is unavailable; the caller keeps its link fallback. */
  constructor(container: HTMLElement, callbacks: MenuCallbacks, reducedMotion: boolean) {
    const { canvas } = this;
    this.callbacks = callbacks;
    this.reducedMotion = reducedMotion;
    this.signal = this.abort.signal;
    // The scene owns its canvas so a remount never reuses a context that
    // dispose() already released.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'default' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    canvas.className = 'cod-menu-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.prepend(canvas);
    this.timer.connect(document);
    const display = readFont('--font-call-of-duty-title');
    const type = readFont('--font-call-of-duty-type');
    this.fonts = {
      display: `${display === '' ? 'Impact' : display}, Impact, 'Arial Black', sans-serif`,
      type: `${type === '' ? 'ui-monospace' : type}, ui-monospace, monospace`,
    };
    this.visibility = new IntersectionObserver(([entry]) => this.setRunning(entry?.isIntersecting ?? false));
  }

  /** Subclasses call this last in their constructor, once the world exists. */
  protected start(): void {
    // Textures draw text with the theme fonts, which are not preloaded, so
    // redraw once they are ready. A font that fails keeps the fallback face.
    Promise.all([
      document.fonts.load(`400 48px ${this.fonts.display}`),
      document.fonts.load(`400 32px ${this.fonts.type}`),
    ]).then(
      () => {
        if (!this.disposed) {
          this.redrawText();
        }
      },
      () => undefined,
    );
    this.visibility.observe(this.canvas);
    this.resize();
    this.setRunning(true);
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.layout(this.camera.aspect);
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.disposed = true;
    window.clearTimeout(this.enterTimer);
    this.setRunning(false);
    this.visibility.disconnect();
    this.abort.abort();
    this.timer.dispose();
    disposeTree(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  /**
   * Marks the page the visitor is on. The menu stays mounted across pages,
   * so this also ends an exit move once its page has arrived.
   */
  arrive(id: string | null): void {
    this.current = id;
    this.entering = null;
    window.clearTimeout(this.enterTimer);
    if (!this.disposed) {
      this.redrawText();
    }
  }

  /** True from the start of an exit move until the next page arrives. */
  get isEntering(): boolean {
    return this.entering !== null;
  }

  /** Highlights an entry, for keyboard focus and the link bar. */
  abstract select(id: string): void;

  /** Plays the scene's exit move into an entry, then reports onEnter. False when it declined. */
  abstract enter(id: string): boolean;

  protected abstract layout(aspect: number): void;

  protected abstract update(now: number, delta: number): void;

  protected abstract redrawText(): void;

  /** Draws one frame; a scene with its own passes or a still frame overrides this. */
  protected draw(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Starts the exit move toward an entry; false when one is under way. */
  protected beginEnter(id: string, seconds: number): boolean {
    if (this.entering !== null || id === this.current) {
      return false;
    }
    this.entering = { id, at: this.timer.getElapsed(), reported: false };
    this.callbacks.onEnterStart(id);
    // The frame loop pauses offscreen and in hidden tabs, so a timer makes
    // sure the move always ends in navigation.
    this.enterTimer = window.setTimeout(() => this.finishEnter(), seconds * 1000 + 150);
    return true;
  }

  /** Reports a finished exit move once; with reduced motion it is instant. */
  protected finishEnter(): void {
    const entering = this.entering;
    if (entering !== null && !entering.reported) {
      entering.reported = true;
      this.callbacks.onEnter(entering.id);
    }
  }

  protected pointerToNdc(event: MouseEvent, out: THREE.Vector2): THREE.Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    return out.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  /**
   * Moves the camera back until a box of the given size fits inside a region
   * of the view, and aims the box at the region's center. The region is the
   * part of the stage the link bar and menu switch leave free, given as
   * fractions of the view's width and height and a center in normalized
   * device units.
   */
  protected frameBox(center: THREE.Vector3, size: { width: number; height: number }, region: ViewRegion): void {
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const aspect = this.camera.aspect;
    const distance = Math.max(size.height / 2 / (tan * region.height), size.width / 2 / (tan * aspect * region.width));
    this.camera.position.set(
      center.x - region.x * distance * tan * aspect,
      center.y - region.y * distance * tan,
      center.z + distance,
    );
    this.camera.lookAt(this.camera.position.x, this.camera.position.y, center.z);
  }

  private setRunning(running: boolean): void {
    if (running === this.running || (running && this.disposed)) {
      return;
    }
    this.running = running;
    if (running) {
      this.frame = requestAnimationFrame(this.tick);
    } else {
      cancelAnimationFrame(this.frame);
    }
  }

  private readonly tick = (): void => {
    this.frame = requestAnimationFrame(this.tick);
    this.timer.update();
    this.update(this.timer.getElapsed(), Math.min(this.timer.getDelta(), 0.1));
    this.draw();
  };
}
