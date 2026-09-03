'use strict';

/** 점수 규칙 — T-005a (T-스핀 · B2B · 콤보) */

const test = require('node:test');
const assert = require('node:assert');
const { loadGame, fillRow, setCells } = require('./harness.js');

/** T-스핀 싱글이 되는 슬롯.
 *  21행은 4열만, 20행은 3·4·5·8열만 비었다. 19행의 3열이 오버행이라
 *  T 의 회전 중심 네 모서리 중 3개가 막힌다. 8열 구멍 덕에 20행은 안 지워진다. */
function tSpinSlot() {
  const game = loadGame();
  game.resetGame();
  const board = fillRow(game, game.createBoard(), 21, [4]);
  fillRow(game, board, 20, [3, 4, 5, 8]);
  setCells(game, board, [[3, 19]]);
  game.state.board = board;
  game.state.piece = { id: game.CONFIG.T_PIECE_ID, rot: 1, x: 3, y: 19 };
  assert.strictEqual(game.collides(board, game.state.piece), false, '픽스처의 시작 위치가 이미 겹친다');
  return game;
}

/** 평평한 바닥의 T. 왼쪽 위 모서리만 막혀 있어 세 모서리가 막힌 자리로
 *  가로 이동만으로 들어갈 수 있다. */
function slideInSlot() {
  const game = loadGame();
  game.resetGame();
  const board = fillRow(game, game.createBoard(), 21, [4, 5, 6, 7]);
  setCells(game, board, [[4, 20]]);
  game.state.board = board;
  game.state.piece = { id: game.CONFIG.T_PIECE_ID, rot: 0, x: 5, y: 20 };
  assert.strictEqual(game.collides(board, game.state.piece), false, '픽스처의 시작 위치가 이미 겹친다');
  return game;
}

test('T-스핀 싱글은 800점, 일반 싱글은 100점이다', () => {
  const game = loadGame();
  const level = game.CONFIG.START_LEVEL;

  assert.strictEqual(
    game.clearScore({ clearedCount: 1, level, tSpin: true, backToBack: false, combo: 0 }), 800,
    'T-스핀 싱글이 800점이 아니다'
  );
  assert.strictEqual(
    game.clearScore({ clearedCount: 1, level, tSpin: false, backToBack: false, combo: 0 }), 100,
    '일반 싱글이 100점이 아니다'
  );
});

test('회전으로 슬롯에 들어가 한 줄을 지우면 T-스핀 싱글 800점이 들어온다', () => {
  const game = tSpinSlot();
  const before = game.state.score;

  game.applyIntent({ type: 'rotate', dir: game.CONFIG.ROTATE_CW_DIR });
  assert.strictEqual(game.state.piece.rot, 2, `회전이 슬롯 모양으로 들어가지 않았다 (rot=${game.state.piece.rot})`);
  assert.strictEqual(game.state.lastMoveWasRotation, true, '회전인데 lastMoveWasRotation 이 false 다');
  assert.strictEqual(
    game.isTSpin(game.state.board, game.state.piece, game.state.lastMoveWasRotation), true,
    'T-스핀으로 판정되지 않았다'
  );

  game.applyIntent({ type: 'hardDrop' });   // 이미 접지했으므로 드롭 보너스는 0점이다

  assert.strictEqual(game.state.clearedLines, 1, `지운 줄 수가 ${game.state.clearedLines} 다`);
  assert.strictEqual(game.state.score - before, 800, `T-스핀 싱글 점수가 ${game.state.score - before} 다`);
});

test('같은 자리라도 이동으로 진입하면 T-스핀이 아니다', () => {
  const game = slideInSlot();

  game.applyIntent({ type: 'move', dx: -1 });
  assert.strictEqual(game.state.piece.x, 4, '이동이 실패해 시험이 성립하지 않는다');
  assert.strictEqual(game.state.lastMoveWasRotation, false, '이동인데 lastMoveWasRotation 이 true 다');

  assert.strictEqual(
    game.isTSpin(game.state.board, game.state.piece, game.state.lastMoveWasRotation), false,
    '이동으로 들어갔는데 T-스핀으로 판정됐다'
  );
  // 자리 자체는 모서리 3개가 막힌 T-스핀 자리다. 차이는 진입 방식뿐이다.
  assert.strictEqual(
    game.isTSpin(game.state.board, game.state.piece, true), true,
    '픽스처 자리가 애초에 모서리 3개를 막지 못했다'
  );
});

