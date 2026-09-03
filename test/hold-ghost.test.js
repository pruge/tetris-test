'use strict';

/** 홀드와 고스트 — T-003c */

const test = require('node:test');
const assert = require('node:assert');
const { loadGame, fillRow, setCells } = require('./harness.js');

test('홀드는 조각당 1회만 되고, 고정되면 다시 쓸 수 있다', () => {
  const game = loadGame();
  game.resetGame();
  const firstId = game.state.piece.id;
  const secondId = game.state.queue[0];

  game.applyIntent({ type: 'hold' });
  assert.strictEqual(game.state.hold, firstId, '홀드에 원래 조각이 들어가지 않았다');
  assert.strictEqual(game.state.piece.id, secondId, '큐에서 다음 조각이 나오지 않았다');
  assert.strictEqual(game.state.canHold, false, '홀드 후에도 canHold 가 true 다');

  game.applyIntent({ type: 'hold' });
  assert.strictEqual(game.state.hold, firstId, `두 번째 홀드가 막히지 않고 보관함이 ${game.state.hold} 로 바뀌었다`);
  assert.strictEqual(game.state.piece.id, secondId, '두 번째 홀드가 막히지 않고 조각이 바뀌었다');

  game.applyIntent({ type: 'hardDrop' });
  assert.strictEqual(game.state.canHold, true, '조각이 고정됐는데 canHold 가 복구되지 않았다');

  const afterLockId = game.state.piece.id;
  game.applyIntent({ type: 'hold' });
  assert.strictEqual(game.state.piece.id, firstId, '고정 후 홀드에서 보관 중이던 조각이 나오지 않았다');
  assert.strictEqual(game.state.hold, afterLockId, '고정 후 홀드에 현재 조각이 들어가지 않았다');
});

test('교환되어 나온 조각은 rot 0 과 스폰 좌표를 갖는다', () => {
  const game = loadGame();
  game.resetGame();
  game.state.piece = { ...game.state.piece, rot: 2, x: 7, y: 11 };

  game.applyIntent({ type: 'hold' });

  assert.strictEqual(game.state.piece.rot, 0, `교환된 조각의 rot 가 ${game.state.piece.rot} 다`);
  assert.strictEqual(game.state.piece.x, game.CONFIG.SPAWN_X, `교환된 조각의 x 가 ${game.state.piece.x} 다`);
  assert.strictEqual(game.state.piece.y, game.CONFIG.SPAWN_Y, `교환된 조각의 y 가 ${game.state.piece.y} 다`);
  assert.strictEqual(game.state.lockTimerMs, null, '홀드 후 유예 타이머가 남아 있다');
  assert.strictEqual(game.state.dropAccumulatorMs, 0, '홀드 후 낙하 누적이 남아 있다');
});

test('dropPosition 결과에서 한 칸 더 내려가면 반드시 collides 다', () => {
  const game = loadGame();
  // 바닥에 높이가 다른 더미를 만들어 고스트가 지형을 따라가는지 본다.
  const board = fillRow(game, game.createBoard(), 21, [0, 1, 2]);
  setCells(game, board, [[5, 20], [6, 20], [6, 19]]);

  for (const id of game.PIECE_IDS) {
    for (let rot = 0; rot < game.CONFIG.ROTATION_STATES; rot++) {
      for (let x = 0; x <= game.CONFIG.COLS - 4; x++) {
        const piece = { id, rot, x, y: 0 };
        if (game.collides(board, piece)) continue;
        const ghost = game.dropPosition(board, piece);
        assert.strictEqual(game.collides(board, ghost), false, `고스트 자리가 이미 겹친다 (id=${id}, rot=${rot}, x=${x})`);
        assert.strictEqual(
          game.collides(board, game.movedDown(ghost)), true,
          `고스트에서 한 칸 더 내려갈 수 있다 (id=${id}, rot=${rot}, x=${x}, y=${ghost.y})`
        );
        assert.strictEqual(ghost.x, piece.x, '고스트가 가로로 움직였다');
        assert.strictEqual(ghost.rot, piece.rot, '고스트가 회전했다');
      }
    }
  }
});

test('하드 드롭은 고스트 위치에 조각을 고정한다', () => {
  const game = loadGame();
  game.resetGame();
  game.state.board = game.createBoard();
  const ghost = game.dropPosition(game.state.board, game.state.piece);
  const lockedBefore = game.state.lockedCount;

  game.applyIntent({ type: 'hardDrop' });

  assert.strictEqual(game.state.lockedCount, lockedBefore + 1, '하드 드롭이 조각을 고정하지 않았다');
  for (const [col, row] of game.pieceCells(ghost)) {
    assert.strictEqual(
      game.state.board[game.cellIndex(col, row)], ghost.id,
      `고스트 자리 (${col},${row}) 에 조각이 고정되지 않았다`
    );
  }
});
