/**
 * [local patch idle-gate@1] 「无人互动」信号：宿主侧纯逻辑单测。
 *
 * 被测的是 lib/idle-signal.js（跳过 @deepseek-ai/* 依赖的老做法，与 pointer-target / pet-registry 同款）。
 * 时间用注入的假时钟推进，不依赖真实等待。
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';

import { createIdleSignal } from '../../lib/idle-signal.js';

/** 假时钟：手动推进 */
const make = () => {
  let t = 1_000_000;
  const signal = createIdleSignal(() => t);
  return { signal, tick: (ms: number) => (t += ms) };
};

test('没收到过通知 → idleMs 为 null（没助手 / 纯浏览器模式）', () => {
  const { signal, tick } = make();
  tick(60_000);
  assert.equal(signal.idleMs(), null, '一直没有信号就是 null，调用方据此不启用这道闸');
});

test('刚有输入（idleSec = 0）→ 空闲从到达时刻起算', () => {
  const { signal, tick } = make();
  signal.note(0);
  assert.equal(signal.idleMs(), 0);
  tick(5_000);
  assert.equal(signal.idleMs(), 5_000);
});

test('通知里带空闲秒数 → 立刻就是那个值（不从头起算）', () => {
  const { signal, tick } = make();
  signal.note(600); // 助手测到：主人已经 10 分钟没碰键鼠了
  assert.equal(signal.idleMs(), 600_000);
  tick(3_000);
  assert.equal(signal.idleMs(), 603_000);
});

test('连续上报不叠加：后来的通知覆盖前一条', () => {
  const { signal, tick } = make();
  signal.note(600);
  tick(30_000);
  assert.equal(signal.idleMs(), 630_000);
  signal.note(630); // 30s 后又报了一次（周期刷新），两条指向同一时刻
  assert.equal(signal.idleMs(), 630_000, '覆盖而不是相加');
  tick(1_000);
  assert.equal(signal.idleMs(), 631_000);
});

test('持续动鼠标（一直报 idleSec = 0）→ 空闲永远不涨（不会被误判成没人）', () => {
  const { signal, tick } = make();
  signal.note(0);
  for (let i = 0; i < 20; i++) {
    tick(30_000); // 每 30s 一次周期上报
    signal.note(0);
    assert.ok(signal.idleMs() < 1, '刚报过就应该是 0 附近');
  }
});

test('输入回来（idleSec 从大值回到 0）→ 空闲立刻清零', () => {
  const { signal, tick } = make();
  signal.note(600);
  tick(60_000);
  assert.equal(signal.idleMs(), 660_000);
  signal.note(0); // 助手在 ≤1s 内报「有输入」
  assert.equal(signal.idleMs(), 0);
});

test('非法空闲值按 0 处理（不抛错，也不算成空闲）', () => {
  for (const bad of [Number.NaN, -1, 'x', undefined, null, Infinity]) {
    const { signal } = make();
    signal.note(bad as unknown as number);
    assert.ok(Number.isFinite(signal.idleMs() as number), `idleSec=${String(bad)} 不该污染估计值`);
    assert.equal(signal.idleMs(), 0);
  }
});

test('clear() 之后回到「无信号」', () => {
  const { signal, tick } = make();
  signal.note(600);
  tick(1_000);
  signal.clear();
  assert.equal(signal.idleMs(), null);
});
