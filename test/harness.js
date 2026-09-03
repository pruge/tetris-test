'use strict';

/**
 * tetris.html 의 <script> 를 그대로 실행해 내부 심볼을 돌려주는 테스트 하네스.
 *
 * 게임 코드는 한 줄도 고치지 않는다. 테스트가 프로덕션 코드에 맞춘다.
 * 스크립트 본문을 함수 본문으로 감싸 실행하므로 최상위 const/function 이
 * 그대로 지역 심볼이 되고, 끝에 붙인 return 문으로 그것들을 꺼낸다.
 * 전역을 오염시키지 않고, 호출할 때마다 완전히 새 인스턴스가 나온다.
 */

const fs = require('node:fs');
const path = require('node:path');

const HTML_PATH = path.join(__dirname, '..', 'tetris.html');

/** 보드 픽스처를 채울 때 쓰는 조각 id. 아무 유효한 id 면 된다. */
const FILLER_ID = 1;

/** 하네스가 꺼내오는 내부 심볼. 게임 코드의 최상위 선언 이름 그대로다. */
const EXPORTED_SYMBOLS = [
  // CONFIG
  'CONFIG', 'PIECE_IDS', 'VISIBLE_ROWS', 'MAX_LEVEL',
  // LOGIC — 순수 함수
  'createBoard', 'cellIndex', 'pieceCells', 'collides', 'lockPiece', 'isRowFull',
  'clearLines', 'lineClearScore', 'tSpinScore', 'comboScore', 'isHardClear',
  'clearScore', 'isBlockedCell', 'isTSpin', 'levelForClearedLines',
  'levelIntervalMs', 'movedDown', 'movedBy', 'rotated', 'spawnPiece',
  'kickOffsets', 'tryRotate', 'dropPosition', 'shuffled',
  // PERSISTENCE
  'loadHighScore', 'saveHighScore', 'maybeSaveHighScore',
  // STATE
  'state', 'ui', 'input', 'nextPieceId', 'refillQueue', 'takeQueuedPieceId',
  // INPUT
  'pushIntent', 'takeIntents', 'updateAutoRepeat', 'startHorizontalHold',
  'stopHorizontalHold', 'clearHeldKeys', 'handleKeyDown', 'handleKeyUp',
  'handleTouchStart', 'handleTouchMove', 'handleTouchEnd',
  // LOOP
  'isPieceLanded', 'clearLockTimer', 'noteLockReset', 'applyLineClears',
  'lockAndSpawn', 'stepDown', 'updateLockTimer', 'hardDrop', 'holdCurrentPiece',
  'applyIntent', 'dropIntervalMs', 'isHalted', 'setPaused', 'togglePause',
  'resetGame', 'advance', 'render',
];

let cachedSource = null;

/** tetris.html 에서 <script> 본문만 뽑는다. */
function extractScript(html) {
  const pattern = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
  const bodies = [];
  let match = pattern.exec(html);
  while (match !== null) {
    bodies.push(match[1]);
    match = pattern.exec(html);
  }
  if (bodies.length === 0) {
    throw new Error(`tetris.html 에서 <script> 를 찾지 못했다: ${HTML_PATH}`);
  }
  return bodies.join('\n');
}

function gameSource() {
  if (cachedSource === null) {
    cachedSource = extractScript(fs.readFileSync(HTML_PATH, 'utf8'));
  }
  return cachedSource;
}

