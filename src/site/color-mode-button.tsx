'use client';

import { type LucideIcon, Monitor, Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { type ColorMode, colorModeKey, colorModes, isColorMode, nextColorMode } from './color-mode';

const listeners = new Set<() => void>();
// The visitor's choice lives here, so it applies for the visit even when storage refuses it.
const memory: { mode?: ColorMode } = {};

function readStoredMode(): ColorMode {
  try {
    const stored = window.localStorage.getItem(colorModeKey);
    return isColorMode(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function currentMode(): ColorMode {
  memory.mode ??= readStoredMode();
  return memory.mode;
}

function applyColorMode(mode: ColorMode): void {
  memory.mode = mode;
  document.documentElement.setAttribute('data-color-mode', mode);
  for (const listener of listeners) {
    listener();
  }
}

function onStorage(event: StorageEvent): void {
  // A choice made in another tab applies here too.
  if (event.key === null || event.key === colorModeKey) {
    applyColorMode(readStoredMode());
  }
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener('storage', onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('storage', onStorage);
    }
  };
}

/** Sets and stores the color mode. The mode applies for the visit even when storage refuses it. */
export function setColorMode(mode: ColorMode): void {
  try {
    window.localStorage.setItem(colorModeKey, mode);
  } catch {
    // Private windows can refuse storage; the in-memory choice still applies to this visit.
  }
  applyColorMode(mode);
}

const labels = { system: 'System', light: 'Light', dark: 'Dark' } as const satisfies Record<ColorMode, string>;
const icons = { system: Monitor, light: Sun, dark: Moon } as const satisfies Record<ColorMode, LucideIcon>;

/**
 * The color mode button: each press moves to the next mode. It draws all three
 * icons and globals.css shows the one that matches `data-color-mode`, so the
 * right icon shows from first paint, before hydration.
 */
export function ColorModeButton() {
  const mode = useSyncExternalStore(subscribe, currentMode, (): ColorMode => 'system');
  const next = nextColorMode[mode];
  const name = `Colors: ${labels[mode]}. Switch to ${labels[next]}`;
  return (
    <button
      type="button"
      className="icon-button color-mode"
      aria-label={name}
      title={name}
      onClick={() => setColorMode(next)}
    >
      {colorModes.map((option) => {
        const Icon = icons[option];
        return <Icon key={option} className="icon" data-mode={option} strokeWidth={1.5} aria-hidden="true" />;
      })}
    </button>
  );
}
