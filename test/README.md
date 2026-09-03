# 테스트

실행: `node --test test/` — 외부 의존성·package.json·빌드 단계 없이 Node 내장 러너만 쓴다.

`harness.js` 는 `tetris.html` 의 `<script>` 를 읽어 함수 본문으로 감싸 실행하고 내부 심볼(`CONFIG`, `state`, `collides`, `advance` …)을 돌려준다. 게임 코드는 한 줄도 고치지 않는다.
DOM·`localStorage`·`getComputedStyle` 은 최소 스텁이고 `requestAnimationFrame` 은 no-op 이다 — 시간은 테스트가 `advance(deltaMs)` 로 직접 주입한다.
`loadGame()` 은 호출마다 새 인스턴스라 테스트끼리 상태를 공유하지 않는다. 7-bag 셔플은 `loadGame({ seed })`, 저장소는 `{ storage }` / `{ localStorage }` 로 고정한다.
`index.js` 는 Node v24 가 `--test` 의 위치 인자로 디렉터리를 뒤지지 않아 둔 진입점이다. `test/*.test.js` 를 전부 등록한다.
파일: `purity` / `rotation-bag` / `lock-path` / `gravity` / `hold-ghost` / `scoring` / `highscore` / `harness` (각 `*.test.js`).
미포함: 렌더링·레이아웃·CSS·오버레이 시각 상태(하네스 범위 밖), 터치 제스처(`performance.now()` 스텁이 0 고정이라 탭·스와이프의 시간 판정을 재현할 수 없다), 실제 키 이벤트 디스패치.
