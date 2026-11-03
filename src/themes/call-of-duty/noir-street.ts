import * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import type { Quality } from './quality';

// The gumball menu's street: a plaza after the Junction, Shadows of Evil's
// first room, modeled and lit in Blender with its lighting baked into textures
// (see art/noir-street). The far skyline, the burning sky, and the giant worm
// are a panorama behind it. The live parts are the ones a bake can't hold:
// neon that brightens for the chosen page, the worm's pulse, rain, ripples,
// lamp haze, mist, steam, and bloom. Loaded on demand, so only the gumball
// menu pays for it.

const BASE = '/scenes/noir-street';

/**
 * Street lamps, from the Blender scene: where each one's light hangs and how
 * wide its haze spreads. The pillar's arm lamp has no haze cone, since its
 * cone would fall over the machine and wash it out; bloom carries its glow.
 */
const LANTERNS = [
  [-6.2, 4.55, -4.2, 1.35],
  [6.6, 4.55, -8.6, 1.35],
  [-7, 4.55, -18.5, 1.35],
  [7.2, 4.55, -24, 1.35],
  [-2.6, 4.55, -35.5, 1.35],
] as const;
const MANHOLE = new THREE.Vector3(2.4, 0, -6);
/** The worm's glowing tip, high over the canal. */
const WORM_TIP = new THREE.Vector3(10.5, 16.9, -66);
/** The pillar's footprint on the plaza, which the ripples keep off. */
const PILLAR = { x: -1.18, z: -0.78, half: 0.7 };

/**
 * The plaza fades toward the sky with distance, as the backdrop panorama
 * was faded when it was rendered. Must match FOG_DENSITY and FOG_MAX in
 * art/noir-street/render.py, or the plaza and the skyline won't meet.
 */
const FOG_DENSITY = 0.018;
const FOG_MAX = 0.35;
/** The crank's hub, the center of its dial (Blender's (0, -0.44, 1.24)). */
const CRANK_HUB = new THREE.Vector3(0, 1.24, 0.44);

/**
 * The neon tubes' colors, keyed by the sign names in the Blender scene. The
 * home and story signs (HOME and OPEN) light up for their pages; the others
 * are scenery that only ever dims.
 */
const NEON: Record<string, string> = {
  home: '#efe2c8',
  about: '#3fd8c8',
  resume: '#f0a35c',
  projects: '#ff4f9a',
  story: '#e04a3f',
};
const NEON_IDLE = 1.6;
const NEON_CHOSEN = 4.2;
const NEON_DIM = 0.9;

interface TierSettings {
  file: string;
  /** The skyline panorama: 4096 wide on High, 2048 otherwise. */
  backdrop: string;
  rain: number;
  ripples: number;
  mist: number;
  steam: number;
  pixelRatio: number;
  samples: number;
}

/**
 * The three graphics presets. Atlases are capped at 1024, 2048, and 4096
 * pixels, and the weather and the pixel ratio scale with them.
 */
const TIERS: Record<Quality, TierSettings> = {
  low: {
    file: 'street-low.glb',
    backdrop: 'backdrop-2k.webp',
    rain: 700,
    ripples: 40,
    mist: 1,
    steam: 3,
    pixelRatio: 1,
    samples: 0,
  },
  medium: {
    file: 'street-medium.glb',
    backdrop: 'backdrop-2k.webp',
    rain: 1500,
    ripples: 100,
    mist: 2,
    steam: 5,
    pixelRatio: 1.5,
    samples: 2,
  },
  high: {
    file: 'street-high.glb',
    backdrop: 'backdrop-4k.webp',
    rain: 2800,
    ripples: 180,
    mist: 3,
    steam: 7,
    pixelRatio: 2,
    // At twice the pixel ratio, more samples cost far more memory than they show.
    samples: 2,
  },
};

