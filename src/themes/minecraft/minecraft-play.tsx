'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { type GameSection, type GameSectionId, sectionHref } from '@/site/sections';
import type { PlayProps } from '../play-layer';
import { type Engine, startEngine, webglAvailable } from './engine';
import { paintAtlas, paintBlockIcon, T } from './textures';
import { BLOCKS, type BlockId, LANDMARKS } from './world';

const SECTION_ICON_TILES: Record<GameSectionId, readonly [number, number]> = {
  home: [T.lantern, T.paver],
  story: [T.codeOre, T.codeOre],
};

const gameSectionIds: readonly GameSectionId[] = ['home', 'story'];

const STICK_RADIUS = 44;

function paintIcons() {
  const atlas = paintAtlas();
  const sections = new Map<GameSectionId, string>();
  for (const id of gameSectionIds) {
    const [top, side] = SECTION_ICON_TILES[id];
    sections.set(id, paintBlockIcon(atlas, top, side));
  }
  return { atlas, sections };
}

function find(sections: readonly GameSection[], id: GameSectionId): GameSection | undefined {
  return sections.find((candidate) => candidate.id === id);
}

// Escape closes the open page only from the page itself, the world, or nowhere in particular.
function inPageOrGame(target: EventTarget | null): boolean {
  return (
    target === document.body ||
    (target instanceof Element && target.closest('#content, .blocks-world, .blocks-hotbar, .blocks-close') !== null)
  );
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement
  );
}

