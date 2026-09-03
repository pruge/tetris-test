'use strict';

/** 재시작 완전성 — 결함 유형 전체를 닫는 구조적 테스트
 *
 *  개별 필드를 하나씩 단언하는 방식은 새 필드가 늘 때마다 빠뜨린다.
 *  실제로 이 프로젝트에서 세 번 반복된 유형이다:
 *    1. holdCurrentPiece 가 lockTimerMs / lockResetCount 미초기화 (통합 리뷰에서 발견)
 *    2. resetGame 이 combo / isBackToBack / lastMoveWasRotation 미초기화 (T-005a 핸드오프)
 *    3. resetGame 의 lockResetCount 가 테스트로 안 덮임 (변이 테스트에서 발견)
 *
 *  그래서 "필드 목록" 을 테스트가 직접 열거하지 않는다. 갓 로드한 인스턴스의
 *  state 를 기준으로 삼고, 판을 어지럽힌 뒤 재시작한 state 와 통째로 비교한다.
 *  새 필드가 추가되면 별도 조치 없이 자동으로 검사 대상이 된다.
 */

const test = require('node:test');
const assert = require('node:assert');
const { loadGame } = require('./harness.js');

/** 비교 가능한 형태로 state 를 직렬화한다. 매 판 달라지는 것은 제외한다. */
function snapshot(game) {
  const out = {};
  for (const key of Object.keys(game.state)) {
    const value = game.state[key];
    if (VOLATILE.has(key)) continue;
    out[key] = value instanceof Uint8Array ? Array.from(value).join('') : value;
  }
  return out;
}

/** 재시작해도 같을 수 없는 필드. 여기 넣을 때는 이유를 적는다. */
const VOLATILE = new Set([
  'piece',      // 7-bag 이 무작위라 조각 id 가 다르다
  'bag',        // 위와 같다
  'queue',      // 위와 같다
  'highScore',  // 재시작해도 유지되는 것이 정상이다
]);

/** 판을 최대한 어지럽힌다. 재시작이 지워야 할 흔적을 남기는 것이 목적이다. */
function messUpGame(game) {
  const { CONFIG, state } = game;
  state.board = state.board.slice();
  for (let i = 0; i < 40; i++) state.board[i + 100] = CONFIG.T_PIECE_ID;
  state.score = 9999;
  state.clearedLines = 37;
  state.level = 5;
  state.lockedCount = 22;
  state.lockTimerMs = 321;
  state.lockResetCount = 9;
  state.dropAccumulatorMs = 456;
  state.isSoftDropping = true;
  state.isOver = true;
  state.hold = CONFIG.I_PIECE_ID;
  state.canHold = false;
  state.combo = 7;
  state.isBackToBack = true;
  state.lastMoveWasRotation = true;
}

test('resetGame() 은 모든 비휘발성 state 필드를 초기 상태로 되돌린다', () => {
  const fresh = loadGame();
  const expected = snapshot(fresh);

  const game = loadGame();
  messUpGame(game);
  game.resetGame();

  assert.deepStrictEqual(
    snapshot(game),
    expected,
    'resetGame() 이 초기화하지 않은 필드가 있다. 위 diff 의 키를 resetGame() 에 추가하라.'
  );
});

test('어지럽힌 값이 실제로 초기값과 달랐다 — 위 테스트가 공허하지 않음을 보장', () => {
  const fresh = loadGame();
  const game = loadGame();
  messUpGame(game);

  const before = snapshot(game);
  const initial = snapshot(fresh);
  const differing = Object.keys(initial).filter((k) => before[k] !== initial[k]);

  assert.ok(
    differing.length >= 12,
    `어지럽힌 필드가 ${differing.length}개뿐이다. messUpGame 이 실제 필드를 못 건드리고 있다.`
  );
});

test('VOLATILE 에 등재된 키가 전부 실재하는 state 필드다', () => {
  const game = loadGame();
  for (const key of VOLATILE) {
    assert.ok(
      key in game.state,
      `VOLATILE 의 '${key}' 가 state 에 없다. 이름이 바뀌었다면 VOLATILE 도 고쳐라.`
    );
  }
});
