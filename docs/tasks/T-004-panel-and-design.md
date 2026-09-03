# T-004 — 사이드 패널 UI와 디자인 확정

Phase: 3 · Status: Ready · Depends on: T-003b (`5b09092`), T-003c (`0610e74`)
흡수: T-006 (색상 토큰 이중 정의, `BAG_SIZE` 상수)

## Summary

지금 `state` 에만 있고 화면에 없는 값들(점수, 레벨, 지운 줄 수)을 보여주고,
일시정지·재시작·게임오버 상태를 화면에 만든다. 그리고 계획 문서
Decision point 5 에서 미뤄둔 디자인 방향을 확정해 적용한다.

**확정된 디자인 방향: 다크 네온 아케이드.** 계획 문서의 권장안을 채택한다.

## 기존 코드에서 반드시 지킬 것

- RENDER 섹션만 확장한다. LOGIC(`collides`, `lockPiece`, `clearLines`,
  `tryRotate`, `dropPosition`)은 **한 줄도 건드리지 마라.**
- `advance()`, `stepDown()`, `lockAndSpawn()`, `holdCurrentPiece()` 를
  건드리지 마라. 일시정지는 LOOP 의 `frame()` 에서 처리한다.
- 조각 색상과 격자 색은 **CSS 커스텀 프로퍼티가 유일한 진실의 원천**이다.
  현재 `#2a2e37` 이 `:root --color-grid` 와 `CONFIG.COLORS.GRID` 두 곳에
  중복 정의돼 있다 (T-006). canvas 는
  `getComputedStyle(document.documentElement).getPropertyValue('--...')`
  로 CSS 에서 읽어라. JS 에 hex 리터럴을 남기지 마라.
- `CONFIG.BAG_SIZE` 는 `PIECE_IDS.length` 와 항상 같아야 하는데 조절 가능한
  것처럼 노출돼 있다. 다른 값을 넣으면 7-bag 불변식이 조용히 깨진다.
  `CONFIG` 에서 제거하고 `PIECE_IDS.length` 를 쓰도록 고쳐라 (T-006).
- 새 상수는 `CONFIG` 에, 새 색·간격·타이포 값은 `:root` 에.

## Scope

포함:
- 점수 / 레벨 / 지운 줄 수 표시. 값이 바뀔 때만 DOM 을 갱신한다
  (매 프레임 textContent 를 쓰지 마라)
- `P` 또는 `Esc` 일시정지·재개, `R` 재시작
- 일시정지 / 게임오버 오버레이
- 탭이 백그라운드로 가면 자동 일시정지 (`document.hidden`)
- 다크 네온 아케이드 디자인 적용
- T-006: 색상 단일 출처화, `BAG_SIZE` 제거
- 320px 폭에서 가로 스크롤 없이 동작

제외:
- T-스핀 / B2B / 콤보 → T-005
- 모바일 터치 조작 → T-005
- 최고 점수 저장 → T-005
- 라인 클리어 애니메이션 → 하지 마라. 모션은 아래 규칙만.

## 디자인 요구사항

템플릿처럼 보이면 실패다. 다음을 지킨다.

- **위계**: 점수가 가장 크고, 레벨/줄 수는 그 아래 단계. 라벨과 값의 크기
  대비가 분명해야 한다. 전부 같은 크기로 나열하지 마라.
- **네온의 정의**: 조각 색은 유지하되 보드 주변에 발광을 준다.
  `box-shadow` 로 층을 만들고, 배경은 완전한 검정이 아닌 깊은 청록/보라 계열.
- **리듬**: 패널 간 여백을 균일하게 두지 마라. 보드가 주인공이다.
- **상태 표현**: 일시정지와 게임오버가 시각적으로 구분돼야 한다. 같은
  반투명 검정 오버레이에 글자만 바꾸는 것은 안 된다.
- **모션**: `transform` 과 `opacity` 만 애니메이션한다. `width`/`top`/
  `font-size` 등 레이아웃 속성은 금지.
- `prefers-reduced-motion: reduce` 에서 모션을 제거한다.

## Acceptance criteria

1. 점수·레벨·줄 수가 화면에 표시되고 `state` 값과 일치한다. 하드드롭 1회
   후 표시된 점수와 `state.score` 가 같음을 보고한다.
2. DOM 갱신이 값 변화 시에만 일어난다. 값이 안 변한 프레임에서
   `textContent` 대입이 발생하지 않음을 코드 위치로 보인다.
3. `P` 로 일시정지하면 조각이 멈추고, 다시 누르면 이어진다. 일시정지 중
   `advance()` 가 호출되지 않음을 보인다.
4. 일시정지 중 방향키를 눌러도 `state.piece` 가 변하지 않는다.
5. `R` 로 재시작하면 `score`/`level`/`clearedLines`/`lockedCount` 가 초기값이
   되고 보드가 빈다. 초기화 후 값들을 보고한다.
6. 탭을 숨기면(`document.hidden`) 자동 일시정지되고, 복귀 시 조각이
   순간이동하지 않는다.
7. 게임오버 오버레이와 일시정지 오버레이가 **서로 다른 시각적 상태**다.
   무엇이 다른지 한 줄로 설명한다.
8. JS 소스에 색상 hex 리터럴이 없다. `grep -nE "#[0-9a-fA-F]{3,6}"` 결과가
   `<style>` 블록 안에만 있음을 보인다.
9. `CONFIG.BAG_SIZE` 가 제거됐고 7-bag 이 여전히 동작한다.
   bag 경계부터 70뽑기 분포를 보고한다.
10. 320px 폭에서 가로 스크롤이 없다. `document.documentElement.scrollWidth`
    와 `clientWidth` 를 비교해 보고한다.
11. `prefers-reduced-motion: reduce` 에뮬레이션에서 애니메이션이 없다.
12. LOGIC 섹션과 `advance`/`stepDown`/`lockAndSpawn`/`holdCurrentPiece` 가
    변경되지 않았다 (`git diff` 로 보고).
13. T-003b 기준 4, T-003c 기준 5 가 여전히 성립한다 (락 딜레이 500ms,
    홀드 1회 제한).

## Out of scope / 하지 말 것

- LOGIC 을 "더 낫게" 리팩터링하지 마라.
- 터치 이벤트를 추가하지 마라 (T-005).
- localStorage 를 쓰지 마라 (T-005).
- 폰트를 CDN 에서 불러오지 마라. 외부 리소스 금지 규약이다.
- 라인 클리어 애니메이션을 만들지 마라.

## Verification

시간 경과를 기다리지 마라. `advance(deltaMs)` 직접 호출과 `state` 읽기로
확인한다. 화면은 스크린샷으로 확인하고, 320px 는 뷰포트를 리사이즈해서 본다.

## 최종 출력 형식

수용 기준 13개에 대해 **정확히 13줄**:
`N. 충족|미충족|미검증 — <근거: 관측값 또는 코드 위치>`
기준 7 은 두 오버레이의 차이를 한 줄로 적는다.
그 다음 `feat:` 커밋. 본문에 `T-004` 와 `T-006` 을 적는다.
