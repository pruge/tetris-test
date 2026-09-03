'use strict';

/**
 * 터치 제스처 판정 — 탭·좌우 스와이프·빠른/느린 아래 스와이프 (T-009).
 *
 * 게임의 `performance.now()` 는 하네스가 주입하는 시계를 읽는다. 실제 시간은
 * 흐르지 않는다 (`setTimeout` 없음). 테스트가 `harness.clock.advance(ms)` 로
 * 명시적으로 밀어 올린다 — 게임의 `advance(deltaMs)` 와 같은 규약이다.
 *
 * 핸들러는 canvas 에 붙어 있고 하네스의 addEventListener 는 no-op 이라
 * 이벤트를 디스패치해도 도달하지 않는다. 대신 하네스가 꺼내 준 핸들러를
 * 직접 부른다. 합성 이벤트는 핸들러가 읽는 필드만 담는다.
 *
 * 범위 밖: 화면 버튼(`bindTouchButton`)의 DOM 바인딩, 렌더링·레이아웃.
 */

const test = require('node:test');
const assert = require('node:assert');
const { loadGame, makeClock } = require('./harness.js');

/** CONFIG.SHAPES 의 T. 회전마다 모양이 달라 rot 변화를 그대로 관측할 수 있다. */
const T_PIECE_ID = 6;

/**
 * 아래 기대값들이 기대는 경계 숫자. CONFIG 에서 읽어 오지 않고 손으로 적는다 —
 * CONFIG 를 그대로 되읽으면 값이 바뀌어도 테스트가 따라 움직여 아무것도
 * 검증하지 못한다. 값이 바뀌면 첫 테스트가 여기를 고치라고 알려 준다.
 */
const TAP_MAX_PX = 10;
const TAP_MAX_MS = 250;
const CELL_PX = 24;
const DOWN_FAST_MIN_PX = 45;
const DOWN_FAST_MAX_MS = 220;

/** 핸들러가 읽는 필드만 담은 합성 터치 이벤트. */
function touchEvent(clientX, clientY) {
  const touches = [{ clientX, clientY }];
  return { touches, changedTouches: touches, preventDefault() {} };
}

/** T 조각을 스폰 위치에 세운 새 게임. rot 은 0 에서 시작한다. */
function gameWithTPiece() {
  const game = loadGame();
  game.state.piece = game.spawnPiece(T_PIECE_ID);
  game.takeIntents();
  return game;
}

test('테스트가 적어 둔 경계 숫자가 CONFIG 와 같다', () => {
  const { CONFIG } = loadGame();
  const expected = {
    SWIPE_TAP_MAX_PX: TAP_MAX_PX,
    SWIPE_TAP_MAX_MS: TAP_MAX_MS,
    SWIPE_CELL_PX: CELL_PX,
    SWIPE_DOWN_FAST_MIN_PX: DOWN_FAST_MIN_PX,
    SWIPE_DOWN_FAST_MAX_MS: DOWN_FAST_MAX_MS,
  };
  for (const [key, value] of Object.entries(expected)) {
    assert.strictEqual(CONFIG[key], value,
      `CONFIG.${key} 가 ${CONFIG[key]} 로 바뀌었다 — touch.test.js 의 기대값(${value})을 함께 고쳐라`);
  }
});

test('기본 시계는 0 에 멈춰 있다 — 밀지 않는 테스트에는 기존 스텁과 같다', () => {
  const game = loadGame();
  assert.strictEqual(game.performance.now(), 0, '기본 시계가 0 에서 시작하지 않는다');
  game.advance(1000);
  assert.strictEqual(game.performance.now(), 0, 'advance(deltaMs) 가 시계를 저절로 밀었다');
});

test('시계를 밀어 올리면 performance.now() 가 그만큼 증가한다', () => {
  const game = loadGame();
  game.harness.clock.advance(120);
  assert.strictEqual(game.performance.now(), 120, `120 을 밀었는데 ${game.performance.now()} 다`);
  game.harness.clock.advance(80);
  assert.strictEqual(game.performance.now(), 200, `누적 200 이어야 하는데 ${game.performance.now()} 다`);

  const injected = loadGame({ clock: makeClock(5000) });
  assert.strictEqual(injected.performance.now(), 5000, '주입한 시계의 시작값이 반영되지 않았다');
});

test('탭(짧은 거리·짧은 시간)이 회전을 일으킨다', () => {
  const game = gameWithTPiece();
  const rotBefore = game.state.piece.rot;

  game.handleTouchStart(touchEvent(100, 100));
  game.harness.clock.advance(100);
  game.handleTouchEnd(touchEvent(104, 103));   // 이동 5px 이내 — TAP_MAX_PX 아래
  game.advance(0);

  assert.strictEqual(rotBefore, 0, '스폰 조각의 rot 이 0 이 아니다');
  assert.strictEqual(game.state.piece.rot, 1,
    `탭했는데 rot 이 ${rotBefore} → ${game.state.piece.rot} 로, 시계방향 회전이 일어나지 않았다`);
});

