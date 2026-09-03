'use strict';

/** 고정 경로 — T-003b (유예 타이머 · 줄 클리어 · 레벨) */

const test = require('node:test');
const assert = require('node:assert');
const { loadGame, fillRow, setCells } = require('./harness.js');

/** 빈 보드 바닥에 접지한 조각으로 시작한다. 유예 타이머는 아직 걸리지 않았다. */
function landed(options = {}) {
  const game = loadGame();
  game.resetGame();
  game.state.board = game.createBoard();
  const spawned = game.spawnPiece(options.id === undefined ? game.CONFIG.T_PIECE_ID : options.id);
  const placed = options.x === undefined ? spawned : { ...spawned, x: options.x };
  game.state.piece = game.dropPosition(game.state.board, placed);
  game.state.dropAccumulatorMs = 0;
  assert.strictEqual(game.isPieceLanded(), true, '픽스처가 접지 상태를 만들지 못했다');
  return game;
}

test('접지 후 advance(499) 에는 고정되지 않고 advance(2) 에 고정된다', () => {
  const game = landed();
  const lockedBefore = game.state.lockedCount;

  game.advance(499);
  assert.strictEqual(game.state.lockedCount, lockedBefore, `유예 ${game.state.lockTimerMs}ms 에 벌써 고정됐다`);
  assert.strictEqual(game.state.lockTimerMs, 499, `유예 누적이 499 가 아니라 ${game.state.lockTimerMs} 다`);

  game.advance(2);
  assert.strictEqual(game.state.lockedCount, lockedBefore + 1, `501ms 인데 고정되지 않았다 (lockTimerMs=${game.state.lockTimerMs})`);
});

test('유예 중 성공한 이동이 타이머를 리셋한다', () => {
  const game = landed();
  const lockedBefore = game.state.lockedCount;

  game.advance(300);
  assert.strictEqual(game.state.lockTimerMs, 300, '유예 누적이 300 이 아니다');

  game.applyIntent({ type: 'move', dx: -1 });
  assert.strictEqual(game.state.lockTimerMs, 0, `이동이 타이머를 리셋하지 않았다 (lockTimerMs=${game.state.lockTimerMs})`);
  assert.strictEqual(game.state.lockResetCount, 1, '리셋 횟수가 세어지지 않았다');

  // 리셋이 없었다면 누적 600ms 로 이미 고정됐을 시점이다.
  game.advance(300);
  assert.strictEqual(game.state.lockedCount, lockedBefore, '리셋했는데도 고정됐다');
  assert.strictEqual(game.state.lockTimerMs, 300, '리셋 후 누적이 300 이 아니다');
});

test('벽에 막힌 이동은 타이머를 리셋하지 않는다', () => {
  // rot 0 의 T 는 x..x+2 열을 차지한다. x=0 이면 왼쪽으로 더 갈 수 없다.
  const game = landed({ x: 0 });
  const blocked = game.movedBy(game.state.piece, -1, 0);
  assert.strictEqual(game.collides(game.state.board, blocked), true, '픽스처가 벽에 막힌 상태를 만들지 못했다');

  game.advance(300);
  game.applyIntent({ type: 'move', dx: -1 });

  assert.strictEqual(game.state.lockTimerMs, 300, `막힌 이동이 타이머를 ${game.state.lockTimerMs} 로 바꿨다`);
  assert.strictEqual(game.state.lockResetCount, 0, `막힌 이동이 리셋 횟수를 ${game.state.lockResetCount} 로 올렸다`);
  assert.strictEqual(game.state.piece.x, 0, '막혔는데 조각이 움직였다');
});

