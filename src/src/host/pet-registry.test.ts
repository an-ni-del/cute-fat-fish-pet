/**
 * host 宠物注册表（lib\pet-registry.js）单元测试 —— 钉住重构前散在三处的语义：
 *   ① 当前交互桌宠：已选且仍存在 → 保持；未选 / 已失效 → 列表第一只；一只都没有 → ""；
 *      配置读不出来 → **保持上一次的选择**（旧 resolveActivePetId 的 catch 分支，不抛错）；
 *   ② 「id 失效就回退第一只」这条规则只存在于 active()（setActive() 不校验存在性）；
 *   ③ 桌面派生视图：display 为 desktop/both 的才进列表，配置非法 → hasDesktop() 假 + 告警一次。
 *
 * 被测文件是**手写源码**（与 lib\index.js 同目录、随包发布），不是构建产物：lib\index.js 顶层
 * import 了 @deepseek-ai/*，本仓库不带这些包，单测里 import 它必然 ERR_MODULE_NOT_FOUND，
 * 所以「读配置 → 校验 → 回退」这条规则被拆到只认注入函数的 lib\pet-registry.js 里。
 * 同款做法见 pointer-target.test.ts（被测的是 runtime\electron-helper\pointer-target.js）。
 *
 * 跑法：node --test src/host/pet-registry.test.ts
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createPetRegistry } from '../../lib/pet-registry.js';

type Pet = { id: unknown; name?: unknown; size?: unknown; display?: unknown };

/** 造注册表：readPets 由用例决定（可变列表 / 抛错），isDesktopVisible 与产品口径一致 */
const make = (readPets: () => Pet[]) => {
  const warns: string[] = [];
  const registry = createPetRegistry({
    readPets,
    isDesktopVisible: (display) => display === 'desktop' || display === 'both',
    onWarn: (message) => warns.push(message),
  });
  return { registry, warns };
};

const A: Pet = { id: 'a', name: '小蓝', size: 400, display: 'desktop' };
const B: Pet = { id: 'b', name: '小肥', size: 300, display: 'both' };
const OFF: Pet = { id: 'c', name: '藏起来的', size: 300, display: 'off' };

describe('active() —— 「失效就回退第一只」只写一次', () => {
  test('未选过 → 列表第一只', () => {
    const { registry } = make(() => [A, B]);
    assert.equal(registry.active(), 'a');
  });

  test('一只都没有 → 空串（调用方各自决定怎么报错）', () => {
    const { registry } = make(() => []);
    assert.equal(registry.active(), '');
  });

  test('已选且仍存在 → 保持该宠物（不跳回第一只）', () => {
    const { registry } = make(() => [A, B]);
    registry.setActive('b');
    assert.equal(registry.active(), 'b');
  });

  test('已选但该 id 已失效 → 回退第一只', () => {
    let pets: Pet[] = [A, B];
    const { registry } = make(() => pets);
    registry.setActive('b');
    pets = [A]; // 用户删掉了 b（或改了 id）
    assert.equal(registry.active(), 'a');
  });

  test('id 是数字时按字符串比对（配置里 id 未必是字符串）', () => {
    const numbered: Pet = { id: 7, name: '七号' };
    const { registry } = make(() => [numbered, A]);
    registry.setActive(7);
    assert.equal(registry.active(), '7');
  });

  test('配置读不出来 → 保持上一次的选择，不抛错、不改判', () => {
    let pets: Pet[] = [A, B];
    let broken = true;
    const { registry } = make(() => {
      if (broken) throw new Error('config broken');
      return pets;
    });
    assert.equal(registry.active(), '', '还没选过就读失败 → 空串（与旧 activePetId 初值一致）');
    broken = false;
    assert.equal(registry.active(), 'a', '读得出来 → 第一只');
    registry.setActive('b');
    pets = [];
    broken = true;
    assert.equal(registry.active(), 'b', '读失败 → 退回上一次的选择（不跳回第一只）');
    assert.deepEqual(registry.list(), [], 'list() 读不出来 → 按空列表处理');
  });
});

describe('setActive() / list() —— 命令取用口', () => {
  test('setActive 写入即生效；空/未定义写成空串', () => {
    const { registry } = make(() => [A, B]);
    assert.equal(registry.setActive('b'), 'b');
    assert.equal(registry.active(), 'b');
    assert.equal(registry.setActive(undefined), '');
    assert.equal(registry.active(), 'a', '选空后回到「未选」状态 → 第一只');
  });

  test('list() 就是当前生效列表本身（id 唯一由合并器保证）', () => {
    const { registry } = make(() => [A, B, OFF]);
    assert.deepEqual(registry.list().map((p) => String(p.id)), ['a', 'b', 'c']);
  });
});

describe('desktopList() / hasDesktop() / refresh() —— 桌面派生视图', () => {
  test('只有 display=desktop/both 进列表，且只带 id/size（Helper 照它开窗）', () => {
    const { registry } = make(() => [A, B, OFF]);
    assert.deepEqual(registry.desktopList(), [
      { id: 'a', size: 400 },
      { id: 'b', size: 300 },
    ]);
  });

  test('构造时就算一次：列表里有桌面宠物 → hasDesktop() 真', () => {
    const { registry } = make(() => [A, OFF]);
    assert.equal(registry.hasDesktop(), true);
  });

  test('全是 off → hasDesktop() 假（不拉起 Helper）', () => {
    const { registry } = make(() => [OFF]);
    assert.equal(registry.hasDesktop(), false);
    assert.deepEqual(registry.desktopList(), []);
  });

  test('列表变了要 refresh() 才同步 hasDesktop()（旧 refreshDesktop 的调用时机）', () => {
    let pets: Pet[] = [A];
    const { registry } = make(() => pets);
    pets = [OFF];
    assert.equal(registry.hasDesktop(), true, 'refresh 之前仍是上一次的结果');
    assert.equal(registry.refresh(), false);
    assert.equal(registry.hasDesktop(), false);
  });

  test('配置非法 → 视为没有桌面宠物 + 告警一次（不抛错）', () => {
    const { registry, warns } = make(() => {
      throw new Error('not an object');
    });
    assert.equal(registry.hasDesktop(), false);
    assert.deepEqual(registry.desktopList(), []);
    assert.equal(warns.length, 1);
    assert.match(warns[0], /宠物配置非法，桌面模式已跳过：not an object/);
  });
});