test('탭 판정은 250ms 까지다 — 251ms 는 탭이 아니다', () => {
  const rotAfterTap = (durationMs) => {
    const game = gameWithTPiece();
    game.handleTouchStart(touchEvent(100, 100));
    game.harness.clock.advance(durationMs);
    game.handleTouchEnd(touchEvent(104, 103));   // 두 경우 이동 거리는 같다
    game.advance(0);
    return game.state.piece.rot;
  };

  assert.strictEqual(rotAfterTap(250), 1, '250ms 짜리 탭이 회전하지 않았다 — 경계가 배타적으로 바뀌었나');
  assert.strictEqual(rotAfterTap(251), 0,
    '251ms 인데 회전했다 — 지속 시간이 항상 0 으로 측정되면 이렇게 된다');
});

test('45px 이상을 220ms 안에 아래로 끌면 하드 드롭', () => {
  const game = loadGame();
  game.takeIntents();
  const lockedBefore = game.state.lockedCount;

  game.handleTouchStart(touchEvent(100, 100));
  game.harness.clock.advance(220);
  game.handleTouchMove(touchEvent(100, 150));   // 아래로 50px — DOWN_FAST_MIN_PX 초과
  game.handleTouchEnd(touchEvent(100, 150));
  game.advance(0);

  assert.strictEqual(game.state.lockedCount, lockedBefore + 1,
    `220ms 안의 빠른 아래 스와이프인데 lockedCount 가 ${lockedBefore} → ${game.state.lockedCount} 다`);
});

test('같은 거리를 221ms 에 끌면 하드 드롭이 아니라 소프트 드롭', () => {
  const game = loadGame();
  game.takeIntents();
  const lockedBefore = game.state.lockedCount;

  game.handleTouchStart(touchEvent(100, 100));
  game.harness.clock.advance(221);
  game.handleTouchMove(touchEvent(100, 150));   // 위 테스트와 같은 50px
  game.advance(0);

  assert.strictEqual(game.state.isSoftDropping, true, '아래로 끄는 중인데 소프트 드롭이 켜지지 않았다');
  assert.strictEqual(game.state.lockedCount, lockedBefore, '끄는 중에 조각이 고정됐다');

  game.handleTouchEnd(touchEvent(100, 150));
  game.advance(0);

  assert.strictEqual(game.state.lockedCount, lockedBefore,
    `221ms 인데 하드 드롭됐다(lockedCount ${lockedBefore} → ${game.state.lockedCount}) — 시간 분기가 죽었다`);
  assert.strictEqual(game.state.isSoftDropping, false, '손을 뗐는데 소프트 드롭이 계속 켜져 있다');
});

test('가로 스와이프는 24px 마다 한 칸 — 2.5칸 거리는 2칸만 움직인다', () => {
  const game = gameWithTPiece();
  const xBefore = game.state.piece.x;

  game.handleTouchStart(touchEvent(100, 100));
  game.handleTouchMove(touchEvent(160, 100));   // 60px = 24px * 2.5

  const moves = game.input.intents.filter((intent) => intent.type === 'move');
  assert.strictEqual(moves.length, 2, `2.5칸을 끌었는데 move 의도가 ${moves.length}건이다`);
  assert.deepStrictEqual(moves.map((intent) => intent.dx), [1, 1], '오른쪽으로 끌었는데 방향이 다르다');

  game.advance(0);
  assert.strictEqual(game.state.piece.x, xBefore + 2,
    `조각이 ${xBefore} → ${game.state.piece.x} 로, 2칸이 아니라 ${game.state.piece.x - xBefore}칸 움직였다`);
});

test('터치 핸들러는 state 를 건드리지 않고 pushIntent 만 거친다', () => {
  const game = gameWithTPiece();
  game.takeIntents();                       // 의도 큐를 비운 뒤 관찰한다
  const stateBefore = structuredClone(game.state);

  game.handleTouchStart(touchEvent(100, 100));
  game.harness.clock.advance(100);
  game.handleTouchMove(touchEvent(160, 100));
  game.handleTouchEnd(touchEvent(160, 100));

  assert.deepStrictEqual(game.state, stateBefore, '터치 핸들러가 state 를 직접 수정했다');
  assert.ok(game.input.intents.length > 0, '터치 제스처가 의도를 하나도 만들지 않았다');

  game.advance(0);
  assert.notDeepStrictEqual(game.state, stateBefore, '쌓인 의도가 advance() 에서 적용되지 않았다');
});

test('일시정지 중에는 터치가 무시된다', () => {
  const game = gameWithTPiece();
  game.setPaused(true);
  game.takeIntents();
  const rotBefore = game.state.piece.rot;

  game.handleTouchStart(touchEvent(100, 100));
  game.harness.clock.advance(100);
  game.handleTouchMove(touchEvent(160, 100));
  game.handleTouchEnd(touchEvent(104, 103));

  assert.strictEqual(game.input.intents.length, 0,
    `일시정지 중인데 의도가 ${game.input.intents.length}건 쌓였다`);
  assert.strictEqual(game.state.piece.rot, rotBefore, '일시정지 중인데 조각이 회전했다');
  assert.strictEqual(game.state.piece.x, game.CONFIG.SPAWN_X, '일시정지 중인데 조각이 움직였다');
});
