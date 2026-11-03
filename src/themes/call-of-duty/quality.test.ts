import assert from 'node:assert/strict';
import { test } from 'node:test';
import { presetFor } from './quality';

await test('software renderers get Low', () => {
  assert.equal(
    presetFor({ gpu: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))', memory: 8, smallTouch: false }),
    'low',
  );
  assert.equal(presetFor({ gpu: 'llvmpipe (LLVM 15.0.7, 256 bits)', memory: 16, smallTouch: false }), 'low');
});

await test('phones and low-memory devices get Low', () => {
  assert.equal(presetFor({ gpu: 'Apple GPU', memory: 8, smallTouch: true }), 'low');
  assert.equal(presetFor({ gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070)', memory: 4, smallTouch: false }), 'low');
});

await test('strong GPUs with memory to spare get High', () => {
  assert.equal(
    presetFor({ gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)', memory: 8, smallTouch: false }),
    'high',
  );
  assert.equal(presetFor({ gpu: 'ANGLE (AMD, AMD Radeon RX 7800 XT)', memory: 8, smallTouch: false }), 'high');
  assert.equal(
    presetFor({ gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Max)', memory: 8, smallTouch: false }),
    'high',
  );
});

await test('everything else gets Medium', () => {
  assert.equal(
    presetFor({ gpu: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics)', memory: 8, smallTouch: false }),
    'medium',
  );
  assert.equal(
    presetFor({ gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2)', memory: 8, smallTouch: false }),
    'medium',
  );
  assert.equal(presetFor({ gpu: '', memory: 8, smallTouch: false }), 'medium');
});
