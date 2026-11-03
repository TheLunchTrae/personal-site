// Picks the gumball street's graphics preset for a device the visitor hasn't
// chosen one for. A guess from what the browser reports: the GPU's name where
// it shares one, the device's memory, and whether it is a small touch screen.

export type Quality = 'low' | 'medium' | 'high';

/** GPU names that mean software drawing: always the light preset. */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;
/** Discrete and high-end integrated GPUs, which draw the full preset well. */
const STRONG = /nvidia|geforce|quadro|rtx|radeon (?:rx|pro)|apple m\d+ (?:pro|max|ultra)/i;

function rendererName(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (gl === null) {
      return '';
    }
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name: unknown = gl.getParameter(info === null ? gl.RENDERER : info.UNMASKED_RENDERER_WEBGL);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return typeof name === 'string' ? name : '';
  } catch {
    return '';
  }
}

/** What the browser reports about the device. */
export interface DeviceReport {
  /** The GPU's name, or empty where the browser hides it. */
  gpu: string;
  /** Gigabytes of memory, as navigator.deviceMemory rounds it. */
  memory: number;
  /** A touch screen whose short side is under 820 CSS pixels. */
  smallTouch: boolean;
}

/** The preset for a device: Low when drawing is slow or memory short, High on strong GPUs. */
export function presetFor({ gpu, memory, smallTouch }: DeviceReport): Quality {
  if (SOFTWARE.test(gpu) || smallTouch || memory <= 4) {
    return 'low';
  }
  return STRONG.test(gpu) && memory >= 8 ? 'high' : 'medium';
}

/** The device's preset, worked out on first use; a device doesn't change mid-visit. */
const device: { preset: Quality | null } = { preset: null };

/** The preset for this device, worked out once per visit. */
export function deviceQuality(): Quality {
  if (device.preset !== null) {
    return device.preset;
  }
  const memory = 'deviceMemory' in navigator && typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : 8;
  const smallTouch =
    window.matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) < 820;
  device.preset = presetFor({ gpu: rendererName(), memory, smallTouch });
  return device.preset;
}
