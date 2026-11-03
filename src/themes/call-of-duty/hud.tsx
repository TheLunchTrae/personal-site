'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { type GameSection, sectionHref } from '@/site/sections';
import { playRound, unlockSound } from './audio';
import { roundFor, run as runStore, useRun } from './progress';
import { effects, menuStyle, sound, useChoice } from './settings';

// The Call of Duty theme's heads-up display: the round as tally marks, the
// run's points, and a banner when a new round starts. It decorates a fully
// usable page, so only the round banner is announced to assistive tech.

function Tally({ round }: { round: number }) {
  // Hand-drawn style strokes, four upright and a fifth across, in an original
  // SVG. Past five the round shows as a number.
  if (round > 5) {
    return <span className="hud-round-number">{round}</span>;
  }
  const strokes = ['M6 4 L5 38', 'M15 5 L14 39', 'M24 4 L24 38', 'M33 5 L32 38', 'M1 30 L38 9'];
  return (
    <svg className="hud-tally" viewBox="0 0 40 42" aria-hidden="true">
      {strokes.slice(0, round).map((d) => (
        <path key={d} d={d} className="hud-tally-stroke" />
      ))}
    </svg>
  );
}

export function CallOfDutyHud({ sections, onExit }: { sections: readonly GameSection[]; onExit: () => void }) {
  const path = sectionHref(usePathname());
  const progress = useRun();
  const round = roundFor(progress);
  const soundOn = useChoice(sound) === 'on';
  const effectsOn = useChoice(effects) === 'on';
  // Only the gumball street has post effects to turn off.
  const street = useChoice(menuStyle) === 'machine';
  // Home is where a run starts, so only the other pages count as finds.
  const findable = sections.filter((section) => section.id !== 'home').length;

  useEffect(() => {
    const section = sections.find((candidate) => candidate.id !== 'home' && candidate.href === path);
    if (section !== undefined) {
      runStore.recordVisit(section.id, section.label);
    }
  }, [sections, path]);

  useEffect(() => {
    if (progress.newRound === null) {
      return undefined;
    }
    playRound();
    const timer = window.setTimeout(() => runStore.clearRound(), 3400);
    return () => window.clearTimeout(timer);
  }, [progress.newRound]);

  return (
    <div className="hud" data-hud>
      <div className="hud-round" aria-hidden="true">
        <Tally round={round} />
      </div>
      <div className="hud-side">
        <div className="hud-points" aria-hidden="true">
          <ol className="hud-awards">
            {progress.awards.map((award) => (
              <li key={award.id} className="hud-award">
                +{award.points}
              </li>
            ))}
          </ol>
          <span className="hud-points-value">{progress.points}</span>
        </div>
        <span className="hud-meta">
          Round {round} · Found {progress.visited.length}/{findable}
        </span>
        <div className="hud-actions">
          <button
            type="button"
            className="hud-button"
            aria-pressed={soundOn}
            onClick={() => {
              sound.set(soundOn ? 'off' : 'on');
              unlockSound();
            }}
          >
            Sound
          </button>
          {street ? (
            <button
              type="button"
              className="hud-button"
              aria-pressed={effectsOn}
              onClick={() => effects.set(effectsOn ? 'off' : 'on')}
            >
              Rain &amp; glow
            </button>
          ) : null}
          <button type="button" className="hud-button" onClick={() => runStore.reset()}>
            Reset run
          </button>
          <button type="button" className="hud-button" onClick={onExit}>
            Turn off gameplay
          </button>
        </div>
      </div>
      <div role="status" className="hud-banner" data-visible={progress.newRound !== null}>
        {progress.newRound === null ? null : (
          <>
            <span className="hud-banner-kicker">Round {progress.newRound.round}</span>
            <span className="hud-banner-found">Found: {progress.newRound.found}</span>
          </>
        )}
      </div>
    </div>
  );
}
