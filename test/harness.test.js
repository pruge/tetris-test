'use strict';

/** 하네스 자체의 계약 — 인스턴스 독립성과 루프 정지 */

const test = require('node:test');
const assert = require('node:assert');
const { loadGame, extractScript, HTML_PATH } = require('./harness.js');

test('loadGame() 은 호출마다 서로 독립적인 인스턴스를 만든다', () => {
  const first = loadGame();
  const second = loadGame();

  assert.notStrictEqual(first.state, second.state, '두 인스턴스가 같은 state 를 공유한다');
  assert.notStrictEqual(first.CONFIG, second.CONFIG, '두 인스턴스가 같은 CONFIG 를 공유한다');

  first.state.score = 9999;
  first.state.board[0] = 5;
  first.applyIntent({ type: 'hardDrop' });

  assert.strictEqual(second.state.score, 0, `다른 인스턴스의 점수가 ${second.state.score} 로 새어 나갔다`);
  assert.strictEqual(second.state.board[0], second.CONFIG.EMPTY, '다른 인스턴스의 보드가 오염됐다');
  assert.strictEqual(second.state.lockedCount, 0, '다른 인스턴스에서 조각이 고정됐다');
});

test('같은 시드는 같은 조각 순서를 낸다', () => {
  const draw = (seed) => {
    const game = loadGame({ seed });
    game.state.bag = [];
    return Array.from({ length: 21 }, () => game.nextPieceId()).join(',');
  };

  assert.strictEqual(draw(7), draw(7), '같은 시드인데 조각 순서가 달랐다');
  assert.notStrictEqual(draw(7), draw(8), '시드가 달라도 조각 순서가 같다 — 난수가 주입되지 않았다');
});

test('requestAnimationFrame 은 no-op 이라 게임 루프가 저절로 돌지 않는다', () => {
  const game = loadGame();
  const before = { y: game.state.piece.y, accumulator: game.state.dropAccumulatorMs };

  // 스크립트 로드가 rAF 를 예약하기는 하지만 콜백은 실행되지 않는다.
  assert.strictEqual(game.harness.rafCallbacks.length, 1, `rAF 예약이 ${game.harness.rafCallbacks.length}건이다`);
  assert.strictEqual(game.state.piece.y, before.y, '시간을 주입하지 않았는데 조각이 내려갔다');
  assert.strictEqual(game.state.dropAccumulatorMs, before.accumulator, '시간을 주입하지 않았는데 누적 시간이 늘었다');

  game.advance(1000);
  assert.strictEqual(game.state.piece.y, before.y + 1, 'advance() 로 주입한 시간이 낙하로 이어지지 않았다');
});

test('하네스는 tetris.html 을 읽기만 한다', () => {
  const source = extractScript(require('node:fs').readFileSync(HTML_PATH, 'utf8'));
  assert.ok(source.includes('function advance('), '<script> 추출이 게임 코드를 담지 못했다');
  assert.ok(!source.includes('<script'), '추출 결과에 태그가 섞였다');
  assert.strictEqual(typeof globalThis.CONFIG, 'undefined', '게임 심볼이 전역으로 새어 나갔다');
  assert.strictEqual(typeof globalThis.state, 'undefined', '게임 심볼이 전역으로 새어 나갔다');
});