test('4줄 클리어가 연속되면 두 번째부터 줄 점수에 1.5배가 붙는다', () => {
  const game = loadGame();
  game.resetGame();
  const tetris = game.CONFIG.TETRIS_LINE_COUNT;

  const beforeFirst = game.state.score;
  game.applyLineClears(tetris, false);
  const firstGain = game.state.score - beforeFirst;
  assert.strictEqual(firstGain, 800, `첫 4줄이 ${firstGain}점이다`);
  assert.strictEqual(game.state.isBackToBack, true, '첫 4줄 후 B2B 가 서지 않았다');

  const beforeSecond = game.state.score;
  game.applyLineClears(tetris, false);
  const secondGain = game.state.score - beforeSecond;
  const comboBonus = game.comboScore(game.state.combo, game.state.level);
  const lineGain = secondGain - comboBonus;

  assert.strictEqual(game.CONFIG.B2B_MULTIPLIER, 1.5, `B2B 배수가 ${game.CONFIG.B2B_MULTIPLIER} 다`);
  assert.strictEqual(
    lineGain, 1200,
    `두 번째 4줄의 줄 점수가 ${lineGain} 다 — 800의 1.5배인 1200 이어야 한다 (콤보 보너스 ${comboBonus} 제외)`
  );
});

test('쉬운 줄 클리어는 B2B 를 끊고, 줄 없는 고정은 끊지 않는다', () => {
  const game = loadGame();
  game.resetGame();

  game.applyLineClears(game.CONFIG.TETRIS_LINE_COUNT, false);
  assert.strictEqual(game.state.isBackToBack, true, '4줄 클리어 후 B2B 가 서지 않았다');

  game.applyLineClears(0, false);
  assert.strictEqual(game.state.isBackToBack, true, '줄 없는 고정이 B2B 를 끊었다');

  game.applyLineClears(1, false);
  assert.strictEqual(game.state.isBackToBack, false, '쉬운 1줄 클리어가 B2B 를 끊지 않았다');
});

test('콤보는 연속 클리어에 누적되고 줄을 못 지우면 초기화된다', () => {
  const game = loadGame();
  game.resetGame();
  assert.strictEqual(game.state.combo, game.CONFIG.NO_COMBO, '시작 콤보가 NO_COMBO 가 아니다');

  for (let expected = 0; expected <= 2; expected++) {
    game.applyLineClears(1, false);
    assert.strictEqual(game.state.combo, expected, `${expected + 1}연속 클리어인데 콤보가 ${game.state.combo} 다`);
  }

  game.applyLineClears(0, false);
  assert.strictEqual(game.state.combo, game.CONFIG.NO_COMBO, `줄을 못 지웠는데 콤보가 ${game.state.combo} 로 남았다`);
});

test('콤보 보너스는 COMBO_POINTS × 콤보 × 레벨이다', () => {
  const game = loadGame();

  assert.strictEqual(game.comboScore(game.CONFIG.NO_COMBO, 1), 0, '콤보 없음이 0점이 아니다');
  assert.strictEqual(game.comboScore(0, 1), 0, '첫 클리어(콤보 0)가 0점이 아니다');
  assert.strictEqual(game.CONFIG.COMBO_POINTS, 50, `콤보 점수 단위가 ${game.CONFIG.COMBO_POINTS} 다`);
  assert.strictEqual(
    game.comboScore(3, 2), 300,
    `콤보 3 · 레벨 2 보너스가 ${game.comboScore(3, 2)} 다 — 50 × 3 × 2 = 300 이어야 한다`
  );
});

test('회귀: resetGame() 이 combo · isBackToBack · lastMoveWasRotation 을 초기화한다', () => {
  const game = loadGame();
  game.state.combo = 7;
  game.state.isBackToBack = true;
  game.state.lastMoveWasRotation = true;

  game.resetGame();

  assert.strictEqual(game.state.combo, game.CONFIG.NO_COMBO, `재시작 후 combo 가 ${game.state.combo} 로 남았다`);
  assert.strictEqual(game.state.isBackToBack, false, '재시작 후 isBackToBack 이 true 로 남았다');
  assert.strictEqual(game.state.lastMoveWasRotation, false, '재시작 후 lastMoveWasRotation 이 true 로 남았다');
  assert.strictEqual(game.state.score, 0, '재시작 후 점수가 0 이 아니다');
  assert.strictEqual(game.state.level, game.CONFIG.START_LEVEL, '재시작 후 레벨이 START_LEVEL 이 아니다');
  assert.strictEqual(game.state.hold, null, '재시작 후 홀드가 비지 않았다');
  assert.strictEqual(game.state.isOver, false, '재시작 후에도 게임오버 상태다');
});
