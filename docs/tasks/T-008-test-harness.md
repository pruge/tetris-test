# T-008 — 테스트 하네스와 소급 테스트

Phase: - (워크플로 부채) · Status: Ready · Depends on: T-005a (`29c6bef`), T-005b (`5cb0763`)

## Summary

T-001 ~ T-005b 는 수용 기준 60여 개를 전부 **일회성 브라우저 관측**으로
검증했다. 재현 가능한 형태로 남은 것이 하나도 없어, 앞 태스크의 회귀
항목을 매번 손으로 다시 확인해야 한다. 이 부채를 갚는다.

`tetris.html` 의 `<script>` 를 그대로 실행하는 테스트 하네스를 만들고,
지금까지의 수용 기준 중 결정적으로 재현 가능한 것들을 테스트로 옮긴다.

## 기존 코드에서 반드시 지킬 것

- **`tetris.html` 을 수정하지 마라.** 한 줄도. 테스트가 프로덕션 코드에
  맞춘다. 테스트 편의를 위한 export 나 훅을 게임 코드에 넣지 마라.
  (`git diff` 에 `tetris.html` 이 나오면 실패다.)
- 외부 의존성 금지. `package.json`, `node_modules`, 빌드 단계 없이
  `node --test test/` 하나로 돌아야 한다.
- 게임은 여전히 브라우저에서 파일을 직접 열어 동작해야 한다.

## 하네스 설계

`test/harness.js`:
- `tetris.html` 을 읽어 `<script>` ... `</script>` 사이를 추출한다.
- 최소 DOM 스텁을 만든다: `document.getElementById` 가 canvas 유사 객체를
  돌려주고, `getContext('2d')` 가 no-op 메서드를 가진 객체를 돌려준다.
  `window`, `localStorage`, `requestAnimationFrame`, `getComputedStyle`,
  `document.addEventListener` 등 스크립트가 로드 시점에 만지는 것을 채운다.
- **`requestAnimationFrame` 은 no-op 이어야 한다.** 실제 루프가 돌면 안 된다.
  테스트는 `advance(deltaMs)` 를 직접 호출해 시간을 주입한다.
- 스크립트를 실행하고 내부 심볼(`CONFIG`, `state`, `collides`, `lockPiece`,
  `clearLines`, `tryRotate`, `rotated`, `movedBy`, `dropPosition`,
  `nextPieceId`, `applyIntent`, `advance`, `resetGame`, ...)을 돌려준다.
- **매 테스트가 독립적이어야 한다.** 하네스는 호출할 때마다 새 인스턴스를
  만들거나, 각 테스트가 `resetGame()` 으로 초기화할 수 있어야 한다.

## 테스트로 옮길 항목

브라우저 렌더링·레이아웃·시각 상태는 제외한다. 아래는 전부 결정적이다.

**순수성 (T-001·002·003a·003c·005a)**
- `collides`, `lockPiece`, `clearLines`, `tryRotate`, `rotated`, `movedBy`,
  `dropPosition`, 점수 계산 함수가 인자를 변형하지 않는다
- `lockPiece`/`clearLines` 가 새 `Uint8Array` 를 반환한다

**회전과 생성 (T-003a)**
- 빈 보드에서 회전 시 `[0,0]` 오프셋 채택 (x·y 불변)
- 좌벽에 붙은 세로 I 가 월킥으로 회전 성공
- 5개 오프셋이 모두 막히면 `tryRotate` 가 `null`
- O 조각은 회전해도 셀 좌표 집합 불변
- bag 경계에서 `nextPieceId()` 70회 → 각 조각 정확히 10회
- 같은 id 가 3연속으로 나오지 않는다
- `state.queue.length >= CONFIG.QUEUE_SIZE` 가 항상 성립

**고정 경로 (T-003b)**
- 접지 후 `advance(499)` 에 고정 안 됨, `advance(2)` 에 고정
- 유예 중 이동이 타이머를 리셋하고, 벽에 막힌 이동은 리셋하지 않는다
- 리셋 상한 `LOCK_RESET_LIMIT` 도달 후 더 리셋되지 않는다
- 가득 찬 행이 지워지고 위 행이 내려온다
- 4줄 클리어 800점, 10줄에 레벨업, 레벨별 낙하 간격이 짧아진다

