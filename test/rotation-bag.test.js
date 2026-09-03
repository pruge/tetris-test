'use strict';

/** 회전과 생성 — T-003a (SRS 월킥 + 7-bag) */

const test = require('node:test');
const assert = require('node:assert');
const { loadGame, setCells } = require('./harness.js');

test('빈 보드에서 회전하면 [0,0] 오프셋이 채택되어 x·y 가 변하지 않는다', () => {
  const game = loadGame();
  const board = game.createBoard();

  for (const id of game.PIECE_IDS) {
    for (let rot = 0; rot < game.CONFIG.ROTATION_STATES; rot++) {
      const piece = { id, rot, x: 4, y: 8 };
      for (const dir of [game.CONFIG.ROTATE_CW_DIR, game.CONFIG.ROTATE_CCW_DIR]) {
        const turned = game.tryRotate(board, piece, dir);
        assert.notStrictEqual(turned, null, `빈 보드에서 회전이 실패했다 (id=${id}, rot=${rot}, dir=${dir})`);
        assert.strictEqual(turned.x, piece.x, `빈 보드 회전인데 x 가 밀렸다 (id=${id}, rot=${rot}, dir=${dir})`);
        assert.strictEqual(turned.y, piece.y, `빈 보드 회전인데 y 가 밀렸다 (id=${id}, rot=${rot}, dir=${dir})`);
      }
    }
  }
});

test('좌벽에 붙은 세로 I 가 월킥으로 회전에 성공한다', () => {
  const game = loadGame();
  const board = game.createBoard();
  // rot 1 의 I 는 x+2 열을 차지한다. x=-2 면 0열에 딱 붙어 있다.
  const vertical = { id: game.CONFIG.I_PIECE_ID, rot: 1, x: -2, y: 0 };
  assert.strictEqual(game.collides(board, vertical), false, '세로 I 시작 위치가 이미 겹친다');

  const turned = game.tryRotate(board, vertical, game.CONFIG.ROTATE_CCW_DIR);

  assert.notStrictEqual(turned, null, '좌벽에 붙은 세로 I 의 회전이 월킥 없이 실패했다');
  assert.strictEqual(game.collides(board, turned), false, '월킥 결과가 벽과 겹친다');
  assert.strictEqual(turned.x, 0, `월킥 오프셋이 [2,0] 이 아니다 (x=${turned.x})`);
  assert.notStrictEqual(turned.x, vertical.x, '월킥이 전혀 밀지 않았다');
});

test('5개 오프셋이 모두 막히면 tryRotate 가 null 을 반환한다', () => {
  const game = loadGame();
  // 현재 T 조각이 차지한 4칸만 비우고 나머지를 전부 채운다.
  const board = game.createBoard().fill(1);
  const piece = { id: game.CONFIG.T_PIECE_ID, rot: 0, x: 3, y: 10 };
  setCells(game, board, game.pieceCells(piece), game.CONFIG.EMPTY);
  assert.strictEqual(game.collides(board, piece), false, '현재 위치부터 겹쳐 있으면 시험이 성립하지 않는다');

  assert.strictEqual(game.tryRotate(board, piece, game.CONFIG.ROTATE_CW_DIR), null, '모두 막혔는데 시계 회전이 성공했다');
  assert.strictEqual(game.tryRotate(board, piece, game.CONFIG.ROTATE_CCW_DIR), null, '모두 막혔는데 반시계 회전이 성공했다');
});

test('O 조각은 회전해도 셀 좌표 집합이 변하지 않는다', () => {
  const game = loadGame();
  const board = game.createBoard();
  // O 는 네 회전 상태의 모양이 모두 같은 조각이다. id 를 데이터에서 찾는다.
  const oPieceId = game.PIECE_IDS.find((id) => {
    const states = game.CONFIG.SHAPES[id].map((cells) => JSON.stringify(cells));
    return states.every((cells) => cells === states[0]);
  });
  assert.notStrictEqual(oPieceId, undefined, 'SHAPES 에서 O 조각을 찾지 못했다');
  let piece = { id: oPieceId, rot: 0, x: 4, y: 6 };
  const cellsBefore = JSON.stringify(game.pieceCells(piece));

  for (let i = 0; i < game.CONFIG.ROTATION_STATES; i++) {
    piece = game.tryRotate(board, piece, game.CONFIG.ROTATE_CW_DIR);
    assert.notStrictEqual(piece, null, 'O 조각 회전이 실패했다');
    assert.strictEqual(
      JSON.stringify(game.pieceCells(piece)), cellsBefore,
      `O 조각이 rot ${piece.rot} 에서 다른 칸을 차지한다`
    );
  }
});

test('bag 경계에서 nextPieceId() 를 70회 부르면 각 조각이 정확히 10회 나온다', () => {
  const game = loadGame();
  game.state.bag = [];   // 전제: bag 이 비어 있는 경계에서 시작한다

  const counts = new Map(game.PIECE_IDS.map((id) => [id, 0]));
  for (let i = 0; i < 70; i++) {
    const id = game.nextPieceId();
    assert.ok(counts.has(id), `알 수 없는 조각 id 가 나왔다: ${id}`);
    counts.set(id, counts.get(id) + 1);
  }

  for (const [id, count] of counts) {
    assert.strictEqual(count, 10, `조각 ${id} 가 10회가 아니라 ${count}회 나왔다`);
  }
});

test('같은 조각 id 가 3연속으로 나오지 않는다', () => {
  for (const seed of [1, 7, 42, 1234]) {
    const game = loadGame({ seed });
    game.state.bag = [];
    const drawn = [];
    for (let i = 0; i < 700; i++) drawn.push(game.nextPieceId());

    for (let i = 2; i < drawn.length; i++) {
      const isTriple = drawn[i] === drawn[i - 1] && drawn[i] === drawn[i - 2];
      assert.strictEqual(isTriple, false, `seed ${seed}, ${i - 2}번째부터 ${drawn[i]} 이 3연속으로 나왔다`);
    }
  }
});

test('state.queue.length 는 항상 CONFIG.QUEUE_SIZE 이상이다', () => {
  const game = loadGame();
  const min = game.CONFIG.QUEUE_SIZE;
  assert.ok(game.state.queue.length >= min, `로드 직후 큐가 ${game.state.queue.length} 개다`);

  for (let i = 0; i < 30; i++) {
    game.takeQueuedPieceId();
    assert.ok(game.state.queue.length >= min, `${i}회 소비 후 큐가 ${game.state.queue.length} 개다`);
  }

  game.resetGame();
  assert.ok(game.state.queue.length >= min, `resetGame 직후 큐가 ${game.state.queue.length} 개다`);

  for (let i = 0; i < 10; i++) {
    game.applyIntent({ type: 'hardDrop' });
    assert.ok(game.state.queue.length >= min, `${i}회 고정 후 큐가 ${game.state.queue.length} 개다`);
  }
});
