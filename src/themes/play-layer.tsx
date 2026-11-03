'use client';

import dynamic from 'next/dynamic';
import { Component, type ComponentType, type ReactNode } from 'react';
import { type GameSection, gameSections } from '@/site/sections';
import { gameTheme, type GameThemeId, isGameThemeId } from './registry';
import { focusThemeControl } from './theme-controls';
import { markGameplayFailed, setPlay, useThemeState } from './theme-store';

/** What every game theme's gameplay component receives. docs/themes.md describes the contract. */
export interface PlayProps {
  /** The pages gameplay can reach, in order: the core pages, then the theme's own influence page. */
  readonly sections: readonly GameSection[];
  /** Whether the visitor prefers reduced motion. Gameplay starts only when they turn it on themselves. */
  readonly reducedMotion: boolean;
  /** Turns gameplay off from inside the game. The plain site stays themed. */
  readonly onExit: () => void;
  /** Reports that the game cannot run here, so gameplay turns off for this visit and a notice explains it. */
  readonly onFail: () => void;
}

/*
 * Each game theme's gameplay loads only while that theme is on with gameplay
 * on, through `next/dynamic` with `ssr: false`, so its engine never reaches
 * other visitors. The Record type makes a game theme added to the registry
 * fail to compile until it plugs in here.
 */
const players: Record<GameThemeId, ComponentType<PlayProps>> = {
  minecraft: dynamic(() => import('./minecraft/minecraft-play').then((module) => module.MinecraftPlay), {
    ssr: false,
  }),
  // The runner strip sits in the page flow, so a placeholder holds its height while it loads.
  'geometry-dash': dynamic(() => import('./geometry-dash/dash-play').then((module) => module.DashPlay), {
    ssr: false,
    loading: () => <div className="dash-stage-placeholder" aria-hidden="true" />,
  }),
  'call-of-duty': dynamic(() => import('./call-of-duty/cod-play').then((module) => module.CallOfDutyPlay), {
    ssr: false,
  }),
};

interface BoundaryState {
  readonly failed: boolean;
}

// A game that fails to load or start never takes the page down with it: the
// page renders without the game, and gameplay turns off.
class GameBoundary extends Component<{ readonly children: ReactNode; readonly onFail: () => void }, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override componentDidCatch(): void {
    this.props.onFail();
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/** Mounts the active game theme's gameplay, or a notice while that theme's gameplay could not start. */
export function PlayLayer() {
  const { theme, play, reducedMotion, failed } = useThemeState();
  if (!isGameThemeId(theme)) {
    return null;
  }
  if (failed === theme) {
    return (
      <p className="game-notice" role="status">
        {gameTheme(theme).name} gameplay couldn&apos;t start in this browser, so it&apos;s off. Everything on the site
        works without it.
      </p>
    );
  }
  if (!play) {
    return null;
  }
  const Player = players[theme];
  const fail = () => markGameplayFailed(theme);
  const exit = () => {
    setPlay(false);
    // The game's own controls unmount, so focus moves to the switch that brings them back.
    focusThemeControl('.theme-controls__play');
  };
  const game = <Player sections={gameSections(theme)} reducedMotion={reducedMotion} onExit={exit} onFail={fail} />;
  return (
    <GameBoundary key={theme} onFail={fail}>
      {game}
    </GameBoundary>
  );
}
