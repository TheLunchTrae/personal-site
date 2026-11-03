import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createRun, pressJump, releaseJump, step, type RunState, type StepEvent } from './engine';
import { levelSource, parseLevel } from './level';

const sectionCount = 5;

function start(state: RunState): void {
  pressJump(state);
  releaseJump(state);
  state.jumpBuffered = 0;
}

function runFor(state: RunState, seconds: number): StepEvent[] {
  const events: StepEvent[] = [];
  for (let index = 0; index < seconds * 240; index += 1) {
    events.push(...step(state));
  }
  return events;
}

await describe('dash run', async () => {
  await test('the assist clears every pattern without entering a portal', () => {
    const level = parseLevel(levelSource(sectionCount));
    const state = createRun(level, 0);
    state.assist = true;
    start(state);
    const events = runFor(state, (level.length * 2) / 8.6);
    assert.deepEqual(
      events.filter((event) => event.type === 'death'),
      [],
    );
    assert.deepEqual(
      events.filter((event) => event.type === 'portal'),
      [],
    );
  });

  await test('the assist reaches each section portal it is pointed at', () => {
    for (let section = 1; section < sectionCount; section += 1) {
      const state = createRun(parseLevel(levelSource(sectionCount)), 0);
      state.assist = true;
      state.target = section;
      start(state);
      const portals = runFor(state, state.level.length / 8.6).filter((event) => event.type === 'portal');
      assert.deepEqual(portals, [{ type: 'portal', section }]);
    }
  });

  await test('running without input dies at the first hazard and respawns at the checkpoint', () => {
    const state = createRun(parseLevel(levelSource(sectionCount)), 0);
    start(state);
    const events = runFor(state, 4);
    assert.ok(events.some((event) => event.type === 'death'));
    assert.equal(state.alive, true);
    assert.equal(state.running, false);
    assert.equal(state.attempts, 2);
  });

  await test('a manual jump cancels the assist plan it made stale', () => {
    const state = createRun(parseLevel(levelSource(sectionCount)), 0);
    state.assist = true;
    start(state);
    while (state.assistJumpAt === null) {
      step(state);
    }
    pressJump(state);
    releaseJump(state);
    assert.equal(state.assistJumpAt, null);
  });

  await test("with the site's two pages, the assist reaches home from the story page", () => {
    const state = createRun(parseLevel(levelSource(2)), 1);
    state.assist = true;
    state.target = 0;
    start(state);
    const portals = runFor(state, state.level.length / 8.6).filter((event) => event.type === 'portal');
    assert.deepEqual(portals, [{ type: 'portal', section: 0 }]);
  });
});