/** Deterministic noise, so the rain and mist look the same every visit. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const RAIN_VERTEX = /* glsl */ `
  attribute vec4 drop;
  uniform float time;
  varying float vAlong;
  varying float vFade;
  void main() {
    // drop: x, z, start height, speed. Each streak falls and wraps at the top.
    float height = 9.0;
    float y = mod(drop.z - drop.w * time, height);
    vec3 center = vec3(drop.x, y, drop.y);
    vec4 view = viewMatrix * vec4(center + vec3(0.0, position.y * 0.34, 0.0), 1.0);
    view.x += position.x * 0.012;
    vAlong = position.y + 0.5;
    vFade = exp(-0.06 * -view.z);
    gl_Position = projectionMatrix * view;
  }
`;

const RAIN_FRAGMENT = /* glsl */ `
  uniform float opacity;
  varying float vAlong;
  varying float vFade;
  void main() {
    float streak = smoothstep(0.0, 0.9, vAlong) * (1.0 - smoothstep(0.9, 1.0, vAlong));
    gl_FragColor = vec4(vec3(0.62, 0.72, 0.9) * streak * opacity * vFade, 1.0);
    #include <colorspace_fragment>
  }
`;

const RIPPLE_VERTEX = /* glsl */ `
  attribute vec4 spot;
  uniform float time;
  varying vec2 vUv;
  varying float vAge;
  void main() {
    // spot: x, z, ground height, phase. A ring that widens and fades, then starts again.
    vAge = fract(time * 0.9 + spot.w);
    vUv = position.xy;
    vec3 world = vec3(spot.x + position.x * 0.36, spot.z, spot.y + position.y * 0.36);
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const RIPPLE_FRAGMENT = /* glsl */ `
  uniform float opacity;
  varying vec2 vUv;
  varying float vAge;
  void main() {
    float r = length(vUv) * 2.0;
    float ring = 1.0 - smoothstep(0.0, 0.08, abs(r - vAge));
    float alpha = ring * (1.0 - vAge) * step(r, 1.0) * opacity;
    gl_FragColor = vec4(vec3(0.72, 0.78, 0.9) * alpha, 1.0);
    #include <colorspace_fragment>
  }
`;

const HAZE_VERTEX = /* glsl */ `
  varying float vHeight;
  varying float vEdge;
  varying float vDepth;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vec3 normal = normalize(normalMatrix * normal);
    vEdge = abs(dot(normal, normalize(-view.xyz)));
    vHeight = uv.y;
    vDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

const HAZE_FRAGMENT = /* glsl */ `
  uniform vec3 color;
  uniform float opacity;
  varying float vHeight;
  varying float vEdge;
  varying float vDepth;
  void main() {
    // Brightest under the lantern and through the cone's middle, fading with distance.
    float glow = pow(vHeight, 1.6) * pow(vEdge, 1.8) * exp(-0.035 * vDepth);
    gl_FragColor = vec4(color * glow * opacity, 1.0);
    #include <colorspace_fragment>
  }
`;

const MIST_VERTEX = /* glsl */ `
  varying vec2 vWorld;
  varying float vDepth;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    vec4 view = viewMatrix * world;
    vDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

const MIST_FRAGMENT = /* glsl */ `
  uniform float time;
  uniform float opacity;
  uniform vec3 color;
  varying vec2 vWorld;
  varying float vDepth;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  void main() {
    vec2 p = vWorld * 0.35 + vec2(time * 0.05, time * 0.02);
    float n = noise(p) * 0.6 + noise(p * 2.3 - time * 0.03) * 0.4;
    float near = smoothstep(1.0, 5.0, vDepth) * exp(-0.04 * vDepth);
    gl_FragColor = vec4(color * smoothstep(0.35, 0.9, n) * near * opacity, 1.0);
    #include <colorspace_fragment>
  }
