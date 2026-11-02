'use client';

import { useSyncExternalStore } from 'react';
import {
  type ColorMode,
  type GameThemeId,
  isColorMode,
  isThemeId,
  type PlayPreference,
  resolvePlay,
  storageKeys,
  type ThemeId,
} from './registry';

export interface ThemeState {
  readonly theme: ThemeId;
  readonly colorMode: ColorMode;
  readonly play: boolean;
  readonly reducedMotion: boolean;
  /** A game theme whose gameplay could not run in this browser during this visit. */
  readonly failed: GameThemeId | null;
}

interface Choices {
  theme: ThemeId;
  colorMode: ColorMode;
  play: PlayPreference;
}

const serverState: ThemeState = {
  theme: 'default',
  colorMode: 'system',
  play: false,
  reducedMotion: false,
  failed: null,
};
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

const listeners = new Set<() => void>();
// The visitor's choices live here, so they apply for the visit even when storage refuses them.
const memory: {
  choices?: Choices;
  failed: ThemeState['failed'];
  snapshot?: ThemeState;
  media?: MediaQueryList;
} = { failed: null };

// One list for the visit, so the listener is removed from the list it was added to.
function reducedMotionMedia(): MediaQueryList {
  memory.media ??= window.matchMedia(reducedMotionQuery);
  return memory.media;
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private windows can refuse storage; the in-memory choice still applies to this visit.
  }
}

function readChoices(): Choices {
  const theme = readStorage(storageKeys.theme);
  const colorMode = readStorage(storageKeys.colorMode);
  const play = readStorage(storageKeys.play);
  return {
    theme: isThemeId(theme) ? theme : 'default',
    colorMode: isColorMode(colorMode) ? colorMode : 'system',
    play: play === 'on' || play === 'off' ? play : 'auto',
  };
}

function choices(): Choices {
  memory.choices ??= readChoices();
  return memory.choices;
}

function computeState(): ThemeState {
  const { theme, colorMode, play } = choices();
  const reducedMotion = reducedMotionMedia().matches;
  return {
    theme,
    colorMode,
    reducedMotion,
    failed: memory.failed,
    play: theme !== memory.failed && resolvePlay(theme, play, reducedMotion),
  };
}

function publish(): void {
  const next = computeState();
  const root = document.documentElement;
  root.setAttribute('data-theme', next.theme);
  root.setAttribute('data-color-mode', next.colorMode);
  root.setAttribute('data-play', next.play ? 'on' : 'off');
  memory.snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

function onStorage(event: StorageEvent): void {
  // A choice made in another tab applies here too.
  if (event.key === null || (Object.values(storageKeys) as string[]).includes(event.key)) {
    memory.choices = readChoices();
    publish();
  }
}

function subscribe(listener: () => void): () => void {
  const media = reducedMotionMedia();
  if (listeners.size === 0) {
    media.addEventListener('change', publish);
    window.addEventListener('storage', onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      media.removeEventListener('change', publish);
      window.removeEventListener('storage', onStorage);
    }
  };
}

function getSnapshot(): ThemeState {
  memory.snapshot ??= computeState();
  return memory.snapshot;
}

/** The active theme, color mode and gameplay state. Server renders report the defaults. */
export function useThemeState(): ThemeState {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverState);
}

export function setTheme(theme: ThemeId): void {
  choices().theme = theme;
  writeStorage(storageKeys.theme, theme);
  publish();
}

export function setColorMode(mode: ColorMode): void {
  choices().colorMode = mode;
  writeStorage(storageKeys.colorMode, mode);
  publish();
}

/** Turns gameplay on or off by the visitor's choice. Turning it on retries a theme that failed. */
export function setPlay(play: boolean): void {
  choices().play = play ? 'on' : 'off';
  if (play) {
    memory.failed = null;
  }
  writeStorage(storageKeys.play, play ? 'on' : 'off');
  publish();
}

/** Turns gameplay off for a game theme that cannot run here, for this visit only, without changing the visitor's choice. */
export function markGameplayFailed(theme: GameThemeId): void {
  memory.failed = theme;
  publish();
}
