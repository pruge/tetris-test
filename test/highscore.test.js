'use strict';

/** 최고 점수 — T-005b
 *  localStorage 를 쓸 수 없어도 게임이 죽지 않아야 한다. */

const test = require('node:test');
const assert = require('node:assert');
const { loadGame, makeThrowingLocalStorage } = require('./harness.js');

/** 게임오버 프레임을 한 번 흉내낸다. 저장 시도는 게임오버당 1회다. */
function reportGameOver(game, score) {
  game.state.score = score;
  game.state.isOver = true;
  game.ui.highScoreSaved = false;
  game.maybeSaveHighScore(game.state);
}

test('저장된 최고 점수를 읽어 온다', () => {
  const game = loadGame({ storage: { 'tetris-neon-high-score': '4200' } });
  assert.strictEqual(game.state.highScore, 4200, `저장값을 못 읽었다 (highScore=${game.state.highScore})`);
});

test('저장값보다 높은 점수만 최고 점수를 갱신한다', () => {
  const key = loadGame().CONFIG.HIGH_SCORE_KEY;
  const game = loadGame({ storage: { [key]: '500' } });

  reportGameOver(game, 100);
  assert.strictEqual(game.state.highScore, 500, `낮은 점수가 최고 점수를 ${game.state.highScore} 로 덮어썼다`);
  assert.strictEqual(game.harness.localStorage.getItem(key), '500', '낮은 점수가 저장까지 됐다');

  reportGameOver(game, 900);
  assert.strictEqual(game.state.highScore, 900, `높은 점수가 반영되지 않았다 (highScore=${game.state.highScore})`);
  assert.strictEqual(game.harness.localStorage.getItem(key), '900', `저장된 값이 ${game.harness.localStorage.getItem(key)} 다`);

  reportGameOver(game, 899);
  assert.strictEqual(game.state.highScore, 900, '더 낮은 점수가 최고 점수를 내렸다');
});

test('저장은 게임오버당 한 번만 시도한다', () => {
  const key = loadGame().CONFIG.HIGH_SCORE_KEY;
  const game = loadGame();
  reportGameOver(game, 700);
  assert.strictEqual(game.state.highScore, 700, '첫 저장이 되지 않았다');

  // 같은 게임오버가 계속 렌더링돼도 다시 저장하지 않는다.
  game.state.score = 5000;
  game.maybeSaveHighScore(game.state);
  assert.strictEqual(game.state.highScore, 700, '같은 게임오버에서 두 번 저장됐다');
  assert.strictEqual(game.harness.localStorage.getItem(key), '700', '같은 게임오버에서 저장값이 바뀌었다');

  // 게임이 다시 진행되면 다음 게임오버에서 또 저장할 수 있다.
  game.state.isOver = false;
  game.maybeSaveHighScore(game.state);
  assert.strictEqual(game.ui.highScoreSaved, false, '게임 재개 후 저장 플래그가 풀리지 않았다');
});

test('localStorage 가 예외를 던져도 게임이 죽지 않는다', () => {
  const game = loadGame({ localStorage: makeThrowingLocalStorage() });

  assert.strictEqual(game.state.highScore, 0, `읽기 실패인데 highScore 가 ${game.state.highScore} 다`);
  assert.doesNotThrow(() => game.saveHighScore(1234), '저장 실패가 예외로 새어 나왔다');
  assert.doesNotThrow(() => reportGameOver(game, 1234), '게임오버 저장이 예외로 새어 나왔다');
  assert.strictEqual(game.state.highScore, 1234, '저장이 막혀도 세션 내 최고 점수는 유지돼야 한다');

  game.resetGame();
  assert.doesNotThrow(() => game.advance(16), '저장 실패 후 게임 루프가 죽었다');
  assert.strictEqual(game.state.isOver, false, '저장 실패 후 게임이 종료 상태가 됐다');
});

test('저장값이 숫자가 아니면 0 으로 시작한다', () => {
  const key = loadGame().CONFIG.HIGH_SCORE_KEY;
  const game = loadGame({ storage: { [key]: '망가진값' } });
  assert.strictEqual(game.state.highScore, 0, `깨진 저장값이 ${game.state.highScore} 로 들어왔다`);
});