**낙하 속도 (T-001 기준 3)**
- 같은 총 시간을 다른 델타로 쪼개 주입해도 이동 칸 수가 같다

**홀드·고스트 (T-003c)**
- 홀드 1회 제한, 고정 후 `canHold` 복구
- 교환된 조각이 `rot 0` + 스폰 좌표
- `dropPosition` 결과에서 한 칸 더 내려가면 `collides`

**점수 규칙 (T-005a)**
- T-스핀 싱글 800점, 일반 싱글 100점
- 회전으로 진입하면 T-스핀, 이동으로 진입하면 아님
- 4줄 연속 2회에서 두 번째에 B2B 1.5배
- 쉬운 줄 클리어가 B2B 를 끊고, 줄 없는 고정은 끊지 않는다
- 콤보가 누적되고 줄을 못 지우면 0으로 초기화
- `resetGame()` 이 `combo`/`isBackToBack`/`lastMoveWasRotation` 을 초기화한다
  (실제 있었던 결함이다 — 회귀 테스트로 남긴다)

**최고 점수 (T-005b)**
- 저장값보다 높은 점수만 갱신된다
- `localStorage` 가 예외를 던져도 게임이 죽지 않는다

## Acceptance criteria

1. `node --test test/` 가 통과한다. 전체 실행 시간과 테스트 개수를 보고한다.
2. `git diff` 에 `tetris.html` 이 **나오지 않는다.**
3. `package.json` 과 `node_modules` 가 없고 외부 import 가 없다.
   `grep -rn "require(\|from '" test/` 결과가 Node 내장 모듈뿐임을 보인다.
4. 테스트가 서로 독립적이다. 파일 내 순서를 뒤집어도 통과함을 보인다.
5. 위 "테스트로 옮길 항목" 의 각 묶음이 최소 1개 이상의 테스트로 덮인다.
   묶음별 테스트 개수를 표로 보고한다.
6. 낙하 속도 테스트가 실제로 프레임레이트 독립성을 검증한다. 어떤 델타
   분할을 썼는지 적는다.
7. `resetGame()` 회귀 테스트가 있고, `combo` 초기화를 일부러 지우면
   **그 테스트가 실패한다.** 실패를 확인하고 원복한 뒤 보고한다.
8. 브라우저에서 `tetris.html` 을 직접 열었을 때 여전히 정상 동작한다
   (콘솔 에러 0건, 조각이 낙하).
9. 테스트가 실패했을 때 원인을 알 수 있는 메시지를 낸다. 일부러 하나를
   깨뜨려 실제 출력 메시지를 붙여라.
10. `test/README.md` 에 실행 방법과 하네스 구조를 10줄 이내로 적는다.

## Out of scope / 하지 말 것

- `tetris.html` 을 리팩터링하지 마라. 테스트하기 쉽게 바꾸는 것도 금지다.
- 렌더링·레이아웃·CSS 를 테스트하지 마라. 하네스 범위 밖이다.
- 테스트 프레임워크를 도입하지 마라 (jest, vitest 등).
- 커버리지 도구를 붙이지 마라.
- 실패하는 테스트를 남기지 마라. 못 덮는 항목은 `test/README.md` 에
  "미포함" 으로 적는다.

## Verification

`node --test test/` 를 실제로 실행하고 출력을 근거로 쓴다.
기준 7 과 9 는 일부러 깨뜨려 확인하고 반드시 원복한다.

## 최종 출력 형식

수용 기준 10개에 대해 **정확히 10줄**:
`N. 충족|미충족|미검증 — <근거: 관측값 또는 코드 위치>`
기준 1 은 테스트 개수와 시간, 기준 5 는 묶음별 개수를 적는다.
그 다음 `test:` 커밋. 본문에 `T-008`.
