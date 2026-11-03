import { useSyncExternalStore } from 'react';

// Small saved choices that belong to the Call of Duty theme alone: which menu
// style the stage shows, whether sound is on, and how the gumball street draws:
// its glow and weather, and its graphics preset. Each one is a single store
// instance so every component reads the same value.

class SavedChoice<T extends string> {
  private value: T;
  private loaded = false;
  private readonly listeners = new Set<() => void>();
  private readonly key: string;
  private readonly options: readonly T[];
  private readonly fallback: T;

  constructor(key: string, options: readonly T[], fallback: T) {
    this.key = key;
    this.options = options;
    this.fallback = fallback;
    this.value = fallback;
  }

  readonly snapshot = (): T => {
    if (!this.loaded) {
      this.loaded = true;
      try {
        const saved = localStorage.getItem(this.key);
        this.value = this.options.find((option) => option === saved) ?? this.fallback;
      } catch {
        this.value = this.fallback;
      }
    }
    return this.value;
  };

  readonly serverSnapshot = (): T => this.fallback;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(value: T): void {
    this.value = value;
    this.loaded = true;
    try {
      localStorage.setItem(this.key, value);
    } catch {
      // The choice still holds for this visit without storage.
    }
    for (const listener of this.listeners) {
      listener();
    }
  }
}

type MenuStyle = 'screens' | 'globe' | 'machine';

export const MENU_STYLES: readonly { id: MenuStyle; label: string }[] = [
  { id: 'screens', label: 'TV wall' },
  { id: 'globe', label: 'Globe' },
  { id: 'machine', label: 'Gumball' },
];

export const menuStyle = new SavedChoice<MenuStyle>('call-of-duty:menu', ['screens', 'globe', 'machine'], 'screens');

// Sound starts off; turning it on is the gesture browsers require for audio.
export const sound = new SavedChoice<'on' | 'off'>('call-of-duty:sound', ['on', 'off'], 'off');

// Glow on the gumball street's neon, plus its rain, mist, and steam. Off makes
// the scene lighter to draw.
export const effects = new SavedChoice<'on' | 'off'>('call-of-duty:effects', ['on', 'off'], 'on');

/** The street's graphics preset; auto lets quality.ts pick one for the device. */
export type QualityChoice = 'auto' | 'low' | 'medium' | 'high';

export const QUALITY_OPTIONS: readonly { id: QualityChoice; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

export const quality = new SavedChoice<QualityChoice>(
  'call-of-duty:quality',
  ['auto', 'low', 'medium', 'high'],
  'auto',
);

export function useChoice<T extends string>(choice: SavedChoice<T>): T {
  return useSyncExternalStore(choice.subscribe, choice.snapshot, choice.serverSnapshot);
}