/** 시드가 같으면 항상 같은 수열. 테스트가 7-bag 셔플에 좌우되지 않게 한다. */
function makeRandom(seed) {
  let a = (seed >>> 0) || 1;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 테스트가 명시적으로 밀어 올리는 시계. 실제 시간은 흐르지 않는다.
 *
 * 게임의 `performance.now()` 가 이 값을 읽는다. 시작값 0 에서 아무도 밀지
 * 않으면 계속 0 이라, 시계를 쓰지 않는 테스트에는 기존 스텁과 구별되지 않는다.
 * `advance(deltaMs)` 가 델타를 받는 것은 게임의 `advance(deltaMs)` 와 같은 규약이다.
 */
function makeClock(startMs = 0) {
  let nowMs = startMs;
  return {
    now: () => nowMs,
    advance(deltaMs) { nowMs += deltaMs; return nowMs; },
    set(ms) { nowMs = ms; return nowMs; },
  };
}

/** canvas 2d 컨텍스트 스텁. 전부 no-op — 렌더링은 하네스 범위 밖이다. */
function makeContext2d() {
  const noop = () => {};
  return {
    canvas: null,
    fillStyle: '', strokeStyle: '', lineWidth: 0, globalAlpha: 1,
    save: noop, restore: noop, clearRect: noop, fillRect: noop, strokeRect: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop,
  };
}

function makeElement(id) {
  const context2d = makeContext2d();
  const classes = new Set();
  const element = {
    id,
    width: 0,
    height: 0,
    textContent: '',
    hidden: false,
    style: {},
    classList: {
      add: (name) => { classes.add(name); },
      remove: (name) => { classes.delete(name); },
      contains: (name) => classes.has(name),
      toggle: (name, force) => {
        const next = force === undefined ? !classes.has(name) : force;
        if (next) classes.add(name); else classes.delete(name);
        return next;
      },
    },
    getContext: () => context2d,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  context2d.canvas = element;
  return element;
}

function makeDocument() {
  const elements = new Map();
  return {
    hidden: false,
    documentElement: { id: 'documentElement' },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

/** Map 하나로 버티는 localStorage 스텁. */
function makeLocalStorage(initial) {
  const store = new Map(Object.entries(initial || {}));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
  };
}

/** 모든 접근이 던지는 localStorage. file:// 제한·사생활 모드를 흉내낸다. */
function makeThrowingLocalStorage() {
  const boom = () => { throw new Error('localStorage 를 쓸 수 없다'); };
  return { getItem: boom, setItem: boom, removeItem: boom, clear: boom };
}

/**
 * 게임 인스턴스를 새로 만든다. 호출마다 완전히 독립적이다.
 *
 * options.seed            7-bag 셔플 시드 (기본 1)
 * options.random          시드 대신 쓸 난수 함수
 * options.storage         localStorage 초기 내용 { key: value }
 * options.localStorage    localStorage 스텁 자체를 교체 (예외 주입용)
 * options.clock           performance.now() 가 읽을 시계 (기본 makeClock() — 0 에서 정지)
 */
function loadGame(options = {}) {
  const logs = [];
  const clock = options.clock || makeClock();
  const documentStub = makeDocument();
  const localStorage = options.localStorage || makeLocalStorage(options.storage);
  const windowStub = {
    document: documentStub,
    localStorage,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const consoleStub = {
    log: (...args) => { logs.push(args.join(' ')); },
    warn: (...args) => { logs.push(args.join(' ')); },
    error: (...args) => { logs.push(args.join(' ')); },
  };
  // requestAnimationFrame 은 no-op 이다. 실제 루프가 돌면 안 된다 —
  // 테스트는 advance(deltaMs) 로 시간을 직접 주입한다.
  const rafCallbacks = [];
  const requestAnimationFrame = (callback) => rafCallbacks.push(callback);
  const mathStub = Object.assign(Object.create(Math), {
    random: options.random || makeRandom(options.seed === undefined ? 1 : options.seed),
  });

  const factory = new Function(
    'window', 'document', 'localStorage', 'getComputedStyle',
    'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'console', 'Math',
    // performance 는 게임의 최상위 선언이 아니라 하네스가 주입한 바인딩이다.
    // 게임이 실제로 어느 시계를 보는지 테스트가 확인할 수 있게 함께 꺼낸다.
    `${gameSource()}\n;return { ${EXPORTED_SYMBOLS.join(', ')}, performance };`
  );

  const symbols = factory(
    windowStub,
    documentStub,
    localStorage,
    () => ({ getPropertyValue: () => '#000000' }),
    requestAnimationFrame,
    () => {},
    { now: () => clock.now() },
    consoleStub,
    mathStub
  );

  return {
    ...symbols,
    harness: { logs, localStorage, document: documentStub, rafCallbacks, clock },
  };
}

/* ---- 테스트 픽스처 헬퍼. 프로덕션 함수가 아니다. ---- */

/** row 를 통째로 채운다. except 에 든 열은 비워 둔다. board 를 그대로 돌려준다. */
function fillRow(game, board, row, except = []) {
  for (let col = 0; col < game.CONFIG.COLS; col++) {
    if (except.includes(col)) continue;
    board[game.cellIndex(col, row)] = FILLER_ID;
  }
  return board;
}

/** [col, row] 목록을 채운다. */
function setCells(game, board, cells, value = FILLER_ID) {
  for (const [col, row] of cells) board[game.cellIndex(col, row)] = value;
  return board;
}

module.exports = {
  loadGame,
  makeLocalStorage,
  makeThrowingLocalStorage,
  makeRandom,
  makeClock,
  extractScript,
  fillRow,
  setCells,
  FILLER_ID,
  HTML_PATH,
};
