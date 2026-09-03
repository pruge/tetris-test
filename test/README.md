# 테스트

실행: `node --test test/` — 외부 의존성·package.json·빌드 단계 없이 Node 내장 러너만 쓴다.

`harness.js` 는 `tetris.html` 의 `<script>` 를 읽어 함수 본문으로 감싸 실행하고 내부 심볼(`CONFIG`, `state`, `collides`, `advance` …)을 돌려준다. 게임 코드는 한 줄도 고치지 않는다.
DOM·`localStorage`·`getComputedStyle` 은 최소 스텁이고 `requestAnimationFrame` 은 no-op 이다 — 시간은 테스트가 `advance(deltaMs)` 로 직접 주입한다.
`loadGame()` 은 호출마다 새 인스턴스라 테스트끼리 상태를 공유하지 않는다. 7-bag 셔플은 `loadGame({ seed })`, 저장소는 `{ storage }` / `{ localStorage }` 로 고정한다.
`index.js` 는 Node v24 가 `--test` 의 위치 인자로 디렉터리를 뒤지지 않아 둔 진입점이다. `test/*.test.js` 를 전부 등록한다.
파일: `purity` / `rotation-bag` / `lock-path` / `gravity` / `hold-ghost` / `scoring` / `highscore` / `harness` / `reset-completeness` / `touch` (각 `*.test.js`).
`reset-completeness` 는 필드를 열거하지 않는다 — 갓 로드한 `state` 를 기준으로 통째 비교하므로 새 필드가 늘면 자동으로 검사 대상이 된다.
터치 제스처는 `performance.now()` 가 읽는 시계를 하네스가 쥐고 있다 — `loadGame({ clock })` 로 주입하거나 `harness.clock.advance(ms)` 로 민다. 기본 시계는 0 에 멈춰 있어 밀지 않는 테스트에는 없는 것과 같다. `touch` 테스트는 `handleTouchStart` / `handleTouchMove` / `handleTouchEnd` 를 직접 불러 탭·좌우 스와이프·빠른/느린 아래 스와이프의 판정을 확인한다(핸들러는 canvas 에 붙어 있고 스텁 `addEventListener` 는 no-op 이라 디스패치는 도달하지 않는다).
미포함: 렌더링·레이아웃·CSS·오버레이 시각 상태(하네스 범위 밖), 화면 버튼(`bindTouchButton`)의 DOM 바인딩, 실제 키 이벤트 디스패치.
