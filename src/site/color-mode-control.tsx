'use client';

import { useSyncExternalStore } from 'react';
import { type ColorMode, colorModeKey, colorModes, isColorMode } from './color-mode';

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

const subscribeNever = () => () => undefined;
const labels = { system: 'System', light: 'Light', dark: 'Dark' } as const;

/** The Colors select. Until hydration it would show the server's default, so CSS keeps it hidden. */
export function ColorModeControl() {
  const mode = useSyncExternalStore(subscribe, currentMode, () => 'system');
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  return (
    <label className="color-mode" data-hydrated={hydrated ? '' : undefined}>
      <span>Colors</span>
      <select
        value={mode}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (isColorMode(next)) {
            setColorMode(next);
          }
        }}
      >
        {colorModes.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