export function MinecraftPlay({ sections, reducedMotion, onFail }: PlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const current = sections.find((section) => section.href === sectionHref(pathname));
  const hrefFor = (section: GameSectionId) => find(sections, section)?.href ?? '/';
  const labelOf = (section: GameSectionId) => find(sections, section)?.label ?? section;
  const onPage = current?.id !== 'home';

  const hostRef = useRef<HTMLDivElement>(null);
  const hotbarRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const labelRefs = useRef(new Map<GameSectionId, HTMLElement>());
  const stickRef = useRef<{ x: number; y: number } | null>(null);

  const [supported] = useState(webglAvailable);
  const [icons] = useState(paintIcons);
  const [nearby, setNearby] = useState<GameSectionId | null>(null);
  const [held, setHeld] = useState<BlockId | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const heldIcon = useMemo(() => {
    if (held === null) {
      return null;
    }
    const [top, side] = BLOCKS[held].tiles;
    return paintBlockIcon(icons.atlas, top, side);
  }, [held, icons]);

  const reportFailure = useEffectEvent(() => onFail());

  const openSection = useEffectEvent((section: GameSectionId) => {
    router.push(hrefFor(section));
  });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!supported) {
      reportFailure();
      return undefined;
    }
    if (host === null || canvas === null) {
      return undefined;
    }
    let engine: Engine;
    try {
      engine = startEngine(host, canvas, {
        reducedMotion,
        onNearby: setNearby,
        onArrive: (section) => openSection(section),
        onHeld: setHeld,
        labelFor: (section) => labelRefs.current.get(section) ?? null,
      });
    } catch {
      reportFailure();
      return undefined;
    }
    engineRef.current = engine;
    return () => {
      engineRef.current = null;
      engine.dispose();
    };
  }, [supported, reducedMotion]);

  // Opening a page pauses the world and stands the player at its door, so
  // closing the page drops them back where that page lives.
  useEffect(() => {
    const engine = engineRef.current;
    if (engine === null) {
      return;
    }
    if (current !== undefined && current.id !== 'home') {
      engine.placeAt(current.id);
    }
    engine.setPaused(onPage);
  }, [current, onPage, supported, reducedMotion]);

  // Opening a page moves focus to it so it can be read and scrolled; closing
  // it returns focus to the world. The first render leaves focus alone.
  const wasOnPage = useRef<boolean | null>(null);
  useEffect(() => {
    const previous = wasOnPage.current;
    wasOnPage.current = onPage;
    if (previous === null || previous === onPage) {
      return;
    }
    if (onPage) {
      document.getElementById('content')?.focus({ preventScroll: true });
    } else {
      hostRef.current?.focus({ preventScroll: true });
    }
  }, [onPage]);

  const travel = (section: GameSectionId) => {
    const engine = engineRef.current;
    if (engine === null || onPage || reducedMotion) {
      router.push(hrefFor(section));
      return;
    }
    engine.walkTo(section);
  };

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const inGame =
      event.target instanceof Node &&
      (hostRef.current?.contains(event.target) === true || hotbarRef.current?.contains(event.target) === true);
    const digit = inGame ? /^Digit([1-9])$/.exec(event.code)?.[1] : undefined;
    const section = digit === undefined ? undefined : sections[Number(digit) - 1];
    if (section !== undefined) {
      event.preventDefault();
      travel(section.id);
    } else if (event.key === 'Escape' && onPage && inPageOrGame(event.target)) {
      router.push('/');
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const releaseStick = () => {
    stickRef.current = null;
    setKnob({ x: 0, y: 0 });
    engineRef.current?.setMoveInput(0, 0);
  };

  return (
    <>
      <div
        ref={hostRef}
        className="blocks-world"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the world is a keyboard-driven widget and needs focus to receive movement keys
        tabIndex={0}
        role="application"
        aria-label="Minecraft-inspired world"
        aria-describedby="blocks-help"
      >
        <canvas ref={canvasRef} className="blocks-world__canvas" aria-hidden="true" />
        <div className="blocks-world__crosshair" aria-hidden="true" />
        <div className="blocks-world__labels" aria-hidden="true">
          {LANDMARKS.map((landmark) => (
            <span
              key={landmark.section}
              className="blocks-world__label"
              ref={(element) => {
                if (element !== null) {
                  labelRefs.current.set(landmark.section, element);
                } else {
                  labelRefs.current.delete(landmark.section);
                }
              }}
            >
              {landmark.section === 'home' ? 'Spawn' : labelOf(landmark.section)}
            </span>
          ))}
        </div>
      </div>

      <p id="blocks-help" className="blocks-help">
        Click the world or tab to it, then walk with WASD or the arrow keys and drag to look. Press E at a door to open
        it, or press 1 to {sections.length} or pick a page from the hotbar to walk there. Click a block to mine it,
        right-click to place it, and press R to rebuild the world.
      </p>

      {nearby !== null && !onPage ? (
        <button type="button" className="blocks-prompt" onClick={() => engineRef.current?.enterNearby()}>
          Open {labelOf(nearby)} <kbd>E</kbd>
        </button>
      ) : null}

      {onPage ? (
        <Link href="/" className="blocks-close">
          Back to the world <kbd>Esc</kbd>
        </Link>
      ) : null}

      <div className="blocks-touch" aria-hidden="true">
        <div
          className="blocks-touch__stick"
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            stickRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const origin = stickRef.current;
            if (origin === null) {
              return;
            }
            const dx = event.clientX - origin.x;
            const dy = event.clientY - origin.y;
            const length = Math.max(STICK_RADIUS, Math.hypot(dx, dy));
            const x = (dx / length) * STICK_RADIUS;
            const y = (dy / length) * STICK_RADIUS;
            setKnob({ x, y });
            engineRef.current?.setMoveInput(x / STICK_RADIUS, -y / STICK_RADIUS);
          }}
          onPointerUp={releaseStick}
          onPointerCancel={releaseStick}
        >
          <span className="blocks-touch__knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
        <button
          type="button"
          tabIndex={-1}
          className="blocks-touch__jump"
          onPointerDown={() => engineRef.current?.jump()}
        >
          Jump
        </button>
      </div>

      <nav ref={hotbarRef} aria-label="Hotbar" className="blocks-hotbar">
        {sections.map((section, index) => (
          <Link
            key={section.id}
            href={section.href}
            className="blocks-hotbar__slot"
            aria-current={current?.id === section.id ? 'page' : undefined}
            onClick={(event) => {
              const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
              if (!modified && !onPage && !reducedMotion) {
                event.preventDefault();
                travel(section.id);
              }
            }}
          >
            <span
              className="blocks-hotbar__icon"
              aria-hidden="true"
              style={{ backgroundImage: `url(${icons.sections.get(section.id) ?? ''})` }}
            />
            <span className="blocks-hotbar__key" aria-hidden="true">
              {index + 1}
            </span>
            <span className="blocks-hotbar__name">{section.label}</span>
          </Link>
        ))}
        <span className="blocks-hotbar__slot blocks-hotbar__slot--held" aria-hidden="true" title="Mined block">
          {heldIcon === null ? null : (
            <span className="blocks-hotbar__icon" style={{ backgroundImage: `url(${heldIcon})` }} />
          )}
        </span>
      </nav>
    </>
  );
}
