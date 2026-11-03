import { useSyncExternalStore } from 'react';

// The Call of Duty theme's run: points earned and sections found. Each new
// section found starts the next round. It lives in localStorage so a run
// survives reloads, and in one store so every HUD piece reads one snapshot.

interface Award {
  id: number;
  points: number;
}

interface Run {
  points: number;
  visited: readonly string[];
  awards: readonly Award[];
  /** Set for a moment when a new round starts, for its banner. */
  newRound: { round: number; found: string } | null;
}

const STORAGE_KEY = 'call-of-duty:run';
const FIND_POINTS = 250;
const ENTER_POINTS = 25;
const AWARD_LIMIT = 3;
const EMPTY: Run = { points: 0, visited: [], awards: [], newRound: null };

export function roundFor(run: Run): number {
  return run.visited.length + 1;
}

/** How many of these sections the run has found; ids saved for pages that are gone don't count. */
export function foundAmong(run: Run, sectionIds: readonly string[]): number {
  return run.visited.filter((id) => sectionIds.includes(id)).length;
}

function parseSaved(raw: string | null): Run {
  try {
    const saved: unknown = JSON.parse(raw ?? 'null');
    if (saved === null || typeof saved !== 'object') {
      return EMPTY;
    }
    const fields = saved as Partial<Record<keyof Run, unknown>>;
    return {
      ...EMPTY,
      points: typeof fields.points === 'number' && Number.isFinite(fields.points) ? fields.points : 0,
      visited: Array.isArray(fields.visited) ? fields.visited.filter((v) => typeof v === 'string') : [],
    };
  } catch {
    return EMPTY;
  }
}

class RunStore {
  private state: Run = EMPTY;
  private loaded = false;
  private nextAwardId = 1;
  private readonly listeners = new Set<() => void>();

  readonly snapshot = (): Run => {
    if (!this.loaded) {
      this.loaded = true;
      try {
        this.state = parseSaved(localStorage.getItem(STORAGE_KEY));
      } catch {
        this.state = EMPTY;
      }
    }
    return this.state;
  };

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** A visit to a section; the first visit to each one starts a new round. */
  recordVisit(sectionId: string, title: string): void {
    const current = this.snapshot();
    if (current.visited.includes(sectionId)) {
      return;
    }
    const next = this.award({ ...current, visited: [...current.visited, sectionId] }, FIND_POINTS);
    this.commit({ ...next, newRound: { round: roundFor(next), found: title } });
  }

  /** Choosing a page from a menu scene. */
  recordEnter(): void {
    this.commit(this.award(this.snapshot(), ENTER_POINTS));
  }

  clearRound(): void {
    this.commit({ ...this.snapshot(), newRound: null });
  }

  reset(): void {
    this.commit(EMPTY);
  }

  private award(current: Run, points: number): Run {
    const awards = [...current.awards, { id: this.nextAwardId++, points }].slice(-AWARD_LIMIT);
    return { ...current, points: current.points + points, awards };
  }

  private commit(next: Run): void {
    this.state = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ points: next.points, visited: next.visited }));
    } catch {
      // The run still works for this visit without storage.
    }
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const run = new RunStore();

export function useRun(): Run {
  return useSyncExternalStore(run.subscribe, run.snapshot, () => EMPTY);
}
