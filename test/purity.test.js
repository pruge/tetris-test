'use strict';

/** 순수성 — T-001 · T-002 · T-003a · T-003c · T-005a
 *  로직 함수는 인자를 변형하지 않고, 보드 함수는 새 Uint8Array 를 돌려준다. */

const test = require('node:test');
const assert = require('node:assert');
const { loadGame, fillRow, setCells } = require('./harness.js');

/** 보드와 조각을 함께 만드는 픽스처. 바닥 한 줄이 거의 차 있다. */
function fixture() {
  const game = loadGame();
  const board = fillRow(game, game.createBoard(), 21, [9]);
  setCells(game, board, [[0, 20], [1, 20]]);
  const piece = { id: game.CONFIG.T_PIECE_ID, rot: 0, x: 3, y: 5 };
  return { game, board, piece };
}

test('collides 는 board 와 piece 를 읽기만 한다', () => {
  const { game, board, piece } = fixture();
  const boardBefore = board.slice();
  const pieceBefore = { ...piece };

  game.collides(board, piece);

  assert.deepStrictEqual(board, boardBefore, 'collides 가 board 를 변형했다');
  assert.deepStrictEqual(piece, pieceBefore, 'collides 가 piece 를 변형했다');
});

test('lockPiece 는 인자를 변형하지 않고 새 Uint8Array 를 반환한다', () => {
  const { game, board, piece } = fixture();
  const boardBefore = board.slice();
  const pieceBefore = { ...piece };

  const next = game.lockPiece(board, piece);

  assert.ok(next instanceof Uint8Array, `lockPiece 반환값이 Uint8Array 가 아니다: ${next && next.constructor && next.constructor.name}`);
  assert.notStrictEqual(next, board, 'lockPiece 가 인자 board 를 그대로 반환했다');
  assert.deepStrictEqual(board, boardBefore, 'lockPiece 가 인자 board 를 변형했다');
  assert.deepStrictEqual(piece, pieceBefore, 'lockPiece 가 piece 를 변형했다');
  for (const [col, row] of game.pieceCells(piece)) {
    assert.strictEqual(next[game.cellIndex(col, row)], piece.id, `고정된 셀 (${col},${row}) 에 조각 id 가 없다`);
  }
});

test('clearLines 는 인자를 변형하지 않고 새 Uint8Array 를 반환한다', () => {
  const { game } = fixture();
  const board = fillRow(game, game.createBoard(), 21);
  const boardBefore = board.slice();

  const result = game.clearLines(board);

  assert.ok(result.board instanceof Uint8Array, 'clearLines 가 Uint8Array 를 반환하지 않았다');
  assert.notStrictEqual(result.board, board, 'clearLines 가 인자 board 를 그대로 반환했다');
  assert.deepStrictEqual(board, boardBefore, 'clearLines 가 인자 board 를 변형했다');
  assert.deepStrictEqual(result.clearedRows, [21], '지운 행 번호가 예상과 다르다');
});

test('rotated · movedBy · movedDown · tryRotate · dropPosition 은 piece 를 변형하지 않는다', () => {
  const { game, board, piece } = fixture();
  const boardBefore = board.slice();
  const pieceBefore = { ...piece };

  const calls = {
    rotated: game.rotated(piece, game.CONFIG.ROTATE_CW_DIR),
    movedBy: game.movedBy(piece, 1, 2),
    movedDown: game.movedDown(piece),
    tryRotate: game.tryRotate(board, piece, game.CONFIG.ROTATE_CW_DIR),
    dropPosition: game.dropPosition(board, piece),
  };

  assert.deepStrictEqual(piece, pieceBefore, '어떤 함수가 인자 piece 를 변형했다');
  assert.deepStrictEqual(board, boardBefore, '어떤 함수가 인자 board 를 변형했다');
  for (const [name, produced] of Object.entries(calls)) {
    assert.notStrictEqual(produced, piece, `${name} 이 인자 piece 를 그대로 반환했다`);
  }
});

test('점수 계산 함수는 인자 객체를 변형하지 않는다', () => {
  const { game } = fixture();
  const args = { clearedCount: 4, level: 3, tSpin: false, backToBack: true, combo: 2 };
  const argsBefore = { ...args };

  const first = game.clearScore(args);
  const second = game.clearScore(args);

  assert.deepStrictEqual(args, argsBefore, 'clearScore 가 인자 객체를 변형했다');
  assert.strictEqual(first, second, 'clearScore 가 같은 입력에 다른 값을 냈다');
});

test('shuffled 는 원본 배열을 변형하지 않고 같은 원소 집합을 돌려준다', () => {
  const { game } = fixture();
  const items = game.PIECE_IDS;
  const itemsBefore = items.slice();

  const next = game.shuffled(items);

  assert.deepStrictEqual(items, itemsBefore, 'shuffled 가 원본 배열을 변형했다');
  assert.notStrictEqual(next, items, 'shuffled 가 원본 배열을 그대로 반환했다');
  assert.deepStrictEqual(next.slice().sort(), itemsBefore.slice().sort(), 'shuffled 가 원소 집합을 바꿨다');
});
