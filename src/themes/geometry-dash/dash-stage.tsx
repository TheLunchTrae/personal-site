'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { GameSection } from '@/site/sections';
import { createRun, physics, pressJump, releaseJump, step, type RunState } from './engine';
import { levelSource, parseLevel } from './level';
import { render } from './render';

interface DashStageProps {
  readonly sections: readonly GameSection[];
  readonly currentHref: string;
  readonly onNavigate: (href: string) => void;
  readonly onExit: () => void;
}

/** Keys that jump while the jump button has focus. Space and Enter would otherwise click it. */
const jumpKeys = new Set([' ', 'Enter', 'ArrowUp', 'w', 'W']);

/** The gate of the page being viewed, or -1 on a page gameplay does not reach, so every gate opens. */
function sectionIndex(sections: readonly GameSection[], href: string): number {
  return sections.findIndex((section) => section.href === href);
}

function isJumpKey(event: ReactKeyboardEvent): boolean {
  return jumpKeys.has(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

/**
 * The Geometry Dash theme runner. The runner loops a level; each page has a gate at jump
 * height. Jump through one to open its page. Crashes respawn at the last
 * checkpoint, Assist clears hazards, and "Run to" steers to a gate on its
 * own, so reaching a page never depends on skill. Keys act only while the
 * game has focus, so Space still scrolls the page everywhere else.
 */
export function DashStage({ sections, currentHref, onNavigate, onExit }: DashStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const jumpRef = useRef<HTMLButtonElement>(null);
  const navigateRef = useRef(onNavigate);
  const pointerTypeRef = useRef('mouse');
  const current = sectionIndex(sections, currentHref);
  const currentRef = useRef(current);
  const runRef = useRef<RunState | null>(null);
  const [assist, setAssist] = useState(false);
  const [status, setStatus] = useState('Focus the game and press Space, or tap it, to start.');
  const [flash, setFlash] = useState(0);

  const run = () => {
    runRef.current ??= createRun(parseLevel(levelSource(sections.length)), currentRef.current);
    return runRef.current;
  };

  useEffect(() => {
    navigateRef.current = onNavigate;
  }, [onNavigate]);

  // A page change from any source cancels a pending "Run to", so the game
  // never moves the visitor away from a page they chose with a link.
  useEffect(() => {
    currentRef.current = current;
    const state = runRef.current;
    if (state === null) {
      return;
    }
    state.current = current;
    state.target = null;
    state.assistJumpAt = null;
  }, [current]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    const context = canvas?.getContext('2d') ?? null;
    if (canvas === null || frame === null || context === null) {
      return undefined;
    }
    runRef.current ??= createRun(parseLevel(levelSource(sections.length)), currentRef.current);
    const state = runRef.current;
    const labels = sections.map((section) => section.tag);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0;
    let height = 0;
    let visible = true;
    let last = performance.now();
    let accumulator = 0;
    let handle = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    intersection.observe(frame);

    const frameTick = (now: number) => {
      const elapsed = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (visible && !document.hidden) {
        accumulator += elapsed;
        while (accumulator >= physics.step) {
          accumulator -= physics.step;
          for (const event of step(state)) {
            switch (event.type) {
              case 'death':
                setStatus(
                  state.assist
                    ? `Crashed. Run ${state.attempts + 1} starts from the checkpoint.`
                    : `Crashed. Press Space on the game, or tap it, to retry from the checkpoint (run ${state.attempts + 1}).`,
                );
                break;
              case 'portal': {
                const section = sections[event.section];
                if (section !== undefined) {
                  setStatus(`Opened ${section.label}. Jump through another gate to move on.`);
                  setFlash((count) => count + 1);
                  navigateRef.current(section.href);
                }
                break;
              }
              case 'jump':
              case 'pad':
              case 'checkpoint':
                break;
            }
          }
        }
        render(context, state, { width, height, labels, reducedMotion: motion.matches });
      }
      handle = requestAnimationFrame(frameTick);
    };
    handle = requestAnimationFrame(frameTick);

    return () => {
      cancelAnimationFrame(handle);
      resizeObserver.disconnect();
      intersection.disconnect();
    };
  }, [sections]);

  const jump = () => {
    pressJump(run());
    setStatus('Jump through a gate to open its page.');
  };

  const toggleAssist = () => {
    const state = run();
    state.assist = !state.assist;
    state.target = null;
    state.assistJumpAt = null;
    setAssist(state.assist);
  };

  const runTo = (index: number) => {
    const state = run();
    state.assist = true;
    state.target = index;
    state.assistJumpAt = null;
    if (state.alive) {
      state.running = true;
    }
    setAssist(true);
    setStatus(`Running to ${sections[index]?.label ?? 'the gate'}.`);
  };

  return (
    <section className="dash-stage" aria-label="Geometry Dash runner">
      <div ref={frameRef} className="dash-frame">
        <canvas ref={canvasRef} className="dash-canvas" aria-hidden="true" />
        <button
          ref={jumpRef}
          type="button"
          className="dash-jump"
          aria-label="Jump. Hold Space to keep jumping."
          aria-describedby="dash-status"
          onKeyDown={(event) => {
            if (!isJumpKey(event)) {
              return;
            }
            // Keeps Space from scrolling and Enter or Space from also clicking.
            event.preventDefault();
            if (!event.repeat) {
              jump();
            }
          }}
          onKeyUp={(event) => {
            if (jumpKeys.has(event.key)) {
              event.preventDefault();
              releaseJump(run());
            }
          }}
          onPointerDown={(event) => {
            pointerTypeRef.current = event.pointerType;
            // On touch, wait for the click so a swipe that starts here still scrolls.
            if (event.pointerType !== 'touch') {
              event.currentTarget.focus({ preventScroll: true });
              jump();
            }
          }}
          onPointerUp={() => releaseJump(run())}
          onPointerLeave={() => releaseJump(run())}
          onPointerCancel={() => releaseJump(run())}
          onClick={() => {
            if (pointerTypeRef.current === 'touch') {
              jump();
              releaseJump(run());
            }
          }}
        />
        {flash > 0 ? <div key={flash} className="dash-flash" aria-hidden="true" /> : null}
      </div>
      <div className="dash-controls mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-6 py-3">
        <p id="dash-status" role="status" className="mr-auto text-sm">
          {status}
        </p>
        <span className="text-xs tracking-wide uppercase opacity-70">Run to</span>
        {sections.map((section, index) =>
          index === current ? null : (
            <button key={section.href} type="button" className="dash-chip" onClick={() => runTo(index)}>
              {section.label}
            </button>
          ),
        )}
        <button type="button" className="dash-chip" aria-pressed={assist} onClick={toggleAssist}>
          Assist
        </button>
        <button type="button" className="dash-chip" onClick={onExit}>
          Turn off gameplay
        </button>
      </div>
    </section>
  );
}