`;

function additive(
  vertexShader: string,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

function puffTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx !== null) {
    const random = seeded(5);
    // A few soft blobs make a lumpy puff rather than a perfect disc.
    for (let i = 0; i < 9; i++) {
      const x = 40 + random() * 48;
      const y = 40 + random() * 48;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 30 + random() * 14);
      gradient.addColorStop(0, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Fades a baked material toward the sky panorama with distance, the same way
 * render.py faded the backdrop. Uses the sky in the view's direction, so the
 * haze is orange low down and dark overhead, as the sky itself is.
 */
function fogToSky(material: THREE.MeshBasicMaterial, sky: THREE.Texture): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms['skyMap'] = { value: sky };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkyDir;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvSkyDir = (modelMatrix * vec4(transformed, 1.0)).xyz - cameraPosition;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D skyMap;\nvarying vec3 vSkyDir;')
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        {
          float distance = length(vSkyDir);
          vec3 dir = vSkyDir / max(distance, 1e-4);
          vec2 skyUv = vec2(atan(dir.z, dir.x) * RECIPROCAL_PI2 + 0.5, asin(clamp(dir.y, -1.0, 1.0)) * RECIPROCAL_PI + 0.5);
          float amount = min(1.0 - exp(-pow(${FOG_DENSITY} * distance, 2.0)), ${FOG_MAX});
          // Mixed in sRGB, as render.py mixes, so dark shapes stay dark through the haze.
          vec3 near = sRGBTransferOETF(vec4(outgoingLight, 1.0)).rgb;
          vec3 far = sRGBTransferOETF(vec4(texture2D(skyMap, skyUv).rgb, 1.0)).rgb;
          outgoingLight = sRGBTransferEOTF(vec4(mix(near, far, amount), 1.0)).rgb;
        }
        #include <opaque_fragment>`,
      );
  };
}