test('LOCK_RESET_LIMIT 에 도달하면 더 이상 리셋되지 않는다', () => {
  const game = landed();
  const limit = game.CONFIG.LOCK_RESET_LIMIT;

  game.advance(100);
  for (let i = 0; i < limit; i++) {
    game.applyIntent({ type: 'move', dx: i % 2 === 0 ? -1 : 1 });
    assert.strictEqual(game.state.lockResetCount, i + 1, `${i + 1}번째 이동이 리셋으로 세어지지 않았다`);
    assert.strictEqual(game.state.lockTimerMs, 0, `${i + 1}번째 이동이 타이머를 0 으로 되돌리지 않았다`);
    game.advance(10);
  }

  const timerAtLimit = game.state.lockTimerMs;
  game.applyIntent({ type: 'move', dx: -1 });

  assert.strictEqual(game.state.lockResetCount, limit, `상한 ${limit} 을 넘어 ${game.state.lockResetCount} 까지 리셋됐다`);
  assert.strictEqual(game.state.lockTimerMs, timerAtLimit, `상한 도달 후에도 타이머가 ${timerAtLimit} → ${game.state.lockTimerMs} 로 리셋됐다`);
});

test('가득 찬 행이 지워지고 위 행이 그 자리로 내려온다', () => {
  const game = loadGame();
  const board = fillRow(game, game.createBoard(), 21);
  setCells(game, board, [[0, 20]], 3);

  const result = game.clearLines(board);

  assert.deepStrictEqual(result.clearedRows, [21], '가득 찬 행이 지워지지 않았다');
  assert.strictEqual(result.board[game.cellIndex(0, 21)], 3, '위 행이 지워진 자리로 내려오지 않았다');
  assert.strictEqual(result.board[game.cellIndex(0, 20)], game.CONFIG.EMPTY, '내려온 행의 원래 자리가 비지 않았다');
  assert.strictEqual(result.board[game.cellIndex(1, 21)], game.CONFIG.EMPTY, '지워진 행에 남은 셀이 있다');
});

test('4줄 클리어는 레벨 1 에서 800점이다', () => {
  const game = loadGame();
  game.resetGame();
  const before = game.state.score;

  game.applyLineClears(game.CONFIG.TETRIS_LINE_COUNT, false);

  assert.strictEqual(game.state.score - before, 800, `4줄 클리어 점수가 ${game.state.score - before} 다`);
  assert.strictEqual(
    game.clearScore({ clearedCount: 4, level: 1, tSpin: false, backToBack: false, combo: 0 }), 800,
    'clearScore 의 4줄 값이 800 이 아니다'
  );
});

test('10줄을 지우면 레벨이 2로 오른다', () => {
  const game = loadGame();
  game.resetGame();
  assert.strictEqual(game.state.level, game.CONFIG.START_LEVEL, '시작 레벨이 START_LEVEL 이 아니다');

  for (let i = 0; i < 5; i++) game.applyLineClears(2, false);

  assert.strictEqual(game.state.clearedLines, 10, `누적 줄 수가 ${game.state.clearedLines} 다`);
  assert.strictEqual(game.state.level, 2, `10줄을 지웠는데 레벨이 ${game.state.level} 이다`);
  assert.strictEqual(game.levelForClearedLines(20), 3, `20줄에서 레벨이 ${game.levelForClearedLines(20)} 다`);
  assert.strictEqual(game.levelForClearedLines(9), game.CONFIG.START_LEVEL, '9줄에서 벌써 레벨이 올랐다');
});

test('레벨이 오를수록 낙하 간격이 짧아진다', () => {
  const game = loadGame();

  for (let level = game.CONFIG.START_LEVEL; level < game.MAX_LEVEL; level++) {
    const current = game.levelIntervalMs(level);
    const next = game.levelIntervalMs(level + 1);
    assert.ok(next < current, `레벨 ${level}(${current}ms) → ${level + 1}(${next}ms) 에서 간격이 줄지 않았다`);
  }

  assert.strictEqual(
    game.levelIntervalMs(game.MAX_LEVEL + 10), game.levelIntervalMs(game.MAX_LEVEL),
    '표 밖의 레벨이 마지막 값으로 고정되지 않았다'
  );
});
