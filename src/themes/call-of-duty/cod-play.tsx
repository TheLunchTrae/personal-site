'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { type GameSection, sectionHref } from '@/site/sections';
import type { PlayProps } from '../play-layer';
import { playEnter, playStatic, playTick, releaseSound, unlockSound } from './audio';
import { GlobeScene } from './globe-scene';
import { GumballScene, gumColor } from './gumball-scene';
import { CallOfDutyHud } from './hud';
import { run } from './progress';
import { deviceQuality, type Quality } from './quality';
import type { MenuCallbacks, MenuScene, MenuTarget } from './scene-kit';
import { effects, MENU_STYLES, menuStyle, QUALITY_OPTIONS, quality, type QualityChoice, useChoice } from './settings';
import { TvWallScene } from './tv-wall-scene';

// Call of Duty gameplay: a menu stage under the header in one of three styles,
// a wall of old TVs, a globe to turn, or a gumball machine on a rainy street,
// plus a round and points HUD. The scenes are decorative canvases
// (aria-hidden); the links and buttons beside them reach every page by
// keyboard, screen reader, and touch.

const NAV_DELAY_MS = 120;

interface MenuProps {
  sections: readonly GameSection[];
  current: string | null;
  reducedMotion: boolean;
  onFail: () => void;
}

function targetsFor(sections: readonly GameSection[]): MenuTarget[] {
  return sections.map((section) => ({ id: section.id, title: section.label }));
}

function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** Arrow keys move focus along a row of links, like a remote's channel keys. */
function moveFocus(event: KeyboardEvent<HTMLElement>): void {
  const row = event.currentTarget.parentElement;
  if (row === null || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
    return;
  }
  const links = [...row.querySelectorAll<HTMLElement>('a, button')];
  const index = links.findIndex((link) => link === document.activeElement);
  const next = links.at((index + (event.key === 'ArrowRight' ? 1 : -1)) % links.length);
  if (next !== undefined) {
    event.preventDefault();
    next.focus();
  }
}

/**
 * Mounts a menu scene on a stage and wires its exit move to navigation. The
 * scene outlives page changes, so each new page is reported to it. Returns
 * the live scene for event handlers, never for rendering.
 */
function useMenuScene<S extends MenuScene>(
  { sections, current, reducedMotion, onFail }: MenuProps,
  build: (node: HTMLDivElement, callbacks: MenuCallbacks, targets: readonly MenuTarget[]) => S,
  onSelect: (id: string) => void,
): { stage: RefObject<HTMLDivElement | null>; scene: RefObject<S | null> } {
  const router = useRouter();
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<S | null>(null);
  const create = useEffectEvent(build);
  const select = useEffectEvent(onSelect);
  const fail = useEffectEvent(onFail);
  const arriveAt = useEffectEvent((built: S) => built.arrive(current));
  const navTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const node = stage.current;
    if (node === null) {
      return undefined;
    }
    const callbacks: MenuCallbacks = {
      onSelect: (id) => select(id),
      onEnterStart: () => {
        node.dataset['entering'] = 'true';
        playEnter();
      },
      onEnter: (id) => {
        const section = sections.find((candidate) => candidate.id === id);
        if (section === undefined) {
          return;
        }
        run.recordEnter();
        window.clearTimeout(navTimer.current);
        navTimer.current = window.setTimeout(() => router.push(section.href), NAV_DELAY_MS);
      },
    };
    let built: S;
    try {
      built = create(node, callbacks, targetsFor(sections));
    } catch {
      // No WebGL: gameplay turns off and the shared notice explains it.
      fail();
      return undefined;
    }
    scene.current = built;
    // A rebuilt scene (reduced motion changed) starts on the open page too.
    arriveAt(built);
    // A press on the menu is a gesture, so saved sound can start from here.
    node.addEventListener('pointerdown', unlockSound);
    node.addEventListener('keydown', unlockSound);
    const observer = new ResizeObserver(() => built.resize());
    observer.observe(node);
    return () => {
      window.clearTimeout(navTimer.current);
      node.removeEventListener('pointerdown', unlockSound);
      node.removeEventListener('keydown', unlockSound);
      observer.disconnect();
      built.dispose();
      scene.current = null;
    };
  }, [reducedMotion, router, sections]);

  useEffect(() => {
    // Another route (the header nav, back) won the race; drop the pending push.
    window.clearTimeout(navTimer.current);
    scene.current?.arrive(current);
    delete stage.current?.dataset['entering'];
  }, [current]);

  return { stage, scene };
}