const DOME_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DOME_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    vec2 uv = vec2(atan(dir.z, dir.x) * 0.15915494 + 0.5, asin(clamp(dir.y, -1.0, 1.0)) * 0.31830989 + 0.5);
    gl_FragColor = vec4(texture2D(map, uv).rgb, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * The skyline panorama on a sphere that rides with the camera, drawn first
 * and behind everything. three.js would turn an equirect scene.background
 * into a cube map with faces as tall as the image, about 100 MB for the
 * 4096 panorama; sampling the panorama directly needs only the image.
 */
function backdropDome(map: THREE.Texture): THREE.Mesh {
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 32),
    new THREE.ShaderMaterial({
      vertexShader: DOME_VERTEX,
      fragmentShader: DOME_FRAGMENT,
      uniforms: { map: { value: map } },
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  dome.name = 'Backdrop';
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  // Inside the camera's far plane wherever it moves; depth doesn't matter, since it's drawn first.
  dome.scale.setScalar(40);
  dome.onBeforeRender = (_renderer, _scene, camera) => {
    dome.position.copy(camera.position);
    dome.updateMatrixWorld();
  };
  return dome;
}

function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx !== null) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface MachineParts {
  /** Every mesh of the machine itself, for picking and lighting. */
  meshes: THREE.Object3D[];
  /** The crank, which turns about its own origin. */
  crank: THREE.Object3D;
}

/** The loaded street and its live layers. */
export class NoirStreet {
  readonly machine: MachineParts;
  private readonly root: THREE.Object3D;
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly neon = new Map<string, THREE.MeshBasicMaterial>();
  private readonly timed: THREE.IUniform<number>[] = [];
  private readonly steam: THREE.Sprite[] = [];
  /** Rain, ripples, mist, and steam: the layers the Effects switch hides. */
  private readonly weather = new THREE.Group();
  private readonly environment: THREE.WebGLRenderTarget;
  private readonly backdrop: THREE.Texture;
  private readonly sky: THREE.Texture;
  private readonly wormGlow: THREE.Sprite;
  private readonly settings: TierSettings;
  private composer: EffectComposer | null = null;
  private chosen: string | null = null;
  private effects: boolean;
  private readonly size = new THREE.Vector2(1, 1);

  private constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    gltf: { scene: THREE.Group },
    textures: { environment: THREE.WebGLRenderTarget; backdrop: THREE.Texture; sky: THREE.Texture },
    tier: Quality,
    effects: boolean,
  ) {
    this.scene = scene;
    this.renderer = renderer;
    this.root = gltf.scene;
    this.environment = textures.environment;
    this.backdrop = textures.backdrop;
    this.sky = textures.sky;
    this.settings = TIERS[tier];
    this.effects = effects;
    renderer.getSize(this.size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.settings.pixelRatio));
    scene.environment = this.environment.texture;
    this.root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) {
        return;
      }
      const material: unknown = node.material;
      const name = material instanceof THREE.Material ? material.name : '';
      if (name.startsWith('Baked_') && material instanceof THREE.MeshStandardMaterial) {
        // The bake already holds the light, so draw the atlas as it is, hazed with distance.
        const baked = new THREE.MeshBasicMaterial({ map: material.map, side: THREE.DoubleSide, toneMapped: false });
        fogToSky(baked, this.sky);
        node.material = baked;
        material.dispose();
      } else if (node.name.startsWith('Neon_')) {
        const page = node.name.slice('Neon_'.length);
        const glow = new THREE.MeshBasicMaterial({ color: NEON[page] ?? '#ffffff', toneMapped: false, fog: false });
        node.material = glow;
        this.neon.set(page, glow);
      } else if (node.name.startsWith('LampGlass')) {
        node.material = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#ffd49a').multiplyScalar(2.2),
          toneMapped: false,
        });
      } else if (node.name === 'Machine_Eyes') {
        // The beast on the crest watches with violet eyes, bright enough to bloom.
        node.material = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#c46aff').multiplyScalar(2.6),
          toneMapped: false,
        });
      } else if (node.name === 'Machine_Globe') {
        node.material = new THREE.MeshStandardMaterial({
          color: '#cfe6ff',
          roughness: 0.04,
          transparent: true,
          opacity: 0.16,
          envMapIntensity: 2.4,
          depthWrite: false,
        });
        node.renderOrder = 1;
      }
    });
    // Compression moves each mesh's origin to its bounds' center, so the crank
    // turns inside a pivot set at its hub rather than about its own origin.
    const part = this.root.children.find((node) => node.name === 'Machine_Crank');
    if (part === undefined) {
      throw new Error('The street scene has no crank.');
    }
    const crank = new THREE.Group();
    crank.name = 'Machine_CrankPivot';
    crank.position.copy(CRANK_HUB);
    this.root.add(crank);
    this.root.updateMatrixWorld(true);
    crank.attach(part);
    // Machine parts are whole nodes, the crank's pivot among them.
    const meshes = this.root.children.filter((node) => node.name.startsWith('Machine_'));
    this.machine = { meshes, crank };
    scene.add(this.root);
    this.root.add(this.weather);
    this.root.add(backdropDome(this.backdrop));
    this.wormGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: '#ffd860',
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    this.wormGlow.position.copy(WORM_TIP);
    this.wormGlow.scale.setScalar(9);
    this.wormGlow.renderOrder = 1;
    this.root.add(this.wormGlow);
    this.addHaze();
    this.addRain();
    this.addRipples();
    this.addMist();
    this.addSteam();
    this.highlight(null);
    this.setEffects(effects);
  }

  /**
   * Loads the street for a tier. Aborting the signal cancels the model's
   * download; the load then rejects, or resolves null when the files were
   * already in. Rejects when a file fails to load.
   */
  static async load(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    tier: Quality,
    effects: boolean,
    signal: AbortSignal,
  ): Promise<NoirStreet | null> {
    signal.throwIfAborted();
    // The model is fetched here rather than through GLTFLoader.load, whose
    // FileLoader shares one request per URL across every loader: aborting a
    // street torn down as the next one starts would cancel the next one's
    // download too. The textures load through <img>, which can't be
    // cancelled, but they are small next to the model.
    const file = `${BASE}/${TIERS[tier].file}`;
    const model = fetch(file, { signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`${file} answered ${response.status}.`);
        }
        return response.arrayBuffer();
      })
      .then(async (data) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(data, `${BASE}/`));
    const textures = new THREE.TextureLoader();
    const [gltf, equirect, backdrop, sky] = await Promise.all([
      model,
      textures.loadAsync(`${BASE}/environment.webp`),
      textures.loadAsync(`${BASE}/${TIERS[tier].backdrop}`),
      textures.loadAsync(`${BASE}/sky.webp`),
    ]);
    if (signal.aborted) {
      equirect.dispose();
      backdrop.dispose();
      sky.dispose();
      return null;
    }
    for (const texture of [equirect, backdrop, sky]) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    equirect.mapping = THREE.EquirectangularReflectionMapping;
    // The dome and the fog look these up by direction, so they wrap in
    // longitude and skip mipmaps, which would show a seam where u wraps.
    // Neither is drawn smaller than its size, so mipmaps would buy nothing.
    for (const texture of [backdrop, sky]) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromEquirectangular(equirect);
    equirect.dispose();
    pmrem.dispose();
    try {
      return new NoirStreet(scene, renderer, gltf, { environment, backdrop, sky }, tier, effects);
    } catch (error) {
      scene.environment = null;
      environment.dispose();
      backdrop.dispose();
      sky.dispose();
      throw error;
    }
  }

  /** Brightens the chosen page's sign and dims the others; null lights them all evenly. */
  highlight(page: string | null): void {
    this.chosen = page;
    for (const [id, material] of this.neon) {
      const level = page === null ? NEON_IDLE : id === page ? NEON_CHOSEN : NEON_DIM;
      material.color.set(NEON[id] ?? '#ffffff').multiplyScalar(level);
    }
  }

  /**
   * Turns the bloom and the weather layers on or off; the baked street and neon
   * stay. Off frees the bloom's buffers, which on the high tier are large.
   */
  setEffects(on: boolean): void {
    this.effects = on;
    this.weather.visible = on;
    if (!on) {
      this.freeEffects();
      return;
    }
    if (this.composer === null) {
      // The target starts at CSS size; setSize below applies the pixel ratio once.
      const target = new THREE.WebGLRenderTarget(this.size.x, this.size.y, {
        type: THREE.HalfFloatType,
        samples: this.settings.samples,
      });
      const composer = new EffectComposer(this.renderer, target);
      composer.addPass(new RenderPass(this.scene, new THREE.PerspectiveCamera()));
      // Only the neon and lamp glass run brighter than 1, so the threshold keeps the bloom on them.
      composer.addPass(new UnrealBloomPass(this.size.clone(), 0.55, 0.45, 1.0));
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.setSize(this.size.x, this.size.y);
    }
  }

  /** Sizes the effect buffers to the stage, in CSS pixels. */
  setSize(width: number, height: number): void {
    this.size.set(width, height);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(width, height);
  }

  /** Advances the live layers. A frozen clock (reduced motion) leaves them still. */
  update(now: number, reducedMotion: boolean): void {
    const time = reducedMotion ? 0 : now;
    for (const uniform of this.timed) {
      uniform.value = time;
    }
    // The worm breathes: its tip swells and fades slowly.
    const breath = 0.5 + 0.5 * Math.sin(time * 0.9);
    this.wormGlow.material.opacity = 0.55 + breath * 0.45;
    this.wormGlow.scale.setScalar(8 + breath * 2.5);
    for (const [i, puff] of this.steam.entries()) {
      const age = (time * 0.18 + i / this.steam.length) % 1;
      puff.position.set(MANHOLE.x + Math.sin(i * 2.1 + age * 2) * 0.2, 0.1 + age * 2.6, MANHOLE.z + age * 0.5);
      puff.scale.setScalar(0.6 + age * 2.2);
      puff.material.opacity = Math.sin(age * Math.PI) * 0.3;
    }
    if (!reducedMotion && this.chosen !== null) {
      // The chosen sign hums a little.
      const glow = this.neon.get(this.chosen);
      glow?.color.set(NEON[this.chosen] ?? '#ffffff').multiplyScalar(NEON_CHOSEN + Math.sin(now * 3) * 0.4);
    }
    if (!reducedMotion) {
      // A tired tube that drops out for a beat now and then.
      const home = this.neon.get('home');
      if (home !== undefined && this.chosen !== 'home') {
        const out = Math.sin(now * 2.3) > 0.93 && Math.sin(now * 37) > 0;
        home.color
          .set(NEON['home'] ?? '#ffffff')
          .multiplyScalar(out ? 0.25 : this.chosen === null ? NEON_IDLE : NEON_DIM);
      }
    }
  }

  render(camera: THREE.Camera): void {
    if (this.effects && this.composer !== null) {
      const first = this.composer.passes[0];
      if (first instanceof RenderPass) {
        first.camera = camera;
      }
      this.composer.render();
      return;
    }
    this.renderer.render(this.scene, camera);
  }

  /** Frees what the scene's own cleanup can't reach: the panoramas and the effect targets. */
  dispose(): void {
    this.scene.environment = null;
    this.environment.dispose();
    this.backdrop.dispose();
    this.sky.dispose();
    this.freeEffects();
  }

  /** Frees the effect chain: every pass and both of the composer's targets. */
  private freeEffects(): void {
    for (const pass of this.composer?.passes ?? []) {
      pass.dispose();
    }
    this.composer?.dispose();
    this.composer = null;
  }

  private timedUniform(): THREE.IUniform<number> {
    const uniform = { value: 0 };
    this.timed.push(uniform);
    return uniform;
  }

  private addRain(): void {
    const count = this.settings.rain;
    const random = seeded(31);
    const quad = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index;
    geometry.setAttribute('position', quad.getAttribute('position'));
    const drops = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      // Across the plaza from just behind the machine to the viaduct.
      drops.set([random() * 18 - 9, random() * 27 - 22, random() * 9, 7 + random() * 4], i * 4);
    }
    geometry.setAttribute('drop', new THREE.InstancedBufferAttribute(drops, 4));
    geometry.instanceCount = count;
    const rain = new THREE.Mesh(
      geometry,
      additive(RAIN_VERTEX, RAIN_FRAGMENT, { time: this.timedUniform(), opacity: { value: 0.55 } }),
    );
    rain.frustumCulled = false;
    rain.renderOrder = 3;
    this.weather.add(rain);
  }

  private addRipples(): void {
    const count = this.settings.ripples;
    const random = seeded(43);
    const quad = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index;
    geometry.setAttribute('position', quad.getAttribute('position'));
    const spots = new Float32Array(count * 4);
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 4; tries++) {
      const x = random() * 17 - 8.5;
      const z = random() * 18 - 14;
      // Not on the pillar, or under the machine.
      const onPillar = Math.abs(x - PILLAR.x) < PILLAR.half && Math.abs(z - PILLAR.z) < PILLAR.half;
      if (onPillar || (Math.abs(x) < 0.7 && Math.abs(z) < 0.7)) {
        continue;
      }
      spots.set([x, z, 0.004, random()], placed * 4);
      placed++;
    }
    geometry.setAttribute('spot', new THREE.InstancedBufferAttribute(spots, 4));
    geometry.instanceCount = placed;
    const ripples = new THREE.Mesh(
      geometry,
      additive(RIPPLE_VERTEX, RIPPLE_FRAGMENT, { time: this.timedUniform(), opacity: { value: 0.22 } }),
    );
    ripples.frustumCulled = false;
    ripples.renderOrder = 2;
    this.weather.add(ripples);
  }

  private addHaze(): void {
    // A unit cone, stretched from each lantern down to the ground.
    const geometry = new THREE.ConeGeometry(1, 1, 32, 1, true);
    const material = additive(HAZE_VERTEX, HAZE_FRAGMENT, {
      color: { value: new THREE.Color('#ffc98a') },
      opacity: { value: 0.16 },
    });
    for (const [x, y, z, radius] of LANTERNS) {
      const cone = new THREE.Mesh(geometry, material);
      cone.scale.set(radius, y, radius);
      cone.position.set(x, y / 2, z);
      cone.renderOrder = 2;
      this.root.add(cone);
    }
  }

  private addMist(): void {
    for (let i = 0; i < this.settings.mist; i++) {
      const mist = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 40),
        additive(MIST_VERTEX, MIST_FRAGMENT, {
          time: this.timedUniform(),
          opacity: { value: 0.05 },
          // Ember-lit mist, under a burning sky.
          color: { value: new THREE.Color(i === 1 ? '#b07aa0' : '#c48a6a') },
        }),
      );
      mist.rotation.x = -Math.PI / 2;
      mist.position.set(0, 0.35 + i * 0.6, -15);
      mist.renderOrder = 2;
      this.weather.add(mist);
    }
  }

  private addSteam(): void {
    const texture = puffTexture();
    for (let i = 0; i < this.settings.steam; i++) {
      const puff = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, color: '#9aa6c4', transparent: true, depthWrite: false, opacity: 0 }),
      );
      puff.renderOrder = 2;
      this.steam.push(puff);
      this.weather.add(puff);
    }
  }
}
