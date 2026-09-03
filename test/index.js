'use strict';

/**
 * `node --test test/` 의 진입점.
 *
 * Node v24 는 --test 의 위치 인자를 "디렉터리를 뒤져라" 가 아니라 "이 경로를
 * 실행해라" 로 다룬다. 그래서 test/ 는 CommonJS 디렉터리 해석으로 이 파일에
 * 걸린다. 여기서 test/*.test.js 를 전부 require 해 같은 프로세스에 등록한다.
 * 파일 목록을 손으로 관리하지 않는다 — 새 테스트 파일은 그냥 놓으면 된다.
 */

const fs = require('node:fs');
const path = require('node:path');

const files = fs.readdirSync(__dirname)
  .filter((name) => name.endsWith('.test.js'))
  .sort();

if (files.length === 0) throw new Error('test/ 에 *.test.js 가 없다');

for (const name of files) require(path.join(__dirname, name));
