'use strict';

/** 낙하 속도 — T-001 기준 3
 *  같은 총 시간을 어떻게 쪼개 주입해도 내려간 칸 수가 같아야 한다.
 *  프레임레이트 독립성은 advance(deltaMs) 에 델타를 직접 넣어 확인한다. */

const test = require('node:test');
const assert = require('node:assert');
const { loadGame } = require('./harness.js');

const TOTAL_MS = 3000;

/** 합이 TOTAL_MS 인 델타 분할들. 이름은 실패 메시지에 그대로 쓴다. */
const SPLITS = [
  { name: '1회 × 3000ms (한 프레임)', deltas: Array(1).fill(3000) },
  { name: '6회 × 500ms (2fps)', deltas: Array(6).fill(500) },
  { name: '60회 × 50ms (20fps)', deltas: Array(60).fill(50) },
  { name: '300회 × 10ms (100fps)', deltas: Array(300).fill(10) },
  { name: '7회 × 428ms + 1회 × 4ms (불규칙)', deltas: [...Array(7).fill(428), 4] },
];

/** 빈 보드 맨 위에 I 조각을 두고 델타 목록을 주입한 뒤 내려간 칸 수를 센다. */
function fallenCells(deltas) {
  const game = loadGame();
  game.resetGame();
  game.state.board = game.createBoard();
  game.state.piece = game.spawnPiece(game.CONFIG.I_PIECE_ID);
  game.state.dropAccumulatorMs = 0;
  const startY = game.state.piece.y;

  for (const delta of deltas) game.advance(delta);

  assert.strictEqual(game.state.lockedCount, 0, '시험 도중 조각이 고정돼 비교가 무의미해졌다');
  return game.state.piece.y - startY;
}

test('델타 분할이 달라도 같은 총 시간에 같은 칸 수만큼 내려간다', () => {
  for (const split of SPLITS) {
    const sum = split.deltas.reduce((acc, ms) => acc + ms, 0);
    assert.strictEqual(sum, TOTAL_MS, `분할 "${split.name}" 의 합이 ${sum}ms 로 ${TOTAL_MS}ms 가 아니다`);
  }

  const results = SPLITS.map((split) => ({ name: split.name, cells: fallenCells(split.deltas) }));
  const expected = results[0].cells;

  for (const result of results) {
    assert.strictEqual(
      result.cells, expected,
      `분할 "${result.name}" 에서 ${result.cells}칸 내려갔다. "${results[0].name}" 은 ${expected}칸이다 — 프레임레이트에 낙하 속도가 좌우된다`
    );
  }
});

test('레벨 1 에서 3000ms 는 정확히 3칸이다', () => {
  const game = loadGame();
  assert.strictEqual(game.levelIntervalMs(game.CONFIG.START_LEVEL), 1000, '레벨 1 낙하 간격이 1000ms 가 아니다');
  assert.strictEqual(fallenCells([TOTAL_MS]), 3, '3000ms 에 3칸이 아니다');
});

test('소프트 드롭은 낙하 간격을 SOFT_DROP_DIVISOR 로 나눈다', () => {
  const game = loadGame();
  game.resetGame();
  const base = game.levelIntervalMs(game.state.level);
  assert.strictEqual(game.dropIntervalMs(), base, '기본 상태의 낙하 간격이 레벨 간격과 다르다');

  game.applyIntent({ type: 'softDrop', active: true });

  assert.strictEqual(
    game.dropIntervalMs(), base / game.CONFIG.SOFT_DROP_DIVISOR,
    `소프트 드롭 간격이 ${game.dropIntervalMs()}ms 다`
  );
});