/** The value once it has held still for a moment, so a spinning globe isn't read out site by site. */
function useSettled(value: string, ms: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

function enterWith(scene: MenuScene | null, id: string, current: string | null, event: MouseEvent): void {
  // A plain activation plays the exit move first; modified clicks (new tab,
  // new window) and the page already open keep normal link behavior.
  if (scene === null || id === current || !isPlainClick(event)) {
    return;
  }
  // Mid-exit, the page already chosen opens; a second click can't race it.
  if (scene.isEntering) {
    event.preventDefault();
    return;
  }
  // Only hold the link back when the scene really plays its exit move.
  if (scene.enter(id)) {
    event.preventDefault();
  }
}

function TvWallMenu(props: MenuProps) {
  const { sections, current, reducedMotion } = props;
  const [selected, setSelected] = useState(sections[0]?.id ?? '');
  const { stage, scene } = useMenuScene(
    props,
    (node, callbacks, targets) => new TvWallScene(node, targets, callbacks, reducedMotion),
    (id) => {
      setSelected(id);
      playStatic();
    },
  );

  return (
    <div ref={stage} className="cod-menu-scene" data-scene="screens">
      <div className="cod-menu-flash" aria-hidden="true" />
      <div className="cod-menu-bar" role="group" aria-label="Channels">
        {sections.map((section, i) => (
          <Link
            key={section.id}
            href={section.href}
            className="cod-menu-link"
            aria-current={section.id === current ? 'page' : undefined}
            data-selected={section.id === selected}
            onKeyDown={moveFocus}
            onFocus={() => {
              scene.current?.select(section.id);
              setSelected(section.id);
            }}
            onMouseEnter={() => {
              scene.current?.select(section.id);
              setSelected(section.id);
            }}
            onClick={(event) => enterWith(scene.current, section.id, current, event)}
          >
            <span className="cod-menu-link-number" aria-hidden="true">
              CH {String(i + 1).padStart(2, '0')}
            </span>
            {section.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function GlobeMenu(props: MenuProps) {
  const { sections, current, reducedMotion } = props;
  const tag = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(sections[0]?.id ?? '');
  const { stage, scene } = useMenuScene(
    props,
    (node, callbacks, targets) =>
      new GlobeScene(
        node,
        targets,
        {
          ...callbacks,
          onAnchor: (x, y, visible) => {
            const label = tag.current;
            if (label !== null) {
              label.style.transform = `translate3d(${x}px, ${y}px, 0)`;
              label.dataset['visible'] = String(visible);
            }
          },
        },
        reducedMotion,
      ),
    (id) => {
      setSelected(id);
      playTick();
    },
  );
  const index = Math.max(
    0,
    sections.findIndex((section) => section.id === selected),
  );
  const shown = sections[index];
  const announced = useSettled(
    shown === undefined ? '' : `Site ${index + 1} of ${sections.length}: ${shown.label}`,
    600,
  );

  const step = (direction: 1 | -1) => {
    const globe = scene.current;
    // Mid-exit the globe holds its course, so the bar keeps showing the page it opens.
    if (globe?.isEntering === true) {
      return;
    }
    const next = globe === null ? sections.at((index + direction) % sections.length)?.id : globe.step(direction);
    if (next !== undefined && next !== null) {
      setSelected(next);
      playTick();
    }
  };

  return (
    <div ref={stage} className="cod-menu-scene" data-scene="globe">
      <div className="cod-menu-flash" aria-hidden="true" />
      <div ref={tag} className="cod-globe-tag" aria-hidden="true">
        <span className="cod-globe-tag-name">{shown?.label}</span>
      </div>
      {shown === undefined ? null : (
        <div className="cod-menu-bar cod-globe-bar" role="group" aria-label="Locations">
          <button type="button" className="cod-globe-step" aria-label="Previous location" onClick={() => step(-1)}>
            <span aria-hidden="true">‹</span>
          </button>
          <p className="sr-only" aria-live="polite">
            {announced}
          </p>
          <div className="cod-globe-info">
            <span className="cod-globe-info-count" aria-hidden="true">
              Site {index + 1} of {sections.length}
            </span>
            <Link
              href={shown.href}
              className="cod-menu-link cod-globe-go"
              aria-current={shown.id === current ? 'page' : undefined}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  step(event.key === 'ArrowRight' ? 1 : -1);
                }
              }}
              onClick={(event) => enterWith(scene.current, shown.id, current, event)}
            >
              {shown.label}
              <span className="cod-globe-go-cue" aria-hidden="true">
                Travel ›
              </span>
            </Link>
          </div>
          <button type="button" className="cod-globe-step" aria-label="Next location" onClick={() => step(1)}>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      )}
    </div>
  );
}

function MachineMenu(props: MenuProps & { quality: Quality }) {
  const { sections, current, reducedMotion, onFail, quality: preset } = props;
  const effectsOn = useChoice(effects) === 'on';
  const start = sections[1]?.id ?? sections[0]?.id ?? '';
  const [selected, setSelected] = useState(start);
  // The last roll; `count` gives each roll its own node in the live region.
  const [rolled, setRolled] = useState<{ label: string; count: number } | null>(null);
  // The scene calls back into the menu long after it was built, so it reads
  // the latest choice through this ref rather than a stale closure.
  const pressMachine = useRef<(plate: string | null) => void>(() => undefined);
  const { stage, scene } = useMenuScene(
    props,
    (node, callbacks, targets) =>
      new GumballScene(
        node,
        targets,
        { ...callbacks, onMachine: (plate) => pressMachine.current(plate), onFail },
        { reducedMotion, selected, effects: effectsOn, quality: preset },
      ),
    (id) => {
      setSelected(id);
      playTick();
    },
  );

  const roll = () => {
    const open = sections.filter((section) => section.id !== current);
    const pick = open[Math.floor(Math.random() * open.length)];
    if (pick !== undefined && scene.current?.enter(pick.id) === true) {
      setRolled((last) => ({ label: pick.label, count: (last?.count ?? 0) + 1 }));
    }
  };

  useEffect(() => {
    pressMachine.current = (plate) => {
      if (scene.current?.isEntering === true) {
        return;
      }
      // The machine turns for the page on its plate; on that page already, it rolls.
      if (plate === null || scene.current?.enter(plate) !== true) {
        roll();
      }
    };
  });

  useEffect(() => {
    scene.current?.setEffects(effectsOn);
  }, [effectsOn, scene]);

  // The scene's plate is the record of the choice; it reports back through onSelect.
  const choose = (id: string) => scene.current?.select(id);

  return (
    <div ref={stage} className="cod-menu-scene" data-scene="machine">
      <div className="cod-menu-flash" aria-hidden="true" />
      <p className="sr-only" aria-live="polite">
        {/* A fresh node per roll, so a screen reader reads a repeat pick again. */}
        {rolled === null ? null : <span key={rolled.count}>The machine picked {rolled.label}</span>}
      </p>
      <div className="cod-menu-bar" role="group" aria-label="Pages">
        {sections.map((section) => (
          <Link
            key={section.id}
            href={section.href}
            className="cod-menu-link"
            aria-current={section.id === current ? 'page' : undefined}
            data-selected={section.id === selected}
            onKeyDown={moveFocus}
            onFocus={() => choose(section.id)}
            onMouseEnter={() => choose(section.id)}
            onClick={(event) => enterWith(scene.current, section.id, current, event)}
          >
            <span className="cod-menu-gum" aria-hidden="true" style={{ background: gumColor(section.id) }} />
            {section.label}
          </Link>
        ))}
        <button type="button" className="cod-menu-link cod-menu-roll" onKeyDown={moveFocus} onClick={roll}>
          Surprise me
        </button>
      </div>
    </div>
  );
}

/** The gumball menu with its graphics presets, which only this menu has. */
function GumballStage(menu: MenuProps) {
  const preset = useChoice(quality);
  // Asked once, when the gumball menu first shows, so the other menus never
  // probe the GPU; a device doesn't change mid-visit.
  const [device] = useState(deviceQuality);
  const resolved = preset === 'auto' ? device : preset;
  const label = (id: QualityChoice) => QUALITY_OPTIONS.find((option) => option.id === id)?.label ?? id;

  return (
    <>
      {/* Outside the menu, so the pressed preset keeps focus while the street reloads. */}
      <div className="cod-menu-switch cod-menu-presets" role="group" aria-label="Graphics">
        <span className="cod-menu-presets-label" aria-hidden="true">
          Graphics
        </span>
        {QUALITY_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="cod-menu-switch-option"
            aria-pressed={preset === option.id}
            onClick={() => quality.set(option.id)}
          >
            {/* Auto says what it picked, so the visitor knows what they're seeing. */}
            {option.id === 'auto' ? `Auto (${label(device)})` : option.label}
          </button>
        ))}
      </div>
      {/* A new preset is a new street, so the gumball menu starts over with it. Keyed on
          the preset in force, so picking the one Auto already chose reloads nothing. */}
      <MachineMenu key={`machine-${resolved}`} {...menu} quality={resolved} />
    </>
  );
}

/** Call of Duty gameplay: pick pages from a TV wall, a globe, or a gumball machine. */
export function CallOfDutyPlay({ sections, reducedMotion, onExit, onFail }: PlayProps) {
  const style = useChoice(menuStyle);
  const path = sectionHref(usePathname());
  const current = sections.find((section) => section.href === path)?.id ?? null;
  const menu: MenuProps = { sections, current, reducedMotion, onFail };

  // Leaving the theme closes its audio, so a background tab never wakes it.
  useEffect(() => releaseSound, []);

  return (
    <section className="cod-menu-stage" data-home={current === 'home'} aria-label="Page menu">
      <div className="cod-menu-switch" role="group" aria-label="Menu style">
        {MENU_STYLES.map((option) => (
          <button
            key={option.id}
            type="button"
            className="cod-menu-switch-option"
            aria-pressed={style === option.id}
            onClick={() => menuStyle.set(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {style === 'screens' ? <TvWallMenu key="screens" {...menu} /> : null}
      {style === 'globe' ? <GlobeMenu key="globe" {...menu} /> : null}
      {style === 'machine' ? <GumballStage key="machine" {...menu} /> : null}
      <CallOfDutyHud sections={sections} onExit={onExit} />
    </section>
  );
}
