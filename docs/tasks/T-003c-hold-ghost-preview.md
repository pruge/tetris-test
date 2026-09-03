# T-003c — 보조 표시: 홀드, 고스트, 다음 조각 미리보기

Phase: 2 · Status: Ready · Depends on: T-003a (`08138de`)

## Summary

플레이를 돕는 세 가지를 추가한다. 조각을 보관했다 꺼내는 **홀드**, 현재
조각이 떨어질 자리를 반투명으로 보여주는 **고스트**, `state.queue` 에 이미
들어있는 다음 조각들을 보드 옆에 그리는 **미리보기**.

## 병렬 작업 주의 (중요)

**T-003b 가 같은 파일을 동시에 수정 중이다.** 충돌을 줄이기 위해:

- `state` 에 추가할 필드는 **`isSoftDropping:` 줄 다음, 객체 끝**에 넣어라.
  `lockedCount` 주변은 T-003b 의 영역이다.
- `stepDown`, `advance`, `hardDrop`, `clearLines` 를 **건드리지 마라.**
  T-003b 가 재구성 중이다.
- `lockAndSpawn()` 은 T-003b 의 영역이다. 너는 **성공 경로의 마지막에
  `state.canHold = true;` 한 줄만** 추가한다. 그 이상 손대지 마라.
  이 한 줄은 병합 시 충돌할 수 있고, 그건 예상된 것이다.
- RENDER 섹션과 `render()` 는 네 영역이다.

## 기존 코드에서 반드시 지킬 것

- 고스트 위치 계산은 순수 함수: `dropPosition(board, piece) -> piece`.
  기존 `collides` 와 `movedBy` 를 재사용한다.
- 홀드는 `applyIntent` 에 `{ type: 'hold' }` 의도로 추가한다. 키 핸들러가
  직접 `state` 를 고치지 않는다 (T-002 의 INPUT/LOGIC 분리 유지).
- 미리보기 캔버스는 새 `<canvas>` 를 추가하고 기존 `drawCell` 을 재사용한다.
  본 보드 캔버스 크기를 바꾸지 마라.
- 새 상수(홀드 키, 고스트 투명도, 미리보기 셀 크기·개수)는 전부 `CONFIG` 에.
- CSS 값은 `:root` 커스텀 프로퍼티로 정의한다.

## 명세

**홀드.** `C` 또는 `Shift` 로 현재 조각을 보관한다. 보관함이 비어 있으면
현재 조각을 넣고 큐에서 다음 조각을 꺼낸다. 차 있으면 현재 조각과 교환한다.
교환된 조각은 `rot: 0`, 스폰 위치로 초기화된다. **한 조각이 고정될 때까지
홀드는 1회만** 가능하다 (`state.canHold`).

**고스트.** 현재 조각이 하드 드롭될 위치를 `CONFIG.GHOST_ALPHA` 투명도로
그린다. 현재 조각과 겹치면 현재 조각이 위에 그려진다.

**미리보기.** `state.queue` 앞에서 `CONFIG.PREVIEW_COUNT`(=5)개를 보드
오른쪽에 세로로 그린다. 홀드 조각은 보드 왼쪽에 1칸.

## Acceptance criteria

1. `dropPosition(board, piece)` 는 인자를 변형하지 않고 새 piece 를 반환한다.
   반환된 piece 에서 한 칸 더 내려가면 `collides` 가 true 다.
2. 빈 보드 중앙 조각의 고스트가 최하단에 위치한다. 좌표를 숫자로 보고한다.
3. 홀드가 비어 있을 때 홀드하면 `state.hold` 에 현재 조각 id 가 들어가고
   큐에서 다음 조각이 나온다. `state.queue.length` 가 여전히
   `CONFIG.QUEUE_SIZE` 이상이다.
4. 홀드가 차 있을 때 홀드하면 두 조각이 교환되고, 나온 조각의 `rot` 이 0,
   위치가 스폰 좌표다.
5. 한 조각에 대해 홀드를 2회 시도하면 두 번째는 무시된다
   (`state.canHold === false`).
6. 조각이 고정되면 `state.canHold` 가 다시 true 가 된다.
7. 미리보기 캔버스에 `CONFIG.PREVIEW_COUNT` 개 조각이 그려지고, 그 id 순서가
   `state.queue` 앞부분과 일치한다.
8. 본 보드 캔버스의 `width`/`height` 가 T-003a 와 동일하다.
9. `collides`, `lockPiece`, `pieceCells`, `movedBy`, `tryRotate`,
   `nextPieceId` 의 시그니처가 변경되지 않았다 (`git diff` 로 보고).
10. T-002 기준 1~5 가 여전히 성립한다 (이동, DAS/ARR, 드롭, 회전).

## Out of scope / 하지 말 것

- 점수·레벨·라인 클리어를 구현하지 마라 → T-003b
- 락 딜레이를 구현하지 마라 → T-003b
- 사이드 패널 디자인·레이아웃 정리 → T-004. 지금은 배치만 되면 된다.
- `lockAndSpawn` 에 한 줄 초과로 손대지 마라.

## Verification

시간 경과를 기다리지 마라. `applyIntent({type:'hold'})` 를 직접 호출하고
`state` 를 읽는다. 고스트는 `dropPosition` 반환값을 직접 확인한다.

## 최종 출력 형식

수용 기준 10개에 대해 **정확히 10줄**:
`N. 충족|미충족|미검증 — <근거: 관측값 또는 코드 위치>`
기준 2 는 좌표를 숫자로 적는다.
그 다음 `feat:` 커밋. 본문에 `T-003c`.
